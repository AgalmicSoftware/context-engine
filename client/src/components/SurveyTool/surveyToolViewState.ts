import { serializeFilterState } from '../../utilities/survey/filterStateUtils.js';

type UnknownRecord = Record<string, unknown>;

type QuestionScanProgress = {
  totalBlocks?: unknown;
  requestedTotalBlocks?: unknown;
  wasCapped?: boolean;
  scannedBlocks?: unknown;
  remainingBlocks?: unknown;
};

type PileFullLoadingStateArgs = {
  loading?: boolean;
  hasVisibleQuestions?: boolean;
  firstBoot?: boolean;
  isQuestionCacheReady?: boolean;
  recentRateLimit?: boolean;
  hasScanOrHydrationWork?: boolean;
  allowUnreadyEmptySettlement?: boolean;
  allowFilteredEmptySettlement?: boolean;
  hasTerminalScanError?: boolean;
};

type CanonicalResponseStatus = {
  responded: boolean;
  notResponded: boolean;
} | null;

type CanonicalSurveyToolFilterState = {
  topQuestions: unknown;
  questionTypes: unknown[];
  sbtFilter: UnknownRecord | null;
  aiFilter: unknown;
  aiTopN: number | null;
  aiCombine: boolean;
  selectedTags: unknown[];
  responseStatus: CanonicalResponseStatus;
};

type LockAudienceDisplayStateArgs = {
  questionId?: unknown;
  fieldKey?: unknown;
  fieldState?: UnknownRecord | null;
  lockDisabled?: boolean;
  lockTitle?: unknown;
  glowAnswer?: boolean;
  forceAudienceMenu?: boolean;
  selfAudienceLabel?: unknown;
  showPlaintextOption?: boolean;
  visualContext?: unknown;
  forcedGate?: boolean;
  gateOptions?: unknown[];
  hasGateOption?: boolean;
  menuOpen?: boolean;
  currentAudience?: unknown;
  currentGateId?: unknown;
  currentAudienceMode?: unknown;
};

type LockAudienceButtonActionArgs = {
  effectiveFieldKey?: unknown;
  fieldEncrypted?: boolean;
  lockDisabled?: boolean;
  forcedGate?: boolean;
  hasAudienceMenu?: boolean;
  menuOpen?: boolean;
  hasGateOption?: boolean;
};

const isPlainObject = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const normalizeQuestionProgressSlug = (rawSlug = ''): string => {
  const normalized = String(rawSlug || '')
    .trim()
    .toLowerCase();
  return normalized === 'general' ? '' : normalized;
};

export const doesQuestionProgressMatchSlug = (progressSlug = '', currentSlug = ''): boolean =>
  normalizeQuestionProgressSlug(progressSlug) === normalizeQuestionProgressSlug(currentSlug);

export const formatQuestionScanBlockCount = (value: unknown): string => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  return Math.max(0, Math.floor(numericValue)).toLocaleString();
};

export const buildQuestionScanProgressDisplay = (questionScanProgress: QuestionScanProgress | null = null) => {
  const totalBlocks = Math.max(0, Number(questionScanProgress?.totalBlocks || 0));
  const requestedTotalBlocks = Math.max(
    totalBlocks,
    Number(questionScanProgress?.requestedTotalBlocks || totalBlocks || 0),
  );
  const wasCapped = questionScanProgress?.wasCapped === true && requestedTotalBlocks > totalBlocks;
  const progressTotalBlocks = wasCapped ? requestedTotalBlocks : totalBlocks;
  const remainingBlocksRaw = Number(questionScanProgress?.remainingBlocks);
  const scannedBlocksFallback =
    progressTotalBlocks > 0
      ? Math.max(
          0,
          progressTotalBlocks -
            Math.max(0, Number.isFinite(remainingBlocksRaw) ? remainingBlocksRaw : progressTotalBlocks),
        )
      : 0;
  const scannedBlocks =
    progressTotalBlocks > 0
      ? Math.max(
          0,
          Math.min(
            progressTotalBlocks,
            Number.isFinite(Number(questionScanProgress?.scannedBlocks))
              ? Number(questionScanProgress?.scannedBlocks)
              : scannedBlocksFallback,
          ),
        )
      : 0;
  const remainingBlocks =
    progressTotalBlocks > 0
      ? Math.max(
          0,
          Math.min(
            progressTotalBlocks,
            Number.isFinite(remainingBlocksRaw) ? remainingBlocksRaw : progressTotalBlocks - scannedBlocks,
          ),
        )
      : 0;
  const percentComplete =
    progressTotalBlocks > 0 ? Math.max(0, Math.min(100, Math.round((scannedBlocks / progressTotalBlocks) * 100))) : 0;

  return {
    totalBlocks,
    requestedTotalBlocks,
    wasCapped,
    scannedBlocks,
    remainingBlocks,
    percentComplete,
    metaLeftText: `${formatQuestionScanBlockCount(remainingBlocks)} blocks left`,
    metaRightText: `${formatQuestionScanBlockCount(scannedBlocks)} / ${formatQuestionScanBlockCount(progressTotalBlocks)}`,
  };
};

export const shouldShowPileFullLoadingState = ({
  loading = false,
  hasVisibleQuestions = false,
  firstBoot = false,
  isQuestionCacheReady = false,
  recentRateLimit = false,
  hasScanOrHydrationWork = false,
  allowUnreadyEmptySettlement = false,
  allowFilteredEmptySettlement = false,
  hasTerminalScanError = false,
}: PileFullLoadingStateArgs = {}): boolean => {
  if (hasVisibleQuestions) return false;
  if (hasTerminalScanError) return false;
  if (allowUnreadyEmptySettlement) return false;
  if (allowFilteredEmptySettlement) return false;
  if (loading) return true;
  if (hasScanOrHydrationWork) return true;
  return !!(firstBoot || !isQuestionCacheReady || recentRateLimit);
};

const normalizeSbtFilterState = (rawSbtFilter: unknown): UnknownRecord | null => {
  if (!isPlainObject(rawSbtFilter)) return null;
  const normalized: UnknownRecord = {};
  Object.keys(rawSbtFilter).forEach((key) => {
    const value = rawSbtFilter[key];
    if (Array.isArray(value)) {
      const compacted = value.filter((entry) => entry != null && String(entry).trim() !== '');
      if (compacted.length > 0) normalized[key] = compacted;
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) normalized[key] = trimmed;
      return;
    }
    if (typeof value === 'boolean') {
      if (value) normalized[key] = true;
      return;
    }
    if (value != null) {
      normalized[key] = value;
    }
  });
  return Object.keys(normalized).length > 0 ? normalized : null;
};

const buildCanonicalSurveyToolFilterState = (rawFilterState: unknown): CanonicalSurveyToolFilterState => {
  const state = isPlainObject(rawFilterState) ? rawFilterState : {};
  const topQuestions = Object.prototype.hasOwnProperty.call(state, 'topQuestions') ? state.topQuestions : null;
  const questionTypes = Array.isArray(state.questionTypes)
    ? [...state.questionTypes]
    : Array.isArray(state.types)
      ? [...state.types]
      : [];
  const selectedTags = Array.isArray(state.selectedTags)
    ? [...state.selectedTags]
    : Array.isArray(state.tags)
      ? [...state.tags]
      : [];
  const legacyTopLevelSbt =
    Array.isArray(state.includedSBTs) || Array.isArray(state.excludedSBTs) || state.onlyVerifiedHumans === true
      ? {
          includedSBTs: Array.isArray(state.includedSBTs) ? [...state.includedSBTs] : [],
          excludedSBTs: Array.isArray(state.excludedSBTs) ? [...state.excludedSBTs] : [],
          onlyVerifiedHumans: state.onlyVerifiedHumans === true,
        }
      : null;
  const sbtFilter = normalizeSbtFilterState(state.sbtFilter || legacyTopLevelSbt);
  const aiFilter = typeof state.aiFilter === 'string' ? state.aiFilter.trim() || null : (state.aiFilter ?? null);
  const aiTopNRaw = Object.prototype.hasOwnProperty.call(state, 'aiTopN') ? state.aiTopN : null;
  const aiTopN =
    aiFilter == null
      ? null
      : (() => {
          const parsed = Number.parseInt(String(aiTopNRaw ?? ''), 10);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
        })();
  const aiCombine = aiFilter == null ? false : state.aiCombine === true;

  const rawResponseStatus = isPlainObject(state.responseStatus) ? state.responseStatus : null;
  const responded = rawResponseStatus?.responded === true;
  const notResponded = rawResponseStatus?.notResponded === true;
  const responseStatus =
    (responded || notResponded) && !(responded && notResponded) ? { responded, notResponded } : null;

  return {
    topQuestions,
    questionTypes,
    sbtFilter,
    aiFilter,
    aiTopN,
    aiCombine,
    selectedTags,
    responseStatus,
  };
};

export const normalizeSurveyToolFilterState = (rawFilterState: unknown): UnknownRecord => {
  const canonical = buildCanonicalSurveyToolFilterState(rawFilterState);
  return serializeFilterState(canonical) ? canonical : {};
};

export const serializeSurveyToolFilterState = (filterState: unknown): string =>
  serializeFilterState(buildCanonicalSurveyToolFilterState(filterState));

export const isSurveyToolFilterStateActive = (filterState: unknown): boolean =>
  !!serializeSurveyToolFilterState(filterState);

export const isQuestionPromptMasked = (question: UnknownRecord | null = null): boolean => {
  const prompt = question?.prompt;
  const promptDecrypted = question?.promptDecrypted;
  return String(prompt || '').trim() === '[encrypted]' && promptDecrypted !== true;
};

export const buildAnswerLockDisplayState = ({
  field = null,
  masked = false,
  isSubmitting = false,
}: {
  field?: UnknownRecord | null;
  masked?: boolean;
  isSubmitting?: boolean;
} = {}) => ({
  lockDisabled: !!isSubmitting || !!masked,
  lockTitle: masked ? 'Encrypted answer' : field?.encrypted ? 'Encrypted' : 'Not encrypted',
});

export const buildGatedPromptNoticeState = ({
  questionId,
  tooltipIdSuffix,
  fallbackId = 'gated',
  gateNames = [],
  sbtLabel = 'SBT',
  gateLabel = 'gate',
  gatesLabel = 'gates',
}: {
  questionId?: unknown;
  tooltipIdSuffix?: unknown;
  fallbackId?: unknown;
  gateNames?: unknown[];
  sbtLabel?: unknown;
  gateLabel?: unknown;
  gatesLabel?: unknown;
} = {}) => {
  const tooltipIdBase = String(questionId || fallbackId || 'gated')
    .trim()
    .toLowerCase();
  const normalizedGateNames = Array.isArray(gateNames)
    ? gateNames.map((name) => String(name || '').trim()).filter(Boolean)
    : [];
  const normalizedSbtLabel = String(sbtLabel || 'SBT').trim() || 'SBT';
  const normalizedGateLabel = String(gateLabel || 'gate').trim() || 'gate';
  const normalizedGatesLabel = String(gatesLabel || 'gates').trim() || 'gates';

  return {
    tooltipId: `ce-gated-prompt-tip-${tooltipIdBase.replace(/[^a-z0-9_-]/g, '-')}-${String(tooltipIdSuffix || '').trim()}`,
    tooltipText: normalizedGateNames.length
      ? `Required ${normalizedSbtLabel} ${normalizedGateNames.length > 1 ? normalizedGatesLabel : normalizedGateLabel}: ${normalizedGateNames.join(', ')}`
      : `${normalizedSbtLabel} ${normalizedGateLabel} required`,
  };
};

export const buildQuestionPromptDecryptDisplayState = ({
  questionId = '',
  promptText = 'Question',
  promptMasked = false,
  promptReloading = false,
  payloadDisplay = null,
  loginComplete = false,
  account = '',
  canReloadPrompt = false,
}: {
  questionId?: unknown;
  promptText?: unknown;
  promptMasked?: unknown;
  promptReloading?: unknown;
  payloadDisplay?: UnknownRecord | null;
  loginComplete?: unknown;
  account?: unknown;
  canReloadPrompt?: unknown;
} = {}) => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  const normalizedPromptText = promptText || 'Question';
  const display = payloadDisplay && typeof payloadDisplay === 'object' ? payloadDisplay : {};
  const requiresLogin = !!display.requiresAuth && (!loginComplete || !account);
  const actionTitle = requiresLogin
    ? 'Login required to decrypt gated prompts.'
    : display.actionTitle || 'Decrypt gated prompt';

  return {
    qid,
    promptText: normalizedPromptText,
    promptMasked: !!promptMasked,
    showPromptAction: !!promptMasked && !!qid,
    promptTitle: actionTitle,
    promptLabel: promptMasked ? display.label || normalizedPromptText : normalizedPromptText,
    promptBusyLabel: display.busyLabel || 'Decrypting...',
    noticeLeadingText: display.noticeLeadingText,
    noticeStatusText: display.noticeStatusText,
    noticeSuffix: display.noticeSuffix,
    noticeActionBusy: !!promptReloading,
    noticeActionDisabled: !!promptReloading,
    noticeActionLabel: display.actionLabel || 'Decrypt Prompt',
    noticeActionTitle: actionTitle,
    canReloadPrompt: !!canReloadPrompt,
  };
};

export const buildLockAudienceDisplayState = ({
  questionId,
  fieldKey = 'answer',
  fieldState = null,
  lockDisabled = false,
  lockTitle = '',
  glowAnswer = false,
  forceAudienceMenu = false,
  selfAudienceLabel = 'for me',
  showPlaintextOption = false,
  visualContext = 'default',
  forcedGate = false,
  gateOptions = [],
  hasGateOption,
  menuOpen = false,
  currentAudience = '',
  currentGateId = '',
  currentAudienceMode = '',
}: LockAudienceDisplayStateArgs = {}) => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  const effectiveFieldKey =
    String(fieldKey || '')
      .trim()
      .toLowerCase() === 'additional'
      ? 'additional'
      : 'answer';
  const isPileVisualContext =
    String(visualContext || '')
      .trim()
      .toLowerCase() === 'pile';
  const normalizedFieldState = fieldState && typeof fieldState === 'object' ? fieldState : {};
  const normalizedGateOptions = Array.isArray(gateOptions) ? gateOptions : [];
  const resolvedHasGateOption = forcedGate || normalizedGateOptions.length > 0 || hasGateOption === true;
  const hasAudienceMenu =
    !forcedGate && (forceAudienceMenu || effectiveFieldKey === 'additional' || resolvedHasGateOption);
  const resolvedMenuOpen = hasAudienceMenu && menuOpen === true;
  const normalizedCurrentAudience = String(currentAudience || '')
    .trim()
    .toLowerCase();
  const normalizedCurrentGateId = String(currentGateId || '').trim();
  const normalizedAudienceMode = String(currentAudienceMode || '')
    .trim()
    .toLowerCase();
  const gateActive =
    (!!normalizedFieldState?.encrypted || forcedGate) && normalizedCurrentAudience === 'gate' && resolvedHasGateOption;
  const selfActive =
    !!normalizedFieldState?.encrypted && normalizedCurrentAudience === 'self' && normalizedAudienceMode !== 'inherit';
  const plaintextActive = !normalizedFieldState?.encrypted && normalizedAudienceMode !== 'inherit';
  const followActive = effectiveFieldKey === 'additional' && normalizedAudienceMode === 'inherit';
  const lockActive = !!normalizedFieldState?.encrypted || !!forcedGate || !!glowAnswer;
  const lockVisualActive = lockActive || resolvedMenuOpen;
  const pileMenuPressed = isPileVisualContext && resolvedMenuOpen && !lockActive;
  const showBrightLockState = lockActive || (!isPileVisualContext && resolvedMenuOpen);
  const isLockDisabled = !!lockDisabled || !!forcedGate;
  const allowPlaintextOption = !!showPlaintextOption && effectiveFieldKey !== 'additional';
  const lockButtonStyle = !isLockDisabled ? { opacity: lockVisualActive ? 1 : 0.35 } : undefined;
  const normalizedSelfAudienceLabel = String(selfAudienceLabel || '').trim() || 'for me';
  const buttonTitle = forcedGate
    ? 'Locked by question gate'
    : hasAudienceMenu
      ? 'Choose encryption audience'
      : String(lockTitle || '');

  return {
    qid,
    effectiveFieldKey,
    isPileVisualContext,
    fieldState: normalizedFieldState,
    forcedGate: !!forcedGate,
    gateOptions: normalizedGateOptions,
    hasGateOption: resolvedHasGateOption,
    hasAudienceMenu,
    menuOpen: resolvedMenuOpen,
    currentAudience: normalizedCurrentAudience,
    currentGateId: normalizedCurrentGateId,
    currentAudienceMode: normalizedAudienceMode,
    gateActive,
    selfActive,
    plaintextActive,
    followActive,
    lockActive,
    lockVisualActive,
    pileMenuPressed,
    showBrightLockState,
    isLockDisabled,
    allowPlaintextOption,
    lockButtonStyle,
    normalizedSelfAudienceLabel,
    buttonTitle,
  };
};

export const buildLockAudienceButtonAction = ({
  effectiveFieldKey = 'answer',
  fieldEncrypted = false,
  lockDisabled = false,
  forcedGate = false,
  hasAudienceMenu = false,
  menuOpen = false,
  hasGateOption = false,
}: LockAudienceButtonActionArgs = {}) => {
  const normalizedFieldKey =
    String(effectiveFieldKey || '')
      .trim()
      .toLowerCase() === 'additional'
      ? 'additional'
      : 'answer';
  const encrypted = !!fieldEncrypted;

  if (lockDisabled || forcedGate) {
    return { kind: 'noop' as const };
  }

  if (!hasAudienceMenu) {
    return {
      kind: 'toggle-field-encryption' as const,
      nextEncrypted: !encrypted,
    };
  }

  if (menuOpen && encrypted) {
    return {
      kind: 'disable-field-encryption-and-close-menu' as const,
    };
  }

  if (!menuOpen && !encrypted) {
    if (normalizedFieldKey === 'answer' && !hasGateOption) {
      return {
        kind: 'enable-answer-and-open-menu' as const,
      };
    }
    return {
      kind: 'set-menu-open' as const,
      nextOpen: true,
    };
  }

  return {
    kind: 'set-menu-open' as const,
    nextOpen: !menuOpen,
  };
};
