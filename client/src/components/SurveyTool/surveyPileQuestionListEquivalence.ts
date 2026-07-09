export type PileQuestionListEquivalenceInput = {
  getQuestionObjectSignature: (question: unknown) => string;
  left?: unknown;
  right?: unknown;
};

export const arePileQuestionListsEquivalent = ({
  getQuestionObjectSignature,
  left = [],
  right = [],
}: PileQuestionListEquivalenceInput): boolean => {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftId = String(left[index]?.id || '')
      .trim()
      .toLowerCase();
    const rightId = String(right[index]?.id || '')
      .trim()
      .toLowerCase();
    if (leftId !== rightId) return false;
    const leftSig = getQuestionObjectSignature(left[index]);
    const rightSig = getQuestionObjectSignature(right[index]);
    if (leftSig !== rightSig) return false;
  }
  return true;
};
