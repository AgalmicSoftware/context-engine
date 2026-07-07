/**
 * @module questionResponsesWatermark
 * @description Response watermarking — tracks the high-water mark of submitted question responses
 *              per session to detect new responses since last visit.
 *
 * Key exports: resolvePersistedQuestionResponsesWatermark
 */
type PersistedQuestionResponsesWatermarkInput = {
  floorBlock?: number | string | null;
  processedToBlock?: number | string | null;
};

const toFiniteNumberOr = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

// Final question-response watermark must reflect persisted progress only.
export const resolvePersistedQuestionResponsesWatermark = ({
  floorBlock = 0,
  processedToBlock = 0,
}: PersistedQuestionResponsesWatermarkInput = {}): number =>
  Math.max(toFiniteNumberOr(floorBlock, 0), toFiniteNumberOr(processedToBlock, 0));
