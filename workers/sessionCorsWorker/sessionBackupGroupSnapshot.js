import { STORAGE_BACKUP_REVISION_KEY } from './storageBackupRevision.js';

const fail = (message) => { throw Object.assign(new Error(message), { status: 409 }); };
const pad = (n) => String(n).padStart(8, '0');

// Group rows are read from KV once per archive. Small DO values hold the
// snapshot between export pages, including rows too large for one DO value.
export const readBackupGroupSnapshot = async ({ coordinator, payload, prefixes, validateDurable, scopeRecords }) => {
  const { storage } = coordinator.state;
  const { slug, sessionId } = payload;
  // DO storage has no TTL; reclaim expired snapshot chunks incrementally.
  const snapshots = await storage.list({ prefix: 'worker-group-backup-meta:', limit: 100 });
  const expired = [...snapshots].find(([, value]) => value.expiresAt <= coordinator.now());
  if (expired) {
    const id = expired[0].slice('worker-group-backup-meta:'.length);
    const chunks = await storage.list({ prefix: `worker-group-backup:${id}:data:`, limit: 100 });
    for (const [key] of chunks) await storage.delete(key);
    if (chunks.size < 100) await storage.delete(expired[0]);
  }
  const revision = await storage.get(STORAGE_BACKUP_REVISION_KEY) || 0;
  const snapshotId = payload.snapshotId || crypto.randomUUID();
  if (!/^[a-f0-9-]{36}$/.test(snapshotId)) fail('Invalid group snapshot cursor.');
  const root = `worker-group-backup:${snapshotId}`;
  const stateKey = `worker-group-backup-meta:${snapshotId}`;
  let state = await storage.get(stateKey);
  if (!state) {
    if (payload.snapshotId) fail('The group snapshot expired; export again.');
    state = { slug, sessionId, revision, phase: 0, cursor: '', batch: 0, expiresAt: coordinator.now() + 7 * 86400 * 1000 };
  }
  if (state.slug !== slug || state.sessionId !== sessionId || state.expiresAt <= coordinator.now() || state.revision !== revision) {
    fail('Session groups changed or the snapshot expired; export again.');
  }
  if (payload.checkOnly) return { ok: true, snapshotId, operations: 0 };
  let operations = 0;
  while (state.phase <= prefixes.length && operations < 400) {
    const durable = state.phase === 0;
    const prefix = durable ? 'worker-group-capacity-' : prefixes[state.phase - 1];
    const store = durable ? storage : payload.kv;
    const listed = await store.list({ prefix, ...(durable ? { startAfter: state.cursor } : { cursor: state.cursor }), limit: 100 });
    operations += 1;
    let rows;
    let next;
    if (durable) {
      if (!(listed instanceof Map)) fail('Group authority could not be read.');
      rows = [...listed];
      for (const [key, value] of rows) validateDurable(key, value);
      next = rows.length === 100 ? rows.at(-1)[0] : '';
    } else {
      rows = [];
      for (const { name } of listed.keys || []) {
        if (!name.startsWith(prefix)) fail('Invalid group backup key.');
        const value = await store.get(name);
        operations += 1;
        if (value == null) fail('Group changed during backup; export again.');
        rows.push([name, value]);
      }
      next = listed.list_complete === false ? String(listed.cursor || '') : '';
      if (listed.list_complete === false && !next) fail('Group backup list cursor is unavailable.');
    }
    if (next && next === state.cursor) fail('Group backup list cursor did not advance.');
    const text = `${JSON.stringify({ durable, rows })}\n`;
    for (let offset = 0, chunk = 0; offset < text.length; offset += 16384, chunk += 1) {
      await storage.put(`${root}:data:${pad(state.batch)}:${pad(chunk)}`, text.slice(offset, offset + 16384));
    }
    state.batch += 1;
    state.cursor = next;
    if (!next) state.phase += 1;
    await storage.put(stateKey, state);
  }
  if (state.phase <= prefixes.length) return { ok: true, preparing: true, snapshotId, operations };
  let text = '';
  let after = '';
  for (;;) {
    const part = await storage.list({ prefix: `${root}:data:`, startAfter: after, limit: 100 });
    for (const [, value] of part) text += value;
    if (part.size < 100) break;
    after = [...part.keys()].at(-1);
  }
  const durable = [];
  const records = [];
  for (const line of text.split('\n').filter(Boolean)) {
    const part = JSON.parse(line);
    (part.durable ? durable : records).push(...part.rows);
  }
  return { ok: true, snapshotId, operations, snapshot: { durable, records: scopeRecords(records, slug, sessionId) } };
};
