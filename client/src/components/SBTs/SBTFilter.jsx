/** @file SBTFilter.jsx */

import React from 'react';
import { FormGroup, Label, Input, Button } from 'reactstrap';
import styles from './SBTSelector.module.scss';
import SBTSelector from './SBTSelector.jsx';
import contractScripts, { getSessionChainId, getSessionSlugByName, normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import { resolveSbtDisplayLabel } from '../../utilities/sbt/sbtDisplayNames.js';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faSpinner, faTimes, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { createLogger } from '../../utilities/logging.js';
import { peekCacheSync, writeCache } from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';

const sbtLog = createLogger('sbt');
const QUICK_CHIP_GATE_COLORS = ['#5affc2', '#5b8cff', '#ffb347', '#ff6bcb', '#ffd166'];


/**
 * Helper to unify an aggregator or a question array with all known questions from questionsCache,
 * so zero-response or standalone questions won't get dropped.
 * The logic is used when mode indicates question-based filtering.
 */
const readQuestionsCacheBySlug = (slug) => peekCacheSync('questionsCache', slug || '', { clone: false }) || {};
const readSbtCacheBySlug = (slug) => peekCacheSync('sbtCache', slug || '', { clone: false }) || {};

const asCacheObject = (value) => ((value && typeof value === 'object') ? value : {});

const readQuestionsNetBucketBySlug = (slug, netKey) => (
  asCacheObject(asCacheObject(readQuestionsCacheBySlug(slug))[String(netKey || '')])
);

const normalizeIncomingFilterState = (state = {}) => ({
  selectedSBTGroupsCreator: Array.isArray(state.selectedSBTGroupsCreator) ? state.selectedSBTGroupsCreator : [],
  excludedSBTGroupsCreator: Array.isArray(state.excludedSBTGroupsCreator) ? state.excludedSBTGroupsCreator : [],
  selectedSBTGroupsResponder: Array.isArray(state.selectedSBTGroupsResponder) ? state.selectedSBTGroupsResponder : [],
  excludedSBTGroupsResponder: Array.isArray(state.excludedSBTGroupsResponder) ? state.excludedSBTGroupsResponder : [],
  selectedSBTGroups: Array.isArray(state.selectedSBTGroups) ? state.selectedSBTGroups : [],
  excludedSBTGroups: Array.isArray(state.excludedSBTGroups) ? state.excludedSBTGroups : [],
  onlyVerifiedHumans: !!state.onlyVerifiedHumans,
});

const buildSbtEntrySignature = (entry) => {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim().toLowerCase();
  if (typeof entry !== 'object') return String(entry || '').trim().toLowerCase();
  const addr = String(entry.address || entry.sbtAddress || '').trim().toLowerCase();
  const slug = String(entry.sessionSlug || entry.slug || entry.group || '').trim().toLowerCase();
  const chain = String(entry.chainId || entry.chainID || '').trim();
  return `${addr}|${slug}|${chain}`;
};

const buildSbtListSignature = (list) => (
  Array.isArray(list)
    ? list
      .map(buildSbtEntrySignature)
      .filter(Boolean)
      .sort()
      .join(',')
    : ''
);

const buildSbtFilterStateSignature = (state = {}) => {
  const normalized = normalizeIncomingFilterState(state);
  return [
    buildSbtListSignature(normalized.selectedSBTGroupsCreator),
    buildSbtListSignature(normalized.excludedSBTGroupsCreator),
    buildSbtListSignature(normalized.selectedSBTGroupsResponder),
    buildSbtListSignature(normalized.excludedSBTGroupsResponder),
    buildSbtListSignature(normalized.selectedSBTGroups),
    buildSbtListSignature(normalized.excludedSBTGroups),
    normalized.onlyVerifiedHumans ? '1' : '0',
  ].join('|');
};

const ITEMS_SOURCE_SIG_MAX_DEPTH = 2;
const ITEMS_SOURCE_SIG_HASH_SEED = 2166136261;
const ITEMS_SOURCE_OBJECT_MAX_DEPTH = 4;

const hashIdentityPart = (seed, value) => {
  const input = String(value || '');
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
};

const normalizeIdentityPrimitive = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return String(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'nan';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (Array.isArray(value)) return `arr:${value.length}`;
  if (typeof value === 'object') return `obj:${Object.keys(value).length}`;
  return String(value);
};

const normalizeCappedIdentityValue = (value, trail = new WeakSet()) => {
  if (value === undefined) return '__undefined__';
  if (value === null) return null;
  if (typeof value === 'string') return String(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 'nan';
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return `__bigint:${value.toString(10)}`;
  if (typeof value !== 'object') return String(value);
  if (trail.has(value)) return '__circular__';
  trail.add(value);
  if (Array.isArray(value)) {
    const normalizedArray = value.map((entry) => normalizeCappedIdentityValue(entry, trail));
    trail.delete(value);
    return normalizedArray;
  }
  const normalizedObject = {};
  const entries = Object.entries(value)
    .map(([key, nextValue]) => [String(key || '').trim().toLowerCase(), nextValue])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  entries.forEach(([key, nextValue]) => {
    normalizedObject[key] = normalizeCappedIdentityValue(nextValue, trail);
  });
  trail.delete(value);
  return normalizedObject;
};

const buildCappedNestedHash = (value) => {
  try {
    const normalized = normalizeCappedIdentityValue(value);
    return hashIdentityPart(ITEMS_SOURCE_SIG_HASH_SEED, JSON.stringify(normalized) || '');
  } catch (_) {
    return hashIdentityPart(ITEMS_SOURCE_SIG_HASH_SEED, String(value || ''));
  }
};

const buildNestedIdentitySignature = (value, depth = 0) => {
  if (value == null || typeof value !== 'object') {
    return `p:${normalizeIdentityPrimitive(value)}`;
  }

  if (depth >= ITEMS_SOURCE_OBJECT_MAX_DEPTH) {
    if (Array.isArray(value)) {
      return `a:${value.length}:${buildCappedNestedHash(value) >>> 0}`;
    }
    return `o:${Object.keys(value).length}:${buildCappedNestedHash(value) >>> 0}`;
  }

  if (Array.isArray(value)) {
    let hash = hashIdentityPart(ITEMS_SOURCE_SIG_HASH_SEED, `a:${value.length}`);
    value.forEach((entry, index) => {
      hash = hashIdentityPart(hash, String(index));
      hash = hashIdentityPart(hash, buildNestedIdentitySignature(entry, depth + 1));
    });
    return `a:${value.length}:${hash >>> 0}`;
  }

  const entries = Object.entries(value)
    .map(([key, nextValue]) => [String(key || '').trim().toLowerCase(), nextValue])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let hash = hashIdentityPart(ITEMS_SOURCE_SIG_HASH_SEED, `o:${entries.length}`);
  entries.forEach(([key, nextValue]) => {
    hash = hashIdentityPart(hash, key);
    hash = hashIdentityPart(hash, buildNestedIdentitySignature(nextValue, depth + 1));
  });
  return `o:${entries.length}:${hash >>> 0}`;
};

const buildEntryResponseIdentityPayload = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(entry, 'response')) {
    return entry.response;
  }

  const hasAnswerLikeFields = (
    Object.prototype.hasOwnProperty.call(entry, 'answer') ||
    Object.prototype.hasOwnProperty.call(entry, 'additional') ||
    Object.prototype.hasOwnProperty.call(entry, 'additionalComment') ||
    Object.prototype.hasOwnProperty.call(entry, 'additionalComments') ||
    Object.prototype.hasOwnProperty.call(entry, 'importance') ||
    Object.prototype.hasOwnProperty.call(entry, 'conviction')
  );
  if (hasAnswerLikeFields) {
    return {
      answer: Object.prototype.hasOwnProperty.call(entry, 'answer') ? entry.answer : null,
      additional: Object.prototype.hasOwnProperty.call(entry, 'additional')
        ? entry.additional
        : Object.prototype.hasOwnProperty.call(entry, 'additionalComment')
          ? entry.additionalComment
          : Object.prototype.hasOwnProperty.call(entry, 'additionalComments')
            ? entry.additionalComments
            : null,
      importance: Object.prototype.hasOwnProperty.call(entry, 'importance') ? entry.importance : null,
      conviction: Object.prototype.hasOwnProperty.call(entry, 'conviction') ? entry.conviction : null,
    };
  }

  if (Object.prototype.hasOwnProperty.call(entry, 'value')) {
    return entry.value;
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'responses')) {
    return entry.responses;
  }
  return null;
};

const buildEntryIdentityToken = (entry) => {
  if (entry == null || typeof entry !== 'object') return normalizeIdentityPrimitive(entry);
  const id = normalizeIdentityPrimitive(entry.id || entry.questionId || entry.questionID);
  const responder = normalizeIdentityPrimitive(entry.responder);
  const creator = normalizeIdentityPrimitive(entry.creator);
  const address = normalizeIdentityPrimitive(entry.address || entry.sbtAddress);
  const slug = normalizeIdentityPrimitive(entry.sessionSlug || entry.slug || entry.group);
  const chain = normalizeIdentityPrimitive(entry.chainId || entry.chainID);
  const timestamp = normalizeIdentityPrimitive(
    entry.timestamp ?? entry.timeStamp ?? ''
  );
  const responseLike = buildEntryResponseIdentityPayload(entry);
  const responseSig = buildNestedIdentitySignature(responseLike);
  const dense = [id, responder, creator, address, slug, chain, timestamp].filter(Boolean).join('|');
  if (dense) return `${dense}|${responseSig}`;

  const keys = Object.keys(entry).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const preview = keys
    .slice(0, 6)
    .map((key) => `${key}:${buildNestedIdentitySignature(entry[key])}`)
    .join(',');
  return `obj:${keys.length}:${preview}|${responseSig}`;
};

const buildAllIndexes = (size) => {
  const total = Math.max(0, Number(size) || 0);
  return Array.from({ length: total }, (_, i) => i);
};

const buildValueIdentitySignature = (value, depth = 0) => {
  if (value == null || typeof value !== 'object') {
    return `p:${normalizeIdentityPrimitive(value)}`;
  }

  if (depth >= ITEMS_SOURCE_SIG_MAX_DEPTH) {
    return `d:${buildEntryIdentityToken(value)}`;
  }

  if (Array.isArray(value)) {
    const indexes = buildAllIndexes(value.length);
    let hash = ITEMS_SOURCE_SIG_HASH_SEED;
    indexes.forEach((index) => {
      hash = hashIdentityPart(hash, String(index));
      hash = hashIdentityPart(hash, buildValueIdentitySignature(value[index], depth + 1));
    });
    return `a:${value.length}:${indexes.length}:${hash >>> 0}`;
  }

  const entries = Object.entries(value)
    .map(([key, nextValue]) => [String(key || '').trim().toLowerCase(), nextValue])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const indexes = buildAllIndexes(entries.length);
  let hash = ITEMS_SOURCE_SIG_HASH_SEED;
  indexes.forEach((idx) => {
    const [key, nextValue] = entries[idx];
    hash = hashIdentityPart(hash, key);
    hash = hashIdentityPart(hash, buildValueIdentitySignature(nextValue, depth + 1));
  });
  return `o:${entries.length}:${indexes.length}:${hash >>> 0}:${buildEntryIdentityToken(value)}`;
};

const buildItemsSourceSignature = (items) => buildValueIdentitySignature(items, 0);

const scheduleMicrotask = (cb) => {
  if (typeof cb !== 'function') return;
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(cb);
    return;
  }
  Promise.resolve().then(cb);
};

const HOLDER_SET_MEMO_MAX_ENTRIES = 500;

const normalizeAddressCountMap = (value = null) => {
  const out = {};
  Object.entries(value || {}).forEach(([addrRaw, countRaw]) => {
    const addr = String(addrRaw || '').toLowerCase();
    if (!addr) return;
    const count = Math.max(0, Math.floor(Number(countRaw || 0)));
    if (count <= 0) return;
    out[addr] = count;
  });
  return out;
};

const countMapFingerprint = (value = null) => {
  const entries = Object.entries(normalizeAddressCountMap(value))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (!entries.length) return 'nil';
  let hash = 0;
  entries.forEach(([addr, count]) => {
    const token = `${addr}:${count}`;
    for (let i = 0; i < token.length; i += 1) {
      hash = ((hash * 31) + token.charCodeAt(i)) | 0;
    }
    hash = ((hash * 131) + 1) | 0;
  });
  return `${entries.length}:${hash}`;
};

const buildHistorySummaryFromCounts = ({
  mintedCountByAddress = {},
  burnedCountByAddress = {},
  mintedEventCount = 0,
  burnedEventCount = 0,
} = {}) => {
  const mintedMap = normalizeAddressCountMap(mintedCountByAddress);
  const burnedMap = normalizeAddressCountMap(burnedCountByAddress);
  const sumCounts = (value = {}) => Object.values(value).reduce((sum, count) => (
    sum + Math.max(0, Math.floor(Number(count || 0)))
  ), 0);
  let activeSupply = 0;
  let currentHolderCount = 0;
  Object.keys(mintedMap).forEach((addr) => {
    const minted = Math.max(0, Math.floor(Number(mintedMap[addr] || 0)));
    const burned = Math.max(0, Math.floor(Number(burnedMap[addr] || 0)));
    const net = Math.max(0, minted - burned);
    if (net > 0) currentHolderCount += 1;
    activeSupply += net;
  });
  return {
    totalMinted: String(Math.max(0, Math.floor(Number(mintedEventCount || 0))) || sumCounts(mintedMap)),
    totalBurned: String(Math.max(0, Math.floor(Number(burnedEventCount || 0))) || sumCounts(burnedMap)),
    activeSupply: String(activeSupply),
    currentHolderCount: String(currentHolderCount),
    historicalHolderCount: String(Object.keys(mintedMap).length),
  };
};

const buildNetHoldersSet = (mintedAddresses = [], burnedAddresses = []) => {
  const burnedSet = new Set(
    (Array.isArray(burnedAddresses) ? burnedAddresses : []).map((addr) => String(addr || '').toLowerCase())
  );
  const holders = new Set();
  (Array.isArray(mintedAddresses) ? mintedAddresses : []).forEach((addr) => {
    const lower = String(addr || '').toLowerCase();
    if (!lower || burnedSet.has(lower)) return;
    holders.add(lower);
  });
  return holders;
};

const buildNetHoldersSetFromCounts = (mintedCountByAddress = {}, burnedCountByAddress = {}) => {
  const mintedMap = normalizeAddressCountMap(mintedCountByAddress);
  const burnedMap = normalizeAddressCountMap(burnedCountByAddress);
  const holders = new Set();
  Object.keys(mintedMap).forEach((addr) => {
    const minted = Math.max(0, Math.floor(Number(mintedMap[addr] || 0)));
    const burned = Math.max(0, Math.floor(Number(burnedMap[addr] || 0)));
    if ((minted - burned) > 0) {
      holders.add(addr);
    }
  });
  return holders;
};

function unifyAggregatorWithAllLocalQuestions(baseItems, networkID, mode, slug) {
  const netKey = String(networkID || '');
  if (!netKey) return baseItems;

  const questionNetCache = readQuestionsNetBucketBySlug(slug, netKey);
  if (!questionNetCache.questions) {
    return baseItems;
  }

  const allKnownQIDs = Object.keys(questionNetCache.questions || {});

  // If baseItems is an array of question objects, unify by adding missing from cache
  // OR if baseItems is an aggregator object => questionID => array of responses, unify likewise
  if (
    mode === 'creatorAndResponder' ||
    mode === 'creator' ||
    mode === 'questions' ||
    mode === 'questionResponses' ||
    mode === 'responder'
  ) {
    if (Array.isArray(baseItems)) {
      const existingIDs = new Set(baseItems.map((q) => (q.id || '').toLowerCase()));
      const newArray = [...baseItems];
      allKnownQIDs.forEach((qIdLower) => {
        if (!existingIDs.has(qIdLower)) {
          const qObj = questionNetCache.questions[qIdLower];
          if (qObj) newArray.push({ ...qObj });
        }
      });
      return newArray;
    } else if (typeof baseItems === 'object' && baseItems !== null) {
      const newObj = { ...baseItems };
      allKnownQIDs.forEach((qIdLower) => {
        if (!newObj[qIdLower]) {
          newObj[qIdLower] = [];
        }
      });
      return newObj;
    }
  }

  return baseItems;
}


class SBTFilter extends React.Component {
  constructor(props) {
    super(props);
    // We store all local filter states in one object. If parent passes `externalSBTFilterState`, restore them here.
    this.state = {
      selectedSBTGroupsCreator:
        (props.externalSBTFilterState && props.externalSBTFilterState.selectedSBTGroupsCreator) ||
        [],
      excludedSBTGroupsCreator:
        (props.externalSBTFilterState && props.externalSBTFilterState.excludedSBTGroupsCreator) ||
        [],
      selectedSBTGroupsResponder:
        (props.externalSBTFilterState && props.externalSBTFilterState.selectedSBTGroupsResponder) ||
        [],
      excludedSBTGroupsResponder:
        (props.externalSBTFilterState && props.externalSBTFilterState.excludedSBTGroupsResponder) ||
        [],
      selectedSBTGroups:
        (props.externalSBTFilterState && props.externalSBTFilterState.selectedSBTGroups) || [],
      excludedSBTGroups:
        (props.externalSBTFilterState && props.externalSBTFilterState.excludedSBTGroups) || [],
      onlyVerifiedHumans:
        (props.externalSBTFilterState && props.externalSBTFilterState.onlyVerifiedHumans) || false,
      showFilterOptions: props.autoExpand || false,
      loading: false,
      showAllSBTs: false,

      // Snapshot to compare so we don't re-apply identical filters over and over
      lastAppliedFilterSnapshot: null
    };
    this._isMounted = false;
    this._applyFilterScheduled = false;
    this._applyFilterRunSeq = 0;
    this._activeApplyFilterRunId = 0;
    this._lastScheduledApplyReason = '';
    this._holderSetMemo = new Map();
    this._holderSetInFlight = new Map();
    this._lastExternalFilterStateSignature = buildSbtFilterStateSignature(
      props.externalSBTFilterState || {}
    );
  }

  componentDidMount() {
    this._isMounted = true;
    // If there's an existing external state that implies active filters, apply them once on mount
    if (this.hasAnyFilterActive()) {
      this.scheduleApplyFilter('mount');
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    this._applyFilterScheduled = false;
    this._holderSetMemo.clear();
    this._holderSetInFlight.clear();
  }


  componentDidUpdate(prevProps, prevState) {
    // Determine readiness based on mode.
    const prevNeedsQuestionCache = (
      prevProps.mode === 'creator' ||
      prevProps.mode === 'creatorAndResponder' ||
      prevProps.mode === 'questions'
    );
    const prevSkipCacheGate = prevProps.mode === 'addresses';
    const wasDataReady = prevSkipCacheGate
      ? true
      : ((prevProps.isSBTCacheReady === true) &&
         (prevNeedsQuestionCache ? prevProps.isQuestionCacheReady === true : true));

    const currNeedsQuestionCache = (
      this.props.mode === 'creator' ||
      this.props.mode === 'creatorAndResponder' ||
      this.props.mode === 'questions'
    );
    const currSkipCacheGate = this.props.mode === 'addresses';
    const isDataReady = currSkipCacheGate
      ? true
      : ((this.props.isSBTCacheReady === true) &&
         (currNeedsQuestionCache ? this.props.isQuestionCacheReady === true : true));

    // If data just became ready and a filter is active, apply the filter.
    if (isDataReady && !wasDataReady && this.hasAnyFilterActive()) {
      this.scheduleApplyFilter('data-ready');
      return; // Filter applied; no further checks this cycle.
    }

    // 1. Handle External Prop Changes (SAFEGUARDED)
    // Keep a signature across updates so in-place mutations with stable refs are still detected.
    const nextExternalSig = buildSbtFilterStateSignature(this.props.externalSBTFilterState || {});
    const prevExternalSig = (
      typeof this._lastExternalFilterStateSignature === 'string'
        ? this._lastExternalFilterStateSignature
        : buildSbtFilterStateSignature(prevProps.externalSBTFilterState || {})
    );
    if (prevExternalSig !== nextExternalSig) {
      this._lastExternalFilterStateSignature = nextExternalSig;
      const incomingStateNormalized = normalizeIncomingFilterState(this.props.externalSBTFilterState || {});
      const incomingSig = buildSbtFilterStateSignature(incomingStateNormalized);
      const currentLocalSig = this.getLocalFilterStateSignature();

      // Only short-circuit when we actually sync local state from props.
      // If local state is already aligned, continue so normal reapply triggers
      // (e.g., changed items/mode/cache revision) still run in this update.
      if (incomingSig !== currentLocalSig) {
        this.setState({
          ...incomingStateNormalized,
          lastAppliedFilterSnapshot: null,
        });
        // Note: Removed direct applyFilter() call here. The state update triggers
        // componentDidUpdate again, which catches the change in step 2 below.
        return;
      }
    }
    this._lastExternalFilterStateSignature = nextExternalSig;

    // 2. Handle Local State Changes
    const fieldsToCheck = [
      'selectedSBTGroupsCreator',
      'excludedSBTGroupsCreator',
      'selectedSBTGroupsResponder',
      'excludedSBTGroupsResponder',
      'selectedSBTGroups',
      'excludedSBTGroups',
      'onlyVerifiedHumans'
    ];

    let shouldReapply = false;
    for (let f of fieldsToCheck) {
      if (prevState[f] !== this.state[f]) {
        shouldReapply = true;
        break;
      }
    }

    if (prevProps.items !== this.props.items || prevProps.mode !== this.props.mode) {
      shouldReapply = true;
    }
    if (prevProps.sbtCacheRevision !== this.props.sbtCacheRevision) {
      shouldReapply = true;
    }

    if (shouldReapply) {
      this.scheduleApplyFilter('state-change');
    }
  }


  hasAnyFilterActive() {
    const {
      selectedSBTGroupsCreator,
      excludedSBTGroupsCreator,
      selectedSBTGroupsResponder,
      excludedSBTGroupsResponder,
      selectedSBTGroups,
      excludedSBTGroups,
      onlyVerifiedHumans
    } = this.state;

    return (
      selectedSBTGroupsCreator.length > 0 ||
      excludedSBTGroupsCreator.length > 0 ||
      selectedSBTGroupsResponder.length > 0 ||
      excludedSBTGroupsResponder.length > 0 ||
      selectedSBTGroups.length > 0 ||
      excludedSBTGroups.length > 0 ||
      onlyVerifiedHumans
    );
  }

  getLocalFilterState() {
    return {
      selectedSBTGroupsCreator: this.state.selectedSBTGroupsCreator,
      excludedSBTGroupsCreator: this.state.excludedSBTGroupsCreator,
      selectedSBTGroupsResponder: this.state.selectedSBTGroupsResponder,
      excludedSBTGroupsResponder: this.state.excludedSBTGroupsResponder,
      selectedSBTGroups: this.state.selectedSBTGroups,
      excludedSBTGroups: this.state.excludedSBTGroups,
      onlyVerifiedHumans: this.state.onlyVerifiedHumans
    };
  }

  getLocalFilterStateSignature() {
    return buildSbtFilterStateSignature(this.getLocalFilterState());
  }

  isLatestApplyRun = (runId) => (
    Number(runId || 0) === Number(this._activeApplyFilterRunId || 0)
  );

  getEffectiveNetwork = () => {
    const raw = this.props.network;
    const sessionChainId = Number(getSessionChainId(this.props.sessionSlug || '') || 0) || null;
    const chainId = Number(
      raw?.id ||
      raw?.chainId ||
      raw?.networkChainId ||
      sessionChainId ||
      0
    ) || null;
    if (raw && chainId && Number(raw.id || 0) !== chainId) {
      return { ...raw, id: chainId };
    }
    if (raw) return raw;
    if (!chainId) return null;
    return { id: chainId, chainId };
  };

  setFilterLoading = (loading) => {
    const next = !!loading;
    if (this._isMounted && this.state.loading !== next) {
      this.setState({ loading: next });
    }
    if (typeof this.props.setFilterLoading === 'function') {
      this.props.setFilterLoading(next);
    }
  };

  setHolderSetMemo = (key, value) => {
    const memoKey = String(key || '');
    if (!memoKey) return;
    if (this._holderSetMemo.has(memoKey)) {
      this._holderSetMemo.delete(memoKey);
    }
    while (this._holderSetMemo.size >= HOLDER_SET_MEMO_MAX_ENTRIES) {
      const oldest = this._holderSetMemo.keys().next();
      if (oldest.done) break;
      this._holderSetMemo.delete(oldest.value);
    }
    this._holderSetMemo.set(memoKey, value);
  };

  scheduleApplyFilter = (reason = 'scheduled') => {
    this._lastScheduledApplyReason = String(reason || 'scheduled');
    if (this._applyFilterScheduled) return;
    this._applyFilterScheduled = true;
    scheduleMicrotask(() => {
      this._applyFilterScheduled = false;
      if (!this._isMounted) return;
      void this.runApplyFilter(this._lastScheduledApplyReason);
    });
  };

  runApplyFilter = async (reason = 'manual') => {
    const previousActiveRunId = Number(this._activeApplyFilterRunId || 0);
    const runId = Number(this._applyFilterRunSeq || 0) + 1;
    this._applyFilterRunSeq = runId;
    this._activeApplyFilterRunId = runId;
    const result = await this.applyFilter(runId, reason);
    if (result === false && Number(this._activeApplyFilterRunId || 0) === runId) {
      this._activeApplyFilterRunId = previousActiveRunId;
    }
    return result;
  };

  applyFilter = async (runId, reason = 'manual') => {
    const effectiveRunId = runId != null
      ? Number(runId)
      : (Number(this._applyFilterRunSeq || 0) + 1);
    let newFilterSnapshot = '';
    if (runId == null) {
      this._applyFilterRunSeq = effectiveRunId;
      this._activeApplyFilterRunId = effectiveRunId;
    }
    this.setFilterLoading(true);
    try {
      const { items, mode, provider, network, isQuestionCacheReady, isSBTCacheReady } = this.props;
      const slug = this.props.sessionSlug || '';

      // Correct readiness gating per mode:
      // - SBT only: responder, questionResponses, addresses
      // - SBT + Questions: creator, creatorAndResponder, questions
      const needsQuestionCache = (
        mode === 'creator' ||
        mode === 'creatorAndResponder' ||
        mode === 'questions'
      );
      const skipCacheGate = mode === 'addresses';
      const isDataReady = skipCacheGate
        ? true
        : ((isSBTCacheReady === true) &&
           (needsQuestionCache ? isQuestionCacheReady === true : true));

      if (!isDataReady) {
        sbtLog.warn("SBTFilter: Waiting for necessary caches to be ready. Aborting filter.", {
          mode,
          isSBTCacheReady,
          isQuestionCacheReady
        });
        return;
      }

      const {
        selectedSBTGroupsCreator,
        excludedSBTGroupsCreator,
        selectedSBTGroupsResponder,
        excludedSBTGroupsResponder,
        selectedSBTGroups,
        excludedSBTGroups,
        onlyVerifiedHumans
      } = this.state;

      const effectiveNetwork = this.getEffectiveNetwork();
      const networkID = String(
        getSessionChainId(slug) ||
        effectiveNetwork?.id ||
        effectiveNetwork?.chainId ||
        ''
      );
      sbtLog.log('Network ID used in SBTFilter:', networkID);

      const itemCount = Array.isArray(items)
        ? items.length
        : (items && typeof items === 'object')
          ? Object.keys(items).length
          : Number(items || 0);
      const hasActiveFilter = this.hasAnyFilterActive();
      const shouldExpandMissingAddressItems = (
        mode === 'addresses' &&
        this.props.expandToSbtHolders === true &&
        selectedSBTGroups.length > 0
      );
      const shouldPassThrough = (
        !hasActiveFilter ||
        (!items && !shouldExpandMissingAddressItems)
      );
      const networkSnapshotKey = String(networkID || '__no-network__');
      const snapshotPrefix = [
        this.getLocalFilterStateSignature(),
        String(mode || ''),
        String(itemCount),
        networkSnapshotKey,
      ];
      const itemsSourceSignature = buildItemsSourceSignature(items);

      if (shouldPassThrough) {
        newFilterSnapshot = [
          ...snapshotPrefix,
          itemsSourceSignature,
          String(this.props.sbtCacheRevision || 0),
          'passive',
        ].join('|');
        if (this.state.lastAppliedFilterSnapshot === newFilterSnapshot) {
          // Means we already applied these exact filters; avoid re-render loops
          return false;
        }
      } else {
        newFilterSnapshot = [
          ...snapshotPrefix,
          itemsSourceSignature,
          String(this.props.sbtCacheRevision || 0),
        ].join('|');
        if (this.state.lastAppliedFilterSnapshot === newFilterSnapshot) {
          // Means we already applied these exact filters; avoid re-render loops
          return false;
        }
      }

      if (this.isLatestApplyRun(effectiveRunId)) {
        this.setState({ lastAppliedFilterSnapshot: newFilterSnapshot });
      }

      if (!networkID) {
        sbtLog.error('Network ID is undefined in SBTFilter. Cannot proceed.');
        if (this.props.onFilter) {
          this.props.onFilter(items || [], this.getLocalFilterState());
        }
        return;
      }

      if (shouldPassThrough) {
        // No items or no active filter => pass items straight through
        if (this.props.onFilter) {
          this.props.onFilter(items || [], this.getLocalFilterState());
        }
        return;
      }

      const allSbtEntries = [
        ...selectedSBTGroupsCreator,
        ...excludedSBTGroupsCreator,
        ...selectedSBTGroupsResponder,
        ...excludedSBTGroupsResponder,
        ...selectedSBTGroups,
        ...excludedSBTGroups
      ].filter(Boolean);

      const uniqueSbtEntries = new Map();
      allSbtEntries.forEach((sbt) => {
        const addr = (sbt?.address || '').toLowerCase();
        if (!addr) return;
        const existing = uniqueSbtEntries.get(addr);
        if (!existing) {
          uniqueSbtEntries.set(addr, sbt);
          return;
        }
        if (!existing.sessionSlug && (sbt.sessionSlug || sbt.slug || sbt.sessionName)) {
          uniqueSbtEntries.set(addr, {
            ...existing,
            sessionSlug: sbt.sessionSlug || sbt.slug || existing.sessionSlug,
            sessionName: sbt.sessionName || existing.sessionName,
            chainId: sbt.chainId || sbt.chainID || existing.chainId
          });
        }
      });

      const resolveGroupSlugForSbt = (sbt) => {
        if (!sbt) return slug;
        const direct = sbt.sessionSlug || sbt.slug || sbt.group;
        if (direct != null && String(direct).trim() !== '') return normalizeSessionSlug(direct);
        if (sbt.sessionName) {
          const byName = getSessionSlugByName(String(sbt.sessionName).trim());
          if (byName != null) return byName;
        }
        return slug;
      };

      const resolveChainIdForSbt = (sbtSlug, sbt) => {
        const fromEntry = sbt?.chainId || sbt?.chainID;
        const chainId = getSessionChainId(sbtSlug) || fromEntry || networkID || null;
        return chainId != null ? Number(chainId) : null;
      };

      const cacheBySlug = new Map();
      const readRawCacheForSlug = (slugForCache) => {
        const cacheKey = `dg:sbtCache:${slugForCache || ''}`;
        if (cacheBySlug.has(cacheKey)) return cacheBySlug.get(cacheKey);
        const parsed = asCacheObject(readSbtCacheBySlug(slugForCache));
        cacheBySlug.set(cacheKey, parsed);
        return parsed;
      };

      const readNetCacheForSlug = (slugForCache, netKeyForCache) => (
        asCacheObject(asCacheObject(readRawCacheForSlug(slugForCache))[String(netKeyForCache || '')])
      );

      const writeSbtEntryForSlug = (slugForCache, netKeyForCache, sbtAddress, entryPatch = {}) => {
        const cacheKey = `dg:sbtCache:${slugForCache || ''}`;
        const netKey = String(netKeyForCache || '');
        if (!netKey) return null;
        const rawCache = asCacheObject(readRawCacheForSlug(slugForCache));
        const netCache = asCacheObject(rawCache[netKey]);
        const sbtList = asCacheObject(netCache.sbtList);
        const currentEntry = asCacheObject(sbtList[sbtAddress]);
        const nextCache = {
          ...rawCache,
          [netKey]: {
            ...netCache,
            sbtList: {
              ...sbtList,
              [sbtAddress]: {
                ...currentEntry,
                ...entryPatch,
              },
            },
          },
        };
        void writeCache('sbtCache', slugForCache || '', nextCache);
        cacheBySlug.set(cacheKey, nextCache);
        return nextCache;
      };

      const computeHolderListFingerprint = (addresses) => {
        if (!Array.isArray(addresses)) return 'nil';
        let hash = 0;
        for (let i = 0; i < addresses.length; i += 1) {
          const normalized = String(addresses[i] || '').toLowerCase();
          for (let j = 0; j < normalized.length; j += 1) {
            hash = ((hash * 31) + normalized.charCodeAt(j)) | 0;
          }
          hash = ((hash * 131) + 1) | 0;
        }
        return `${addresses.length}:${hash}`;
      };

      // Build a map of SBT -> set of minted holders (minus burned)
      const sbtHoldersMap = {};
      for (const [sbtAddress, sbt] of uniqueSbtEntries.entries()) {
        const sbtSlug = resolveGroupSlugForSbt(sbt);
        const chainId = resolveChainIdForSbt(sbtSlug, sbt);
        const netKey = String(chainId || networkID || '');
        if (!netKey) {
          sbtHoldersMap[sbtAddress] = new Set();
          continue;
        }

        const sbtNetCache = readNetCacheForSlug(sbtSlug, netKey);
        const sbtListData = sbtNetCache.sbtList || {};
        const entry = sbtListData[sbtAddress] || {};
        const entryMinted = Array.isArray(entry.mintedAddresses) ? entry.mintedAddresses : null;
        const entryBurned = Array.isArray(entry.burnedAddresses) ? entry.burnedAddresses : null;
        const rawEntryMintedCounts = entry?.mintedCountByAddress;
        const rawEntryBurnedCounts = entry?.burnedCountByAddress;
        const entryMintedCountMap = normalizeAddressCountMap(rawEntryMintedCounts);
        const entryBurnedCountMap = normalizeAddressCountMap(rawEntryBurnedCounts);
        const checkpointBackedPartialCounts =
          entry?.countsLoaded !== true &&
          !!entry?.countsScanCheckpoint &&
          typeof entry.countsScanCheckpoint === 'object';
        const hasStructuredEntryCountMaps =
          (
            !!rawEntryMintedCounts &&
            typeof rawEntryMintedCounts === 'object' &&
            !Array.isArray(rawEntryMintedCounts)
          ) || (
            !!rawEntryBurnedCounts &&
            typeof rawEntryBurnedCounts === 'object' &&
            !Array.isArray(rawEntryBurnedCounts)
          );
        const hasAuthoritativeEntryCountMaps =
          (
            Object.keys(entryMintedCountMap).length > 0 ||
            Object.keys(entryBurnedCountMap).length > 0 ||
            (entry?.countsLoaded === true && hasStructuredEntryCountMaps && !entryMinted && !entryBurned)
          );
        const shouldUseEntryCountMaps =
          !checkpointBackedPartialCounts &&
          hasAuthoritativeEntryCountMaps;
        const entryMintedFingerprint = computeHolderListFingerprint(entryMinted);
        const entryBurnedFingerprint = computeHolderListFingerprint(entryBurned);
        const entryMintedCountFingerprint = countMapFingerprint(rawEntryMintedCounts);
        const entryBurnedCountFingerprint = countMapFingerprint(rawEntryBurnedCounts);
        const holderRevisionKey = [
          String(sbtSlug || ''),
          String(netKey || ''),
          String(sbtAddress || ''),
          String(this.props.sbtCacheRevision || 0),
          String(entry.countsLoaded === true ? 1 : 0),
          String(shouldUseEntryCountMaps ? 1 : 0),
          String(entryMintedCountFingerprint),
          String(entryBurnedCountFingerprint),
          String(entryMintedFingerprint),
          String(entryBurnedFingerprint),
          String(
            entry.creationBlock ??
            entry.sbtInfo?.creationBlock ??
            sbt?.creationBlock ??
            sbt?.sbtInfo?.creationBlock ??
            ''
          ),
        ].join('|');
        const memoizedHolders = this._holderSetMemo.get(holderRevisionKey);
        if (memoizedHolders) {
          sbtHoldersMap[sbtAddress] = memoizedHolders;
          continue;
        }

        if (shouldUseEntryCountMaps) {
          const holdersSet = measureSync('ce.sbtFilter.computeNetHolderSet', () =>
            buildNetHoldersSetFromCounts(entryMintedCountMap, entryBurnedCountMap)
          );
          this.setHolderSetMemo(holderRevisionKey, holdersSet);
          sbtHoldersMap[sbtAddress] = holdersSet;
          continue;
        }

        if (!checkpointBackedPartialCounts && entry.countsLoaded === true && entryMinted && entryBurned) {
          const holdersSet = measureSync('ce.sbtFilter.computeNetHolderSet', () =>
            buildNetHoldersSet(entryMinted, entryBurned)
          );
          this.setHolderSetMemo(holderRevisionKey, holdersSet);
          sbtHoldersMap[sbtAddress] = holdersSet;
          continue;
        }

        try {
          const rawCreationBlock =
            entry.creationBlock ??
            entry.sbtInfo?.creationBlock ??
            sbt?.creationBlock ??
            sbt?.sbtInfo?.creationBlock;
          const creationBlock = rawCreationBlock != null ? Number(rawCreationBlock) : NaN;
          const fromBlock = Number.isFinite(creationBlock) && creationBlock >= 0 ? Math.floor(creationBlock) : 0;
          const requestKey = [
            String(sbtSlug || ''),
            String(netKey || ''),
            String(sbtAddress || ''),
            String(fromBlock || 0),
          ].join('|');

          let inFlight = this._holderSetInFlight.get(requestKey);
          if (!inFlight) {
            inFlight = (async () => {
              const counts = await contractScripts.getSbtMintBurnCountsByAddress('none', sbtAddress, fromBlock, 'latest', sbtSlug);
              if (counts?.ok === false) {
                throw new Error('SBT holder count scan failed');
              }
              const mintedCountByAddress = normalizeAddressCountMap(counts?.mintedCountByAddress);
              const burnedCountByAddress = normalizeAddressCountMap(counts?.burnedCountByAddress);
              const mintedAddresses = Object.keys(mintedCountByAddress);
              const burnedAddresses = Object.keys(burnedCountByAddress);
              const holdersSet = measureSync('ce.sbtFilter.computeNetHolderSet', () =>
                buildNetHoldersSetFromCounts(mintedCountByAddress, burnedCountByAddress)
              );
              return {
                mintedAddresses,
                burnedAddresses,
                mintedCountByAddress,
                burnedCountByAddress,
                mintedEventCount: Math.max(0, Math.floor(Number(counts?.mintedEventCount || 0))),
                burnedEventCount: Math.max(0, Math.floor(Number(counts?.burnedEventCount || 0))),
                scannedToBlock: Number.isFinite(Number(counts?.scannedToBlock))
                  ? Math.floor(Number(counts.scannedToBlock))
                  : null,
                holdersSet,
              };
            })()
              .finally(() => {
                this._holderSetInFlight.delete(requestKey);
              });
            this._holderSetInFlight.set(requestKey, inFlight);
          }

          const fetched = await inFlight;
          if (!this.isLatestApplyRun(effectiveRunId)) return;
          const mintedAddresses = fetched?.mintedAddresses || [];
          const burnedAddresses = fetched?.burnedAddresses || [];
          const mintedCountByAddress = fetched?.mintedCountByAddress || {};
          const burnedCountByAddress = fetched?.burnedCountByAddress || {};
          const holdersSet = fetched?.holdersSet || new Set();
          sbtHoldersMap[sbtAddress] = holdersSet;

          writeSbtEntryForSlug(sbtSlug, netKey, sbtAddress, {
            mintedAddresses,
            burnedAddresses,
            mintedCountByAddress,
            burnedCountByAddress,
            mintedEventCount: fetched?.mintedEventCount || 0,
            burnedEventCount: fetched?.burnedEventCount || 0,
            historySummary: buildHistorySummaryFromCounts({
              mintedCountByAddress,
              burnedCountByAddress,
              mintedEventCount: fetched?.mintedEventCount || 0,
              burnedEventCount: fetched?.burnedEventCount || 0,
            }),
            blockNumber: Number.isFinite(Number(fetched?.scannedToBlock))
              ? Math.floor(Number(fetched.scannedToBlock))
              : undefined,
            countsLoaded: true,
            countsScanCheckpoint: null,
          });
          const fetchedRevisionKey = [
            String(sbtSlug || ''),
            String(netKey || ''),
            String(sbtAddress || ''),
            String(this.props.sbtCacheRevision || 0),
            '1',
            '1',
            String(countMapFingerprint(mintedCountByAddress)),
            String(countMapFingerprint(burnedCountByAddress)),
            String(computeHolderListFingerprint(mintedAddresses)),
            String(computeHolderListFingerprint(burnedAddresses)),
            String(fromBlock || 0),
          ].join('|');
          this.setHolderSetMemo(fetchedRevisionKey, holdersSet);
        } catch (error) {
          sbtLog.error('Error fetching SBT holders:', error);
          sbtHoldersMap[sbtAddress] = new Set();
        }
      }

      sbtLog.log('sbtHoldersMap:', sbtHoldersMap);
      if (!this.isLatestApplyRun(effectiveRunId)) return;

      const buildHolderUnionSet = (sbtEntries = []) => {
        const union = new Set();
        (Array.isArray(sbtEntries) ? sbtEntries : []).forEach((sbt) => {
          const sbtAddr = String(sbt?.address || '').toLowerCase();
          if (!sbtAddr) return;
          const holders = sbtHoldersMap[sbtAddr];
          if (!holders || holders.size === 0) return;
          holders.forEach((holder) => union.add(holder));
        });
        return union;
      };

      const selectedCreatorHolderSet = buildHolderUnionSet(selectedSBTGroupsCreator);
      const excludedCreatorHolderSet = buildHolderUnionSet(excludedSBTGroupsCreator);
      const selectedResponderHolderSet = buildHolderUnionSet(selectedSBTGroupsResponder);
      const excludedResponderHolderSet = buildHolderUnionSet(excludedSBTGroupsResponder);
      const selectedAddressHolderSet = buildHolderUnionSet(selectedSBTGroups);
      const excludedAddressHolderSet = buildHolderUnionSet(excludedSBTGroups);

      const doesAddressPassHolderSets = (address, includeSet, hasIncludeGroups, excludeSet) => {
        if (!address) return true;
        const lowerAddr = String(address || '').toLowerCase();
        if (excludeSet && excludeSet.size > 0 && excludeSet.has(lowerAddr)) {
          return false;
        }
        if (hasIncludeGroups && (!includeSet || !includeSet.has(lowerAddr))) {
          return false;
        }
        return true;
      };

      // Helper to check address vs. include/exclude sets
      const doesAddressPassFilters = (address, selectedSBTs, excludedSBTs) => {
        if (selectedSBTs === selectedSBTGroupsCreator && excludedSBTs === excludedSBTGroupsCreator) {
          return doesAddressPassHolderSets(
            address,
            selectedCreatorHolderSet,
            selectedSBTGroupsCreator.length > 0,
            excludedCreatorHolderSet
          );
        }
        if (selectedSBTs === selectedSBTGroupsResponder && excludedSBTs === excludedSBTGroupsResponder) {
          return doesAddressPassHolderSets(
            address,
            selectedResponderHolderSet,
            selectedSBTGroupsResponder.length > 0,
            excludedResponderHolderSet
          );
        }
        if (selectedSBTs === selectedSBTGroups && excludedSBTs === excludedSBTGroups) {
          return doesAddressPassHolderSets(
            address,
            selectedAddressHolderSet,
            selectedSBTGroups.length > 0,
            excludedAddressHolderSet
          );
        }
        return doesAddressPassHolderSets(
          address,
          buildHolderUnionSet(selectedSBTs),
          Array.isArray(selectedSBTs) && selectedSBTs.length > 0,
          buildHolderUnionSet(excludedSBTs)
        );
      };

      // Short-circuit for responder-only modes when include list has no holders
      if (
        (mode === 'responder' || mode === 'questionResponses') &&
        selectedSBTGroupsResponder.length > 0
      ) {
        if (selectedResponderHolderSet.size === 0) {
          sbtLog.log('[SBTFilter] Responder include list has no holders. Returning empty result.');
          if (this.props.onFilter) {
            const result = Array.isArray(items) ? [] : {};
            this.props.onFilter(result, this.getLocalFilterState());
          }
          return;
        }
      }

      // Extend the same short-circuit to creatorAndResponder mode.
      // When user includes responder SBT(s) but union of holders is empty, nothing should pass.
      if (
        mode === 'creatorAndResponder' &&
        selectedSBTGroupsResponder.length > 0
      ) {
        if (selectedResponderHolderSet.size === 0) {
          sbtLog.log('[SBTFilter] (creatorAndResponder) Responder include has 0 holders -> return empty.');
          if (this.props.onFilter) {
            if (Array.isArray(items)) {
              this.props.onFilter(
                { filteredQuestions: [], filteredResponsesByQuestion: {} },
                this.getLocalFilterState()
              );
            } else if (items && typeof items === 'object') {
              this.props.onFilter({}, this.getLocalFilterState());
            } else {
              this.props.onFilter([], this.getLocalFilterState());
            }
          }
          return;
        }
      }

      // Creator and responder mode
      if (mode === 'creatorAndResponder') {
        if (!items) {
          sbtLog.warn('creatorAndResponder mode: no items supplied');
          if (this.props.onFilter) {
            this.props.onFilter([], this.getLocalFilterState());
          }
          return;
        }

        if (Array.isArray(items)) {
          let filteredQuestions = [];
          let filteredResponsesByQuestion = {};

          const networkIDLocal = String(networkID);
          const questionNetCache = readQuestionsNetBucketBySlug(slug, networkIDLocal);

          for (let questionObj of items) {
            if (
              doesAddressPassFilters(
                questionObj.creator,
                selectedSBTGroupsCreator,
                excludedSBTGroupsCreator
              )
            ) {
              filteredQuestions.push(questionObj);
            }
          }

          // Build question->responses from cache
          for (let qObj of filteredQuestions) {
            const qID = qObj.id?.toLowerCase();
            let qResponses = [];
            if (
              questionNetCache.questionResponses &&
              questionNetCache.questionResponses[qID]
            ) {
              const addresses = Object.keys(
                questionNetCache.questionResponses[qID]
              );
              for (let addr of addresses) {
                const responseData =
                  questionNetCache.questionResponses[qID][addr];
                qResponses.push({
                  responder: addr,
                  questionId: qID,
                  response: responseData
                });
              }
            }

          let finalFilteredResponses = [];
          for (let resp of qResponses) {
            if (
              doesAddressPassFilters(
                resp.responder,
                selectedSBTGroupsResponder,
                excludedSBTGroupsResponder
              )
            ) {
              finalFilteredResponses.push(resp);
            }
          }
          filteredResponsesByQuestion[qID] = finalFilteredResponses;
          }

          if (onlyVerifiedHumans) {
            // future hook
          }

          if (this.props.onFilterCreators) {
            this.props.onFilterCreators(filteredQuestions, this.getLocalFilterState());
          }
          if (this.props.onFilterResponders) {
            this.props.onFilterResponders(
              filteredResponsesByQuestion,
              this.getLocalFilterState()
            );
          }

          if (this.props.onFilter) {
            const combinedResult = {
              filteredQuestions,
              filteredResponsesByQuestion
            };
            this.props.onFilter(combinedResult, this.getLocalFilterState());
          }
          return;
        }
        // Aggregator-object version
        else if (typeof items === 'object' && items !== null) {
          const unifiedAgg = unifyAggregatorWithAllLocalQuestions(items, networkID, 'creatorAndResponder', slug);

          let finalAggregator = {};
          const questionNetCache = readQuestionsNetBucketBySlug(slug, networkID);

          let filteredQuestions = [];

          for (let qId of Object.keys(unifiedAgg)) {
            const rawArray = unifiedAgg[qId] || [];
            let questionCreator = null;
            if (
              questionNetCache.questions &&
              questionNetCache.questions[qId]
            ) {
              questionCreator = questionNetCache.questions[qId].creator;
            }
            let keepThisQuestion = true;
            if (questionCreator) {
              keepThisQuestion = doesAddressPassFilters(
                questionCreator,
                selectedSBTGroupsCreator,
                excludedSBTGroupsCreator
              );
            }
            if (!keepThisQuestion) {
              continue;
            }
            if (
              questionNetCache.questions &&
              questionNetCache.questions[qId]
            ) {
              filteredQuestions.push(questionNetCache.questions[qId]);
            }

            const keptEntries = rawArray.filter((entryObj) => {
              if (
                entryObj.responder &&
                !doesAddressPassFilters(
                  entryObj.responder,
                  selectedSBTGroupsResponder,
                  excludedSBTGroupsResponder
                )
              ) {
                return false;
              }
              return true;
            });
            if (keptEntries.length > 0) {
              finalAggregator[qId] = keptEntries;
            }
          }

          if (onlyVerifiedHumans) {
            // future hook
          }

          if (this.props.onFilterCreators) {
            this.props.onFilterCreators(filteredQuestions, this.getLocalFilterState());
          }
          if (this.props.onFilterResponders) {
            const byQuestion = {};
            for (const qId of Object.keys(finalAggregator)) {
              byQuestion[qId] = finalAggregator[qId];
            }
            this.props.onFilterResponders(byQuestion, this.getLocalFilterState());
          }

          if (this.props.onFilter) {
            this.props.onFilter(finalAggregator, this.getLocalFilterState());
          }

          return;
        } else {
          sbtLog.warn(
            'creatorAndResponder mode: expected array or aggregator object, got something else.'
          );
          if (this.props.onFilter) {
            this.props.onFilter([], this.getLocalFilterState());
          }
          return;
        }
      }
      // Single-filter aggregator logic
      else if (
        (mode === 'creator' ||
          mode === 'responder' ||
          mode === 'questions' ||
          mode === 'questionResponses') &&
        typeof items === 'object' &&
        items !== null &&
        !Array.isArray(items)
      ) {
        const unifiedAgg = unifyAggregatorWithAllLocalQuestions(items, networkID, mode, slug);

        let finalAggregator = {};
        const questionNetCache = readQuestionsNetBucketBySlug(slug, networkID);

        let filteredQuestions = [];

        for (let qId of Object.keys(unifiedAgg)) {
          let rawVal = unifiedAgg[qId];
          let rawArray = Array.isArray(rawVal)
            ? rawVal
            : Object.keys(rawVal).map((respAddr) => {
                const potentialObj = rawVal[respAddr];
                if (potentialObj && typeof potentialObj === 'object' && potentialObj.responder) {
                  return potentialObj;
                } else {
                  return {
                    responder: respAddr,
                    response: potentialObj
                  };
                }
              });

          // For "creator" or "questions" modes, check question creator
          let keepThisQuestion = true;
          if (mode === 'creator' || mode === 'questions') {
            let questionCreator = null;
            if (
              questionNetCache.questions &&
              questionNetCache.questions[qId]
            ) {
              questionCreator = questionNetCache.questions[qId].creator;
            }
            if (questionCreator) {
              keepThisQuestion = doesAddressPassFilters(
                questionCreator,
                selectedSBTGroupsCreator,
                excludedSBTGroupsCreator
              );
            }
          }
          if (!keepThisQuestion) {
            continue;
          }

          if (
            (mode === 'creator' || mode === 'questions') &&
            questionNetCache.questions &&
            questionNetCache.questions[qId]
          ) {
            filteredQuestions.push(questionNetCache.questions[qId]);
          }

          // For "responder" or "questionResponses", filter the array by entryObj.responder
          let keptEntries = rawArray;
          if (mode === 'responder' || mode === 'questionResponses') {
            keptEntries = rawArray.filter((entryObj) => {
              if (
                entryObj.responder &&
                !doesAddressPassFilters(
                  entryObj.responder,
                  selectedSBTGroupsResponder,
                  excludedSBTGroupsResponder
                )
              ) {
                return false;
              }
              return true;
            });
          }

          if (keptEntries.length > 0) {
            finalAggregator[qId] = keptEntries;
          }
        }

        if (onlyVerifiedHumans) {
          // future hook
        }

        if ((mode === 'creator' || mode === 'questions') && this.props.onFilterCreators) {
          this.props.onFilterCreators(filteredQuestions, this.getLocalFilterState());
        }
        if ((mode === 'responder' || mode === 'questionResponses') && this.props.onFilterResponders) {
          const byQuestion = {};
          for (const qId of Object.keys(finalAggregator)) {
            byQuestion[qId] = finalAggregator[qId];
          }
          this.props.onFilterResponders(byQuestion, this.getLocalFilterState());
        }

        if (this.props.onFilter) {
          this.props.onFilter(finalAggregator, this.getLocalFilterState());
        }

        return;
      }
      // Default: array filtering or other object
      else {
        const shouldExpandAddresses =
          mode === 'addresses' &&
          this.props.expandToSbtHolders === true &&
          selectedSBTGroups.length > 0;

        if (!items && !shouldExpandAddresses) {
          sbtLog.warn(`No items supplied for mode="${mode}".`);
          if (this.props.onFilter) {
            this.props.onFilter([], this.getLocalFilterState());
          }
          return;
        }

        let itemsToFilter = items;
        if (shouldExpandAddresses) {
          const inputAddresses = Array.isArray(items) ? items : [];
          const expanded = new Set();
          inputAddresses.forEach((addr) => {
            if (typeof addr === 'string' && addr.trim()) {
              expanded.add(addr.toLowerCase());
            }
          });
          selectedAddressHolderSet.forEach((holder) => expanded.add(holder));
          itemsToFilter = Array.from(expanded);
        }

        const filterItem = (item) => {
          if (!item) return false;

          if (mode === 'addresses') {
            if (typeof item !== 'string') {
              sbtLog.error('Expected item to be a string in addresses mode, but got:', item);
              return false;
            }
            const address = item.toLowerCase();
            if (!doesAddressPassHolderSets(
              address,
              selectedAddressHolderSet,
              selectedSBTGroups.length > 0,
              excludedAddressHolderSet
            )) {
              return false;
            }
            if (onlyVerifiedHumans) {
              // future hook
            }
            return true;
          } else {
            // question-based item or aggregator sub-item
            let addressToCheckCreator = null;
            let addressToCheckResponder = null;

            if (item.creator) {
              addressToCheckCreator = item.creator.toLowerCase();
            }
            if (item.responder) {
              addressToCheckResponder = item.responder.toLowerCase();
            }

            if (mode === 'creator' || mode === 'questions') {
              if (addressToCheckCreator) {
                if (
                  !doesAddressPassFilters(
                    addressToCheckCreator,
                    selectedSBTGroupsCreator,
                    excludedSBTGroupsCreator
                  )
                ) {
                  return false;
                }
              }
            }
            if (mode === 'responder' || mode === 'questionResponses') {
              if (addressToCheckResponder) {
                if (
                  !doesAddressPassFilters(
                    addressToCheckResponder,
                    selectedSBTGroupsResponder,
                    excludedSBTGroupsResponder
                  )
                ) {
                  return false;
                }
              }
            }
            if (onlyVerifiedHumans && (addressToCheckCreator || addressToCheckResponder)) {
              // future hook
            }
            return true;
          }
        };

        let filteredResult;
        if (Array.isArray(itemsToFilter)) {
          filteredResult = measureSync('ce.sbtFilter.filter.array', () =>
            itemsToFilter.filter(filterItem)
          );
        } else if (typeof items === 'object') {
          filteredResult = measureSync('ce.sbtFilter.filter.object', () => {
            const newObj = {};
            for (const [key, val] of Object.entries(items)) {
              if (Array.isArray(val)) {
                const filteredArr = val.filter((subItem) => filterItem(subItem));
                if (filteredArr.length > 0) newObj[key] = filteredArr;
              } else {
                const entries = Object.entries(val);
                const filteredPairs = entries.filter(([resp, respVal]) => filterItem(respVal));
                if (filteredPairs.length > 0) {
                  const recon = {};
                  for (let [k, v] of filteredPairs) {
                    recon[k] = v;
                  }
                  newObj[key] = recon;
                }
              }
            }
            return newObj;
          });
        } else {
          // Unexpected type
          sbtLog.warn('SBTFilter: unsupported items type:', typeof items);
          filteredResult = items;
        }

        sbtLog.log('Filtered items:', filteredResult);

        if (this.props.onFilter) {
          this.props.onFilter(filteredResult, this.getLocalFilterState());
        }
      }
    } finally {
      if (this.isLatestApplyRun(effectiveRunId)) {
        this.setFilterLoading(false);
      }
    }
  };

  // Handlers for adding/removing SBT “include” or “exclude”
  handleAddSBTIncludeCreator = (sbtObject) => {
    const { address } = sbtObject;
    if (!this.state.selectedSBTGroupsCreator.find((sbt) => sbt.address === address)) {
      this.setState((prev) => ({
        selectedSBTGroupsCreator: [...prev.selectedSBTGroupsCreator, sbtObject]
      }));
    }
  };
  handleRemoveSBTIncludeCreator = (address) => {
    this.setState((prev) => ({
      selectedSBTGroupsCreator: prev.selectedSBTGroupsCreator.filter((sbt) => sbt.address !== address)
    }));
  };

  handleAddSBTExcludeCreator = (sbtObject) => {
    const { address } = sbtObject;
    if (!this.state.excludedSBTGroupsCreator.find((sbt) => sbt.address === address)) {
      this.setState((prev) => ({
        excludedSBTGroupsCreator: [...prev.excludedSBTGroupsCreator, sbtObject]
      }));
    }
  };
  handleRemoveSBTExcludeCreator = (address) => {
    this.setState((prev) => ({
      excludedSBTGroupsCreator: prev.excludedSBTGroupsCreator.filter((sbt) => sbt.address !== address)
    }));
  };

  handleAddSBTIncludeResponder = (sbtObject) => {
    const { address } = sbtObject;
    if (!this.state.selectedSBTGroupsResponder.find((sbt) => sbt.address === address)) {
      this.setState((prev) => ({
        selectedSBTGroupsResponder: [...prev.selectedSBTGroupsResponder, sbtObject]
      }));
    }
  };
  handleRemoveSBTIncludeResponder = (address) => {
    this.setState((prev) => ({
      selectedSBTGroupsResponder: prev.selectedSBTGroupsResponder.filter((sbt) => sbt.address !== address)
    }));
  };

  handleAddSBTExcludeResponder = (sbtObject) => {
    const { address } = sbtObject;
    if (!this.state.excludedSBTGroupsResponder.find((sbt) => sbt.address === address)) {
      this.setState((prev) => ({
        excludedSBTGroupsResponder: [...prev.excludedSBTGroupsResponder, sbtObject]
      }));
    }
  };
  handleRemoveSBTExcludeResponder = (address) => {
    this.setState((prev) => ({
      excludedSBTGroupsResponder: prev.excludedSBTGroupsResponder.filter((sbt) => sbt.address !== address)
    }));
  };

  handleAddSBTInclude = (sbtObject) => {
    const { address } = sbtObject;
    if (!this.state.selectedSBTGroups.find((sbt) => sbt.address === address)) {
      this.setState((prev) => ({
        selectedSBTGroups: [...prev.selectedSBTGroups, sbtObject]
      }));
    }
  };
  handleRemoveSBTInclude = (address) => {
    this.setState((prev) => ({
      selectedSBTGroups: prev.selectedSBTGroups.filter((sbt) => sbt.address !== address)
    }));
  };

  handleAddSBTExclude = (sbtObject) => {
    const { address } = sbtObject;
    if (!this.state.excludedSBTGroups.find((sbt) => sbt.address === address)) {
      this.setState((prev) => ({
        excludedSBTGroups: [...prev.excludedSBTGroups, sbtObject]
      }));
    }
  };
  handleRemoveSBTExclude = (address) => {
    this.setState((prev) => ({
      excludedSBTGroups: prev.excludedSBTGroups.filter((sbt) => sbt.address !== address)
    }));
  };

  toggleVerifiedHumans = () => {
    this.setState((prev) => ({
      onlyVerifiedHumans: !prev.onlyVerifiedHumans
    }));
  };

  toggleFilterOptions = () => {
    this.setState((prev) => ({
      showFilterOptions: !prev.showFilterOptions
    }));
  };

  toggleShowAllSBTs = () => {
    this.setState(prevState => ({
      showAllSBTs: !prevState.showAllSBTs
    }));
    // No need to call applyFilter here, as this only affects the options in the dropdown
  }

  renderQuickSelectChips = (selectedSBTs, onAddHandler, filterKey) => {
    const { defaultFeaturedSBTs, sessionSlug } = this.props;
    if (!Array.isArray(defaultFeaturedSBTs) || defaultFeaturedSBTs.length === 0) {
      return null;
    }

    const selectedSet = new Set(
      (Array.isArray(selectedSBTs) ? selectedSBTs : [])
        .map((entry) => String(entry?.address || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const shortenAddress = (address) => {
      const text = String(address || '').trim();
      if (!text) return '';
      if (text.length <= 13) return text;
      return `${text.slice(0, 6)}...${text.slice(-5)}`;
    };

    return (
      <div className={styles.quickSelectRow}>
        {defaultFeaturedSBTs.map((featuredAddress, index) => {
          const address = String(featuredAddress || '').trim();
          if (!address) return null;

          const addressLower = address.toLowerCase();
          const isSelected = selectedSet.has(addressLower);
          let resolvedLabel = '';
          try {
            resolvedLabel = resolveSbtDisplayLabel({
              address,
              preferredSlug: sessionSlug,
              fallback: 'address',
            });
          } catch (_) {
            resolvedLabel = '';
          }
          const chipLabel = resolvedLabel && resolvedLabel.toLowerCase() !== addressLower
            ? resolvedLabel
            : shortenAddress(address);

          return (
            <button
              key={`${filterKey}-${addressLower}-${index}`}
              type="button"
              className={`${styles.quickChip} ${isSelected ? styles.quickChipSelected : ''}`.trim()}
              style={{ backgroundColor: QUICK_CHIP_GATE_COLORS[index % QUICK_CHIP_GATE_COLORS.length] }}
              onClick={() => {
                if (isSelected) return;
                onAddHandler({ address });
              }}
              disabled={isSelected}
              data-testid={`ce-sbt-quick-chip-${filterKey}-${address}`}
              aria-disabled={isSelected}
            >
              {chipLabel}
            </button>
          );
        })}
      </div>
    );
  };

  render() {
    const effectiveNetwork = this.getEffectiveNetwork();
    const {
      showFilterOptions,
      selectedSBTGroupsCreator,
      excludedSBTGroupsCreator,
      selectedSBTGroupsResponder,
      excludedSBTGroupsResponder,
      selectedSBTGroups,
      excludedSBTGroups,
      loading,
      showAllSBTs
    } = this.state;

    // Receive defaultFeaturedSBTs prop
    const { mode, hideUI, defaultFeaturedSBTs } = this.props;

    // Determine if the featured SBTs prop is valid
    const hasFeaturedSBTs = defaultFeaturedSBTs && Array.isArray(defaultFeaturedSBTs) && defaultFeaturedSBTs.length > 0;

    let buttonText = 'Filter';
    if (
      mode === 'questions' ||
      mode === 'questionResponses' ||
      mode === 'creatorAndResponder'
    ) {
      buttonText = 'Response Filter';
    }

    if (hideUI) {
      return <div style={{ display: 'none' }} />;
    }

    return (
      <div className={styles.sbtFilter}>
        {/* If not autoExpand, show a settings/cog button to toggle filter options */}
        {!this.props.autoExpand && (
          <Button
            onClick={this.toggleFilterOptions}
            id={styles.filterButton}
            className={
              this.props.buttonSurface === 'light' ? styles.filterButtonOnLight : undefined
            }
          >
            {buttonText} <FontAwesomeIcon icon={faFilter} id={styles.filterButtonIcon} />
          </Button>
        )}

        {/* If autoExpand is true, or the user toggled showFilterOptions, display the filter UI */}
        {(this.props.autoExpand || showFilterOptions) && (
          <div style={{ position: 'relative' }}>
            {!this.props.hideLoadingOverlay && loading && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 'inherit'
              }}>
                <FontAwesomeIcon icon={faSpinner} spin size="2x" color="white" />
              </div>
            )}
            <div
              className={[
                styles.filterOptions,
                this.props.buttonSurface === 'light' ? styles.filterOptionsOnLight : '',
              ].filter(Boolean).join(' ')}
            >

              {/* Conditionally render the "Show All" checkbox */}
              {hasFeaturedSBTs && (
                <FormGroup check className={styles.showAllCheckbox}>
                  <Label check>
                    <Input
                      type="checkbox"
                      checked={showAllSBTs}
                      onChange={this.toggleShowAllSBTs}
                    />{' '}
                    Show All SBTs
                  </Label>
                </FormGroup>
              )}


              {/* Mode: 'responder' => filter by SBT group(s) of Survey Responder */}
      {mode === 'responder' && (
                <>
                  <h5>SBT Group(s) of Survey Responder</h5>
                  <SBTSelector
                    id="includeResponder"
                    network={effectiveNetwork}
                    provider={this.props.provider}
                    onAddSBT={this.handleAddSBTIncludeResponder}
                    onRemoveSBT={this.handleRemoveSBTIncludeResponder}
                    selectedSBTs={selectedSBTGroupsResponder}
                    sessionSlug={this.props.sessionSlug}
                    label={'Include Responses from SBT Holders'}
                    defaultFeaturedSBTs={defaultFeaturedSBTs}
                    showAllSBTs={showAllSBTs}
                    sbtCacheRevision={this.props.sbtCacheRevision}
                  />
                  {hasFeaturedSBTs && this.renderQuickSelectChips(
                    selectedSBTGroupsResponder,
                    this.handleAddSBTIncludeResponder,
                    'ir'
                  )}

                  <SBTSelector
                    id="excludeResponder"
                    network={effectiveNetwork}
                    provider={this.props.provider}
                    onAddSBT={this.handleAddSBTExcludeResponder}
                    onRemoveSBT={this.handleRemoveSBTExcludeResponder}
                    selectedSBTs={excludedSBTGroupsResponder}
                    sessionSlug={this.props.sessionSlug}
                    label={'Exclude Responses from SBT Holders'}
                    defaultFeaturedSBTs={defaultFeaturedSBTs}
                    showAllSBTs={showAllSBTs}
                    sbtCacheRevision={this.props.sbtCacheRevision}
                  />
                  {hasFeaturedSBTs && this.renderQuickSelectChips(
                    excludedSBTGroupsResponder,
                    this.handleAddSBTExcludeResponder,
                    'er'
                  )}

                </>
              )}

              {/* Mode: 'addresses' => filter addresses by SBT group(s) */}
              {mode === 'addresses' && (
                <>
                  <SBTSelector
                    id="includeAddresses"
                    network={effectiveNetwork}
                    provider={this.props.provider}
                    onAddSBT={this.handleAddSBTInclude}
                    onRemoveSBT={this.handleRemoveSBTInclude}
                    selectedSBTs={selectedSBTGroups}
                    sessionSlug={this.props.sessionSlug}
                    label={'Include Addresses holding SBT'}
                    defaultFeaturedSBTs={defaultFeaturedSBTs}
                    showAllSBTs={showAllSBTs}
                    sbtCacheRevision={this.props.sbtCacheRevision}
                  />
                  {hasFeaturedSBTs && this.renderQuickSelectChips(
                    selectedSBTGroups,
                    this.handleAddSBTInclude,
                    'ia'
                  )}

                  <SBTSelector
                    id="excludeAddresses"
                    network={effectiveNetwork}
                    provider={this.props.provider}
                    onAddSBT={this.handleAddSBTExclude}
                    onRemoveSBT={this.handleRemoveSBTExclude}
                    selectedSBTs={excludedSBTGroups}
                    sessionSlug={this.props.sessionSlug}
                    label={'Exclude Addresses holding SBT'}
                    defaultFeaturedSBTs={defaultFeaturedSBTs}
                    showAllSBTs={showAllSBTs}
                    sbtCacheRevision={this.props.sbtCacheRevision}
                  />
                  {hasFeaturedSBTs && this.renderQuickSelectChips(
                    excludedSBTGroups,
                    this.handleAddSBTExclude,
                    'ea'
                  )}
                </>
              )}

              {/* Mode: 'creator', 'creatorAndResponder', 'questions', or 'questionResponses' => question-based filtering */}
              {(mode === 'creator' ||
                mode === 'creatorAndResponder' ||
                mode === 'questions' ||
                mode === 'questionResponses') && (
                <>
                  {/* If creator-based filtering is relevant */}
                  {(mode === 'creator' ||
                    mode === 'creatorAndResponder' ||
                    mode === 'questions') && (
                    <>
                      <SBTSelector
                        id="includeCreator"
                        network={effectiveNetwork}
                        provider={this.props.provider}
                        onAddSBT={this.handleAddSBTIncludeCreator}
                        onRemoveSBT={this.handleRemoveSBTIncludeCreator}
                        selectedSBTs={selectedSBTGroupsCreator}
                        sessionSlug={this.props.sessionSlug}
                        label={'Include Questions created by SBT Holders'}
                        defaultFeaturedSBTs={defaultFeaturedSBTs} // Pass prop
                        showAllSBTs={showAllSBTs} // Pass state
                        sbtCacheRevision={this.props.sbtCacheRevision}
                      />
                      {hasFeaturedSBTs && this.renderQuickSelectChips(
                        selectedSBTGroupsCreator,
                        this.handleAddSBTIncludeCreator,
                        'ic'
                      )}

                      <SBTSelector
                        id="excludeCreator"
                        network={effectiveNetwork}
                        provider={this.props.provider}
                        onAddSBT={this.handleAddSBTExcludeCreator}
                        onRemoveSBT={this.handleRemoveSBTExcludeCreator}
                        selectedSBTs={excludedSBTGroupsCreator}
                        sessionSlug={this.props.sessionSlug}
                        label={'Exclude Questions created by SBT Holders'}
                        defaultFeaturedSBTs={defaultFeaturedSBTs} // Pass prop
                        showAllSBTs={showAllSBTs} // Pass state
                        sbtCacheRevision={this.props.sbtCacheRevision}
                      />
                      {hasFeaturedSBTs && this.renderQuickSelectChips(
                        excludedSBTGroupsCreator,
                        this.handleAddSBTExcludeCreator,
                        'ec'
                      )}
                    </>
                  )}

                  {/* If responder-based filtering is relevant */}
                  {(mode === 'responder' ||
                    mode === 'creatorAndResponder' ||
                    mode === 'questionResponses') && (
                    <>
                      <h5>SBT Group(s) of Question Responder</h5>
                      <SBTSelector
                        id="includeResponder2"
                        network={effectiveNetwork}
                        provider={this.props.provider}
                        onAddSBT={this.handleAddSBTIncludeResponder}
                        onRemoveSBT={this.handleRemoveSBTIncludeResponder}
                        selectedSBTs={selectedSBTGroupsResponder}
                        sessionSlug={this.props.sessionSlug}
                        label={'Include Responses from SBT Holders'}
                        defaultFeaturedSBTs={defaultFeaturedSBTs} // Pass prop
                        showAllSBTs={showAllSBTs} // Pass state
                        sbtCacheRevision={this.props.sbtCacheRevision}
                      />
                      {hasFeaturedSBTs && this.renderQuickSelectChips(
                        selectedSBTGroupsResponder,
                        this.handleAddSBTIncludeResponder,
                        'ir2'
                      )}

                      <SBTSelector
                        id="excludeResponder2"
                        network={effectiveNetwork}
                        provider={this.props.provider}
                        onAddSBT={this.handleAddSBTExcludeResponder}
                        onRemoveSBT={this.handleRemoveSBTExcludeResponder}
                        selectedSBTs={excludedSBTGroupsResponder}
                        sessionSlug={this.props.sessionSlug}
                        label={'Exclude Responses from SBT Holders'}
                        defaultFeaturedSBTs={defaultFeaturedSBTs} // Pass prop
                        showAllSBTs={showAllSBTs} // Pass state
                        sbtCacheRevision={this.props.sbtCacheRevision}
                      />
                      {hasFeaturedSBTs && this.renderQuickSelectChips(
                        excludedSBTGroupsResponder,
                        this.handleAddSBTExcludeResponder,
                        'er2'
                      )}

                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default SBTFilter;
