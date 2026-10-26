import { signBackupPage } from './sessionBackupAuthentication.js';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import { coordinateWorkerGroupBackup } from './workerGroups.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';
import { sessionSlugStorageKey } from './sessionSlugResolution.js';
import { recoveryKeyFingerprint } from '../shared/recoveryKey.mjs';
import { sha256Hex } from '../shared/deployHelperCore.mjs';
import { bytesToBase64url } from './storageEnvelopeEncryption.js';
import {
  getStorageIndexBinding, getStorageR2Binding, buildPayloadKey, readStoredCloudflarePayloadBytes,
} from './storageRouteExecution.js';
import { STORAGE_EXPORT_PAGE_LIMITS, createStorageExportBudget, jsonByteLength, storageExportCursor, parseStorageExportCursor } from './storageScanBudget.js';

const encoder = new TextEncoder();
const CHUNK_BYTES = 256 * 1024;
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const digestBytes = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((v) => v.toString(16).padStart(2, '0')).join('');
const prefixes = (slug) => [null, `ce-storage-hidden:${slug}:`, `ce-storage-owner:${slug}:`, `ce-storage-payload:${slug}:`, `ce-storage:${slug}:`, `sessions/${slug}/storage/`];

// Access state is pinned across pages. Storage writes must be quiescent during
// export: KV and R2 do not offer a joint, point-in-time snapshot.
export const exportSessionBackup = async ({ env, slug, expectedAuthority, cursor = '' }) => {
  const keySlug = sessionSlugStorageKey(slug);
  const budget = createStorageExportBudget();
  const rawIndex = getStorageIndexBinding(env);
  const index = rawIndex ? budget.wrap(rawIndex) : null;
  if (!index?.list || !index?.get) fail('Backup storage is unavailable.', 503);
  const current = await callSessionConfigCoordinator({ env, slug, path: 'backup/export', expectedAuthority });
  if (!current.ok) fail(current.body?.error || 'Backup authority is unavailable.', current.status);
  const coordinator = current.body.coordinator;
  const sessionId = resolveCanonicalWorkerSessionIdHex(coordinator.configAuthority.config);
  if (!sessionId) fail('The session has no canonical identity.');
  const prefix = `ce-backup:${keySlug}:`;
  const parsed = parseStorageExportCursor({ cursor, prefix, sessionId });
  const position = parsed.continuation || { phase: 0, listCursor: '', lastKey: '', chunk: -1, pageNumber: 0,
    exportedAt: new Date().toISOString(), writeRevision: current.body.writeRevision,
    configDigest: await sha256Hex(JSON.stringify(coordinator)), counts: { records: 0, payloads: 0, owners: 0, hidden: 0, bytes: 0 } };
  if (position.configDigest !== await sha256Hex(JSON.stringify(coordinator))) fail('Session config changed during backup. Restart the export.');
  const groups = await coordinateWorkerGroupBackup({ env, slug, sessionId, operation: 'export', snapshotId: position.groupSnapshotId });
  if (!groups.ok) fail(groups.error || 'Group backup is unavailable.', groups.status);
  budget.consume(groups.operations || 0);
  position.groupSnapshotId = groups.snapshotId;
  if (groups.preparing) {
    position.preparation = (position.preparation || 0) + 1;
    return { ok: true, preparing: true, nextCursor: storageExportCursor({ prefix, sessionId, continuation: position }) };
  }
  coordinator.workerGroups = groups.snapshot;
  const snapshotBytes = encoder.encode(JSON.stringify(coordinator));
  const snapshotDigest = await digestBytes(snapshotBytes);
  if (!position.snapshotDigest) position.snapshotDigest = snapshotDigest;
  const paths = prefixes(keySlug);
  if (!Number.isSafeInteger(position.phase) || position.phase < 0 || position.phase > 6 ||
      !Number.isSafeInteger(position.chunk) || position.chunk < -1 || !Number.isSafeInteger(position.pageNumber) || position.pageNumber < 0 ||
      typeof position.listCursor !== 'string' || position.listCursor.length > 4096 || typeof position.lastKey !== 'string' ||
      (position.lastKey && position.phase > 0 && !position.lastKey.startsWith(paths[position.phase])) ||
      !position.counts || !['records', 'payloads', 'owners', 'hidden', 'bytes'].every((key) => Number.isSafeInteger(position.counts[key]) && position.counts[key] >= 0) ||
      !Number.isFinite(Date.parse(position.exportedAt))) fail('Invalid backup cursor.', 400);
  if (position.snapshotDigest !== snapshotDigest) fail('Session config or groups changed during backup. Restart the export.');
  const manifest = { type: 'ce_session_backup', version: 1, sessionSlug: keySlug, sessionId,
    exportedAt: position.exportedAt, workerBundle: env.CE_BUNDLE_SHA256 || null,
    // Conservatively require both bindings: restored active session keys and
    // older direct wrappers can still depend on the previous KEK.
    kekFingerprint: await recoveryKeyFingerprint(env.CE_STORAGE_ENVELOPE_KEK),
    ...(env.CE_STORAGE_ENVELOPE_PREVIOUS_KEK ? { previousKekFingerprint: await recoveryKeyFingerprint(env.CE_STORAGE_ENVELOPE_PREVIOUS_KEK) } : {}),
    counts: position.counts, complete: false };
  const page = { ok: true, manifest, pageNumber: position.pageNumber, entries: [], nextCursor: '', snapshotDigest,
    archiveId: await sha256Hex(`${sessionId}:${manifest.exportedAt}:${snapshotDigest}`) };
  const finish = async () => {
    const latest = await callSessionConfigCoordinator({ env, slug, path: 'backup/export', expectedAuthority });
    if (!latest.ok) fail(latest.body?.error || 'Backup authority is unavailable.', latest.status);
    const groupCheck = await coordinateWorkerGroupBackup({ env, slug, sessionId, operation: 'export', snapshotId: position.groupSnapshotId, checkOnly: true });
    if (!groupCheck.ok && groupCheck.status !== 409) fail(groupCheck.error || 'Group backup is unavailable.', groupCheck.status);
    if (!groupCheck.ok || position.writeRevision !== latest.body.writeRevision) {
      manifest.complete = false;
      page.nextCursor = '';
      page.reason = 'backup_session_changed';
      page.error = 'The session changed during export; export again.';
    }
    return signBackupPage(page, env);
  };
  if (position.writeRevision !== current.body.writeRevision) return finish();
  let used = jsonByteLength(page) + 16384;
  let rows = 0;
  const append = (entry) => {
    const size = jsonByteLength(entry) + 1;
    if (size > STORAGE_EXPORT_PAGE_LIMITS.encodedBytes - 16384) fail('A backup metadata record exceeds the page limit.');
    if (used + size > STORAGE_EXPORT_PAGE_LIMITS.encodedBytes) return false;
    page.entries.push(entry);
    used += size;
    return true;
  };
  const payload = async (id, bytes, metadata, target) => {
    const sha256 = await digestBytes(bytes);
    const chunkCount = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));
    if (position.chunk === -1) {
      if (!append({ kind: 'payload', id, size: bytes.length, sha256, chunkCount, ...(metadata ? { metadata } : {}), ...(target ? { target } : {}) })) return false;
      position.chunk = 0;
    }
    for (; position.chunk < chunkCount; position.chunk += 1) {
      if (!append({ kind: 'chunk', id, index: position.chunk, base64url: bytesToBase64url(bytes.subarray(position.chunk * CHUNK_BYTES, (position.chunk + 1) * CHUNK_BYTES)), ...(target ? { target } : {}) })) return false;
    }
    position.chunk = -1;
    if (!target) { position.counts.payloads += 1; position.counts.bytes += bytes.length; }
    return true;
  };
  if (position.phase === 0) {
    if (snapshotBytes.length <= STORAGE_EXPORT_PAGE_LIMITS.metadataBytes && position.chunk === -1) {
      page.coordinator = coordinator;
      used += snapshotBytes.length;
    } else {
      if (position.pageNumber === 0) page.coordinator = { chunked: true, sha256: snapshotDigest };
      if (!await payload('coordinator', snapshotBytes, null, 'coordinator')) {
        position.pageNumber += 1;
        page.nextCursor = storageExportCursor({ prefix, sessionId, continuation: position });
        return finish();
      }
    }
    position.phase = 1;
  }
  outer: while (position.phase < paths.length && rows < STORAGE_EXPORT_PAGE_LIMITS.rows && budget.remaining >= 16) {
    const r2 = position.phase === 5 ? getStorageR2Binding(env) : null;
    if (position.phase === 5 && !r2) { position.phase += 1; break; }
    const listed = await (r2 || index).list({ prefix: paths[position.phase], ...(position.listCursor ? { cursor: position.listCursor } : {}), limit: STORAGE_EXPORT_PAGE_LIMITS.rows });
    const keys = (r2 ? listed.objects?.map(({ key }) => key) : listed.keys?.map(({ name }) => name));
    if (!Array.isArray(keys)) fail('Backup storage listing is unavailable.', 503);
    keys.sort();
    for (const key of keys) {
      if (!key.startsWith(paths[position.phase])) fail('Invalid backup storage key.', 503);
      if (key < position.lastKey || (key === position.lastKey && position.chunk === -1)) continue;
      if (rows >= STORAGE_EXPORT_PAGE_LIMITS.rows || budget.remaining < 16) break outer;
      if (position.phase === 3 || position.phase === 5) {
        const id = key.slice(paths[position.phase].length);
        const raw = await index.get(buildPayloadKey({ slug, id }));
        if (r2 && raw != null) { position.lastKey = key; continue; }
        const metadata = raw != null ? JSON.parse(raw).metadata : { id };
        const bytes = await readStoredCloudflarePayloadBytes({ env, index, slug, metadata, strict: true });
        if (!bytes) fail('A backup payload is missing or unreadable.', 503);
        // A partial payload resumes this same listed key, without skipping it.
        const priorKey = position.lastKey;
        position.lastKey = key;
        if (!await payload(id, bytes, metadata)) {
          if (position.chunk === -1) position.lastKey = priorKey;
          break outer;
        }
      } else {
        const value = await index.get(key);
        if (value == null) fail('A storage record changed during backup. Restart the export.');
        const metadata = position.phase === 4 ? JSON.parse(value) : null;
        const entry = metadata ? { kind: 'record', key, id: metadata.id, resource: metadata.resource, metadata }
          : { kind: position.phase === 1 ? 'hidden' : 'owner', key, value };
        if (!append(entry)) break outer;
        position.counts[metadata ? 'records' : position.phase === 1 ? 'hidden' : 'owners'] += 1;
        position.lastKey = key;
      }
      rows += 1;
    }
    const more = r2 ? listed.truncated === true : listed.list_complete === false;
    if (more) {
      if (!listed.cursor || listed.cursor === position.listCursor) fail('Backup list cursor did not advance.', 503);
      position.listCursor = listed.cursor;
      position.lastKey = '';
    } else {
      position.phase += 1;
      position.listCursor = '';
      position.lastKey = '';
    }
  }
  manifest.complete = position.phase === paths.length;
  if (!manifest.complete) {
    position.pageNumber += 1;
    page.nextCursor = storageExportCursor({ prefix, sessionId, continuation: position });
  }
  return finish();
};
