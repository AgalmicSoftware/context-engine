import { isPileCacheConsistentWithBaseline } from './surveyPileCacheSync';

type PileQuestionLike =
  | {
      id?: unknown;
    }
  | null
  | undefined;

type ReadQuestionsCache = (scopeSlug: string) => unknown;
type MergeQuestionResponses = (
  target: Record<string, Record<string, unknown>>,
  source: Record<string, Record<string, unknown>>,
) => Record<string, Record<string, unknown>>;
type PileQuestionsCacheByNetwork = Record<
  string,
  {
    questionResponses?: Record<string, Record<string, unknown>>;
  } & Record<string, unknown>
>;

export type PileBaselineCheckPlan = {
  shouldSkip: boolean;
  reason: 'not-submitted' | 'missing-baseline' | 'missing-network' | 'check';
  renderedIds: string[];
};

export const buildPileBaselineCheckPlan = ({
  submissionComplete = false,
  editBaseline = null,
  networkIdStr = '',
  pileQuestions = [],
}: {
  submissionComplete?: boolean;
  editBaseline?: unknown;
  networkIdStr?: string | null;
  pileQuestions?: PileQuestionLike[] | null;
} = {}): PileBaselineCheckPlan => {
  if (!submissionComplete) {
    return { shouldSkip: true, reason: 'not-submitted', renderedIds: [] };
  }
  if (!editBaseline) {
    return { shouldSkip: true, reason: 'missing-baseline', renderedIds: [] };
  }
  if (!String(networkIdStr || '')) {
    return { shouldSkip: true, reason: 'missing-network', renderedIds: [] };
  }

  return {
    shouldSkip: false,
    reason: 'check',
    renderedIds: (Array.isArray(pileQuestions) ? pileQuestions : [])
      .map((question) => String(question?.id || ''))
      .filter(Boolean),
  };
};

export type PilePrefillReadPlan = {
  shouldSkip: boolean;
  shouldBumpNoop: boolean;
  reason: 'anon' | 'dirty' | 'missing-network' | 'empty-pile' | 'prefill';
};

export const buildPilePrefillReadPlan = ({
  account = '',
  isDirty = false,
  modifiedCount = 0,
  networkIdStr = '',
  pileQuestions = [],
}: {
  account?: string | null;
  isDirty?: boolean;
  modifiedCount?: number | null;
  networkIdStr?: string | null;
  pileQuestions?: PileQuestionLike[] | null;
} = {}): PilePrefillReadPlan => {
  if (!String(account || '').trim()) {
    return { shouldSkip: true, shouldBumpNoop: false, reason: 'anon' };
  }
  if (isDirty || Number(modifiedCount || 0) > 0) {
    return { shouldSkip: true, shouldBumpNoop: true, reason: 'dirty' };
  }
  if (!String(networkIdStr || '')) {
    return { shouldSkip: true, shouldBumpNoop: false, reason: 'missing-network' };
  }
  if (!Array.isArray(pileQuestions) || pileQuestions.length === 0) {
    return { shouldSkip: true, shouldBumpNoop: false, reason: 'empty-pile' };
  }

  return { shouldSkip: false, shouldBumpNoop: false, reason: 'prefill' };
};

export const readPileScopedQuestionResponses = ({
  scopeSlugs = [],
  networkIdStr = '',
  readQuestionsCache = (() => ({})) as ReadQuestionsCache,
  mergeQuestionResponses = ((target) => target) as MergeQuestionResponses,
}: {
  scopeSlugs?: string[] | null;
  networkIdStr?: string | null;
  readQuestionsCache?: ReadQuestionsCache;
  mergeQuestionResponses?: MergeQuestionResponses;
} = {}): Record<string, Record<string, unknown>> => {
  const normalizedNetworkId = String(networkIdStr || '');
  if (!normalizedNetworkId || !Array.isArray(scopeSlugs)) return {};

  const mergedResponses: Record<string, Record<string, unknown>> = {};
  scopeSlugs.forEach((scopeSlug) => {
    const rawCache = readQuestionsCache(String(scopeSlug || ''));
    const parsed = rawCache && typeof rawCache === 'object' ? (rawCache as PileQuestionsCacheByNetwork) : null;
    const net = parsed?.[normalizedNetworkId];
    mergeQuestionResponses(mergedResponses, net?.questionResponses || {});
  });
  return mergedResponses;
};

export type PileBaselineConsistencyPlan = {
  action: 'sync-cache-caught-up' | 'maintain-optimistic';
  isConsistent: boolean;
};

export const buildPileBaselineConsistencyPlan = ({
  baseline = null,
  renderedIds = [],
  questionResponses = {},
  account = '',
  valuesEqual = (left: unknown, right: unknown) => left === right,
  checkConsistency = isPileCacheConsistentWithBaseline,
}: {
  baseline?: unknown;
  renderedIds?: string[] | null;
  questionResponses?: Record<string, Record<string, unknown>> | null;
  account?: string | null;
  valuesEqual?: (left: unknown, right: unknown) => boolean;
  checkConsistency?: typeof isPileCacheConsistentWithBaseline;
} = {}): PileBaselineConsistencyPlan => {
  const isConsistent = checkConsistency({
    baseline,
    renderedIds,
    questionResponses,
    account,
    valuesEqual,
  });

  return {
    action: isConsistent ? 'sync-cache-caught-up' : 'maintain-optimistic',
    isConsistent,
  };
};
