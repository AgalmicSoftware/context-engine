/** @file SurveyGenerator.tsx */
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
import CompactImageChooser from '../../Shared/CompactImageChooser';
import { readCompactImageClipboard } from '../../Shared/compactImageClipboard.js';
import CreateQuestionsAndSurveys from '../CreateQuestionsAndSurveys';
import SBTSelector from '../../SBTs/SBTSelector';
import DocumentLibraryPanel from '../../DocumentLibrary/DocumentLibraryPanel';
import SessionChipSelector from '../../Shared/SessionChipSelector';

import { seedGenPrompt } from '../../../prompts/seedGenPrompt.js';
import {
  buildSbtAccessControlConditions,
  buildWalletAddressAccessControlConditions,
  getUnsupportedLitContractAccessControlError,
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
import { fetchImageFromURL } from '../../../utilities/ui/imageScripts.js';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';

const cacheLog = createLogger('cache');
const AudioInputUntyped = AudioInput as any;
const SessionChipSelectorUntyped = SessionChipSelector as any;
const uploadDocLibraryFileUntyped = uploadDocLibraryFile as any;
const uploadDocLibraryUrlRecordUntyped = uploadDocLibraryUrlRecord as any;
const buildSessionDocLibraryViewerUrlUntyped = buildSessionDocLibraryViewerUrl as any;
const getEffectiveAiConfigUntyped = getEffectiveAiConfig as any;
const AI_PROVIDER_LABELS: Record<string, string> = Object.freeze({
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
const SUPPORTED_SOURCE_FILE_EXTENSIONS = /\.(pdf|md|txt|csv|ppt|pptx|json)$/i;
const SUPPORTED_SOURCE_FILE_ACCEPT = '.pdf,.md,.txt,.csv,.ppt,.pptx,.json';
const SUPPORTED_PHOTO_EXTENSIONS = /\.(png|jpe?g|webp|gif)$/i;
const SUPPORTED_PHOTO_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif';
const SUPPORTED_SOURCE_UPLOAD_ACCEPT = `${SUPPORTED_SOURCE_FILE_ACCEPT},${SUPPORTED_PHOTO_ACCEPT}`;
const PHOTO_ANALYSIS_STATUS_LABELS: Record<string, string> = Object.freeze({
  queued: 'Queued for analysis',
  loading: 'Analyzing photo...',
  ready: 'Analysis complete',
  error: 'Analysis failed',
});
const getErrorMessage = (error: any, fallback = 'Unknown error') => (
  typeof error?.message === 'string' && error.message.trim() ? error.message : fallback
);

const clampQuestionCount = (value: any) => Math.min(MAX_QUESTION_COUNT, Math.max(MIN_QUESTION_COUNT, value));

const buildAdditionalSourceId = (ref: any) => {
  ref.current += 1;
  return `database-source-${ref.current}`;
};

const isSupportedPhotoFile = (file: any) => (
  Boolean(file) &&
  (
    /^image\/(png|jpeg|webp|gif)$/i.test(String(file?.type || '').trim()) ||
    SUPPORTED_PHOTO_EXTENSIONS.test(String(file?.name || '').trim())
  )
);

const isSupportedAdditionalFile = (file: any) => (
  Boolean(file) &&
  (
    /^(application\/pdf|text\/markdown|text\/plain|text\/csv|application\/json|application\/vnd\.ms-powerpoint|application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation)$/i
      .test(String(file?.type || '').trim()) ||
    SUPPORTED_SOURCE_FILE_EXTENSIONS.test(String(file?.name || '').trim())
  )
);

const buildQueuedFileSource = (file: any, ref: any) => ({
  id: buildAdditionalSourceId(ref),
  type: 'file',
  value: file,
  name: file.name,
});

const isLikelyImageUrl = (value: any = '') => {
  const raw = toStr(value).trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    const pathname = toStr(parsed.pathname).trim();
    return SUPPORTED_PHOTO_EXTENSIONS.test(pathname);
  } catch (_) {
    return false;
  }
};

const buildQueuedPhotoSource = (file: any, ref: any) => ({
  id: buildAdditionalSourceId(ref),
  type: 'photo',
  value: file,
  name: file.name,
  analysisStatus: 'queued',
  analysisError: '',
  analysisText: '',
  analysisExpanded: false,
});

const buildUnsupportedPhotoMessage = (count: any = 0) => (
  `Skipped ${count} unsupported photo${count === 1 ? '' : 's'}. Use png, jpg, jpeg, webp, or gif.`
);

const buildUnsupportedSourceMessage = (count: any = 0) => (
  `Skipped ${count} unsupported file${count === 1 ? '' : 's'}. Use pdf, md, txt, csv, ppt, pptx, json, png, jpg, jpeg, webp, or gif.`
);

const getPhotoStatusLabel = (source: any = {}) => {
  const status = toStr(source?.analysisStatus || 'queued').trim().toLowerCase();
  if (status === 'error') {
    return toStr(source?.analysisError).trim() || PHOTO_ANALYSIS_STATUS_LABELS.error;
  }
  return PHOTO_ANALYSIS_STATUS_LABELS[status] || PHOTO_ANALYSIS_STATUS_LABELS.queued;
};

const buildPhotoPreviewUrl = (file: any) => {
  if (!file || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return '';
  }
  return URL.createObjectURL(file);
};

function QueuedPhotoPreview({ file, photoName, sourceId }: any) {
  const [previewSrc] = useState<any>(() => buildPhotoPreviewUrl(file));

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

const buildPhotoAnalysisMarkdown = ({ photoName, analysisText }: any = {}) => {
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

const buildPhotoAnalysisFilename = (photoName: any = '') => {
  const safeName = toStr(photoName).trim() || 'photo';
  const withoutExtension = safeName.replace(/\.(png|jpe?g|webp|gif)$/i, '') || safeName;
  return `${withoutExtension}.analysis.md`;
};

const sanitizeFileBaseName = (value: any, fallback = 'context') => {
  const trimmed = toStr(value).trim();
  if (!trimmed) return fallback;
  const normalized = trimmed
    .replace(/\.[A-Za-z0-9]{1,12}$/g, '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
};

const getFileExtension = (name: any = '') => {
  const raw = toStr(name).trim();
  const dot = raw.lastIndexOf('.');
  if (dot <= 0 || dot >= raw.length - 1) return '';
  return raw.slice(dot + 1);
};

const buildUploadFilename = ({
  title,
  originalName,
  fallbackBase = 'context',
  fallbackExtension = '',
}: any = {}) => {
  const base = sanitizeFileBaseName(title, sanitizeFileBaseName(originalName, fallbackBase));
  const extension = getFileExtension(originalName) || toStr(fallbackExtension).trim();
  return extension ? `${base}.${extension}` : base;
};

const renameFileForLibraryUpload = (file: any, title: any) => {
  if (!(file instanceof File)) return file;
  const trimmedTitle = toStr(title).trim();
  if (!trimmedTitle) return file;
  const nextName = buildUploadFilename({
    title: trimmedTitle,
    originalName: file.name,
    fallbackBase: 'context',
  });
  if (!nextName || nextName === file.name) return file;
  return new File([file], nextName, {
    type: file.type,
    lastModified: Number(file.lastModified || Date.now()),
  });
};

const buildManualLibraryTextFile = ({ title, text }: any = {}) => {
  const body = toStr(text);
  const looksLikeMarkdown = /(^|\n)\s*(#|\* |- |\d+\.)/.test(body);
  const extension = looksLikeMarkdown ? 'md' : 'txt';
  const filename = buildUploadFilename({
    title,
    originalName: '',
    fallbackBase: 'context-note',
    fallbackExtension: extension,
  });
  return new File([body], filename, {
    type: looksLikeMarkdown ? 'text/markdown' : 'text/plain',
  });
};

const isManualLibraryUploadableContent = ({
  pastedText = '',
  additionalUrlInput = '',
  additionalSources = [],
}: any = {}) => (
  Boolean(toStr(pastedText).trim()) ||
  Boolean(toStr(additionalUrlInput).trim()) ||
  (Array.isArray(additionalSources) && additionalSources.length > 0)
);
const formatAiPromptModelLabel = (config: any = {}) => {
  const providerKey = toStr(config?.provider).trim().toLowerCase();
  const model = toStr(config?.model).trim();
  const provider =
    AI_PROVIDER_LABELS[providerKey] ||
    (providerKey ? `${providerKey.charAt(0).toUpperCase()}${providerKey.slice(1)}` : '');
  if (provider && model) return `${provider} ${model}`;
  return model || provider || 'Configured model';
};






// Dev-only logger
const debug = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') cacheLog.log(...args);
};

// Helper function to normalize defaultTags prop
const normalizeTags = (dTags: any) => {
  if (!dTags) return [];
  if (Array.isArray(dTags)) return dTags.filter(Boolean).map((t: any) => t.trim());
  if (typeof dTags === 'string')
    return dTags
      .split(',')
      .map((t: any) => t.trim())
      .filter(Boolean);
  return [];
};

export const isSingleHttpUrlInput = (value: any = '') => /^https?:\/\/\S+$/.test(String(value).trim());
export const hasDatabaseToolInputContent = ({
  pastedText = '',
  additionalUrlInput = '',
  additionalSources = [],
  audioFile = null,
}: any = {}) => {
  if (toStr(pastedText).trim()) return true;
  if (toStr(additionalUrlInput).trim()) return true;
  if (Array.isArray(additionalSources) && additionalSources.length > 0) return true;
  return Boolean(audioFile);
};

const LazyCorpusViewer = React.lazy(() => import('../../DemoViews/CorpusViewer'));


export default function AudioSurveyGenerator(rawProps: any = {}) {
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
  const [transcriptMode, setTranscriptMode] = useState<any>(false);
  // NEW: Toggle for Arweave upload
  const [uploadSummaryToArweave, setUploadSummaryToArweave] = useState<any>(true);
  const [encryptSummary, setEncryptSummary] = useState<any>(false);

  // Input States
  const [pastedText, setPastedText] = useState<any>('');
  const [textEncrypted, setTextEncrypted] = useState<any>(false);

  // Audio specific
  const [audioFile, setAudioFile] = useState<any>(null);
  const [isTranscribing, setIsTranscribing] = useState<any>(false);

  // AI Prompt Panel State
  const [showAIPrompt, setShowAIPrompt] = useState<any>(false);
  const [aiPromptText, setAiPromptText] = useState<any>('');
  const [aiPromptLoaded, setAiPromptLoaded] = useState<any>(false);
  const [aiPromptCopySuccess, setAiPromptCopySuccess] = useState<any>(false);
  const [aiPromptModelLabel, setAiPromptModelLabel] = useState<any>('Configured model');

  const [questionTypes, setQuestionTypes] = useState<any>({
    // defaults
    binary: true,
    multichoice: true,
    rating: false,
    freeform: false,
  });
  const [count, setCount] = useState<any>(DEFAULT_QUESTION_COUNT);

  const [loading, setLoading] = useState<any>(false);
  const [activeAction, setActiveAction] = useState<any>('');
  const [error, setError] = useState<any>('');
  const [waitingSeconds, setWaitingSeconds] = useState<any>(0);
  const waitTimerRef = React.useRef<any>(null);
  const [surveyTitle, setSurveyTitle] = useState<any>('');
  const [statementsToUpload, setStatementsToUpload] = useState<any>([]);
  const [prefilledAnswers, setPrefilledAnswers] = useState<any>([]);
  const [showCreateSurvey, setShowCreateSurvey] = useState<any>(false);
  const [documentURLs, setDocumentURLs] = useState<any>([]);

  // AUDIO summary-first flow state
  const [summaryMd, setSummaryMd] = useState<any>('');
  const [summaryCollapsed, setSummaryCollapsed] = useState<any>(true);
  const [summaryArweaveTxId, setSummaryArweaveTxId] = useState<any>('');
  const [summaryDocURL, setSummaryDocURL] = useState<any>('');

  const [showSessionSelector, setShowSessionSelector] = useState<any>(false);
  const [localSessionOverrideSlug, setLocalSessionOverrideSlug] = useState<any>(null);
  const [localSessionOverrideTouched, setLocalSessionOverrideTouched] = useState<any>(false);
  const hasControlledSessionOverride =
    Object.prototype.hasOwnProperty.call(rawProps, 'sessionOverrideSlug') ||
    Object.prototype.hasOwnProperty.call(rawProps, 'sessionOverrideTouched') ||
    Object.prototype.hasOwnProperty.call(rawProps, 'hideInternalSessionSelector');
  const demoSurfaceEnabled = demoSurfaceMode !== false;
  const [showDemoCorpusView, setShowDemoCorpusView] = useState<any>(demoSurfaceEnabled);

  // Multi-source State
  const [additionalSources, setAdditionalSources] = useState<any>([]);
  const [additionalUrlInput, setAdditionalUrlInput] = useState<any>('');
  const imagePickerInputRef = useRef<any>(null);
  const uploadAudioInputRef = useRef<any>(null);
  const additionalSourceIdRef = useRef<any>(0);
  const [saveExtraSourcesToDocLibrary, setSaveExtraSourcesToDocLibrary] = useState<any>(false);
  const [saveDocAudience, setSaveDocAudience] = useState<any>('self');
  const [showSaveDocAudienceMenu, setShowSaveDocAudienceMenu] = useState<any>(false);
  const [analyzeBeforeLibraryUpload, setAnalyzeBeforeLibraryUpload] = useState<any>(true);
  const [imagePickerStatusText, setImagePickerStatusText] = useState<any>('');
  const [imagePickerStatusTone, setImagePickerStatusTone] = useState<any>('default');

  const [summaryGateSBTs, setSummaryGateSBTs] = useState<any>([]);
  const [summaryGateMode, setSummaryGateMode] = useState<any>('any');
  const lastSummaryGateKeyRef = useRef<any>('');
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
    resolveBySlug: (slug: any) => getSessionConfigBySlug(slug),
  }), [effectiveSessionConfigInput, effectiveSessionSlugInput]);
  const resolvedSessionSlug = resolvedSessionAliases.sessionSlug;
  const resolvedSessionConfig: any = useMemo(() => {
    const cfg: any = resolvedSessionAliases.sessionConfig || {};
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
  const networkChainId = network?.id || null;
  const docSaveGate = useMemo(
    () => resolveDocUploadsGate(resolvedSessionConfig),
    [resolvedSessionConfig],
  );
  const sessionHasLitChipotle = useMemo(() => {
    const litCredentials = (
      resolvedSessionConfig?.litCredentials &&
      typeof resolvedSessionConfig.litCredentials === 'object' &&
      !Array.isArray(resolvedSessionConfig.litCredentials)
    ) ? resolvedSessionConfig.litCredentials : null;
    return !!(
      toStr(resolvedSessionConfig?.corsWorkerUrl).trim() &&
      toStr(litCredentials?.litApiBase).trim() &&
      toStr(litCredentials?.litActionCid).trim() &&
      toStr(litCredentials?.litPkpId).trim()
    );
  }, [resolvedSessionConfig]);
  const docSaveSessionChainError = useMemo(() => (
    docSaveGate.hasRecipients && !sessionHasLitChipotle
      ? getUnsupportedLitContractAccessControlError({
        chainId: docSaveGate.chainId || networkChainId || null,
      })
      : ''
  ), [docSaveGate.chainId, docSaveGate.hasRecipients, networkChainId, sessionHasLitChipotle]);
  const docSaveSessionAudienceAvailable = docSaveGate.hasRecipients && !docSaveSessionChainError;
  const docSaveSessionLabel = useMemo(() => {
    const sessionName = toStr(resolvedSessionConfig?.sessionName).trim();
    if (sessionName) return sessionName;
    const slug = toStr(resolvedSessionSlug).trim();
    if (slug) return slug;
    return 'Session';
  }, [resolvedSessionConfig, resolvedSessionSlug]);
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
  const summaryGateKey = summaryGateAddresses.map((addr: any) => addr.toLowerCase()).sort().join('|');
  const activeSessionKey = useMemo(() => {
    const hasExplicit = typeof effectiveSessionSlugInput === 'string';
    if (!hasExplicit) return null;
    return normalizeSessionSlug(effectiveSessionSlugInput ?? '');
  }, [effectiveSessionSlugInput]);
  const sessionSelectorOptions: any[] = useMemo(() => {
    const selectedSlug = normalizeSessionSlug(resolvedSessionSlug || activeSessionSlug || '');
    const options: any = new Map();
    const pushOption = (slugIn: any = '') => {
      const slug = normalizeSessionSlug(slugIn || '');
      const cfg: any = getSessionConfigBySlug(slug) || {};
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
  const summaryGateSessionKeyRef = useRef<any>(summaryGateSessionKey);
  const docSaveContextKeyRef = useRef<any>('');
  const docSaveAutoAudienceRef = useRef<any>(docSaveGate.hasRecipients ? 'session' : 'self');

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
    setSummaryGateSBTs(summaryGateAddresses.map((addr: any) => ({ address: addr, name: addr })));
    if (summaryGateModeDefault) setSummaryGateMode(summaryGateModeDefault);
  }, [summaryGateAddresses, summaryGateKey, summaryGateModeDefault, summaryGateSBTs.length, summaryGateMismatch]);

  useEffect(() => {
    const nextContextKey = `${toStr(resolvedSessionSlug).trim().toLowerCase()}:${resolvedSessionIdHex}`;
    const nextDefaultAudience = docSaveSessionAudienceAvailable ? 'session' : 'self';
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
  }, [resolvedSessionSlug, resolvedSessionIdHex, docSaveSessionAudienceAvailable, saveDocAudience]);

  useEffect(() => {
    if (additionalSources.length > 0) return;
    setSaveExtraSourcesToDocLibrary(false);
    setShowSaveDocAudienceMenu(false);
  }, [additionalSources.length]);

  const abortedRef = React.useRef<any>(false);
  useEffect(() => {
    abortedRef.current = false; return () => { abortedRef.current = true; };
  }, []);

  useEffect(() => {
    if (loading && !waitTimerRef.current) {
      setWaitingSeconds(0);
      waitTimerRef.current = setInterval(() => setWaitingSeconds((s: any) => s + 1), 1000);
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
    setTranscriptMode((prev: any) => {
      const newVal = !prev;
      if (!newVal) {
        setAudioFile(null);
        setSummaryMd('');
        setSummaryCollapsed(true);
      }
      return newVal;
    });
  };

  function buildSinglePrompt(sourceDocContent: any, overrides: any = {}) {
    const allowed = normalizeTags(defaultTags);
    const defaultTagsStr = allowed.length > 0 ? allowed.join(', ') : '';

    const selectedTypes = Object.keys(questionTypes).filter((t: any) => questionTypes[t]);
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

  async function makeSingleAiCall(sourceDocContent: any, overrides: any = {}, requestedCount: any = count) {
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
      setShowCreateSurvey(false);
      setStatementsToUpload([]);
      setActiveAction('generate');
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
          const unsupportedGateError = sessionHasLitChipotle
            ? ''
            : getUnsupportedLitContractAccessControlError({
              chainId: gateChainId,
              litChain,
            });
          if (unsupportedGateError) {
            throw new Error(unsupportedGateError);
          }
          const selectedAddresses = (summaryGateSBTs || []).map((sbt: any) => sbt.address).filter(Boolean);
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
          txId = result?.txId || '';
          url = result?.url || '';
        } else {
          const result = await uploadMarkdownSummaryToArweave(summaryMd, {
            sessionSlug: resolvedSessionSlug || '',
            sessionConfig: resolvedSessionConfig,
            arweaveJwk: arweaveKey?.arweaveJwk || '',
            context: { account, providerLike: provider, chainId: network?.id },
          });
          if (abortedRef.current) return;
          txId = result?.txId || '';
          url = result?.url || '';
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
    } catch (err: any) {
      if (!abortedRef.current) {
        setError(getErrorMessage(err, 'Failed to upload summary or generate questions.'));
      }
    } finally {
      if (!abortedRef.current) {
        setLoading(false);
        setActiveAction('');
        setWaitingSeconds(0);
      }
    }
  }

  function processAndSetQuestions(aiData: any, docs: any, fallbackTitle: any = effectiveSurveyTitle) {
    const wantedTypes = Object.keys(questionTypes).filter((t: any) => questionTypes[t]);
    const qs = aiData.questions
      .filter((q: any) => wantedTypes.includes(q.questionType))
      .slice(0, count);

    qs.forEach((q: any) => { q.tags = q.tags || []; });

    const formatted = qs.map((q: any) => ({
      id: generateQuestionId(q.questionType, q.prompt, q.options || []),
      type: q.questionType,
      prompt: q.prompt,
      options: q.questionType === 'multichoice' ? q.options : undefined,
      tags: q.tags
    }));

    const resolvedTitle = toStr(aiData?.surveyTitle).trim() || toStr(fallbackTitle).trim();
    setStatementsToUpload(formatted);
    setSurveyTitle(resolvedTitle);
    setDocumentURLs(docs);

    if (typeof onQuestionsGenerated === 'function') {
      onQuestionsGenerated(formatted, docs, resolvedTitle);
    }
  }

  const addAdditionalUrl = async () => {
    const rawUrl = toStr(additionalUrlInput).trim();
    if (!rawUrl) return;

    if (isLikelyImageUrl(rawUrl)) {
      try {
        const file = await fetchImageFromURL(rawUrl);
        if (abortedRef.current) return;
        queueAdditionalPhotoFiles([file]);
        setAdditionalUrlInput('');
        setImagePickerStatusText('');
        setImagePickerStatusTone('default');
        return;
      } catch (err: any) {
        setError(getErrorMessage(err, 'Image URL could not be loaded.'));
        return;
      }
    }

    try {
      const file = await fetchImageFromURL(rawUrl);
      if (abortedRef.current) return;
      queueAdditionalPhotoFiles([file]);
      setAdditionalUrlInput('');
      setImagePickerStatusText('');
      setImagePickerStatusTone('default');
      return;
    } catch (_err) {
      if (abortedRef.current) return;
    }

    setAdditionalSources((prev: any) => [
      ...prev,
      {
        id: buildAdditionalSourceId(additionalSourceIdRef),
        type: 'url',
        value: rawUrl,
        name: rawUrl,
      }
    ]);
    setError('');
    setAdditionalUrlInput('');
    setImagePickerStatusText('');
    setImagePickerStatusTone('default');
  };

  const handleUrlKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAdditionalUrl();
    }
  };

  const adjustQuestionCount = (delta: any) => {
    setCount((previousCount: any) => clampQuestionCount(previousCount + delta));
  };

  const queueAdditionalPhotoFiles = (files: any = []) => {
    const selectedFiles = Array.isArray(files) ? files : [files];
    const validFiles = selectedFiles.filter(isSupportedPhotoFile);
    const invalidCount = selectedFiles.length - validFiles.length;

    if (validFiles.length > 0) {
      setAdditionalSources((prev: any) => [
        ...prev,
        ...validFiles.map((file: any) => buildQueuedPhotoSource(file, additionalSourceIdRef)),
      ]);
    }

    if (invalidCount > 0) {
      setError(buildUnsupportedPhotoMessage(invalidCount));
    } else if (validFiles.length > 0) {
      setError('');
    }
    return { validFiles, invalidCount };
  };

  const queueAdditionalUploadedFiles = (files: any = []) => {
    const selectedFiles = Array.isArray(files) ? files : [files];
    const nextSources: any[] = [];
    let invalidCount = 0;

    selectedFiles.forEach((file: any) => {
      if (isSupportedPhotoFile(file)) {
        nextSources.push(buildQueuedPhotoSource(file, additionalSourceIdRef));
        return;
      }
      if (isSupportedAdditionalFile(file)) {
        nextSources.push(buildQueuedFileSource(file, additionalSourceIdRef));
        return;
      }
      invalidCount += 1;
    });

    if (nextSources.length > 0) {
      setAdditionalSources((prev: any) => [...prev, ...nextSources]);
    }

    if (invalidCount > 0) {
      setError(buildUnsupportedSourceMessage(invalidCount));
    } else if (nextSources.length > 0) {
      setError('');
    }

    return { nextSources, invalidCount };
  };

  const handleAdditionalSourceUpload = (e: any) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    queueAdditionalUploadedFiles(Array.from(files));
    e.target.value = '';
  };

  const handleImagePickerUploadClick = () => {
    setImagePickerStatusText('');
    setImagePickerStatusTone('default');
    if (imagePickerInputRef.current) imagePickerInputRef.current.click();
  };

  const handleImagePickerPaste = async () => {
    const clipboardResult = await readCompactImageClipboard({
      fileNamePrefix: 'clipboard-context-image',
    });

    if (clipboardResult?.kind === 'file' && clipboardResult.file) {
      queueAdditionalPhotoFiles([clipboardResult.file]);
      setImagePickerStatusText('');
      setImagePickerStatusTone('default');
      return;
    }

    if (clipboardResult?.kind === 'text') {
      setAdditionalUrlInput(toStr(clipboardResult.text).trim());
      setImagePickerStatusText('Pasted URL into Add URL.');
      setImagePickerStatusTone('default');
      return;
    }

    setImagePickerStatusText(clipboardResult?.error || 'Clipboard does not contain a supported image or URL.');
    setImagePickerStatusTone('error');
  };

  const removeAdditionalSource = (sourceId: any) => {
    setAdditionalSources((prev: any) => prev.filter((source: any) => source?.id !== sourceId));
  };

  const updateAdditionalSourceById = (sourceId: any, patch: any) => {
    setAdditionalSources((prev: any) => (
      (Array.isArray(prev) ? prev : []).map((source: any) => (
        source?.id === sourceId
          ? {
              ...source,
              ...(typeof patch === 'function' ? patch(source) : patch),
            }
          : source
      ))
    ));
  };

  const analyzeQueuedPhotoSources = async (sources: any = []) => {
    const queuedSources = Array.isArray(sources) ? sources : [];
    const analysisBySourceId: any = new Map();
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
      } catch (err: any) {
        const message = getErrorMessage(err, 'Photo analysis failed.');
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

  const togglePhotoAnalysisExpanded = (sourceId: any) => {
    updateAdditionalSourceById(sourceId, (source: any) => ({
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
      if (!docSaveSessionAudienceAvailable) {
        throw new Error(docSaveSessionChainError || 'Session docUploads gate is unavailable or empty.');
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
    const accessControlConditions = buildWalletAddressAccessControlConditions({
      walletAddress: account,
      chainId,
    });
    if (!accessControlConditions) {
      throw new Error('Connected wallet address is unavailable for private doc save.');
    }
    const litChain = toStr(accessControlConditions?.[0]?.chain).trim() || resolveLitChain({ chainId });
    return {
      enabled: true,
      saveKey: litHooks.saveKey,
      accessControlConditions,
      litChain,
      chainId,
      contextLabel: `doc-self:${resolvedSessionSlug || ''}`,
    };
  };

  const uploadSourcesToDocLibrary = async ({
    sources = [],
    photoAnalysisBySourceId = new Map(),
    includePhotoAnalysis = true,
    titleOverride = '',
  }: any = {}) => {
    const queuedSources = Array.isArray(sources) ? sources : [];
    const encryption = resolveDocSaveEncryption();
    const savedViewerUrls: any[] = [];
    const singleSourceTitle = queuedSources.length === 1 ? toStr(titleOverride).trim() : '';

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

      let result: any = null;
      const viewerUrls: any[] = [];
      if (isUrlSource) {
        result = await uploadDocLibraryUrlRecordUntyped({
          url: source?.value,
          title: singleSourceTitle || source?.name,
          sessionSlug: resolvedSessionSlug || '',
          sessionConfig: resolvedSessionConfig,
          account,
          providerLike: provider,
          chainId: network?.id || null,
          tags: baseTags,
          encryption: {
            ...encryption,
            contextLabel: `doc-link:${resolvedSessionSlug || ''}`,
          } as any,
        });
      } else {
        result = await uploadDocLibraryFileUntyped({
          file: singleSourceTitle ? renameFileForLibraryUpload(source?.value, singleSourceTitle) : source?.value,
          sessionSlug: resolvedSessionSlug || '',
          sessionConfig: resolvedSessionConfig,
          account,
          providerLike: provider,
          chainId: network?.id || null,
          tags: baseTags,
          encryption: encryption as any,
        });
      }

      const viewerUrl = buildSessionDocLibraryViewerUrlUntyped({
        sessionToken: docSaveSessionToken,
        txId: result?.txId,
        storage: result?.storage || 'lit-arweave',
        kind: result?.kind || kind,
        name: singleSourceTitle || source?.name || '',
      });
      viewerUrls.push(viewerUrl || result?.url || '');

      if (includePhotoAnalysis && isPhotoSource) {
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
          const analysisResult = await uploadDocLibraryFileUntyped({
            file: analysisFile,
            sessionSlug: resolvedSessionSlug || '',
            sessionConfig: resolvedSessionConfig,
            account,
            providerLike: provider,
            chainId: network?.id || null,
            tags: analysisTags,
            encryption: encryption as any,
          });
          const analysisViewerUrl = buildSessionDocLibraryViewerUrlUntyped({
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

  const saveQueuedSourcesToDocLibrary = async (sources: any = [], photoAnalysisBySourceId: any = new Map()) => {
    const queuedSources = Array.isArray(sources) ? sources : [];
    if (!saveExtraSourcesToDocLibrary || queuedSources.length === 0) return [];
    if (!loginComplete) {
      if (typeof toggleLoginModal === 'function') toggleLoginModal(true);
      throw new Error('Connect a wallet to save sources to the session doc library.');
    }
    if (!resolvedSessionIdHex) {
      throw new Error('Session ID is unavailable; cannot save session docs.');
    }

    return uploadSourcesToDocLibrary({
      sources: queuedSources,
      photoAnalysisBySourceId,
      includePhotoAnalysis: true,
      titleOverride: effectiveSurveyTitle,
    });
  };

  const buildEffectiveAdditionalSources = () => {
    const queuedAdditionalSources = [...additionalSources];
    let effectiveSources = [...queuedAdditionalSources];
    if (additionalUrlInput && additionalUrlInput.trim()) {
      const pendingUrl = additionalUrlInput.trim();
      effectiveSources = [
        ...effectiveSources,
        {
          id: buildAdditionalSourceId(additionalSourceIdRef),
          type: 'url',
          value: pendingUrl,
          name: pendingUrl,
        },
      ];
    }
    return { queuedAdditionalSources, effectiveSources };
  };

  const handleAddToLibrary = async () => {
    const trimmedText = toStr(pastedText).trim();
    const { effectiveSources } = buildEffectiveAdditionalSources();
    if (!trimmedText && effectiveSources.length === 0) return;
    if (!loginComplete) {
      if (typeof toggleLoginModal === 'function') toggleLoginModal(true);
      return;
    }
    if (!resolvedSessionIdHex) {
      setError('Session ID is unavailable; cannot save session docs.');
      return;
    }

    setError('');
    setActiveAction('library');
    setLoading(true);
    setWaitingSeconds(0);

    try {
      const photoAnalysisBySourceId = analyzeBeforeLibraryUpload
        ? await analyzeQueuedPhotoSources(effectiveSources)
        : new Map();
      const savedSourceDocs = await uploadSourcesToDocLibrary({
        sources: effectiveSources,
        photoAnalysisBySourceId,
        includePhotoAnalysis: analyzeBeforeLibraryUpload,
        titleOverride: effectiveSurveyTitle,
      });

      const uploadedViewerUrls = savedSourceDocs.flatMap((entry: any) => (
        Array.isArray(entry?.viewerUrls) ? entry.viewerUrls.filter(Boolean) : []
      ));

      if (trimmedText) {
        const textFile = buildManualLibraryTextFile({
          title: effectiveSurveyTitle,
          text: trimmedText,
        });
        const result = await uploadDocLibraryFileUntyped({
          file: textFile,
          sessionSlug: resolvedSessionSlug || '',
          sessionConfig: resolvedSessionConfig,
          account,
          providerLike: provider,
          chainId: network?.id || null,
          tags: mergeTags(
            buildDocLibraryCommonTags({ kind: 'file', storage: 'lit-arweave' }),
            buildDocLibrarySessionTags({ sessionIdHex: resolvedSessionIdHex }),
          ),
          encryption: resolveDocSaveEncryption() as any,
        });
        const viewerUrl = buildSessionDocLibraryViewerUrlUntyped({
          sessionToken: docSaveSessionToken,
          txId: result?.txId,
          storage: result?.storage || 'lit-arweave',
          kind: result?.kind || 'file',
          name: textFile.name,
        });
        if (viewerUrl || result?.url) uploadedViewerUrls.push(viewerUrl || result?.url || '');
      }

      setDocumentURLs(uploadedViewerUrls);
      if (toStr(additionalUrlInput).trim()) setAdditionalUrlInput('');
      setSaveExtraSourcesToDocLibrary(false);
      notify.success(
        uploadedViewerUrls.length === 1
          ? 'Added to Session Doc Library.'
          : `Added ${uploadedViewerUrls.length} items to Session Doc Library.`
      );
    } catch (err: any) {
      if (!abortedRef.current) {
        setError(getErrorMessage(err, 'Failed to add content to the session doc library.'));
      }
    } finally {
      if (!abortedRef.current) {
        setLoading(false);
        setActiveAction('');
        setWaitingSeconds(0);
      }
    }
  };

  async function handleSubmit(e: any) {
    e.preventDefault();
    localStorage.removeItem('unfinishedSurvey');

    setError('');
    setShowCreateSurvey(false);
    setStatementsToUpload([]);
    setDocumentURLs([]);
    setSummaryMd('');
    setActiveAction('generate');

    let currentDocumentURLs: any[] = [];
    let content = '';
    const { queuedAdditionalSources, effectiveSources } = buildEffectiveAdditionalSources();
    if (additionalUrlInput && additionalUrlInput.trim()) setAdditionalUrlInput('');
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
        const photoSources = effectiveSources.filter((src: any) => src?.type === 'photo');
        const nonPhotoSources = effectiveSources.filter((src: any) => src?.type !== 'photo');
        const additionalContentSections: any[] = [];

        if (photoSources.length > 0) {
          photoSources.forEach((src: any) => {
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
        effectiveSources.forEach((src: any, idx: any) => {
          const queuedSource = idx < queuedAdditionalSources.length ? queuedAdditionalSources[idx] : null;
          const savedRef = idx < savedDocRefs.length ? savedDocRefs[idx] : null;
          if (savedRef?.viewerUrls?.length && queuedSource === src) {
            currentDocumentURLs.push(...savedRef.viewerUrls.filter(Boolean));
            return;
          }
          if (src.type === 'url') currentDocumentURLs.push(src.value);
        });
        const hasPrimaryTextInput = Boolean(pastedText && pastedText.trim().length > 0);
        const additionalSourcesAreAllUrls = effectiveSources.every((src: any) => src.type === 'url');
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

    } catch (err: any) {
      if (!abortedRef.current) {
        setError(getErrorMessage(err, 'Generation failed.'));
      }
    } finally {
      if (!abortedRef.current) {
        setLoading(false);
        setActiveAction('');
        setIsTranscribing(false);
        setWaitingSeconds(0);
      }
    }
  }

  function generateQuestionId(type: any, prompt: any, options: any = []) {
    return generateSharedQuestionId(type, prompt, options);
  }

  function renderCreateSurveyComponent() {
    if (!showCreateSurvey || statementsToUpload.length === 0) return null;
    const preformedSurvey = effectiveSurveyTitle ? { title: effectiveSurveyTitle } : null;

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
          onUploadComplete={(surveyHash: any) => {
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

  const toggleQuestionType = (type: any) => {
    setQuestionTypes((prev: any) => ({ ...prev, [type]: !prev[type] }));
  };

  const refreshAIPromptModelLabel = React.useCallback(async () => {
    try {
      const aiCfg = await getEffectiveAiConfigUntyped({
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
    setShowAIPrompt((prev: any) => {
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
      .catch((e: any) => { void e; notify.warn('Copy failed'); });
  };

  const highlightPromptVariables = (str: any) => {
    if (!str) return null;
    const text = String(str);
    const re = /<([A-Za-z][A-Za-z0-9_]*)>/g;
    const parts: any[] = [];
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

  const handleDatabaseSessionSelect = (slugIn: any) => {
    setLocalSessionOverrideTouched(true);
    setLocalSessionOverrideSlug(normalizeSessionSlug(slugIn || ''));
  };

  const resetDatabaseSessionSelection = () => {
    setLocalSessionOverrideTouched(false);
    setLocalSessionOverrideSlug(null);
  };

  const hasGenerateInputContent = hasDatabaseToolInputContent({
    pastedText,
    additionalUrlInput,
    additionalSources,
    audioFile,
  });
  const shouldShowGenerateButton = hasGenerateInputContent || (loading && activeAction === 'generate');
  const hasAddToLibraryInputContent = isManualLibraryUploadableContent({
    pastedText,
    additionalUrlInput,
    additionalSources,
  });
  const shouldShowAddToLibraryButton = hasAddToLibraryInputContent || (loading && activeAction === 'library');
  const queuedPhotoSources = useMemo(
    () => additionalSources.filter((source: any) => source?.type === 'photo'),
    [additionalSources],
  );
  const queuedNonPhotoSources = useMemo(
    () => additionalSources.filter((source: any) => source?.type !== 'photo'),
    [additionalSources],
  );
  const hasUploadedFileSources = useMemo(
    () => Boolean(audioFile) || additionalSources.some((source: any) => source?.type === 'file' || source?.type === 'photo'),
    [additionalSources, audioFile],
  );
  const effectiveSurveyTitle = hasUploadedFileSources ? toStr(surveyTitle).trim() : '';
  const shouldShowSaveExtraSourcesControl = additionalSources.length > 0;
  const saveDocAudienceLabel = saveDocAudience === 'session' && docSaveSessionAudienceAvailable
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
                onChange={(event: any) => setShowDemoCorpusView(event.target.checked)}
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
            showUploadControls={false}
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
            onClick={() => setShowSessionSelector((value: any) => !value)}
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
              <SessionChipSelectorUntyped
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
          {hasUploadedFileSources ? (
            <div className={styles.titleInputRow}>
              <Input
                type="text"
                value={surveyTitle}
                onChange={(event: any) => setSurveyTitle(event.target.value)}
                placeholder="Title"
                className={styles.titleInput}
                data-testid={E2E_TESTIDS.DATABASE_TITLE_INPUT}
              />
            </div>
          ) : null}

          <div className={styles.textInputGroup}>
            <AudioInputUntyped
              placeholder={transcriptMode ? "Speak to capture transcript or Paste Text..." : "Speak or type text here..."}
              recordingDisabled={transcriptMode}
              longFormMode={transcriptMode}
              showRecorderControlsInTextbox={transcriptMode}
              showRecordingTimerInTextbox={transcriptMode}
              enableDownloads={transcriptMode}
              updateFunction={(val: any) => setPastedText(val)}
              toggleEncryption={(bool: any) => setTextEncrypted(bool)}
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
                onChange={(e: any) => {
                  setAdditionalUrlInput(e.target.value);
                  setImagePickerStatusText('');
                  setImagePickerStatusTone('default');
                }}
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

          <div className={styles.imageSourceSection}>
            <CompactImageChooser
              className={styles.imageChooser}
              rootTestId={E2E_TESTIDS.DATABASE_IMAGE_CHOOSER}
              pasteButtonTestId={E2E_TESTIDS.DATABASE_IMAGE_PASTE}
              uploadButtonTestId={E2E_TESTIDS.DATABASE_IMAGE_UPLOAD}
              fileInputTestId={E2E_TESTIDS.DATABASE_IMAGE_FILE_INPUT}
              showUrlModeButton={false}
              isUrlMode={false}
              isUploadMode
              showUrlInput={false}
              onPaste={handleImagePickerPaste}
              onUploadClick={handleImagePickerUploadClick}
              onFileChange={handleAdditionalSourceUpload}
              fileInputRef={imagePickerInputRef}
              accept={SUPPORTED_SOURCE_UPLOAD_ACCEPT}
              multiple
              statusText={imagePickerStatusText}
              statusTone={imagePickerStatusTone}
              uploadAriaLabel="Upload file or image"
            />
          </div>

          {(additionalSources.length > 0 || shouldShowAddToLibraryButton || (transcriptMode && uploadSummaryToArweave && encryptSummary)) && (
            <div className={styles.additionalContextSection}>
              {queuedPhotoSources.length > 0 && (
                <div className={styles.photoCardGrid}>
                  {queuedPhotoSources.map((item: any) => {
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
                  {queuedNonPhotoSources.map((item: any) => (
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

              {(shouldShowSaveExtraSourcesControl || shouldShowAddToLibraryButton) && (
                <div className={styles.docSaveRow}>
                  {shouldShowSaveExtraSourcesControl ? (
                    <label className={styles.docSaveToggle} htmlFor={E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}>
                      <input
                        id={E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}
                        type="checkbox"
                        checked={saveExtraSourcesToDocLibrary}
                        onChange={(event: any) => {
                          setSaveExtraSourcesToDocLibrary(event.target.checked);
                          if (!event.target.checked && !shouldShowAddToLibraryButton) {
                            setShowSaveDocAudienceMenu(false);
                          }
                        }}
                        data-testid={E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}
                      />
                      <span>Generate flow also saves to Session Doc Library</span>
                    </label>
                  ) : null}

                  <div className={styles.docSaveAudienceWrap}>
                    <button
                      type="button"
                      className={styles.docSaveAudienceButton}
                      onClick={() => setShowSaveDocAudienceMenu((value: any) => !value)}
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

                        {docSaveSessionAudienceAvailable ? (
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
                            {docSaveSessionChainError
                              ? docSaveSessionChainError
                              : (
                                <>
                                  Session <code>docUploads</code> gate unavailable. Saved docs will stay private to your wallet.
                                </>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {queuedPhotoSources.length > 0 ? (
                    <label className={styles.docSaveToggle} htmlFor={E2E_TESTIDS.DATABASE_LIBRARY_ANALYZE_TOGGLE}>
                      <input
                        id={E2E_TESTIDS.DATABASE_LIBRARY_ANALYZE_TOGGLE}
                        type="checkbox"
                        checked={analyzeBeforeLibraryUpload}
                        onChange={(event: any) => setAnalyzeBeforeLibraryUpload(event.target.checked)}
                        data-testid={E2E_TESTIDS.DATABASE_LIBRARY_ANALYZE_TOGGLE}
                      />
                      <span>Analyze images before upload</span>
                    </label>
                  ) : null}
                </div>
              )}

              {transcriptMode && uploadSummaryToArweave && encryptSummary && (
                <div className={styles.litGateRow}>
                  <SBTSelector
                    id="summary-encryption"
                    label="SBTs that can decrypt the summary"
                    selectedSBTs={summaryGateSBTs}
                    onAddSBT={(sbt: any) => setSummaryGateSBTs((prev: any) => [...prev, sbt])}
                    onRemoveSBT={(address: any) =>
                      setSummaryGateSBTs((prev: any) =>
                        prev.filter((item: any) => String(item.address || '').toLowerCase() !== String(address || '').toLowerCase())
                      )
                    }
                    network={network}
                    sessionSlug={resolvedSessionSlug || ''}
                    defaultFeaturedSBTs={(resolvedSessionConfig as any)?.defaultFeaturedSBTs || []}
                    enableGroupSelect
                    variant="create"
                  />
                  <FormGroup className={styles.litGateMode}>
                    <Label>Gate mode</Label>
                    <Input
                      type="select"
                      value={summaryGateMode}
                      onChange={(e: any) => setSummaryGateMode(e.target.value)}
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

        {(shouldShowGenerateButton || shouldShowAddToLibraryButton) && (
          <div className={styles.actionRow}>
            {shouldShowGenerateButton ? (
              <Button
                type="submit"
                className={styles.generateButton}
                disabled={loading}
              >
                {loading && activeAction === 'generate' ? (
                  <>
                    {isTranscribing ? 'Transcribing... ' : 'Processing... '}
                    {waitingSeconds}s <FontAwesomeIcon icon={faSpinner} spin />
                  </>
                ) : (
                  'Generate Questions'
                )}
              </Button>
            ) : null}

            {shouldShowAddToLibraryButton ? (
              <Button
                type="button"
                color="secondary"
                className={styles.libraryButton}
                onClick={handleAddToLibrary}
                disabled={loading}
                data-testid={E2E_TESTIDS.DATABASE_ADD_LIBRARY_BUTTON}
              >
                {loading && activeAction === 'library' ? (
                  <>
                    Adding to Library... {waitingSeconds}s <FontAwesomeIcon icon={faSpinner} spin />
                  </>
                ) : (
                  'Add to Library'
                )}
              </Button>
            ) : null}
          </div>
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
