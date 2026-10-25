export const DEFAULT_INTERVIEW_SETTINGS = Object.freeze({
  openingMode: 'auto',
  openingPrompt: '',
  steeringPrompt: '',
  autoRegenerate: false,
  questionGrowthPercent: 20,
  followNewQuestions: false,
  suggestQuestions: false,
  allowManualRefresh: true,
  shareDraftChangesByDefault: false,
  researchDetail: 'minimal',
  hiddenDraftShare: 0,
});
// At most half of a person's AI drafts can be hidden, so most stay useful to them.
const MAX_HIDDEN_DRAFT_SHARE = 0.5;
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
    shareDraftChangesByDefault: source.shareDraftChangesByDefault === true,
    // How much an AI draft comparison saves: 'minimal' keeps no AI notes or drafted text.
    researchDetail: source.researchDetail === 'full' ? 'full' : 'minimal',
    // Share of a person's AI prefill drafts hidden until they answer, which measures anchoring.
    hiddenDraftShare: Number.isFinite(source.hiddenDraftShare)
      ? Math.max(0, Math.min(MAX_HIDDEN_DRAFT_SHARE, source.hiddenDraftShare))
      : 0,
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
  if (value.researchDetail !== undefined && !['minimal', 'full'].includes(value.researchDetail)) return false;
  if (
    value.hiddenDraftShare !== undefined &&
    (!Number.isFinite(value.hiddenDraftShare) ||
      value.hiddenDraftShare < 0 ||
      value.hiddenDraftShare > MAX_HIDDEN_DRAFT_SHARE)
  )
    return false;
  return ['autoRegenerate', 'followNewQuestions', 'suggestQuestions', 'allowManualRefresh', 'shareDraftChangesByDefault'].every(
    (key) => value[key] === undefined || typeof value[key] === 'boolean',
  );
};
export const hasInterviewQuestionGrowth = (baseline, currentCount, percent) =>
  currentCount >= baseline + Math.max(1, Math.ceil((baseline * percent) / 100));
