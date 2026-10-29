import { readSessionSecretsAuthority } from './sessionSecretsAuthority.js';
import { stripAgentAdmissionFromBackup } from './agent/backup.mjs';
import { readBackupGroupSnapshot } from './sessionBackupGroupSnapshot.js';
import { STORAGE_BACKUP_REVISION_KEY } from './storageBackupRevision.js';
import { resolveWorkerGroupsKv, workerGroupBackupPrefixes } from './workerGroups.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';
import { normalizeWorkerSessionSlug, resolveCoordinatorSessionSlugStorageKey } from './sessionSlugResolution.js';
import { isEncryptedSessionSecretsEnvelope } from '../shared/sessionSecretsEnvelope.mjs';
import { backupImportJournalKey, journalBackupImportWrite, cleanupBackupImportJournal, clearBackupImportMetadata } from './sessionBackupLifecycle.js';

const json = (body, status = 200) => Response.json(body, { status });
const fail = (message, status = 503) => { throw Object.assign(new Error(message), { status }); };
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const groupPrefixes = (slug) => ['ce-worker-group', 'ce-worker-group-index', 'ce-worker-group-member', 'ce-worker-group-principal'].map((kind) => `${kind}:${slug}:`);
export const BACKUP_GROUP_IMPORT_ACTIVE_KEY = 'worker-group-backup-import-active';
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
  const secretAuthority = await coordinator.state.storage.transaction((transaction) => readSessionSecretsAuthority(coordinator, transaction, current.slug));
  const secrets = secretAuthority?.envelope || null;
  if (signer && !isEncryptedSessionSecretsEnvelope(signer.envelope)) fail('Invalid wrapped authorization signer.', 409);
  return json({ ok: true, writeRevision: await coordinator.state.storage.get(STORAGE_BACKUP_REVISION_KEY) || 0, coordinator: {
    configAuthority: { ...current, config: stripAgentAdmissionFromBackup(current.config) },
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
  const kv = resolveWorkerGroupsKv(coordinator.env);
  if (!kv?.list || !kv?.get) fail('Worker group storage is unavailable.');
  return json(await readBackupGroupSnapshot({ coordinator, payload: { ...payload, slug, sessionId, kv },
    prefixes: groupPrefixes(slug), scopeRecords: scopedGroupRecords,
    validateDurable: (key, value) => {
      if (!object(value) || value.pending || ['creating', 'updating', 'deleting', 'reserved', 'removing'].includes(value.phase || value.state)) {
        fail('A group mutation is pending. Retry the backup after it settles.', 409);
      }
      if (key === 'worker-group-capacity-meta-v3' && (value.slug !== slug || value.sessionId !== sessionId)) fail('Group backup identity conflict.', 409);
    },
  }));
};

export const controlWorkerGroupBackupImport = async (coordinator, payload, operation) => {
  const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
  const sessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: payload?.sessionId });
  const { archiveId } = payload;
  if (!slug || !sessionId || !/^[a-f0-9]{64}$/.test(archiveId || '')) fail('Invalid group restore identity.', 400);
  const { storage } = coordinator.state;
  const active = await storage.get(BACKUP_GROUP_IMPORT_ACTIVE_KEY);
  if (active && active !== archiveId) fail('Another group restore is in progress.', 409);
  const kv = resolveWorkerGroupsKv(coordinator.env);
  if (!kv?.list || !kv?.delete) fail('Group restore storage is unavailable.');
  if (operation === 'begin') {
    if (active) return json({ ok: true, operations: 0 });
    const nonempty = () => { throw Object.assign(new Error('Restore requires an empty target session.'), { status: 409, reason: 'backup_target_not_empty' }); };
    if ((await storage.list({ prefix: 'worker-group-capacity-', limit: 1 })).size) nonempty();
    for (const prefix of groupPrefixes(slug)) {
      const rows = await kv.list({ prefix, limit: 1 });
      if (!Array.isArray(rows.keys)) fail('Group restore storage could not be checked.');
      if (rows.keys.length || rows.list_complete === false) nonempty();
    }
    if (!payload.checkOnly) await storage.put(BACKUP_GROUP_IMPORT_ACTIVE_KEY, archiveId);
    return json({ ok: true, operations: 5 });
  }
  if (operation === 'abandon') {
    const result = await cleanupBackupImportJournal(storage, archiveId, { group: kv, durable: storage });
    if (result.complete) await storage.delete(BACKUP_GROUP_IMPORT_ACTIVE_KEY);
    return json({ ok: true, ...result });
  }
  const complete = await clearBackupImportMetadata(storage, archiveId);
  if (complete) {
    await storage.transaction(async (transaction) => {
      await transaction.put('worker-group-backup-import-completion', { archiveId, completedAt: coordinator.now() });
      await transaction.delete(BACKUP_GROUP_IMPORT_ACTIVE_KEY);
    });
  }
  return json({ ok: true, complete });
};

export const importWorkerGroupBackup = async (coordinator, payload) => {
  const slug = resolveCoordinatorSessionSlugStorageKey(payload?.slug);
  const sessionId = resolveCanonicalWorkerSessionIdHex({ sessionId: payload?.sessionId });
  const snapshot = payload?.snapshot;
  if (!slug || !sessionId || !Array.isArray(snapshot?.durable) || !Array.isArray(snapshot?.records)) fail('Invalid group backup.', 400);
  if (!payload.archiveId || await coordinator.state.storage.get(BACKUP_GROUP_IMPORT_ACTIVE_KEY) !== payload.archiveId) fail('The group restore has not reserved an empty target.', 409);
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
  // Only this archive may have rows here. Rechecking identical writes makes
  // retry after a lost reply safe; journal before every first write for rollback.
  let phase = payload.cursor?.phase || 'check';
  let offset = payload.cursor?.offset || 0;
  if (!['check', 'apply'].includes(phase) || !Number.isSafeInteger(offset) || offset < 0) fail('Invalid group restore cursor.', 400);
  const limit = Math.min(700, Math.max(0, Number(payload.operations) || 700));
  let operations = 0;
  while (true) {
    const rows = phase === 'check' ? [...snapshot.durable, ...snapshot.records] : [...snapshot.records, ...snapshot.durable];
    if (offset > rows.length) fail('Invalid group restore offset.', 400);
    for (; offset < rows.length; offset += 1) {
      if (operations + 2 > limit) return json({ ok: true, counts, conflicts, operations, nextCursor: { phase, offset } });
      const [key, value] = rows[offset];
      const store = key.startsWith('worker-group-capacity-') ? coordinator.state.storage : kv;
      const kind = store === kv ? 'group' : 'durable';
      const existing = await store.get(key);
      operations += 1;
      if (existing != null && (!await coordinator.state.storage.get(backupImportJournalKey(payload.archiveId, kind, key)) ||
          JSON.stringify(existing) !== JSON.stringify(value))) conflicts.push(key);
      else if (phase === 'apply') {
        if (existing != null) counts.skipped += 1;
        else {
          await journalBackupImportWrite(coordinator.state.storage, payload.archiveId, kind, key);
          await store.put(key, value); operations += 1; counts.written += 1;
        }
      }
    }
    if (phase === 'apply' || conflicts.length) return json({ ok: true, counts, conflicts, operations, nextCursor: null });
    phase = 'apply';
    offset = 0;
  }
};
