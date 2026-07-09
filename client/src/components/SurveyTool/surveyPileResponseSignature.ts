export type PileVisibleResponseSignatureDeps = {
  buildSliceToken: (value: unknown) => string;
  mixQuestionListHash: (seed: number, text: unknown) => number;
  normalizeQuestionIdKey: (value: unknown) => string;
};

export type PileVisibleResponseSignatureInput = {
  account?: unknown;
  deps: PileVisibleResponseSignatureDeps;
  questionResponses?: unknown;
  visibleIds?: unknown;
};

export const buildPileVisibleResponseSignature = ({
  account = '',
  deps,
  questionResponses = {},
  visibleIds = [],
}: PileVisibleResponseSignatureInput): string => {
  const responderLower = String(account || '')
    .trim()
    .toLowerCase();
  const ids = Array.isArray(visibleIds) ? visibleIds.map((id) => deps.normalizeQuestionIdKey(id)).filter(Boolean) : [];
  if (!responderLower || ids.length === 0) {
    return `${responderLower ? 'acct' : 'anon'}:${ids.length}:0`;
  }
  const responsesMap =
    questionResponses && typeof questionResponses === 'object' ? (questionResponses as Record<string, unknown>) : {};
  let hash = 2166136261;
  let filled = 0;
  ids.forEach((qid) => {
    hash = deps.mixQuestionListHash(hash, `q:${qid}`);
    const byResponder = responsesMap[qid];
    const rawResponse =
      byResponder && typeof byResponder === 'object'
        ? (byResponder as Record<string, unknown>)[responderLower]
        : undefined;
    if (rawResponse === undefined) {
      hash = deps.mixQuestionListHash(hash, 'r:__none__');
      return;
    }
    filled += 1;
    if (typeof rawResponse === 'string') {
      hash = deps.mixQuestionListHash(hash, `s:${rawResponse.length}:${rawResponse}`);
      return;
    }
    hash = deps.mixQuestionListHash(hash, `o:${deps.buildSliceToken(rawResponse)}`);
  });
  return `${ids.length}:${filled}:${hash >>> 0}`;
};
