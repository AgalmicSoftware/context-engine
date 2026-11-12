import { SESSION_CONFIG_COORDINATION_ERROR, callSessionConfigCoordinator } from './sessionConfigAuthority.js';

export const STORAGE_BACKUP_REVISION_KEY = 'storage-backup-revision';
export const WORKER_GROUP_BACKUP_PENDING_PREFIX = 'worker-group-backup-pending:';
export const bumpStorageBackupRevision = (storage) => storage.transaction(async (transaction) => {
  const revision = (await transaction.get(STORAGE_BACKUP_REVISION_KEY) || 0) + 1;
  await transaction.put(STORAGE_BACKUP_REVISION_KEY, revision);
  return revision;
});

// Mark both sides of a write: an export spanning any completed mutation must
// restart. Operators must still pause writes; KV/R2 have no shared snapshot.
export const markStorageBackupWrite = async (env, slug) => {
  if (!env?.CE_SESSION_COORDINATOR) return;
  const result = await callSessionConfigCoordinator({ env, slug, path: 'backup/write-revision' });
  if (result.ok) return;
  // A busy coordinator gets the busy answer every client retries; an upload
  // marks before it reserves anything, so the retry goes straight through.
  if (result.status === 503 && result.body?.error === SESSION_CONFIG_COORDINATION_ERROR) {
    throw Object.assign(new Error(SESSION_CONFIG_COORDINATION_ERROR), { status: 503 });
  }
  throw new Error('Storage write tracking is unavailable; retry.');
};
