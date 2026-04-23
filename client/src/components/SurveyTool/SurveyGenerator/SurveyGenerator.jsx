
import React, { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSpinner,
  faQuestionCircle,
  faCog,
  faCaretDown,
  faCaretUp,
  faLock,
  faFileAudio,
  faClipboard,
  faCheck,
  faPlus,
  faSquare,
  faCheckSquare,
  faUpload,
  faImage
} from '@fortawesome/free-solid-svg-icons';
import {
  Input,
  Button,
  FormGroup,
  Label
} from 'reactstrap';
import styles from './AudioSurveyGenerator.module.scss';



import {
  callAI,
  transcribeAudio,
  generateAudioDiscussionSummary,
  uploadMarkdownSummaryToArweave,
  processAdditionalSources,
  fetchContentFromURL,
  analyzePhotoForQuestionGeneration
} from '../../../utilities/ai/aiScripts.js';
import { getEffectiveAiConfig } from '../../../utilities/ai/aiSettings.js';
import {
  getAllSessionSlugs,
  getSessionConfigBySlug,
} from '../../../utilities/web3/contractScripts.js';
import AudioInput from '../../Shared/AudioInput/AudioInput';
import CreateQuestionsAndSurveys from '../CreateQuestionsAndSurveys.jsx';
import SBTSelector from '../../SBTs/SBTSelector.jsx';
import DocumentLibraryPanel from '../../DocumentLibrary/DocumentLibraryPanel';
import SessionChipSelector from '../../Shared/SessionChipSelector';

import { seedGenPrompt } from '../../../prompts/seedGenPrompt.js';
import {
  buildSbtAccessControlConditions,
  buildWalletAddressAccessControlConditions,
  getGlobalLitHooks,
  resolveLitChain,
  litStorage,
} from '../../../utilities/crypto/litProtocol.js';
import {
  buildDocLibraryCommonTags,
  buildDocLibraryRoleTags,
  buildDocLibrarySessionTags,
  DOC_LIBRARY_DOC_ROLES,
  mergeTags,
  normalizeSessionIdHex,
} from '../../../utilities/docLibrary/tags.js';
import {
  buildSessionDocLibraryViewerUrl,
  resolveDocUploadsGate,
  uploadDocLibraryFile,
  uploadDocLibraryUrlRecord,
} from '../../../utilities/docLibrary/uploads.js';
import {
  resolveSponsoredGateStateForResource,
  getGateSbtAddresses,
  normalizeGateMode,
  SPONSORED_GATE_STATES,
} from '../../../utilities/web3/sponsoredAccess.js';
import { resolveEncryptionGate } from '../../../utilities/crypto/encryptionGates.js';
import { getEffectiveArweaveKey } from '../../../utilities/session/resourceKeys.js';
import {
  mergeSessionContractMaps,
  normalizeSessionSlug,
  resolveSessionConfigAliases,
} from '../../../utilities/session/sessionNaming.js';
import { createLogger } from 'utilities/logging.js';
import { generateQuestionId as generateSharedQuestionId } from '../../../utilities/shared/questionUtils.mjs';
import { toStr } from '../../../utilities/shared/primitives.js';
import { notify } from '../../../utilities/ui/notify.js';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';

const cacheLog = createLogger('cache');
const AI_PROVIDER_LABELS = Object.freeze({
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  custom: 'Custom',
  local: 'Local',
});
const DEFAULT_QUESTION_COUNT = 10;
const QUESTION_COUNT_STEP = 5;
const MIN_QUESTION_COUNT = 5;
const MAX_QUESTION_COUNT = 50;
const SUPPORTED_PHOTO_EXTENSIONS = /\.(png|jpe?g|webp|gif)$/i;
const SUPPORTED_PHOTO_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const PHOTO_ANALYSIS_STATUS_LABELS = Object.freeze({
  queued: 'Queued for analysis',
  loading: 'Analyzing photo...',
  ready: 'Analysis complete',
  error: 'Analysis failed',
});

const clampQuestionCount = (value) => Math.min(MAX_QUESTION_COUNT, Math.max(MIN_QUESTION_COUNT, value));

const buildAdditionalSourceId = (ref) => {
  ref.current += 1;
  return `database-source-${ref.current}`;
};

const isSupportedPhotoFile = (file) => (
  Boolean(file) &&
  (
    /^image\/(png|jpeg|webp|gif)$/i.test(String(file?.type || '').trim()) ||
    SUPPORTED_PHOTO_EXTENSIONS.test(String(file?.name || '').trim())
  )
);

const buildQueuedPhotoSource = (file, ref) => ({
  id: buildAdditionalSourceId(ref),
  type: 'photo',
  value: file,
  name: file.name,
  analysisStatus: 'queued',
  analysisError: '',
  analysisText: '',
  analysisExpanded: false,
});

const buildUnsupportedPhotoMessage = (count = 0) => (
  `Skipped ${count} unsupported photo${count === 1 ? '' : 's'}. Use png, jpg, jpeg, webp, or gif.`
);

const getPhotoStatusLabel = (source = {}) => {
  const status = toStr(source?.analysisStatus || 'queued').trim().toLowerCase();
  if (status === 'error') {
    return toStr(source?.analysisError).trim() || PHOTO_ANALYSIS_STATUS_LABELS.error;
  }
  return PHOTO_ANALYSIS_STATUS_LABELS[status] || PHOTO_ANALYSIS_STATUS_LABELS.queued;
};

const buildPhotoPreviewUrl = (file) => {
  if (!file || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return '';
  }
  return URL.createObjectURL(file);
};

function QueuedPhotoPreview({ file, photoName, sourceId }) {
  const [previewSrc] = useState(() => buildPhotoPreviewUrl(file));

  useEffect(() => {
    return () => {
      if (previewSrc && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewSrc);
      }
    };
  }, [previewSrc]);

  if (!previewSrc) {
    return (
      <div
        className={styles.photoPreviewFallback}
        aria-hidden="true"
        data-testid={E2E_TESTIDS.DATABASE_PHOTO_SOURCE_PREVIEW}
        data-ce-source-id={sourceId}
      >
        <FontAwesomeIcon icon={faImage} />
      </div>
    );
  }

  return (
    <img
      src={previewSrc}
      alt={`${photoName || 'Uploaded photo'} preview`}
      className={styles.photoPreviewImage}
      data-testid={E2E_TESTIDS.DATABASE_PHOTO_SOURCE_PREVIEW}
      data-ce-source-id={sourceId}
    />
  );
}

const buildPhotoAnalysisMarkdown = ({ photoName, analysisText } = {}) => {
  const safeName = toStr(photoName).trim() || 'uploaded photo';
  const body = toStr(analysisText).trim();
  return [
    '# Photo Analysis',
    '',
    `Source photo: ${safeName}`,
    '',
    body,
  ].join('\n');
};

const buildPhotoAnalysisFilename = (photoName = '') => {
  const safeName = toStr(photoName).trim() || 'photo';
  const withoutExtension = safeName.replace(/\.(png|jpe?g|webp|gif)$/i, '') || safeName;
  return `${withoutExtension}.analysis.md`;
};
const formatAiPromptModelLabel = (config = {}) => {
  const providerKey = toStr(config?.provider).trim().toLowerCase();
  const model = toStr(config?.model).trim();
  const provider =
    AI_PROVIDER_LABELS[providerKey] ||
    (providerKey ? `${providerKey.charAt(0).toUpperCase()}${providerKey.slice(1)}` : '');
  if (provider && model) return `${provider} ${model}`;
  return model || provider || 'Configured model';
};






// Dev-only logger
const debug = (...args) => {
  if (process.env.NODE_ENV !== 'production') cacheLog.log(...args);
};

// Helper function to normalize defaultTags prop
const normalizeTags = (dTags) => {
  if (!dTags) return [];
  if (Array.isArray(dTags)) return dTags.filter(Boolean).map(t => t.trim());
  if (typeof dTags === 'string')
    return dTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  return [];
};

export const isSingleHttpUrlInput = (value = '') => /^https?:\/\/\S+$/.test(String(value).trim());
export const hasDatabaseToolInputContent = ({
  pastedText = '',
  additionalUrlInput = '',
  additionalSources = [],
  audioFile = null,
} = {}) => {
  if (toStr(pastedText).trim()) return true;
  if (toStr(additionalUrlInput).trim()) return true;
  if (Array.isArray(additionalSources) && additionalSources.length > 0) return true;
  return Boolean(audioFile);
};

const LazyCorpusViewer = React.lazy(() => import('../../DemoViews/CorpusViewer'));


export default function AudioSurveyGenerator(rawProps = {}) {
  const {
    provider,
    network,
    account,
    loginComplete,
    toggleLoginModal,
    minified = false,
    defaultTags,
    onQuestionsGenerated,
    hideEncryption = true,
    sessionConfig,
    activeSessionSlug,
    contracts,
    explorerMode = 'add',
    demoSurfaceMode = null,
    sessionOverrideSlug,
    sessionOverrideTouched,
    hideInternalSessionSelector,
  } = rawProps;
  // UI Modes
  const [transcriptMode, setTranscriptMode] = useState(false);
  // NEW: Toggle for Arweave upload
  const [uploadSummaryToArweave, setUploadSummaryToArweave] = useState(true);
  const [encryptSummary, setEncryptSummary] = useState(false);

  // Input States
  const [pastedText, setPastedText] = useState('');
  const [textEncrypted, setTextEncrypted] = useState(false);

  // Audio specific
  const [audioFile, setAudioFile] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // AI Prompt Panel State
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [aiPromptLoaded, setAiPromptLoaded] = useState(false);
  const [aiPromptCopySuccess, setAiPromptCopySuccess] = useState(false);
  const [aiPromptModelLabel, setAiPromptModelLabel] = useState('Configured model');

  const [questionTypes, setQuestionTypes] = useState({
    // defaults
    binary: true,
    multichoice: true,
    rating: false,
    freeform: false,
  });
  const [count, setCount] = useState(DEFAULT_QUESTION_COUNT);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const waitTimerRef = React.useRef(null);
  const [surveyTitle, setSurveyTitle] = useState('');
  const [statementsToUpload, setStatementsToUpload] = useState([]);
  const [prefilledAnswers, setPrefilledAnswers] = useState([]);
  const [showCreateSurvey, setShowCreateSurvey] = useState(false);
  const [documentURLs, setDocumentURLs] = useState([]);

  // AUDIO summary-first flow state
  const [summaryMd, setSummaryMd] = useState('');
  const [summaryCollapsed, setSummaryCollapsed] = useState(true);
  const [summaryArweaveTxId, setSummaryArweaveTxId] = useState('');
  const [summaryDocURL, setSummaryDocURL] = useState('');

  const [showSessionSelector, setShowSessionSelector] = useState(false);
  const [localSessionOverrideSlug, setLocalSessionOverrideSlug] = useState(null);
  const [localSessionOverrideTouched, setLocalSessionOverrideTouched] = useState(false);
  const hasControlledSessionOverride =
    Object.prototype.hasOwnProperty.call(rawProps, 'sessionOverrideSlug') ||
    Object.prototype.hasOwnProperty.call(rawProps, 'sessionOverrideTouched') ||
    Object.prototype.hasOwnProperty.call(rawProps, 'hideInternalSessionSelector');
  const demoSurfaceEnabled = demoSurfaceMode !== false;
  const [showDemoCorpusView, setShowDemoCorpusView] = useState(demoSurfaceEnabled);

  // Multi-source State
  const [additionalSources, setAdditionalSources] = useState([]);
  const [additionalUrlInput, setAdditionalUrlInput] = useState('');
  const additionalFileInputRef = useRef(null);
  const additionalPhotoInputRef = useRef(null);
  const uploadAudioInputRef = useRef(null);
  const additionalSourceIdRef = useRef(0);
  const [saveExtraSourcesToDocLibrary, setSaveExtraSourcesToDocLibrary] = useState(false);
  const [saveDocAudience, setSaveDocAudience] = useState('self');
  const [showSaveDocAudienceMenu, setShowSaveDocAudienceMenu] = useState(false);

  const [summaryGateSBTs, setSummaryGateSBTs] = useState([]);
  const [summaryGateMode, setSummaryGateMode] = useState('any');
  const lastSummaryGateKeyRef = useRef('');
  const controlledSessionTouched = Boolean(sessionOverrideTouched);

  const effectiveSessionSlugInput = useMemo(() => (
    hasControlledSessionOverride
      ? (
        controlledSessionTouched
          ? normalizeSessionSlug(sessionOverrideSlug || '')
          : activeSessionSlug
      )
      : (
        localSessionOverrideTouched
          ? normalizeSessionSlug(localSessionOverrideSlug || '')
          : activeSessionSlug
      )
  ), [
    activeSessionSlug,
    controlledSessionTouched,
    hasControlledSessionOverride,
    localSessionOverrideSlug,
    localSessionOverrideTouched,
    sessionOverrideSlug,
  ]);
  const effectiveSessionConfigInput = useMemo(() => {
    if (hasControlledSessionOverride) {
      if (!controlledSessionTouched) return sessionConfig;
      return getSessionConfigBySlug(normalizeSessionSlug(sessionOverrideSlug || '')) || null;
    }
    if (!localSessionOverrideTouched) return sessionConfig;
    return getSessionConfigBySlug(normalizeSessionSlug(localSessionOverrideSlug || '')) || null;
  }, [
    controlledSessionTouched,
    hasControlledSessionOverride,
    localSessionOverrideSlug,
    localSessionOverrideTouched,
    sessionConfig,
    sessionOverrideSlug,
  ]);
  const resolvedSessionAliases = useMemo(() => resolveSessionConfigAliases({
    sessionSlug: effectiveSessionSlugInput,
    sessionConfig: effectiveSessionConfigInput,
  }, {
    resolveBySlug: (slug) => getSessionConfigBySlug(slug),
  }), [effectiveSessionConfigInput, effectiveSessionSlugInput]);
  const resolvedSessionSlug = resolvedSessionAliases.sessionSlug;
  const resolvedSessionConfig = useMemo(() => {
    const cfg = resolvedSessionAliases.sessionConfig || {};
    const slug = normalizeSessionSlug(cfg.slug || resolvedSessionAliases.sessionSlug || '');
    return {
      ...cfg,
      slug,
      contracts: mergeSessionContractMaps(cfg.contracts, contracts),
    };
  }, [resolvedSessionAliases.sessionConfig, resolvedSessionAliases.sessionSlug, contracts]);
  const resolvedSessionIdHex = useMemo(() => normalizeSessionIdHex(
    resolvedSessionConfig?.__registry?.sessionIdHex ||
    resolvedSessionConfig?.__registry?.sessionId ||
    resolvedSessionConfig?.sessionIdHex ||
    resolvedSessionConfig?.sessionId ||
    ''
  ), [resolvedSessionConfig]);
  const resolvedSessionIdToken = useMemo(() => (
    toStr(resolvedSessionConfig?.__registry?.sessionId || resolvedSessionConfig?.sessionId || '').trim()
  ), [resolvedSessionConfig]);
  const docSaveSessionToken = useMemo(
    () => resolvedSessionIdToken || resolvedSessionSlug || '',
    [resolvedSessionIdToken, resolvedSessionSlug],
  );
  const docSaveGate = useMemo(
    () => resolveDocUploadsGate(resolvedSessionConfig),
    [resolvedSessionConfig],
  );
  const docSaveSessionLabel = useMemo(() => {
    const sessionName = toStr(resolvedSessionConfig?.sessionName).trim();
    if (sessionName) return sessionName;
    const slug = toStr(resolvedSessionSlug).trim();
    if (slug) return slug;
    return 'Session';
  }, [resolvedSessionConfig, resolvedSessionSlug]);
  const networkChainId = network?.id || null;
  const aiRequestOptions = useMemo(() => ({
    sessionSlug: resolvedSessionSlug || '',
    sessionConfig: resolvedSessionConfig,
    context: {
      account,
      providerLike: provider,
      chainId: networkChainId,
    },
  }), [resolvedSessionSlug, resolvedSessionConfig, account, provider, networkChainId]);

  const summaryGate = useMemo(() => {
    const cfg = resolvedSessionConfig || {};
    const preferredResources = ['docUploads', 'docUrls', 'arweave', 'default'];
    for (const resourceKey of preferredResources) {
      const gateState = resolveSponsoredGateStateForResource(cfg, resourceKey);
      if (gateState?.status === SPONSORED_GATE_STATES.OPEN) return null;
      if (gateState?.gate) return gateState.gate;
    }
    return resolveEncryptionGate(cfg);
  }, [resolvedSessionConfig]);
  const summaryGateAddresses = useMemo(() => getGateSbtAddresses(summaryGate), [summaryGate]);
  const summaryGateModeDefault = useMemo(() => normalizeGateMode(summaryGate), [summaryGate]);
  const summaryGateKey = summaryGateAddresses.map((addr) => addr.toLowerCase()).sort().join('|');
  const activeSessionKey = useMemo(() => {
    const hasExplicit = typeof effectiveSessionSlugInput === 'string';
    if (!hasExplicit) return null;
    return normalizeSessionSlug(effectiveSessionSlugInput ?? '');
  }, [effectiveSessionSlugInput]);
  const sessionSelectorOptions = useMemo(() => {
    const selectedSlug = normalizeSessionSlug(resolvedSessionSlug || activeSessionSlug || '');
    const options = new Map();
    const pushOption = (slugIn = '') => {
      const slug = normalizeSessionSlug(slugIn || '');
      const cfg = getSessionConfigBySlug(slug) || {};
      const sessionName = toStr(cfg?.sessionName || '').trim();
      const slugLabel = slug || 'General';
      const label = sessionName && sessionName.toLowerCase() !== slugLabel.toLowerCase()
        ? `${sessionName} (${slugLabel})`
        : (sessionName || slugLabel);
      options.set(slug, {
        key: `database-session-${slug || 'general'}`,
        slug,
        label,
        selected: selectedSlug === slug,
        general: slug === '',
        primary: normalizeSessionSlug(activeSessionSlug || '') === slug,
        chipTestId: `ce-database-session-chip-${slug || 'general'}`,
      });
    };
    pushOption(selectedSlug);
    pushOption(activeSessionSlug);
    pushOption('');
    (getAllSessionSlugs({ includeEmpty: true }) || []).forEach(pushOption);
    return Array.from(options.values());
  }, [activeSessionSlug, resolvedSessionSlug]);
  const configSessionKey = useMemo(() => {
    if (typeof resolvedSessionConfig?.slug === 'string') return normalizeSessionSlug(resolvedSessionConfig.slug);
    return null;
  }, [resolvedSessionConfig?.slug]);
  const summaryGateSessionKey = activeSessionKey != null
    ? activeSessionKey
    : (configSessionKey != null ? configSessionKey : '');
  const summaryGateMismatch = activeSessionKey != null && configSessionKey != null && activeSessionKey !== configSessionKey;
  const summaryGateSessionKeyRef = useRef(summaryGateSessionKey);
  const docSaveContextKeyRef = useRef('');
  const docSaveAutoAudienceRef = useRef(docSaveGate.hasRecipients ? 'session' : 'self');

  useEffect(() => {
    if (summaryGateSessionKeyRef.current === summaryGateSessionKey) return;
    summaryGateSessionKeyRef.current = summaryGateSessionKey;
    lastSummaryGateKeyRef.current = '';
    setSummaryGateSBTs([]);
    setSummaryGateMode('any');
  }, [summaryGateSessionKey]);

  useEffect(() => {
    if (summaryGateMismatch) return;
    if (!summaryGateAddresses.length) return;
    if (summaryGateSBTs.length > 0) return;
    if (lastSummaryGateKeyRef.current === summaryGateKey) return;
    lastSummaryGateKeyRef.current = summaryGateKey;
    setSummaryGateSBTs(summaryGateAddresses.map((addr) => ({ address: addr, name: addr })));
    if (summaryGateModeDefault) setSummaryGateMode(summaryGateModeDefault);
  }, [summaryGateAddresses, summaryGateKey, summaryGateModeDefault, summaryGateSBTs.length, summaryGateMismatch]);

  useEffect(() => {
    const nextContextKey = `${toStr(resolvedSessionSlug).trim().toLowerCase()}:${resolvedSessionIdHex}`;
    const nextDefaultAudience = docSaveGate.hasRecipients ? 'session' : 'self';
    if (docSaveContextKeyRef.current !== nextContextKey) {
      docSaveContextKeyRef.current = nextContextKey;
      docSaveAutoAudienceRef.current = nextDefaultAudience;
      setSaveDocAudience(nextDefaultAudience);
      setShowSaveDocAudienceMenu(false);
      return;
    }
    if (saveDocAudience !== docSaveAutoAudienceRef.current) return;
    if (docSaveAutoAudienceRef.current === nextDefaultAudience) return;
    docSaveAutoAudienceRef.current = nextDefaultAudience;
    setSaveDocAudience(nextDefaultAudience);
    setShowSaveDocAudienceMenu(false);
  }, [resolvedSessionSlug, resolvedSessionIdHex, docSaveGate.hasRecipients, saveDocAudience]);

  useEffect(() => {
    if (additionalSources.length > 0) return;
    setSaveExtraSourcesToDocLibrary(false);
    setShowSaveDocAudienceMenu(false);
  }, [additionalSources.length]);

  const abortedRef = React.useRef(false);
  useEffect(() => {
    abortedRef.current = false; return () => { abortedRef.current = true; };
  }, []);

  useEffect(() => {
    if (loading && !waitTimerRef.current) {
      setWaitingSeconds(0);
      waitTimerRef.current = setInterval(() => setWaitingSeconds((s) => s + 1), 1000);
    } else if (!loading && waitTimerRef.current) {
      clearInterval(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    return () => {
      if (waitTimerRef.current) {
        clearInterval(waitTimerRef.current);
        waitTimerRef.current = null;
      }
    };
  }, [loading]);

  // Handle Transcript Mode Toggle
  const handleTranscriptModeToggle = () => {
    setTranscriptMode(prev => {
      const newVal = !prev;
      if (!newVal) {
        setAudioFile(null);
        setSummaryMd('');
        setSummaryCollapsed(true);
      }
      return newVal;
    });
  };

  function buildSinglePrompt(sourceDocContent, overrides = {}) {
    const allowed = normalizeTags(defaultTags);
    const defaultTagsStr = allowed.length > 0 ? allowed.join(', ') : '';

    const selectedTypes = Object.keys(questionTypes).filter(t => questionTypes[t]);
    const typesStr =
      selectedTypes.length > 0 ? selectedTypes.join(',') : 'binary,rating,freeform,multichoice';

    const sourceType =
      overrides.sourceTypeOverride ||
      (transcriptMode ? 'transcript' : 'text');

    const multiSpeakerHint = overrides.multiSpeakerHintOverride || 'unknown';

    const sessionInstructions = (resolvedSessionConfig && resolvedSessionConfig.questionsGenPrompt)
      ? resolvedSessionConfig.questionsGenPrompt
      : '';

    const finalPrompt = seedGenPrompt
      .replace('<SourceDocContent>', sourceDocContent)
      .replace('<NumSeedStatements>', String(count))
      .replace('<Types>', typesStr)
      .replace(/<DefaultTags>/g, defaultTagsStr)
      .replace('<SourceType>', sourceType)
      .replace('<MultiSpeakerHint>', multiSpeakerHint)
      .replace('<GroupCustomInstructions>', sessionInstructions)
      .replace('<ClipDurationMinutes>', '');

    return finalPrompt;
  }

  async function makeSingleAiCall(sourceDocContent, overrides = {}, requestedCount = count) {
    const prompt = buildSinglePrompt(sourceDocContent, overrides);
    const raw    = await callAI(prompt, aiRequestOptions);
    const match  = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in AI response');
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.questions))
      throw new Error('AI response missing "questions" array');
    const expectedCount = Number(requestedCount);
    if (
      Number.isInteger(expectedCount) &&
      expectedCount > 0 &&
      parsed.questions.length !== expectedCount
    ) {
      cacheLog.warn('[AudioSurveyGenerator] AI returned question count mismatch', {
        requestedCount: expectedCount,
        returnedCount: parsed.questions.length,
      });
    }
    return parsed;
  }

  async function handleUploadSummaryAndCreateQuestions() {
    try {
      if (!loginComplete) {
        toggleLoginModal(true);
        return;
      }
      if (!summaryMd) {
        throw new Error('No summary available. Please generate it first.');
      }

      setError('');
      setSurveyTitle('');
      setShowCreateSurvey(false);
      setStatementsToUpload([]);
      setLoading(true);
      setWaitingSeconds(0);

      let txId = '';
      let url = '';

      if (uploadSummaryToArweave) {
        const arweaveKey = await getEffectiveArweaveKey({
          sessionSlug: resolvedSessionSlug || '',
          sessionConfig: resolvedSessionConfig,
          context: { account, providerLike: provider, chainId: network?.id },
        });
        if (encryptSummary) {
          const litHooks = getGlobalLitHooks();
          if (!litHooks || typeof litHooks.saveKey !== 'function') {
            throw new Error('Lit hooks not initialized; connect a wallet to encrypt the summary.');
          }
          const gateChainId = summaryGate?.chainId || network?.id;
          const litChain = resolveLitChain({
            chainId: gateChainId,
            litChain: summaryGate?.litChain || summaryGate?.chain,
          });
          const selectedAddresses = (summaryGateSBTs || []).map((sbt) => sbt.address).filter(Boolean);
          const sbtAddresses = selectedAddresses.length ? selectedAddresses : summaryGateAddresses;
          const gateMode = summaryGateMode || summaryGateModeDefault || 'any';
          const accessControlConditions = buildSbtAccessControlConditions({
            sbtAddresses,
            chainId: gateChainId,
            litChain,
            mode: gateMode,
          });
          if (!accessControlConditions) {
            throw new Error('Select at least one SBT to encrypt the summary.');
          }

          const result = await litStorage.uploadEncryptedArweaveData({
            data: summaryMd,
            format: 'md',
            mime: 'text/markdown',
            name: 'summary.md',
            arweaveJwk: arweaveKey?.arweaveJwk || '',
            providerLike: provider,
            account,
            chainId: gateChainId || null,
            contextLabel: `summary:${resolvedSessionSlug || ''}`,
            lit: {
              saveKey: litHooks.saveKey,
              accessControlConditions,
              chain: litChain,
            },
          });
          if (abortedRef.current) return;
          txId = result.txId;
          url = result.url;
        } else {
          const result = await uploadMarkdownSummaryToArweave(summaryMd, {
            sessionSlug: resolvedSessionSlug || '',
            sessionConfig: resolvedSessionConfig,
            arweaveJwk: arweaveKey?.arweaveJwk || '',
            context: { account, providerLike: provider, chainId: network?.id },
          });
          if (abortedRef.current) return;
          txId = result.txId;
          url = result.url;
        }
      }

      setSummaryArweaveTxId(txId || '');
      setSummaryDocURL(url || '');
      setDocumentURLs(url ? [url] : []);

      const aiData = await makeSingleAiCall(summaryMd, {
        sourceTypeOverride: 'document',
        multiSpeakerHintOverride: 'likely_multiple_speakers'
      }, count);
      if (abortedRef.current) return;

      processAndSetQuestions(aiData, url ? [url] : []);
      setShowCreateSurvey(true);
    } catch (err) {
      if (!abortedRef.current) {
        setError(err.message || 'Failed to upload summary or generate questions.');
      }
    } finally {
      if (!abortedRef.current) {
        setLoading(false);
        setWaitingSeconds(0);
      }
    }
  }

  function processAndSetQuestions(aiData, docs) {
    const wantedTypes = Object.keys(questionTypes).filter(t => questionTypes[t]);
    const qs = aiData.questions
      .filter(q => wantedTypes.includes(q.questionType))
      .slice(0, count);

    qs.forEach(q => { q.tags = q.tags || []; });

    const formatted = qs.map(q => ({
      id: generateQuestionId(q.questionType, q.prompt, q.options || []),
      type: q.questionType,
      prompt: q.prompt,
      options: q.questionType === 'multichoice' ? q.options : undefined,
      tags: q.tags
    }));

    setStatementsToUpload(formatted);
    setSurveyTitle(aiData.surveyTitle || '');
    setDocumentURLs(docs);

    if (typeof onQuestionsGenerated === 'function') {
      onQuestionsGenerated(formatted, docs, aiData.surveyTitle || '');
    }
  }

  const addAdditionalUrl = () => {
    if (!additionalUrlInput.trim()) return;
    setAdditionalSources(prev => [
      ...prev,
      {
        id: buildAdditionalSourceId(additionalSourceIdRef),
        type: 'url',
        value: additionalUrlInput.trim(),
        name: additionalUrlInput.trim(),
      }
    ]);
    setAdditionalUrlInput('');
  };

  const handleUrlKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAdditionalUrl();
    }
  };

  const adjustQuestionCount = (delta) => {
    setCount((previousCount) => clampQuestionCount(previousCount + delta));
  };

  const handleAdditionalFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setAdditionalSources(prev => [
      ...prev,
      {
        id: buildAdditionalSourceId(additionalSourceIdRef),
        type: 'file',
        value: file,
        name: file.name,
      }
    ]);
    e.target.value = '';
  };

  const handleAdditionalPhotoUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selectedFiles = Array.from(files);
    const validFiles = selectedFiles.filter(isSupportedPhotoFile);
    const invalidCount = selectedFiles.length - validFiles.length;

    if (validFiles.length > 0) {
      setAdditionalSources((prev) => [
        ...prev,
        ...validFiles.map((file) => buildQueuedPhotoSource(file, additionalSourceIdRef)),
      ]);
    }

    if (invalidCount > 0) {
      setError(buildUnsupportedPhotoMessage(invalidCount));
    } else {
      setError('');
    }

    e.target.value = '';
  };

  const removeAdditionalSource = (sourceId) => {
    setAdditionalSources((prev) => prev.filter((source) => source?.id !== sourceId));
  };

  const updateAdditionalSourceById = (sourceId, patch) => {
    setAdditionalSources((prev) => (
      (Array.isArray(prev) ? prev : []).map((source) => (
        source?.id === sourceId
          ? {
              ...source,
              ...(typeof patch === 'function' ? patch(source) : patch),
            }
          : source
      ))
    ));
  };

  const analyzeQueuedPhotoSources = async (sources = []) => {
    const queuedSources = Array.isArray(sources) ? sources : [];
    const analysisBySourceId = new Map();
    for (const source of queuedSources) {
      if (source?.type !== 'photo') continue;
      const cachedAnalysis = toStr(source?.analysisText).trim();
      if (cachedAnalysis) {
        analysisBySourceId.set(source.id, cachedAnalysis);
        updateAdditionalSourceById(source.id, {
          analysisStatus: 'ready',
          analysisError: '',
          analysisText: cachedAnalysis,
        });
        continue;
      }

      updateAdditionalSourceById(source.id, {
        analysisStatus: 'loading',
        analysisError: '',
        analysisExpanded: false,
      });
      try {
        const result = await analyzePhotoForQuestionGeneration(source.value, aiRequestOptions);
        if (abortedRef.current) return analysisBySourceId;
        const analysisText = toStr(result?.text || result).trim();
        if (!analysisText) {
          throw new Error('Photo analysis returned no usable text.');
        }
        analysisBySourceId.set(source.id, analysisText);
        updateAdditionalSourceById(source.id, {
          analysisStatus: 'ready',
          analysisError: '',
          analysisText,
        });
      } catch (err) {
        const message = err?.message || 'Photo analysis failed.';
        updateAdditionalSourceById(source.id, {
          analysisStatus: 'error',
          analysisError: message,
          analysisExpanded: false,
        });
        throw new Error(`Photo analysis failed for ${source?.name || 'photo'}: ${message}`);
      }
    }
    return analysisBySourceId;
  };

  const togglePhotoAnalysisExpanded = (sourceId) => {
    updateAdditionalSourceById(sourceId, (source) => ({
      analysisExpanded: !source?.analysisExpanded,
    }));
  };

  const resolveDocSaveEncryption = () => {
    const litHooks = getGlobalLitHooks();
    if (!litHooks || typeof litHooks.saveKey !== 'function') {
      throw new Error('Connect a wallet to save sources to the session doc library.');
    }

    const fallbackChainId = Number(network?.id || 0) || null;
    if (saveDocAudience === 'session') {
      if (!docSaveGate.hasRecipients) {
        throw new Error('Session docUploads gate is unavailable or empty.');
      }
      const chainId = Number(docSaveGate.chainId || fallbackChainId || 0) || null;
      const litChain = resolveLitChain({ chainId });
      const accessControlConditions = buildSbtAccessControlConditions({
        sbtAddresses: docSaveGate.sbtAddresses,
        chainId,
        litChain,
        mode: docSaveGate.mode || 'any',
      });
      if (!accessControlConditions) {
        throw new Error('Session docUploads gate has no valid SBT addresses.');
      }
      return {
        enabled: true,
        saveKey: litHooks.saveKey,
        accessControlConditions,
        litChain,
        chainId,
        contextLabel: `doc:${resolvedSessionSlug || ''}`,
      };
    }

    if (!toStr(account).trim()) {
      throw new Error('Connect a wallet to save private doc sources.');
    }

    const chainId = fallbackChainId;
    const litChain = resolveLitChain({ chainId });
    const accessControlConditions = buildWalletAddressAccessControlConditions({
      walletAddress: account,
      chainId,
      litChain,
    });
    if (!accessControlConditions) {
      throw new Error('Connected wallet address is unavailable for private doc save.');
    }
    return {
      enabled: true,
      saveKey: litHooks.saveKey,
      accessControlConditions,
      litChain,
      chainId,
      contextLabel: `doc-self:${resolvedSessionSlug || ''}`,
    };
  };

  const saveQueuedSourcesToDocLibrary = async (sources = [], photoAnalysisBySourceId = new Map()) => {
    const queuedSources = Array.isArray(sources) ? sources : [];
    if (!saveExtraSourcesToDocLibrary || queuedSources.length === 0) return [];
    if (!loginComplete) {
      if (typeof toggleLoginModal === 'function') toggleLoginModal(true);
      throw new Error('Connect a wallet to save sources to the session doc library.');
    }
    if (!resolvedSessionIdHex) {
      throw new Error('Session ID is unavailable; cannot save session docs.');
    }

    const encryption = resolveDocSaveEncryption();
    const savedViewerUrls = [];

    for (const source of queuedSources) {
      const isUrlSource = source?.type === 'url';
      const isPhotoSource = source?.type === 'photo';
      const kind = isUrlSource ? 'link' : 'file';
      const baseTags = mergeTags(
        buildDocLibraryCommonTags({ kind, storage: 'lit-arweave' }),
        buildDocLibrarySessionTags({ sessionIdHex: resolvedSessionIdHex }),
        isPhotoSource
          ? buildDocLibraryRoleTags({ role: DOC_LIBRARY_DOC_ROLES.PHOTO })
          : [],
      );

      let result = null;
      const viewerUrls = [];
      if (isUrlSource) {
        result = await uploadDocLibraryUrlRecord({
          url: source?.value,
          title: source?.name,
          sessionSlug: resolvedSessionSlug || '',
          sessionConfig: resolvedSessionConfig,
          account,
          providerLike: provider,
          chainId: network?.id || null,
          tags: baseTags,
          encryption: {
            ...encryption,
            contextLabel: `doc-link:${resolvedSessionSlug || ''}`,
          },
        });
      } else {
        result = await uploadDocLibraryFile({
          file: source?.value,
          sessionSlug: resolvedSessionSlug || '',
          sessionConfig: resolvedSessionConfig,
          account,
          providerLike: provider,
          chainId: network?.id || null,
          tags: baseTags,
          encryption,
        });
      }

      const viewerUrl = buildSessionDocLibraryViewerUrl({
        sessionToken: docSaveSessionToken,
        txId: result?.txId,
        storage: result?.storage || 'lit-arweave',
        kind: result?.kind || kind,
        name: source?.name || '',
      });
      viewerUrls.push(viewerUrl || result?.url || '');

      if (isPhotoSource) {
        const analysisText = toStr(photoAnalysisBySourceId?.get(source?.id) || source?.analysisText).trim();
        if (analysisText) {
          const analysisFile = new File(
            [buildPhotoAnalysisMarkdown({ photoName: source?.name, analysisText })],
            buildPhotoAnalysisFilename(source?.name),
            { type: 'text/markdown' },
          );
          const analysisTags = mergeTags(
            buildDocLibraryCommonTags({ kind: 'file', storage: 'lit-arweave' }),
            buildDocLibrarySessionTags({ sessionIdHex: resolvedSessionIdHex }),
            buildDocLibraryRoleTags({
              role: DOC_LIBRARY_DOC_ROLES.PHOTO_ANALYSIS,
              derivedFromTxId: result?.txId,
            }),
          );
          const analysisResult = await uploadDocLibraryFile({
            file: analysisFile,
            sessionSlug: resolvedSessionSlug || '',
            sessionConfig: resolvedSessionConfig,
            account,
            providerLike: provider,
            chainId: network?.id || null,
            tags: analysisTags,
            encryption,
          });
          const analysisViewerUrl = buildSessionDocLibraryViewerUrl({
            sessionToken: docSaveSessionToken,
            txId: analysisResult?.txId,
            storage: analysisResult?.storage || 'lit-arweave',
            kind: analysisResult?.kind || 'file',
            name: analysisFile.name,
          });
          viewerUrls.push(analysisViewerUrl || analysisResult?.url || '');
        }
      }
      savedViewerUrls.push({ sourceId: source?.id || '', viewerUrls });
    }

    return savedViewerUrls;
  };

  async function handleSubmit(e) {
    e.preventDefault();
    localStorage.removeItem('unfinishedSurvey');

    setError('');
    setSurveyTitle('');
    setShowCreateSurvey(false);
    setStatementsToUpload([]);
    setDocumentURLs([]);
    setSummaryMd('');

    let currentDocumentURLs = [];
    let content = '';
    const queuedAdditionalSources = [...additionalSources];
    let effectiveSources = [...queuedAdditionalSources];
    // Auto-add pending URL from the URL input bar
    if (additionalUrlInput && additionalUrlInput.trim()) {
      const pendingUrl = additionalUrlInput.trim();
      effectiveSources.push({
        id: buildAdditionalSourceId(additionalSourceIdRef),
        type: 'url',
        value: pendingUrl,
        name: pendingUrl,
      });
      setAdditionalUrlInput('');
    }
    let sourceTypeOverride = '';

    try {
      setLoading(true);
      setWaitingSeconds(0);

      // 1. Extract content (Text or Audio Transcript)
      if (transcriptMode && audioFile) {
          const name = (audioFile.name || '').toLowerCase();
          const okExt = /\.(m4a|mp3|aac|wav|webm|mp4|3gp|ogg|opus)$/i.test(name) || /^audio\//.test(audioFile.type);
          if (!okExt) throw new Error('Unsupported audio type.');

          setIsTranscribing(true);
          const transcript = await transcribeAudio(audioFile, aiRequestOptions);
          if (abortedRef.current) return;
          setIsTranscribing(false);

          content = (transcript || '').trim();
          if (content.length < 50) throw new Error('Transcription too short.');
      }
      else if (pastedText && pastedText.trim().length > 0) {
        content = pastedText.trim();
        if (isSingleHttpUrlInput(content)) {
          currentDocumentURLs.push(content);
          sourceTypeOverride = 'webpage';
          const fetched = await fetchContentFromURL(content, aiRequestOptions);
          const fetchedText = (fetched || '').trim();
          if (fetchedText.length < 50) {
            throw new Error('Could not extract content from URL. Try pasting the article text directly.');
          }
          content = fetchedText;
        }
      }

      const photoAnalysisBySourceId = await analyzeQueuedPhotoSources(effectiveSources);
      const savedDocRefs = await saveQueuedSourcesToDocLibrary(queuedAdditionalSources, photoAnalysisBySourceId);

      // 2. Process Additional Sources
      if (effectiveSources.length > 0) {
        const photoSources = effectiveSources.filter((src) => src?.type === 'photo');
        const nonPhotoSources = effectiveSources.filter((src) => src?.type !== 'photo');
        const additionalContentSections = [];

        if (photoSources.length > 0) {
          photoSources.forEach((src) => {
            const analysisText = toStr(photoAnalysisBySourceId.get(src?.id)).trim();
            if (!analysisText) return;
            additionalContentSections.push(`--- Photo Source: ${src.name} ---\n\n${analysisText}`);
          });
        }

        if (nonPhotoSources.length > 0) {
          const additionalContent = await processAdditionalSources(nonPhotoSources, aiRequestOptions);
          if (additionalContent) additionalContentSections.push(additionalContent.trim());
        }

        const mergedAdditionalContent = additionalContentSections.filter(Boolean).join('\n\n');
        if (mergedAdditionalContent) {
          if (content) {
            content = `${content}\n\n--- Additional Context ---\n\n${mergedAdditionalContent}`;
          } else {
            content = mergedAdditionalContent;
          }
        }
        effectiveSources.forEach((src, idx) => {
          const queuedSource = idx < queuedAdditionalSources.length ? queuedAdditionalSources[idx] : null;
          const savedRef = idx < savedDocRefs.length ? savedDocRefs[idx] : null;
          if (savedRef?.viewerUrls?.length && queuedSource === src) {
            currentDocumentURLs.push(...savedRef.viewerUrls.filter(Boolean));
            return;
          }
          if (src.type === 'url') currentDocumentURLs.push(src.value);
        });
        const hasPrimaryTextInput = Boolean(pastedText && pastedText.trim().length > 0);
        const additionalSourcesAreAllUrls = effectiveSources.every((src) => src.type === 'url');
        if (!transcriptMode && !hasPrimaryTextInput && additionalSourcesAreAllUrls) {
          sourceTypeOverride = 'webpage';
        }
        if (!transcriptMode && !hasPrimaryTextInput && photoSources.length > 0 && nonPhotoSources.length === 0) {
          sourceTypeOverride = 'document';
        }
      }

      if (!content || content.length < 50) {
         throw new Error('Total extracted content is too short (min 50 chars). Please enter text, audio, or add valid URLs/Files.');
      }

      let sourceForQuestions = content;
      // We'll build the final doc list starting with user-provided URLs
      let finalDocUrls = [...currentDocumentURLs];

      // 3. Transcript Mode: Generate Summary -> Optional Upload -> Prepare for Questions
      if (transcriptMode) {
        // A. Generate Summary
        const md = await generateAudioDiscussionSummary(content, {
          style: 'reading-group',
          ...aiRequestOptions,
        });
        if (abortedRef.current) return;
        setSummaryMd((md || '').trim());

        sourceForQuestions = md;

        // B. Upload to Arweave (if toggled)
        if (uploadSummaryToArweave) {
          try {
             // We do NOT block on loginComplete here; the worker handles the upload wallet.
             const arweaveKey = await getEffectiveArweaveKey({
               sessionSlug: resolvedSessionSlug || '',
               sessionConfig: resolvedSessionConfig,
               context: { account, providerLike: provider, chainId: network?.id },
             });
             const { txId, url } = await uploadMarkdownSummaryToArweave(md, {
               sessionSlug: resolvedSessionSlug || '',
               sessionConfig: resolvedSessionConfig,
               arweaveJwk: arweaveKey?.arweaveJwk || '',
               context: { account, providerLike: provider, chainId: network?.id },
             });
             if (abortedRef.current) return;

             setSummaryArweaveTxId(txId || '');
             setSummaryDocURL(url || '');

             if (url) {
               finalDocUrls.unshift(url);
             }
          } catch (uploadErr) {
             cacheLog.error("Summary upload failed:", uploadErr);
             // We don't abort the whole process; just warn and proceed with questions
             setError("Warning: Summary upload failed, but generating questions...");
          }
        }
      }

      // 4. Generate Questions
      const aiData = await makeSingleAiCall(sourceForQuestions, {
        sourceTypeOverride: transcriptMode ? 'document' : (sourceTypeOverride || undefined),
        multiSpeakerHintOverride: transcriptMode ? 'likely_multiple_speakers' : undefined
      }, count);
      if (abortedRef.current) return;

      // 5. Spawn Survey Tool
      // This updates state.documentURLs, which CreateQuestionsAndSurveys picks up
      processAndSetQuestions(aiData, finalDocUrls);
      setShowCreateSurvey(true);

    } catch (err) {
      if (!abortedRef.current) {
        setError(err.message || 'Generation failed.');
      }
    } finally {
      if (!abortedRef.current) {
        setLoading(false);
        setIsTranscribing(false);
        setWaitingSeconds(0);
      }
    }
  }

  function generateQuestionId(type, prompt, options = []) {
    return generateSharedQuestionId(type, prompt, options);
  }

  function renderCreateSurveyComponent() {
    if (!showCreateSurvey || statementsToUpload.length === 0) return null;
    const preformedSurvey = surveyTitle ? { title: surveyTitle } : null;

    return (
      <div className={styles.createSurveyContainer}>
        <CreateQuestionsAndSurveys
          miniaturized={minified}
          preformedQuestions={statementsToUpload}
          preformedSurvey={preformedSurvey}
          prefilledAnswers={prefilledAnswers}
          account={account}
          loginComplete={loginComplete}
          sessionConfig={resolvedSessionConfig}
          contracts={resolvedSessionConfig?.contracts || {}}
          activeSessionSlug={resolvedSessionSlug}
          provider={provider}
          network={network}
          toggleLoginModal={toggleLoginModal}
          defaultTags={defaultTags}
          documentURLs={documentURLs}
          onUploadComplete={(surveyHash) => {
            setShowCreateSurvey(false);
            setStatementsToUpload([]);
            setSurveyTitle('');
            setDocumentURLs([]);
            setPastedText('');
            setAudioFile(null);
            if (surveyHash) {
                alert(`Upload complete! Survey ID: ${surveyHash}`);
            } else {
                alert(`Upload complete! Questions added.`);
            }
          }}
        />
      </div>
    );
  }

  const toggleQuestionType = (type) => {
    setQuestionTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const refreshAIPromptModelLabel = React.useCallback(async () => {
    try {
      const aiCfg = await getEffectiveAiConfig({
        sessionSlug: aiRequestOptions.sessionSlug,
        context: aiRequestOptions.context,
        resolveSecrets: false,
      });
      if (abortedRef.current) return;
      setAiPromptModelLabel(formatAiPromptModelLabel(aiCfg));
    } catch {
      if (abortedRef.current) return;
      setAiPromptModelLabel('Configured model');
    }
  }, [aiRequestOptions]);

  useEffect(() => {
    if (!showAIPrompt) return;
    refreshAIPromptModelLabel();
  }, [showAIPrompt, refreshAIPromptModelLabel]);

  const toggleAIPrompt = () => {
    setShowAIPrompt(prev => {
      const nextOpen = !prev;
      if (nextOpen && !aiPromptLoaded) {
        setAiPromptText(seedGenPrompt);
        setAiPromptLoaded(true);
      }
      return nextOpen;
    });
  };

  const copyAIPromptToClipboard = () => {
    const text = aiPromptText || '';
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => {
        notify.success('Copied to clipboard');
        setAiPromptCopySuccess(true);
        setTimeout(() => setAiPromptCopySuccess(false), 1500);
      })
      .catch((e) => { void e; notify.warn('Copy failed'); });
  };

  const highlightPromptVariables = (str) => {
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

  const handleDatabaseSessionSelect = (slugIn) => {
    setLocalSessionOverrideTouched(true);
    setLocalSessionOverrideSlug(normalizeSessionSlug(slugIn || ''));
  };

  const resetDatabaseSessionSelection = () => {
    setLocalSessionOverrideTouched(false);
    setLocalSessionOverrideSlug(null);
  };

  const shouldShowGenerateButton = loading || hasDatabaseToolInputContent({
    pastedText,
    additionalUrlInput,
    additionalSources,
    audioFile,
  });
  const queuedPhotoSources = useMemo(
    () => additionalSources.filter((source) => source?.type === 'photo'),
    [additionalSources],
  );
  const queuedNonPhotoSources = useMemo(
    () => additionalSources.filter((source) => source?.type !== 'photo'),
    [additionalSources],
  );
  const shouldShowSaveExtraSourcesControl = additionalSources.length > 0;
  const saveDocAudienceLabel = saveDocAudience === 'session' && docSaveGate.hasRecipients
    ? docSaveSessionLabel
    : 'only me';
  const isExplorerViewMode = !minified && explorerMode === 'view';
  const showDemoCorpusPanel = demoSurfaceEnabled && showDemoCorpusView;
  const showViewModeToolbar = demoSurfaceEnabled;
  const showInternalSessionSelector = !minified && !hideInternalSessionSelector && !hasControlledSessionOverride;

  useEffect(() => {
    if (isExplorerViewMode) setShowDemoCorpusView(demoSurfaceEnabled);
  }, [isExplorerViewMode, demoSurfaceEnabled]);

  const renderExplorerViewMode = () => (
    <div className={styles.viewModeShell} data-testid={E2E_TESTIDS.DATABASE_VIEW_PANEL}>
      {showViewModeToolbar ? (
        <div className={styles.viewModeToolbar}>
          {demoSurfaceEnabled ? (
            <label className={styles.viewModeCheckbox} htmlFor={E2E_TESTIDS.DATABASE_VIEW_DEMO_TOGGLE}>
              <input
                id={E2E_TESTIDS.DATABASE_VIEW_DEMO_TOGGLE}
                type="checkbox"
                checked={showDemoCorpusView}
                onChange={(event) => setShowDemoCorpusView(event.target.checked)}
                data-testid={E2E_TESTIDS.DATABASE_VIEW_DEMO_TOGGLE}
              />
              <span>Demo corpus</span>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className={styles.viewModeContent}>
        {showDemoCorpusPanel ? (
          <Suspense fallback={<div className={styles.viewModeEmptyState}>Loading demo corpus...</div>}>
            <LazyCorpusViewer />
          </Suspense>
        ) : resolvedSessionIdHex ? (
          <DocumentLibraryPanel
            provider={provider}
            network={network}
            account={account}
            loginComplete={loginComplete}
            toggleLoginModal={toggleLoginModal}
            sessionSlug={resolvedSessionSlug}
            sessionConfig={resolvedSessionConfig}
            mode="session"
            sessionIdHex={resolvedSessionIdHex}
            compact={false}
            pageSize={10}
          />
        ) : (
          <div className={styles.viewModeEmptyState}>
            {demoSurfaceEnabled
              ? 'Select a session with docs to view the session library here, or leave Demo corpus enabled.'
              : 'Select a session with docs to view the session library here.'}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={
        minified
          ? `${styles.databaseTool} ${styles.minified}`
          : styles.databaseTool
      }
    >
      {showInternalSessionSelector && (
        <div className={styles.sessionSelectorTriggerRow} data-testid="ce-database-session-selector">
          <button
            type="button"
            className={styles.sessionSelectorToggle}
            aria-label="AudioSurveyGenerator session selector"
            data-testid="ce-database-session-selector-toggle"
            onClick={() => setShowSessionSelector((value) => !value)}
          >
            <FontAwesomeIcon icon={faCog} />
          </button>
          {showSessionSelector && (
            <div className={styles.sessionSelectorPopover} data-testid="ce-database-session-selector-panel">
              <div className={styles.sessionSelectorPopoverHeader}>
                <div className={styles.sessionSelectorHint}>
                  {localSessionOverrideTouched
                    ? 'Using a local AudioSurveyGenerator override.'
                    : 'Using the global primary session by default.'}
                </div>
                {localSessionOverrideTouched ? (
                  <Button size="sm" color="secondary" outline onClick={resetDatabaseSessionSelection}>
                    Use global default
                  </Button>
                ) : null}
              </div>
              <SessionChipSelector
                options={sessionSelectorOptions}
                onToggle={handleDatabaseSessionSelect}
              />
            </div>
          )}
        </div>
      )}
      {isExplorerViewMode ? renderExplorerViewMode() : (
        <>
      <form onSubmit={handleSubmit}>
        <div className={styles.formSection}>
          <div className={styles.textInputGroup}>
            <AudioInput
              placeholder={transcriptMode ? "Speak to capture transcript or Paste Text..." : "Speak or type text here..."}
              recordingDisabled={transcriptMode}
              longFormMode={transcriptMode}
              showRecorderControlsInTextbox={transcriptMode}
              showRecordingTimerInTextbox={transcriptMode}
              enableDownloads={transcriptMode}
              updateFunction={(val) => setPastedText(val)}
              toggleEncryption={(bool) => setTextEncrypted(bool)}
              value={pastedText}
              encrypted={textEncrypted}
              hideEncryption={hideEncryption}
              style={{
                resize: 'both',
                minHeight: '100px',
                overflow: 'auto'
              }}
            />
          </div>

          <div className={styles.addSourceControls}>
            <div className={styles.urlInputContainer}>
              <Input
                type="url"
                placeholder="Add URL"
                value={additionalUrlInput}
                onChange={(e) => setAdditionalUrlInput(e.target.value)}
                onKeyDown={handleUrlKeyDown}
                className={styles.urlInputField}
              />
              <button
                type="button"
                className={styles.internalUrlAddBtn}
                onClick={addAdditionalUrl}
                disabled={!additionalUrlInput.trim()}
                title="Add URL"
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>

            <div className={styles.fileUploadWrapper}>
              <input
                type="file"
                ref={additionalFileInputRef}
                style={{ display: 'none' }}
                accept=".pdf, .md, .txt, .csv, .ppt, .pptx, .json"
                onChange={handleAdditionalFileUpload}
              />
              <Button
                type="button"
                color="secondary"
                outline
                className={styles.compactBtn}
                onClick={() => additionalFileInputRef.current && additionalFileInputRef.current.click()}
                title="Allowed: .pdf, .md, .txt, .csv, .ppt"
              >
                <FontAwesomeIcon icon={faUpload} style={{ opacity: '0.5' }} />
              </Button>
            </div>

            <div className={styles.fileUploadWrapper}>
              <input
                type="file"
                ref={additionalPhotoInputRef}
                style={{ display: 'none' }}
                accept={SUPPORTED_PHOTO_ACCEPT}
                multiple
                onChange={handleAdditionalPhotoUpload}
              />
              <Button
                type="button"
                color="secondary"
                outline
                className={styles.compactBtn}
                onClick={() => additionalPhotoInputRef.current && additionalPhotoInputRef.current.click()}
                title="Allowed: .png, .jpg, .jpeg, .webp, .gif"
              >
                <FontAwesomeIcon icon={faImage} style={{ opacity: '0.65' }} />
              </Button>
            </div>

            <div
              className={`${styles.transcriptToggleBtn} ${transcriptMode ? styles.active : ''}`}
              onClick={handleTranscriptModeToggle}
              title="Enable Transcript Mode (Summary + Arweave Upload)"
              data-testid="transcript-mode-toggle"
            >
              <FontAwesomeIcon
                icon={transcriptMode ? faCheckSquare : faSquare}
                className={styles.checkboxIcon}
              />
              <span>Transcript</span>
            </div>

            {transcriptMode && (
              <div
                className={`${styles.transcriptToggleBtn} ${uploadSummaryToArweave ? styles.active : ''}`}
                onClick={() => setUploadSummaryToArweave(!uploadSummaryToArweave)}
                title="If checked, the summary is uploaded to Arweave and attached as a permanent document. If unchecked, the summary is passed directly to AI for question generation without permanent storage."
              >
                <FontAwesomeIcon
                  icon={uploadSummaryToArweave ? faCheckSquare : faSquare}
                  className={styles.checkboxIcon}
                />
                <span>Upload Summary</span>
              </div>
            )}

            {transcriptMode && uploadSummaryToArweave && (
              <div
                className={`${styles.transcriptToggleBtn} ${encryptSummary ? styles.active : ''}`}
                onClick={() => setEncryptSummary(!encryptSummary)}
                title="Encrypt the summary before uploading to Arweave (Lit + SBT gate)."
              >
                <FontAwesomeIcon
                  icon={encryptSummary ? faCheckSquare : faSquare}
                  className={styles.checkboxIcon}
                />
                <span>Encrypt Summary</span>
              </div>
            )}
          </div>

          {(additionalSources.length > 0 || shouldShowSaveExtraSourcesControl || (transcriptMode && uploadSummaryToArweave && encryptSummary)) && (
            <div className={styles.additionalContextSection}>
              {queuedPhotoSources.length > 0 && (
                <div className={styles.photoCardGrid}>
                  {queuedPhotoSources.map((item) => {
                    const statusKey = toStr(item?.analysisStatus || 'queued').trim().toLowerCase();
                    const statusLabel = getPhotoStatusLabel(item);
                    const analysisBodyId = `database-photo-analysis-${item?.id || 'unknown'}`;
                    const hasExpandedAnalysis = statusKey === 'ready' && item?.analysisExpanded && toStr(item?.analysisText).trim();

                    return (
                      <div
                        key={item?.id}
                        className={styles.photoCard}
                        data-testid={E2E_TESTIDS.DATABASE_PHOTO_SOURCE_CARD}
                        data-ce-source-id={item?.id}
                      >
                        <button
                          type="button"
                          onClick={() => removeAdditionalSource(item?.id)}
                          className={styles.photoRemoveBtn}
                          aria-label={`Remove photo ${item?.name || ''}`.trim()}
                        >
                          ×
                        </button>

                        <div className={styles.photoCardTop}>
                          <div className={styles.photoPreviewFrame}>
                            <QueuedPhotoPreview
                              file={item?.value}
                              photoName={item?.name}
                              sourceId={item?.id}
                            />
                          </div>

                          <div className={styles.photoCardMeta}>
                            <div className={styles.photoName} title={item?.name}>{item?.name}</div>
                            <div className={styles.photoCardStatusRow}>
                              {statusKey === 'ready' ? (
                                <button
                                  type="button"
                                  className={`${styles.photoStatusChip} ${styles.photoStatusToggle}`}
                                  onClick={() => togglePhotoAnalysisExpanded(item?.id)}
                                  aria-expanded={Boolean(item?.analysisExpanded)}
                                  aria-controls={analysisBodyId}
                                  data-testid={E2E_TESTIDS.DATABASE_PHOTO_SOURCE_ANALYSIS_TOGGLE}
                                  data-ce-source-id={item?.id}
                                >
                                  <span>{PHOTO_ANALYSIS_STATUS_LABELS.ready}</span>
                                  <FontAwesomeIcon icon={item?.analysisExpanded ? faCaretUp : faCaretDown} />
                                </button>
                              ) : (
                                <span
                                  className={`${styles.photoStatusChip} ${styles[`photoStatusChip${statusKey.charAt(0).toUpperCase()}${statusKey.slice(1)}`] || ''}`}
                                >
                                  {statusKey === 'error' ? PHOTO_ANALYSIS_STATUS_LABELS.error : statusLabel}
                                </span>
                              )}
                            </div>
                            {statusKey === 'error' && toStr(item?.analysisError).trim() ? (
                              <div className={styles.photoErrorText}>{item.analysisError}</div>
                            ) : null}
                          </div>
                        </div>

                        {hasExpandedAnalysis ? (
                          <div
                            id={analysisBodyId}
                            className={styles.photoAnalysisBody}
                            data-testid={E2E_TESTIDS.DATABASE_PHOTO_SOURCE_ANALYSIS_BODY}
                            data-ce-source-id={item?.id}
                          >
                            {item.analysisText}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {queuedNonPhotoSources.length > 0 && (
                <ul className={styles.sourceList}>
                  {queuedNonPhotoSources.map((item) => (
                    <li key={item?.id} className={styles.sourceItem}>
                      <span className={styles.sourceTypeLabel}>[{item.type}]</span>
                      <div className={styles.sourceMeta}>
                        <span className={styles.sourceName}>{item.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAdditionalSource(item?.id)}
                        className={styles.removeSourceBtn}
                        aria-label={`Remove ${item?.type || 'source'} ${item?.name || ''}`.trim()}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {shouldShowSaveExtraSourcesControl && (
                <div className={styles.docSaveRow}>
                  <label className={styles.docSaveToggle} htmlFor={E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}>
                    <input
                      id={E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}
                      type="checkbox"
                      checked={saveExtraSourcesToDocLibrary}
                      onChange={(event) => {
                        setSaveExtraSourcesToDocLibrary(event.target.checked);
                        if (!event.target.checked) setShowSaveDocAudienceMenu(false);
                      }}
                      data-testid={E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}
                    />
                    <span>Save to Session Doc Library</span>
                  </label>

                  {saveExtraSourcesToDocLibrary && (
                    <div className={styles.docSaveAudienceWrap}>
                      <button
                        type="button"
                        className={styles.docSaveAudienceButton}
                        onClick={() => setShowSaveDocAudienceMenu((value) => !value)}
                        data-testid={E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_BUTTON}
                        data-ce-doc-save-audience={saveDocAudience}
                      >
                        <FontAwesomeIcon icon={faLock} />
                        <span>{saveDocAudienceLabel}</span>
                        <FontAwesomeIcon icon={showSaveDocAudienceMenu ? faCaretUp : faCaretDown} />
                      </button>

                      {showSaveDocAudienceMenu && (
                        <div
                          className={styles.docSaveAudienceMenu}
                          data-testid={E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_MENU}
                        >
                          <button
                            type="button"
                            className={`${styles.docSaveAudienceOption} ${saveDocAudience === 'self' ? styles.active : ''}`}
                            onClick={() => {
                              setSaveDocAudience('self');
                              setShowSaveDocAudienceMenu(false);
                            }}
                            data-testid={E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_SELF}
                          >
                            <FontAwesomeIcon icon={faLock} />
                            <span>only me</span>
                          </button>

                          {docSaveGate.hasRecipients ? (
                            <button
                              type="button"
                              className={`${styles.docSaveAudienceOption} ${saveDocAudience === 'session' ? styles.active : ''}`}
                              onClick={() => {
                                setSaveDocAudience('session');
                                setShowSaveDocAudienceMenu(false);
                              }}
                              data-testid={E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_SESSION}
                            >
                              <FontAwesomeIcon icon={faLock} />
                              <span>{docSaveSessionLabel}</span>
                            </button>
                          ) : (
                            <div className={styles.docSaveAudienceNote}>
                              Session <code>docUploads</code> gate unavailable. Saved docs will stay private to your wallet.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {transcriptMode && uploadSummaryToArweave && encryptSummary && (
                <div className={styles.litGateRow}>
                  <SBTSelector
                    id="summary-encryption"
                    label="SBTs that can decrypt the summary"
                    selectedSBTs={summaryGateSBTs}
                    onAddSBT={(sbt) => setSummaryGateSBTs((prev) => [...prev, sbt])}
                    onRemoveSBT={(address) =>
                      setSummaryGateSBTs((prev) =>
                        prev.filter((item) => String(item.address || '').toLowerCase() !== String(address || '').toLowerCase())
                      )
                    }
                    network={network}
                    sessionSlug={resolvedSessionSlug || ''}
                    defaultFeaturedSBTs={resolvedSessionConfig?.defaultFeaturedSBTs || []}
                    enableGroupSelect
                    variant="create"
                  />
                  <FormGroup className={styles.litGateMode}>
                    <Label>Gate mode</Label>
                    <Input
                      type="select"
                      value={summaryGateMode}
                      onChange={(e) => setSummaryGateMode(e.target.value)}
                    >
                      <option value="any">Any (OR)</option>
                      <option value="all">All (AND)</option>
                    </Input>
                  </FormGroup>
                </div>
              )}

              {transcriptMode && uploadSummaryToArweave && encryptSummary && summaryGateSBTs.length === 0 && summaryGateAddresses.length === 0 && (
                <div className={styles.encryptionWarning}>
                  Select at least one SBT to encrypt the summary.
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Types</h3>

          <div className={styles.questionTypeGrid}>
            <div
              className={`${styles.typeButton} ${questionTypes.binary ? styles.active : ''}`}
              onClick={() => toggleQuestionType('binary')}
            >
              <div className={styles.typeTitle}>Binary</div>
              <div className={styles.typePreviewRow}>
                <span className={`${styles.pill} ${styles.pillAgree}`}>Agree</span>
                <span className={`${styles.pill} ${styles.pillUnsure}`}>Unsure</span>
                <span className={`${styles.pill} ${styles.pillDisagree}`}>Disagree</span>
              </div>
            </div>

            <div
              className={`${styles.typeButton} ${questionTypes.multichoice ? styles.active : ''}`}
              onClick={() => toggleQuestionType('multichoice')}
            >
              <div className={styles.typeTitle}>Multichoice</div>
              <div className={styles.typePreviewRow}>
                <span className={styles.pill}>Opt 1</span>
                <span className={styles.pill}>Opt 2</span>
                <span className={styles.pill}>Opt 3</span>
              </div>
            </div>

            <div
              className={`${styles.typeButton} ${questionTypes.rating ? styles.active : ''}`}
              onClick={() => toggleQuestionType('rating')}
            >
              <div className={styles.typeTitle}>Rating</div>
              <div className={styles.ratingPreviewWrap}>
                <div className={styles.ratingPreviewFill} />
                <div className={styles.ratingPreviewHandle} />
              </div>
            </div>

            <div
              className={`${styles.typeButton} ${questionTypes.freeform ? styles.active : ''}`}
              onClick={() => toggleQuestionType('freeform')}
            >
              <div className={styles.typeTitle}>Freeform</div>
              <div className={styles.freeformPreview}>...</div>
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <div className={styles.countControlRow} role="group" aria-label="Number of questions">
            <span className={styles.countInlineLabel} aria-hidden="true"># Questions</span>
            <div
              className={styles.countReadout}
              aria-label={`Number of questions: ${count}`}
              data-testid={E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}
              aria-live="polite"
              aria-atomic="true"
            >
              <span>{count}</span>
            </div>
            <Button
              type="button"
              color="secondary"
              className={styles.countAdjustButton}
              onClick={() => adjustQuestionCount(-QUESTION_COUNT_STEP)}
              disabled={count <= MIN_QUESTION_COUNT || loading}
              aria-label="Decrease question count"
              data-testid={E2E_TESTIDS.DATABASE_QUESTION_COUNT_DECREMENT}
            >
              -
            </Button>
            <Button
              type="button"
              color="secondary"
              className={styles.countAdjustButton}
              onClick={() => adjustQuestionCount(QUESTION_COUNT_STEP)}
              disabled={count >= MAX_QUESTION_COUNT || loading}
              aria-label="Increase question count"
              data-testid={E2E_TESTIDS.DATABASE_QUESTION_COUNT_INCREMENT}
            >
              +
            </Button>
          </div>
        </div>

        {shouldShowGenerateButton && (
          <Button
            type="submit"
            className={styles.generateButton}
            disabled={loading}
          >
            {loading ? (
              <>
                {isTranscribing ? 'Transcribing... ' : 'Processing... '}
                {waitingSeconds}s <FontAwesomeIcon icon={faSpinner} spin />
              </>
            ) : (
              'Generate Questions'
            )}
          </Button>
        )}
      </form>

      {error && !loading && (
        <div className={styles.error} style={{ marginTop: '10px' }}>
          {error}
        </div>
      )}

      <div className={styles.aiPromptSection}>
        <button
          type="button"
          className={styles.aiPromptToggleBtn}
          onClick={toggleAIPrompt}
        >
          {showAIPrompt ? 'Hide AI Prompt' : 'Show AI Prompt'}
          <FontAwesomeIcon icon={showAIPrompt ? faCaretUp : faCaretDown} style={{ marginLeft: '6px' }} />
        </button>

        {showAIPrompt && (
          <div className={styles.aiPromptWrapper}>
            <button
              type="button"
              className={`${styles.aiPromptCopyCorner} ${aiPromptCopySuccess ? styles.aiPromptCopyCornerSuccess : ''}`}
              onClick={copyAIPromptToClipboard}
              title="Copy prompt"
            >
              <FontAwesomeIcon icon={aiPromptCopySuccess ? faCheck : faClipboard} />
            </button>
            <div className={styles.aiPromptHeader}>
              <strong>{`AI Prompt — ${aiPromptModelLabel}`}</strong>
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
                {highlightPromptVariables(aiPromptText || '(Prompt not available)')}
              </pre>
            </div>
          </div>
        )}
      </div>

      {showCreateSurvey && renderCreateSurveyComponent()}
        </>
      )}
    </div>
  );
}
