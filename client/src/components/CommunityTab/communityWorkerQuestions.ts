/** @file communityWorkerQuestions.ts: a Worker-hosted session's questions and answers for the Stats Questions dialog. */
import {
  loadWorkerCanonicalQuestions,
  mergeWorkerCanonicalQuestionMetadata,
} from '../../domains/surveys/workerCanonicalMetadataHydrationPort';
import { peekCacheSync } from '../../utilities/cache/cacheScripts';
import {
  WORKER_CANONICAL_CACHE_SCOPE_KEY,
  resolveWorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import { loadWorkerResponses, mergeWorkerQuestionResponses } from '../../utilities/survey/workerResponseHydration';
import { listsEveryAnswer } from './communityWorkerListingCounts';

export type CommunityWorkerQuestions = {
  /** The session's question cache node, as the Stats page reads a cached one: `questions` and `questionResponses`. */
  questionsCache: Record<string, unknown>;
  /** False where the session does not show its answers to everyone, or refused to list them. */
  answersPublic: boolean;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * Reads a session as anyone would, asking for no sign-in: its questions, and its answers where the session shows
 * them to everyone. What this browser already holds is read again only where it is not the session's latest; nothing
 * is written to the cache, which belongs to the session's own page.
 */
export const loadCommunityWorkerQuestions = async ({
  sessionSlug,
  sessionConfig,
  signal,
}: {
  sessionSlug: string;
  sessionConfig: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<CommunityWorkerQuestions> => {
  const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug, reader: '' });
  const listing = await loadWorkerCanonicalQuestions({ sessionSlug, sessionConfig, account: '' });
  let record = mergeWorkerCanonicalQuestionMetadata(
    peekCacheSync('questionsCache', sessionSlug, { clone: false }),
    listing,
    identity,
  );
  let answersPublic = listsEveryAnswer(sessionConfig);
  if (answersPublic && !signal?.aborted) {
    try {
      const rows = await loadWorkerResponses({ account: '', sessionSlug, sessionConfig, signal });
      record = mergeWorkerQuestionResponses(record, rows, sessionSlug, identity);
    } catch (error) {
      if (signal?.aborted) throw error;
      // A session that lets only its members read its answers refuses a reader who is not signed in.
      answersPublic = false;
    }
  }
  return { questionsCache: asRecord(record[WORKER_CANONICAL_CACHE_SCOPE_KEY]), answersPublic };
};
