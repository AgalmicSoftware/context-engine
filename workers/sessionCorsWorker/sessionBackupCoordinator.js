import { resolveWorkerGroupsKv, workerGroupBackupPrefixes } from './workerGroups.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';
import { resolveCoordinatorSessionSlugStorageKey } from './sessionSlugResolution.js';
import { isEncryptedSessionSecretsEnvelope } from '../shared/sessionSecretsEnvelope.mjs';

const json = (body, status = 200) => Response.json(body, { status });
const fail = (message, status = 503) => { throw Object.assign(new Error(message), { status }); };
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const parse = (raw) => typeof raw === 'string' ? JSON.parse(raw) : raw;

const groupPrefixes = (slug) => ['ce-worker-group', 'ce-worker-group-index', 'ce-worker-group-member', 'ce-worker-group-principal'].map((kind) => `${kind}:${slug}:`);
const scopedGroupRecords = (records, slug, sessionId) => {
  const canonical = workerGroupBackupPrefixes({ slug, sessionId });
  const allowed = new Set(records.filter(([key]) => canonical.some((prefix) => key.startsWith(prefix))).map(([key]) => key));
  const indexValues = new Map();
  // Old catalog/member rows carry the immutable identity in their value.
  // Their string-only indexes are included only when a matching row proves it.
  for (const [key, raw] of records) {
    if (allowed.has(key)) continue;
    let row;
    try { row = JSON.parse(raw); } catch { continue; }
    if (row?.sessionSlug !== slug || resolveCanonicalWorkerSessionIdHex({ sessionId: row.sessionId }) !== sessionId ||
        !/^[a-z0-9][a-z0-9._-]*$/.test(row.groupId || '')) continue;
    if (key === `ce-worker-group:${slug}:${row.groupId}`) {
      allowed.add(key);
      indexValues.set(`ce-worker-group-index:${slug}:${row.groupId}`, row.groupId);
    } else if (typeof row.principalKey === 'string') {
      const encoded = btoa(row.principalKey.trim()).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const folded = row.principalKey.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'id';
      if (![encoded, folded].some((part) => key === `ce-worker-group-member:${slug}:${row.groupId}:${part}`)) continue;
      allowed.add(key);
      for (const part of [encoded, folded]) indexValues.set(`ce-worker-group-principal:${slug}:${part}:${row.groupId}`, row.groupId);
    }
  }
  return records.filter(([key, value]) => allowed.has(key) || indexValues.get(key) === value).sort(([a], [b]) => a < b ? -1 : 1);
};

export const exportCoordinatorBackup = async (coordinator, payload) => {
  const authority = await coordinator.assertSessionAuthority(payload);
  if (!authority) fail('Session config is not initialized.', 409);
  await coordinator.repairPendingSessionConfigProjection();
  const current = await coordinator.state.storage.get('session-config-authority');
  const signer = await coordinator.state.storage.get('session-lit-authorization-signer-v1');
  const rawSecrets = await coordinator.env.GROUP_KV.get(`session:${current.config.slug || ''}:secrets`);
  const secrets = rawSecrets == null ? null : parse(rawSecrets);
  if (secrets && !isEncryptedSessionSecretsEnvelope(secrets)) {
    fail('Legacy plaintext secrets must be saved through the encrypted secret workflow before backup.', 409);
  }
  if (signer && !isEncryptedSessionSecretsEnvelope(signer.envelope)) fail('Invalid wrapped authorization signer.', 409);
  return json({ ok: true, coordinator: {
    configAuthority: current,
    wrappedSessionKeys: {
      activeSessionKey: current.activeSessionKey || null,
      litAuthorizationSigner: signer || null,
    },
    secrets,
  } });
};

export const exportWorkerGroupBackup = async (coordinator, payload) => {
  const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
  const sessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: payload?.sessionId });
  if (!slug || !sessionId) fail('Invalid backup group identity.', 400);
  const durable = [];
  let after = '';
  for (;;) {
    const page = await coordinator.state.storage.list({ prefix: 'worker-group-capacity-', startAfter: after, limit: 500 });
    if (!(page instanceof Map)) fail('Group authority could not be read.');
    const entries = [...page].filter(([key]) => key > after).sort(([a], [b]) => a < b ? -1 : 1);
    for (const [key, value] of entries) {
      if (!object(value) || value.pending || ['creating', 'updating', 'deleting', 'reserved', 'removing'].includes(value.phase || value.state)) {
        fail('A group mutation is pending. Retry the backup after it settles.', 409);
      }
      if (key === 'worker-group-capacity-meta-v3' && (value.slug !== slug || value.sessionId !== sessionId)) fail('Group backup identity conflict.', 409);
      durable.push([key, value]);
    }
    if (entries.length < 500) break;
    after = entries.at(-1)[0];
  }
  const kv = resolveWorkerGroupsKv(coordinator.env);
  if (!kv?.list || !kv?.get) fail('Worker group storage is unavailable.');
  const records = [];
  for (const prefix of groupPrefixes(slug)) {
    let cursor = '';
    const visited = new Set();
    do {
      if (visited.has(cursor)) fail('Group backup list cursor did not advance.');
      visited.add(cursor);
      const page = await kv.list({ prefix, cursor, limit: 100 });
      for (const { name } of page.keys || []) {
        if (!name.startsWith(prefix)) fail('Invalid group backup key.');
        const value = await kv.get(name);
        if (value == null) fail('Group changed during backup. Retry the export.');
        records.push([name, value]);
      }
      cursor = page.list_complete === false ? String(page.cursor || '') : '';
      if (page.list_complete === false && !cursor) fail('Group backup list cursor is unavailable.');
    } while (cursor);
  }
  return json({ ok: true, snapshot: { durable, records: scopedGroupRecords(records, slug, sessionId) } });
};

export const importWorkerGroupBackup = async (coordinator, payload) => {
  const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
  const sessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: payload?.sessionId });
  const snapshot = payload?.snapshot;
  if (!slug || !sessionId || !Array.isArray(snapshot?.durable) || !Array.isArray(snapshot?.records)) fail('Invalid group backup.', 400);
  const scoped = scopedGroupRecords(snapshot.records, slug, sessionId);
  if (scoped.length !== snapshot.records.length) fail('Invalid group backup scope.', 400);
  const seen = new Set();
  for (const [key, value] of [...snapshot.durable, ...snapshot.records]) {
    if (typeof key !== 'string' || seen.has(key)) fail('Invalid or duplicate group backup key.', 400);
    seen.add(key);
    if (key.startsWith('worker-group-capacity-')) {
      if (!/^(worker-group-capacity-meta-v3|worker-group-capacity-(group|member)-v3:.+)$/.test(key) || !object(value) ||
          value.pending || ['creating', 'updating', 'deleting', 'reserved', 'removing'].includes(value.phase || value.state) ||
          (key === 'worker-group-capacity-meta-v3' && (value.slug !== slug || value.sessionId !== sessionId))) fail('Invalid group authority backup.', 400);
    } else if (typeof value !== 'string') fail('Invalid group backup value.', 400);
  }
  const kv = resolveWorkerGroupsKv(coordinator.env);
  if (!kv?.get || !kv?.put) fail('Group restore storage is unavailable.');
  const counts = { written: 0, skipped: 0 };
  const conflicts = [];
  // Check every existing row before adding any absent group state. A retry
  // after a partial storage outage can fill only the still-absent records.
  for (const [key, value] of [...snapshot.durable, ...snapshot.records]) {
    const store = key.startsWith('worker-group-capacity-') ? coordinator.state.storage : kv;
    const existing = await store.get(key);
    if (existing != null && JSON.stringify(existing) !== JSON.stringify(value)) conflicts.push(key);
  }
  if (conflicts.length) return json({ ok: true, counts, conflicts });
  for (const [key, value] of [...snapshot.records, ...snapshot.durable]) {
    const store = key.startsWith('worker-group-capacity-') ? coordinator.state.storage : kv;
    if (await store.get(key) != null) counts.skipped += 1;
    else { await store.put(key, value); counts.written += 1; }
  }
  return json({ ok: true, counts, conflicts });
};
