/** @file CreateQuestionsAndSurveys.jsx */

import React, { Component } from 'react';
import {
  Button,
  Label,
  Input,
  FormGroup,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSpinner,
  faClipboard,
  faPlus,
  faTimes,
  faBookmark,
  faCheck,
  faPenNib,
  faGlobe,
  faExternalLinkAlt,
  faMagic,
  faExclamationCircle,
  faCaretDown,
  faCaretUp,
  faEraser,
  faQuestionCircle
} from '@fortawesome/free-solid-svg-icons';
import styles from './CreateQuestionsAndSurveys.module.scss';
import { arweaveScripts } from '../../utilities/arweave/arweaveScripts';
import CETooltip from '../Shared/CETooltip';
import CEConfirmDialog from '../Shared/CEConfirmDialog.jsx';
import { normalizeArweaveUrl, parseArweaveTxId } from '../../utilities/arweave/arweaveUrls.js';
import contractScripts, { getSessionConfigBySlug, normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import {
  buildSbtAccessControlConditions,
  resolveLitChain,
  getGlobalLitHooks,
  litStorage,
} from '../../utilities/crypto/litProtocol.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { getEffectiveArweaveKey } from '../../utilities/session/resourceKeys.js';
import { sessionRegistryUtils } from '../../utilities/web3/sessionRegistry.js';
import { ethers } from 'ethers';
import sha256 from 'crypto-js/sha256';
import AudioSurveyGenerator from './SurveyGenerator/SurveyGenerator.jsx';
import { callAI } from '../../utilities/ai/aiScripts.js';
import { getEffectiveAiConfig } from '../../utilities/ai/aiSettings.js';
import { seedGenPrompt } from '../../prompts/seedGenPrompt.js';
import { JsonButtonRow, JsonPanel, JsonToggleButton } from '../Shared/Json/JsonControls';
import GateMultiSelectLock from '../Gates/GateMultiSelectLock.jsx';
import {
  getGateSbtAddresses,
  normalizeGateMode,
  resolveSponsoredGateStateForResource,
  SPONSORED_GATE_STATES,
} from '../../utilities/web3/sponsoredAccess.js';
import { resolveEncryptionGate } from '../../utilities/crypto/encryptionGates.js';
import { buildUploadGatePolicy } from '../../utilities/crypto/litGatePolicy.js';
import { createLogger } from 'utilities/logging.js';
import { buildQuestionRoutePath } from '../../utilities/survey/questionRouting.js';
import { mergeSessionContractMaps, resolveActiveSessionSlug } from '../../utilities/session/sessionNaming.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  peekCacheSync,
  subscribeCacheUpdates,
  writeCache,
  writeCacheOptimistic,
} from '../../utilities/cache/cacheScripts.js';
import { createCacheUpdateCoalescer } from '../../utilities/cache/cacheUpdateCoalescer.js';
import { generateQuestionId as generateSharedQuestionId } from '../../utilities/shared/questionUtils.mjs';
import { notify } from '../../utilities/ui/notify.js';
import { t } from '../../utilities/ui/terminology.js';
import { canonicalizeLegacySessionAlias } from '../../utilities/session/sessionDemoCompat.js';
import { chainHttpRpc, chainHttpRpcNoPath, getChainById } from '../../variables/chains.js';

const surveyLog = createLogger('surveys');



// Helper function to construct the AI prompt for single question tag generation
const generateSingleQuestionTagsPrompt = (questionText, questionType, questionOptions, defaultTagsList) => {
  let prompt = `Analyze the following survey question and generate 2-5 relevant tags.
Question Prompt: "${questionText}"
Question Type: "${questionType}"`;

  if (questionType === 'multichoice' && questionOptions && questionOptions.length > 0) {
    prompt += `\nQuestion Options: ${questionOptions.map(opt => `"${opt}"`).join(', ')}`;
  }

  if (defaultTagsList && defaultTagsList.length > 0) {
    prompt += `\n\nIf any of the following default tags are relevant, prioritize using them: [${defaultTagsList.map(tag => `"${tag}"`).join(', ')}]. Otherwise, generate new appropriate tags.`;
  } else {
    prompt += `\n\nGenerate new appropriate tags.`;
  }

  prompt += `\n\nReturn the tags as a JSON object with a single key "tags" containing an array of strings. For example: {"tags": ["example tag 1", "another tag"]}`;
  return prompt;
};

const isPlainObject = (value) => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const ENCRYPTION_GATE_COLORS = ['#5affc2', '#5b8cff', '#ffb347', '#ff6bcb', '#ffd166'];
const stableGateColor = (gateId) => {
  const str = String(gateId || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash * 31) + str.charCodeAt(i)) >>> 0;
  }
  return ENCRYPTION_GATE_COLORS[hash % ENCRYPTION_GATE_COLORS.length];
};

const normalizeGateIds = (value) => {
  if (Array.isArray(value)) {
    return value.map((id) => String(id || '').trim()).filter(Boolean);
  }
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw ? [raw] : [];
};

const normalizeGateText = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\[object\s+object\]$/i.test(text)) return '';
  return text;
};

const normalizeAddressList = (values = []) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const address = String(value || '').trim();
    if (!address) return;
    const key = address.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(address);
  });
  return out;
};

const normalizeTagList = (values = []) => (
  (Array.isArray(values) ? values : [])
    .filter((tag) => (
      tag != null &&
      (
        typeof tag === 'string' ||
        typeof tag === 'number' ||
        typeof tag === 'boolean'
      )
    ))
    .map((tag) => String(tag).trim())
    .filter((tag) => tag && tag !== '[object Object]')
);

const DOCUMENT_URL_ERROR_TEXT = 'Document URLs must use http://, https://, a root-relative path (/...), ar://, or a supported Lit encrypted-doc URL.';

const normalizeDocumentUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (litStorage.isLitArweaveUrl(trimmed)) return trimmed;
  if (trimmed.startsWith('ar://')) {
    return parseArweaveTxId(trimmed) ? trimmed : '';
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const protocol = String(parsed.protocol || '').toLowerCase();
    return protocol === 'http:' || protocol === 'https:' ? trimmed : '';
  } catch (_) {
    return '';
  }
};

export const sanitizeDocumentUrls = (values = []) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const normalized = normalizeDocumentUrl(value);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
};

const findFirstBlankQuestionPromptIndex = (questions = []) => (
  (Array.isArray(questions) ? questions : []).findIndex(
    (question) => String(question?.prompt || '').trim() === ''
  )
);

const AUTHORING_GATE_RESOURCE_LABELS = Object.freeze({
  default: 'default',
  questionResponses: 'questions',
  surveyResponses: 'survey',
});

export const readManagedCacheSnapshot = (namespace, slug = '') => {
  return peekCacheSync(namespace, slug, { clone: false });
};

export const selectManagedNetBucketSnapshot = (namespace, slug, netKey) => {
  const obj = readManagedCacheSnapshot(namespace, slug);
  if (!obj || !netKey) return null;
  return obj[netKey] || null;
};

export const hasSubmittedResourcesInManagedCache = ({
  slug = '',
  netId = '',
  surveyAddedSuccessfully = false,
  questionsAddedSuccessfully = false,
  surveyId = '',
  questionIds = [],
} = {}) => {
  const netKey = String(netId || '');
  if (!netKey) return false;

  const surveyIdLower = String(surveyId || '').toLowerCase();
  const questionIdsLower = (Array.isArray(questionIds) ? questionIds : [])
    .map((id) => String(id || '').toLowerCase())
    .filter(Boolean);

  if (surveyAddedSuccessfully && surveyIdLower) {
    const netBucket = selectManagedNetBucketSnapshot('surveysCache', slug, netKey);
    return !!(netBucket && netBucket.surveys && netBucket.surveys[surveyIdLower]);
  }

  if (questionsAddedSuccessfully && questionIdsLower.length > 0) {
    const netBucket = selectManagedNetBucketSnapshot('questionsCache', slug, netKey);
    const map = (netBucket && netBucket.questions) || {};
    return questionIdsLower.every((id) => !!map[id]);
  }

  return false;
};

const ensureManagedSurveysNet = (current = {}, netId = '') => {
  const next = (current && typeof current === 'object') ? { ...current } : {};
  const netKey = String(netId || '').trim();
  if (!netKey) return next;
  const bucket = (next[netKey] && typeof next[netKey] === 'object') ? { ...next[netKey] } : {};
  next[netKey] = {
    surveysLatestBlock: Number(bucket.surveysLatestBlock || 0) || 0,
    surveys: (bucket.surveys && typeof bucket.surveys === 'object') ? { ...bucket.surveys } : {},
    surveyResponses: (bucket.surveyResponses && typeof bucket.surveyResponses === 'object') ? bucket.surveyResponses : {},
    surveyResponsesLatestBlock: (bucket.surveyResponsesLatestBlock && typeof bucket.surveyResponsesLatestBlock === 'object')
      ? bucket.surveyResponsesLatestBlock
      : {},
    pendingSurveyMetadata: (bucket.pendingSurveyMetadata && typeof bucket.pendingSurveyMetadata === 'object')
      ? { ...bucket.pendingSurveyMetadata }
      : {},
  };
  return next;
};

const RECENT_QUESTION_PAYLOADS_KEY = 'dg:recentQuestionPayloads';
const RECENT_QUESTION_PAYLOADS_LIMIT = 300;
const RECENT_QUESTION_PAYLOADS_TTL_MS = 12 * 60 * 60 * 1000;

// Keep a stable reference when no session config was provided. Returning a new `{}` on
// every access causes `componentDidUpdate` to think the config changed and can create
// an infinite update loop.
const EMPTY_SESSION_CONFIG = {};
const AI_PROVIDER_LABELS = Object.freeze({
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  custom: 'Custom',
  local: 'Local',
});
const CREATE_SURVEY_DRAFT_SAVE_DEBOUNCE_MS = 180;
const CREATE_SURVEY_COPY_SUCCESS_KEYS = Object.freeze([
  'copySurveyIdSuccess',
  'copySurveyLinkSuccess',
  'copyJsonSuccess',
  'aiPromptCopySuccess',
]);
const formatAiPromptModelLabel = (config = {}) => {
  const providerKey = String(config?.provider || '').trim().toLowerCase();
  const model = String(config?.model || '').trim();
  const provider =
    AI_PROVIDER_LABELS[providerKey] ||
    (providerKey ? `${providerKey.charAt(0).toUpperCase()}${providerKey.slice(1)}` : '');
  if (provider && model) return `${provider} ${model}`;
  return model || provider || 'Configured model';
};

class CreateQuestionsAndSurveys extends Component {
  constructor(props) {
    super(props);
    this.state = {
      title: '',
      questions: [],
      addingQuestionType: 'Question Type',
      surveySubmitted: false,
      surveyHash: '',
      isSubmitting: false,
      progress: 0,
      showJson: false,
      isStandaloneQuestion: true, // default to Questions mode
      associatedSurveyId: '',
      surveyAddedSuccessfully: false,
      questionsAddedSuccessfully: false,
      uploadedQuestions: [],
      submissionError: '',
      copySurveyIdSuccess: false,
      copySurveyLinkSuccess: false,
      lastSubmittedSurveyId: '',
      lastSubmittedSurveyArweaveTxId: '',

      showAutoTool: true,
      documentURLs: sanitizeDocumentUrls(props.documentURLs || []),
      autoPopulateAiTags: true,

      // New UX state
      showSubmitSteps: false,
      submitStep: 0, // 0=none, 1=arweave, 2=contracts, 3=done
      copyJsonSuccess: false,
      bookmarkedQuestionsSet: new Set(),
      bookmarkedSurveysSet: new Set(),
      cacheLoaded: false,

      // Minimal manual doc URL field (single source buffer)
      docURLInput: (sanitizeDocumentUrls(props.documentURLs || [])[0]) || '',

      // Auto-focus target (replaces scrollTargetUiKey)
      focusTargetUiKey: null,

      // Show AI Prompt panel
      showAIPrompt: false,
      aiPromptText: '',
      aiPromptLoaded: false,
      aiPromptCopySuccess: false,
      aiPromptModelLabel: 'Configured model',

      // Wagmi network switch requirement
      needsNetworkSwitch: false,
      showClearFormConfirm: false,

      // Lock-driven Lit encryption
      surveyLockGateIds: [],
      openLockKey: '',
    };
    this._isMounted = false;

    // Refs for auto-focusing prompts
    this._promptRefs = {};
    this._encryptionGateTouched = false;

    let initialQuestions = [];
    if (props.preformedQuestions && props.preformedQuestions.length > 0) {
      initialQuestions = props.preformedQuestions.map((q, index) => {
        const aiTags = normalizeTagList(q.tags);
        const singleSelect = !!(q.singleSelect || q.oneSelectionOnly);
        return {
          ...q,
          id: q.id || this.generateQuestionId(q.type, q.prompt, q.options, singleSelect),
          uiKey: q.uiKey || `preformed-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tags: this.state.autoPopulateAiTags ? [...aiTags] : [],
          aiGeneratedTagsFromSource: [...aiTags],
          options: q.type === 'multichoice' && Array.isArray(q.options) ? q.options : (q.type === 'multichoice' ? [] : undefined),
          singleSelect,
          currentTagInputValue: '',
          isGeneratingTags: false,
        };
      });

      if (props.preformedSurvey && props.preformedSurvey.title) {
        this.state.title = props.preformedSurvey.title;
        this.state.isStandaloneQuestion = false;
      } else {
        this.state.isStandaloneQuestion = !props.preformedSurvey?.title;
      }
      this.state.documentURLs = sanitizeDocumentUrls(props.documentURLs || []);
      // If props provided URLs, we don't necessarily want to pre-fill the input buffer, just the list
      this.state.docURLInput = '';
    }
    this.state.questions = initialQuestions;
    this._cacheWatchTimer = null;
    this._cacheWatchUnsubscribe = null;
    this._cacheWatchCoalescer = null;
    this._cacheWatchCheckNow = null;
    this._draftSaveTimer = null;
    this._lastSavedUnfinishedSurveyJson = null;
    this._copySuccessResetTimers = {
      copySurveyIdSuccess: null,
      copySurveyLinkSuccess: null,
      copyJsonSuccess: null,
      aiPromptCopySuccess: null,
    };
  }

  componentDidMount() {
    this._isMounted = true;
    if (this.state.showAIPrompt) {
      this.refreshAIPromptModelLabel();
    }
    let hydrated = false;
    if (!this.props.preformedQuestions || this.props.preformedQuestions.length === 0) {
      hydrated = this.loadFromLocalStorage();
      if (!hydrated) {
        this.updateSurveyHash();
      }
    } else {
      this.updateSurveyHash();
    }

    this.setState({
      isSubmitting: false,
      progress: 0,
      submissionError: '',
    });

    // Load bookmarks once for icon color feedback
    this.loadBookmarksIntoState();

    // Prime wagmi network guard state
    this.updateNeedsNetworkSwitch();
  }

  componentWillUnmount() {
    this.saveToLocalStorage({ immediate: true });
    this._isMounted = false;
    this.clearCopySuccessTimers();
    this.clearCacheWatch();
    if (this._draftSaveTimer) {
      clearTimeout(this._draftSaveTimer);
      this._draftSaveTimer = null;
    }
  }

  clearUnfinishedSurveyDraft = () => {
    localStorage.removeItem('unfinishedSurvey');
    this._lastSavedUnfinishedSurveyJson = null;
  };

  clearCopySuccessTimer = (stateKey) => {
    if (!stateKey) return;
    const timeoutId = this._copySuccessResetTimers?.[stateKey];
    if (!timeoutId) return;
    clearTimeout(timeoutId);
    this._copySuccessResetTimers[stateKey] = null;
  };

  clearCopySuccessTimers = () => {
    CREATE_SURVEY_COPY_SUCCESS_KEYS.forEach((stateKey) => {
      const timeoutId = this._copySuccessResetTimers?.[stateKey];
      if (!timeoutId) return;
      clearTimeout(timeoutId);
      this._copySuccessResetTimers[stateKey] = null;
    });
  };

  setCopySuccessState = (stateKey, durationMs = 1500) => {
    if (!CREATE_SURVEY_COPY_SUCCESS_KEYS.includes(stateKey)) return;
    this.clearCopySuccessTimer(stateKey);
    if (!this._isMounted) return;
    this.setState({ [stateKey]: true });
    this._copySuccessResetTimers[stateKey] = setTimeout(() => {
      this._copySuccessResetTimers[stateKey] = null;
      if (!this._isMounted) return;
      this.setState({ [stateKey]: false });
    }, Math.max(0, Number(durationMs) || 0));
  };

  getSessionConfig = (props = this.props) => (
    (props.sessionConfig && typeof props.sessionConfig === 'object')
      ? props.sessionConfig
      : EMPTY_SESSION_CONFIG
  );

  getResolvedSessionConfig = (props = this.props) => {
    const propConfig = this.getSessionConfig(props);
    const propsSlug = resolveActiveSessionSlug({
      activeSessionSlug: props.activeSessionSlug,
      sessionSlug: props.sessionSlug,
    });
    const slug = normalizeSessionSlug(propConfig.slug || propsSlug || '');
    const canonicalConfig = getSessionConfigBySlug(slug) || {};
    const contractsFromProps =
      props.contracts && typeof props.contracts === 'object'
        ? props.contracts
        : {};

    const mergedContracts = mergeSessionContractMaps(
      canonicalConfig.contracts,
      contractsFromProps,
      propConfig.contracts
    );
    const resolvedNetworkChainId = Number(
      propConfig.networkChainId ||
      propConfig?.contracts?.surveys?.chainId ||
      propConfig?.contracts?.sbtFactory?.chainId ||
      propConfig?.__registry?.chainId ||
      propConfig?.__registry?.registryChainId ||
      canonicalConfig.networkChainId ||
      canonicalConfig?.contracts?.surveys?.chainId ||
      canonicalConfig?.contracts?.sbtFactory?.chainId ||
      canonicalConfig?.__registry?.chainId ||
      canonicalConfig?.__registry?.registryChainId ||
      props.networkChainId ||
      props.network?.id ||
      props.network?.chainId ||
      0
    ) || null;

    return {
      ...canonicalConfig,
      ...propConfig,
      slug,
      contracts: mergedContracts,
      networkChainId: resolvedNetworkChainId,
    };
  };

  resolveSessionChainId = (sessionConfigIn = null, props = this.props) => {
    const sessionConfig =
      sessionConfigIn && typeof sessionConfigIn === 'object'
        ? sessionConfigIn
        : this.getResolvedSessionConfig(props);
    return Number(
      sessionConfig?.networkChainId ||
      sessionConfig?.contracts?.surveys?.chainId ||
      sessionConfig?.contracts?.sbtFactory?.chainId ||
      sessionConfig?.__registry?.chainId ||
      sessionConfig?.__registry?.registryChainId ||
      props.networkChainId ||
      props.network?.id ||
      props.network?.chainId ||
      0
    ) || null;
  };

  resolveTargetNetwork = (sessionConfigIn = null, props = this.props) => {
    const chainId = this.resolveSessionChainId(sessionConfigIn, props);
    const propNetworkChainId = Number(props.network?.id || props.network?.chainId || 0) || null;
    if (!chainId) return props.network || null;
    if (propNetworkChainId === chainId) return props.network || null;
    return getChainById(chainId) || props.network || null;
  };

  resolveLockAudienceSessionName = (cfgIn = this.getResolvedSessionConfig()) => {
    const cfg = (cfgIn && typeof cfgIn === 'object') ? cfgIn : {};
    const direct = normalizeGateText(cfg.sessionName || cfg.slug);
    if (direct) return direct;
    const activeSlug = normalizeGateText(this.getActiveSessionSlug());
    return activeSlug || 'session';
  };

  resolveGateOptions = (cfgIn = this.getResolvedSessionConfig(), { isStandaloneQuestion = this.state?.isStandaloneQuestion } = {}) => {
    const cfg = (cfgIn && typeof cfgIn === 'object') ? cfgIn : {};
    const fullEncryptionGateMap = isPlainObject(cfg?.encryption?.gates) ? cfg.encryption.gates : null;
    const fullSponsoredGateMap = isPlainObject(cfg?.sponsored?.gates) ? cfg.sponsored.gates : null;
    const fullGateMap = (fullEncryptionGateMap && Object.keys(fullEncryptionGateMap).length)
      ? fullEncryptionGateMap
      : (fullSponsoredGateMap && Object.keys(fullSponsoredGateMap).length ? fullSponsoredGateMap : {});
    const primaryResource = isStandaloneQuestion ? 'questionResponses' : 'surveyResponses';
    const sessionLabel = this.resolveLockAudienceSessionName(cfg);
    const relevantGates = [];
    const seenGateIds = new Set();
    const seenGateKeys = new Set();

    const pushRelevantGate = (seedGate = null, resourceKey = '') => {
      if (!seedGate || typeof seedGate !== 'object') return;

      const candidateIds = [
        seedGate.gateId,
        seedGate.id,
      ].map((value) => normalizeGateText(value)).filter(Boolean);
      const seedAddresses = normalizeAddressList([
        ...(Array.isArray(seedGate.sbtAddresses) ? seedGate.sbtAddresses : []),
        seedGate.sbtAddress,
      ]);
      const seedAddressKey = seedAddresses.map((address) => address.toLowerCase()).sort().join('|');

      let resolvedGateId = candidateIds[0] || '';
      let resolvedGate = resolvedGateId ? fullGateMap?.[resolvedGateId] : null;

      if (!resolvedGate && seedAddressKey) {
        Object.entries(fullGateMap || {}).some(([gateId, gate]) => {
          const gateAddresses = normalizeAddressList([
            ...(Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : []),
            gate?.sbtAddress,
          ]);
          const gateAddressKey = gateAddresses.map((address) => address.toLowerCase()).sort().join('|');
          if (!gateAddressKey || gateAddressKey !== seedAddressKey) return false;
          resolvedGateId = normalizeGateText(gateId);
          resolvedGate = gate;
          return true;
        });
      }

      const finalGateId = normalizeGateText(resolvedGateId || resourceKey || `gate-${relevantGates.length + 1}`);
      const mergedGate = {
        ...seedGate,
        ...(resolvedGate && typeof resolvedGate === 'object' ? resolvedGate : {}),
        id: finalGateId,
        gateId: finalGateId,
        resourceKey: normalizeGateText(resourceKey || seedGate.resourceKey || primaryResource) || primaryResource,
      };
      const mergedAddresses = normalizeAddressList([
        ...(Array.isArray(mergedGate.sbtAddresses) ? mergedGate.sbtAddresses : []),
        mergedGate.sbtAddress,
      ]);
      mergedGate.sbtAddresses = mergedAddresses;
      mergedGate.sbtAddress = mergedAddresses[0] || '';

      const dedupeKey = JSON.stringify({
        gateId: finalGateId.toLowerCase(),
        resourceKey: mergedGate.resourceKey.toLowerCase(),
        sbtAddresses: mergedAddresses.map((address) => address.toLowerCase()).sort(),
      });
      if (seenGateIds.has(finalGateId.toLowerCase()) || seenGateKeys.has(dedupeKey)) return;
      seenGateIds.add(finalGateId.toLowerCase());
      seenGateKeys.add(dedupeKey);
      relevantGates.push(mergedGate);
    };

    const primaryState = resolveSponsoredGateStateForResource(cfg, primaryResource);
    const primaryExplicitOpen = primaryState?.status === SPONSORED_GATE_STATES.OPEN;
    if (primaryState?.status === SPONSORED_GATE_STATES.RESTRICTED && primaryState.gate) {
      pushRelevantGate(primaryState.gate, primaryResource);
    }

    if (!primaryExplicitOpen) {
      const defaultState = resolveSponsoredGateStateForResource(cfg, 'default');
      if (defaultState?.status === SPONSORED_GATE_STATES.RESTRICTED && defaultState.gate) {
        pushRelevantGate(defaultState.gate, 'default');
      }
    }

    if (!relevantGates.length) {
      const resources = (cfg?.sponsored && typeof cfg.sponsored === 'object' && cfg.sponsored.resources && typeof cfg.sponsored.resources === 'object')
        ? cfg.sponsored.resources
        : {};
      const primaryResourceCfg = (resources?.[primaryResource] && typeof resources[primaryResource] === 'object')
        ? resources[primaryResource]
        : {};
      const defaultResourceCfg = (resources?.default && typeof resources.default === 'object')
        ? resources.default
        : {};
      const fallbackIds = [
        ...(Array.isArray(primaryResourceCfg.gateIds) ? primaryResourceCfg.gateIds : []),
        primaryResourceCfg.gateId,
        ...(Array.isArray(defaultResourceCfg.gateIds) ? defaultResourceCfg.gateIds : []),
        defaultResourceCfg.gateId,
        cfg?.sponsored?.defaultGateId,
      ]
        .map((value) => normalizeGateText(value))
        .filter(Boolean);
      fallbackIds.forEach((gateId) => {
        const resourceKey = gateId === normalizeGateText(cfg?.sponsored?.defaultGateId) ? 'default' : primaryResource;
        pushRelevantGate({ gateId, resourceKey }, resourceKey);
      });
    }

    const gateMap = {};
    relevantGates.forEach((gate) => {
      if (!gate?.id) return;
      gateMap[gate.id] = gate;
    });
    const gateIds = Object.keys(gateMap || {}).filter(Boolean).sort();
    const multipleGateOptions = gateIds.length > 1;
    const gateOptions = gateIds.map((gateId) => {
      const gate = gateMap[gateId] || {};
      const color = String(gate.color || stableGateColor(gateId));
      const sbtAddresses = normalizeAddressList([
        ...(Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses : []),
        gate.sbtAddress,
      ]);
      const mode = String(
        gate.mode ||
        gate.operator ||
        gate.gateMode ||
        (gate.requireAll === true ? 'all' : '')
      ).trim();
      const resourceKey = normalizeGateText(gate.resourceKey) || primaryResource;
      const resourceLabel = AUTHORING_GATE_RESOURCE_LABELS[resourceKey] || resourceKey;
      const displayLabel = multipleGateOptions
        ? `${sessionLabel} (${resourceLabel})`
        : sessionLabel;
      return {
        id: gateId,
        label: displayLabel,
        displayLabel,
        badgeLabel: sessionLabel,
        color,
        mode,
        requireAll: gate.requireAll === true,
        sbtAddresses,
        sbtAddress: sbtAddresses[0] || '',
        resourceKey,
      };
    });

    const candidateDefaults = [
      primaryState?.status === SPONSORED_GATE_STATES.RESTRICTED
        ? normalizeGateText(primaryState?.gate?.gateId || primaryState?.gate?.id)
        : '',
      !primaryExplicitOpen
        ? normalizeGateText(resolveSponsoredGateStateForResource(cfg, 'default')?.gate?.gateId || resolveSponsoredGateStateForResource(cfg, 'default')?.gate?.id)
        : '',
      gateOptions[0]?.id,
    ]
      .map((val) => normalizeGateText(val))
      .filter(Boolean);
    const defaultGateId = candidateDefaults.find((gateId) => gateIds.includes(gateId)) || (gateOptions[0]?.id || '');

    return { gateMap, gateOptions, defaultGateId };
  };

  ensureResolvedSessionConfigForSubmit = async (sessionConfigIn = this.getResolvedSessionConfig()) => {
    const baseConfig = (sessionConfigIn && typeof sessionConfigIn === 'object') ? sessionConfigIn : {};
    const slug = normalizeSessionSlug(baseConfig.slug || this.getActiveSessionSlug() || '');
    const mergedBase = {
      ...baseConfig,
      slug,
      contracts: mergeSessionContractMaps(baseConfig.contracts),
    };
    const surveysAddress = String(mergedBase?.contracts?.surveys?.address || '').trim();
    if (surveysAddress) return mergedBase;

    const registryChainId = Number(
      mergedBase?.__registry?.registryChainId ||
      mergedBase?.__registry?.chainId ||
      mergedBase?.networkChainId ||
      this.props.networkChainId ||
      this.props.network?.id ||
      this.props.network?.chainId ||
      0
    ) || 0;
    if (!registryChainId) return mergedBase;

    try {
      const fetched = await sessionRegistryUtils.fetchSessionFromRegistry({
        chainId: registryChainId,
        slug,
        providerLike: this.props.provider,
        account: this.props.account,
        lit: getGlobalLitHooks(),
      });
      if (!fetched || typeof fetched !== 'object') return mergedBase;

      sessionRegistryUtils.upsertSessionRegistryCache({ config: fetched });
      return {
        ...fetched,
        ...mergedBase,
        slug,
        contracts: mergeSessionContractMaps(fetched.contracts, mergedBase.contracts),
        __registry: {
          ...(fetched.__registry || {}),
          ...(mergedBase.__registry || {}),
        },
        networkChainId:
          mergedBase.networkChainId ||
          fetched.networkChainId ||
          registryChainId ||
          null,
      };
    } catch (_) {
      return mergedBase;
    }
  };

  getActiveSessionSlug = (props = this.props) => {
    const sessionConfig = this.getSessionConfig(props);
    const hasSessionSlugAlias =
      Object.prototype.hasOwnProperty.call(props, 'activeSessionSlug') ||
      Object.prototype.hasOwnProperty.call(props, 'sessionSlug');

    if (hasSessionSlugAlias) {
      return resolveActiveSessionSlug({
        activeSessionSlug: props.activeSessionSlug,
        sessionSlug: props.sessionSlug,
      });
    }
    if (typeof sessionConfig.slug === 'string') {
      return normalizeSessionSlug(sessionConfig.slug);
    }
    return '';
  };

  buildAiRequestOptions = (props = this.props) => {
    const resolvedSessionConfig = this.getResolvedSessionConfig(props);
    const sessionSlug = this.getActiveSessionSlug(props);
    return {
      sessionSlug: sessionSlug || '',
      sessionConfig: resolvedSessionConfig,
      context: {
        account: props.account,
        providerLike: props.provider,
        chainId: this.resolveSessionChainId(resolvedSessionConfig, props),
      },
    };
  };

  refreshAIPromptModelLabel = async (props = this.props) => {
    try {
      const options = this.buildAiRequestOptions(props);
      const aiCfg = await getEffectiveAiConfig({
        sessionSlug: options.sessionSlug,
        context: options.context,
        resolveSecrets: false,
      });
      if (!this._isMounted) return;
      this.setState({ aiPromptModelLabel: formatAiPromptModelLabel(aiCfg) });
    } catch {
      if (!this._isMounted) return;
      this.setState({ aiPromptModelLabel: 'Configured model' });
    }
  };

  componentDidUpdate(prevProps, prevState) {
    // Keep documentURLs synced from props if they change externally (e.g. AudioSurveyGenerator generation)
    if (prevProps.documentURLs !== this.props.documentURLs && Array.isArray(this.props.documentURLs)) {
      // If props update, we overwrite local state to match
      this.setState({ documentURLs: sanitizeDocumentUrls(this.props.documentURLs) }, () => {
        this.updateSurveyHash();
        this.saveToLocalStorage();
      });
    }

    // Auto-focus to first newly added question if requested
    if (this.state.focusTargetUiKey) {
      const el = this._promptRefs[this.state.focusTargetUiKey];
      if (el) {
        // Simple focus
        el.focus();
        this.setState({ focusTargetUiKey: null });
      } else {
        // Fallback if ref isn't ready immediately
        setTimeout(() => {
          if (!this._isMounted) return;
          const focusTargetUiKey = this.state.focusTargetUiKey;
          if (!focusTargetUiKey) return;
          const el2 = this._promptRefs[focusTargetUiKey];
          if (el2) {
            el2.focus();
            this.setState({ focusTargetUiKey: null });
          }
        }, 50);
      }
    }

    // Re-evaluate the need to switch network on relevant session changes
    if (
      prevProps.provider !== this.props.provider ||
      prevProps.loginComplete !== this.props.loginComplete ||
      (prevProps.network && this.props.network && prevProps.network.id !== this.props.network.id)
    ) {
      this.updateNeedsNetworkSwitch();
    }

    const prevSessionSlug = this.getActiveSessionSlug(prevProps);
    const nextSessionSlug = this.getActiveSessionSlug(this.props);
    const sessionSlugChanged = prevSessionSlug !== nextSessionSlug;
    const prevSessionConfig = this.getSessionConfig(prevProps);
    const nextSessionConfig = this.getSessionConfig(this.props);
    const sessionConfigChanged = prevSessionConfig !== nextSessionConfig;

    if (sessionSlugChanged) {
      this.setState((prev) => ({
        surveyLockGateIds: [],
        openLockKey: '',
        questions: (Array.isArray(prev.questions) ? prev.questions : []).map((q) => ({
          ...(q || {}),
          lockGateIds: prev.isStandaloneQuestion ? [] : null,
        })),
      }), this.saveToLocalStorage);
    } else if (sessionConfigChanged) {
      // Close any open popovers; gate IDs are validated at use-time.
      this.setState({ openLockKey: '' });
    }

    if (
      this.state.showAIPrompt &&
      (
        sessionSlugChanged ||
        sessionConfigChanged ||
        prevProps.account !== this.props.account ||
        prevProps.provider !== this.props.provider ||
        prevProps.network?.id !== this.props.network?.id
      )
    ) {
      this.refreshAIPromptModelLabel();
    }
  }

  loadBookmarksIntoState = () => {
    try {
      const slug = this.getActiveSessionSlug() || '';
      const parsed = readManagedCacheSnapshot('bookmarksCache', slug) || { surveys: [], questions: [] };
      const s = new Set(Array.isArray(parsed.surveys) ? parsed.surveys.map(x => String(x).toLowerCase()) : []);
      const q = new Set(Array.isArray(parsed.questions) ? parsed.questions.map(x => String(x).toLowerCase()) : []);
      this.setState({ bookmarkedSurveysSet: s, bookmarkedQuestionsSet: q });
    } catch {
      this.setState({ bookmarkedSurveysSet: new Set(), bookmarkedQuestionsSet: new Set() });
    }
  };

  loadFromLocalStorage = () => {
    const savedSurvey = localStorage.getItem('unfinishedSurvey');
    if (savedSurvey) {
      try {
        const parsedSurvey = JSON.parse(savedSurvey);
        const autoPopulateState = typeof parsedSurvey.autoPopulateAiTags === 'boolean'
          ? parsedSurvey.autoPopulateAiTags
          : true;

        // Drop legacy encryption toggles from older drafts.
        delete parsedSurvey.encryptSurvey;
        delete parsedSurvey.encryptQuestions;
        delete parsedSurvey.encryptQuestionTags;
        delete parsedSurvey.encryptDocUrls;
        delete parsedSurvey.encryptionGateSBTs;
        delete parsedSurvey.encryptionGateMode;

        if (parsedSurvey.questions && Array.isArray(parsedSurvey.questions)) {
          const isStandalone = !!parsedSurvey.isStandaloneQuestion;

          parsedSurvey.questions = parsedSurvey.questions.map((q, index) => {
            const aiTags = normalizeTagList(q.aiGeneratedTagsFromSource);
            const singleSelect = !!(q.singleSelect || q.oneSelectionOnly);
            let currentTags = normalizeTagList(q.tags);
            if (autoPopulateState) {
              const currentSet = new Set(currentTags);
              const missingFromSource = aiTags.filter(tag => !currentSet.has(tag));
              currentTags = [...currentTags, ...missingFromSource];
            }
            return {
              ...q,
              id: q.id || this.generateQuestionId(q.type, q.prompt, q.options, singleSelect),
              uiKey: q.uiKey || `loaded-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              tags: currentTags,
              aiGeneratedTagsFromSource: aiTags,
              options: q.type === 'multichoice' && Array.isArray(q.options) ? q.options : (q.type === 'multichoice' ? [] : undefined),
              singleSelect,
              currentTagInputValue: q.currentTagInputValue || '',
              isGeneratingTags: q.isGeneratingTags || false,
              lockGateIds: isStandalone
                ? normalizeGateIds(q.lockGateIds)
                : (
                    Object.prototype.hasOwnProperty.call(q || {}, 'lockGateIds')
                      ? (q.lockGateIds === null ? null : normalizeGateIds(q.lockGateIds))
                      : null
                  ),
            };
          });
        }

        // Ensure clean UI state (do not restore progress indicators or success states)
        delete parsedSurvey.isSubmitting;
        delete parsedSurvey.progress;
        delete parsedSurvey.showSubmitSteps;
        delete parsedSurvey.submitStep;
        delete parsedSurvey.submissionError;
        delete parsedSurvey.surveyAddedSuccessfully;
        delete parsedSurvey.questionsAddedSuccessfully;

        parsedSurvey.autoPopulateAiTags = autoPopulateState;
        parsedSurvey.documentURLs = sanitizeDocumentUrls(parsedSurvey.documentURLs || this.state.documentURLs);
        // Don't force overwrite input buffer with list content
        parsedSurvey.docURLInput = '';

        parsedSurvey.openLockKey = '';
        parsedSurvey.surveyLockGateIds = normalizeGateIds(parsedSurvey.surveyLockGateIds);

        this._lastSavedUnfinishedSurveyJson = savedSurvey;
        this.setState(parsedSurvey, () => {
          this.updateSurveyHash();
        });
        return true;
      } catch (error) {
        surveyLog.error('[CreateQuestionsAndSurveys] Error parsing saved survey from localStorage:', error);
        this.clearUnfinishedSurveyDraft();
      }
    }
    return false;
  };

  queueSaveToLocalStorage = (delayMs = CREATE_SURVEY_DRAFT_SAVE_DEBOUNCE_MS) => {
    if (this._draftSaveTimer) {
      clearTimeout(this._draftSaveTimer);
      this._draftSaveTimer = null;
    }
    this._draftSaveTimer = setTimeout(() => {
      this._draftSaveTimer = null;
      this.saveToLocalStorage({ immediate: true });
    }, Math.max(0, Number(delayMs) || 0));
  };

  saveToLocalStorage = (options = {}) => {
    const immediate = options && options.immediate === true;
    if (!immediate) {
      this.queueSaveToLocalStorage();
      return;
    }
    if (this._draftSaveTimer) {
      clearTimeout(this._draftSaveTimer);
      this._draftSaveTimer = null;
    }
    if (!this.props.preformedQuestions || this.props.preformedQuestions.length === 0) {
      const stateToSave = { ...this.state };
      if (stateToSave.questions && Array.isArray(stateToSave.questions)) {
        stateToSave.questions = stateToSave.questions.map(question => {
          const { uiKey, aiGeneratedTagsFromSource, ...restOfQuestion } = question;
          return restOfQuestion;
        });
      }
      // Clean up submission state so it doesn't persist on reload
      delete stateToSave.isSubmitting;
      delete stateToSave.progress;
      delete stateToSave.showSubmitSteps;
      delete stateToSave.submitStep;
      delete stateToSave.submissionError;
      delete stateToSave.surveyAddedSuccessfully;
      delete stateToSave.questionsAddedSuccessfully;

      const serializedDraft = JSON.stringify(stateToSave);
      if (serializedDraft === this._lastSavedUnfinishedSurveyJson) {
        return;
      }
      localStorage.setItem('unfinishedSurvey', serializedDraft);
      this._lastSavedUnfinishedSurveyJson = serializedDraft;
    }
  };

  generateQuestionId = (type, prompt, options = [], singleSelect = false) => {
    return generateSharedQuestionId(type, prompt, options, singleSelect);
  };

  handleTitleChange = (event) => {
    this.setState({ title: event.target.value }, () => {
      this.updateSurveyHash();
      this.saveToLocalStorage();
    });
  };

  handleDocURLInputChange = (e) => {
    this.setState({ docURLInput: e.target.value });
  };

  addDocumentURL = () => {
    const { docURLInput, documentURLs } = this.state;
    const trimmed = String(docURLInput || '').trim();
    if (!trimmed) return;
    const normalizedUrl = sanitizeDocumentUrls([trimmed])[0] || '';
    if (!normalizedUrl) {
      alert(DOCUMENT_URL_ERROR_TEXT);
      return;
    }
    const safeDocumentUrls = sanitizeDocumentUrls(documentURLs);

    // Prevent duplicates
    if (safeDocumentUrls.some((url) => url.toLowerCase() === normalizedUrl.toLowerCase())) {
      this.setState({ docURLInput: '' });
      return;
    }

    this.setState(
      {
        documentURLs: [...safeDocumentUrls, normalizedUrl],
        docURLInput: ''
      },
      () => {
        this.updateSurveyHash();
        this.saveToLocalStorage();
      }
    );
  };

  handleDocUrlKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.addDocumentURL();
    }
  };

  quickAdd = (type) => {
    this.setState({ addingQuestionType: type }, this.addQuestion);
  };

  addQuestion = () => {
    const type = this.state.addingQuestionType;
    if (!type || type === 'Question Type') return;

    const isMultichoice = type === 'multichoice';
    const newQuestionId = this.generateQuestionId(type, '', [], false);
    const newUiKey = `new-${this.state.questions.length}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newQuestionData = {
      id: newQuestionId,
      uiKey: newUiKey,
      type: type,
      prompt: '',
      options: isMultichoice ? [] : undefined,
      singleSelect: isMultichoice ? false : undefined,
      associatedSurveyId: '',
      tags: [],
      aiGeneratedTagsFromSource: [],
      currentTagInputValue: '',
      isGeneratingTags: false,
      lockGateIds: this.state.isStandaloneQuestion ? [] : null,
    };

    this.setState(prevState => ({
      questions: [...prevState.questions, newQuestionData],
      addingQuestionType: 'Question Type',
      focusTargetUiKey: newUiKey // Set focus target instead of scroll
    }), () => {
      this.updateSurveyHash();
      this.saveToLocalStorage();
    });
  };

  handleQuestionChange = (index, key, value) => {
    const { questions } = this.state;
    const updatedQuestions = [...questions];
    const questionToUpdate = { ...updatedQuestions[index] };

    questionToUpdate[key] = value;
    if (key === 'prompt' || key === 'type' || key === 'singleSelect') {
      questionToUpdate.id = this.generateQuestionId(
        questionToUpdate.type,
        questionToUpdate.prompt,
        questionToUpdate.options || [],
        questionToUpdate.singleSelect
      );
    }

    updatedQuestions[index] = questionToUpdate;

    this.setState({ questions: updatedQuestions }, () => {
      this.updateSurveyHash();
      this.saveToLocalStorage();
    });
  };

  handleOptionChange = (qIdx, optIdx, val) => {
    const { questions } = this.state;
    const updatedQuestions = [...questions];
    const questionToUpdate = { ...updatedQuestions[qIdx] };

    if (!Array.isArray(questionToUpdate.options)) {
      questionToUpdate.options = [];
    }
    const newOptions = [...questionToUpdate.options];
    newOptions[optIdx] = val;
    questionToUpdate.options = newOptions;
    questionToUpdate.id = this.generateQuestionId(
      questionToUpdate.type,
      questionToUpdate.prompt,
      questionToUpdate.options,
      questionToUpdate.singleSelect
    );

    updatedQuestions[qIdx] = questionToUpdate;
    this.setState({ questions: updatedQuestions }, this.saveToLocalStorage);
  };

  addOption = (questionIndex) => {
    const { questions } = this.state;
    const updatedQuestions = [...questions];
    const q = { ...updatedQuestions[questionIndex] };

    if (!q.options) q.options = [];
    const newOptions = [...q.options, ''];
    q.options = newOptions;
    q.id = this.generateQuestionId(q.type, q.prompt, q.options, q.singleSelect);

    updatedQuestions[questionIndex] = q;
    this.setState({ questions: updatedQuestions }, this.saveToLocalStorage);
  };

  removeOption = (questionIndex, optionIndex) => {
    const { questions } = this.state;
    const updatedQuestions = [...questions];
    const q = { ...updatedQuestions[questionIndex] };

    if (!Array.isArray(q.options)) q.options = [];
    const newOptions = q.options.filter((_, i) => i !== optionIndex);
    q.options = newOptions;
    q.id = this.generateQuestionId(q.type, q.prompt, q.options, q.singleSelect);

    updatedQuestions[questionIndex] = q;
    this.setState({ questions: updatedQuestions }, this.saveToLocalStorage);
  };

  removeQuestion = (index) => {
    const updated = this.state.questions.filter((_, i) => i !== index);
    this.setState({ questions: updated }, () => {
      this.updateSurveyHash();
      this.saveToLocalStorage();
    });
  };

  bookmarkQuestion = (questionId) => {
    const slug = this.getActiveSessionSlug() || '';
    let bookmarksCache;
    try {
      const parsed = peekCacheSync('bookmarksCache', slug, { clone: false });
      bookmarksCache = (parsed && typeof parsed === 'object')
        ? {
            ...parsed,
            surveys: Array.isArray(parsed.surveys) ? [...parsed.surveys] : [],
            questions: Array.isArray(parsed.questions) ? [...parsed.questions] : [],
          }
        : { surveys: [], questions: [] };
      if (
        typeof bookmarksCache !== 'object' ||
        bookmarksCache === null ||
        !Array.isArray(bookmarksCache.surveys) ||
        !Array.isArray(bookmarksCache.questions)
      ) {
        bookmarksCache = { surveys: [], questions: [] };
      }
    } catch {
      bookmarksCache = { surveys: [], questions: [] };
    }

    const idL = String(questionId).toLowerCase();
    const set = new Set(this.state.bookmarkedQuestionsSet);
    if (set.has(idL)) {
      set.delete(idL);
      bookmarksCache.questions = (bookmarksCache.questions || []).filter(x => String(x).toLowerCase() !== idL);
    } else {
      set.add(idL);
      bookmarksCache.questions = Array.from(new Set([...(bookmarksCache.questions || []), idL]));
    }

    void writeCache('bookmarksCache', slug, bookmarksCache).catch((e) => { surveyLog.warn('CreateQuestionsAndSurveys: fallback', e); });
    this.setState({ bookmarkedQuestionsSet: set });
  };

  bookmarkSurvey = (surveyId) => {
    const slug = this.getActiveSessionSlug() || '';
    let bookmarksCache;
    try {
      const parsed = peekCacheSync('bookmarksCache', slug, { clone: false });
      bookmarksCache = (parsed && typeof parsed === 'object')
        ? {
            ...parsed,
            surveys: Array.isArray(parsed.surveys) ? [...parsed.surveys] : [],
            questions: Array.isArray(parsed.questions) ? [...parsed.questions] : [],
          }
        : { surveys: [], questions: [] };
      if (
        typeof bookmarksCache !== 'object' ||
        bookmarksCache === null ||
        !Array.isArray(bookmarksCache.surveys) ||
        !Array.isArray(bookmarksCache.questions)
      ) {
        bookmarksCache = { surveys: [], questions: [] };
      }
    } catch {
      bookmarksCache = { surveys: [], questions: [] };
    }

    const idL = String(surveyId).toLowerCase();
    const set = new Set(this.state.bookmarkedSurveysSet);
    if (set.has(idL)) {
      set.delete(idL);
      bookmarksCache.surveys = (bookmarksCache.surveys || []).filter(x => String(x).toLowerCase() !== idL);
    } else {
      set.add(idL);
      bookmarksCache.surveys = Array.from(new Set([...(bookmarksCache.surveys || []), idL]));
    }

    void writeCache('bookmarksCache', slug, bookmarksCache).catch((e) => { surveyLog.warn('CreateQuestionsAndSurveys: fallback', e); });
    this.setState({ bookmarkedSurveysSet: set });
  };

  updateSurveyHash = () => {
    const { title, isStandaloneQuestion, documentURLs } = this.state;
    if (isStandaloneQuestion) {
      this.setState({ surveyHash: '' });
    } else {
      const urlsForHash = sanitizeDocumentUrls(documentURLs);
      const surveyData = { title, documentURLs: urlsForHash };
      const newHash = "0x" + sha256(JSON.stringify(surveyData)).toString();
      this.setState({ surveyHash: newHash });
    }
  };

  getEncryptionConfig = () => {
    const {
      encryptSurvey,
      encryptQuestions,
      encryptQuestionTags,
      encryptDocUrls,
      encryptionGateSBTs,
      encryptionGateMode,
      isStandaloneQuestion
    } = this.state;

    const targets = {
      survey: !isStandaloneQuestion && !!encryptSurvey,
      questions: !!encryptQuestions,
      questionTags: !!encryptQuestions && !!encryptQuestionTags,
      docUrls: !isStandaloneQuestion && !!encryptDocUrls
    };

    const enabled = targets.survey || targets.questions || targets.questionTags || targets.docUrls;
    if (!enabled) return { enabled: false };

    const sessionConfig = this.getResolvedSessionConfig();
    const chainId = this.resolveSessionChainId(sessionConfig);
    const manualSbtAddresses = (Array.isArray(encryptionGateSBTs) ? encryptionGateSBTs : [])
      .map((sbt) => sbt.address)
      .filter(Boolean);
    const manualGate = manualSbtAddresses.length
      ? {
          type: 'sbt',
          sbtAddresses: manualSbtAddresses,
          chainId,
          mode: encryptionGateMode || 'any',
        }
      : null;
    const gatePolicy = buildUploadGatePolicy({
      cfg: sessionConfig,
      targets,
      isStandaloneQuestion,
      fallbackChainId: chainId,
      manualGate,
    });
    const gates = Array.isArray(gatePolicy?.gates) ? gatePolicy.gates : [];
    const recipients = Array.isArray(gatePolicy?.recipients) ? gatePolicy.recipients : [];
    if (!recipients.length) {
      return { enabled: true, error: `Select at least one ${t('sbt')} to define the encryption ${t('gateLower')}.` };
    }

    return {
      enabled: true,
      status: 'lit-v1',
      gate: gates[0] || manualGate || null,
      gates,
      recipients,
      targets
    };
  };

  seedEncryptionGateFromConfig = (props = this.props, options = {}) => {
    const preferDefault = !!options.preferDefault;
    const sessionConfig = this.getSessionConfig(props);
    const activeSlug = this.getActiveSessionSlug(props);
    const configSlug = typeof sessionConfig.slug === 'string'
      ? normalizeSessionSlug(sessionConfig.slug)
      : null;
    if (activeSlug != null && configSlug != null && activeSlug !== configSlug) return;
    if (this._encryptionGateTouched) return;
    if ((this.state.encryptionGateSBTs || []).length > 0) return;
    const cfg = sessionConfig;
    let preferredResources;
    if (preferDefault) {
      preferredResources = this.state.isStandaloneQuestion
        ? ['default', 'questionResponses', 'lit']
        : ['default', 'surveyResponses', 'docUrls', 'lit'];
    } else {
      preferredResources = this.state.isStandaloneQuestion
        ? ['questionResponses', 'default', 'lit']
        : ['surveyResponses', 'docUrls', 'default', 'lit'];
    }
    let fallbackGate = null;
    let encounteredExplicitOpen = false;
    for (const resourceKey of preferredResources) {
      const gateState = resolveSponsoredGateStateForResource(cfg, resourceKey);
      if (gateState?.status === SPONSORED_GATE_STATES.OPEN) {
        encounteredExplicitOpen = true;
        break;
      }
      if (gateState?.gate) {
        fallbackGate = gateState.gate;
        break;
      }
    }
    if (encounteredExplicitOpen) return;
    const contentGate = resolveEncryptionGate(cfg);
    const gate = fallbackGate || contentGate;
    const addresses = getGateSbtAddresses(gate);
    if (!addresses.length) return;
    const nextMode = normalizeGateMode(gate) || 'any';
    this.setState({
      encryptionGateSBTs: addresses.map((addr) => ({ address: addr, name: addr })),
      encryptionGateMode: nextMode
    }, this.saveToLocalStorage);
  };

  toggleStandaloneQuestion = () => {
    this.setState((prev) => {
      const nextStandalone = !prev.isStandaloneQuestion;
      const nextQuestions = (Array.isArray(prev.questions) ? prev.questions : []).map((q) => {
        const current = q || {};
        const currentLock = current.lockGateIds;
        if (nextStandalone) {
          return {
            ...current,
            lockGateIds: currentLock === null ? [] : normalizeGateIds(currentLock),
          };
        }
        const normalized = Array.isArray(currentLock) ? normalizeGateIds(currentLock) : [];
        return {
          ...current,
          lockGateIds: normalized.length ? normalized : null,
        };
      });
      return {
        isStandaloneQuestion: nextStandalone,
        surveyAddedSuccessfully: false,
        questionsAddedSuccessfully: false,
        submissionError: '',
        lastSubmittedSurveyId: '',
        lastSubmittedSurveyArweaveTxId: '',
        openLockKey: '',
        surveyLockGateIds: nextStandalone ? [] : normalizeGateIds(prev.surveyLockGateIds),
        questions: nextQuestions,
      };
    }, () => {
      this.updateSurveyHash();
      this.saveToLocalStorage();
    });
  };

  handleEncryptionToggle = (event) => {
    const { name, checked } = event.target;
    this.setState({ [name]: !!checked }, () => {
      this.saveToLocalStorage();
      const shouldSeedDefaultGate = !!checked && (
        name === 'encryptSurvey' ||
        name === 'encryptQuestions' ||
        name === 'encryptDocUrls'
      );
      if (shouldSeedDefaultGate) {
        this.seedEncryptionGateFromConfig(this.props, { preferDefault: true });
      }
    });
  };

  handleAddEncryptionGateSbt = (sbt) => {
    if (!sbt || !sbt.address) return;
    this._encryptionGateTouched = true;
    this.setState((prev) => ({
      encryptionGateSBTs: [...(prev.encryptionGateSBTs || []), sbt],
    }), this.saveToLocalStorage);
  };

  handleRemoveEncryptionGateSbt = (address) => {
    if (!address) return;
    const addrLower = String(address).toLowerCase();
    this._encryptionGateTouched = true;
    this.setState((prev) => ({
      encryptionGateSBTs: (prev.encryptionGateSBTs || []).filter(
        (sbt) => String(sbt.address || '').toLowerCase() !== addrLower
      ),
    }), this.saveToLocalStorage);
  };

  handleEncryptionGateModeChange = (event) => {
    const next = event.target.value;
    this._encryptionGateTouched = true;
    this.setState({ encryptionGateMode: next }, this.saveToLocalStorage);
  };

  handleAssociatedSurveyIdChange = (index, val) => {
    const updated = [...this.state.questions];
    updated[index] = { ...updated[index], associatedSurveyId: val };
    this.setState({ questions: updated }, this.saveToLocalStorage);
  };

  removeDuplicateQuestions = (questions) => {
    const unique = [];
    const setIds = new Set();
    for (const q of questions) {
      if (!setIds.has(q.id)) {
        unique.push(q);
        setIds.add(q.id);
      }
    }
    return unique;
  };

  resolveManagedCacheSeedTargets = () => {
    const resolveRouteSlug = () => {
      try {
        const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname)
          ? window.location.pathname
          : '';
        if (!pathname.startsWith('/session/')) return '';
        const routeSlug = (pathname.split('/').filter(Boolean)[1] || '').trim();
        return normalizeSessionSlug(routeSlug);
      } catch (_) {
        return '';
      }
    };

    const sessionConfig = this.getSessionConfig();
    const rawSlugCandidates = Array.from(new Set([
      sessionConfig?.slug,
      this.props.activeSessionSlug,
      this.props.sessionSlug,
      this.getActiveSessionSlug(),
      resolveRouteSlug(),
    ].map((slug) => normalizeSessionSlug(slug || ''))));
    const slugCandidates = rawSlugCandidates.filter((slug) => slug !== '');
    const primarySlug = slugCandidates[0] || '';
    const cfgForNet = getSessionConfigBySlug(primarySlug) || sessionConfig || {};

    const netIdCandidates = Array.from(new Set([
      this.resolveSessionChainId(sessionConfig),
      cfgForNet?.networkChainId,
      cfgForNet?.contracts?.surveys?.chainId,
      cfgForNet?.contracts?.sbtFactory?.chainId,
      this.props.networkChainId,
      this.props.network?.id,
      this.props.network?.chainId,
    ].map((value) => String(value ?? '').trim()).filter(Boolean)));

    if (!netIdCandidates.length) {
      ['questionsCache', 'surveysCache'].forEach((namespace) => {
        const existing = readManagedCacheSnapshot(namespace, primarySlug);
        if (!existing || typeof existing !== 'object') return;
        Object.keys(existing).forEach((key) => {
          const normalized = String(key || '').trim();
          if (normalized) netIdCandidates.push(normalized);
        });
      });
    }

    const normalizedNetIds = Array.from(new Set(
      netIdCandidates
        .map((value) => String(value || '').trim())
        .filter((value) => value && value !== 'undefined' && value !== 'null')
    ));

    return {
      primarySlug,
      primaryNetId: normalizedNetIds[0] || '',
    };
  };

  seedUploadedQuestionsCache = async ({ questionDataArray = [], uploadedQuestions = [], sourceQuestions = [] } = {}) => {
    try {
      const { primarySlug, primaryNetId } = this.resolveManagedCacheSeedTargets();

      const uploadedRows = Array.isArray(uploadedQuestions) ? uploadedQuestions : [];
      const uploadedById = new Map();
      uploadedRows.forEach((row) => {
        const qid = String(row?.questionId || row?.id || '').trim().toLowerCase();
        if (!qid) return;
        uploadedById.set(qid, row);
      });

      const normalizedRows = (Array.isArray(questionDataArray) ? questionDataArray : [])
        .map((row, idx) => {
          const uploadedByIndex = uploadedRows[idx] || null;
          const fallbackQid = String(row?.id || '').trim().toLowerCase();
          const uploadedQid = String(
            uploadedByIndex?.questionId ||
            uploadedByIndex?.id ||
            ''
          ).trim().toLowerCase();
          const qid = uploadedQid || fallbackQid;
          if (!qid) return null;
          const uploaded = uploadedById.get(qid) || uploadedByIndex || null;
          const arweaveTxId = String(uploaded?.arweaveTxId || row?.arweaveTxId || '').trim();
          return {
            ...row,
            id: qid,
            ...(arweaveTxId ? { arweaveTxId } : {}),
          };
        })
        .filter(Boolean);
      if (!normalizedRows.length) return false;

      const sourceRows = Array.isArray(sourceQuestions) ? sourceQuestions : [];
      const recentRows = normalizedRows.map((row, idx) => {
        const source = sourceRows[idx] || null;
        const promptMasked = String(row?.prompt || '').trim() === '[encrypted]';
        const sourcePrompt = source?.prompt == null ? '' : String(source.prompt);
        const sourceType = String(source?.type || row?.type || '').trim().toLowerCase();
        const sourceOptions = Array.isArray(source?.options) ? source.options : [];
        const sourceTags = Array.isArray(source?.tags) ? source.tags : [];
        const hasEncryptedOptions = !!row?.optionsEncrypted;
        const hasEncryptedTags = !!row?.tagsEncrypted;
        const shouldHydrateOptions = sourceType === 'multichoice' && hasEncryptedOptions && sourceOptions.length > 0;
        const shouldHydrateTags = hasEncryptedTags && sourceTags.length > 0;
        return {
          ...row,
          id: row.id,
          ...(promptMasked && sourcePrompt ? { prompt: sourcePrompt, promptDecrypted: true } : {}),
          ...(shouldHydrateOptions ? { options: sourceOptions, optionsDecrypted: true } : {}),
          ...(shouldHydrateTags ? { tags: sourceTags, tagsDecrypted: true } : {}),
        };
      });

      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const now = Date.now();
          const raw = window.sessionStorage.getItem(RECENT_QUESTION_PAYLOADS_KEY);
          const parsed = raw ? JSON.parse(raw) : {};
          const nextRecent = (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
            ? { ...parsed }
            : {};

          Object.keys(nextRecent).forEach((key) => {
            const entry = nextRecent[key];
            const ts = Number(entry?.savedAtMs || 0);
            if (!ts || (now - ts) > RECENT_QUESTION_PAYLOADS_TTL_MS) {
              delete nextRecent[key];
            }
          });

          recentRows.forEach((row) => {
            nextRecent[row.id] = {
              ...row,
              id: row.id,
              savedAtMs: now,
            };
          });

          const sortedKeys = Object.keys(nextRecent).sort((a, b) => (
            Number(nextRecent[b]?.savedAtMs || 0) - Number(nextRecent[a]?.savedAtMs || 0)
          ));
          sortedKeys.slice(RECENT_QUESTION_PAYLOADS_LIMIT).forEach((key) => {
            delete nextRecent[key];
          });

          window.sessionStorage.setItem(RECENT_QUESTION_PAYLOADS_KEY, JSON.stringify(nextRecent));
        }
      } catch (e) { surveyLog.warn('CreateQuestionsAndSurveys: fallback', e); }

      // Keep cache write-through scoped to the primary authoring namespace.
      // Only use the general bucket when authoring is actually general.
      if (!primaryNetId) return false;

      const existing = readManagedCacheSnapshot('questionsCache', primarySlug);
      const next = (existing && typeof existing === 'object') ? { ...existing } : {};
      const netBucket = (next[primaryNetId] && typeof next[primaryNetId] === 'object')
        ? { ...next[primaryNetId] }
        : {};
      const questions = (netBucket.questions && typeof netBucket.questions === 'object')
        ? { ...netBucket.questions }
        : {};

      normalizedRows.forEach((row) => {
        questions[row.id] = { ...(questions[row.id] || {}), ...row };
      });

      next[primaryNetId] = {
        ...netBucket,
        questionsLatestBlock: Number(netBucket.questionsLatestBlock || 0) || 0,
        questions,
        questionResponses: (netBucket.questionResponses && typeof netBucket.questionResponses === 'object')
          ? netBucket.questionResponses
          : {},
        questionResponsesMeta: (netBucket.questionResponsesMeta && typeof netBucket.questionResponsesMeta === 'object')
          ? netBucket.questionResponsesMeta
          : {},
        questionResponsesLatestBlock: Number(netBucket.questionResponsesLatestBlock || 0) || 0,
      };

      // Best-effort write-through: failures here must not fail successful on-chain submits.
      try {
        await writeCacheOptimistic('questionsCache', primarySlug, next);
      } catch (error) {
        surveyLog.warn('[CreateQuestionsAndSurveys] Failed to seed questions cache write-through', {
          slug: primarySlug,
          error: error?.message || String(error),
        });
        return false;
      }

      return true;
    } catch (error) {
      surveyLog.warn('[CreateQuestionsAndSurveys] Failed to seed uploaded questions cache', {
        error: error?.message || String(error),
      });
      return false;
    }
  };

  seedSubmittedSurveyCache = async ({
    surveyData = null,
    surveyId = '',
    sourceTitle = '',
    sourceDocumentUrls = [],
  } = {}) => {
    try {
      const sid = String(surveyId || surveyData?.surveyID || surveyData?.id || '').trim().toLowerCase();
      if (!sid) return false;

      const { primarySlug, primaryNetId } = this.resolveManagedCacheSeedTargets();
      if (!primaryNetId) return false;

      const normalizedDocs = sanitizeDocumentUrls(sourceDocumentUrls);
      const nextSurvey = {
        ...(surveyData && typeof surveyData === 'object' ? surveyData : {}),
        surveyID: sid,
        id: sid,
        questionIDs: Array.isArray(surveyData?.questionIDs) ? surveyData.questionIDs : [],
        creator: surveyData?.creator || this.props.account || '',
      };

      if (String(nextSurvey.title || '').trim() === '[encrypted]' && String(sourceTitle || '').trim()) {
        nextSurvey.title = String(sourceTitle || '').trim();
        nextSurvey.titleDecrypted = true;
      }
      if (
        Array.isArray(nextSurvey.documentURLs) &&
        nextSurvey.documentURLs.length === 0 &&
        normalizedDocs.length > 0 &&
        nextSurvey.documentURLsEncrypted
      ) {
        nextSurvey.documentURLs = normalizedDocs;
        nextSurvey.documentURLsDecrypted = true;
      }

      const existing = readManagedCacheSnapshot('surveysCache', primarySlug);
      let next = (existing && typeof existing === 'object') ? { ...existing } : {};
      next = ensureManagedSurveysNet(next, primaryNetId);
      next[primaryNetId].surveys[sid] = {
        ...(next[primaryNetId].surveys[sid] || {}),
        ...nextSurvey,
        sessionSlug: nextSurvey.sessionSlug || primarySlug,
        slug: nextSurvey.slug || nextSurvey.sessionSlug || primarySlug,
      };
      if (next[primaryNetId].pendingSurveyMetadata?.[sid]) {
        delete next[primaryNetId].pendingSurveyMetadata[sid];
      }

      try {
        await writeCacheOptimistic('surveysCache', primarySlug, next);
      } catch (error) {
        surveyLog.warn('[CreateQuestionsAndSurveys] Failed to seed surveys cache write-through', {
          slug: primarySlug,
          error: error?.message || String(error),
        });
        return false;
      }

      return true;
    } catch (error) {
      surveyLog.warn('[CreateQuestionsAndSurveys] Failed to seed submitted survey cache', {
        error: error?.message || String(error),
      });
      return false;
    }
  };

  clearCacheWatch = () => {
    if (this._cacheWatchTimer) {
      clearInterval(this._cacheWatchTimer);
      this._cacheWatchTimer = null;
    }
    if (typeof this._cacheWatchUnsubscribe === 'function') {
      try {
        this._cacheWatchUnsubscribe();
      } catch (e) { surveyLog.warn('CreateQuestionsAndSurveys: cleanup', e); }
      this._cacheWatchUnsubscribe = null;
    }
    if (this._cacheWatchCoalescer) {
      this._cacheWatchCoalescer.cancel();
      this._cacheWatchCoalescer = null;
    }
    this._cacheWatchCheckNow = null;
  };

  startCacheWatch = () => {
    this.clearCacheWatch();

    const { primarySlug, primaryNetId } = this.resolveManagedCacheSeedTargets();
    const netId = primaryNetId || null;
    if (!netId) return;
    const slug = canonicalizeLegacySessionAlias(primarySlug || '');

    const surveyIdLower = String(this.state.lastSubmittedSurveyId || '').toLowerCase();
    const questionIdsLower = (this.state.uploadedQuestions || [])
      .map((u) => String(u.questionId || '').toLowerCase())
      .filter(Boolean);
    if (!surveyIdLower && questionIdsLower.length === 0) return;

    const watchedNamespace = this.state.surveyAddedSuccessfully
      ? 'surveysCache'
      : this.state.questionsAddedSuccessfully
        ? 'questionsCache'
        : null;
    let pollAttempts = 0;
    this._cacheWatchCheckNow = ({ countPollAttempt = false } = {}) => {
      if (countPollAttempt) {
        pollAttempts += 1;
      }
      let loaded = false;
      try {
        loaded = hasSubmittedResourcesInManagedCache({
          slug,
          netId,
          surveyAddedSuccessfully: this.state.surveyAddedSuccessfully,
          questionsAddedSuccessfully: this.state.questionsAddedSuccessfully,
          surveyId: surveyIdLower,
          questionIds: questionIdsLower,
        });
      } catch {
        loaded = false;
      }

      if (loaded) {
        this.clearCacheWatch();
        if (this._isMounted) {
          this.setState({ cacheLoaded: true, submitStep: 3 });
        }
        return true;
      }

      if (countPollAttempt && pollAttempts > 60) {
        this.clearCacheWatch();
      }
      return false;
    };

    this._cacheWatchCoalescer = createCacheUpdateCoalescer(() => {
      if (typeof this._cacheWatchCheckNow === 'function') {
        this._cacheWatchCheckNow({ countPollAttempt: false });
      }
    });

    if (watchedNamespace) {
      this._cacheWatchUnsubscribe = subscribeCacheUpdates((event) => {
        if (!event || event.namespace !== watchedNamespace) return;
        if (String(event.slug || '') !== String(slug || '')) return;
        if (this._cacheWatchCoalescer) {
          this._cacheWatchCoalescer.schedule();
        }
      });
    }

    this._cacheWatchTimer = setInterval(() => {
      if (typeof this._cacheWatchCheckNow === 'function') {
        this._cacheWatchCheckNow({ countPollAttempt: true });
      }
    }, 1000);

    this._cacheWatchCheckNow({ countPollAttempt: true });
  };

  // Wagmi-only helpers for network guard
  getWalletChainId = async () => {
    try {
      if (typeof window === 'undefined' || !window.ethereum) return null;
      const hex = await window.ethereum.request({ method: 'eth_chainId' });
      return hex || null;
    } catch (_) {
      return null;
    }
  };

  updateNeedsNetworkSwitch = async () => {
    try {
      const targetId = this.resolveSessionChainId();
      if (!(this.props.provider === 'wagmi' && this.props.loginComplete && Number.isFinite(targetId))) {
        if (this.state.needsNetworkSwitch) this.setState({ needsNetworkSwitch: false });
        return;
      }
      const chainHex = await this.getWalletChainId();
      const walletId = chainHex ? parseInt(chainHex, 16) : null;
      const need = walletId != null && walletId !== targetId;
      if (need !== this.state.needsNetworkSwitch) {
        this.setState({ needsNetworkSwitch: need });
      }
    } catch (e) { surveyLog.warn('CreateQuestionsAndSurveys: fallback', e); }
  };

  switchToCorrectNetwork = async () => {
    if (!(window && window.ethereum) || this.props.provider !== 'wagmi') return;
    try {
      const targetId = this.resolveSessionChainId();
      if (!Number.isFinite(targetId)) return;
      const chainIdHex = '0x' + Number(targetId).toString(16);
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
      this.setState({ needsNetworkSwitch: false });
    } catch (error) {
      if (error && error.code === 4902) {
        try {
          const ch = this.resolveTargetNetwork() || {};
          const rpcUrl = chainHttpRpcNoPath(ch) || chainHttpRpc(ch);
          const native = ch?.nativeCurrency || { name: 'Ether', symbol: 'ETH', decimals: 18 };
          const explorer = ch?.blockExplorers?.default?.url || '';
          const chainIdHex = '0x' + Number(ch?.id || 0).toString(16);

          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainIdHex,
              chainName: ch?.name || `Chain ${ch?.id || ''}`,
              nativeCurrency: native,
              rpcUrls: rpcUrl ? [rpcUrl] : [],
              blockExplorerUrls: explorer ? [explorer] : []
            }]
          });
          this.setState({ needsNetworkSwitch: false });
        } catch (e) { surveyLog.warn('CreateQuestionsAndSurveys: fallback', e); }
      }
    }
  };

  // Handle clearing the form
  handleClearForm = () => {
    this.setState({ showClearFormConfirm: true });
  };

  cancelClearForm = () => {
    this.setState({ showClearFormConfirm: false });
  };

  confirmClearForm = () => {
    // Reset state
    this.setState({
      title: '',
      questions: [],
      documentURLs: [],
      docURLInput: '',
      surveyHash: '',
      isStandaloneQuestion: true, // Reset to default mode
      surveyLockGateIds: [],
      openLockKey: '',
      // Reset status flags
      surveyAddedSuccessfully: false,
      questionsAddedSuccessfully: false,
      isSubmitting: false,
      submissionError: '',
      lastSubmittedSurveyId: '',
      lastSubmittedSurveyArweaveTxId: '',
      showClearFormConfirm: false,
    }, () => {
      // Clear localStorage
      this.clearUnfinishedSurveyDraft();
      this.updateSurveyHash();
    });
  };

  createSurvey = async () => {
    // Early validation per spec: block empty survey titles before setting submitting state
    if (!this.state.isStandaloneQuestion) {
      if (!this.state.title || !this.state.title.trim()) {
        alert("Please enter a survey title.");
        return;
      }
    }

    const blankQuestionIndex = findFirstBlankQuestionPromptIndex(this.state.questions);
    if (blankQuestionIndex !== -1) {
      alert(`Question ${blankQuestionIndex + 1} prompt cannot be blank.`);
      return;
    }

    if (!this.props.loginComplete) {
      this.props.toggleLoginModal(true);
      return;
    }

    const sessionConfig = await this.ensureResolvedSessionConfigForSubmit();

    // Wagmi-only network guard (block before any submit work)
    if (this.props.provider === 'wagmi') {
      try {
        const targetChainId = this.resolveSessionChainId(sessionConfig);
        const targetId = (
          targetChainId != null &&
          Number(targetChainId) > 0
        ) ? Number(targetChainId) : null;
        const chainHex = await this.getWalletChainId();
        const walletId = chainHex ? parseInt(chainHex, 16) : null;
        if (Number.isFinite(targetId) && walletId != null && walletId !== targetId) {
          this.setState({ needsNetworkSwitch: true });
          return;
        }
      } catch (e) { surveyLog.warn('CreateQuestionsAndSurveys: fallback', e); }
    }

    this.setState({
      isSubmitting: true,
      progress: 0,
      submissionError: '',
      surveyAddedSuccessfully: false,
      questionsAddedSuccessfully: false,
      lastSubmittedSurveyId: '',
      lastSubmittedSurveyArweaveTxId: '',
      showSubmitSteps: true,
      submitStep: 1,
      cacheLoaded: false
    });

    // === NEW: compute sessionName once from props ===
    const _sessionName =
      String(sessionConfig.sessionName || sessionConfig.slug || this.getActiveSessionSlug() || '');

    // Session-scoped slug/config for contract + worker calls
    const sessionSlug = normalizeSessionSlug(sessionConfig.slug || this.getActiveSessionSlug() || '');
    const sessionKeyOrCfg = sessionConfig;

    const {
      title,
      questions,
      isStandaloneQuestion,
      documentURLs,
      surveyLockGateIds,
    } = this.state;

    const { gateMap } = this.resolveGateOptions(sessionConfig, { isStandaloneQuestion });
    const knownGateIds = new Set(Object.keys(gateMap || {}));

    const normalizeKnownGateIds = (value) => (
      normalizeGateIds(value).filter((gateId) => knownGateIds.has(gateId))
    );

    const resolvedSurveyLockGateIds = !isStandaloneQuestion
      ? normalizeKnownGateIds(surveyLockGateIds)
      : [];

    const questionNeedsEncryption = (q) => {
      if (!q) return false;
      const raw = isStandaloneQuestion
        ? q.lockGateIds
        : (q.lockGateIds === null ? resolvedSurveyLockGateIds : q.lockGateIds);
      return normalizeKnownGateIds(raw).length > 0;
    };

    const needsLit =
      resolvedSurveyLockGateIds.length > 0 ||
      (Array.isArray(questions) ? questions : []).some(questionNeedsEncryption);

    const chainIdFallback = this.resolveSessionChainId(sessionConfig);

    const litHooks = needsLit ? getGlobalLitHooks() : null;
    if (needsLit) {
      if (!this.props.account) {
        this.setState({
          isSubmitting: false,
          progress: 0,
          submissionError: `Connect a ${t('walletLower')} to encrypt this survey.`,
          showSubmitSteps: false,
          submitStep: 0
        });
        return;
      }
      if (!litHooks || typeof litHooks.saveKey !== 'function') {
        this.setState({
          isSubmitting: false,
          progress: 0,
          submissionError: `Lit hooks not initialized; connect a ${t('walletLower')} to encrypt.`,
          showSubmitSteps: false,
          submitStep: 0
        });
        return;
      }
    }

    const buildGateObjectsAndRecipients = (gateIdsIn) => {
      const gateIds = normalizeKnownGateIds(gateIdsIn);
      const gates = [];
      const recipients = [];
      const dedupe = new Set();

      gateIds.forEach((gateId) => {
        const rawGate = gateMap?.[gateId];
        if (!rawGate || typeof rawGate !== 'object') return;

        const chainId = Number(rawGate.chainId || chainIdFallback || 0) || chainIdFallback || null;
        const litChain = resolveLitChain({ chainId, litChain: rawGate.litChain });
        const sbtAddresses = Array.from(new Set(
          [
            ...(Array.isArray(rawGate.sbtAddresses) ? rawGate.sbtAddresses : []),
            rawGate.sbtAddress,
          ].filter(Boolean)
        ));
        if (!sbtAddresses.length) return;

        const mode = rawGate.mode || 'any';
        const label = String(rawGate.label || rawGate.name || gateId);
        const color = String(rawGate.color || stableGateColor(gateId));

        gates.push({
          ...rawGate,
          type: rawGate.type || 'sbt',
          gateId,
          sbtAddresses,
          sbtAddress: sbtAddresses[0] || '',
          chainId,
          litChain,
          mode,
          label,
          color,
        });

        const accessControlConditions = buildSbtAccessControlConditions({
          sbtAddresses,
          chainId,
          litChain,
          mode,
        });
        if (!accessControlConditions) return;

        const recipient = { accessControlConditions, chain: litChain };
        const sig = JSON.stringify({ accessControlConditions, chain: litChain });
        if (dedupe.has(sig)) return;
        dedupe.add(sig);
        recipients.push(recipient);
      });

      return { gates, recipients };
    };

    const requireRecipientsForGateSelection = ({ gateIds, recipients, scopeLabel } = {}) => {
      const selectedGateIds = normalizeKnownGateIds(gateIds);
      if (!selectedGateIds.length) return;
      if (Array.isArray(recipients) && recipients.length > 0) return;
      throw new Error(
        `Selected lock ${selectedGateIds.length === 1 ? t('gateLower') : t('gatesLower')} (${selectedGateIds.join(', ')}) for ${scopeLabel || 'content'} do not resolve to valid Lit recipients.`,
      );
    };

    const buildEncryptionPayload = ({ gates, targets }) => ({
      enabled: true,
      status: 'lit-v1',
      gate: gates?.[0] || null,
      ...(Array.isArray(gates) && gates.length ? { gates } : {}),
      targets: targets || {},
    });

    const encryptValueWithRecipients = async ({
      value,
      maskedValue,
      contextLabel,
      surveyId,
      qId,
      recipients,
    }) => {
      const isEmpty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0);
      if (isEmpty) return { value, encrypted: null };

      if (!litHooks || typeof litHooks.saveKey !== 'function') {
        throw new Error('Lit hooks not initialized.');
      }
      if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new Error(`Selected ${t('gateLower')} does not provide any Lit recipients.`);
      }

      const combinedAccessControlConditions = [];
      recipients.forEach((recipient) => {
        const conditions = recipient?.accessControlConditions;
        if (!Array.isArray(conditions) || conditions.length === 0) return;
        if (combinedAccessControlConditions.length > 0) {
          combinedAccessControlConditions.push({ operator: 'or' });
        }
        combinedAccessControlConditions.push(...conditions);
      });

      const envelope = await cryptoUtils.encryptEnvelopeValue(value, {
        providerLike: this.props.provider,
        account: this.props.account,
        chainId: chainIdFallback,
        surveyId,
        qId,
        contextLabel,
        lit: {
          saveKey: litHooks.saveKey,
          accessControlConditions: combinedAccessControlConditions.length
            ? combinedAccessControlConditions
            : recipients[0]?.accessControlConditions,
          chain: recipients[0]?.chain || null,
          recipients,
        },
      });

      return { value: maskedValue, encrypted: envelope };
    };

    try {
      if (isStandaloneQuestion) {
        if (questions.length === 0) {
          alert("Please add at least one question.");
          this.setState({ isSubmitting: false, progress: 0, showSubmitSteps: false, submitStep: 0 });
          return;
        }
        this.setState({ progress: 10, submitStep: 1 });

        const uniqueQuestions = this.removeDuplicateQuestions(questions);

        const questionDataArray = await Promise.all(
          uniqueQuestions.map(async (q) => {
            // FILTER: clean options here too
            const validOptions = (q.type === 'multichoice' && Array.isArray(q.options))
              ? q.options.filter(o => o && o.trim() !== '')
              : undefined;

            const surveyContextId = q.associatedSurveyId || ethers.constants.HashZero;
            const cleanTags = normalizeTagList(q.tags);
            let promptValue = q.prompt;
            let optionsValue = validOptions;
            let tagsValue = cleanTags;
            let promptEncrypted = null;
            let optionsEncrypted = null;
            let tagsEncrypted = null;

            const effectiveGateIds = normalizeKnownGateIds(q.lockGateIds);
            const questionEncryption = effectiveGateIds.length
              ? buildGateObjectsAndRecipients(effectiveGateIds)
              : null;
            requireRecipientsForGateSelection({
              gateIds: effectiveGateIds,
              recipients: questionEncryption?.recipients,
              scopeLabel: `question ${q.id}`,
            });

            if (questionEncryption && questionEncryption.recipients.length) {
              const { gates, recipients } = questionEncryption;

              const promptResult = await encryptValueWithRecipients({
                value: q.prompt,
                maskedValue: '[encrypted]',
                contextLabel: `question:${q.id}:prompt`,
                surveyId: surveyContextId,
                qId: `${q.id}:prompt`,
                recipients,
              });
              promptValue = promptResult.value;
              promptEncrypted = promptResult.encrypted;

              if (Array.isArray(validOptions) && validOptions.length > 0) {
                const optionsResult = await encryptValueWithRecipients({
                  value: validOptions,
                  maskedValue: [],
                  contextLabel: `question:${q.id}:options`,
                  surveyId: surveyContextId,
                  qId: `${q.id}:options`,
                  recipients,
                });
                optionsValue = optionsResult.value;
                optionsEncrypted = optionsResult.encrypted;
              }

              if (cleanTags.length > 0) {
                const tagsResult = await encryptValueWithRecipients({
                  value: cleanTags,
                  maskedValue: [],
                  contextLabel: `question:${q.id}:tags`,
                  surveyId: surveyContextId,
                  qId: `${q.id}:tags`,
                  recipients,
                });
                tagsValue = tagsResult.value;
                tagsEncrypted = tagsResult.encrypted;
              }
            }

            const qD = {
              id: q.id,
              type: q.type,
              prompt: promptValue,
              options: optionsValue,
              singleSelect: q.type === 'multichoice' ? !!q.singleSelect : undefined,
              tags: tagsValue,
              creator: this.props.account,
              associatedSurveyId: surveyContextId,
              sessionName: _sessionName,
            };
            if (questionEncryption && questionEncryption.recipients.length) {
              qD.encryption = buildEncryptionPayload({
                gates: questionEncryption.gates,
                targets: { questions: true, questionTags: true },
              });
              if (promptEncrypted) qD.promptEncrypted = promptEncrypted;
              if (optionsEncrypted) qD.optionsEncrypted = optionsEncrypted;
              if (tagsEncrypted) qD.tagsEncrypted = tagsEncrypted;
            }
            return qD;
          })
        );
        const surveyIdsForContract = uniqueQuestions.map(
          (q) => q.associatedSurveyId || ethers.constants.HashZero
        );

        // Step 2: contracts submit
        this.setState({ progress: 50, submitStep: 2 });

        const questionIdsForContract = uniqueQuestions.map(q => q.id);
        const addQuestionsResult = await contractScripts.addQuestions(
          this.props.provider,
          questionIdsForContract,
          questionDataArray,
          surveyIdsForContract,
          sessionKeyOrCfg
        );
        if (!addQuestionsResult || !addQuestionsResult.receipt) {
          throw new Error('addQuestions did not return a transaction receipt.');
        }
        const { receipt, uploadedQuestions: contractUploadedQuestions } = addQuestionsResult;

        if (!this.props.preformedQuestions) {
          this.clearUnfinishedSurveyDraft();
          // Do not wipe group caches here: clearing questions/surveys can collapse
          // pile/full mode to only the just-submitted question until a full rescan completes.
          await this.seedUploadedQuestionsCache({
            questionDataArray,
            uploadedQuestions: contractUploadedQuestions || [],
            sourceQuestions: uniqueQuestions,
          });
          this.setState({
            title: '',
            questions: [],
            documentURLs: [],
            docURLInput: '',
            surveyHash: '',
            questionsAddedSuccessfully: true,
            isSubmitting: false,
            progress: 100,
            uploadedQuestions: contractUploadedQuestions || [],
            submissionError: '',
            submitStep: 3
          }, this.startCacheWatch);
        } else {
          await this.seedUploadedQuestionsCache({
            questionDataArray,
            uploadedQuestions: contractUploadedQuestions || [],
            sourceQuestions: uniqueQuestions,
          });
          this.setState({
            questionsAddedSuccessfully: true,
            isSubmitting: false,
            progress: 100,
            uploadedQuestions: contractUploadedQuestions || [],
            submitStep: 3
          }, () => {
            this.startCacheWatch();
            if (this.props.miniaturized && this.props.onUploadComplete) {
              this.props.onUploadComplete(null);
            }
          });
        }
      } else {
        if (!title.trim()) {
          alert("Please enter a survey title.");
          this.setState({ isSubmitting: false, progress: 0, showSubmitSteps: false, submitStep: 0 });
          return;
        }
        const surveyIDForUpload = this.state.surveyHash;
        if (!surveyIDForUpload) {
          this.setState({
            isSubmitting: false,
            submissionError: "Internal error: Survey ID could not be generated.",
            showSubmitSteps: false,
            submitStep: 0
          });
          return;
        }

        const uniqueQuestions = this.removeDuplicateQuestions(questions);

        const questionDataArray = await Promise.all(
          uniqueQuestions.map(async (q) => {
            // FILTER: clean options
            const validOptions = (q.type === 'multichoice' && Array.isArray(q.options))
              ? q.options.filter(o => o && o.trim() !== '')
              : undefined;
            const cleanTags = normalizeTagList(q.tags);

            let promptValue = q.prompt;
            let optionsValue = validOptions;
            let tagsValue = cleanTags;
            let promptEncrypted = null;
            let optionsEncrypted = null;
            let tagsEncrypted = null;

            const effectiveGateIds = (() => {
              if (q && Object.prototype.hasOwnProperty.call(q, 'lockGateIds')) {
                if (q.lockGateIds === null) return resolvedSurveyLockGateIds;
                return normalizeKnownGateIds(q.lockGateIds);
              }
              return resolvedSurveyLockGateIds;
            })();
            const questionEncryption = effectiveGateIds.length
              ? buildGateObjectsAndRecipients(effectiveGateIds)
              : null;
            requireRecipientsForGateSelection({
              gateIds: effectiveGateIds,
              recipients: questionEncryption?.recipients,
              scopeLabel: `question ${q.id}`,
            });

            if (questionEncryption && questionEncryption.recipients.length) {
              const { recipients } = questionEncryption;

              const promptResult = await encryptValueWithRecipients({
                value: q.prompt,
                maskedValue: '[encrypted]',
                contextLabel: `survey:${surveyIDForUpload}:question:${q.id}:prompt`,
                surveyId: surveyIDForUpload,
                qId: `${q.id}:prompt`,
                recipients,
              });
              promptValue = promptResult.value;
              promptEncrypted = promptResult.encrypted;

              if (Array.isArray(validOptions) && validOptions.length > 0) {
                const optionsResult = await encryptValueWithRecipients({
                  value: validOptions,
                  maskedValue: [],
                  contextLabel: `survey:${surveyIDForUpload}:question:${q.id}:options`,
                  surveyId: surveyIDForUpload,
                  qId: `${q.id}:options`,
                  recipients,
                });
                optionsValue = optionsResult.value;
                optionsEncrypted = optionsResult.encrypted;
              }

              if (cleanTags.length > 0) {
                const tagsResult = await encryptValueWithRecipients({
                  value: cleanTags,
                  maskedValue: [],
                  contextLabel: `survey:${surveyIDForUpload}:question:${q.id}:tags`,
                  surveyId: surveyIDForUpload,
                  qId: `${q.id}:tags`,
                  recipients,
                });
                tagsValue = tagsResult.value;
                tagsEncrypted = tagsResult.encrypted;
              }
            }

            const base = {
              id: q.id,
              type: q.type,
              prompt: promptValue,
              options: optionsValue,
              singleSelect: q.type === 'multichoice' ? !!q.singleSelect : undefined,
              tags: tagsValue,
              creator: this.props.account,
              associatedSurveyId: surveyIDForUpload,
              sessionName: _sessionName,
            };
            if (questionEncryption && questionEncryption.recipients.length) {
              base.encryption = buildEncryptionPayload({
                gates: questionEncryption.gates,
                targets: { questions: true, questionTags: true },
              });
              if (promptEncrypted) base.promptEncrypted = promptEncrypted;
              if (optionsEncrypted) base.optionsEncrypted = optionsEncrypted;
              if (tagsEncrypted) base.tagsEncrypted = tagsEncrypted;
            }
            return base;
          })
        );
        const questionIdsForContract = uniqueQuestions.map(q => q.id);

        // Fetch current block number for creationBlock optimization
        let creationBlock = 0;
        try {
           creationBlock = await contractScripts.getLatestBlockNumber(this.props.provider, sessionKeyOrCfg);
        } catch (e) {
           surveyLog.warn("Could not fetch creationBlock, defaulting to 0", e);
        }

        let surveyTitleValue = title;
        let surveyTitleEncrypted = null;
        let docUrlsValue = sanitizeDocumentUrls(documentURLs);
        let docUrlsEncrypted = null;

        const surveyEncryption = resolvedSurveyLockGateIds.length
          ? buildGateObjectsAndRecipients(resolvedSurveyLockGateIds)
          : null;
        requireRecipientsForGateSelection({
          gateIds: resolvedSurveyLockGateIds,
          recipients: surveyEncryption?.recipients,
          scopeLabel: 'survey',
        });

        if (surveyEncryption && surveyEncryption.recipients.length) {
          const { recipients } = surveyEncryption;

          const titleResult = await encryptValueWithRecipients({
            value: title,
            maskedValue: '[encrypted]',
            contextLabel: `survey:${surveyIDForUpload}:title`,
            surveyId: surveyIDForUpload,
            qId: 'survey:title',
            recipients,
          });
          surveyTitleValue = titleResult.value;
          surveyTitleEncrypted = titleResult.encrypted;

          const docsResult = await encryptValueWithRecipients({
            value: docUrlsValue,
            maskedValue: [],
            contextLabel: `survey:${surveyIDForUpload}:docurls`,
            surveyId: surveyIDForUpload,
            qId: 'survey:docUrls',
            recipients,
          });
          docUrlsValue = docsResult.value;
          docUrlsEncrypted = docsResult.encrypted;
        }

        const completeSurveyData = {
          surveyID: surveyIDForUpload,
          title: surveyTitleValue,
          questionIDs: questionIdsForContract,
          creator: this.props.account,
          documentURLs: docUrlsValue,
          sessionName: _sessionName,
          sessionSlug: sessionSlug || '',
          creationBlock: creationBlock,
        };
        if (surveyEncryption && surveyEncryption.recipients.length) {
          completeSurveyData.encryption = buildEncryptionPayload({
            gates: surveyEncryption.gates,
            targets: { survey: true, docUrls: true },
          });
          if (surveyTitleEncrypted) completeSurveyData.titleEncrypted = surveyTitleEncrypted;
          if (docUrlsEncrypted) completeSurveyData.documentURLsEncrypted = docUrlsEncrypted;
        }

        // Step 1: Upload to Arweave (survey.json)
        this.setState({ progress: 30, submitStep: 1 });
        const arweaveKey = await getEffectiveArweaveKey({
          sessionSlug,
          sessionConfig,
          context: {
            account: this.props.account,
            providerLike: this.props.provider,
            chainId: chainIdFallback,
          },
        });
        const surveyDataString = JSON.stringify(completeSurveyData);
        let surveyArweaveTxId = '';
        try {
          surveyArweaveTxId =
            await arweaveScripts.uploadDataToArweave(surveyDataString, 'json', {
              arweaveJwk: arweaveKey?.arweaveJwk || '',
              sessionSlug,
              sessionConfig,
              context: {
                account: this.props.account,
                providerLike: this.props.provider,
                chainId: chainIdFallback,
              },
            });
        } catch (error) {
          if (error && typeof error === 'object') {
            error.resetSubmitProgress = true;
          }
          throw error;
        }

        // Step 2: on-chain
        this.setState({ progress: 60, submitStep: 2 });
        const addSurveyResult = await contractScripts.addSurveyWithQuestions(
          this.props.provider,
          surveyIDForUpload,
          completeSurveyData,
          questionIdsForContract,
          questionDataArray,
          sessionKeyOrCfg
        );
        if (!addSurveyResult || !addSurveyResult.receipt) {
          throw new Error('addSurveyWithQuestions did not return a transaction receipt.');
        }
        const { receipt } = addSurveyResult;
        await this.seedUploadedQuestionsCache({
          questionDataArray,
          uploadedQuestions: questionIdsForContract.map((questionId) => ({ questionId })),
          sourceQuestions: uniqueQuestions,
        });
        await this.seedSubmittedSurveyCache({
          surveyData: completeSurveyData,
          surveyId: surveyIDForUpload,
          sourceTitle: title,
          sourceDocumentUrls: documentURLs,
        });

        if (!this.props.preformedQuestions) {
          this.clearUnfinishedSurveyDraft();
          // Preserve existing group caches and let cache-watch/event refresh converge.
          this.setState({
            title: '',
            questions: [],
            documentURLs: [],
            docURLInput: '',
            surveyHash: '',
            surveyAddedSuccessfully: true,
            lastSubmittedSurveyId: surveyIDForUpload,
            lastSubmittedSurveyArweaveTxId: surveyArweaveTxId,
            isSubmitting: false,
            progress: 100,
            submissionError: '',
            uploadedQuestions: [],
            submitStep: 3
          }, this.startCacheWatch);
        } else {
          this.setState({
            surveyAddedSuccessfully: true,
            isSubmitting: false,
            progress: 100,
            lastSubmittedSurveyId: this.state.surveyHash,
            lastSubmittedSurveyArweaveTxId: surveyArweaveTxId,
            submitStep: 3
          }, () => {
            this.startCacheWatch();
            if (this.props.miniaturized && this.props.onUploadComplete) {
              this.props.onUploadComplete(this.state.surveyHash);
            }
          });
        }
      }
    } catch (error) {
      surveyLog.error("[CreateQuestionsAndSurveys] Failed to create survey/questions:", error);
      const shouldResetSubmitProgress = !!error?.resetSubmitProgress;
      this.setState({
        isSubmitting: false,
        progress: 0,
        submissionError: error.message || 'An error occurred during submission.',
        showSubmitSteps: shouldResetSubmitProgress ? false : this.state.showSubmitSteps,
        submitStep: shouldResetSubmitProgress
          ? 0
          : (this.state.submitStep === 0 ? 1 : this.state.submitStep)
      });
    }
  };

  handleSubmitButtonClick = () => {
    const { isSubmitting, submissionError } = this.state;
    if (isSubmitting) return;
    if (submissionError) {
      navigator.clipboard.writeText(submissionError).then(() => {
        notify.success('Copied to clipboard');
      }).catch((e) => { void e; notify.warn('Copy failed'); });
      return;
    }
    this.createSurvey();
  };

  toggleShowJson = () => {
    this.setState(prev => ({ showJson: !prev.showJson }));
  };

  copyQuestionIdToClipboard = (qid) => {
    navigator.clipboard.writeText(qid).then(() => {
      notify.success('Copied to clipboard');
    }).catch((e) => { void e; notify.warn('Copy failed'); });
  };

  copySurveyIdToClipboard = (surveyID) => {
    if (!surveyID) return;
    navigator.clipboard.writeText(surveyID)
      .then(() => {
        notify.success('Copied to clipboard');
        this.setCopySuccessState('copySurveyIdSuccess', 2000);
      })
      .catch((e) => { void e; notify.warn('Copy failed'); });
  };

  copySurveyLinkToClipboard = (surveyID = null) => {
    let finalID = surveyID || this.state.lastSubmittedSurveyId || this.state.surveyHash;
    if (!finalID) return;
    const slug = this.getActiveSessionSlug();
    const link = `${window.location.origin}/survey/${String(finalID)}${slug ? `?session=${encodeURIComponent(slug)}` : ''}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        notify.success('Copied to clipboard');
        this.setCopySuccessState('copySurveyLinkSuccess', 2000);
      })
      .catch((e) => { void e; notify.warn('Copy failed'); });
  };

  handleAutoQuestionsGenerated = (questionsArray, docURLs, aiTitle) => {
    this.clearUnfinishedSurveyDraft();

    const built = questionsArray.map((q, index) => {
      const aiTags = normalizeTagList(q.tags);
      const tagsToSet = this.state.autoPopulateAiTags
        ? [...new Set(aiTags)]
        : [];
      const singleSelect = !!(q.singleSelect || q.oneSelectionOnly);
      return {
        id: q.id || this.generateQuestionId(q.type, q.prompt, q.options, singleSelect),
        type: q.type,
        prompt: q.prompt,
        options: q.type === 'multichoice' && Array.isArray(q.options) ? q.options : (q.type === 'multichoice' ? [] : undefined),
        singleSelect,
        uiKey: q.uiKey || `auto-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tags: tagsToSet,
        aiGeneratedTagsFromSource: [...aiTags],
        currentTagInputValue: '',
        isGeneratingTags: false,
      };
    });
    const firstKey = built.length > 0 ? built[0].uiKey : null;

    this.setState({
      questions: built,
      documentURLs: sanitizeDocumentUrls(docURLs || []),
      // Only set buffer if needed, usually we just want the list
      docURLInput: '',
      isStandaloneQuestion: !aiTitle,
      title: aiTitle || '',
      showAutoTool: false,
      surveyAddedSuccessfully: false,
      questionsAddedSuccessfully: false,
      submissionError: '',
      lastSubmittedSurveyId: '',
      lastSubmittedSurveyArweaveTxId: '',
      focusTargetUiKey: firstKey
    }, () => {
      this.updateSurveyHash();
      this.saveToLocalStorage();
    });
  };

  handleAutoPopulateAiTagsToggle = () => {
    this.setState(prevState => {
      const newAutoPopulateState = !prevState.autoPopulateAiTags;
      const updatedQuestions = prevState.questions.map(q => {
        let newTags = normalizeTagList(q.tags);
        if (newAutoPopulateState) {
          const sourceTags = normalizeTagList(q.aiGeneratedTagsFromSource);
          const currentTagSet = new Set(newTags);
          sourceTags.forEach(tag => {
            if (!currentTagSet.has(tag)) {
              newTags.push(tag);
            }
          });
        }
        return { ...q, tags: newTags };
      });
      return {
        autoPopulateAiTags: newAutoPopulateState,
        questions: updatedQuestions
      };
    }, this.saveToLocalStorage);
  };

  suggestTagsForQuestion = async (qIndex) => {
    const question = this.state.questions[qIndex];
    if (!question || question.isGeneratingTags) return;

    this.setState(prevState => {
      const updatedQuestions = [...prevState.questions];
      updatedQuestions[qIndex] = { ...updatedQuestions[qIndex], isGeneratingTags: true };
      return { questions: updatedQuestions };
    });

    try {
      const defaultTagsRaw = this.props.defaultTags;
      let defaultTagsForAI = [];
      if (Array.isArray(defaultTagsRaw)) {
        defaultTagsForAI = defaultTagsRaw.filter(Boolean).map(t => t.trim());
      } else if (typeof defaultTagsRaw === 'string') {
        defaultTagsForAI = defaultTagsRaw.split(',').map(t => t.trim()).filter(Boolean);
      }

      const prompt = generateSingleQuestionTagsPrompt(
        question.prompt,
        question.type,
        question.options,
        defaultTagsForAI
      );

      const rawResponse = await callAI(prompt, this.buildAiRequestOptions());
      const match = rawResponse.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON object found in AI response for tags.');
      const parsedResponse = JSON.parse(match[0]);
      const newAiTags = (parsedResponse.tags || []).map(tag => String(tag || '').trim()).filter(Boolean);

      this.setState(prevState => {
        const updated = [...prevState.questions];
        updated[qIndex] = {
          ...updated[qIndex],
          aiGeneratedTagsFromSource: newAiTags,
          tags: [...newAiTags],
          isGeneratingTags: false
        };
        return { questions: updated };
      }, this.saveToLocalStorage);

    } catch (error) {
      this.setState(prevState => {
        const updated = [...prevState.questions];
        updated[qIndex] = { ...updated[qIndex], isGeneratingTags: false };
        return { questions: updated };
      });
      alert(`Failed to generate tags for question "${(question?.prompt || '').substring(0,30)}...". Please try again.`);
    }
  };

  removeTagFromQuestion = (qIndex, tagIndexToRemove) => {
    this.setState(prevState => {
      const updatedQuestions = [...prevState.questions];
      const questionToUpdate = { ...updatedQuestions[qIndex] };
      const currentTags = normalizeTagList(questionToUpdate.tags);
      questionToUpdate.tags = currentTags.filter((_, i) => i !== tagIndexToRemove);
      updatedQuestions[qIndex] = questionToUpdate;
      return { questions: updatedQuestions };
    }, this.saveToLocalStorage);
  };

  handleCurrentTagInputChange = (qIndex, value) => {
    this.setState(prevState => {
      const updatedQuestions = [...prevState.questions];
      updatedQuestions[qIndex] = { ...updatedQuestions[qIndex], currentTagInputValue: value };
      return { questions: updatedQuestions };
    });
  };

  handleTagInputKeyDown = (qIndex, event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.processTagInput(qIndex);
    }
  };

  processTagInput = (qIndex) => {
    this.setState(prevState => {
      const updatedQuestions = [...prevState.questions];
      const q = { ...updatedQuestions[qIndex] };
      const currentTags = normalizeTagList(q.tags);
      const newTag = (q.currentTagInputValue || '').trim();
      if (newTag && !currentTags.includes(newTag)) {
        q.tags = [...currentTags, newTag];
      } else {
        q.tags = currentTags;
      }
      q.currentTagInputValue = '';
      updatedQuestions[qIndex] = q;
      return { questions: updatedQuestions };
    }, this.saveToLocalStorage);
  };

  removeDocumentURL = (indexToRemove) => {
    this.setState(prevState => {
      const next = prevState.documentURLs.filter((_, index) => index !== indexToRemove);
      return {
        documentURLs: next,
        // docURLInput remains separate buffer
      };
    }, () => {
      this.updateSurveyHash();
      this.saveToLocalStorage();
    });
  };

  copyJsonPreview = (jsonData) => {
    try {
      const str = JSON.stringify(jsonData, null, 2);
      navigator.clipboard.writeText(str).then(() => {
        notify.success('Copied to clipboard');
        this.setCopySuccessState('copyJsonSuccess', 1500);
      });
    } catch (e) { void e; notify.warn('Copy failed'); }
  };

  // AI prompt panel handlers
  toggleAIPrompt = () => {
    this.setState(prev => {
      const nextOpen = !prev.showAIPrompt;
      return {
        showAIPrompt: nextOpen,
        aiPromptText: (!prev.aiPromptLoaded && nextOpen) ? seedGenPrompt : prev.aiPromptText,
        aiPromptLoaded: prev.aiPromptLoaded || nextOpen
      };
    }, () => {
      if (this.state.showAIPrompt) this.refreshAIPromptModelLabel();
    });
  };

  copyAIPromptToClipboard = () => {
    const text = this.state.aiPromptText || '';
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => {
        notify.success('Copied to clipboard');
        this.setCopySuccessState('aiPromptCopySuccess', 1500);
      })
      .catch((e) => { void e; notify.warn('Copy failed'); });
  };

  /** Highlight <Variables> using React nodes (no HTML injection) */
  highlightPromptVariables = (str) => {
    if (!str) return null;
    const text = String(str);
    const re = /<([A-Za-z][A-Za-z0-9_]*)>/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      parts.push(
        <span key={match.index} className={styles.aiVar}>
          {'<'}{match[1]}{'>'}
        </span>
      );
      lastIndex = re.lastIndex;
    }

    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  };

  renderTypePreview = (type) => {
    if (!type || type === 'Question Type') return null;
    const box = { border: '1px dashed #b0c4ff', padding: 10, borderRadius: 6, marginTop: 6, background: '#f6f8ff' };
    const pill = (txt) => <span key={txt} style={{ display:'inline-block', padding:'3px 8px', border:'1px solid #ccd', borderRadius:12, marginRight:6, marginTop:4 }}>{txt}</span>;
    if (type === 'binary') {
      return <div style={box}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Example:</div>
        {pill('Agree')}{pill('Unsure')}{pill('Disagree')}
      </div>;
    }
    if (type === 'multichoice') {
      return <div style={box}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Example options:</div>
        {pill('Option A')}{pill('Option B')}{pill('Option C')}
      </div>;
    }
    if (type === 'rating') {
      return <div style={box}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Example slider (0–10)</div>
        <div style={{ height: 6, background:'#d9e1ff', borderRadius: 4, width: 240 }} />
      </div>;
    }
    return <div style={box}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Example freeform input</div>
      <div style={{ height: 34, border:'1px solid #ccd', background:'#fff', borderRadius:4 }} />
    </div>;
  };

  // Visual type selector
  renderTypeSelector = () => {
    return (
      <div className={styles.typeSelectorBlock}>
        <div className={styles.typeSelectorLabel}>Choose Question Type</div>
        <div className={styles.typeSelectorGrid} role="group" aria-label="Question types">
          <button
            type="button"
            className={styles.typeButton}
            onClick={() => this.quickAdd('binary')}
            aria-label="Add Binary question"
          >
            <div className={styles.typeTitle}>Binary</div>
            <div className={styles.typePreviewRow}>
              <span className={`${styles.pill} ${styles.pillAgree}`}>Agree</span>
              <span className={`${styles.pill} ${styles.pillUnsure}`}>Unsure</span>
              <span className={`${styles.pill} ${styles.pillDisagree}`}>Disagree</span>
            </div>
          </button>

          <button
            type="button"
            className={styles.typeButton}
            onClick={() => this.quickAdd('rating')}
            aria-label="Add Rating question"
          >
            <div className={styles.typeTitle}>Rating</div>
            <div className={styles.ratingPreviewWrap} aria-hidden="true">
              <div className={styles.ratingPreviewFill} />
              <div className={styles.ratingPreviewHandle} />
            </div>
          </button>

          <button
            type="button"
            className={styles.typeButton}
            onClick={() => this.quickAdd('multichoice')}
            aria-label="Add Multichoice question"
          >
            <div className={styles.typeTitle}>Multichoice</div>
            <div className={styles.typePreviewRow}>
              <span className={styles.pill}>Option 1</span>
              <span className={styles.pill}>Option 2</span>
              <span className={styles.pill}>Option 3</span>
            </div>
          </button>

          <button
            type="button"
            className={styles.typeButton}
            onClick={() => this.quickAdd('freeform')}
            aria-label="Add Freeform question"
          >
            <div className={styles.typeTitle}>Freeform</div>
            <div className={styles.freeformPreview} aria-hidden="true">...</div>
          </button>
        </div>
      </div>
    );
  };

  render() {
    const {
      title, questions, isSubmitting, progress,
      showJson, isStandaloneQuestion,
      surveyAddedSuccessfully, questionsAddedSuccessfully,
      uploadedQuestions, submissionError,
      showAutoTool, documentURLs, lastSubmittedSurveyId,
      autoPopulateAiTags, lastSubmittedSurveyArweaveTxId,
      submitStep,
      surveyLockGateIds,
      openLockKey
    } = this.state;
    const safeDocumentUrls = sanitizeDocumentUrls(documentURLs);
    const hasAuthoredDraftContent = (
      questions.length > 0 ||
      title.trim() !== '' ||
      safeDocumentUrls.length > 0 ||
      surveyAddedSuccessfully ||
      questionsAddedSuccessfully
    );
    // Pile entry starts in AI mode, so hide the survey/questions switch until
    // the user either starts manual authoring or generation produces content.
    const showModeToggle = (
      !this.props.hideSurveyQuestionToggleUntilAuthoring ||
      !showAutoTool ||
      hasAuthoredDraftContent
    );

    const surveyIDForDisplay = lastSubmittedSurveyId || this.state.surveyHash;
    const sessionConfig = this.getSessionConfig();
    const resolvedSessionConfig = this.getResolvedSessionConfig();
    const { gateOptions, defaultGateId } = this.resolveGateOptions(resolvedSessionConfig, { isStandaloneQuestion });
    const hasSelectableGateOptions = Array.isArray(gateOptions) && gateOptions.length > 0;
    const gateIdSet = new Set((Array.isArray(gateOptions) ? gateOptions : []).map((opt) => opt.id));
    const resolvedContracts = mergeSessionContractMaps(
      resolvedSessionConfig?.contracts,
      this.props.contracts,
      sessionConfig?.contracts
    );

    const normalizeSelectedGateIds = (value) => (
      normalizeGateIds(value).filter((gateId) => gateIdSet.has(gateId))
    );
    const surveySelectedGateIds = !isStandaloneQuestion
      ? normalizeSelectedGateIds(surveyLockGateIds)
      : [];

    // JSON preview (only questions; no questionIDs)
    let jsonData = {};
    if (isStandaloneQuestion) {
      jsonData = {
        questions: questions.map(q => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          options: q.type === "multichoice" ? (q.options || []).filter(o => o && o.trim() !== '') : undefined,
          singleSelect: q.type === "multichoice" ? !!q.singleSelect : undefined,
          tags: normalizeTagList(q.tags),
          associatedSurveyId: q.associatedSurveyId || '',
        }))
      };
    } else {
      jsonData = {
        surveyID: this.state.surveyHash,
        title: title,
        documentURLs: safeDocumentUrls,
        questions: questions.map(q => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          options: q.type === "multichoice" ? (q.options || []).filter(o => o && o.trim() !== '') : undefined,
          singleSelect: q.type === "multichoice" ? !!q.singleSelect : undefined,
          tags: normalizeTagList(q.tags),
        }))
      };
    }
    // Note: lock-driven encryption is applied at submit-time per survey/question.

    const manualCreationUI = (
      <>
        {!isStandaloneQuestion && (
          <div className={styles.surveyTitleRow}>
            <Input
              className={styles.surveyTitleInput}
              placeholder="Title"
              data-testid={E2E_TESTIDS.CREATE_TITLE}
              value={title}
              onChange={this.handleTitleChange}
              required={!isStandaloneQuestion}
            />
            {hasSelectableGateOptions ? (
              <div className={styles.surveyTitleLock}>
                <GateMultiSelectLock
                  gateOptions={gateOptions}
                  selectedGateIds={surveySelectedGateIds}
                  onChangeSelectedGateIds={(nextIds) => {
                    const normalized = normalizeSelectedGateIds(nextIds);
                    this.setState({ surveyLockGateIds: normalized }, this.saveToLocalStorage);
                    if (!normalized.length) {
                      this.setState({ openLockKey: '' });
                    }
                  }}
                  open={openLockKey === 'survey'}
                  onToggleOpen={(nextOpen) => {
                    if (nextOpen && surveySelectedGateIds.length === 0 && defaultGateId) {
                      this.setState({ surveyLockGateIds: [defaultGateId] }, this.saveToLocalStorage);
                    }
                    this.setState({ openLockKey: nextOpen ? 'survey' : '' });
                  }}
                  disabled={!hasSelectableGateOptions}
                  showDots={false}
                />
                <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} id="cs-survey-gate-tip" />
                <CETooltip
                  placement="right"
                  trigger="hover focus click"
                  target="cs-survey-gate-tip"
                  className={styles.tooltipBubble}
                >
                  {`Only holders of selected ${t('sbtsLower')} can access locked content.`}
                </CETooltip>
              </div>
            ) : null}
          </div>
        )}

        {/* Multi Document URL Input Group */}
        {!isStandaloneQuestion && (
          <div className={styles.docUrlSection}>
             <div className={styles.docUrlInputGroup}>
              <Input
                className={styles.docUrlInput}
                placeholder="Source document URL (optional)"
                value={this.state.docURLInput || ''}
                onChange={this.handleDocURLInputChange}
                onKeyDown={this.handleDocUrlKeyDown}
              />
              <button
                type="button"
                className={styles.addDocUrlButton}
                onClick={this.addDocumentURL}
                disabled={!this.state.docURLInput.trim()}
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>

            {safeDocumentUrls.length > 0 && (
              <div className={styles.documentUrlDisplay}>
                <strong>Attached Document URL(s):</strong>
                <ul>
                  {safeDocumentUrls.map((url, idx) => (
                    <li key={idx} className={styles.documentUrlItem}>
                      {litStorage.isLitArweaveUrl(url) ? (
                        <span className={styles.documentUrlEncrypted}>
                          Encrypted doc ({url})
                        </span>
                      ) : (
                        <a
                          href={normalizeArweaveUrl(url, { contextLabel: 'create_survey_document_url' })}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {url}
                        </a>
                      )}
                      <span
                        className={styles.removeDocumentUrlButton}
                        onClick={() => this.removeDocumentURL(idx)}
                        title="Remove URL"
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {questions.map((question, qIndex) => {
          const questionTags = normalizeTagList(question.tags);
          const aiSourceTags = normalizeTagList(question.aiGeneratedTagsFromSource);
          // Logic to determine if the "Magic Wand" (Generate Tags) button should be visible
          // It hides if tags are already fully populated from AI source
          const hasAiSourceTags = aiSourceTags.length > 0;
          const aiSourceTagsFullyInQuestionTags = hasAiSourceTags &&
            aiSourceTags.every((aiTag) => questionTags.includes(aiTag)) &&
            questionTags.length === aiSourceTags.length;

          let showGenerateTagsButton = false;
          if (!hasAiSourceTags) {
            showGenerateTagsButton = true;
          } else {
            if (!autoPopulateAiTags && !aiSourceTagsFullyInQuestionTags) {
              showGenerateTagsButton = true;
            }
          }
          if (question.isGeneratingTags) showGenerateTagsButton = true;

          return (
            <div
              key={question.uiKey || `question-${qIndex}`}
              className={styles.questionContainer}
              data-testid={E2E_TESTIDS.CREATE_QUESTION}
              data-ce-question-index={qIndex}
            >
              <div className={styles.questionHeader}>
                <strong className={styles.questionTypeText}>
                  #{qIndex + 1}: {question.type ? (question.type.charAt(0).toUpperCase() + question.type.slice(1)) : 'Unknown Type'} Question
                </strong>
                <div className={styles.questionHeaderActions}>
                  {(() => {
                    const lockKey = `q-lock:${question.uiKey || qIndex}`;
                    const inheritsSurvey =
                      !isStandaloneQuestion &&
                      (!Object.prototype.hasOwnProperty.call(question || {}, 'lockGateIds') || question.lockGateIds === null);
                    const selectedGateIds = isStandaloneQuestion
                      ? normalizeSelectedGateIds(question.lockGateIds)
                      : (inheritsSurvey ? surveySelectedGateIds : normalizeSelectedGateIds(question.lockGateIds));

                    return hasSelectableGateOptions ? (
                      <>
                        {!isStandaloneQuestion && (
                          <label className={styles.inheritToggle}>
                            <input
                              type="checkbox"
                              checked={inheritsSurvey}
                              onChange={(e) => {
                                const checked = !!e.target.checked;
                                this.setState((prev) => {
                                  const updated = Array.isArray(prev.questions) ? [...prev.questions] : [];
                                  const nextQ = { ...(updated[qIndex] || {}) };
                                  if (checked) {
                                    nextQ.lockGateIds = null;
                                  } else {
                                    const base = normalizeSelectedGateIds(prev.surveyLockGateIds);
                                    nextQ.lockGateIds = base.length ? base : (defaultGateId ? [defaultGateId] : []);
                                  }
                                  updated[qIndex] = nextQ;
                                  return { questions: updated, openLockKey: '' };
                                }, this.saveToLocalStorage);
                              }}
                            />
                            inherit
                          </label>
                        )}

                        <GateMultiSelectLock
                          gateOptions={gateOptions}
                          selectedGateIds={selectedGateIds}
                          onChangeSelectedGateIds={(nextIds) => {
                            const normalized = normalizeSelectedGateIds(nextIds);
                            this.setState((prev) => {
                              const updated = Array.isArray(prev.questions) ? [...prev.questions] : [];
                              const nextQ = { ...(updated[qIndex] || {}) };
                              nextQ.lockGateIds = normalized;
                              updated[qIndex] = nextQ;
                              return {
                                questions: updated,
                                openLockKey: normalized.length ? prev.openLockKey : '',
                              };
                            }, this.saveToLocalStorage);
                          }}
                          open={openLockKey === lockKey}
                          onToggleOpen={(nextOpen) => {
                            if (nextOpen && selectedGateIds.length === 0 && defaultGateId) {
                              if (!isStandaloneQuestion && inheritsSurvey) {
                                this.setState({ surveyLockGateIds: [defaultGateId] }, this.saveToLocalStorage);
                              } else {
                                this.setState((prev) => {
                                  const updated = Array.isArray(prev.questions) ? [...prev.questions] : [];
                                  const nextQ = { ...(updated[qIndex] || {}) };
                                  nextQ.lockGateIds = [defaultGateId];
                                  updated[qIndex] = nextQ;
                                  return { questions: updated };
                                }, this.saveToLocalStorage);
                              }
                            }
                            this.setState({ openLockKey: nextOpen ? lockKey : '' });
                          }}
                          disabled={!hasSelectableGateOptions}
                          showDots={false}
                        />
                      </>
                    ) : null;
                  })()}

                  <Button className={styles.removeQuestionButton} onClick={() => this.removeQuestion(qIndex)}>
                    <FontAwesomeIcon icon={faTimes} />
                  </Button>
                </div>
              </div>

              {/* Ref attached to the prompt textarea for auto-focus */}
              <Input
                innerRef={el => { this._promptRefs[question.uiKey] = el; }}
                type="textarea"
                rows="2"
                className={styles.questionPromptInput}
                placeholder="Question prompt"
                data-testid={E2E_TESTIDS.CREATE_QUESTION_PROMPT}
                value={question.prompt || ''}
                onChange={e => this.handleQuestionChange(qIndex, 'prompt', e.target.value)}
              />

              {question.type === "multichoice" && (
                <div className={styles.optionsContainer}>
                  {(question.options || []).map((option, oIndex) => (
                    <div key={`option-${question.uiKey || qIndex}-${oIndex}`} className={styles.optionItem}>
                      <Input
                        placeholder={`Option ${oIndex + 1}`}
                        value={option}
                        onChange={e => this.handleOptionChange(qIndex, oIndex, e.target.value)}
                        className={styles.optionInput}
                      />
                      <Button className={styles.removeOptionButton} onClick={() => this.removeOption(qIndex, oIndex)}>
                        <FontAwesomeIcon icon={faTimes} />
                      </Button>
                    </div>
                  ))}
                  {(question.options || []).length < 10 && (
                    <Button
                      className={styles.addOptionButton}
                      data-testid={E2E_TESTIDS.CREATE_QUESTION_ADD_OPTION}
                      onClick={() => this.addOption(qIndex)}
                    >
                      <FontAwesomeIcon icon={faPlus} /> Add Option
                    </Button>
                  )}
                  {/* Single-select limits multichoice answers to one option. */}
                  <div className={styles.singleSelectToggle}>
                    <label className={styles.singleSelectLabel}>
                      <input
                        type="checkbox"
                        data-testid={E2E_TESTIDS.CREATE_QUESTION_SINGLE_SELECT}
                        checked={!!question.singleSelect}
                        onChange={(e) => this.handleQuestionChange(qIndex, 'singleSelect', e.target.checked)}
                      />
                      <span>One Selection Only</span>
                      <FontAwesomeIcon
                        icon={faQuestionCircle}
                        className={styles.tooltip}
                        id={`singleSelectTooltip-${question.uiKey || qIndex}`}
                      />
                      <CETooltip
                        placement="right"
                        trigger="hover focus click"
                        target={`singleSelectTooltip-${question.uiKey || qIndex}`}
                        className={styles.tooltipBubble}
                      >
                        Single-select limits respondents to one option. Multi-select allows multiple choices.
                      </CETooltip>
                    </label>
                  </div>
                </div>
              )}
              <div className={styles.questionMetadata}>
                <div className={styles.tagsManagerContainer}>
                  <div className={styles.tagsContainer}>
                    {questionTags.map((tag, tagIndex) => (
                      <span key={`${qIndex}-${tagIndex}-${tag}`} className={styles.filterBubble}>
                        {tag}
                        <FontAwesomeIcon
                          icon={faTimes}
                          className={styles.removeIcon}
                          onClick={() => this.removeTagFromQuestion(qIndex, tagIndex)}
                        />
                      </span>
                    ))}

                    {/* Updated Tag Input UX */}
	                    <div className={styles.tagInputGroup}>
	                      <Input
	                        type="text"
	                        placeholder="Add tag"
	                        data-testid={E2E_TESTIDS.CREATE_QUESTION_TAG_INPUT}
	                        value={question.currentTagInputValue || ''}
	                        onChange={e => this.handleCurrentTagInputChange(qIndex, e.target.value)}
	                        onKeyDown={e => this.handleTagInputKeyDown(qIndex, e)}
	                        className={styles.tagInputField}
	                      />

	                      {/* Checkmark: Only visible when user is typing */}
	                      {(question.currentTagInputValue || '').trim() !== '' && (
	                        <button
	                          type="button"
                          className={styles.addTagButton}
                          data-testid={E2E_TESTIDS.CREATE_QUESTION_ADD_TAG}
                          onClick={() => this.processTagInput(qIndex)}
                          title="Add Tag"
                        >
                          <FontAwesomeIcon icon={faCheck} />
                        </button>
                      )}

                      {/* Magic Wand: Replaces old generate button, hidden if tags populated */}
                      {showGenerateTagsButton && (
                        <button
                          type="button"
                          className={styles.magicTagButton}
                          onClick={() => this.suggestTagsForQuestion(qIndex)}
                          disabled={question.isGeneratingTags || !question.prompt.trim()}
                          title={!question.prompt.trim() ? "Enter a question prompt to generate tags" : "Generate tags using AI"}
                        >
                          {question.isGeneratingTags ? (
                            <FontAwesomeIcon icon={faSpinner} spin />
                          ) : (
                            <FontAwesomeIcon icon={faMagic} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Visual type selector */}
        {this.renderTypeSelector()}

        {/* Submit Button: only render if at least one question exists */}
        {questions.length > 0 && (
          <>
            <Button
              className={`${styles.createSurveyButton} ${styles.submitSurveyBtn} ${isSubmitting ? styles.submittingButton : ''} ${submissionError ? styles.errorButton : ''}`}
              data-testid={E2E_TESTIDS.CREATE_SUBMIT}
              onClick={(this.state.needsNetworkSwitch && this.props.provider === 'wagmi' && this.props.loginComplete)
                ? this.switchToCorrectNetwork
                : this.handleSubmitButtonClick}
              disabled={
                isSubmitting ||
                ((this.state.needsNetworkSwitch && this.props.provider === 'wagmi' && this.props.loginComplete)
                  ? false
                  : (submissionError ? false : ((!isStandaloneQuestion && !title.trim()) || questions.some(q => q.isGeneratingTags))))
              }
              aria-busy={isSubmitting ? 'true' : 'false'}
              title={submissionError ? 'Click to copy error' : undefined}
            >
              {isSubmitting && (
                <span
                  className={styles.buttonProgressFill}
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                  aria-hidden="true"
                />
              )}
              <span className={styles.buttonContent}>
                {isSubmitting ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />
                    Submitting...
                  </>
                ) : submissionError ? (
                  <>
                    <FontAwesomeIcon icon={faExclamationCircle} style={{ marginRight: 8 }} />
                    {submissionError}
                    <span className={styles.copyHint}>&nbsp;— click to copy</span>
                  </>
                ) : (
                  (this.state.needsNetworkSwitch && this.props.provider === 'wagmi' && this.props.loginComplete)
                    ? "Switch to correct network → Submit"
                    : (isStandaloneQuestion ? "Create Questions" : "Create Survey")
                )}
              </span>
            </Button>

            {/* Progress Indicator: Only visible during/after submission steps */}
            {(isSubmitting || this.state.showSubmitSteps) && (
              <div className={styles.progressIndicator}>
                <div className={submitStep >= 1 ? styles.stepCompleted : styles.step}>
                  <FontAwesomeIcon
                    icon={submitStep === 1 ? faSpinner : submitStep > 1 ? faCheck : faExclamationCircle}
                    spin={submitStep === 1}
                  />
                  <span>Upload Arweave</span>
                </div>
                <div className={submitStep >= 2 ? styles.stepCompleted : styles.step}>
                  <FontAwesomeIcon
                    icon={submitStep === 2 ? faSpinner : submitStep > 2 ? faCheck : faExclamationCircle}
                    spin={submitStep === 2}
                  />
                  <span>Submit Contract</span>
                </div>
                <div className={submitStep >= 3 ? styles.stepCompleted : styles.step}>
                  <FontAwesomeIcon
                    icon={submitStep === 3 ? faCheck : faExclamationCircle}
                  />
                  <span>Done</span>
                </div>
              </div>
            )}
          </>
        )}

        {submissionError && !isSubmitting && (
          <div className={styles.errorMessage}>Error: {submissionError}</div>
        )}

        {questionsAddedSuccessfully && (
          <div className={styles.surveySubmissionConfirmation} data-testid={E2E_TESTIDS.CREATE_SUCCESS}>
            <h3>Questions Added Successfully!</h3>
            {uploadedQuestions && uploadedQuestions.length > 0 && (
              <div className={styles.uploadedQuestionsList} data-testid={E2E_TESTIDS.CREATE_UPLOADED_QUESTIONS}>
                <h4>Uploaded Questions:</h4>
                <ul>
                  {uploadedQuestions.map(({ questionId, arweaveTxId }, index) => {
                    const idL = String(questionId).toLowerCase();
                    const bookmarked = this.state.bookmarkedQuestionsSet.has(idL);
                    const sessionSlug = this.getActiveSessionSlug();
                    return (
                      <li
                        key={`uploaded-${questionId}-${index}`}
                        className={styles.uploadedQuestionItem}
                        data-testid={E2E_TESTIDS.CREATE_UPLOADED_QUESTION}
                        data-ce-question-id={String(questionId || '').trim().toLowerCase()}
                      >
                        <a href={`${window.location.origin}${buildQuestionRoutePath(questionId, { sessionSlug })}`}>
                          {questionId.substring(0, 10)}...{questionId.substring(questionId.length - 8)}
                        </a>
                        <a
                          href={normalizeArweaveUrl(arweaveTxId, { contextLabel: 'create_survey_question_link' })}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View on Arweave"
                          style={{ marginLeft: '10px', marginRight: '5px', textDecoration: 'none', color: '#007bff' }}
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} size="sm" />
                        </a>
                        <Button
                          className={styles.copyQuestionIdButton}
                          onClick={() => this.copyQuestionIdToClipboard(questionId)}
                          title="Copy Question ID"
                          size="sm"
                          color="link"
                          style={{padding: '0 5px'}}
                        >
                          <FontAwesomeIcon icon={faClipboard} />
                        </Button>
                        <Button
                          className={styles.bookmarkQuestionButton}
                          onClick={() => this.bookmarkQuestion(questionId)}
                          title="Bookmark Question ID"
                          size="sm"
                          color="link"
                          style={{padding: '0 5px'}}
                        >
                          <FontAwesomeIcon icon={faBookmark} style={{ color: bookmarked ? '#ffc107' : undefined }} />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {surveyAddedSuccessfully && surveyIDForDisplay && (
          <div className={styles.surveySubmissionConfirmation} data-testid={E2E_TESTIDS.CREATE_SUCCESS}>
            <h3>Survey Created</h3>

            <div className={styles.successActionsRow}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => this.copySurveyLinkToClipboard(surveyIDForDisplay)}
                title="Copy Link to Survey Page"
              >
                <FontAwesomeIcon
                  icon={this.state.copySurveyLinkSuccess ? faCheck : faClipboard}
                  style={{ marginRight: '5px' }}
                />
                Copy Link
              </button>

              <a
                href={`/survey/${surveyIDForDisplay}${this.getActiveSessionSlug() ? `?session=${encodeURIComponent(this.getActiveSessionSlug())}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.actionBtn} ${styles.actionLink}`}
                title="Open Survey Page in New Tab"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
                View Survey
              </a>

              {lastSubmittedSurveyArweaveTxId && (
                <a
                  href={normalizeArweaveUrl(lastSubmittedSurveyArweaveTxId, { contextLabel: 'create_survey_link' })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.actionBtn} ${styles.actionLink}`}
                  title="View on Arweave"
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                  Arweave
                </a>
              )}

              <button
                type="button"
                onClick={() => this.bookmarkSurvey(surveyIDForDisplay)}
                className={styles.actionBtn}
                title="Bookmark Survey"
              >
                <FontAwesomeIcon
                  icon={faBookmark}
                  style={{ color: this.state.bookmarkedSurveysSet.has(String(surveyIDForDisplay).toLowerCase()) ? '#ffe082' : undefined }}
                />
                Bookmark
              </button>

              <button
                type="button"
                onClick={() => this.copySurveyIdToClipboard(surveyIDForDisplay)}
                className={styles.actionBtn}
                title="Copy Survey ID"
              >
                <FontAwesomeIcon icon={this.state.copySurveyIdSuccess ? faCheck : faClipboard} />
                {this.state.copySurveyIdSuccess ? 'Copied!' : 'Copy ID'}
              </button>
            </div>
          </div>
        )}

        {/* JSON preview area */}
        {showJson && (
          <JsonPanel
            as="pre"
            onCopy={() => this.copyJsonPreview(jsonData)}
            copied={this.state.copyJsonSuccess}
            copyTitle="Copy JSON"
          >
            {JSON.stringify(jsonData, null, 2)}
          </JsonPanel>
        )}

        {/* Shared toolbar */}
        <JsonButtonRow align="end" className={styles.jsonPromptBar}>
          <JsonToggleButton
            label={showJson ? 'Hide JSON' : 'Show JSON'}
            active={showJson}
            onClick={this.toggleShowJson}
          />
          <JsonToggleButton
            label={this.state.showAIPrompt ? 'Hide AI Prompt' : 'Show AI Prompt'}
            active={this.state.showAIPrompt}
            onClick={this.toggleAIPrompt}
            icon={this.state.showAIPrompt ? faCaretUp : faCaretDown}
          />
        </JsonButtonRow>

        {/* AI Prompt panel */}
        {this.state.showAIPrompt && (
          <div className={styles.aiPromptWrapper}>
            <button
              type="button"
              className={`${styles.aiPromptCopyCorner} ${this.state.aiPromptCopySuccess ? styles.aiPromptCopyCornerSuccess : ''}`}
              onClick={this.copyAIPromptToClipboard}
              title="Copy prompt"
            >
              <FontAwesomeIcon icon={this.state.aiPromptCopySuccess ? faCheck : faClipboard} />
            </button>

            <div className={styles.aiPromptHeader}>
              <strong>{`AI Prompt — ${this.state.aiPromptModelLabel}`}</strong>
            </div>

            <div className={styles.aiPromptMeta}>
              Variables:&nbsp;
              <span className={styles.aiVar}>&lt;SourceDocContent&gt;</span>,{' '}
              <span className={styles.aiVar}>&lt;NumSeedStatements&gt;</span>,{' '}
              <span className={styles.aiVar}>&lt;Types&gt;</span>,{' '}
              <span className={styles.aiVar}>&lt;DefaultTags&gt;</span>
            </div>

            <div className={styles.jsonDisplayWrapper}>
              <pre className={styles.jsonDisplay}>
                {this.highlightPromptVariables(this.state.aiPromptText || '(Prompt not available)')}
              </pre>
            </div>
          </div>
        )}
      </>
    );

    return (
      <div
        className={`${styles.createSurveyContainer} ${this.props.miniaturized ? styles.miniaturized : ''}`}
        data-testid={E2E_TESTIDS.CREATE_PANEL}
      >
        {/* Header: Survey/Questions toggle + single context-aware mode switch */}
        <div className={styles.modeHeader}>
          {showModeToggle && (
            <div className={styles.modeToggle}>
              <Label className={styles.toggleLabel}> Survey</Label>
              <div
                className={styles.toggleSwitch}
                onClick={this.toggleStandaloneQuestion}
              >
                <div
                  className={styles.toggleKnob}
                  style={{
                    left: isStandaloneQuestion ? '31px' : '1px',
                    backgroundColor: isStandaloneQuestion ? '#4caf50' : '#fff',
                  }}
                />
              </div>
              <Label className={styles.toggleLabel} style={{ marginLeft: '10px' }}>
                Questions
              </Label>
            </div>
          )}

          {!this.props.miniaturized && !this.props.preformedQuestions && (
            <Button
              className={styles.modeSwitchButton}
              data-testid={E2E_TESTIDS.CREATE_MODE_SWITCH}
              onClick={() => this.setState({ showAutoTool: !showAutoTool })}
              color="secondary"
              outline
            >
              <FontAwesomeIcon icon={showAutoTool ? faPenNib : faMagic} style={{ marginRight: '6px' }} />
              {showAutoTool ? 'Manual' : 'from URL / Content'}
            </Button>
          )}

          {/* Clear Form Button */}
          {(!this.props.preformedQuestions && !this.state.showAutoTool && (this.state.questions.length > 0 || this.state.title.trim() !== '')) && (
            <button
              type="button"
              className={styles.clearFormButton}
              data-testid={E2E_TESTIDS.CREATE_CLEAR}
              onClick={this.handleClearForm}
              title="Clear entire form"
              style={{ marginLeft: 'auto' }} // Push to right if space permits
            >
              <FontAwesomeIcon icon={faEraser} style={{ marginRight: '6px' }} />
              Clear
            </button>
          )}
        </div>

        {this.state.showAutoTool && !this.props.miniaturized && !this.props.preformedQuestions ? (
          <div style={{ marginTop: '20px' }}>
            <AudioSurveyGenerator
              minified={true}
              hideEncryption={true}
              provider={this.props.provider}
              network={this.props.network}
              account={this.props.account}
              loginComplete={this.props.loginComplete}
              toggleLoginModal={this.props.toggleLoginModal}
              defaultTags={this.props.defaultTags || []}
              onQuestionsGenerated={this.handleAutoQuestionsGenerated}
              sessionConfig={resolvedSessionConfig}
              contracts={resolvedContracts}
              activeSessionSlug={this.getActiveSessionSlug()}
            />
          </div>
        ) : (
          manualCreationUI
        )}
        <CEConfirmDialog
          isOpen={!!this.state.showClearFormConfirm}
          title="Clear form?"
          body="This removes the unsaved survey or question draft from this browser."
          confirmLabel="Clear"
          cancelLabel="Keep editing"
          danger
          onCancel={this.cancelClearForm}
          onConfirm={this.confirmClearForm}
          testId="ce-survey-clear-confirm"
        />
      </div>
    );
  }
}

export default CreateQuestionsAndSurveys;
