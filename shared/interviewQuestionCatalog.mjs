import { hasRatingScaleMetadata, normalizeRatingScale } from './questions/ratingScale.mjs';

export { hasRatingScaleMetadata, normalizeRatingScale };

const BINARY_RESPONSE_OPTIONS = ['Agree', 'Unsure', 'Disagree'];

const trim = (value) => String(value == null ? '' : value).trim();
const lower = (value) => trim(value).toLowerCase();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export const hasRestrictedPrompt = (question = {}) => {
  const visibility = lower(question.visibility || question.access || question.questionVisibility);
  return Boolean(
    question.promptEncrypted ||
    question.encryptedPrompt ||
    question.locked === true ||
    question.gated === true ||
    question.gate ||
    (Array.isArray(question.gates) && question.gates.length) ||
    /private|locked|gated|encrypted/.test(visibility),
  );
};

export const normalizeQuestion = (value = {}) => {
  const question = isObj(value) ? value : {};
  const id = lower(question.id || question.questionId);
  const prompt = trim(question.prompt || question.question || question.title);
  if (
    !id ||
    !prompt ||
    hasRestrictedPrompt(question) ||
    /^(?:\[encrypted\]|encrypted prompt[.!]?(?:\s*connect.+decrypt[.!]?)?|connect(?: wallet)? to decrypt(?: encrypted prompt)?[.!]?)$/i.test(
      prompt,
    )
  )
    return null;
  const type = lower(question.type || question.questionType || 'freeform') || 'freeform';
  const rawOptions = question.options || question.choices;
  const options =
    type === 'binary'
      ? [...BINARY_RESPONSE_OPTIONS]
      : (Array.isArray(rawOptions) ? rawOptions : [])
          .map((entry) => trim(isObj(entry) ? entry.label || entry.value : entry))
          .filter(Boolean);
  const ratingScale = type === 'rating' ? normalizeRatingScale(question) : null;
  return {
    id,
    prompt,
    type,
    options,
    ...(type === 'multichoice'
      ? { singleSelect: Boolean(question.singleSelect || question.oneSelectionOnly || question.singleChoice) }
      : {}),
    ...(ratingScale ? { scale: ratingScale } : {}),
    ...(type === 'quadratic' ? { voiceCredits: Number(question.voiceCredits ?? 99) } : {}),
  };
};

export const normalizePublicInterviewQuestions = (input = [], limit = Infinity) => {
  const questions = Array.isArray(input) ? input : [];
  const seen = new Set();
  return questions
    .map(normalizeQuestion)
    .filter((question) => {
      if (!question || seen.has(question.id)) return false;
      seen.add(question.id);
      return true;
    })
    .slice(0, limit);
};
