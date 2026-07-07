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
  faImage,
} from '@fortawesome/free-solid-svg-icons';
import { Input, Button, FormGroup, Label } from 'reactstrap';
import styles from './AudioSurveyGenerator.module.scss';

import {
  callAI,
  transcribeAudio,
  generateAudioDiscussionSummary,
  uploadMarkdownSummaryToArweave,
  processAdditionalSources,
  fetchContentFromURL,
  analyzePhotoForQuestionGeneration,
} from '../../../utilities/ai/aiScripts.js';
import { getEffectiveAiConfig } from '../../../utilities/ai/aiSettings.js';
import { getAllSessionSlugs, getSessionConfigBySlug } from '../../../utilities/web3/contractScripts.js';
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
import type {
  SessionConfig as SurveyGeneratorSessionConfig,
  UnknownRecord,
} from '../../../utilities/session/sessionTypes';
import { createLogger } from 'utilities/logging.js';
import { toStr } from '../../../utilities/shared/primitives.js';
import { generateQuestionId as generateSharedQuestionId } from '../../../utilities/shared/questionUtils.mjs';
import { notify } from '../../../utilities/ui/notify.js';
import { fetchImageFromURL } from '../../../utilities/ui/imageFetchClient.js';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import {
  MAX_QUESTION_COUNT,
  MIN_QUESTION_COUNT,
  PHOTO_ANALYSIS_STATUS_LABELS,
  SURVEY_GENERATOR_AI_PROMPT_ICON_STYLE,
  SURVEY_GENERATOR_ERROR_STYLE,
  SURVEY_GENERATOR_TEXT_INPUT_STYLE,
  SUPPORTED_SOURCE_UPLOAD_ACCEPT,
  buildAdditionalSourceId,
  buildEffectiveAdditionalSourceList,
  buildGeneratedSurveyStatements,
  buildPhotoAnalysisFilename,
  buildPhotoAnalysisMarkdown,
  buildQueuedPhotoSourceBatch,
  buildQueuedUploadedSourceBatch,
  buildSingleGenerationPrompt,
  buildSurveyGeneratorDocSaveAudienceOptionClassName,
  buildSurveyGeneratorAiPromptCopyClassName,
  buildSurveyGeneratorPhotoStatusChipClassName,
  buildSurveyGeneratorPhotoStatusToggleClassName,
  buildSurveyGeneratorTranscriptToggleClassName,
  buildSurveyGeneratorTypeButtonClassName,
  buildSurveyGeneratorTypePillClassName,
  buildUnsupportedPhotoMessage,
  buildUnsupportedSourceMessage,
  buildPhotoPreviewUrl,
  clampQuestionCount,
  formatAiPromptModelLabel,
  getSurveyGeneratorErrorMessage,
  getPhotoStatusLabel,
  hasDatabaseToolInputContent,
  isLikelyImageUrl,
  isSingleHttpUrlInput,
  isSupportedAdditionalFile,
  isSupportedPhotoFile,
  renameFileForLibraryUpload,
  revokePhotoPreviewUrl,
} from './surveyGeneratorHelpers';
import type {
  GeneratedAiQuestionPayload,
  GeneratedSurveyStatement,
  GenerationPromptOverrides,
  QuestionTypeSelection,
  QueuedFileSource,
  QueuedPhotoSource,
  QueuedUrlSource,
  SourceFileLike,
} from './surveyGeneratorHelpers';

export { hasDatabaseToolInputContent, isSingleHttpUrlInput } from './surveyGeneratorHelpers';

const cacheLog = createLogger('cache');
const DEFAULT_QUESTION_COUNT = 10;
const QUESTION_COUNT_STEP = 5;
const CONTEXT_SAVE_LOGIN_REQUIRED_CODE = 'context_save_login_required';
const generateSurveyGeneratorQuestionId = (type: string, prompt: string, options: string[] = []): string => {
  return generateSharedQuestionId(type, prompt, options);
};
type SurveyGeneratorQuestionTypeKey = 'binary' | 'multichoice' | 'rating' | 'freeform';
type SurveyGeneratorGateMode = 'any' | 'all';
type SurveyGeneratorNetwork = UnknownRecord & {
  id?: string | number | null;
};
type ResourceKeyProviderLike = string | UnknownRecord | null | undefined;
type SurveyGeneratorLitHooks = UnknownRecord & {
  getKey?: (...args: unknown[]) => unknown;
  saveKey?: (...args: unknown[]) => Promise<unknown>;
  litNetwork?: string;
  connectTimeout?: unknown;
  providerLike?: unknown;
  resourceAbilityRequests?: unknown;
};
type SurveyGeneratorProps = UnknownRecord & {
  provider?: unknown;
  network?: SurveyGeneratorNetwork | null;
  account?: string;
  loginComplete?: boolean;
  toggleLoginModal?: (open?: boolean) => void;
  minified?: boolean;
  defaultTags?: string | Array<string | null | undefined | false | ''> | null;
  onQuestionsGenerated?: (statements: GeneratedSurveyStatement[], docs: string[], surveyTitle: string) => void;
  hideEncryption?: boolean;
  sessionConfig?: UnknownRecord | null;
  activeSessionSlug?: string;
  contracts?: unknown;
  explorerMode?: string;
  demoSurfaceMode?: unknown;
  sessionOverrideSlug?: string | null;
  sessionOverrideTouched?: boolean;
  hideInternalSessionSelector?: boolean;
  litHooks?: unknown;
};
type SurveyGeneratorDocSaveEncryption = {
  enabled: boolean;
  recipientType?: string;
  mode?: string;
  selfRecipient?: boolean;
  saveKey?: unknown;
  accessControlConditions?: unknown;
  litChain?: unknown;
  chainId?: unknown;
  litNetwork?: unknown;
  connectTimeout?: unknown;
  providerLike?: unknown;
  resourceAbilityRequests?: unknown;
  contextLabel?: string;
};
type SurveyGeneratorSbtSelection = {
  address?: string;
  name?: string;
  [key: string]: unknown;
};
type SurveyGeneratorSessionOption = {
  key: string;
  slug: string;
  label: string;
  selected: boolean;
  general: boolean;
  primary: boolean;
  chipTestId: string;
};
type SurveyGeneratorPhotoStatus = keyof typeof PHOTO_ANALYSIS_STATUS_LABELS;
type SurveyGeneratorPhotoSource = Omit<
  QueuedPhotoSource<SourceFileLike>,
  'analysisStatus' | 'analysisError' | 'analysisText' | 'analysisExpanded'
> & {
  analysisStatus?: SurveyGeneratorPhotoStatus;
  analysisError?: string;
  analysisText?: string;
  analysisExpanded?: boolean;
};
type SurveyGeneratorFileSource = QueuedFileSource<SourceFileLike>;
type SurveyGeneratorAdditionalSource = SurveyGeneratorFileSource | SurveyGeneratorPhotoSource | QueuedUrlSource;
type SurveyGeneratorNonPhotoSource = Exclude<SurveyGeneratorAdditionalSource, SurveyGeneratorPhotoSource>;
type SurveyGeneratorAdditionalSourcesResult = {
  effectiveSources: SurveyGeneratorAdditionalSource[];
  queuedAdditionalSources: SurveyGeneratorAdditionalSource[];
};
type PhotoAnalysisBySourceId = Map<string, string>;
type UploadedSourceDocRef = {
  sourceId: string;
  viewerUrls: string[];
};
type DocLibraryUploadResult = {
  txId?: string;
  url?: string;
  storage?: string;
  kind?: string;
  [key: string]: unknown;
};
type DocLibraryUploadArgsBase = {
  sessionSlug?: string;
  sessionConfig?: unknown;
  account?: unknown;
  providerLike?: unknown;
  chainId?: unknown;
  tags?: unknown;
  encryption?: SurveyGeneratorDocSaveEncryption | null;
};
type DocLibraryFileUploadArgs = DocLibraryUploadArgsBase & {
  file?: unknown;
};
type DocLibraryUrlRecordUploadArgs = DocLibraryUploadArgsBase & {
  url?: unknown;
  title?: unknown;
};
type BuildSessionDocLibraryViewerUrlArgs = {
  sessionToken?: unknown;
  txId?: unknown;
  storage?: unknown;
  kind?: unknown;
  name?: unknown;
};
type GetEffectiveAiConfigArgs = {
  sessionSlug?: unknown;
  context?: unknown;
  resolveSecrets?: boolean;
};
type EffectiveAiConfig = {
  provider?: unknown;
  model?: unknown;
  [key: string]: unknown;
};
const uploadDocLibraryFileForGenerator = uploadDocLibraryFile as (
  args?: DocLibraryFileUploadArgs,
) => Promise<DocLibraryUploadResult>;
const uploadDocLibraryUrlRecordForGenerator = uploadDocLibraryUrlRecord as (
  args?: DocLibraryUrlRecordUploadArgs,
) => Promise<DocLibraryUploadResult>;
const buildSessionDocLibraryViewerUrlForGenerator = buildSessionDocLibraryViewerUrl as (
  args?: BuildSessionDocLibraryViewerUrlArgs,
) => string;
const getEffectiveAiConfigForGenerator = getEffectiveAiConfig as (
  args?: GetEffectiveAiConfigArgs,
) => Promise<EffectiveAiConfig>;
type UploadSourcesToDocLibraryArgs = {
  sources?: SurveyGeneratorAdditionalSource[];
  photoAnalysisBySourceId?: PhotoAnalysisBySourceId;
  includePhotoAnalysis?: boolean;
  titleOverride?: string;
};
type SurveyGeneratorAdditionalSourcePatch =
  | Partial<SurveyGeneratorAdditionalSource>
  | ((source: SurveyGeneratorAdditionalSource) => Partial<SurveyGeneratorAdditionalSource>);
type QueuedPhotoPreviewProps = {
  file?: unknown;
  photoName?: unknown;
  sourceId?: unknown;
};

const asSurveyGeneratorPlainRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : null;

function QueuedPhotoPreview({ file, photoName, sourceId }: QueuedPhotoPreviewProps) {
  const [previewSrc] = useState<string>(() => buildPhotoPreviewUrl(file));

  useEffect(() => {
    return () => {
      revokePhotoPreviewUrl(previewSrc);
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

// Dev-only logger
const debug = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') cacheLog.log(...args);
};

const LazyCorpusViewer = React.lazy(() => import('../../DemoViews/CorpusViewer'));

export default function AudioSurveyGenerator(rawProps: SurveyGeneratorProps = {} as SurveyGeneratorProps) {
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
    litHooks: scopedLitHooks,
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
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // AI Prompt Panel State
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [aiPromptLoaded, setAiPromptLoaded] = useState(false);
  const [aiPromptCopySuccess, setAiPromptCopySuccess] = useState(false);
  const [aiPromptModelLabel, setAiPromptModelLabel] = useState('Configured model');

  const [questionTypes, setQuestionTypes] = useState<QuestionTypeSelection>({
    // defaults
    binary: true,
    multichoice: true,
    rating: false,
    freeform: false,
  });
  const [count, setCount] = useState(DEFAULT_QUESTION_COUNT);

  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState('');
  const [error, setError] = useState('');
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const waitTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [surveyTitle, setSurveyTitle] = useState('');
  const [statementsToUpload, setStatementsToUpload] = useState<GeneratedSurveyStatement[]>([]);
  const [showCreateSurvey, setShowCreateSurvey] = useState(false);
  const [documentURLs, setDocumentURLs] = useState<string[]>([]);

  // AUDIO summary-first flow state
  const [summaryMd, setSummaryMd] = useState('');

  const [showSessionSelector, setShowSessionSelector] = useState(false);
  const [localSessionOverrideSlug, setLocalSessionOverrideSlug] = useState<string | null>(null);
  const [localSessionOverrideTouched, setLocalSessionOverrideTouched] = useState(false);
  const hasControlledSessionOverride =
    Object.prototype.hasOwnProperty.call(rawProps, 'sessionOverrideSlug') ||
    Object.prototype.hasOwnProperty.call(rawProps, 'sessionOverrideTouched') ||
    Object.prototype.hasOwnProperty.call(rawProps, 'hideInternalSessionSelector');
  const demoSurfaceEnabled = demoSurfaceMode !== false;
  const [showDemoCorpusView, setShowDemoCorpusView] = useState(demoSurfaceEnabled);

  // Multi-source State
  const [additionalSources, setAdditionalSources] = useState<SurveyGeneratorAdditionalSource[]>([]);
  const [additionalUrlInput, setAdditionalUrlInput] = useState('');
  const imagePickerInputRef = useRef<HTMLInputElement | null>(null);
  const additionalSourceIdRef = useRef(0);
  const [saveExtraSourcesToDocLibrary, setSaveExtraSourcesToDocLibrary] = useState(false);
  const [saveDocAudience, setSaveDocAudience] = useState('self');
  const [showSaveDocAudienceMenu, setShowSaveDocAudienceMenu] = useState(false);
  const [analyzeBeforeLibraryUpload, setAnalyzeBeforeLibraryUpload] = useState(true);
  const getActiveLitHooks = React.useCallback(
    (): SurveyGeneratorLitHooks | null =>
      (scopedLitHooks && typeof scopedLitHooks === 'object' ? (scopedLitHooks as SurveyGeneratorLitHooks) : null) ||
      (getGlobalLitHooks() as SurveyGeneratorLitHooks | null),
    [scopedLitHooks],
  );
  const [imagePickerStatusText, setImagePickerStatusText] = useState('');
  const [imagePickerStatusTone, setImagePickerStatusTone] = useState<'default' | 'loading' | 'error'>('default');

  const [summaryGateSBTs, setSummaryGateSBTs] = useState<SurveyGeneratorSbtSelection[]>([]);
  const [summaryGateMode, setSummaryGateMode] = useState<SurveyGeneratorGateMode>('any');
  const lastSummaryGateKeyRef = useRef('');
  const controlledSessionTouched = Boolean(sessionOverrideTouched);

  const effectiveSessionSlugInput = useMemo(
    () =>
      hasControlledSessionOverride
        ? controlledSessionTouched
          ? normalizeSessionSlug(sessionOverrideSlug || '')
          : activeSessionSlug
        : localSessionOverrideTouched
          ? normalizeSessionSlug(localSessionOverrideSlug || '')
          : activeSessionSlug,
    [
      activeSessionSlug,
      controlledSessionTouched,
      hasControlledSessionOverride,
      localSessionOverrideSlug,
      localSessionOverrideTouched,
      sessionOverrideSlug,
    ],
  );
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
  const resolvedSessionAliases = useMemo(
    () =>
      resolveSessionConfigAliases(
        {
          sessionSlug: effectiveSessionSlugInput,
          sessionConfig: effectiveSessionConfigInput,
        },
        {
          resolveBySlug: (slug: string) => getSessionConfigBySlug(slug),
        },
      ),
    [effectiveSessionConfigInput, effectiveSessionSlugInput],
  );
  const resolvedSessionSlug = resolvedSessionAliases.sessionSlug;
  const resolvedSessionConfig = useMemo<SurveyGeneratorSessionConfig>(() => {
    const cfg = asSurveyGeneratorPlainRecord(resolvedSessionAliases.sessionConfig) || {};
    const slug = normalizeSessionSlug(cfg.slug || resolvedSessionAliases.sessionSlug || '');
    return {
      ...cfg,
      slug,
      contracts: mergeSessionContractMaps(cfg.contracts, contracts),
    };
  }, [resolvedSessionAliases.sessionConfig, resolvedSessionAliases.sessionSlug, contracts]);
  const resolvedSessionIdHex = useMemo(
    () =>
      normalizeSessionIdHex(
        resolvedSessionConfig?.__registry?.sessionIdHex ||
          resolvedSessionConfig?.__registry?.sessionId ||
          resolvedSessionConfig?.sessionIdHex ||
          resolvedSessionConfig?.sessionId ||
          '',
      ),
    [resolvedSessionConfig],
  );
  const resolvedSessionIdToken = useMemo(
    () => toStr(resolvedSessionConfig?.__registry?.sessionId || resolvedSessionConfig?.sessionId || '').trim(),
    [resolvedSessionConfig],
  );
  const docSaveSessionToken = useMemo(
    () => resolvedSessionIdToken || resolvedSessionSlug || '',
    [resolvedSessionIdToken, resolvedSessionSlug],
  );
  const networkChainId = network?.id || null;
  const docSaveGate = useMemo(() => resolveDocUploadsGate(resolvedSessionConfig), [resolvedSessionConfig]);
  const docSaveSessionLabel = useMemo(() => {
    const sessionName = toStr(resolvedSessionConfig?.sessionName).trim();
    if (sessionName) return sessionName;
    const slug = toStr(resolvedSessionSlug).trim();
    if (slug) return slug;
    return 'Session';
  }, [resolvedSessionConfig, resolvedSessionSlug]);
  const aiRequestOptions = useMemo(
    () => ({
      sessionSlug: resolvedSessionSlug || '',
      sessionConfig: resolvedSessionConfig,
      context: {
        account,
        providerLike: provider,
        chainId: networkChainId,
      },
    }),
    [resolvedSessionSlug, resolvedSessionConfig, account, provider, networkChainId],
  );

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
  const summaryGateKey = summaryGateAddresses
    .map((addr) => addr.toLowerCase())
    .sort()
    .join('|');
  const sessionHasLitChipotle = useMemo(() => {
    const litCredentials = asSurveyGeneratorPlainRecord(resolvedSessionConfig?.litCredentials);
    const hasCompleteLitCredentials = !!(
      litCredentials &&
      toStr(litCredentials?.litApiBase).trim() &&
      toStr(litCredentials?.litActionCid).trim() &&
      toStr(litCredentials?.litPkpId).trim()
    );
    const litConfig = asSurveyGeneratorPlainRecord(resolvedSessionConfig?.lit);
    const litNetworkHint = toStr(litConfig?.network || resolvedSessionConfig?.litNetwork)
      .trim()
      .toLowerCase();
    return !!(
      toStr(resolvedSessionConfig?.corsWorkerUrl).trim() &&
      (hasCompleteLitCredentials ||
        litNetworkHint === 'chipotle' ||
        docSaveGate.hasRecipients ||
        summaryGateAddresses.length > 0)
    );
  }, [docSaveGate.hasRecipients, resolvedSessionConfig, summaryGateAddresses.length]);
  const docSaveSessionChainError = useMemo(
    () =>
      docSaveGate.hasRecipients && !sessionHasLitChipotle
        ? getUnsupportedLitContractAccessControlError({
            chainId: docSaveGate.chainId || networkChainId || null,
          })
        : '',
    [docSaveGate.chainId, docSaveGate.hasRecipients, networkChainId, sessionHasLitChipotle],
  );
  const docSaveSessionAudienceAvailable = docSaveGate.hasRecipients && !docSaveSessionChainError;
  const activeSessionKey = useMemo(() => {
    const hasExplicit = typeof effectiveSessionSlugInput === 'string';
    if (!hasExplicit) return null;
    return normalizeSessionSlug(effectiveSessionSlugInput ?? '');
  }, [effectiveSessionSlugInput]);
  const sessionSelectorOptions: SurveyGeneratorSessionOption[] = useMemo(() => {
    const selectedSlug = normalizeSessionSlug(resolvedSessionSlug || activeSessionSlug || '');
    const options = new Map<string, SurveyGeneratorSessionOption>();
    const pushOption = (slugIn: unknown = '') => {
      const slug = normalizeSessionSlug(slugIn || '');
      const cfg = getSessionConfigBySlug(slug) || {};
      const sessionName = toStr(cfg?.sessionName || '').trim();
      const slugLabel = slug || 'General';
      const label =
        sessionName && sessionName.toLowerCase() !== slugLabel.toLowerCase()
          ? `${sessionName} (${slugLabel})`
          : sessionName || slugLabel;
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
  const summaryGateSessionKey =
    activeSessionKey != null ? activeSessionKey : configSessionKey != null ? configSessionKey : '';
  const summaryGateMismatch =
    activeSessionKey != null && configSessionKey != null && activeSessionKey !== configSessionKey;
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

  const abortedRef = React.useRef(false);
  useEffect(() => {
    abortedRef.current = false;
    return () => {
      abortedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (loading && !waitTimerRef.current) {
      setWaitingSeconds(0);
      waitTimerRef.current = setInterval(() => setWaitingSeconds((s: number) => s + 1), 1000);
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
    setTranscriptMode((prev: boolean) => {
      const newVal = !prev;
      if (!newVal) {
        setAudioFile(null);
        setSummaryMd('');
      }
      return newVal;
    });
  };

  function buildSinglePrompt(sourceDocContent: unknown, overrides: GenerationPromptOverrides = {}) {
    return buildSingleGenerationPrompt({
      promptTemplate: seedGenPrompt,
      sourceDocContent,
      count,
      questionTypes,
      defaultTags,
      transcriptMode,
      overrides,
      sessionInstructions: resolvedSessionConfig?.questionsGenPrompt || '',
    });
  }

  async function makeSingleAiCall(
    sourceDocContent: unknown,
    overrides: GenerationPromptOverrides = {},
    requestedCount: number = count,
  ) {
    const prompt = buildSinglePrompt(sourceDocContent, overrides);
    const raw = await callAI(prompt, aiRequestOptions);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in AI response');
    const parsed = JSON.parse(match[0]) as GeneratedAiQuestionPayload;
    if (!Array.isArray(parsed.questions)) throw new Error('AI response missing "questions" array');
    const expectedCount = Number(requestedCount);
    if (Number.isInteger(expectedCount) && expectedCount > 0 && parsed.questions.length !== expectedCount) {
      cacheLog.warn('[AudioSurveyGenerator] AI returned question count mismatch', {
        requestedCount: expectedCount,
        returnedCount: parsed.questions.length,
      });
    }
    return parsed;
  }

  function processAndSetQuestions(
    aiData: GeneratedAiQuestionPayload,
    docs: string[],
    fallbackTitle: string = effectiveSurveyTitle,
  ) {
    const { statements, surveyTitle } = buildGeneratedSurveyStatements({
      aiData,
      questionTypes,
      count,
      fallbackTitle,
      generateQuestionId: generateSurveyGeneratorQuestionId,
    });
    setStatementsToUpload(statements);
    setSurveyTitle(surveyTitle);
    setDocumentURLs(docs);

    if (typeof onQuestionsGenerated === 'function') {
      onQuestionsGenerated(statements, docs, surveyTitle);
    }
  }

  const queueAdditionalUrlSource = (rawUrl: string) => {
    setAdditionalSources((prev) => [
      ...prev,
      {
        id: buildAdditionalSourceId(additionalSourceIdRef),
        type: 'url',
        value: rawUrl,
        name: rawUrl,
      },
    ]);
    setError('');
    setAdditionalUrlInput('');
    setImagePickerStatusText('');
    setImagePickerStatusTone('default');
  };

  const addAdditionalUrl = async () => {
    const rawUrl = toStr(additionalUrlInput).trim();
    if (!rawUrl) return;

    if (isLikelyImageUrl(rawUrl)) {
      try {
        const file = await fetchImageFromURL(rawUrl);
        if (abortedRef.current) return;
        const { validFiles } = queueAdditionalPhotoFiles([file]);
        if (validFiles.length === 0) {
          queueAdditionalUrlSource(rawUrl);
          return;
        }
        setAdditionalUrlInput('');
        setImagePickerStatusText('');
        setImagePickerStatusTone('default');
        return;
      } catch (err: unknown) {
        setError(getSurveyGeneratorErrorMessage(err, 'Image URL could not be loaded.'));
        return;
      }
    }

    queueAdditionalUrlSource(rawUrl);
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAdditionalUrl();
    }
  };

  const adjustQuestionCount = (delta: number) => {
    setCount((previousCount: number) => clampQuestionCount(previousCount + delta));
  };

  const queueAdditionalPhotoFiles = (files: SourceFileLike | SourceFileLike[] = []) => {
    const { invalidCount, nextSources, validFiles } = buildQueuedPhotoSourceBatch(files, additionalSourceIdRef);

    if (validFiles.length > 0) {
      setAdditionalSources((prev) => [...prev, ...nextSources]);
    }

    if (invalidCount > 0) {
      setError(buildUnsupportedPhotoMessage(invalidCount));
    } else if (validFiles.length > 0) {
      setError('');
    }
    return { validFiles, invalidCount };
  };

  const queueAdditionalUploadedFiles = (files: SourceFileLike | SourceFileLike[] = []) => {
    const { nextSources, invalidCount } = buildQueuedUploadedSourceBatch(files, additionalSourceIdRef);

    if (nextSources.length > 0) {
      setAdditionalSources((prev) => [...prev, ...nextSources]);
    }

    if (invalidCount > 0) {
      setError(buildUnsupportedSourceMessage(invalidCount));
    } else if (nextSources.length > 0) {
      setError('');
    }

    return { nextSources, invalidCount };
  };

  const handleAdditionalSourceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const removeAdditionalSource = (sourceId: string) => {
    setAdditionalSources((prev) => prev.filter((source) => source?.id !== sourceId));
  };

  const updateAdditionalSourceById = (sourceId: string, patch: SurveyGeneratorAdditionalSourcePatch) => {
    setAdditionalSources((prev) =>
      prev.map((source) =>
        source?.id === sourceId
          ? ({
              ...source,
              ...(typeof patch === 'function' ? patch(source) : patch),
            } as SurveyGeneratorAdditionalSource)
          : source,
      ),
    );
  };

  const analyzeQueuedPhotoSources = async (sources: SurveyGeneratorAdditionalSource[] = []) => {
    const queuedSources = Array.isArray(sources) ? sources : [];
    const analysisBySourceId: PhotoAnalysisBySourceId = new Map();
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
      } catch (err: unknown) {
        const message = getSurveyGeneratorErrorMessage(err, 'Photo analysis failed.');
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

  const togglePhotoAnalysisExpanded = (sourceId: string) => {
    updateAdditionalSourceById(sourceId, (source) => ({
      analysisExpanded: source.type === 'photo' ? !source.analysisExpanded : true,
    }));
  };

  const resolveDocSaveEncryption = (): SurveyGeneratorDocSaveEncryption => {
    const fallbackChainId = Number(network?.id || 0) || null;
    if (saveDocAudience === 'session') {
      const litHooks = getActiveLitHooks();
      if (!litHooks || typeof litHooks.saveKey !== 'function') {
        throw new Error('Connect a wallet to add sources to session context.');
      }
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
        ...(litHooks.litNetwork ? { litNetwork: litHooks.litNetwork } : {}),
        ...(litHooks.connectTimeout ? { connectTimeout: litHooks.connectTimeout } : {}),
        ...(litHooks.providerLike ? { providerLike: litHooks.providerLike } : {}),
        ...(litHooks.resourceAbilityRequests ? { resourceAbilityRequests: litHooks.resourceAbilityRequests } : {}),
        contextLabel: `doc:${resolvedSessionSlug || ''}`,
      };
    }

    if (!toStr(account).trim()) {
      throw new Error('Connect a wallet to save private doc sources.');
    }
    if (!fallbackChainId) {
      throw new Error('Connected wallet chain is unavailable for private doc save.');
    }

    return {
      enabled: true,
      recipientType: 'self-eip712-v1',
      mode: 'self',
      selfRecipient: true,
      chainId: fallbackChainId,
      contextLabel: `doc-self:${resolvedSessionSlug || ''}`,
    };
  };

  const uploadSourcesToDocLibrary = async ({
    sources = [],
    photoAnalysisBySourceId = new Map(),
    includePhotoAnalysis = true,
    titleOverride = '',
  }: UploadSourcesToDocLibraryArgs = {}) => {
    const queuedSources = Array.isArray(sources) ? sources : [];
    const encryption = resolveDocSaveEncryption();
    const savedViewerUrls: UploadedSourceDocRef[] = [];
    const singleSourceTitle = queuedSources.length === 1 ? toStr(titleOverride).trim() : '';

    for (const source of queuedSources) {
      if (abortedRef.current) break;

      const isUrlSource = source?.type === 'url';
      const isPhotoSource = source?.type === 'photo';
      const kind = isUrlSource ? 'link' : 'file';
      const baseTags = mergeTags(
        buildDocLibraryCommonTags({ kind, storage: 'lit-arweave' }),
        buildDocLibrarySessionTags({ sessionIdHex: resolvedSessionIdHex }),
        isPhotoSource ? buildDocLibraryRoleTags({ role: DOC_LIBRARY_DOC_ROLES.PHOTO }) : [],
      );

      let result: DocLibraryUploadResult | null = null;
      const viewerUrls: string[] = [];
      if (isUrlSource) {
        result = await uploadDocLibraryUrlRecordForGenerator({
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
          },
        });
      } else {
        result = await uploadDocLibraryFileForGenerator({
          file: singleSourceTitle ? renameFileForLibraryUpload(source?.value, singleSourceTitle) : source?.value,
          sessionSlug: resolvedSessionSlug || '',
          sessionConfig: resolvedSessionConfig,
          account,
          providerLike: provider,
          chainId: network?.id || null,
          tags: baseTags,
          encryption,
        });
      }
      if (abortedRef.current) break;

      const viewerUrl = buildSessionDocLibraryViewerUrlForGenerator({
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
          if (abortedRef.current) break;

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
          const analysisResult = await uploadDocLibraryFileForGenerator({
            file: analysisFile,
            sessionSlug: resolvedSessionSlug || '',
            sessionConfig: resolvedSessionConfig,
            account,
            providerLike: provider,
            chainId: network?.id || null,
            tags: analysisTags,
            encryption,
          });
          if (abortedRef.current) break;

          const analysisViewerUrl = buildSessionDocLibraryViewerUrlForGenerator({
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

  const saveQueuedSourcesToDocLibrary = async (
    sources: SurveyGeneratorAdditionalSource[] = [],
    photoAnalysisBySourceId: PhotoAnalysisBySourceId = new Map(),
  ) => {
    const queuedSources = Array.isArray(sources) ? sources : [];
    if (!saveExtraSourcesToDocLibrary || queuedSources.length === 0) return [];
    if (abortedRef.current) return [];
    if (!loginComplete) {
      if (typeof toggleLoginModal === 'function') {
        toggleLoginModal(true);
        const loginRequiredError = new Error('Log in to add sources to session context.') as Error & { code?: string };
        loginRequiredError.code = CONTEXT_SAVE_LOGIN_REQUIRED_CODE;
        throw loginRequiredError;
      }
      throw new Error('Log in to add sources to session context.');
    }
    if (!resolvedSessionIdHex) {
      throw new Error('Session ID is unavailable; cannot save session docs.');
    }

    return uploadSourcesToDocLibrary({
      sources: queuedSources,
      photoAnalysisBySourceId,
      includePhotoAnalysis: analyzeBeforeLibraryUpload,
      titleOverride: effectiveSurveyTitle,
    });
  };

  const buildEffectiveAdditionalSources = (): SurveyGeneratorAdditionalSourcesResult => {
    return buildEffectiveAdditionalSourceList({
      additionalSources,
      additionalUrlInput,
      ref: additionalSourceIdRef,
    }) as SurveyGeneratorAdditionalSourcesResult;
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    localStorage.removeItem('unfinishedSurvey');

    setError('');
    setShowCreateSurvey(false);
    setStatementsToUpload([]);
    setDocumentURLs([]);
    setSummaryMd('');
    setActiveAction('generate');

    let currentDocumentURLs: string[] = [];
    let content = '';
    const { effectiveSources } = buildEffectiveAdditionalSources();
    const shouldClearAdditionalUrlInput = Boolean(additionalUrlInput && additionalUrlInput.trim());
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
      } else if (pastedText && pastedText.trim().length > 0) {
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
      if (abortedRef.current) return;
      const savedDocRefs = await saveQueuedSourcesToDocLibrary(effectiveSources, photoAnalysisBySourceId);
      if (abortedRef.current) return;
      const savedDocRefsBySourceId = new Map(
        savedDocRefs
          .filter((entry: UploadedSourceDocRef) => entry?.sourceId)
          .map((entry: UploadedSourceDocRef) => [entry.sourceId, entry]),
      );

      // 2. Process Additional Sources
      if (effectiveSources.length > 0) {
        const photoSources = effectiveSources.filter((src): src is SurveyGeneratorPhotoSource => src?.type === 'photo');
        const nonPhotoSources = effectiveSources.filter(
          (src): src is SurveyGeneratorNonPhotoSource => src?.type !== 'photo',
        );
        const additionalContentSections: string[] = [];

        if (photoSources.length > 0) {
          photoSources.forEach((src) => {
            const analysisText = toStr(photoAnalysisBySourceId.get(src?.id)).trim();
            if (!analysisText) return;
            additionalContentSections.push(`--- Photo Source: ${src.name} ---\n\n${analysisText}`);
          });
        }

        if (nonPhotoSources.length > 0) {
          const additionalContent = await processAdditionalSources(
            nonPhotoSources as Array<{ type: 'url' | 'file'; value: string | File; name: string }>,
            aiRequestOptions,
          );
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
        effectiveSources.forEach((src) => {
          const savedRef = savedDocRefsBySourceId.get(src?.id || '');
          if (savedRef?.viewerUrls?.length) {
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
        throw new Error(
          'Total extracted content is too short (min 50 chars). Please enter text, audio, or add valid URLs/Files.',
        );
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
              context: { account, providerLike: provider as ResourceKeyProviderLike, chainId: network?.id },
            });
            const { txId, url } = await uploadMarkdownSummaryToArweave(md, {
              sessionSlug: resolvedSessionSlug || '',
              sessionConfig: resolvedSessionConfig,
              arweaveJwk: arweaveKey?.arweaveJwk || '',
              context: { account, providerLike: provider, chainId: network?.id },
            });
            if (abortedRef.current) return;

            if (url) {
              finalDocUrls.unshift(url);
            }
          } catch (uploadErr) {
            cacheLog.error('Summary upload failed:', uploadErr);
            // We don't abort the whole process; just warn and proceed with questions
            setError('Warning: Summary upload failed, but generating questions...');
          }
        }
      }

      // 4. Generate Questions
      const aiData = await makeSingleAiCall(
        sourceForQuestions,
        {
          sourceTypeOverride: transcriptMode ? 'document' : sourceTypeOverride || undefined,
          multiSpeakerHintOverride: transcriptMode ? 'likely_multiple_speakers' : undefined,
        },
        count,
      );
      if (abortedRef.current) return;

      // 5. Spawn Survey Tool
      // This updates state.documentURLs, which CreateQuestionsAndSurveys picks up
      processAndSetQuestions(aiData, finalDocUrls);
      if (shouldClearAdditionalUrlInput) setAdditionalUrlInput('');
      setShowCreateSurvey(true);
    } catch (err: unknown) {
      if (!abortedRef.current) {
        if ((err as { code?: unknown } | null | undefined)?.code === CONTEXT_SAVE_LOGIN_REQUIRED_CODE) return;
        setError(getSurveyGeneratorErrorMessage(err, 'Generation failed.'));
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

  function renderCreateSurveyComponent() {
    if (!showCreateSurvey || statementsToUpload.length === 0) return null;
    const preformedSurvey = effectiveSurveyTitle ? { title: effectiveSurveyTitle } : null;
    const resolvedContracts = (resolvedSessionConfig?.contracts || {}) as UnknownRecord;

    return (
      <div className={styles.createSurveyContainer}>
        <CreateQuestionsAndSurveys
          miniaturized={minified}
          preformedQuestions={statementsToUpload}
          preformedSurvey={preformedSurvey}
          account={account}
          loginComplete={loginComplete}
          sessionConfig={resolvedSessionConfig}
          contracts={resolvedContracts}
          activeSessionSlug={resolvedSessionSlug}
          provider={provider}
          network={network}
          toggleLoginModal={toggleLoginModal}
          defaultTags={defaultTags as string[] | string | undefined}
          documentURLs={documentURLs}
          litHooks={scopedLitHooks}
          onUploadComplete={(surveyHash: unknown) => {
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

  const toggleQuestionType = (type: SurveyGeneratorQuestionTypeKey) => {
    setQuestionTypes((prev: QuestionTypeSelection) => ({ ...prev, [type]: !prev[type] }));
  };

  const refreshAIPromptModelLabel = React.useCallback(async () => {
    try {
      const aiCfg = await getEffectiveAiConfigForGenerator({
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
    setShowAIPrompt((prev: boolean) => {
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
    navigator.clipboard
      .writeText(text)
      .then(() => {
        notify.success('Copied to clipboard');
        setAiPromptCopySuccess(true);
        setTimeout(() => setAiPromptCopySuccess(false), 1500);
      })
      .catch((_e: unknown) => {
        notify.warn('Copy failed');
      });
  };

  const highlightPromptVariables = (str: unknown) => {
    if (!str) return null;
    const text = String(str);
    const re = /<([A-Za-z][A-Za-z0-9_]*)>/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      parts.push(
        <span key={match.index} className={styles.aiVar}>
          {'<'}
          {match[1]}
          {'>'}
        </span>,
      );
      lastIndex = re.lastIndex;
    }

    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  };

  const handleDatabaseSessionSelect = (slugIn: unknown) => {
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
  const queuedPhotoSources = useMemo(
    () => additionalSources.filter((source): source is SurveyGeneratorPhotoSource => source?.type === 'photo'),
    [additionalSources],
  );
  const queuedNonPhotoSources = useMemo(
    () => additionalSources.filter((source): source is SurveyGeneratorNonPhotoSource => source?.type !== 'photo'),
    [additionalSources],
  );
  const hasUploadedFileSources = useMemo(
    () => Boolean(audioFile) || additionalSources.some((source) => source?.type === 'file' || source?.type === 'photo'),
    [additionalSources, audioFile],
  );
  const effectiveSurveyTitle = hasUploadedFileSources ? toStr(surveyTitle).trim() : '';
  const hasTypedUrlSource = toStr(additionalUrlInput).trim().length > 0;
  const hasTranscriptModeInput = toStr(pastedText).trim().length > 0 || hasTypedUrlSource;
  const shouldShowSaveExtraSourcesControl = additionalSources.length > 0 || hasTypedUrlSource;
  const saveDocAudienceLabel =
    saveDocAudience === 'session' && docSaveSessionAudienceAvailable ? docSaveSessionLabel : 'only me';
  const isExplorerViewMode = !minified && explorerMode === 'view';
  const showDemoCorpusPanel = demoSurfaceEnabled && showDemoCorpusView;
  const showViewModeToolbar = demoSurfaceEnabled;
  const showInternalSessionSelector = !minified && !hideInternalSessionSelector && !hasControlledSessionOverride;

  useEffect(() => {
    if (isExplorerViewMode) setShowDemoCorpusView(demoSurfaceEnabled);
  }, [isExplorerViewMode, demoSurfaceEnabled]);

  useEffect(() => {
    if (!hasTranscriptModeInput && transcriptMode) {
      setTranscriptMode(false);
      setAudioFile(null);
      setSummaryMd('');
    }
  }, [hasTranscriptModeInput, transcriptMode]);

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
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setShowDemoCorpusView(event.target.checked)}
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
            litHooks={scopedLitHooks as SurveyGeneratorLitHooks | null | undefined}
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
    <div className={minified ? `${styles.databaseTool} ${styles.minified}` : styles.databaseTool}>
      {showInternalSessionSelector && (
        <div className={styles.sessionSelectorTriggerRow} data-testid="ce-database-session-selector">
          <button
            type="button"
            className={styles.sessionSelectorToggle}
            aria-label="AudioSurveyGenerator session selector"
            data-testid="ce-database-session-selector-toggle"
            onClick={() => setShowSessionSelector((value: boolean) => !value)}
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
              <SessionChipSelector options={sessionSelectorOptions} onToggle={handleDatabaseSessionSelect} />
            </div>
          )}
        </div>
      )}
      {isExplorerViewMode ? (
        renderExplorerViewMode()
      ) : (
        <>
          <form onSubmit={handleSubmit}>
            <div className={styles.formSection}>
              {hasUploadedFileSources ? (
                <div className={styles.titleInputRow}>
                  <Input
                    type="text"
                    value={surveyTitle}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSurveyTitle(event.target.value)}
                    placeholder="Title"
                    className={styles.titleInput}
                    data-testid={E2E_TESTIDS.DATABASE_TITLE_INPUT}
                  />
                </div>
              ) : null}

              <div className={styles.textInputGroup}>
                <AudioInput
                  placeholder={
                    transcriptMode ? 'Speak to capture transcript or Paste Text...' : 'Speak or type text here...'
                  }
                  recordingDisabled={transcriptMode}
                  longFormMode={transcriptMode}
                  showRecorderControlsInTextbox={transcriptMode}
                  showRecordingTimerInTextbox={transcriptMode}
                  enableDownloads={transcriptMode}
                  updateFunction={(val: string) => setPastedText(val)}
                  toggleEncryption={(bool: boolean) => setTextEncrypted(bool)}
                  value={pastedText}
                  encrypted={textEncrypted}
                  hideEncryption={hideEncryption}
                  style={SURVEY_GENERATOR_TEXT_INPUT_STYLE}
                />
              </div>

              <div className={styles.addSourceControls}>
                <div className={styles.urlInputContainer}>
                  <Input
                    type="url"
                    placeholder="Add URL"
                    value={additionalUrlInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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

                {hasTranscriptModeInput && (
                  <div
                    className={buildSurveyGeneratorTranscriptToggleClassName(styles, transcriptMode)}
                    onClick={handleTranscriptModeToggle}
                    title="Enable Transcript Mode (Summary + Arweave Upload)"
                    data-testid="transcript-mode-toggle"
                  >
                    <FontAwesomeIcon icon={transcriptMode ? faCheckSquare : faSquare} className={styles.checkboxIcon} />
                    <span>Transcript</span>
                  </div>
                )}

                {transcriptMode && (
                  <div
                    className={buildSurveyGeneratorTranscriptToggleClassName(styles, uploadSummaryToArweave)}
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
                    className={buildSurveyGeneratorTranscriptToggleClassName(styles, encryptSummary)}
                    onClick={() => setEncryptSummary(!encryptSummary)}
                    title="Encrypt the summary before uploading to Arweave (Lit + SBT gate)."
                  >
                    <FontAwesomeIcon icon={encryptSummary ? faCheckSquare : faSquare} className={styles.checkboxIcon} />
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

              {(additionalSources.length > 0 ||
                shouldShowSaveExtraSourcesControl ||
                (transcriptMode && uploadSummaryToArweave && encryptSummary)) && (
                <div className={styles.additionalContextSection}>
                  {queuedPhotoSources.length > 0 && (
                    <div className={styles.photoCardGrid}>
                      {queuedPhotoSources.map((item) => {
                        const statusKey = toStr(item?.analysisStatus || 'queued')
                          .trim()
                          .toLowerCase();
                        const statusLabel = getPhotoStatusLabel(item);
                        const analysisBodyId = `database-photo-analysis-${item?.id || 'unknown'}`;
                        const hasExpandedAnalysis =
                          statusKey === 'ready' && item?.analysisExpanded && toStr(item?.analysisText).trim();

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
                                <QueuedPhotoPreview file={item?.value} photoName={item?.name} sourceId={item?.id} />
                              </div>

                              <div className={styles.photoCardMeta}>
                                <div className={styles.photoName} title={item?.name}>
                                  {item?.name}
                                </div>
                                <div className={styles.photoCardStatusRow}>
                                  {statusKey === 'ready' ? (
                                    <button
                                      type="button"
                                      className={buildSurveyGeneratorPhotoStatusToggleClassName(styles)}
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
                                    <span className={buildSurveyGeneratorPhotoStatusChipClassName(styles, statusKey)}>
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
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                            setSaveExtraSourcesToDocLibrary(event.target.checked);
                            if (!event.target.checked) {
                              setShowSaveDocAudienceMenu(false);
                            }
                          }}
                          data-testid={E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}
                        />
                        <span>Add to session context</span>
                      </label>

                      <div className={styles.docSaveAudienceWrap}>
                        <button
                          type="button"
                          className={styles.docSaveAudienceButton}
                          onClick={() => setShowSaveDocAudienceMenu((value: boolean) => !value)}
                          data-testid={E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_BUTTON}
                          data-ce-doc-save-audience={saveDocAudience}
                          aria-label={`Session context visibility: ${saveDocAudienceLabel}`}
                          aria-haspopup="menu"
                          aria-expanded={showSaveDocAudienceMenu}
                          title={`Session context visibility: ${saveDocAudienceLabel}`}
                        >
                          <FontAwesomeIcon icon={faLock} />
                        </button>

                        {showSaveDocAudienceMenu && (
                          <div
                            className={styles.docSaveAudienceMenu}
                            data-testid={E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_MENU}
                          >
                            <button
                              type="button"
                              className={buildSurveyGeneratorDocSaveAudienceOptionClassName(
                                styles,
                                saveDocAudience === 'self',
                              )}
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
                                className={buildSurveyGeneratorDocSaveAudienceOptionClassName(
                                  styles,
                                  saveDocAudience === 'session',
                                )}
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
                                {docSaveSessionChainError ? (
                                  docSaveSessionChainError
                                ) : (
                                  <>
                                    Session <code>docUploads</code> gate unavailable. Saved docs will stay private to
                                    your wallet.
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
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                              setAnalyzeBeforeLibraryUpload(event.target.checked)
                            }
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
                        onAddSBT={(sbt: SurveyGeneratorSbtSelection) => setSummaryGateSBTs((prev) => [...prev, sbt])}
                        onRemoveSBT={(address: string) =>
                          setSummaryGateSBTs((prev) =>
                            prev.filter(
                              (item) =>
                                String(item.address || '').toLowerCase() !== String(address || '').toLowerCase(),
                            ),
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
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setSummaryGateMode(e.target.value as SurveyGeneratorGateMode)
                          }
                        >
                          <option value="any">Any (OR)</option>
                          <option value="all">All (AND)</option>
                        </Input>
                      </FormGroup>
                    </div>
                  )}

                  {transcriptMode &&
                    uploadSummaryToArweave &&
                    encryptSummary &&
                    summaryGateSBTs.length === 0 &&
                    summaryGateAddresses.length === 0 && (
                      <div className={styles.encryptionWarning}>Select at least one SBT to encrypt the summary.</div>
                    )}
                </div>
              )}
            </div>

            <div className={styles.formSection}>
              <h3 className={styles.sectionTitle}>Types</h3>

              <div className={styles.questionTypeGrid}>
                <div
                  className={buildSurveyGeneratorTypeButtonClassName(styles, questionTypes.binary)}
                  onClick={() => toggleQuestionType('binary')}
                >
                  <div className={styles.typeTitle}>Binary</div>
                  <div className={styles.typePreviewRow}>
                    <span className={buildSurveyGeneratorTypePillClassName(styles, 'agree')}>Agree</span>
                    <span className={buildSurveyGeneratorTypePillClassName(styles, 'unsure')}>Unsure</span>
                    <span className={buildSurveyGeneratorTypePillClassName(styles, 'disagree')}>Disagree</span>
                  </div>
                </div>

                <div
                  className={buildSurveyGeneratorTypeButtonClassName(styles, questionTypes.multichoice)}
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
                  className={buildSurveyGeneratorTypeButtonClassName(styles, questionTypes.rating)}
                  onClick={() => toggleQuestionType('rating')}
                >
                  <div className={styles.typeTitle}>Rating</div>
                  <div className={styles.ratingPreviewWrap}>
                    <div className={styles.ratingPreviewFill} />
                    <div className={styles.ratingPreviewHandle} />
                  </div>
                </div>

                <div
                  className={buildSurveyGeneratorTypeButtonClassName(styles, questionTypes.freeform)}
                  onClick={() => toggleQuestionType('freeform')}
                >
                  <div className={styles.typeTitle}>Freeform</div>
                  <div className={styles.freeformPreview}>...</div>
                </div>
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.countControlRow} role="group" aria-label="Number of questions">
                <span className={styles.countInlineLabel} aria-hidden="true">
                  # Questions
                </span>
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
              <div className={styles.actionRow}>
                <Button type="submit" className={styles.generateButton} disabled={loading}>
                  {loading && activeAction === 'generate' ? (
                    <>
                      {isTranscribing ? 'Transcribing... ' : 'Processing... '}
                      {waitingSeconds}s <FontAwesomeIcon icon={faSpinner} spin />
                    </>
                  ) : (
                    'Generate Questions'
                  )}
                </Button>
              </div>
            )}
          </form>

          {error && !loading && (
            <div className={styles.error} style={SURVEY_GENERATOR_ERROR_STYLE}>
              {error}
            </div>

            <div className={styles.formSection}>
              <h3 className={styles.sectionTitle}>Types</h3>

              <div className={styles.questionTypeGrid}>
                <div
                  className={buildSurveyGeneratorTypeButtonClassName(styles, questionTypes.binary)}
                  onClick={() => toggleQuestionType('binary')}
                >
                  <div className={styles.typeTitle}>Binary</div>
                  <div className={styles.typePreviewRow}>
                    <span className={buildSurveyGeneratorTypePillClassName(styles, 'agree')}>Agree</span>
                    <span className={buildSurveyGeneratorTypePillClassName(styles, 'unsure')}>Unsure</span>
                    <span className={buildSurveyGeneratorTypePillClassName(styles, 'disagree')}>Disagree</span>
                  </div>
                </div>

                <div
                  className={buildSurveyGeneratorTypeButtonClassName(styles, questionTypes.multichoice)}
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
                  className={buildSurveyGeneratorTypeButtonClassName(styles, questionTypes.rating)}
                  onClick={() => toggleQuestionType('rating')}
                >
                  <div className={styles.typeTitle}>Rating</div>
                  <div className={styles.ratingPreviewWrap}>
                    <div className={styles.ratingPreviewFill} />
                    <div className={styles.ratingPreviewHandle} />
                  </div>
                </div>

                <div
                  className={buildSurveyGeneratorTypeButtonClassName(styles, questionTypes.freeform)}
                  onClick={() => toggleQuestionType('freeform')}
                >
                  <div className={styles.typeTitle}>Freeform</div>
                  <div className={styles.freeformPreview}>...</div>
                </div>
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.countControlRow} role="group" aria-label="Number of questions">
                <span className={styles.countInlineLabel} aria-hidden="true">
                  # Questions
                </span>
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
              <div className={styles.actionRow}>
                <Button type="submit" className={styles.generateButton} disabled={loading}>
                  {loading && activeAction === 'generate' ? (
                    <>
                      {isTranscribing ? 'Transcribing... ' : 'Processing... '}
                      {waitingSeconds}s <FontAwesomeIcon icon={faSpinner} spin />
                    </>
                  ) : (
                    'Generate Questions'
                  )}
                </Button>
              </div>
            )}
          </form>

          {error && !loading && (
            <div className={styles.error} style={SURVEY_GENERATOR_ERROR_STYLE}>
              {error}
            </div>
          )}

          <div className={styles.aiPromptSection}>
            <button type="button" className={styles.aiPromptToggleBtn} onClick={toggleAIPrompt}>
              {showAIPrompt ? 'Hide AI Prompt' : 'Show AI Prompt'}
              <FontAwesomeIcon
                icon={showAIPrompt ? faCaretUp : faCaretDown}
                style={SURVEY_GENERATOR_AI_PROMPT_ICON_STYLE}
              />
            </button>

            {showAIPrompt && (
              <div className={styles.aiPromptWrapper}>
                <button
                  type="button"
                  className={buildSurveyGeneratorAiPromptCopyClassName(styles, aiPromptCopySuccess)}
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
