import { sessionSlugStorageKey } from './sessionSlugResolution.js';
import { getStorageIndexBinding } from './storageRouteExecution.js';

export const BACKUP_IMPORT_TTL_MS = 7 * 86400 * 1000;
export const BACKUP_IMPORT_ACTIVE_KEY = 'session-backup-import-active';
export const backupImportStateKey = (archiveId) => `session-backup-import:${archiveId}`;
export const backupImportStagePrefix = (slug, archiveId) => `ce-import-stage:${sessionSlugStorageKey(slug)}:${archiveId}:`;
const fail = (message) => { throw Object.assign(new Error(message), { status: 409 }); };

// Abandonment removes temporary chunks and progress, never existing records.
// A large staging area is cleaned in bounded requests; the lock stays held
// until cleanup finishes, so no second archive can reuse its state.
const cleanup = async (coordinator, slug, archiveId, progress) => {
  const { storage } = coordinator.state;
  const key = backupImportStateKey(archiveId);
  progress.abandoning = true;
  await storage.put(key, progress);
  const index = getStorageIndexBinding(coordinator.env);
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

export const readActiveBackupImport = async (coordinator, slug, cleanExpired = true) => {
  const { storage } = coordinator.state;
  const archiveId = await storage.get(BACKUP_IMPORT_ACTIVE_KEY);
  if (!archiveId) return null;
  const progress = await storage.get(backupImportStateKey(archiveId));
  if (!progress || progress.finished) return null;
  const expired = !Number.isFinite(progress.expiresAt) || progress.expiresAt <= coordinator.now();
  if (cleanExpired && (expired || progress.abandoning) && !progress.configPublished) {
    if (await cleanup(coordinator, slug, archiveId, progress)) return null;
  }
  return { archiveId, progress };
};

export const controlCoordinatorBackupImport = async (coordinator, payload, abandon = false) => {
  await coordinator.assertSessionAuthority(payload);
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
    cleaning: active.progress.abandoning === true, expiresAt: active.progress.expiresAt,
  } : null });
};
