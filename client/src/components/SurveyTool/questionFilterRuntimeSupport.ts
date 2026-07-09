import React from 'react';

import GateTooltip from '../Gates/GateTooltip';
import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import { getSessionConfigBySlug } from '../../utilities/web3/chainGateway.js';
import {
  resolveQuestionFilterEffectiveSlug,
  resolveQuestionFilterSessionContext,
} from './questionFilterSessionResolution.js';

export type UnknownRecord = Record<string, unknown>;
export type QuestionFilterMutableStatePatch = Record<string, unknown>;
export type QuestionFilterBookmarkCache = Record<string, unknown> & {
  bookmarkedFilters?: unknown[];
  filters?: unknown[];
};
export type QuestionFilterResponsesByQuestion = Record<string, unknown>;
export type QuestionFilterWriteCache = (
  namespace: string,
  slug: string | undefined,
  value: unknown,
) => boolean | Promise<boolean>;
export type QuestionFilterSessionProps = UnknownRecord & {
  account?: string;
  activeSessionSlug?: unknown;
  network?: {
    id?: unknown;
    [key: string]: unknown;
  } | null;
  provider?: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  ensureLightSbtUniverse?: unknown;
  storageKeyPrefix?: unknown;
};
export type QuestionFilterAiRequestOptions = {
  sessionSlug: string;
  sessionConfig: UnknownRecord;
  context: {
    account: string;
    providerLike?: unknown;
    chainId: unknown;
  };
};
export type QuestionFilterAiProviderSettings = {
  apiKey?: unknown;
  encryptedApiKey?: unknown;
};
export type QuestionFilterQuestionRecord = UnknownRecord & {
  id?: unknown;
  tags?: unknown;
  type?: unknown;
};
export type QuestionFilterResponseStats = {
  responseCount: number;
  totalImportance: number;
};
export type QuestionFilterResponseStatsMemo = {
  relevantResponsesRef: unknown;
  mergedQuestionsRef: unknown;
  questionResponsesNonceKey: unknown;
  questionsCacheNonceKey: unknown;
  result: Map<string, QuestionFilterResponseStats>;
};
export type QuestionFilterPipelineResult = {
  finalQuestions: QuestionFilterQuestionRecord[];
  count: number;
};
export type QuestionFilterPipelineMemo = {
  usePendingState: boolean;
  mergedQuestionsRef: unknown;
  relevantResponsesRef: unknown;
  selectedTypesRef: unknown;
  sortByImportance: unknown;
  sbtFilteredQuestionsRef: unknown;
  showTopQuestions: unknown;
  topQuestionsCount: unknown;
  showTopQuestionsByResponses: unknown;
  selectedTagsRef: unknown;
  filterByResponded: unknown;
  filterByNotResponded: unknown;
  aiSearchQuery: string;
  aiFilterApplied: boolean;
  aiAppliedTopN: number;
  aiCombineWithOtherFilters: boolean;
  aiRankedIdsSignature: string;
  aiLastAppliedSignature: string;
  questionResponsesNonceKey: unknown;
  questionsCacheNonceKey: unknown;
  result: QuestionFilterPipelineResult;
};
export type QuestionFilterRankedQuestion = [QuestionFilterQuestionRecord, number, number];
export type QuestionFilterSerializableState = Record<string, unknown> & {
  sbtFilter?: unknown;
};
export type QuestionFilterQuestionsCacheNet = UnknownRecord & {
  questions?: Record<string, QuestionFilterQuestionRecord | null | undefined>;
};
export type QuestionFilterAiApplySignatureArgs = {
  stateIn?: unknown;
  propsIn?: QuestionFilterSessionProps;
  queryOverride?: unknown;
  candidateQuestions?: unknown;
};
export type QuestionFilterAiApplyOptions = {
  auto?: boolean;
  queryOverride?: unknown;
  source?: unknown;
  topNOverride?: unknown;
};
export type QuestionFilterPersistenceProps = QuestionFilterSessionProps & {
  defaultFilterState?: unknown;
  enableLocalStorage?: unknown;
  filterState?: unknown;
  filterType?: unknown;
};
export type QuestionFilterStateArg = {
  stateIn?: unknown;
};
export type QuestionFilterResponseDrivenStateArgs = QuestionFilterStateArg & {
  usePendingState?: boolean;
};
export type QuestionFilterInputChangeEvent =
  | {
      target?: {
        checked?: unknown;
        value?: unknown;
      } | null;
    }
  | null
  | undefined;
export type QuestionFilterLoadStateOptions = {
  resetIfMissing?: boolean;
};
export type QuestionFilterRequiredValueEvent = {
  target: {
    value: unknown;
  };
};
export type QuestionFilterSbtSummaryEntry = {
  address?: unknown;
  name?: unknown;
};
export type QuestionFilterSbtSummaryState = Record<string, unknown> & {
  excludedSBTGroups?: unknown[];
  excludedSBTGroupsCreator?: unknown[];
  excludedSBTGroupsResponder?: unknown[];
  selectedSBTGroups?: unknown[];
  selectedSBTGroupsCreator?: unknown[];
  selectedSBTGroupsResponder?: unknown[];
};
export type QuestionFilterSummaryItem = {
  label: string;
  onRemove: () => void;
  type: string;
};
export type QuestionFilterAiAccessState = {
  enabled: boolean;
  sponsoredAvailable: boolean;
  localKeyAvailable: boolean;
  sponsoredStatus: string;
};
export type QuestionFilterGateTooltipProps = {
  gateId: string | null;
  gateConfig: React.ComponentProps<typeof GateTooltip>['gateConfig'];
  mode: string;
  sbtAddresses: string[];
} | null;
export type QuestionFilterStateRecord = UnknownRecord & {
  aiAppliedTopN?: number | null;
  aiRankingCount?: number;
  expandedSections: Record<string, boolean>;
  topQuestionsCount?: number;
};

export const FILTER_STORAGE_KEY_PREFIX = 'dg:filters:';
export const DEFAULT_TOP_QUESTIONS_COUNT = 10;
export const DEFAULT_AI_TOP_N = 10;
export const QUESTION_FILTER_RESPONSE_PARSE_MEMO_MAX = 500;
export const EMPTY_FILTER_RESPONSES = Object.freeze({});

export const modalStyles = {
  backgroundColor: 'white',
  fontSize: '16px',
};

export const toUnknownRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};

export const getErrorMessage = (error: unknown, fallback = 'Unknown error') => {
  const message =
    error && typeof error === 'object' && 'message' in error ? (error as { message?: unknown }).message : '';
  return typeof message === 'string' && message.trim() ? message : fallback;
};

export const getEncryptedQuestionCount = (questions: unknown): number =>
  (Array.isArray(questions) ? questions : []).filter(
    (question: { prompt?: unknown }) => String(question?.prompt || '').trim() === '[encrypted]',
  ).length;

export function resolveEffectiveSlug(props: QuestionFilterSessionProps = {}) {
  return resolveQuestionFilterEffectiveSlug({
    pathname: (typeof window !== 'undefined' && window.location?.pathname) || '',
    activeSessionSlug: props.activeSessionSlug,
    sessionSlug: props.sessionSlug,
  });
}

export function resolveEffectiveSessionContext(props: QuestionFilterSessionProps = {}) {
  return resolveQuestionFilterSessionContext({
    pathname: (typeof window !== 'undefined' && window.location?.pathname) || '',
    activeSessionSlug: props.activeSessionSlug,
    sessionSlug: props.sessionSlug,
    resolveBySlug: getSessionConfigBySlug,
  });
}

export function resolveFilterStorageSlug(props: QuestionFilterSessionProps = {}) {
  const prefix = String(props?.storageKeyPrefix || '').trim();
  if (prefix.startsWith(FILTER_STORAGE_KEY_PREFIX)) {
    return prefix.slice(FILTER_STORAGE_KEY_PREFIX.length);
  }
  return resolveEffectiveSlug(props);
}

export const readQuestionsCacheSync = (slug: string | undefined) =>
  peekCacheSync('questionsCache', slug, { clone: false }) || {};
