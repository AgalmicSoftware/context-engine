import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';

export const STORAGE_BACKUP_REVISION_KEY = 'storage-backup-revision';
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
  if (!result.ok) throw new Error('Storage write tracking is unavailable; retry.');
};
