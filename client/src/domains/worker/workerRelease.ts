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
