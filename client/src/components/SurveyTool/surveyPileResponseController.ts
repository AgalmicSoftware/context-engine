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

type PileResponseValueShape = {
  answers?: Record<string, unknown> | null;
  importance?: Record<string, unknown> | null;
  conviction?: Record<string, unknown> | null;
  additionalComments?: Record<string, unknown> | null;
};

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

export const hasPileResponseSliceValues = (slice: PileResponseValueShape | null | undefined): boolean => {
  if (!slice || typeof slice !== 'object') return false;
  return (
    Object.keys(slice.answers || {}).length > 0 ||
    Object.keys(slice.additionalComments || {}).length > 0 ||
    Object.keys(slice.importance || {}).length > 0 ||
    Object.keys(slice.conviction || {}).length > 0
  );
};

export const shouldInitializePileResponses = ({
  submissionComplete = false,
  currentSlice = null,
}: {
  submissionComplete?: boolean;
  currentSlice?: PileResponseValueShape | null;
} = {}): boolean => !submissionComplete && !hasPileResponseSliceValues(currentSlice);

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
