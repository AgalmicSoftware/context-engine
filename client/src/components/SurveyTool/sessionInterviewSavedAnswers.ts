import { LegacyOwnResponseListingError } from '../../utilities/storage/storageClient';
import { isWorkerCanonicalSessionConfig, loadWorkerResponses } from '../../utilities/survey/workerResponseHydration';
import { isWorkerResponseNewer } from '../../utilities/survey/workerResponseRecency';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort';
import {
  buildChangedFieldResolvers,
  buildIndexedQuestionEntryKeys,
  computeChangedQidsAndFields,
  type ChangedFieldResolverDeps,
  type ResponseSlice as DiffSlice,
} from './surveyToolChangedFieldsController';
import { hasMeaningfulFieldValue } from './surveyToolDraftState';

type RecordValue = Record<string, unknown>;
const fields = ['answers', 'additionalComments', 'importance', 'conviction'] as const;
export type InterviewSavedSlice = Record<(typeof fields)[number], RecordValue> & { interviewProvenance?: RecordValue };
type InputSlice = { [K in keyof InterviewSavedSlice]?: RecordValue | null } & {
  interviewProvenance?: RecordValue | null;
};

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
}): Promise<RecordValue[] | null> => {
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
    }).catch((error: unknown) => {
      if (error instanceof LegacyOwnResponseListingError) return null;
      throw error;
    });
    signal.throwIfAborted();
    if (rows === null) return null;
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
    return [...latest.values()].map((row) => ({
      ...row.response,
      questionID: row.questionId,
      _responseTimestamp: row.timestamp,
      _responseStorageRefId: row.storageRefId,
      _consentOwnRead: true,
    }));
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
        return { ...response, questionID: questionId, _consentOwnRead: true };
      }),
    );
    for (const response of batch) if (response) responses.push(response);
  }
  signal.throwIfAborted();
  return responses;
};

export type InterviewSavedAnswerDiffDeps = ChangedFieldResolverDeps & {
  normalizeQuestionIdKey: (questionId: string) => string;
  valuesEqual: (a: unknown, b: unknown) => boolean;
  ratingEnvelopeQids?: Set<string>;
};

// The pile's pending-edit flags that make each saved field a local edit.
const LOCAL_EDIT_FLAGS: Record<(typeof fields)[number], string[]> = {
  answers: ['answer', 'encryptedAnswer'],
  additionalComments: ['additional', 'encryptedAdditional'],
  importance: ['importance'],
  conviction: ['conviction'],
};

const toDiffSlice = (slice: InputSlice | null): DiffSlice => ({
  answers: { ...slice?.answers } as DiffSlice['answers'],
  additionalComments: { ...slice?.additionalComments } as DiffSlice['additionalComments'],
  importance: { ...slice?.importance },
  conviction: { ...slice?.conviction },
});

// Local edits are what the pile would submit: value and encryption-policy
// changes count, while re-derived hashes and ciphertext do not.
const findLocalEdits = (
  current: InputSlice | null,
  baseline: InputSlice | null,
  questionIds: string[],
  diff: InterviewSavedAnswerDiffDeps,
) => {
  const currentSlice = toDiffSlice(current);
  const baselineSlice = toDiffSlice(baseline);
  const keysOf = (source: RecordValue) => buildIndexedQuestionEntryKeys(source, diff.normalizeQuestionIdKey);
  const { changedMap } = computeChangedQidsAndFields({
    ids: new Set(questionIds.map(diff.normalizeQuestionIdKey)),
    baselineSlice,
    currentSlice,
    baselineAnswerKeys: keysOf(baselineSlice.answers),
    currentAnswerKeys: keysOf(currentSlice.answers),
    baselineAdditionalKeys: keysOf(baselineSlice.additionalComments),
    currentAdditionalKeys: keysOf(currentSlice.additionalComments),
    baselineImportanceKeys: keysOf(baselineSlice.importance),
    currentImportanceKeys: keysOf(currentSlice.importance),
    baselineConvictionKeys: keysOf(baselineSlice.conviction),
    currentConvictionKeys: keysOf(currentSlice.conviction),
    ratingEnvelopeQids: diff.ratingEnvelopeQids || new Set(),
    valuesEqual: diff.valuesEqual,
    hasMeaningfulFieldValue: hasMeaningfulFieldValue as (entry: unknown) => boolean,
    ...buildChangedFieldResolvers(diff),
  });
  return (field: (typeof fields)[number], id: string) =>
    LOCAL_EDIT_FLAGS[field].some((flag) => changedMap[diff.normalizeQuestionIdKey(id)]?.[flag]);
};

export const mergeInterviewSavedAnswerBaseline = (
  current: InputSlice | null,
  baseline: InputSlice | null,
  saved: InputSlice | null,
  questionIds: string[],
  diff: InterviewSavedAnswerDiffDeps,
): { slice: InterviewSavedSlice; baseline: InterviewSavedSlice } => {
  const isLocalEdit = findLocalEdits(current, baseline, questionIds, diff);
  const next = {} as InterviewSavedSlice;
  const nextBaseline = {} as InterviewSavedSlice;
  for (const field of fields) {
    next[field] = { ...current?.[field] };
    nextBaseline[field] = { ...baseline?.[field] };
    for (const id of questionIds) {
      // Loading a baseline must not discard a local edit made while it was in flight.
      if (!Object.hasOwn(next[field], id) || !isLocalEdit(field, id)) {
        if (Object.hasOwn(saved?.[field] || {}, id)) {
          const currentField = next[field][id] as RecordValue | undefined;
          const savedField = saved?.[field]?.[id] as RecordValue | undefined;
          // A saved empty public field is not a reason to revoke a lock chosen
          // before typing. The saved baseline below still reflects storage.
          const keepBlankLock =
            (field === 'answers' || field === 'additionalComments') &&
            currentField?.value === '' &&
            currentField.encrypted === true &&
            // Match Answer stores the comment's chosen lock as an inherited policy.
            (currentField.audienceMode === 'explicit' ||
              (field === 'additionalComments' && currentField.audienceMode === 'inherit')) &&
            !currentField.encryptedPortion &&
            savedField?.value === '' &&
            !savedField.encrypted &&
            !savedField.encryptedPortion;
          if (!keepBlankLock) next[field][id] = saved?.[field]?.[id];
        }
        // Blank text fields can carry a lock chosen before typing. Removing
        // stale values must not erase that policy on an unsubmitted question.
        else if (
          (field !== 'answers' && field !== 'additionalComments') ||
          hasMeaningfulFieldValue(next[field][id] as RecordValue)
        )
          delete next[field][id];
      }
      if (Object.hasOwn(saved?.[field] || {}, id)) nextBaseline[field][id] = saved?.[field]?.[id];
      else delete nextBaseline[field][id];
    }
  }
  return {
    slice: {
      ...next,
      ...(current?.interviewProvenance ? { interviewProvenance: { ...current.interviewProvenance } } : {}),
    },
    baseline: {
      ...nextBaseline,
      interviewProvenance: { ...baseline?.interviewProvenance, ...saved?.interviewProvenance },
    },
  };
};
