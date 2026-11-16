import { SESSION_CONFIG_COORDINATION_ERROR, callSessionConfigCoordinator } from './sessionConfigAuthority.js';

export const STORAGE_BACKUP_REVISION_KEY = 'storage-backup-revision';
export const WORKER_GROUP_BACKUP_PENDING_PREFIX = 'worker-group-backup-pending:';
export const bumpStorageBackupRevision = (storage) => storage.transaction(async (transaction) => {
  const revision = (await transaction.get(STORAGE_BACKUP_REVISION_KEY) || 0) + 1;
  await transaction.put(STORAGE_BACKUP_REVISION_KEY, revision);
  return revision;
});

// A backup export holds this lease while it runs; each page renews it.
export const BACKUP_EXPORT_LEASE_KEY = 'backup-export-lease';
export const BACKUP_EXPORT_LEASE_MS = 10 * 60_000;
// A write may trust a settings view started at most this long ago; an export
// waits longer than that after taking its lease before it reads its revision.
export const BACKUP_VIEW_MAX_AGE_MS = 2_000;
export const BACKUP_EXPORT_SETTLE_MS = 5_000;

/** Takes or renews the export lease; `since` stays while it has not lapsed. */
export const takeBackupExportLease = async (storage, now = Date.now()) => {
  const held = await storage.get(BACKUP_EXPORT_LEASE_KEY);
  const since = Number(held?.until) > now ? held.since : now;
  await storage.put(BACKUP_EXPORT_LEASE_KEY, { since, until: now + BACKUP_EXPORT_LEASE_MS });
  return since;
};
export const backupExportActive = async (storage, now = Date.now()) =>
  Number((await storage.get(BACKUP_EXPORT_LEASE_KEY))?.until) > now;

// Mark both sides of a write: an export spanning any completed mutation must
// restart. Only a mark landing after an export read its start revision can
// change anything, so a write skips a mark when a settings view started at
// most 2 s ago saw no export: the export took its lease after that view and
// waits 5 s before reading. The saving needs a cached view: a write that finds
// it expired reads it again for each mark, and during an export it pays both.
// Operators must still pause writes; KV/R2 have no shared snapshot.
export const markStorageBackupWrite = async (env, slug) => {
  if (!env?.CE_SESSION_COORDINATOR) return;
  const view = await callSessionConfigCoordinator({ env, slug, path: 'current', cache: true });
  if (view.ok && view.body?.backupExportActive === false && Date.now() - view.readStartedAt <= BACKUP_VIEW_MAX_AGE_MS) return;
  const result = await callSessionConfigCoordinator({ env, slug, path: 'backup/write-revision' });
  if (result.ok) return;
  // A busy coordinator gets the busy answer every client retries; an upload
  // marks before it reserves anything, so the retry goes straight through.
  if (result.status === 503 && result.body?.error === SESSION_CONFIG_COORDINATION_ERROR) {
    throw Object.assign(new Error(SESSION_CONFIG_COORDINATION_ERROR), { status: 503 });
  }
  throw new Error('Storage write tracking is unavailable; retry.');
};
