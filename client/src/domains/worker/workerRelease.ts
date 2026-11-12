import { readWorkerCapabilities } from '../../utilities/worker/workerCapabilities';

// Workers report their release from 0.9.3 on; an earlier one answers without it.
export const WORKER_RELEASE_UNREPORTED = 'before 0.9.3';

/** The release a Session Worker runs, as Settings shows it; empty when the Worker can't be read. */
export const readWorkerReleaseLabel = async (
  workerOrigin: string,
  sessionSlug: string,
  fetchImpl?: typeof fetch,
): Promise<string> => {
  if (!workerOrigin) return '';
  const found = await readWorkerCapabilities(workerOrigin, sessionSlug, fetchImpl ? { fetchImpl } : {});
  return found.unavailable ? '' : found.release || WORKER_RELEASE_UNREPORTED;
};

/** Whether the Session Worker keeps AI draft text for admins (0.9.6 on); null when it can't be read. */
export const readWorkerKeepsDraftText = async (
  workerOrigin: string,
  sessionSlug: string,
  fetchImpl?: typeof fetch,
): Promise<boolean | null> => {
  if (!workerOrigin) return null;
  const found = await readWorkerCapabilities(workerOrigin, sessionSlug, fetchImpl ? { fetchImpl } : {});
  return found.unavailable ? null : found.features.includes('draft_text_v1');
};
