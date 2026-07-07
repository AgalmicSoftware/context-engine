import { shouldSeedPileBaselineFromPrefill } from './surveyPileCacheSync';
import { buildPileQuestionSetHydrationPlan } from './surveyPileHydrationPlan';
import {
  buildEnsureVisiblePileResponseStatePlan,
  buildInitializePileResponseStatePlan,
  type BuildEmptyResponseFieldState,
  type EnsureVisiblePileResponseStatePlan,
  type InitializePileResponseStatePlan,
  type PileResponseSlice,
} from './surveyPileResponseWindow';

type CloneValue = <T>(value: T) => T;

type PileQuestionLike =
  | {
      id?: unknown;
    }
  | null
  | undefined;

type ApplyCachedResponseEntryToSlice = ({
  targetSlice,
  questionId,
  response,
}: {
  targetSlice: PileResponseSlice;
  questionId: string;
  response: Record<string, unknown>;
}) => boolean;

type PileControllerState = Record<string, unknown> & {
  pileQuestions?: unknown;
  activePileIndex?: unknown;
  surveysResponseState?: Array<Partial<PileResponseSlice> | null | undefined>;
  editBaseline?: Partial<PileResponseSlice> | null;
};
type SetStateUpdate =
  Record<string, unknown> | null | ((prevState: PileControllerState) => Record<string, unknown> | null);
type SetState = (update: SetStateUpdate, callback?: () => void) => unknown;

const EMPTY_PILE_RESPONSE_SLICE = (): PileResponseSlice => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
});

const defaultCloneValue: CloneValue = <T>(value: T): T => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const normalizeResponseSlice = (
  slice: Partial<PileResponseSlice> | null | undefined,
  cloneValue: CloneValue = defaultCloneValue,
): PileResponseSlice => {
  const cloned = cloneValue((slice || {}) as Partial<PileResponseSlice>) || {};
  return {
    answers: { ...((cloned as Partial<PileResponseSlice>).answers || {}) },
    importance: { ...((cloned as Partial<PileResponseSlice>).importance || {}) },
    conviction: { ...((cloned as Partial<PileResponseSlice>).conviction || {}) },
    additionalComments: { ...((cloned as Partial<PileResponseSlice>).additionalComments || {}) },
  };
};

export type PileCachePrefillStatePlan = {
  shouldSkip: boolean;
  reason: 'seed-baseline' | 'patch-live';
  nextSlice: PileResponseSlice;
  nextState: Record<string, unknown>;
};

export const buildPileCachePrefillStatePlan = ({
  pileQuestions = [],
  questionResponsesByQuestionId = {},
  account = '',
  currentSlice = null,
  editBaseline = null,
  pendingTotal = 0,
  applyCachedResponseEntryToSlice = () => false,
  cloneValue = defaultCloneValue,
}: {
  pileQuestions?: PileQuestionLike[];
  questionResponsesByQuestionId?: Record<string, Record<string, unknown>>;
  account?: string | null;
  currentSlice?: Partial<PileResponseSlice> | null;
  editBaseline?: unknown;
  pendingTotal?: number | null;
  applyCachedResponseEntryToSlice?: ApplyCachedResponseEntryToSlice;
  cloneValue?: CloneValue;
} = {}): PileCachePrefillStatePlan => {
  const nextSlice = normalizeResponseSlice(currentSlice, cloneValue);
  const accountLower = String(account || '').toLowerCase();
  const questionList = Array.isArray(pileQuestions) ? pileQuestions : [];
  const responseLookup =
    questionResponsesByQuestionId && typeof questionResponsesByQuestionId === 'object'
      ? questionResponsesByQuestionId
      : {};

  questionList.forEach((question) => {
    const questionId = String(question?.id || '');
    if (!questionId) return;

    const rawResponse = responseLookup[questionId.toLowerCase()]?.[accountLower];
    if (!rawResponse) return;

    let parsedResponse: Record<string, unknown> | null = null;
    try {
      parsedResponse =
        typeof rawResponse === 'string' ? JSON.parse(rawResponse) : (rawResponse as Record<string, unknown>);
    } catch {
      parsedResponse = null;
    }
    if (!parsedResponse) return;

    applyCachedResponseEntryToSlice({
      targetSlice: nextSlice,
      questionId,
      response: parsedResponse,
    });
  });

  const shouldSeedBaseline = shouldSeedPileBaselineFromPrefill({
    editBaseline,
    currentSlice,
    pendingTotal,
  });

  if (!shouldSeedBaseline) {
    return {
      shouldSkip: false,
      reason: 'patch-live',
      nextSlice,
      nextState: {
        surveysResponseState: [nextSlice],
      },
    };
  }

  const baselineSlice = normalizeResponseSlice(nextSlice, cloneValue);
  return {
    shouldSkip: false,
    reason: 'seed-baseline',
    nextSlice,
    nextState: {
      surveysResponseState: [nextSlice],
      baselineResponses: normalizeResponseSlice(baselineSlice, cloneValue),
      editBaseline: baselineSlice,
      modifiedCount: 0,
      isDirty: false,
    },
  };
};

export const buildPileInitializeResponseStatePatch = ({
  cloneValue = defaultCloneValue,
  initialSlice = EMPTY_PILE_RESPONSE_SLICE(),
}: {
  cloneValue?: CloneValue;
  initialSlice?: Partial<PileResponseSlice> | null;
} = {}) => ({
  surveysResponseState: [initialSlice],
  editBaseline: normalizeResponseSlice(initialSlice, cloneValue),
});

export const executePileInitializeResponseState = ({
  isDirty = false,
  modifiedCount = 0,
  pileQuestions = [],
  activePileIndex = 0,
  lastInitializeResponseSig = '',
  buildEmptyResponseFieldState = () => ({ value: '' }),
  setLastInitializeResponseSig = () => {},
  cloneValue = defaultCloneValue,
  setState = () => {},
  onComplete = () => {},
  onNoop = () => {},
}: {
  isDirty?: boolean;
  modifiedCount?: unknown;
  pileQuestions?: unknown;
  activePileIndex?: unknown;
  lastInitializeResponseSig?: string | null;
  buildEmptyResponseFieldState?: BuildEmptyResponseFieldState;
  setLastInitializeResponseSig?: (value: string) => void;
  cloneValue?: CloneValue;
  setState?: SetState;
  onComplete?: () => void;
  onNoop?: (plan: InitializePileResponseStatePlan) => void;
} = {}): InitializePileResponseStatePlan => {
  const initializePlan = buildInitializePileResponseStatePlan({
    isDirty,
    modifiedCount,
    pileQuestions,
    activePileIndex,
    lastInitializeResponseSig,
    buildEmptyResponseFieldState,
  });

  if (initializePlan.shouldSkip) {
    onNoop(initializePlan);
    onComplete();
    return initializePlan;
  }

  setLastInitializeResponseSig(initializePlan.nextInitializeResponseSig);
  const initialSlice = initializePlan.initialSlice || EMPTY_PILE_RESPONSE_SLICE();
  setState(buildPileInitializeResponseStatePatch({ cloneValue, initialSlice }), onComplete);
  return initializePlan;
};

export const executeEnsureVisiblePileResponseState = ({
  getState = () => ({}),
  buildEmptyResponseFieldState = () => ({ value: '' }),
  setState = () => {},
  onRehydrateVisibleWindow = () => {},
  onError = () => {},
}: {
  getState?: () => PileControllerState;
  buildEmptyResponseFieldState?: BuildEmptyResponseFieldState;
  setState?: SetState;
  onRehydrateVisibleWindow?: () => void;
  onError?: (error: unknown) => void;
} = {}): EnsureVisiblePileResponseStatePlan | null => {
  let lastPlan: EnsureVisiblePileResponseStatePlan | null = null;
  let shouldRehydrateVisibleWindow = false;

  try {
    setState(
      (prevState) => {
        const prev = prevState || getState() || {};
        lastPlan = buildEnsureVisiblePileResponseStatePlan({
          pileQuestions: prev.pileQuestions,
          activePileIndex: prev.activePileIndex,
          currentSlice: prev.surveysResponseState?.[0],
          currentBaseline: prev.editBaseline,
          buildEmptyResponseFieldState,
        });
        if (!lastPlan || lastPlan.shouldSkip) return null;
        shouldRehydrateVisibleWindow = true;
        return lastPlan.updates;
      },
      () => {
        if (!shouldRehydrateVisibleWindow) return;
        onRehydrateVisibleWindow();
      },
    );
  } catch (error) {
    onError(error);
  }

  return lastPlan;
};

export const executePileQuestionSetHydration = ({
  requestEpoch = null,
  resultSignature = '',
  lastResultSignature = '',
  initializeResponses = true,
  forceOverwriteDraft = false,
  resetAutoDecryptLedger = false,
  autoDecryptReason = 'pile-hydration',
  autoDecryptResetReason = 'pile-hydration-reset',
  shouldAbortRequest = () => false,
  setLastResultSignature = () => {},
  initializeResponseState = () => {},
  rehydrateVisiblePileWindow = () => {},
  onNoop = () => {},
}: {
  requestEpoch?: number | null;
  resultSignature?: string | null;
  lastResultSignature?: string | null;
  initializeResponses?: boolean;
  forceOverwriteDraft?: boolean;
  resetAutoDecryptLedger?: boolean;
  autoDecryptReason?: string | null;
  autoDecryptResetReason?: string | null;
  shouldAbortRequest?: (requestEpoch?: number | null) => boolean;
  setLastResultSignature?: (value: string) => void;
  initializeResponseState?: (callback?: () => void) => void;
  rehydrateVisiblePileWindow?: (options?: Record<string, unknown>) => void;
  onNoop?: (plan: ReturnType<typeof buildPileQuestionSetHydrationPlan>) => void;
} = {}) => {
  if (shouldAbortRequest(requestEpoch)) return null;

  const hydrationPlan = buildPileQuestionSetHydrationPlan({
    requestEpoch,
    resultSignature,
    lastResultSignature,
    initializeResponses,
    forceOverwriteDraft,
    resetAutoDecryptLedger,
    autoDecryptReason,
    autoDecryptResetReason,
  });

  if (hydrationPlan.shouldSkipDuplicateSignature) {
    onNoop(hydrationPlan);
    return hydrationPlan;
  }
  if (hydrationPlan.shouldUpdateResultSignature) {
    setLastResultSignature(hydrationPlan.nextResultSignature);
  }

  const continueHydration = () => {
    rehydrateVisiblePileWindow(hydrationPlan.rehydrateOptions);
  };

  if (!hydrationPlan.shouldInitializeResponses) {
    continueHydration();
    return hydrationPlan;
  }

  initializeResponseState(continueHydration);
  return hydrationPlan;
};
