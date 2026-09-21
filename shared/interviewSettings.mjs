export const DEFAULT_INTERVIEW_SETTINGS = Object.freeze({
  openingMode: 'auto',
  openingPrompt: '',
  steeringPrompt: '',
  autoRegenerate: false,
  questionGrowthPercent: 20,
  followNewQuestions: false,
  suggestQuestions: false,
  allowManualRefresh: true,
});
export const normalizeInterviewSettings = (value = {}) => {
  const source = value && typeof value === 'object' ? value : {};
  return {
    openingMode: source.openingMode === 'owner' ? 'owner' : 'auto',
    openingPrompt: String(source.openingPrompt || '')
      .trim()
      .slice(0, 1200),
    steeringPrompt: String(source.steeringPrompt || '')
      .trim()
      .slice(0, 3000),
    autoRegenerate: source.autoRegenerate === true,
    questionGrowthPercent: Number.isFinite(source.questionGrowthPercent)
      ? Math.max(1, Math.min(100, source.questionGrowthPercent))
      : 20,
    followNewQuestions: source.followNewQuestions === true,
    suggestQuestions: source.suggestQuestions === true,
    allowManualRefresh: source.allowManualRefresh !== false,
  };
};
export const validInterviewSettings = (value = {}) => {
  if (value.openingMode !== undefined && !['auto', 'owner'].includes(value.openingMode)) return false;
  if (
    value.openingPrompt !== undefined &&
    (typeof value.openingPrompt !== 'string' || value.openingPrompt.length > 1200)
  )
    return false;
  if (
    value.steeringPrompt !== undefined &&
    (typeof value.steeringPrompt !== 'string' || value.steeringPrompt.length > 3000)
  )
    return false;
  if (value.openingMode === 'owner' && !value.openingPrompt?.trim()) return false;
  if (
    value.questionGrowthPercent !== undefined &&
    (!Number.isFinite(value.questionGrowthPercent) ||
      value.questionGrowthPercent < 1 ||
      value.questionGrowthPercent > 100)
  )
    return false;
  return ['autoRegenerate', 'followNewQuestions', 'suggestQuestions', 'allowManualRefresh'].every(
    (key) => value[key] === undefined || typeof value[key] === 'boolean',
  );
};
export const hasInterviewQuestionGrowth = (baseline, currentCount, percent) =>
  currentCount >= baseline + Math.max(1, Math.ceil((baseline * percent) / 100));
