import { resolveWorkerGroupsKv, workerGroupBackupPrefixes } from './workerGroups.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';
import { resolveCoordinatorSessionSlugStorageKey } from './sessionSlugResolution.js';
import { isEncryptedSessionSecretsEnvelope } from '../shared/sessionSecretsEnvelope.mjs';

const json = (body, status = 200) => Response.json(body, { status });
const fail = (message, status = 503) => { throw Object.assign(new Error(message), { status }); };
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const parse = (raw) => typeof raw === 'string' ? JSON.parse(raw) : raw;

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
  for (const prefix of workerGroupBackupPrefixes({ slug, sessionId })) {
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
  return json({ ok: true, snapshot: { durable, records } });
};
