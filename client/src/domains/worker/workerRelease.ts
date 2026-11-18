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

/** Whether the Session Worker takes feedback about the app (0.9.8 on); false when it can't be read. */
export const readWorkerTakesFeedback = async (
  workerOrigin: string,
  sessionSlug: string,
  fetchImpl?: typeof fetch,
): Promise<boolean> => {
  if (!workerOrigin) return false;
  const found = await readWorkerCapabilities(workerOrigin, sessionSlug, fetchImpl ? { fetchImpl } : {});
  return found.features.includes('session_feedback');
};

/** Whether the Session Worker keeps context cards; false when it can't be read. An older one would refuse the setting. */
export const readWorkerKeepsContextCards = async (
  workerOrigin: string,
  sessionSlug: string,
  fetchImpl?: typeof fetch,
): Promise<boolean> => {
  if (!workerOrigin) return false;
  const found = await readWorkerCapabilities(workerOrigin, sessionSlug, fetchImpl ? { fetchImpl } : {});
  return found.features.includes('context_cards_v1');
};

/** Whether the Session Worker accepts a note on where research data goes (0.9.11 on); false when it can't be read. */
export const readWorkerTakesDataNote = async (
  workerOrigin: string,
  sessionSlug: string,
  fetchImpl?: typeof fetch,
): Promise<boolean> => {
  if (!workerOrigin) return false;
  const found = await readWorkerCapabilities(workerOrigin, sessionSlug, fetchImpl ? { fetchImpl } : {});
  return found.features.includes('interview_data_note_v1');
};

/** Which Session Agent options the Session Worker accepts (0.9.11 on); neither when it can't be read. */
export const readWorkerSessionAgentOptions = async (
  workerOrigin: string,
  sessionSlug: string,
  fetchImpl?: typeof fetch,
): Promise<{ recordChats: boolean; anyoneCanAsk: boolean }> => {
  if (!workerOrigin) return { recordChats: false, anyoneCanAsk: false };
  const { features } = await readWorkerCapabilities(workerOrigin, sessionSlug, fetchImpl ? { fetchImpl } : {});
  return {
    recordChats: features.includes('session_agent_chats'),
    anyoneCanAsk: features.includes('session_agent_signed_out'),
  };
};

export const WORKERS_AI_FEATURE = 'workers_ai_v1';

/** Whether the Session Worker can answer the Session Agent on Cloudflare's models: it has the AI binding. */
export const readWorkerRunsWorkersAi = async (
  workerOrigin: string,
  sessionSlug: string,
  fetchImpl?: typeof fetch,
): Promise<boolean> => {
  if (!workerOrigin) return false;
  const found = await readWorkerCapabilities(workerOrigin, sessionSlug, fetchImpl ? { fetchImpl } : {});
  return found.features.includes(WORKERS_AI_FEATURE);
};

export const AI_DAILY_LIMIT_FEATURE = 'ai_daily_limit_v1';

/** Whether the Session Worker counts a separate AI daily limit (0.9.9 on); false when it can't be read. */
export const readWorkerCountsAiLimit = async (
  workerOrigin: string,
  sessionSlug: string,
  fetchImpl?: typeof fetch,
): Promise<boolean> => {
  if (!workerOrigin) return false;
  const found = await readWorkerCapabilities(workerOrigin, sessionSlug, fetchImpl ? { fetchImpl } : {});
  return found.features.includes(AI_DAILY_LIMIT_FEATURE);
};
