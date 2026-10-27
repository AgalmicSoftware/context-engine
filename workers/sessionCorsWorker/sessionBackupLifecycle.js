import { sessionSlugStorageKey } from './sessionSlugResolution.js';
import { getStorageIndexBinding, getStorageR2Binding } from './storageRouteExecution.js';
import { coordinateWorkerGroupBackup } from './workerGroups.js';

export const BACKUP_IMPORT_TTL_MS = 7 * 86400 * 1000;
export const BACKUP_IMPORT_ACTIVE_KEY = 'session-backup-import-active';
export const backupImportStateKey = (archiveId) => `session-backup-import:${archiveId}`;
export const backupImportStagePrefix = (slug, archiveId) => `ce-import-stage:${sessionSlugStorageKey(slug)}:${archiveId}:`;
const fail = (message) => { throw Object.assign(new Error(message), { status: 409 }); };

export const backupImportJournalKey = (archiveId, kind, key) => `${backupImportStateKey(archiveId)}:journal:${kind}:${encodeURIComponent(key)}`;
export const journalBackupImportWrite = (storage, archiveId, kind, key) =>
  storage.put(backupImportJournalKey(archiveId, kind, key), { kind, key });

export const cleanupBackupImportJournal = async (storage, archiveId, stores) => {
  const rows = await storage.list({ prefix: `${backupImportStateKey(archiveId)}:journal:`, limit: 100 });
  for (const [name, { kind, key }] of rows) {
    if (!stores[kind]?.delete) throw new Error('Restore cleanup storage is unavailable.');
    // Delete the journal entry last: a lost reply can only repeat a deletion.
    await stores[kind].delete(key);
    await storage.delete(name);
  }
  return { complete: rows.size < 100, operations: rows.size * 2 + 1 };
};

// Completion keeps restored rows; only abandonment follows journal targets.
// Delete small batches without a cursor so a lost reply safely repeats cleanup.
export const clearBackupImportMetadata = async (storage, archiveId) => {
  const rows = await storage.list({ prefix: `${backupImportStateKey(archiveId)}:`, limit: 200 });
  for (const [key] of rows) await storage.delete(key);
  return rows.size < 200;
};

export const cleanupCompletedBackupImport = async (coordinator, slug, archiveId, progress, budget) => {
  const { storage } = coordinator.state;
  if (budget && budget.remaining < 32) return false;
  const groups = await coordinateWorkerGroupBackup({ env: coordinator.env, slug, sessionId: progress.manifest.sessionId,
    operation: 'finish', archiveId });
  if (!groups.ok) throw Object.assign(new Error(groups.error || 'Group restore completion is unavailable.'), { status: groups.status || 503 });
  if (!groups.complete) return false;
  const rawIndex = getStorageIndexBinding(coordinator.env);
  const index = budget ? budget.wrap(rawIndex) : rawIndex;
  const limit = Math.min(100, budget ? budget.remaining - 8 : 100);
  const staged = await index.list({ prefix: backupImportStagePrefix(slug, archiveId), limit });
  if (!Array.isArray(staged.keys)) throw new Error('Restore cleanup storage could not be read.');
  for (const { name } of staged.keys) await index.delete(name);
  if (staged.list_complete === false || !await clearBackupImportMetadata(storage, archiveId)) return false;
  await storage.transaction(async (transaction) => {
    await transaction.put('session-backup-import-completion', { archiveId, completedAt: coordinator.now(), counts: progress.counts });
    await transaction.delete(backupImportStateKey(archiveId));
    await transaction.delete(BACKUP_IMPORT_ACTIVE_KEY);
  });
  return true;
};

export const assertNoActiveBackupImport = async (coordinator) => {
  const { storage } = coordinator.state;
  const archiveId = await storage.get(BACKUP_IMPORT_ACTIVE_KEY);
  const progress = archiveId && await storage.get(backupImportStateKey(archiveId));
  if (progress && !progress.finished) throw Object.assign(new Error('A backup restore is in progress. Resume or abandon it first.'),
    { status: 409, reason: 'backup_restore_in_progress' });
};

// The target was empty before this archive. Its write-ahead journals include
// rows whose write completed just before an interruption or expired staging.
// Keep the lock until every imported row and temporary chunk has been removed.
const cleanup = async (coordinator, slug, archiveId, progress, budget) => {
  const { storage } = coordinator.state;
  const key = backupImportStateKey(archiveId);
  progress.abandoning = true;
  await storage.put(key, progress);
  const rawIndex = getStorageIndexBinding(coordinator.env);
  const index = budget ? budget.wrap(rawIndex) : rawIndex;
  const groups = await coordinateWorkerGroupBackup({ env: coordinator.env, slug, sessionId: progress.manifest.sessionId,
    operation: 'abandon', archiveId });
  if (!groups.ok) throw Object.assign(new Error(groups.error || 'Group restore cleanup is unavailable.'), { status: groups.status || 503 });
  budget?.consume(groups.operations || 0);
  if (!groups.complete) return false;
  const groupKv = budget ? budget.wrap(coordinator.env.GROUP_KV) : coordinator.env.GROUP_KV;
  const journal = await cleanupBackupImportJournal(storage, archiveId, {
    index, group: groupKv, durable: storage, r2: getStorageR2Binding(coordinator.env),
  });
  if (!journal.complete) return false;
  const staged = await index.list({ prefix: backupImportStagePrefix(slug, archiveId), limit: 200 });
  for (const { name } of staged.keys || []) await index.delete(name);
  if (staged.list_complete === false) return false;
  const descriptors = await storage.list({ prefix: `${key}:`, limit: 200 });
  for (const [name] of descriptors) await storage.delete(name);
  if (descriptors.size === 200) return false;
  await storage.delete(key);
  await storage.delete(BACKUP_IMPORT_ACTIVE_KEY);
  return true;
};

export const readActiveBackupImport = async (coordinator, slug, cleanExpired = true, budget) => {
  const { storage } = coordinator.state;
  const archiveId = await storage.get(BACKUP_IMPORT_ACTIVE_KEY);
  if (!archiveId) return null;
  const progress = await storage.get(backupImportStateKey(archiveId));
  if (!progress) return null;
  if (progress.finished) {
    // Older versions retained completed receipts indefinitely. Reclaim them,
    // but never let them bypass the next import's empty-target check.
    if (await cleanupCompletedBackupImport(coordinator, slug, archiveId, progress, budget)) return null;
    return { archiveId, progress };
  }
  const expired = !Number.isFinite(progress.expiresAt) || progress.expiresAt <= coordinator.now();
  if (cleanExpired && (expired || progress.abandoning) && !progress.configPublished) {
    if (await cleanup(coordinator, slug, archiveId, progress, budget)) return null;
  }
  return { archiveId, progress };
};

export const controlCoordinatorBackupImport = async (coordinator, payload, abandon = false) => {
  await coordinator.assertSessionAuthority(payload, { allowRestore: true });
  const active = await readActiveBackupImport(coordinator, payload.slug, !abandon);
  if (abandon) {
    if (!active || active.archiveId !== payload.archiveId || active.progress.configPublished) {
      fail('Only an unfinished restore whose config has not been published can be abandoned.');
    }
    const complete = await cleanup(coordinator, payload.slug, active.archiveId, active.progress);
    return Response.json({ ok: true, complete });
  }
  return Response.json({ ok: true, restore: active ? {
    archiveId: active.archiveId, inProgress: true, canAbandon: !active.progress.configPublished,
    cleaning: active.progress.abandoning === true || active.progress.finishing === true || active.progress.finished === true, expiresAt: active.progress.expiresAt,
  } : null });
};
