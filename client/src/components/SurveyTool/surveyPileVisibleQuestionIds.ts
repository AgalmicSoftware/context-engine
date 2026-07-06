export type PileVisibleQuestionIdsInput = {
  activePileIndex?: unknown;
  normalizeQuestionIdKey: (value: unknown) => string;
  pileQuestions?: unknown;
  visibleAfter?: number;
  visibleBefore?: number;
};

export const buildPileVisibleQuestionIds = ({
  activePileIndex = 0,
  normalizeQuestionIdKey,
  pileQuestions = [],
  visibleAfter = 2,
  visibleBefore = 2,
}: PileVisibleQuestionIdsInput): string[] => {
  const list = Array.isArray(pileQuestions) ? pileQuestions : [];
  if (list.length === 0) return [];
  const activeIndex = Math.max(0, Number(activePileIndex || 0));
  const startIdx = Math.max(0, activeIndex - visibleBefore);
  const endIdx = Math.min(list.length, activeIndex + visibleAfter + 1);
  const ids: string[] = [];
  for (let idx = startIdx; idx < endIdx; idx += 1) {
    const qid = normalizeQuestionIdKey((list[idx] as { id?: unknown } | undefined)?.id);
    if (!qid) continue;
    ids.push(qid);
  }
  return Array.from(new Set(ids));
};
