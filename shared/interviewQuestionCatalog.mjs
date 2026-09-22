const BINARY_RESPONSE_OPTIONS = ['Agree', 'Unsure', 'Disagree'];

const trim = (value) => String(value == null ? '' : value).trim();
const lower = (value) => trim(value).toLowerCase();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const RATING_SCALE_METADATA_KEYS = [
  'min',
  'minimum',
  'max',
  'maximum',
  'minLabel',
  'lowLabel',
  'maxLabel',
  'highLabel',
];

const hasMetadataValue = (value) => value !== undefined && value !== null && trim(value) !== '';

const recordHasRatingScaleMetadata = (record = {}) =>
  RATING_SCALE_METADATA_KEYS.some((key) => hasMetadataValue(record[key]));

const pickRatingScaleRecord = (question = {}) => {
  const scale = isObj(question.scale) ? question.scale : null;
  if (scale && recordHasRatingScaleMetadata(scale)) return scale;
  const ratingScale = isObj(question.ratingScale) ? question.ratingScale : null;
  if (ratingScale && recordHasRatingScaleMetadata(ratingScale)) return ratingScale;
  return scale || ratingScale || question;
};

export const hasRatingScaleMetadata = (question = {}) =>
  recordHasRatingScaleMetadata(pickRatingScaleRecord(question)) || recordHasRatingScaleMetadata(question);

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeRatingLabel = (value, fallback) => {
  const label = trim(value);
  return label || String(fallback);
};

export const normalizeRatingScale = (question = {}) => {
  if (!hasRatingScaleMetadata(question)) return null;

  const scale = pickRatingScaleRecord(question);
  const min = toFiniteNumber(scale.min ?? scale.minimum ?? question.min ?? question.minimum);
  const max = toFiniteNumber(scale.max ?? scale.maximum ?? question.max ?? question.maximum);
  const normalizedMin = min ?? 0;
  const normalizedMax = max ?? 10;
  if (normalizedMax <= normalizedMin) {
    return { min: 0, max: 10, minLabel: '0', maxLabel: '10' };
  }
  return {
    min: normalizedMin,
    max: normalizedMax,
    minLabel: normalizeRatingLabel(
      scale.minLabel ?? scale.lowLabel ?? question.minLabel ?? question.lowLabel,
      normalizedMin,
    ),
    maxLabel: normalizeRatingLabel(
      scale.maxLabel ?? scale.highLabel ?? question.maxLabel ?? question.highLabel,
      normalizedMax,
    ),
  };
};

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
