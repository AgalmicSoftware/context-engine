import React, { useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faCog, faExternalLinkAlt, faPlus } from '@fortawesome/free-solid-svg-icons';
import { listNamespaceEntriesSync, subscribeCacheUpdates } from '../../utilities/cache/cacheScripts.js';
import { callAI } from '../../utilities/ai/aiClient.js';
import buildTagInterpretationPrompt from '../../prompts/tagInterpretationPrompt.js';
import { normalizeTagList } from '../../utilities/defaultTags.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { getDemoSessionConfigBySlug, getSessionConfigBySlug } from '../../domains/sessions/sessionConfig.js';
import { useSessionRegistryReads } from '../../utilities/query/useSessionRegistryReads.js';
import { normalizeGlobalSessionSelection } from '../../utilities/session/globalSessionState.js';
import { parseQuestionSessionSlugFromSearch } from '../../utilities/survey/questionRouting.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { sessionModeAllowsAnonymousWorkerGroupDiscovery } from '../../utilities/session/sessionModeProfile';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
import {
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
  getWorkerSessionToken,
  type WorkerGroup,
  type WorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';
import { workerGroupNavigationPort } from '../../domains/worker/workerGroupNavigationPort';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SingleQuestionResponse from '../SurveyTool/SingleQuestionResponse';
import SessionChipSelector from '../Shared/SessionChipSelector';
import { buildTagPagePath } from '../SurveyTool/QuestionTagDropdown';
import { getQuestionTagDisplayList } from '../../utilities/survey/questionTags.js';
import type { RootState } from '../../reducers/index.js';
import styles from './TagPage.module.scss';

const buildTagInterpretationPromptUntyped = buildTagInterpretationPrompt as (args: {
  selectedTags: string[];
  questions: QuestionSummary[];
}) => string;

const TAG_AI_CACHE_LIMIT = 24;

export const readTagAiCacheEntry = (cache: Map<string, string>, key: string): string => {
  if (!cache.has(key)) return '';
  const value = cache.get(key) || '';
  cache.delete(key);
  cache.set(key, value);
  return value;
};

export const writeTagAiCacheEntry = (
  cache: Map<string, string>,
  key: string,
  value: string,
  limit = TAG_AI_CACHE_LIMIT,
): void => {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > Math.max(1, limit)) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    cache.delete(oldestKey);
  }
};

type FilterMode = 'all' | 'set';

type NetworkLike = {
  id?: number | string | null;
  chainId?: number | string | null;
  [key: string]: unknown;
} | null;

type SessionSelectionState = {
  selectedSessionScope?: string;
  selectedSessionSlugs?: string[];
  primarySessionSlug?: string;
};

type ScopeState = {
  filterMode: FilterMode;
  scopeSlugs: string[];
};

type ScopeSummary = {
  label: string;
  title: string;
};

type SessionSelectorOption = {
  key: string;
  slug: string;
  label: string;
  selected: boolean;
  general: boolean;
  primary: boolean;
  chipTestId: string;
  disabled?: boolean;
};

type SessionRegistryConfig = Record<string, unknown> & {
  sessionName?: unknown;
};

type SortTagEntriesArgs = {
  counts?: Map<string, number>;
  displayMap?: Map<string, string>;
};

type SortTagEntry = {
  normalizedTag: string;
  displayTag: string;
};

type DemoCorpusEntry = {
  key: string;
  title: string;
  summary?: string;
  tags: string[];
  normalizedTags: string[];
  corpusLabel: string;
  corpusKey: string;
  metaLine?: string;
  url?: string;
  [key: string]: unknown;
};

type QuestionSummary = {
  id: string;
  prompt: string;
  type: string;
  options: unknown[];
  arweaveTxId: string;
  responseCount: number;
  sessionSlug: string;
  networkId: string;
};

const buildTagAiContentRevision = (questions: QuestionSummary[]): string =>
  JSON.stringify(
    questions
      .map((question) => ({
        id: question.id,
        prompt: question.prompt,
        type: question.type,
        options: question.options,
        arweaveTxId: question.arweaveTxId,
        responseCount: question.responseCount,
        sessionSlug: normalizeSessionSlug(question.sessionSlug),
        networkId: String(question.networkId || ''),
      }))
      .sort((left, right) =>
        [left.sessionSlug, left.networkId, left.id]
          .join('::')
          .localeCompare([right.sessionSlug, right.networkId, right.id].join('::')),
      ),
  );

type SbtGroupSummary = {
  kind: 'sbt' | 'worker';
  address: string;
  href: string;
  name: string;
  image: string;
  tags: string[];
  sessionSlug: string;
  networkId: string;
};

type TagPageViewProps = {
  account?: unknown;
  isQuestionCacheReady?: boolean;
  network?: NetworkLike;
  provider?: unknown;
  questionResponsesNonce?: number;
  sessionState?: SessionSelectionState;
  selectedTagsOverride?: string[] | string | null;
  onSelectedTagsChange?: ((nextTags: string[]) => void) | null;
  emptyQuestionsText?: string;
  embedded?: boolean;
  demoCorpusMode?: boolean;
  demoCorpusRecords?: DemoCorpusEntry[];
  hideEmbeddedSessionSelector?: boolean;
};

type QuestionCacheQuestion = {
  id?: string;
  prompt?: string;
  type?: string;
  options?: unknown[];
  arweaveTxId?: string;
  sessionSlug?: string;
  tags?: unknown[];
};

type QuestionCacheNetworkBucket = {
  questions?: Record<string, QuestionCacheQuestion>;
  questionResponses?: Record<string, Record<string, unknown>>;
};

type QuestionCacheEntry = {
  slug?: string;
  value?: Record<string, QuestionCacheNetworkBucket>;
};

type SbtInfoRecord = {
  private?: boolean;
  tags?: unknown[];
  name?: string;
  image?: string;
};

type SbtCacheBucketEntry = {
  sbtAddress?: string;
  sbtInfo?: SbtInfoRecord;
};

type SbtCacheNetworkBucket = {
  sbtList?: Record<string, SbtCacheBucketEntry>;
};

type SbtCacheEntry = {
  slug?: string;
  value?: Record<string, SbtCacheNetworkBucket>;
};

type TagPageWorkerGroupPorts = {
  getSessionConfig: (slug: string, configsBySlug: Record<string, unknown>) => unknown;
  getWorkerSessionToken: typeof getWorkerSessionToken;
  loadPublicWorkerGroups: (args: {
    workerUrl: unknown;
    sessionId: unknown;
    sessionSlug: unknown;
  }) => Promise<WorkerGroup[]>;
  loadWorkerGroupOverview: (args: {
    workerUrl: unknown;
    credentialToken: unknown;
    sessionId: unknown;
    sessionSlug: unknown;
  }) => Promise<WorkerGroupOverview>;
};

const defaultTagPageWorkerGroupPorts: TagPageWorkerGroupPorts = {
  getSessionConfig: (slug, configsBySlug) => resolveTagPageWorkerSessionConfig(slug, configsBySlug),
  getWorkerSessionToken,
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
};

export const resolveTagPageWorkerSessionConfig = (
  slug: string,
  configsBySlug: Record<string, unknown> = {},
): unknown => {
  const registeredConfig = configsBySlug[slug] || getSessionConfigBySlug(slug);
  if (registeredConfig) return registeredConfig;
  // Regression guard: a direct tag URL can load before the registry snapshot
  // contains a known demo Worker, so opt into that exact tracked fallback.
  return getDemoSessionConfigBySlug(slug, { allowDemoFallback: true });
};

export const loadTagPageWorkerGroupData = async (
  {
    account,
    network,
    provider,
    selectedTags,
    sessionConfigsBySlug = {},
    sessionSlugs,
  }: {
    account?: unknown;
    network?: NetworkLike;
    provider?: unknown;
    selectedTags?: string[];
    sessionConfigsBySlug?: Record<string, unknown>;
    sessionSlugs?: string[];
  },
  ports: TagPageWorkerGroupPorts = defaultTagPageWorkerGroupPorts,
): Promise<SbtGroupSummary[]> => {
  const normalizedSelectedTags = normalizeTagList(selectedTags);
  if (!normalizedSelectedTags.length) return [];
  const normalizedAccount = String(account || '').trim();

  const perSession = await Promise.all(
    dedupeSessionSlugs(sessionSlugs).map(async (sessionSlug) => {
      const sessionConfig = ports.getSessionConfig(sessionSlug, sessionConfigsBySlug);
      const projection = resolveSessionCapabilityProjection(sessionConfig);
      if (!projection.profileValid || !projection.isWorkerCanonical || !projection.usesWorkerGroups) return [];
      if (
        !normalizedAccount &&
        !sessionModeAllowsAnonymousWorkerGroupDiscovery(
          (sessionConfig as { sessionModeProfile?: unknown } | null)?.sessionModeProfile,
        )
      ) {
        return [];
      }

      const workerUrl = getUsableSessionWorkerUrl({
        slug: sessionSlug,
        sessionConfig,
        requireExactWorkerSession: true,
      });
      const sessionId = resolveWorkerCanonicalSessionIdHex(sessionConfig);
      if (!workerUrl || !sessionId) return [];

      try {
        let groups: WorkerGroup[];
        // Regression guard: mirror the native Groups visibility boundary—public
        // catalog when anonymous, account-authorized overview when signed in.
        if (normalizedAccount) {
          const credentialToken = await ports.getWorkerSessionToken({
            sessionSlug,
            sessionConfig,
            workerUrl,
            context: {
              account: normalizedAccount,
              providerLike: provider,
              chainId: network?.chainId || network?.id || projection.chainId || 1,
            },
          });
          const overview = await ports.loadWorkerGroupOverview({
            workerUrl,
            credentialToken,
            sessionId,
            sessionSlug,
          });
          groups = [...(overview.groups || []), ...(overview.memberships || []).map(({ group }) => group)];
        } else {
          groups = await ports.loadPublicWorkerGroups({ workerUrl, sessionId, sessionSlug });
        }

        const seen = new Set<string>();
        return groups.flatMap((group) => {
          const groupId = String(group?.groupId || '').trim();
          if (!groupId || seen.has(groupId)) return [];
          seen.add(groupId);
          const tags = Array.isArray(group?.tags)
            ? group.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
            : [];
          const normalizedGroupTags = normalizeTagList(tags);
          if (!normalizedSelectedTags.every((tag) => normalizedGroupTags.includes(tag))) return [];
          return [
            {
              kind: 'worker' as const,
              address: groupId,
              href: workerGroupNavigationPort.buildPath({ groupId, sessionSlug }),
              name: String(group?.label || '').trim() || groupId,
              image: String(group?.imageUrl || '').trim(),
              tags,
              sessionSlug,
              networkId: 'worker',
            },
          ];
        });
      } catch {
        return [];
      }
    }),
  );

  return perSession.flat().sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    return nameCompare !== 0 ? nameCompare : left.address.localeCompare(right.address);
  });
};

const parseTagPath = (pathname = ''): string[] => {
  const rawSegment = (String(pathname || '').split('/tag/')[1] || '').replace(/\/+$/, '');
  if (!rawSegment) return [];

  const decodedSegments = rawSegment.split('+').map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch (_) {
      return segment;
    }
  });

  return getQuestionTagDisplayList(decodedSegments);
};

const dedupeSessionSlugs = (values: unknown[] | unknown = []): string[] => {
  const seen = new Set();
  const out: string[] = [];
  (Array.isArray(values) ? values : [values]).forEach((value) => {
    const normalized = normalizeSessionSlug(value);
    if (normalized == null || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

const buildSessionScopeLabel = (slugIn = '', configsBySlug: Record<string, SessionRegistryConfig> = {}): string => {
  const slug = normalizeSessionSlug(slugIn);
  if (!slug) return 'General';
  const cfg = configsBySlug[slug] || getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }) || {};
  const sessionName = String(cfg?.sessionName || '').trim();
  return sessionName && sessionName.toLowerCase() !== slug.toLowerCase()
    ? `${sessionName} (${slug})`
    : sessionName || slug;
};

export const buildGlobalTagPageScope = (selection: SessionSelectionState = {}): ScopeState => {
  const scopeMode =
    String(selection?.selectedSessionScope || '')
      .trim()
      .toLowerCase() || 'active';
  if (scopeMode === 'all') {
    return { filterMode: 'all', scopeSlugs: [] };
  }
  if (scopeMode === 'list') {
    return {
      filterMode: 'set',
      scopeSlugs: dedupeSessionSlugs(selection?.selectedSessionSlugs || []),
    };
  }
  if (scopeMode === 'general') {
    return { filterMode: 'set', scopeSlugs: [''] };
  }
  return {
    filterMode: 'set',
    scopeSlugs: [normalizeSessionSlug(selection?.primarySessionSlug || '')],
  };
};

export const describeScopeSummary = ({
  filterMode = 'all',
  scopeSlugs = [],
  routePinned = false,
  localOverrideTouched = false,
  sessionConfigsBySlug = {},
}: {
  filterMode?: FilterMode;
  scopeSlugs?: unknown[];
  routePinned?: boolean;
  localOverrideTouched?: boolean;
  sessionConfigsBySlug?: Record<string, SessionRegistryConfig>;
} = {}): ScopeSummary => {
  const normalizedScopeSlugs = dedupeSessionSlugs(scopeSlugs);
  let labelCore = 'all sessions';
  let title = 'Showing questions from all sessions.';

  if (filterMode === 'set') {
    if (!normalizedScopeSlugs.length) {
      labelCore = 'no sessions selected';
      title = 'The current session scope does not include any sessions.';
    } else if (normalizedScopeSlugs.length === 1) {
      labelCore = buildSessionScopeLabel(normalizedScopeSlugs[0], sessionConfigsBySlug);
      title = `Showing questions from ${labelCore}.`;
    } else if (normalizedScopeSlugs.length <= 2) {
      const labels = normalizedScopeSlugs.map((slug) => buildSessionScopeLabel(slug, sessionConfigsBySlug));
      labelCore = labels.join(' + ');
      title = `Showing questions from ${labels.join(', ')}.`;
    } else {
      const labels = normalizedScopeSlugs.map((slug) => buildSessionScopeLabel(slug, sessionConfigsBySlug));
      labelCore = `${normalizedScopeSlugs.length} selected sessions`;
      title = `Showing questions from ${labels.join(', ')}.`;
    }
  }

  if (routePinned) {
    return {
      label: `Session scope: ${labelCore} (URL pin)`,
      title,
    };
  }
  if (localOverrideTouched) {
    return {
      label: `Session scope: ${labelCore} (override)`,
      title,
    };
  }
  return {
    label: `Session scope: ${labelCore}`,
    title,
  };
};

const buildTagPageSelectorHint = ({
  routePinned = false,
  localOverrideTouched = false,
  globalSelection = {},
}: {
  routePinned?: boolean;
  localOverrideTouched?: boolean;
  globalSelection?: SessionSelectionState;
} = {}): string => {
  if (routePinned) return 'This tag page is pinned to a specific session from the URL.';
  if (localOverrideTouched) return 'Using a local Tag explorer override.';

  const scopeMode = String(globalSelection?.selectedSessionScope || '')
    .trim()
    .toLowerCase();
  if (scopeMode === 'all') return 'Using the global all-sessions scope by default.';
  if (scopeMode === 'list') return 'Using the global session list by default.';
  if (scopeMode === 'general') return 'Using the global general-session scope by default.';
  return 'Using the global primary session by default.';
};

const buildTagPageSessionSelectorOptions = ({
  selectedSlug = null,
  primarySlug = '',
  scopedSlugs = [],
  registrySlugs = [],
  sessionConfigsBySlug = {},
}: {
  selectedSlug?: string | null;
  primarySlug?: string;
  scopedSlugs?: string[];
  registrySlugs?: string[];
  sessionConfigsBySlug?: Record<string, SessionRegistryConfig>;
} = {}): SessionSelectorOption[] => {
  const options = new Map();
  const pushOption = (slugIn = '') => {
    const slug = normalizeSessionSlug(slugIn);
    if (options.has(slug)) return;
    options.set(slug, {
      key: `tagpage-session-${slug || 'general'}`,
      slug,
      label: buildSessionScopeLabel(slug, sessionConfigsBySlug),
      selected: selectedSlug !== null && slug === selectedSlug,
      general: slug === '',
      primary: slug === normalizeSessionSlug(primarySlug),
      chipTestId: `ce-tag-page-session-chip-${slug || 'general'}`,
    });
  };

  if (selectedSlug !== null) pushOption(selectedSlug);
  pushOption(primarySlug);
  scopedSlugs.forEach(pushOption);
  registrySlugs.forEach(pushOption);

  return Array.from(options.values());
};

const sortTagEntriesByCount = ({
  counts = new Map(),
  displayMap = new Map(),
}: SortTagEntriesArgs = {}): SortTagEntry[] =>
  Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      const leftLabel = displayMap.get(left[0]) || left[0];
      const rightLabel = displayMap.get(right[0]) || right[0];
      return leftLabel.localeCompare(rightLabel);
    })
    .map(([normalizedTag]) => ({
      normalizedTag,
      displayTag: displayMap.get(normalizedTag) || normalizedTag,
    }));

const buildDemoCorpusEmptyText = (selectedTags: string[] = []): string => {
  if (selectedTags.length === 1) {
    return `No demo corpus entries tagged ${selectedTags[0]} yet.`;
  }

  return 'No demo corpus entries match this tag comparison yet.';
};

const buildVisibleDemoCorpusTags = ({
  entryTags = [],
  normalizedSelectedTags = [],
}: {
  entryTags?: string[];
  normalizedSelectedTags?: string[];
} = {}): string[] => {
  const selectedTagSet = new Set(normalizedSelectedTags);
  const selected: string[] = [];
  const unselected: string[] = [];

  (Array.isArray(entryTags) ? entryTags : []).forEach((tag) => {
    const normalizedTag = normalizeTagList([tag])[0];
    if (!normalizedTag) return;

    if (selectedTagSet.has(normalizedTag)) {
      selected.push(tag);
      return;
    }

    unselected.push(tag);
  });

  return [...selected, ...unselected];
};

const collectDemoCorpusData = ({
  selectedTags,
  demoCorpusRecords = [],
}: {
  selectedTags?: string[];
  demoCorpusRecords?: DemoCorpusEntry[];
} = {}): {
  entries: DemoCorpusEntry[];
  relatedTags: string[];
  pickerTags: string[];
} => {
  const normalizedSelectedTags = normalizeTagList(selectedTags);
  if (!normalizedSelectedTags.length) {
    return { entries: [], relatedTags: [], pickerTags: [] };
  }

  const relatedCounts = new Map();
  const relatedDisplay = new Map();
  const scopedCounts = new Map();
  const scopedDisplay = new Map();
  const matchedEntries: DemoCorpusEntry[] = [];

  (Array.isArray(demoCorpusRecords) ? demoCorpusRecords : []).forEach((entry) => {
    const scopedSeen = new Set();
    entry.tags.forEach((tag) => {
      const normalizedTag = normalizeTagList([tag])[0];
      if (!normalizedTag || normalizedSelectedTags.includes(normalizedTag) || scopedSeen.has(normalizedTag)) return;
      scopedSeen.add(normalizedTag);
      if (!scopedDisplay.has(normalizedTag)) {
        scopedDisplay.set(normalizedTag, tag);
      }
      scopedCounts.set(normalizedTag, (scopedCounts.get(normalizedTag) || 0) + 1);
    });

    const hasAllSelectedTags = normalizedSelectedTags.every((tag) => entry.normalizedTags.includes(tag));
    if (!hasAllSelectedTags) return;

    const relatedSeen = new Set();
    entry.tags.forEach((tag) => {
      const normalizedTag = normalizeTagList([tag])[0];
      if (!normalizedTag || normalizedSelectedTags.includes(normalizedTag) || relatedSeen.has(normalizedTag)) return;
      relatedSeen.add(normalizedTag);
      if (!relatedDisplay.has(normalizedTag)) {
        relatedDisplay.set(normalizedTag, tag);
      }
      relatedCounts.set(normalizedTag, (relatedCounts.get(normalizedTag) || 0) + 1);
    });

    matchedEntries.push(entry);
  });

  const relatedTagEntries = sortTagEntriesByCount({
    counts: relatedCounts,
    displayMap: relatedDisplay,
  });
  const relatedTags = relatedTagEntries.map(({ displayTag }) => displayTag);
  const relatedNormalizedTags = new Set(relatedTagEntries.map(({ normalizedTag }) => normalizedTag));
  const pickerTags = [
    ...relatedTags,
    ...sortTagEntriesByCount({
      counts: scopedCounts,
      displayMap: scopedDisplay,
    })
      .filter(({ normalizedTag }) => !relatedNormalizedTags.has(normalizedTag))
      .map(({ displayTag }) => displayTag),
  ];

  return {
    entries: matchedEntries,
    relatedTags,
    pickerTags,
  };
};

const collectTagPageData = ({
  selectedTags,
  scopeFilterMode = 'all',
  scopeSlugs = [],
  cacheVersion,
  questionResponsesNonce,
}: {
  selectedTags?: string[];
  scopeFilterMode?: FilterMode;
  scopeSlugs?: string[];
  cacheVersion?: number;
  questionResponsesNonce?: number;
} = {}): {
  questions: QuestionSummary[];
  relatedTags: string[];
  pickerTags: string[];
} => {
  void cacheVersion;
  void questionResponsesNonce;
  const normalizedSelectedTags = normalizeTagList(selectedTags);
  if (!normalizedSelectedTags.length) return { questions: [], relatedTags: [], pickerTags: [] };

  const entries = listNamespaceEntriesSync('questionsCache', { cloneValues: false }) as QuestionCacheEntry[];
  const normalizedScopeSlugs = dedupeSessionSlugs(scopeSlugs);
  const scopeFilterEnabled = scopeFilterMode === 'set';
  const scopeSlugSet = new Set(normalizedScopeSlugs);
  const scopedEntries = scopeFilterEnabled
    ? entries.filter((entry) => scopeSlugSet.has(normalizeSessionSlug(entry?.slug)))
    : entries;

  const questions: QuestionSummary[] = [];
  const seen = new Set();
  const relatedCounts = new Map();
  const relatedDisplay = new Map();
  const scopedCounts = new Map();
  const scopedDisplay = new Map();

  scopedEntries.forEach((entry) => {
    const sessionSlug = normalizeSessionSlug(entry?.slug || '');
    const cacheValue = entry?.value && typeof entry.value === 'object' ? entry.value : {};

    Object.entries(cacheValue).forEach(([networkId, networkBucket]) => {
      const questionsById =
        networkBucket?.questions && typeof networkBucket.questions === 'object' ? networkBucket.questions : {};
      const responsesById =
        networkBucket?.questionResponses && typeof networkBucket.questionResponses === 'object'
          ? networkBucket.questionResponses
          : {};

      Object.entries(questionsById).forEach(([questionId, question]) => {
        const resolvedQuestionId = String(question?.id || questionId || '')
          .trim()
          .toLowerCase();
        if (!resolvedQuestionId) return;

        const questionTags = getQuestionTagDisplayList(question?.tags);
        const normalizedQuestionTags = normalizeTagList(questionTags);
        const questionSeenScoped = new Set();
        questionTags.forEach((tag) => {
          const normalizedTag = normalizeTagList([tag])[0];
          const displayTag = String(tag || '').trim() || normalizedTag;
          if (!normalizedTag || normalizedSelectedTags.includes(normalizedTag) || questionSeenScoped.has(normalizedTag))
            return;
          questionSeenScoped.add(normalizedTag);
          if (!scopedDisplay.has(normalizedTag)) {
            scopedDisplay.set(normalizedTag, displayTag);
          }
          scopedCounts.set(normalizedTag, (scopedCounts.get(normalizedTag) || 0) + 1);
        });

        const hasAllSelectedTags = normalizedSelectedTags.every((tag) => normalizedQuestionTags.includes(tag));

        if (!hasAllSelectedTags) return;

        const dedupeKey = `${sessionSlug}::${networkId}::${resolvedQuestionId}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const questionSeenRelated = new Set();
        questionTags.forEach((tag) => {
          const normalizedTag = normalizeTagList([tag])[0];
          const displayTag = String(tag || '').trim() || normalizedTag;
          if (
            !normalizedTag ||
            normalizedSelectedTags.includes(normalizedTag) ||
            questionSeenRelated.has(normalizedTag)
          )
            return;
          questionSeenRelated.add(normalizedTag);
          if (!relatedDisplay.has(normalizedTag)) {
            relatedDisplay.set(normalizedTag, displayTag);
          }
          relatedCounts.set(normalizedTag, (relatedCounts.get(normalizedTag) || 0) + 1);
        });

        questions.push({
          id: resolvedQuestionId,
          prompt: String(question?.prompt || 'Untitled question').trim() || 'Untitled question',
          type: String(question?.type || 'freeform').trim() || 'freeform',
          options: Array.isArray(question?.options) ? question.options : [],
          arweaveTxId: String(question?.arweaveTxId || '').trim(),
          responseCount: Object.keys(responsesById?.[resolvedQuestionId] || {}).length,
          sessionSlug: normalizeSessionSlug(question?.sessionSlug || sessionSlug),
          networkId: String(networkId || ''),
        });
      });
    });
  });

  const sortedQuestions = questions.sort((a, b) => {
    if (b.responseCount !== a.responseCount) return b.responseCount - a.responseCount;
    return a.prompt.localeCompare(b.prompt);
  });

  const relatedTagEntries = sortTagEntriesByCount({
    counts: relatedCounts,
    displayMap: relatedDisplay,
  });
  const relatedTags = relatedTagEntries.map(({ displayTag }) => displayTag);
  const relatedNormalizedTags = new Set(relatedTagEntries.map(({ normalizedTag }) => normalizedTag));
  const pickerTags = [
    ...relatedTags,
    ...sortTagEntriesByCount({
      counts: scopedCounts,
      displayMap: scopedDisplay,
    })
      .filter(({ normalizedTag }) => !relatedNormalizedTags.has(normalizedTag))
      .map(({ displayTag }) => displayTag),
  ];

  return {
    questions: sortedQuestions,
    relatedTags,
    pickerTags,
  };
};

const collectSbtGroupData = ({
  selectedTags,
  scopeFilterMode = 'all',
  scopeSlugs = [],
  cacheVersion = 0,
}: {
  selectedTags?: string[];
  scopeFilterMode?: FilterMode;
  scopeSlugs?: string[];
  cacheVersion?: number;
} = {}): SbtGroupSummary[] => {
  const normalizedSelectedTags = normalizeTagList(selectedTags);
  void cacheVersion;
  if (!normalizedSelectedTags.length) return [];

  let entries: SbtCacheEntry[] = [];
  try {
    entries = listNamespaceEntriesSync('sbtCache', { cloneValues: false }) as SbtCacheEntry[];
  } catch (_) {
    return [];
  }

  const normalizedScopeSlugs = dedupeSessionSlugs(scopeSlugs);
  const scopeFilterEnabled = scopeFilterMode === 'set';
  const scopeSlugSet = new Set(normalizedScopeSlugs);
  const scopedEntries = scopeFilterEnabled
    ? entries.filter((entry) => scopeSlugSet.has(normalizeSessionSlug(entry?.slug)))
    : entries;
  const seen = new Set();
  const sbtGroups: SbtGroupSummary[] = [];

  scopedEntries.forEach((entry) => {
    const sessionSlug = normalizeSessionSlug(entry?.slug || '');
    const cacheValue = entry?.value && typeof entry.value === 'object' ? entry.value : {};

    Object.entries(cacheValue).forEach(([networkId, networkBucket]) => {
      const sbtList = networkBucket?.sbtList && typeof networkBucket.sbtList === 'object' ? networkBucket.sbtList : {};

      Object.entries(sbtList).forEach(([cacheAddress, sbtEntry]) => {
        const resolvedEntry = sbtEntry && typeof sbtEntry === 'object' ? sbtEntry : {};
        const sbtInfo =
          resolvedEntry?.sbtInfo && typeof resolvedEntry.sbtInfo === 'object' ? resolvedEntry.sbtInfo : {};
        if (sbtInfo?.private === true) return;

        const rawTags = Array.isArray(sbtInfo?.tags) ? sbtInfo.tags : [];
        const displayTags: string[] = [];
        const normalizedGroupTags: string[] = [];
        const seenTags = new Set();

        rawTags.forEach((tag) => {
          const displayTag = String(tag || '').trim();
          const normalizedTag = normalizeTagList([displayTag])[0];
          if (!displayTag || !normalizedTag || seenTags.has(normalizedTag)) return;
          seenTags.add(normalizedTag);
          displayTags.push(displayTag);
          normalizedGroupTags.push(normalizedTag);
        });

        const hasAllSelectedTags = normalizedSelectedTags.every((tag) => normalizedGroupTags.includes(tag));
        if (!hasAllSelectedTags) return;

        const address = String(resolvedEntry?.sbtAddress || cacheAddress || '').trim();
        const normalizedAddress = address.toLowerCase();
        if (!normalizedAddress) return;

        const dedupeKey = `${sessionSlug}::${networkId}::${normalizedAddress}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        sbtGroups.push({
          kind: 'sbt',
          address,
          href: buildSbtDetailPath(address, sessionSlug),
          name: String(sbtInfo?.name || '').trim() || address,
          image: String(sbtInfo?.image || '').trim(),
          tags: displayTags,
          sessionSlug,
          networkId: String(networkId || '').trim(),
        });
      });
    });
  });

  return sbtGroups.sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) return nameCompare;
    return left.address.localeCompare(right.address);
  });
};

export const TagPageView = ({
  account = '',
  isQuestionCacheReady = true,
  network = null,
  provider = null,
  questionResponsesNonce = 0,
  sessionState = {},
  selectedTagsOverride = null,
  onSelectedTagsChange = null,
  emptyQuestionsText = 'No questions found.',
  embedded = false,
  demoCorpusMode = false,
  demoCorpusRecords = [],
  hideEmbeddedSessionSelector = false,
}: TagPageViewProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [cacheVersion, setCacheVersion] = useState(0);
  const [sbtCacheVersion, setSbtCacheVersion] = useState(0);
  const [workerGroups, setWorkerGroups] = useState<SbtGroupSummary[]>([]);
  const [workerGroupsLoading, setWorkerGroupsLoading] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [sessionSelectorOpen, setSessionSelectorOpen] = useState(false);
  const [expandedDemoEntryKeys, setExpandedDemoEntryKeys] = useState<Record<string, boolean>>({});
  const [localSessionOverrideTouched, setLocalSessionOverrideTouched] = useState(false);
  const [localSessionOverrideSlug, setLocalSessionOverrideSlug] = useState<string | null>(null);
  const [aiInterpretation, setAiInterpretation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiElapsedMs, setAiElapsedMs] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiCacheRef = useRef<Map<string, string>>(new Map());
  const aiRequestKeyRef = useRef('');
  const aiStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeCacheUpdates((payload: { namespace?: string } = {}) => {
      if (payload.namespace === 'questionsCache') {
        setCacheVersion((prev) => prev + 1);
      }
      if (payload.namespace === 'sbtCache') {
        setSbtCacheVersion((prev) => prev + 1);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    setTagPickerOpen(false);
    setSessionSelectorOpen(false);
  }, [location.pathname, location.search]);

  const routeSelectedTags = useMemo(() => parseTagPath(location.pathname), [location.pathname]);
  const hasSelectedTagsOverride = selectedTagsOverride !== null && typeof selectedTagsOverride !== 'undefined';
  const selectedTags = useMemo<string[]>(() => {
    if (!hasSelectedTagsOverride) return routeSelectedTags;

    const overrideTags = Array.isArray(selectedTagsOverride) ? selectedTagsOverride : [selectedTagsOverride];
    return getQuestionTagDisplayList(overrideTags);
  }, [hasSelectedTagsOverride, routeSelectedTags, selectedTagsOverride]);
  const normalizedSelectedTags = useMemo(() => normalizeTagList(selectedTags), [selectedTags]);
  const selectedTagsCacheKey = useMemo(
    () =>
      normalizedSelectedTags
        .slice()
        .sort((left, right) => left.localeCompare(right))
        .join('||'),
    [normalizedSelectedTags],
  );
  const isDemoCorpusContext = demoCorpusMode === true;

  const queryPinnedScopeSlug = useMemo(() => parseQuestionSessionSlugFromSearch(location.search), [location.search]);
  const routePinned = queryPinnedScopeSlug !== null;
  const globalSessionSelection = useMemo<SessionSelectionState>(
    () => normalizeGlobalSessionSelection(sessionState || {}) as SessionSelectionState,
    [sessionState],
  );
  const globalScopeState = useMemo<ScopeState>(
    () => buildGlobalTagPageScope(globalSessionSelection),
    [globalSessionSelection],
  );
  const normalizedLocalOverrideSlug = useMemo(
    () => normalizeSessionSlug(localSessionOverrideSlug),
    [localSessionOverrideSlug],
  );
  const effectiveScopeState = useMemo<ScopeState>(() => {
    if (routePinned) {
      return {
        filterMode: 'set',
        scopeSlugs: [normalizeSessionSlug(queryPinnedScopeSlug)],
      };
    }
    if (localSessionOverrideTouched) {
      return {
        filterMode: 'set',
        scopeSlugs: [normalizedLocalOverrideSlug],
      };
    }
    return globalScopeState;
  }, [globalScopeState, localSessionOverrideTouched, normalizedLocalOverrideSlug, queryPinnedScopeSlug, routePinned]);
  const effectiveScopeSlugs = useMemo(
    () => (Array.isArray(effectiveScopeState.scopeSlugs) ? effectiveScopeState.scopeSlugs : []),
    [effectiveScopeState.scopeSlugs],
  );
  const effectiveScopeCacheKey = useMemo(
    () => [effectiveScopeState.filterMode, ...effectiveScopeSlugs].join('||'),
    [effectiveScopeState.filterMode, effectiveScopeSlugs],
  );
  const effectiveSingleScopeSlug =
    effectiveScopeState.filterMode === 'set' && effectiveScopeSlugs.length === 1 ? effectiveScopeSlugs[0] : '';
  const hasSingleSessionScope = effectiveScopeState.filterMode === 'set' && effectiveScopeSlugs.length === 1;
  const selectedSessionSelectorSlug = routePinned
    ? normalizeSessionSlug(queryPinnedScopeSlug)
    : localSessionOverrideTouched
      ? normalizedLocalOverrideSlug
      : null;
  const registryRequestedSlugs = useMemo(
    () =>
      dedupeSessionSlugs([
        globalSessionSelection.primarySessionSlug || '',
        ...effectiveScopeSlugs,
        selectedSessionSelectorSlug || '',
      ]),
    [effectiveScopeSlugs, globalSessionSelection.primarySessionSlug, selectedSessionSelectorSlug],
  );
  const registryChainId = network?.chainId ?? network?.id ?? null;
  const { snapshotQuery: sessionRegistrySnapshotQuery } = useSessionRegistryReads({
    chainId: registryChainId,
    includeRegistryList: !isDemoCorpusContext,
    sessionSlugs: registryRequestedSlugs,
  });
  const sessionRegistrySnapshot = sessionRegistrySnapshotQuery.data || {
    slugs: [],
    configsBySlug: {},
  };
  const scopeSummary = useMemo(
    () =>
      describeScopeSummary({
        filterMode: effectiveScopeState.filterMode,
        scopeSlugs: effectiveScopeSlugs,
        routePinned,
        localOverrideTouched: localSessionOverrideTouched,
        sessionConfigsBySlug: sessionRegistrySnapshot.configsBySlug,
      }),
    [
      effectiveScopeState.filterMode,
      effectiveScopeSlugs,
      localSessionOverrideTouched,
      routePinned,
      sessionRegistrySnapshot.configsBySlug,
    ],
  );
  const sessionSelectorHint = useMemo(
    () =>
      buildTagPageSelectorHint({
        routePinned: isDemoCorpusContext ? false : routePinned,
        localOverrideTouched: isDemoCorpusContext ? false : localSessionOverrideTouched,
        globalSelection: globalSessionSelection,
      }),
    [globalSessionSelection, isDemoCorpusContext, localSessionOverrideTouched, routePinned],
  );
  const sessionSelectorOptions = useMemo<SessionSelectorOption[]>(
    () =>
      isDemoCorpusContext
        ? []
        : buildTagPageSessionSelectorOptions({
            selectedSlug: selectedSessionSelectorSlug,
            primarySlug: globalSessionSelection.primarySessionSlug || '',
            scopedSlugs: effectiveScopeSlugs,
            registrySlugs: sessionRegistrySnapshot.slugs,
            sessionConfigsBySlug: sessionRegistrySnapshot.configsBySlug,
          }),
    [
      effectiveScopeSlugs,
      globalSessionSelection.primarySessionSlug,
      isDemoCorpusContext,
      selectedSessionSelectorSlug,
      sessionRegistrySnapshot.configsBySlug,
      sessionRegistrySnapshot.slugs,
    ],
  );
  const workerGroupSessionSlugs = useMemo(
    () => {
      const candidates =
        effectiveScopeState.filterMode === 'set'
        ? effectiveScopeSlugs
        : dedupeSessionSlugs([
            globalSessionSelection.primarySessionSlug || '',
            ...sessionRegistrySnapshot.slugs,
          ]);
      return candidates.filter((slug) => {
        const config = defaultTagPageWorkerGroupPorts.getSessionConfig(
          slug,
          sessionRegistrySnapshot.configsBySlug,
        );
        const projection = resolveSessionCapabilityProjection(config);
        return projection.profileValid && projection.isWorkerCanonical && projection.usesWorkerGroups;
      });
    },
    [
      effectiveScopeSlugs,
      effectiveScopeState.filterMode,
      globalSessionSelection.primarySessionSlug,
      sessionRegistrySnapshot.configsBySlug,
      sessionRegistrySnapshot.slugs,
    ],
  );

  useEffect(() => {
    if (isDemoCorpusContext || !selectedTags.length || !workerGroupSessionSlugs.length) {
      setWorkerGroups([]);
      setWorkerGroupsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setWorkerGroupsLoading(true);
    void loadTagPageWorkerGroupData({
      account,
      network,
      provider,
      selectedTags,
      sessionConfigsBySlug: sessionRegistrySnapshot.configsBySlug,
      sessionSlugs: workerGroupSessionSlugs,
    }).then((nextGroups) => {
      if (cancelled) return;
      setWorkerGroups(nextGroups);
      setWorkerGroupsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    account,
    effectiveScopeCacheKey,
    isDemoCorpusContext,
    network,
    provider,
    selectedTags,
    selectedTagsCacheKey,
    sessionRegistrySnapshot.configsBySlug,
    workerGroupSessionSlugs,
  ]);

  useEffect(() => {
    if (!routePinned) return;
    setLocalSessionOverrideTouched(false);
    setLocalSessionOverrideSlug(null);
  }, [location.search, routePinned]);

  useEffect(() => {
    setExpandedDemoEntryKeys({});
  }, [selectedTagsCacheKey]);

  useEffect(() => {
    if (!aiLoading) return undefined;

    const startedAt = aiStartedAtRef.current || Date.now();
    aiStartedAtRef.current = startedAt;
    setAiElapsedMs(Date.now() - startedAt);

    const timerId = setInterval(() => {
      setAiElapsedMs(Date.now() - startedAt);
    }, 100);

    return () => clearInterval(timerId);
  }, [aiLoading]);

  // NOTE: Full cache scan on each update. Acceptable for current scale; add slug-indexed cache if this becomes a bottleneck.
  const questionData = useMemo<{
    questions: QuestionSummary[];
    relatedTags: string[];
    pickerTags: string[];
  }>(
    () =>
      isDemoCorpusContext
        ? { questions: [], relatedTags: [], pickerTags: [] }
        : collectTagPageData({
            selectedTags,
            scopeFilterMode: effectiveScopeState.filterMode,
            scopeSlugs: effectiveScopeSlugs,
            cacheVersion,
            questionResponsesNonce,
          }),
    [
      cacheVersion,
      effectiveScopeState.filterMode,
      effectiveScopeSlugs,
      isDemoCorpusContext,
      questionResponsesNonce,
      selectedTags,
    ],
  );
  const demoCorpusData = useMemo<{
    entries: DemoCorpusEntry[];
    relatedTags: string[];
    pickerTags: string[];
  }>(
    () =>
      isDemoCorpusContext
        ? collectDemoCorpusData({ selectedTags, demoCorpusRecords })
        : { entries: [], relatedTags: [], pickerTags: [] },
    [demoCorpusRecords, isDemoCorpusContext, selectedTags],
  );
  const questions = questionData.questions;
  const aiContentRevision = useMemo(() => buildTagAiContentRevision(questions), [questions]);
  const aiNetworkScope = useMemo(
    () =>
      Array.from(new Set(questions.map((question) => String(question.networkId || ''))))
        .sort((left, right) => left.localeCompare(right))
        .join(','),
    [questions],
  );
  const aiCacheKey = useMemo(
    () =>
      [
        'questionsCache',
        normalizeSessionSlug(effectiveSingleScopeSlug),
        aiNetworkScope,
        selectedTagsCacheKey,
        aiContentRevision,
      ].join('::'),
    [aiContentRevision, aiNetworkScope, effectiveSingleScopeSlug, selectedTagsCacheKey],
  );

  useEffect(() => {
    setAiInterpretation(null);
    setAiError(null);
    setAiLoading(false);
    setAiElapsedMs(0);
    aiStartedAtRef.current = null;
    aiRequestKeyRef.current = '';
  }, [aiCacheKey]);

  const demoCorpusEntries = demoCorpusData.entries;
  const relatedTags = isDemoCorpusContext ? demoCorpusData.relatedTags : questionData.relatedTags;
  const pickerTags = isDemoCorpusContext ? demoCorpusData.pickerTags : questionData.pickerTags;
  const sbtGroups = useMemo<SbtGroupSummary[]>(
    () =>
      isDemoCorpusContext
        ? []
        : collectSbtGroupData({
            selectedTags,
            scopeFilterMode: effectiveScopeState.filterMode,
            scopeSlugs: effectiveScopeSlugs,
            cacheVersion: sbtCacheVersion,
          }),
    [effectiveScopeState.filterMode, effectiveScopeSlugs, isDemoCorpusContext, sbtCacheVersion, selectedTags],
  );
  const groups = useMemo(
    () =>
      [...sbtGroups, ...workerGroups].sort((left, right) => {
        const nameCompare = left.name.localeCompare(right.name);
        return nameCompare !== 0 ? nameCompare : left.address.localeCompare(right.address);
      }),
    [sbtGroups, workerGroups],
  );
  const showQuestionLoadingState = !isDemoCorpusContext && !isQuestionCacheReady && !questions.length;
  const demoCorpusEmptyText = useMemo(() => buildDemoCorpusEmptyText(selectedTags), [selectedTags]);
  const titleText = useMemo(
    () => (selectedTags.length ? selectedTags.map((tag) => `#${tag}`).join(' + ') : 'Tag explorer'),
    [selectedTags],
  );

  const handleAddTag = (rawTag: string) => {
    const displayTag = String(rawTag || '').trim();
    const normalizedTag = normalizeTagList([displayTag])[0];
    if (!normalizedTag) return false;

    const alreadySelected = selectedTags.some((tag) => normalizeTagList([tag])[0] === normalizedTag);
    if (alreadySelected) {
      setTagPickerOpen(false);
      return false;
    }

    const nextTags = [...selectedTags, displayTag];
    if (hasSelectedTagsOverride) {
      if (typeof onSelectedTagsChange === 'function') {
        onSelectedTagsChange(nextTags);
      }
    } else {
      navigate(`${buildTagPagePath(nextTags)}${location.search || ''}`);
    }
    setTagPickerOpen(false);
    return true;
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const normalizedTarget = normalizeTagList([tagToRemove])[0];
    const remainingTags = selectedTags.filter((tag) => {
      const normalizedCurrent = normalizeTagList([tag])[0];
      return normalizedCurrent !== normalizedTarget;
    });

    if (hasSelectedTagsOverride) {
      if (typeof onSelectedTagsChange === 'function') {
        onSelectedTagsChange(remainingTags);
      }
      return;
    }

    navigate(`${buildTagPagePath(remainingTags)}${location.search || ''}`);
  };

  const handleSessionSelect = (slugIn: string) => {
    if (routePinned) return;
    setLocalSessionOverrideTouched(true);
    setLocalSessionOverrideSlug(normalizeSessionSlug(slugIn));
    setSessionSelectorOpen(false);
  };

  const resetSessionSelection = () => {
    setLocalSessionOverrideTouched(false);
    setLocalSessionOverrideSlug(null);
    setSessionSelectorOpen(false);
  };

  const handleSummarize = async ({ force = false } = {}) => {
    if (!questions.length || !hasSingleSessionScope) return;

    if (!force) {
      const cachedInterpretation = readTagAiCacheEntry(aiCacheRef.current, aiCacheKey);
      if (cachedInterpretation) {
        setAiInterpretation(cachedInterpretation);
        setAiError(null);
        return;
      }
    }

    setAiLoading(true);
    setAiElapsedMs(0);
    aiStartedAtRef.current = Date.now();
    setAiError(null);
    aiRequestKeyRef.current = aiCacheKey;

    const prompt = buildTagInterpretationPromptUntyped({ selectedTags, questions });

    try {
      const result = await callAI(prompt, { sessionSlug: effectiveSingleScopeSlug });
      if (aiRequestKeyRef.current !== aiCacheKey) return;

      const nextInterpretation = String(result || '').trim() || 'No interpretation generated.';
      writeTagAiCacheEntry(aiCacheRef.current, aiCacheKey, nextInterpretation);
      setAiInterpretation(nextInterpretation);
      setAiError(null);
    } catch (error) {
      console.error('TagPage: AI interpretation failed', error);
      if (aiRequestKeyRef.current !== aiCacheKey) return;
      setAiInterpretation(null);
      setAiError('Failed to generate interpretation. Please try again.');
    } finally {
      if (aiRequestKeyRef.current === aiCacheKey) {
        setAiLoading(false);
        aiStartedAtRef.current = null;
      }
    }
  };

  const renderSelectedTagPills = ({ hero = false }: { hero?: boolean } = {}) =>
    selectedTags.map((tag) => (
      <span key={tag} className={[styles.tagPill, hero ? styles.tagPillHero : ''].filter(Boolean).join(' ')}>
        <span className={styles.tagPillLabel}>#{tag}</span>
        <button
          type="button"
          className={[styles.tagPillRemove, hero ? styles.tagPillRemoveHero : ''].filter(Boolean).join(' ')}
          onClick={(event) => {
            event.stopPropagation();
            handleRemoveTag(tag);
          }}
          aria-label={`Remove ${tag} tag`}
        >
          ×
        </button>
      </span>
    ));

  const toggleDemoEntryExpanded = (entryKey: string) => {
    const normalizedKey = String(entryKey || '').trim();
    if (!normalizedKey) return;
    setExpandedDemoEntryKeys((prev) => ({
      ...prev,
      [normalizedKey]: !prev[normalizedKey],
    }));
  };

  return (
    <div className={[styles.page, embedded ? styles.pageEmbedded : ''].filter(Boolean).join(' ')}>
      <div className={[styles.shell, embedded ? styles.shellEmbedded : ''].filter(Boolean).join(' ')}>
        <header className={styles.header}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerLead}>
              {selectedTags.length ? (
                <h1 className={styles.titlePillHeading} data-testid="tag-page-title" aria-label={titleText}>
                  <span className={styles.titleTagRow}>{renderSelectedTagPills({ hero: true })}</span>
                </h1>
              ) : (
                <h1
                  className={[styles.title, embedded ? styles.titleEmbedded : ''].filter(Boolean).join(' ')}
                  data-testid="tag-page-title"
                >
                  {titleText}
                </h1>
              )}
            </div>
            {!embedded || !hideEmbeddedSessionSelector ? (
              <div className={[styles.headerMeta, embedded ? styles.headerMetaEmbedded : ''].filter(Boolean).join(' ')}>
                <div className={styles.scopeMeta}>
                  {!isDemoCorpusContext ? (
                    <div className={styles.scopeBadge} data-testid="tag-page-session-scope" title={scopeSummary.title}>
                      {scopeSummary.label}
                    </div>
                  ) : null}
                  <div
                    className={[
                      styles.sessionSelectorTriggerRow,
                      sessionSelectorOpen ? styles.sessionSelectorTriggerRowOpen : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    data-testid="ce-tag-page-session-selector"
                    data-session-selector-open={sessionSelectorOpen ? 'true' : 'false'}
                  >
                    {sessionSelectorOpen ? (
                      <button
                        type="button"
                        className={styles.sessionSelectorBackdrop}
                        aria-label="Close tag page session selector"
                        data-testid="ce-tag-page-session-selector-backdrop"
                        onClick={() => setSessionSelectorOpen(false)}
                      />
                    ) : null}
                    <button
                      type="button"
                      className={styles.sessionSelectorToggle}
                      aria-label="Tag page session selector"
                      aria-expanded={sessionSelectorOpen}
                      data-testid="ce-tag-page-session-selector-toggle"
                      onClick={() => setSessionSelectorOpen((prev) => !prev)}
                    >
                      <FontAwesomeIcon icon={faCog} />
                    </button>
                    {sessionSelectorOpen ? (
                      <div className={styles.sessionSelectorPopover} data-testid="ce-tag-page-session-selector-panel">
                        <div className={styles.sessionSelectorPopoverHeader}>
                          <div className={styles.sessionSelectorHint}>
                            {isDemoCorpusContext
                              ? 'Demo corpus mode uses the demo corpus records currently loaded in this view instead of session-scoped questions.'
                              : sessionSelectorHint}
                          </div>
                          {!isDemoCorpusContext && !routePinned && localSessionOverrideTouched ? (
                            <button
                              type="button"
                              className={styles.sessionSelectorReset}
                              data-testid="ce-tag-page-session-selector-reset"
                              onClick={resetSessionSelection}
                            >
                              Use global default
                            </button>
                          ) : null}
                        </div>
                        {isDemoCorpusContext ? (
                          <div className={styles.sessionSelectorInfoCard} data-testid="ce-tag-page-demo-session-info">
                            <div className={styles.sessionSelectorInfoLabel}>Hidden session scope</div>
                            <div className={styles.sessionSelectorInfoValue}>{scopeSummary.label}</div>
                          </div>
                        ) : (
                          <SessionChipSelector
                            options={sessionSelectorOptions.map((option) => ({
                              ...option,
                              disabled: routePinned,
                            }))}
                            onToggle={handleSessionSelect}
                          />
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className={styles.headerControls}>
            <div className={[styles.tagPicker, embedded ? styles.tagPickerEmbedded : ''].filter(Boolean).join(' ')}>
              <button
                type="button"
                className={styles.addTagButton}
                aria-label="Add tag to comparison"
                aria-expanded={tagPickerOpen}
                aria-haspopup="dialog"
                onClick={() => setTagPickerOpen((prev) => !prev)}
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Add tag</span>
              </button>
              {tagPickerOpen && (
                <div className={styles.tagPickerPopover} role="dialog" aria-label="Add tag to comparison">
                  <div className={styles.tagPickerTitle}>Select another tag to compare</div>
                  {pickerTags.length > 0 ? (
                    <div className={styles.relatedTagsList}>
                      {pickerTags.slice(0, 32).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className={styles.relatedTagButton}
                          onClick={() => handleAddTag(tag)}
                          aria-label={`Add ${tag} tag to comparison`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.tagPickerEmpty}>
                      {demoCorpusMode
                        ? 'No additional tags available in this demo corpus yet.'
                        : 'No additional tags available in this session scope yet.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          {relatedTags.length > 0 && (
            <div className={styles.relatedTagsRow}>
              <span className={styles.relatedTagsLabel}>Related tags in this result set</span>
              <div className={styles.relatedTagsList}>
                {relatedTags.slice(0, 6).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={styles.relatedTagButton}
                    onClick={() => handleAddTag(tag)}
                    aria-label={`Add ${tag} tag to comparison`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        {isDemoCorpusContext ? (
          <section className={styles.section} data-testid="ce-tag-page-demo-corpus">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Demo corpus</h2>
              <span className={styles.sectionMeta}>{demoCorpusEntries.length}</span>
            </div>
            {demoCorpusEntries.length ? (
              <div className={styles.demoCorpusList}>
                {demoCorpusEntries.map((entry) => (
                  <article key={entry.key} className={styles.demoCorpusCard}>
                    <div className={styles.demoCorpusCardTopRow}>
                      <span className={styles.demoCorpusBadge}>{entry.corpusLabel}</span>
                      {entry.metaLine ? <span className={styles.demoCorpusMeta}>{entry.metaLine}</span> : null}
                    </div>
                    <div className={styles.demoCorpusTitleRow}>
                      <h3 className={styles.demoCorpusTitle}>{entry.title}</h3>
                      {entry.corpusKey === 'tweets' && entry.summary ? (
                        <button
                          type="button"
                          className={styles.demoCorpusExpandButton}
                          aria-label={`${expandedDemoEntryKeys[entry.key] ? 'Collapse' : 'Expand'} ${entry.title}`}
                          aria-expanded={!!expandedDemoEntryKeys[entry.key]}
                          onClick={() => toggleDemoEntryExpanded(entry.key)}
                        >
                          <FontAwesomeIcon icon={expandedDemoEntryKeys[entry.key] ? faCaretUp : faCaretDown} />
                        </button>
                      ) : null}
                    </div>
                    {entry.summary && (entry.corpusKey !== 'tweets' || expandedDemoEntryKeys[entry.key]) ? (
                      <p className={styles.demoCorpusSummary}>{entry.summary}</p>
                    ) : null}
                    <div className={styles.demoCorpusFooter}>
                      {entry.url && entry.corpusKey !== 'tweets' ? (
                        <a href={entry.url} className={styles.demoCorpusLink} target="_blank" rel="noopener noreferrer">
                          View source
                        </a>
                      ) : null}
                      {entry.tags.length ? (
                        <div className={styles.demoCorpusTagList}>
                          {buildVisibleDemoCorpusTags({
                            entryTags: entry.tags,
                            normalizedSelectedTags,
                          }).map((tag) => {
                            const isSelectedTag = normalizedSelectedTags.includes(normalizeTagList([tag])[0]);
                            return (
                              <span
                                key={`${entry.key}-${tag}`}
                                className={[styles.demoCorpusTag, isSelectedTag ? styles.demoCorpusTagSelected : '']
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                #{tag}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                      {entry.url && entry.corpusKey === 'tweets' ? (
                        <a
                          href={entry.url}
                          className={styles.demoCorpusLinkIcon}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="View source"
                          title="View source"
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyState}>{demoCorpusEmptyText}</p>
            )}
          </section>
        ) : (
          <>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Questions</h2>
                <span className={styles.sectionMeta}>{questions.length}</span>
              </div>
              {questions.length ? (
                <div className={styles.questionList}>
                  {questions.map((question) => (
                    <div
                      key={`${question.sessionSlug || 'global'}-${question.networkId}-${question.id}`}
                      className={styles.questionCardShell}
                    >
                      <SingleQuestionResponse
                        question={question}
                        response={null}
                        isOwnResponse={false}
                        mode="mini"
                        showImportance={false}
                        onDecryptQuestion={() => {}}
                        questionOnly={true}
                        network={{
                          ...(network && typeof network === 'object' ? network : {}),
                          id: question.networkId || network?.id || '',
                          chainId: question.networkId || network?.chainId || '',
                        }}
                        sessionSlug={effectiveSingleScopeSlug || question.sessionSlug || ''}
                        questionsCacheNonce={cacheVersion}
                        questionResponsesNonce={questionResponsesNonce}
                      />
                      <div className={styles.questionMeta}>
                        {question.responseCount} {question.responseCount === 1 ? 'response' : 'responses'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : showQuestionLoadingState ? (
                <p className={styles.emptyState} role="status" aria-live="polite">
                  Loading questions...
                </p>
              ) : (
                <p className={styles.emptyState}>{emptyQuestionsText}</p>
              )}
            </section>

            <section className={styles.section} data-testid={E2E_TESTIDS.TAG_GROUPS_SECTION}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Groups</h2>
                <span className={styles.sectionMeta}>{groups.length}</span>
              </div>
              {groups.length ? (
                <div className={styles.sbtGroupList}>
                  {groups.map((group) => (
                    <a
                      key={`${group.kind}-${group.sessionSlug || 'general'}-${group.networkId}-${group.address}`}
                      href={group.href}
                      className={styles.sbtGroupCard}
                    >
                      {group.image ? <img src={group.image} alt="" className={styles.sbtGroupImage} /> : null}
                      <div>
                        <div className={styles.sbtGroupName}>{group.name}</div>
                        {group.tags.length ? (
                          <div className={styles.sbtGroupTags}>
                            {group.tags.map((tag) => (
                              <span key={`${group.address}-${tag}`} className={styles.sbtGroupTagMini}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </a>
                  ))}
                </div>
              ) : workerGroupsLoading ? (
                <p className={styles.emptyState} role="status">Loading groups...</p>
              ) : (
                <p className={styles.emptyState}>No groups found with these tags.</p>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>AI Interpretation</h2>
              </div>
              {aiLoading ? (
                <p className={styles.aiLoadingText} role="status" aria-live="polite">
                  Generating interpretation... {(aiElapsedMs / 1000).toFixed(1)}s
                </p>
              ) : aiError ? (
                <div>
                  <div className={styles.aiError}>{aiError}</div>
                  <button
                    type="button"
                    className={styles.summarizeButton}
                    onClick={() => handleSummarize({ force: true })}
                  >
                    Try again
                  </button>
                </div>
              ) : aiInterpretation ? (
                <div>
                  <div className={styles.aiContent}>{aiInterpretation}</div>
                  <button
                    type="button"
                    className={styles.regenerateButton}
                    onClick={() => handleSummarize({ force: true })}
                  >
                    Regenerate
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.summarizeButton}
                  disabled={!questions.length || !hasSingleSessionScope}
                  title={!hasSingleSessionScope ? 'Select a single session to enable AI interpretation' : undefined}
                  onClick={() => handleSummarize()}
                >
                  Summarize discussions
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

const mapStateToProps = (
  state: RootState,
): Pick<TagPageViewProps, 'account' | 'network' | 'provider' | 'sessionState'> => ({
  account: state?.profile?.account || '',
  network: (state?.profile?.network || null) as NetworkLike,
  provider: state?.profile?.provider || null,
  sessionState: (state?.sessionState || {}) as SessionSelectionState,
});

export default connect(mapStateToProps)(TagPageView);
