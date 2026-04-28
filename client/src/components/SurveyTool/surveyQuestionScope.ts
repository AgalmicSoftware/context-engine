type QuestionLike = {
  id?: unknown;
} | null | undefined;

const toQuestionList = (list: unknown): QuestionLike[] => (
  Array.isArray(list) ? list : []
);

export const buildRenderedQuestionIdsFromQuestionPools = ({
  questionPool,
  pileQuestions,
}: {
  questionPool?: unknown;
  pileQuestions?: unknown;
} = {}): unknown[] => {
  const ids = new Set<unknown>();

  toQuestionList(questionPool).forEach((question) => {
    if (question?.id) ids.add(question.id);
  });

  toQuestionList(pileQuestions).forEach((question) => {
    if (question?.id) ids.add(question.id);
  });

  return Array.from(ids);
};

export const buildRenderedQuestionIdsFromPileWindow = ({
  pileQuestions,
  activePileIndex = 0,
  visibleBefore = 2,
  visibleAfter = 2,
}: {
  pileQuestions?: unknown;
  activePileIndex?: unknown;
  visibleBefore?: unknown;
  visibleAfter?: unknown;
} = {}): unknown[] => {
  const questions = toQuestionList(pileQuestions);
  const activeIndex = Math.max(0, Math.floor(Number(activePileIndex) || 0));
  const beforeCount = Math.max(0, Math.floor(Number(visibleBefore) || 0));
  const afterCount = Math.max(0, Math.floor(Number(visibleAfter) || 0));
  const startIdx = Math.max(0, activeIndex - beforeCount);
  const endIdx = Math.min(questions.length, activeIndex + afterCount + 1);
  const ids: unknown[] = [];

  for (let idx = startIdx; idx < endIdx; idx += 1) {
    const id = questions[idx]?.id;
    if (id) ids.push(id);
  }

  return ids;
};

export const buildInitialSurveyResponseQuestionIds = ({
  singleQuestionMode = false,
  isStandalone = false,
  questionPoolIds,
  questionId,
  getRenderedQuestionIds = null,
  stateQuestionPool,
}: {
  singleQuestionMode?: boolean;
  isStandalone?: boolean;
  questionPoolIds?: unknown;
  questionId?: unknown;
  getRenderedQuestionIds?: (() => unknown) | null;
  stateQuestionPool?: unknown;
} = {}): unknown[] => {
  const nextQuestionPoolIds = Array.isArray(questionPoolIds) ? questionPoolIds : [];

  if (singleQuestionMode) {
    return nextQuestionPoolIds.length > 0 ? nextQuestionPoolIds : [questionId];
  }

  if (isStandalone) {
    if (nextQuestionPoolIds.length > 0) return nextQuestionPoolIds;
    const renderedQuestionIds =
      typeof getRenderedQuestionIds === 'function' ? getRenderedQuestionIds() : [];
    return Array.isArray(renderedQuestionIds) ? renderedQuestionIds : [];
  }

  const renderedQuestionIds =
    typeof getRenderedQuestionIds === 'function' ? getRenderedQuestionIds() : [];
  if (Array.isArray(renderedQuestionIds) && renderedQuestionIds.length > 0) {
    return renderedQuestionIds;
  }

  return toQuestionList(stateQuestionPool).map((question) => question?.id);
};
