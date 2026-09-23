import { isWorkerCanonicalSessionConfig, loadWorkerResponses } from '../../utilities/survey/workerResponseHydration';
import { isWorkerResponseNewer } from '../../utilities/survey/workerResponseRecency';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort';

type RecordValue = Record<string, unknown>;
const fields = ['answers', 'additionalComments', 'importance', 'conviction'] as const;
export type InterviewSavedSlice = Record<(typeof fields)[number], RecordValue>;
type InputSlice = { [K in keyof InterviewSavedSlice]?: RecordValue | null };

export const loadSessionInterviewSavedAnswers = async ({
  questionIds,
  account,
  provider,
  sessionSlug,
  sessionConfig,
  signal,
}: {
  questionIds: string[];
  account: string;
  provider?: unknown;
  sessionSlug: string;
  sessionConfig: RecordValue;
  signal: AbortSignal;
}): Promise<RecordValue[]> => {
  if (!account) throw new Error('Sign in to load your saved answers.');
  const ids = [...new Set(questionIds.map((id) => id.toLowerCase()))];
  signal.throwIfAborted();
  if (isWorkerCanonicalSessionConfig(sessionConfig)) {
    const rows = await loadWorkerResponses({
      account,
      providerLike: provider,
      sessionSlug,
      sessionConfig,
      ownResponses: true,
      signal,
    });
    signal.throwIfAborted();
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const previous = latest.get(row.questionId);
      if (
        ids.includes(row.questionId) &&
        (!previous || isWorkerResponseNewer(row.timestamp, row.storageRefId, previous))
      ) {
        latest.set(row.questionId, row);
      }
    }
    return [...latest.values()].map((row) => ({ ...row.response, questionID: row.questionId }));
  }
  const responses: RecordValue[] = [];
  // Existing strict per-account contract reads also cover chain-authoritative
  // sessions whose payloads live in Cloudflare rather than Arweave.
  for (let offset = 0; offset < ids.length; offset += 8) {
    signal.throwIfAborted();
    const batch = await Promise.all(
      ids.slice(offset, offset + 8).map(async (questionId) => {
        const hash = await surveyQuestionReadsPort.getResponseHash(provider, account, questionId, sessionConfig, {
          throwOnError: true,
        });
        signal.throwIfAborted();
        if (!hash) return null;
        const response = await surveyQuestionReadsPort.getResponse(provider, account, questionId, sessionConfig, {
          throwOnError: true,
          forceArweaveFetch: true,
        });
        if (!response) throw new Error('A saved answer could not be read.');
        return { ...response, questionID: questionId };
      }),
    );
    for (const response of batch) if (response) responses.push(response);
  }
  signal.throwIfAborted();
  return responses;
};

export const mergeInterviewSavedAnswerBaseline = (
  current: InputSlice | null,
  baseline: InputSlice | null,
  saved: InputSlice | null,
  questionIds: string[],
  valuesEqual: (a: unknown, b: unknown) => boolean,
): { slice: InterviewSavedSlice; baseline: InterviewSavedSlice } => {
  const next = {} as InterviewSavedSlice;
  const nextBaseline = {} as InterviewSavedSlice;
  for (const field of fields) {
    next[field] = { ...current?.[field] };
    nextBaseline[field] = { ...baseline?.[field] };
    for (const id of questionIds) {
      // Loading a baseline must not discard a local edit made while it was in flight.
      if (!Object.hasOwn(next[field], id) || valuesEqual(current?.[field]?.[id], baseline?.[field]?.[id])) {
        if (Object.hasOwn(saved?.[field] || {}, id)) next[field][id] = saved?.[field]?.[id];
        else delete next[field][id];
      }
      if (Object.hasOwn(saved?.[field] || {}, id)) nextBaseline[field][id] = saved?.[field]?.[id];
      else delete nextBaseline[field][id];
    }
  }
  return { slice: next, baseline: nextBaseline };
};
