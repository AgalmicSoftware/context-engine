import type { BeeswarmPoint } from '../Shared/BeeswarmPlot/BeeswarmPlot';

type CommunityBeeswarmQuestion = {
  label?: unknown;
  questionId?: unknown;
};

type CommunityDivisivenessResult = {
  agrees?: unknown;
  commentIndex?: unknown;
  disagrees?: unknown;
  divisiveness?: unknown;
};

type BuildCommunityBeeswarmPointsOptions = {
  questions?: CommunityBeeswarmQuestion[];
  ratingMatrix?: unknown[][];
  results?: CommunityDivisivenessResult[];
};

const finiteCount = (value: unknown): number => {
  const count = Number(value || 0);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
};

export const buildCommunityBeeswarmPointsFromResults = ({
  questions = [],
  ratingMatrix = [],
  results = [],
}: BuildCommunityBeeswarmPointsOptions = {}): BeeswarmPoint[] =>
  (Array.isArray(results) ? results : []).flatMap((result) => {
    const index = Number(result?.commentIndex);
    if (!Number.isInteger(index) || index < 0) return [];
    const question = questions[index] || {};
    const rowVotes = Array.isArray(ratingMatrix[index]) ? ratingMatrix[index] : [];
    const agrees = finiteCount(result?.agrees);
    const disagrees = finiteCount(result?.disagrees);
    const unsure = rowVotes.filter((vote) => vote === 0).length;
    return [
      {
        agrees,
        disagrees,
        index,
        label: String(question.label || '(No prompt)'),
        questionId: String(question.questionId || index),
        total: agrees + disagrees + unsure,
        unsure,
        // The renderer receives a neutral scalar; Community defines it as 50/50-split divisiveness.
        value: Number.isFinite(Number(result?.divisiveness)) ? Number(result?.divisiveness) : 0,
      },
    ];
  });
