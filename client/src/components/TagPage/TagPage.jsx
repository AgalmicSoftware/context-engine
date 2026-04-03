import React, { useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { listNamespaceEntriesSync, subscribeCacheUpdates } from '../../utilities/cache/cacheScripts.js';
import { callAI } from '../../utilities/ai/aiScripts.js';
import { normalizeTagList } from '../../utilities/defaultTags.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  getAllSessionSlugs,
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug as getStrictSessionConfigBySlug,
} from '../../utilities/web3/contractScripts.js';
import { SESSION_REGISTRY_CACHE_UPDATED_EVENT } from '../../utilities/web3/sessionRegistry.js';
import { normalizeGlobalSessionSelection } from '../../utilities/session/globalSessionState.js';
import { parseQuestionSessionSlugFromSearch } from '../../utilities/survey/questionRouting.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import SingleQuestionResponse from '../SurveyTool/SingleQuestionResponse.jsx';
import SessionChipSelector from '../Shared/SessionChipSelector.jsx';
import {
  buildTagPagePath,
  getQuestionTagDisplayList,
} from '../SurveyTool/QuestionTagDropdown.jsx';
import styles from './TagPage.module.scss';

const parseTagPath = (pathname = '') => {
  const rawSegment = (String(pathname || '').split('/tag/')[1] || '').replace(/\/+$/, '');
  if (!rawSegment) return [];

  const decodedSegments = rawSegment
    .split('+')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch (_) {
        return segment;
      }
    });

  return getQuestionTagDisplayList(decodedSegments);
};

const dedupeSessionSlugs = (values = []) => {
  const seen = new Set();
  const out = [];
  (Array.isArray(values) ? values : [values]).forEach((value) => {
    const normalized = normalizeSessionSlug(value);
    if (normalized == null || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

const buildSessionScopeLabel = (slugIn = '') => {
  const slug = normalizeSessionSlug(slugIn);
  if (!slug) return 'General';
  const cfg = (
    getStrictSessionConfigBySlug(slug) ||
    getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }) ||
    {}
  );
  const sessionName = String(cfg?.sessionName || '').trim();
  return sessionName && sessionName.toLowerCase() !== slug.toLowerCase()
    ? `${sessionName} (${slug})`
    : (sessionName || slug);
};

const buildGlobalTagPageScope = (selection = {}) => {
  const scopeMode = String(selection?.selectedSessionScope || '').trim().toLowerCase() || 'active';
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

const describeScopeSummary = ({
  filterMode = 'all',
  scopeSlugs = [],
  routePinned = false,
  localOverrideTouched = false,
} = {}) => {
  const normalizedScopeSlugs = dedupeSessionSlugs(scopeSlugs);
  let labelCore = 'all sessions';
  let title = 'Showing questions from all sessions.';

  if (filterMode === 'set') {
    if (!normalizedScopeSlugs.length) {
      labelCore = 'no sessions selected';
      title = 'The current session scope does not include any sessions.';
    } else if (normalizedScopeSlugs.length === 1) {
      labelCore = buildSessionScopeLabel(normalizedScopeSlugs[0]);
      title = `Showing questions from ${labelCore}.`;
    } else if (normalizedScopeSlugs.length <= 2) {
      const labels = normalizedScopeSlugs.map((slug) => buildSessionScopeLabel(slug));
      labelCore = labels.join(' + ');
      title = `Showing questions from ${labels.join(', ')}.`;
    } else {
      const labels = normalizedScopeSlugs.map((slug) => buildSessionScopeLabel(slug));
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
} = {}) => {
  if (routePinned) return 'This tag page is pinned to a specific session from the URL.';
  if (localOverrideTouched) return 'Using a local Tag explorer override.';

  const scopeMode = String(globalSelection?.selectedSessionScope || '').trim().toLowerCase();
  if (scopeMode === 'all') return 'Using the global all-sessions scope by default.';
  if (scopeMode === 'list') return 'Using the global session list by default.';
  if (scopeMode === 'general') return 'Using the global general-session scope by default.';
  return 'Using the global primary session by default.';
};

const buildTagPageSessionSelectorOptions = ({
  selectedSlug = null,
  primarySlug = '',
  scopedSlugs = [],
} = {}) => {
  const options = new Map();
  const pushOption = (slugIn = '') => {
    const slug = normalizeSessionSlug(slugIn);
    if (options.has(slug)) return;
    options.set(slug, {
      key: `tagpage-session-${slug || 'general'}`,
      slug,
      label: buildSessionScopeLabel(slug),
      selected: selectedSlug !== null && slug === selectedSlug,
      general: slug === '',
      primary: slug === normalizeSessionSlug(primarySlug),
      chipTestId: `ce-tag-page-session-chip-${slug || 'general'}`,
    });
  };

  if (selectedSlug !== null) pushOption(selectedSlug);
  pushOption(primarySlug);
  scopedSlugs.forEach(pushOption);
  (getAllSessionSlugs({ includeEmpty: true }) || []).forEach(pushOption);

  return Array.from(options.values());
};

const collectTagPageData = ({
  selectedTags,
  scopeFilterMode = 'all',
  scopeSlugs = [],
}) => {
  const normalizedSelectedTags = normalizeTagList(selectedTags);
  if (!normalizedSelectedTags.length) return { questions: [], relatedTags: [], pickerTags: [] };

  const entries = listNamespaceEntriesSync('questionsCache', { cloneValues: false });
  const normalizedScopeSlugs = dedupeSessionSlugs(scopeSlugs);
  const scopeFilterEnabled = scopeFilterMode === 'set';
  const scopeSlugSet = scopeFilterEnabled ? new Set(normalizedScopeSlugs) : null;
  const scopedEntries = scopeFilterEnabled
    ? entries.filter((entry) => scopeSlugSet.has(normalizeSessionSlug(entry?.slug)))
    : entries;

  const questions = [];
  const seen = new Set();
  const relatedCounts = new Map();
  const relatedDisplay = new Map();
  const pickerCounts = new Map();
  const pickerDisplay = new Map();

  scopedEntries.forEach((entry) => {
    const sessionSlug = normalizeSessionSlug(entry?.slug || '');
    const cacheValue = entry?.value && typeof entry.value === 'object' ? entry.value : {};

    Object.entries(cacheValue).forEach(([networkId, networkBucket]) => {
      const questionsById = networkBucket?.questions && typeof networkBucket.questions === 'object'
        ? networkBucket.questions
        : {};
      const responsesById = networkBucket?.questionResponses && typeof networkBucket.questionResponses === 'object'
        ? networkBucket.questionResponses
        : {};

      Object.entries(questionsById).forEach(([questionId, question]) => {
        const resolvedQuestionId = String(question?.id || questionId || '').trim().toLowerCase();
        if (!resolvedQuestionId) return;

        const questionTags = getQuestionTagDisplayList(question?.tags);
        const normalizedQuestionTags = normalizeTagList(questionTags);
        const hasAllSelectedTags = normalizedSelectedTags.every((tag) => normalizedQuestionTags.includes(tag));

        if (!hasAllSelectedTags) return;

        const dedupeKey = `${sessionSlug}::${networkId}::${resolvedQuestionId}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const questionSeenRelated = new Set();
        const questionSeenPicker = new Set();
        questionTags.forEach((tag) => {
          const normalizedTag = normalizeTagList([tag])[0];
          if (!normalizedTag || normalizedSelectedTags.includes(normalizedTag) || questionSeenRelated.has(normalizedTag)) return;
          questionSeenRelated.add(normalizedTag);
          relatedDisplay.set(normalizedTag, String(tag || '').trim() || normalizedTag);
          relatedCounts.set(normalizedTag, (relatedCounts.get(normalizedTag) || 0) + 1);
        });
        questionTags.forEach((tag) => {
          const normalizedTag = normalizeTagList([tag])[0];
          if (!normalizedTag || normalizedSelectedTags.includes(normalizedTag) || questionSeenPicker.has(normalizedTag)) return;
          questionSeenPicker.add(normalizedTag);
          pickerDisplay.set(normalizedTag, String(tag || '').trim() || normalizedTag);
          pickerCounts.set(normalizedTag, (pickerCounts.get(normalizedTag) || 0) + 1);
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

  const relatedTags = Array.from(relatedCounts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      const leftLabel = relatedDisplay.get(left[0]) || left[0];
      const rightLabel = relatedDisplay.get(right[0]) || right[0];
      return leftLabel.localeCompare(rightLabel);
    })
    .map(([normalizedTag]) => relatedDisplay.get(normalizedTag) || normalizedTag);

  const pickerTags = Array.from(pickerCounts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      const leftLabel = pickerDisplay.get(left[0]) || left[0];
      const rightLabel = pickerDisplay.get(right[0]) || right[0];
      return leftLabel.localeCompare(rightLabel);
    })
    .map(([normalizedTag]) => pickerDisplay.get(normalizedTag) || normalizedTag);

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
}) => {
  const normalizedSelectedTags = normalizeTagList(selectedTags);
  void cacheVersion;
  if (!normalizedSelectedTags.length) return [];

  let entries = [];
  try {
    entries = listNamespaceEntriesSync('sbtCache', { cloneValues: false });
  } catch (_) {
    return [];
  }

  const normalizedScopeSlugs = dedupeSessionSlugs(scopeSlugs);
  const scopeFilterEnabled = scopeFilterMode === 'set';
  const scopeSlugSet = scopeFilterEnabled ? new Set(normalizedScopeSlugs) : null;
  const scopedEntries = scopeFilterEnabled
    ? entries.filter((entry) => scopeSlugSet.has(normalizeSessionSlug(entry?.slug)))
    : entries;
  const seen = new Set();
  const sbtGroups = [];

  scopedEntries.forEach((entry) => {
    const sessionSlug = normalizeSessionSlug(entry?.slug || '');
    const cacheValue = entry?.value && typeof entry.value === 'object' ? entry.value : {};

    Object.entries(cacheValue).forEach(([networkId, networkBucket]) => {
      const sbtList = networkBucket?.sbtList && typeof networkBucket.sbtList === 'object'
        ? networkBucket.sbtList
        : {};

      Object.entries(sbtList).forEach(([cacheAddress, sbtEntry]) => {
        const resolvedEntry = sbtEntry && typeof sbtEntry === 'object' ? sbtEntry : {};
        const sbtInfo = resolvedEntry?.sbtInfo && typeof resolvedEntry.sbtInfo === 'object'
          ? resolvedEntry.sbtInfo
          : {};
        if (sbtInfo?.private === true) return;

        const rawTags = Array.isArray(sbtInfo?.tags) ? sbtInfo.tags : [];
        const displayTags = [];
        const normalizedGroupTags = [];
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
          address,
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
  isQuestionCacheReady = true,
  network = null,
  questionResponsesNonce = 0,
  sessionState = {},
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [cacheVersion, setCacheVersion] = useState(0);
  const [sbtCacheVersion, setSbtCacheVersion] = useState(0);
  const [sessionRegistryRevision, setSessionRegistryRevision] = useState(0);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [sessionSelectorOpen, setSessionSelectorOpen] = useState(false);
  const [localSessionOverrideTouched, setLocalSessionOverrideTouched] = useState(false);
  const [localSessionOverrideSlug, setLocalSessionOverrideSlug] = useState(null);
  const [aiInterpretation, setAiInterpretation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const aiCacheRef = useRef(new Map());
  const aiRequestKeyRef = useRef('');

  useEffect(() => {
    const unsubscribe = subscribeCacheUpdates((payload = {}) => {
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
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return undefined;
    }

    const handleRegistryCacheUpdated = () => {
      setSessionRegistryRevision((value) => value + 1);
    };

    window.addEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, handleRegistryCacheUpdated);
    return () => {
      window.removeEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, handleRegistryCacheUpdated);
    };
  }, []);

  useEffect(() => {
    setTagPickerOpen(false);
    setSessionSelectorOpen(false);
  }, [location.pathname, location.search]);

  const selectedTags = useMemo(
    () => parseTagPath(location.pathname),
    [location.pathname]
  );
  const normalizedSelectedTags = useMemo(
    () => normalizeTagList(selectedTags),
    [selectedTags]
  );
  const selectedTagsCacheKey = useMemo(
    () => normalizedSelectedTags.slice().sort((left, right) => left.localeCompare(right)).join('||'),
    [normalizedSelectedTags]
  );

  const queryPinnedScopeSlug = useMemo(() => (
    parseQuestionSessionSlugFromSearch(location.search)
  ), [location.search]);
  const routePinned = queryPinnedScopeSlug !== null;
  const globalSessionSelection = useMemo(
    () => normalizeGlobalSessionSelection(sessionState || {}),
    [sessionState]
  );
  const globalScopeState = useMemo(
    () => buildGlobalTagPageScope(globalSessionSelection),
    [globalSessionSelection]
  );
  const normalizedLocalOverrideSlug = useMemo(
    () => normalizeSessionSlug(localSessionOverrideSlug),
    [localSessionOverrideSlug]
  );
  const effectiveScopeState = useMemo(() => {
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
  }, [
    globalScopeState,
    localSessionOverrideTouched,
    normalizedLocalOverrideSlug,
    queryPinnedScopeSlug,
    routePinned,
  ]);
  const effectiveScopeSlugs = useMemo(
    () => (Array.isArray(effectiveScopeState.scopeSlugs) ? effectiveScopeState.scopeSlugs : []),
    [effectiveScopeState.scopeSlugs]
  );
  const effectiveScopeCacheKey = useMemo(
    () => [
      effectiveScopeState.filterMode,
      ...effectiveScopeSlugs,
    ].join('||'),
    [effectiveScopeState.filterMode, effectiveScopeSlugs]
  );
  const effectiveSingleScopeSlug = (
    effectiveScopeState.filterMode === 'set' && effectiveScopeSlugs.length === 1
      ? effectiveScopeSlugs[0]
      : ''
  );
  const hasSingleSessionScope = (
    effectiveScopeState.filterMode === 'set' && effectiveScopeSlugs.length === 1
  );
  const aiCacheKey = useMemo(() => [
    selectedTagsCacheKey,
    effectiveSingleScopeSlug || effectiveScopeCacheKey,
    String(cacheVersion || 0),
    String(questionResponsesNonce || 0),
  ].join('::'), [
    cacheVersion,
    effectiveScopeCacheKey,
    effectiveSingleScopeSlug,
    questionResponsesNonce,
    selectedTagsCacheKey,
  ]);
  const scopeSummary = useMemo(() => describeScopeSummary({
    filterMode: effectiveScopeState.filterMode,
    scopeSlugs: effectiveScopeSlugs,
    routePinned,
    localOverrideTouched: localSessionOverrideTouched,
    sessionRegistryRevision,
  }), [
    effectiveScopeState.filterMode,
    effectiveScopeSlugs,
    localSessionOverrideTouched,
    routePinned,
    sessionRegistryRevision,
  ]);
  const sessionSelectorHint = useMemo(() => buildTagPageSelectorHint({
    routePinned,
    localOverrideTouched: localSessionOverrideTouched,
    globalSelection: globalSessionSelection,
  }), [
    globalSessionSelection,
    localSessionOverrideTouched,
    routePinned,
  ]);
  const selectedSessionSelectorSlug = routePinned
    ? normalizeSessionSlug(queryPinnedScopeSlug)
    : (localSessionOverrideTouched ? normalizedLocalOverrideSlug : null);
  const sessionSelectorOptions = useMemo(() => buildTagPageSessionSelectorOptions({
    selectedSlug: selectedSessionSelectorSlug,
    primarySlug: globalSessionSelection.primarySessionSlug || '',
    scopedSlugs: effectiveScopeSlugs,
    sessionRegistryRevision,
  }), [
    effectiveScopeSlugs,
    globalSessionSelection.primarySessionSlug,
    sessionRegistryRevision,
    selectedSessionSelectorSlug,
  ]);

  useEffect(() => {
    if (!routePinned) return;
    setLocalSessionOverrideTouched(false);
    setLocalSessionOverrideSlug(null);
  }, [location.search, routePinned]);

  useEffect(() => {
    setAiInterpretation(null);
    setAiError(null);
    setAiLoading(false);
    aiRequestKeyRef.current = '';
  }, [selectedTagsCacheKey]);

  useEffect(() => {
    setAiInterpretation(null);
    setAiError(null);
    setAiLoading(false);
    aiRequestKeyRef.current = '';
  }, [effectiveScopeCacheKey]);

  useEffect(() => {
    setAiInterpretation(null);
    setAiError(null);
    setAiLoading(false);
    aiRequestKeyRef.current = '';
  }, [cacheVersion, questionResponsesNonce]);

  // NOTE: Full cache scan on each update. Acceptable for current scale; add slug-indexed cache if this becomes a bottleneck.
  const { questions, relatedTags, pickerTags } = useMemo(
    () => collectTagPageData({
      selectedTags,
      scopeFilterMode: effectiveScopeState.filterMode,
      scopeSlugs: effectiveScopeSlugs,
      cacheVersion,
      questionResponsesNonce,
    }),
    [cacheVersion, effectiveScopeState.filterMode, effectiveScopeSlugs, questionResponsesNonce, selectedTags]
  );
  const sbtGroups = useMemo(
    () => collectSbtGroupData({
      selectedTags,
      scopeFilterMode: effectiveScopeState.filterMode,
      scopeSlugs: effectiveScopeSlugs,
      cacheVersion: sbtCacheVersion,
    }),
    [effectiveScopeState.filterMode, effectiveScopeSlugs, sbtCacheVersion, selectedTags]
  );
  const showQuestionLoadingState = !isQuestionCacheReady && !questions.length;

  const handleAddTag = (rawTag) => {
    const displayTag = String(rawTag || '').trim();
    const normalizedTag = normalizeTagList([displayTag])[0];
    if (!normalizedTag) return false;

    const alreadySelected = selectedTags.some((tag) => normalizeTagList([tag])[0] === normalizedTag);
    if (alreadySelected) {
      setTagPickerOpen(false);
      return false;
    }

    navigate(`${buildTagPagePath([...selectedTags, displayTag])}${location.search || ''}`);
    setTagPickerOpen(false);
    return true;
  };

  const handleRemoveTag = (tagToRemove) => {
    const normalizedTarget = normalizeTagList([tagToRemove])[0];
    const remainingTags = selectedTags.filter((tag) => {
      const normalizedCurrent = normalizeTagList([tag])[0];
      return normalizedCurrent !== normalizedTarget;
    });

    navigate(`${buildTagPagePath(remainingTags)}${location.search || ''}`);
  };

  const handleSessionSelect = (slugIn) => {
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
      const cachedInterpretation = aiCacheRef.current.get(aiCacheKey);
      if (cachedInterpretation) {
        setAiInterpretation(cachedInterpretation);
        setAiError(null);
        return;
      }
    }

    setAiLoading(true);
    setAiError(null);
    aiRequestKeyRef.current = aiCacheKey;

    const prompt = [
      `Analyze these questions tagged with ${selectedTags.join(', ')}. For each, the prompt and response count are given. Provide: 1) Key themes, 2) Areas of consensus, 3) Points of disagreement, 4) Suggested follow-up questions. Be concise.`,
      '',
      ...questions.slice(0, 20).map((question) => (
        `Q: ${question.prompt} (${question.responseCount} ${question.responseCount === 1 ? 'response' : 'responses'})`
      )),
    ].join('\n');

    try {
      const result = await callAI(prompt, { sessionSlug: effectiveSingleScopeSlug });
      if (aiRequestKeyRef.current !== aiCacheKey) return;

      const nextInterpretation = String(result || '').trim() || 'No interpretation generated.';
      aiCacheRef.current.set(aiCacheKey, nextInterpretation);
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
      }
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerLead}>
              <p className={styles.eyebrow}>Tag explorer</p>
              <h1 className={styles.title}>Questions tagged with</h1>
            </div>
            <div className={styles.headerMeta}>
              <div className={styles.scopeMeta}>
                <div
                  className={styles.scopeBadge}
                  data-testid="tag-page-session-scope"
                  title={scopeSummary.title}
                >
                  {scopeSummary.label}
                </div>
                <div
                  className={[
                    styles.sessionSelectorTriggerRow,
                    sessionSelectorOpen ? styles.sessionSelectorTriggerRowOpen : '',
                  ].filter(Boolean).join(' ')}
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
                    <div
                      className={styles.sessionSelectorPopover}
                      data-testid="ce-tag-page-session-selector-panel"
                    >
                      <div className={styles.sessionSelectorPopoverHeader}>
                        <div className={styles.sessionSelectorHint}>{sessionSelectorHint}</div>
                        {!routePinned && localSessionOverrideTouched ? (
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
                      <SessionChipSelector
                        options={sessionSelectorOptions.map((option) => ({
                          ...option,
                          disabled: routePinned,
                        }))}
                        onToggle={handleSessionSelect}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.headerControls}>
            <div className={styles.tagRow}>
              {selectedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={styles.tagPill}
                  onClick={() => handleRemoveTag(tag)}
                  aria-label={`Remove ${tag} tag`}
                >
                  <span>#{tag}</span>
                  <span className={styles.tagPillRemove}>x</span>
                </button>
              ))}
            </div>
            <div className={styles.tagPicker}>
              <button
                type="button"
                className={styles.addTagButton}
                aria-expanded={tagPickerOpen}
                aria-haspopup="dialog"
                onClick={() => setTagPickerOpen((prev) => !prev)}
              >
                Add tag to comparison
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
                    <p className={styles.tagPickerEmpty}>No related tags available for this comparison yet.</p>
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
            <p className={styles.emptyState}>No questions found.</p>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>SBT Groups</h2>
            <span className={styles.sectionMeta}>{sbtGroups.length}</span>
          </div>
          {sbtGroups.length ? (
            <div className={styles.sbtGroupList}>
              {sbtGroups.map((group) => (
                <a
                  key={`${group.sessionSlug || 'general'}-${group.networkId}-${group.address}`}
                  href={buildSbtDetailPath(group.address, group.sessionSlug)}
                  className={styles.sbtGroupCard}
                >
                  {group.image ? (
                    <img
                      src={group.image}
                      alt=""
                      className={styles.sbtGroupImage}
                    />
                  ) : null}
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
          ) : (
            <p className={styles.emptyState}>No SBT groups found with these tags.</p>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>AI Interpretation</h2>
          </div>
          {aiLoading ? (
            <p className={styles.aiLoadingText} role="status" aria-live="polite">
              Generating interpretation...
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
      </div>
    </div>
  );
};

const mapStateToProps = (state) => ({
  network: state?.profile?.network || null,
  sessionState: state?.sessionState || {},
});

export default connect(mapStateToProps)(TagPageView);
