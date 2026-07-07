type PileQuestionLike =
  | {
      id?: unknown;
    }
  | null
  | undefined;

type ResponseFieldState = Record<string, unknown>;

export type PileResponseSlice = {
  answers: Record<string, ResponseFieldState>;
  importance: Record<string, unknown>;
  conviction: Record<string, unknown>;
  additionalComments: Record<string, ResponseFieldState>;
};

export type BuildEmptyResponseFieldState = (questionId?: string | null, fieldKey?: string) => ResponseFieldState;

export type PileVisibleResponseWindow = {
  startIdx: number;
  endIdx: number;
  visibleQuestions: PileQuestionLike[];
  visibleIdsSignature: string;
};

export type InitializePileResponseStatePlan = {
  shouldSkip: boolean;
  reason: 'dirty' | 'unchanged' | 'initialize';
  nextInitializeResponseSig: string;
  initialSlice: PileResponseSlice | null;
  visibleWindow: PileVisibleResponseWindow;
};

export type EnsureVisiblePileResponseStatePlan = {
  shouldSkip: boolean;
  reason: 'empty-window' | 'already-ready' | 'backfill';
  updates: {
    surveysResponseState?: PileResponseSlice[];
    editBaseline?: PileResponseSlice;
  } | null;
  visibleWindow: PileVisibleResponseWindow;
};

const EMPTY_PILE_RESPONSE_SLICE = (): PileResponseSlice => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
});

const toQuestionList = (pileQuestions: unknown): PileQuestionLike[] =>
  Array.isArray(pileQuestions) ? pileQuestions : [];

const normalizeQuestionId = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const cloneResponseSlice = (slice: Partial<PileResponseSlice> | null | undefined): PileResponseSlice => ({
  answers: { ...((slice && slice.answers) || {}) },
  importance: { ...((slice && slice.importance) || {}) },
  conviction: { ...((slice && slice.conviction) || {}) },
  additionalComments: { ...((slice && slice.additionalComments) || {}) },
});

export const buildPileResponseWindow = ({
  pileQuestions = [],
  activePileIndex = 0,
  visibleBefore = 2,
  visibleAfter = 2,
}: {
  pileQuestions?: unknown;
  activePileIndex?: unknown;
  visibleBefore?: unknown;
  visibleAfter?: unknown;
} = {}): PileVisibleResponseWindow => {
  const questions = toQuestionList(pileQuestions);
  const activeIndex = Math.max(0, Math.floor(Number(activePileIndex) || 0));
  const beforeCount = Math.max(0, Math.floor(Number(visibleBefore) || 0));
  const afterCount = Math.max(0, Math.floor(Number(visibleAfter) || 0));
  const startIdx = Math.max(0, activeIndex - beforeCount);
  const endIdx = Math.min(questions.length, activeIndex + afterCount + 1);
  const visibleQuestions = questions.slice(startIdx, endIdx);
  const visibleIdsSignature = visibleQuestions
    .map((question) => normalizeQuestionId(question?.id))
    .filter(Boolean)
    .join('|');

  return {
    startIdx,
    endIdx,
    visibleQuestions,
    visibleIdsSignature,
  };
};

export const buildInitializePileResponseStatePlan = ({
  isDirty = false,
  modifiedCount = 0,
  pileQuestions = [],
  activePileIndex = 0,
  lastInitializeResponseSig = '',
  buildEmptyResponseFieldState = () => ({ value: '' }),
}: {
  isDirty?: boolean;
  modifiedCount?: unknown;
  pileQuestions?: unknown;
  activePileIndex?: unknown;
  lastInitializeResponseSig?: string | null;
  buildEmptyResponseFieldState?: BuildEmptyResponseFieldState;
} = {}): InitializePileResponseStatePlan => {
  const visibleWindow = buildPileResponseWindow({
    pileQuestions,
    activePileIndex,
  });
  const nextInitializeResponseSig = visibleWindow.visibleIdsSignature;

  if (isDirty || Number(modifiedCount || 0) > 0) {
    return {
      shouldSkip: true,
      reason: 'dirty',
      nextInitializeResponseSig,
      initialSlice: null,
      visibleWindow,
    };
  }

  if (nextInitializeResponseSig === String(lastInitializeResponseSig || '')) {
    return {
      shouldSkip: true,
      reason: 'unchanged',
      nextInitializeResponseSig,
      initialSlice: null,
      visibleWindow,
    };
  }

  const initialSlice = EMPTY_PILE_RESPONSE_SLICE();
  visibleWindow.visibleQuestions.forEach((question) => {
    const questionId = question?.id;
    if (!questionId) return;
    const qid = String(questionId);
    initialSlice.answers[qid] = buildEmptyResponseFieldState(qid);
    initialSlice.additionalComments[qid] = buildEmptyResponseFieldState(qid, 'additional');
  });

  return {
    shouldSkip: false,
    reason: 'initialize',
    nextInitializeResponseSig,
    initialSlice,
    visibleWindow,
  };
};

export const buildEnsureVisiblePileResponseStatePlan = ({
  pileQuestions = [],
  activePileIndex = 0,
  currentSlice = null,
  currentBaseline = null,
  buildEmptyResponseFieldState = () => ({ value: '' }),
}: {
  pileQuestions?: unknown;
  activePileIndex?: unknown;
  currentSlice?: Partial<PileResponseSlice> | null;
  currentBaseline?: Partial<PileResponseSlice> | null;
  buildEmptyResponseFieldState?: BuildEmptyResponseFieldState;
} = {}): EnsureVisiblePileResponseStatePlan => {
  const visibleWindow = buildPileResponseWindow({
    pileQuestions,
    activePileIndex,
  });

  if (visibleWindow.visibleQuestions.length === 0) {
    return {
      shouldSkip: true,
      reason: 'empty-window',
      updates: null,
      visibleWindow,
    };
  }

  const normalizedSlice = cloneResponseSlice(currentSlice);
  let needsBackfill = false;
  for (const question of visibleWindow.visibleQuestions) {
    const questionId = question?.id;
    if (!questionId) continue;
    const qid = String(questionId);
    if (!normalizedSlice.answers[qid] || !normalizedSlice.additionalComments[qid]) {
      needsBackfill = true;
      break;
    }
  }

  if (!needsBackfill) {
    return {
      shouldSkip: true,
      reason: 'already-ready',
      updates: null,
      visibleWindow,
    };
  }

  const nextSlice = cloneResponseSlice(currentSlice);
  const nextBaseline = cloneResponseSlice(currentBaseline);
  let sliceChanged = false;
  let baselineChanged = false;

  visibleWindow.visibleQuestions.forEach((question) => {
    const questionId = question?.id;
    if (!questionId) return;
    const qid = String(questionId);

    if (!nextSlice.answers[qid]) {
      nextSlice.answers[qid] = buildEmptyResponseFieldState(qid);
      sliceChanged = true;
    }
    if (!nextBaseline.answers[qid]) {
      nextBaseline.answers[qid] = buildEmptyResponseFieldState(qid);
      baselineChanged = true;
    }
    if (!nextSlice.additionalComments[qid]) {
      nextSlice.additionalComments[qid] = buildEmptyResponseFieldState(qid, 'additional');
      sliceChanged = true;
    }
    if (!nextBaseline.additionalComments[qid]) {
      nextBaseline.additionalComments[qid] = buildEmptyResponseFieldState(qid, 'additional');
      baselineChanged = true;
    }
  });

  const updates: {
    surveysResponseState?: PileResponseSlice[];
    editBaseline?: PileResponseSlice;
  } = {};

  if (sliceChanged) updates.surveysResponseState = [nextSlice];
  if (baselineChanged) updates.editBaseline = nextBaseline;

  return {
    shouldSkip: false,
    reason: 'backfill',
    updates,
    visibleWindow,
  };
};
