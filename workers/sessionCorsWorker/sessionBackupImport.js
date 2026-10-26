import { BACKUP_IMPORT_TTL_MS, BACKUP_IMPORT_ACTIVE_KEY, backupImportStagePrefix, readActiveBackupImport } from './sessionBackupLifecycle.js';
import { verifyBackupPage } from './sessionBackupAuthentication.js';
import { recoveryKeyFingerprint } from '../shared/recoveryKey.mjs';
import { sha256Hex } from '../shared/deployHelperCore.mjs';
import { normalizeWorkerSessionSlug, sessionSlugStorageKey } from './sessionSlugResolution.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';
import { isEncryptedSessionSecretsEnvelope } from '../shared/sessionSecretsEnvelope.mjs';
import { coordinateWorkerGroupBackup } from './workerGroups.js';
import { base64urlToBytes, bytesToBase64url } from './storageEnvelopeEncryption.js';
import { isSafeCloudflareStorageRefId } from './storageRefNormalization.js';
import { isStorageResourceId } from './storageUploadValidation.js';
import { STORAGE_EXPORT_PAGE_LIMITS, createStorageExportBudget, jsonByteLength } from './storageScanBudget.js';
import { rejectKvValueOverLimit, resolveMaxUploadBytes } from './uploadSizeLimits.js';
import { buildIndexKey, buildObjectKey, buildPayloadKey, getStorageIndexBinding, getStorageR2Binding, readStoredCloudflarePayloadBytes } from './storageRouteExecution.js';

const fail = (message, status = 400, reason) => { throw Object.assign(new Error(message), { status, reason }); };
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const stable = (value) => JSON.stringify(value, (_, item) => object(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const same = (a, b) => stable(a) === stable(b);
const digest = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((v) => v.toString(16).padStart(2, '0')).join('');
const hashPattern = /^[a-f0-9]{64}$/;
const resources = new Set(['docsContext', 'questions', 'surveys', 'responses', 'generatedArtifacts', 'media', 'images']);
const temporary = { expirationTtl: 7 * 86400 };

const validateSnapshot = ({ snapshot, manifest, normalizeConfig, normalizeSessionKey }) => {
  const authority = snapshot?.configAuthority;
  const slug = manifest.sessionSlug;
  if (!object(authority) || authority.schemaVersion !== 1 || authority.slug !== slug ||
      Object.keys(authority).some((key) => !['schemaVersion', 'slug', 'revision', 'config', 'projectionPending', 'activeSessionKey'].includes(key)) ||
      !Number.isSafeInteger(authority.revision) || authority.revision < 1 || authority.projectionPending !== false ||
      !normalizeConfig(authority.config, slug) || resolveCanonicalWorkerSessionIdHex(authority.config) !== manifest.sessionId ||
      !object(snapshot.wrappedSessionKeys) || !same(snapshot.wrappedSessionKeys.activeSessionKey, authority.activeSessionKey || null)) {
    fail('Invalid backup config authority.');
  }
  if (authority.activeSessionKey && !normalizeSessionKey(authority.activeSessionKey, slug)) fail('Invalid wrapped session key.');
  const signer = snapshot.wrappedSessionKeys.litAuthorizationSigner;
  if (signer && (signer.version !== 1 || signer.slug !== slug || Object.keys(signer).some((key) => !['version', 'slug', 'envelope'].includes(key)) ||
      !isEncryptedSessionSecretsEnvelope(signer.envelope))) fail('Invalid wrapped authorization signer.');
  if (snapshot.secrets && !isEncryptedSessionSecretsEnvelope(snapshot.secrets)) fail('Backup secrets must be ciphertext.');
  if (!Array.isArray(snapshot.workerGroups?.durable) || !Array.isArray(snapshot.workerGroups?.records)) fail('Invalid backup groups.');
};

const validatePage = (page, slug) => {
  const m = page?.manifest;
  if (!object(m) || m.type !== 'ce_session_backup' || m.version !== 1 || m.sessionSlug !== slug ||
      resolveCanonicalWorkerSessionIdHex({ sessionId: m.sessionId }) !== m.sessionId || !hashPattern.test(m.kekFingerprint || '') ||
      (m.previousKekFingerprint !== undefined && !hashPattern.test(m.previousKekFingerprint)) ||
      !hashPattern.test(page.archiveId || '') || !hashPattern.test(page.snapshotDigest || '') ||
      !Number.isSafeInteger(page.pageNumber) || page.pageNumber < 0 || typeof m.complete !== 'boolean' ||
      !Array.isArray(page.entries) || jsonByteLength(page) > STORAGE_EXPORT_PAGE_LIMITS.encodedBytes ||
      !object(m.counts) || !['records', 'payloads', 'owners', 'hidden', 'bytes'].every((key) => Number.isSafeInteger(m.counts[key]) && m.counts[key] >= 0)) {
    fail('Invalid session backup page.');
  }
  for (const entry of page.entries) {
    if (!object(entry)) fail('Invalid backup entry.');
    if (entry.kind === 'record') {
      if (!resources.has(entry.resource) || !isSafeCloudflareStorageRefId(entry.id) || !object(entry.metadata) ||
          entry.metadata.id !== entry.id || entry.metadata.resource !== entry.resource ||
          entry.key !== buildIndexKey({ slug, resource: entry.resource, id: entry.id })) fail('Invalid backup metadata key.');
    } else if (entry.kind === 'owner' || entry.kind === 'hidden') {
      const prefix = `ce-storage-${entry.kind}:${slug}:`;
      const suffix = typeof entry.key === 'string' ? entry.key.slice(prefix.length) : '';
      const separator = suffix.indexOf(':');
      if (typeof entry.key !== 'string' || !entry.key.startsWith(prefix) || !['questions', 'surveys'].includes(suffix.slice(0, separator)) || !isStorageResourceId(suffix.slice(separator + 1)) ||
          typeof entry.value !== 'string' || !object(JSON.parse(entry.value))) fail('Invalid backup ownership key.');
    } else if (entry.kind === 'payload' || entry.kind === 'chunk') {
      if (entry.target !== undefined && entry.target !== 'coordinator') fail('Invalid backup payload target.');
      if (entry.target === 'coordinator' ? entry.id !== 'coordinator' : !isSafeCloudflareStorageRefId(entry.id)) fail('Invalid backup payload id.');
      if (entry.kind === 'payload') {
        if (!Number.isSafeInteger(entry.size) || entry.size < 0 || !hashPattern.test(entry.sha256 || '') ||
            entry.chunkCount !== Math.max(1, Math.ceil(entry.size / (256 * 1024))) ||
            (entry.metadata && (!object(entry.metadata) || entry.metadata.id !== entry.id))) fail('Invalid backup payload header.');
      } else if (!Number.isSafeInteger(entry.index) || entry.index < 0 || typeof entry.base64url !== 'string' ||
          entry.base64url.length > Math.ceil(256 * 1024 * 4 / 3) || !/^[A-Za-z0-9_-]*$/.test(entry.base64url)) fail('Invalid backup chunk.');
    } else fail('Unknown backup entry kind.');
  }
};

// A page's durable progress is advanced after each entry. Payload/metadata
// writes are create-or-compare, so a crash before that marker can only replay
// an identical write. Chunk cleanup happens after the durable marker.
export const importCoordinatorBackupPage = async (coordinator, payload, validators) => {
  const { env, state: { storage } } = coordinator;
  const { page, expectedAuthority } = payload || {};
  const slug = sessionSlugStorageKey(payload?.slug);
  validatePage(page, slug);
  const manifest = page.manifest;
  const fingerprints = await Promise.all([env.CE_STORAGE_ENVELOPE_KEK, env.CE_STORAGE_ENVELOPE_PREVIOUS_KEK].filter(Boolean).map(recoveryKeyFingerprint));
  const required = [manifest.kekFingerprint, manifest.previousKekFingerprint].filter(Boolean);
  const missing = required.filter((fingerprint) => !fingerprints.includes(fingerprint));
  if (missing.length) fail(`The target is missing backup recovery keys: ${missing.join(', ')}.`, 409, 'recovery_key_mismatch');
  if (!await verifyBackupPage(page, env)) fail('Backup page authentication failed. Use the original unmodified archive.', 403, 'backup_authentication_failed');
  const current = await coordinator.assertSessionAuthority(payload);
  const targetId = resolveCanonicalWorkerSessionIdHex(current?.config || {});
  if (current ? targetId !== manifest.sessionId : payload.adoptSessionId !== true) fail('The backup session identity does not match this target.', 409, 'backup_session_mismatch');
  if (page.archiveId !== await sha256Hex(`${manifest.sessionId}:${manifest.exportedAt}:${page.snapshotDigest}`)) fail('Invalid backup archive identity.');
  const budget = createStorageExportBudget();
  const rawIndex = getStorageIndexBinding(env);
  const index = rawIndex ? budget.wrap(rawIndex) : null;
  if (!index?.get || !index?.put || !index?.delete) fail('Restore storage is unavailable.', 503);
  const stateKey = `session-backup-import:${page.archiveId}`;
  const activeKey = BACKUP_IMPORT_ACTIVE_KEY;
  const active = await readActiveBackupImport(coordinator, slug, true, budget);
  if (active && (active.archiveId !== page.archiveId || active.progress.abandoning)) fail('Another backup restore is in progress. Check restore status to abandon it.', 409, 'backup_restore_in_progress');
  const pageHash = await sha256Hex(JSON.stringify(page));
  const receiptKey = `${stateKey}:page:${page.pageNumber}`;
  const receipt = await storage.get(receiptKey);
  if (receipt) {
    if (receipt.hash !== pageHash) fail('This backup page differs from the previously imported page.', 409);
    return Response.json({ ...receipt.result, replayed: true });
  }
  const root = backupImportStagePrefix(slug, page.archiveId);
  const descriptorKey = (id, target = '') => `${stateKey}:payload:${target || 'storage'}:${id}`;
  const recordKey = (id) => `${stateKey}:record:${id}`;
  const chunkKey = (id, n, target = '') => `${root}chunk:${target || 'storage'}:${id}:${n}`;
  let progress = await storage.get(stateKey);
  if (!progress) {
    if (page.pageNumber !== 0 || !page.coordinator) fail('Import must begin with the first backup page.', 409);
    progress = { actor: expectedAuthority.actor, pageNumber: 0, nextEntry: 0, pageHash, manifest: { ...manifest, counts: undefined, complete: undefined },
      counts: { written: 0, skipped: 0, conflicts: 0 }, conflicts: [], observed: { records: 0, payloads: 0, owners: 0, hidden: 0, bytes: 0 },
      expiresAt: coordinator.now() + BACKUP_IMPORT_TTL_MS, configPublished: false, liveTarget: !!current,
      pendingPayloads: 0, pendingRecords: 0, snapshotReady: false, finished: false };
    if (page.coordinator.chunked !== true) {
      validateSnapshot({ snapshot: page.coordinator, manifest, ...validators });
      if (await sha256Hex(JSON.stringify(page.coordinator)) !== page.snapshotDigest) fail('The coordinator snapshot checksum does not match.');
      await index.put(`${root}coordinator`, JSON.stringify(page.coordinator), temporary);
      progress.snapshotReady = true;
    } else if (page.coordinator.sha256 !== page.snapshotDigest) fail('Invalid coordinator snapshot descriptor.');
    await storage.put(activeKey, page.archiveId);
    await storage.put(stateKey, progress);
  }
  if (progress.actor !== expectedAuthority.actor || progress.pageNumber !== page.pageNumber || progress.finished ||
      (progress.nextEntry > 0 && progress.pageHash !== pageHash) ||
      !same(progress.manifest, { ...manifest, counts: undefined, complete: undefined })) fail('Backup pages must be imported unchanged and in order.', 409);
  progress.pageHash = pageHash;
  const conflict = (key) => { progress.counts.conflicts += 1; if (progress.conflicts.length < 50) progress.conflicts.push(key); };
  const write = async (store, key, value, json = false) => {
    const existing = await store.get(key);
    if (existing != null) {
      let identical = existing === value;
      if (!identical && json) { try { identical = same(JSON.parse(existing), JSON.parse(value)); } catch { /* malformed existing rows conflict */ } }
      if (identical) progress.counts.skipped += 1;
      else conflict(key);
      return identical;
    }
    await store.put(key, value);
    progress.counts.written += 1;
    return true;
  };
  const assemble = async (header) => {
    const bytes = new Uint8Array(header.size);
    let offset = 0;
    for (let n = 0; n < header.chunkCount; n += 1) {
      const raw = await index.get(chunkKey(header.id, n, header.target));
      if (raw == null) fail('A restore chunk is missing. Retry the interrupted page.', 409);
      const chunk = base64urlToBytes(raw);
      if (offset + chunk.length > bytes.length) fail('Backup payload size mismatch.');
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (offset !== header.size || await digest(bytes) !== header.sha256) fail('Backup payload checksum mismatch.');
    return bytes;
  };
  const pending = async () => {
    await storage.put(stateKey, progress);
    return Response.json({ ok: true, archiveId: page.archiveId, pageNumber: page.pageNumber, pageComplete: false,
      counts: progress.counts, conflicts: progress.conflicts, complete: false,
      restore: { archiveId: page.archiveId, inProgress: true, canAbandon: !progress.configPublished } });
  };
  for (let i = progress.nextEntry; i < page.entries.length; i += 1) {
    const entry = page.entries[i];
    const headerForBudget = entry.kind === 'chunk' ? await storage.get(descriptorKey(entry.id, entry.target)) : null;
    const cost = headerForBudget && headerForBudget.nextChunk + 1 === headerForBudget.chunkCount ? headerForBudget.chunkCount + 16 : 4;
    if (budget.remaining < cost + 16) return pending();
    const updates = [];
    if (entry.kind === 'owner' || entry.kind === 'hidden') {
      // Absence on a live target can be a later unhide. Restores cannot infer
      // its time from a deleted marker, so preserve visibility and report it.
      if (entry.kind === 'hidden' && progress.liveTarget && await index.get(entry.key) == null) conflict(entry.key);
      else await write(index, entry.key, entry.value, true);
      progress.observed[entry.kind === 'owner' ? 'owners' : 'hidden'] += 1;
    } else if (entry.kind === 'record') {
      if (await storage.get(recordKey(entry.id))) fail('Duplicate backup metadata id.');
      const header = await storage.get(descriptorKey(entry.id));
      if (header?.done) {
        if (header.payloadOk !== false) await write(index, entry.key, JSON.stringify(entry.metadata), true);
        updates.push([recordKey(entry.id), { applied: true }]);
      } else {
        await index.put(`${root}record:${entry.id}`, JSON.stringify(entry), temporary);
        updates.push([recordKey(entry.id), { pending: true }]);
        progress.pendingRecords += 1;
      }
      progress.observed.records += 1;
    } else if (entry.kind === 'payload') {
      if (await storage.get(descriptorKey(entry.id, entry.target))) fail('Duplicate backup payload id.');
      if (entry.chunkCount > STORAGE_EXPORT_PAGE_LIMITS.operations - 64) fail('This payload exceeds the bounded restore assembly limit.', 413);
      if (entry.size > resolveMaxUploadBytes({ env })) fail('The backup payload exceeds this target’s configured upload limit.', 413);
      const { metadata } = entry;
      const header = { id: entry.id, size: entry.size, sha256: entry.sha256, chunkCount: entry.chunkCount, ...(entry.target ? { target: entry.target } : {}) };
      if (metadata) await index.put(`${root}metadata:${entry.id}`, JSON.stringify(metadata), temporary);
      updates.push([descriptorKey(entry.id, entry.target), { ...header, nextChunk: 0, done: false }]);
      progress.pendingPayloads += 1;
    } else {
      const header = await storage.get(descriptorKey(entry.id, entry.target));
      if (!header || header.done || header.nextChunk !== entry.index || entry.index >= header.chunkCount) fail('Backup chunks must follow their payload header in order.');
      if (bytesToBase64url(base64urlToBytes(entry.base64url)) !== entry.base64url) fail('Invalid backup chunk encoding.');
      await index.put(chunkKey(entry.id, entry.index, entry.target), entry.base64url, temporary);
      header.nextChunk += 1;
      if (header.nextChunk === header.chunkCount) {
        const bytes = await assemble(header);
        if (entry.target === 'coordinator') {
          const snapshot = JSON.parse(new TextDecoder().decode(bytes));
          validateSnapshot({ snapshot, manifest, ...validators });
          if (header.sha256 !== page.snapshotDigest) fail('The coordinator snapshot checksum does not match.');
          progress.snapshotReady = true;
          progress.chunkedSnapshot = true;
        } else {
          const staged = JSON.parse(await index.get(`${root}record:${entry.id}`) || 'null');
          const metadata = staged?.metadata || JSON.parse(await index.get(`${root}metadata:${entry.id}`) || 'null') || { id: entry.id };
          const existing = await readStoredCloudflarePayloadBytes({ env, index, slug, metadata, strict: true });
          let payloadOk = true;
          const rawExisting = await index.get(buildPayloadKey({ slug, id: entry.id }));
          if (existing || rawExisting != null) {
            payloadOk = !!existing && existing.length === bytes.length && await digest(existing) === header.sha256;
            if (payloadOk) progress.counts.skipped += 1;
            else conflict(buildPayloadKey({ slug, id: entry.id }));
          } else {
            const r2 = getStorageR2Binding(env);
            if (r2?.put) await r2.put(buildObjectKey({ slug, id: entry.id }), bytes, {
              httpMetadata: { contentType: metadata.contentType || 'application/octet-stream' },
              customMetadata: {
                id: entry.id,
                resource: metadata.resource,
                encrypted: metadata.encrypted ? 'true' : 'false',
                payloadAccessMode: metadata.payloadAccessMode || '',
                payloadAccessControl: JSON.stringify(metadata.payloadAccessControl || {}),
                groupIds: metadata.groupIds?.length ? JSON.stringify(metadata.groupIds) : '',
              },
            });
            else {
              const value = JSON.stringify({ metadata, payloadBase64url: bytesToBase64url(bytes) });
              const tooLarge = rejectKvValueOverLimit({ serializedValue: value });
              if (tooLarge) fail('This payload needs an R2 binding on the restore target.', 413);
              await index.put(buildPayloadKey({ slug, id: entry.id }), value);
            }
            progress.counts.written += 1;
          }
          if (staged && (await storage.get(recordKey(entry.id)))?.pending) {
            if (payloadOk) await write(index, staged.key, JSON.stringify(staged.metadata), true);
            progress.pendingRecords -= 1;
            updates.push([recordKey(entry.id), { applied: true }]);
          }
          progress.observed.payloads += 1;
          progress.observed.bytes += bytes.length;
          header.payloadOk = payloadOk;
        }
        progress.pendingPayloads -= 1;
        header.done = true;
      }
      updates.push([descriptorKey(entry.id, entry.target), header]);
    }
    progress.nextEntry = i + 1;
    await storage.transaction(async (transaction) => {
      for (const [key, value] of updates) await transaction.put(key, value);
      await transaction.put(stateKey, progress);
    });
  }
  // Cleanup has its own durable cursor: retrying a busy page cannot spend
  // its whole budget deleting chunks already removed by a prior request.
  const cleanupIds = [...new Set(page.entries.filter((entry) => entry.kind === 'chunk' && !entry.target).map((entry) => entry.id))];
  for (let i = progress.cleanupIndex || 0; i < cleanupIds.length; i += 1) {
    const id = cleanupIds[i];
    const header = await storage.get(descriptorKey(id));
    if (header?.done) {
      for (let n = progress.cleanupChunk || 0; n < header.chunkCount; n += 1) {
        if (budget.remaining < 16) return pending();
        await index.delete(chunkKey(id, n));
        progress.cleanupChunk = n + 1;
      }
    }
    progress.cleanupIndex = i + 1;
    progress.cleanupChunk = 0;
    await storage.put(stateKey, progress);
  }
  if (manifest.complete) {
    if (!progress.snapshotReady || progress.pendingPayloads || progress.pendingRecords || !same(progress.observed, manifest.counts)) fail('The backup is incomplete; its records or chunks are missing.', 409);
    const snapshotHeader = progress.chunkedSnapshot ? await storage.get(descriptorKey('coordinator', 'coordinator')) : null;
    if (budget.remaining < (snapshotHeader?.chunkCount || 1) + 32) return pending();
    const snapshot = progress.chunkedSnapshot
      ? JSON.parse(new TextDecoder().decode(await assemble(snapshotHeader)))
      : JSON.parse(await index.get(`${root}coordinator`) || 'null');
    validateSnapshot({ snapshot, manifest, ...validators });
    const authority = snapshot.configAuthority;
    // Revision numbers alone do not prove lineage. An existing target must
    // already have the same public authority; v1 never rolls it backwards.
    if (current && !same(current, authority)) conflict('session-config-authority');
    if (!progress.counts.conflicts) {
      if (!progress.groupsComplete) {
        if (budget.remaining < 32) return pending();
        const groups = await coordinateWorkerGroupBackup({ env, slug, sessionId: manifest.sessionId, operation: 'import',
          snapshot: snapshot.workerGroups, cursor: progress.groupCursor, operations: budget.remaining - 16 });
        if (!groups.ok) fail(groups.error || 'Group restore is unavailable.', groups.status || 503);
        budget.consume(groups.operations || 0);
        progress.counts.written += groups.counts.written;
        progress.counts.skipped += groups.counts.skipped;
        for (const key of groups.conflicts || []) conflict(key);
        progress.groupCursor = groups.nextCursor;
        progress.groupsComplete = !groups.nextCursor;
        await storage.put(stateKey, progress);
        if (groups.nextCursor) return pending();
      }
      if (snapshot.secrets) await write(env.GROUP_KV, `session:${normalizeWorkerSessionSlug(slug)}:secrets`, JSON.stringify(snapshot.secrets), true);
      const signer = snapshot.wrappedSessionKeys.litAuthorizationSigner;
      if (signer) {
        const existing = await storage.get('session-lit-authorization-signer-v1');
        if (existing && !same(existing, signer)) conflict('session-lit-authorization-signer-v1');
        else if (existing) progress.counts.skipped += 1;
        else { await storage.put('session-lit-authorization-signer-v1', signer); progress.counts.written += 1; }
      }
      if (!progress.counts.conflicts && !current) {
        progress.configPublished = true;
        await storage.transaction(async (transaction) => {
          await transaction.put('session-config-authority', { ...authority, projectionPending: true });
          await transaction.put(stateKey, progress);
        });
        await coordinator.projectSessionConfigAuthority(authority);
        progress.counts.written += 1;
      }
    }
    progress.finished = true;
  }
  const result = { ok: true, archiveId: page.archiveId, pageNumber: page.pageNumber, counts: progress.counts,
    conflicts: progress.conflicts, complete: progress.finished && !progress.counts.conflicts,
    restore: progress.finished ? null : { archiveId: page.archiveId, inProgress: true, canAbandon: !progress.configPublished } };
  progress.pageNumber += 1;
  progress.nextEntry = 0;
  progress.cleanupIndex = 0;
  progress.cleanupChunk = 0;
  await storage.transaction(async (transaction) => {
    await transaction.put(stateKey, progress);
    await transaction.put(receiptKey, { hash: pageHash, result });
  });
  if (progress.finished && progress.chunkedSnapshot) {
    const header = await storage.get(descriptorKey('coordinator', 'coordinator'));
    // Any remaining coordinator chunks expire with the archive staging TTL.
    for (let n = 0; n < header.chunkCount && budget.remaining > 8; n += 1) await index.delete(chunkKey('coordinator', n, 'coordinator'));
  }
  return Response.json(result);
};
