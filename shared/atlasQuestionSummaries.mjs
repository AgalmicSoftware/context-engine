// The session setting `atlasQuestionSummaries`: how a debate atlas build
// summarises each question (workers/sessionCorsWorker/debateAtlasBuild.js).
// Every key is optional; a key left out keeps its default. The bounds keep
// one call's prompt and the stored build within safe sizes.
export const ATLAS_QUESTION_SUMMARY_SETTINGS = Object.freeze({
  // Each question's call: no less than the 20 seconds a build needs left to
  // start any call, no more than its per-call limit of 120 seconds.
  callSeconds: Object.freeze({ default: 60, min: 20, max: 120 }),
  // Answers one question's call reads, and their text in characters.
  answers: Object.freeze({ default: 200, min: 1, max: 1000 }),
  answerChars: Object.freeze({ default: 60_000, min: 1000, max: 200_000 }),
  // What the build keeps: the summary's length, how many categories (0 for
  // none), and each category's label and sentence (0 for no sentence).
  summaryChars: Object.freeze({ default: 400, min: 100, max: 1000 }),
  categories: Object.freeze({ default: 5, min: 0, max: 10 }),
  labelChars: Object.freeze({ default: 80, min: 20, max: 120 }),
  categorySummaryChars: Object.freeze({ default: 200, min: 0, max: 400 }),
});

const KEYS = Object.keys(ATLAS_QUESTION_SUMMARY_SETTINGS);
const record = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const inBounds = (key, value) => Number.isInteger(value) &&
  value >= ATLAS_QUESTION_SUMMARY_SETTINGS[key].min && value <= ATLAS_QUESTION_SUMMARY_SETTINGS[key].max;

/** A saved setting as set-config keeps it, or why it is refused. */
export const validateAtlasQuestionSummaries = (value) => {
  if (!record(value)) return { ok: false, error: 'atlasQuestionSummaries must be an object.' };
  const unknown = Object.keys(value).find((key) => !KEYS.includes(key));
  if (unknown) return { ok: false, error: `atlasQuestionSummaries has no setting ${unknown}.` };
  const wrong = KEYS.find((key) => key in value && !inBounds(key, value[key]));
  if (wrong) {
    const { min, max } = ATLAS_QUESTION_SUMMARY_SETTINGS[wrong];
    return { ok: false, error: `atlasQuestionSummaries.${wrong} must be a whole number from ${min} to ${max}.` };
  }
  return { ok: true, value: Object.fromEntries(KEYS.filter((key) => key in value).map((key) => [key, value[key]])) };
};

/** The settings a build uses: the session's own where valid, else the defaults. */
export const resolveAtlasQuestionSummaries = (config) => {
  const saved = record(config?.atlasQuestionSummaries) ? config.atlasQuestionSummaries : {};
  return Object.fromEntries(KEYS.map((key) => [key, inBounds(key, saved[key]) ? saved[key] : ATLAS_QUESTION_SUMMARY_SETTINGS[key].default]));
};
