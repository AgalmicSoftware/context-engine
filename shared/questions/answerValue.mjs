import { getVoiceCredits, validateQuadraticAllocation } from './quadraticAllocation.mjs';
import { normalizeRatingScale } from './ratingScale.mjs';

// What each question type accepts as an answer: the MCP server checks its
// agents' answers with this, and the AI discourse benchmark its models'.

export const QUESTION_TYPES = Object.freeze(['binary', 'rating', 'multichoice', 'quadratic', 'freeform']);
export const BINARY_ANSWERS = Object.freeze(['Agree', 'Unsure', 'Disagree']);
const MAX_FREEFORM_LENGTH = 8000;

const trim = (value) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const fail = (error) => ({ ok: false, error });

export const ratingScaleFor = (question = {}) => normalizeRatingScale(question) || { min: 0, max: 10, minLabel: '0', maxLabel: '10' };

export const optionsOf = (question) => (Array.isArray(question.options) ? question.options.filter((option) => typeof option === 'string') : []);
// Older questions marked single choice as oneSelectionOnly; the web client honours both.
export const isSingleSelect = (question) =>
  question.singleSelect === true || question.oneSelectionOnly === true || question.singleChoice === true;

const matchOption = (options, value) => {
  const wanted = trim(value).toLowerCase();
  return options.find((option) => option.trim().toLowerCase() === wanted);
};

/** Checks an answer against its question and returns the value to store, or why it can't be. */
export const normalizeAnswerValue = (question = {}, value) => {
  switch (question.type) {
    case 'binary': {
      const match = BINARY_ANSWERS.find((answer) => answer.toLowerCase() === trim(value).toLowerCase());
      return match ? { ok: true, value: match } : fail('Binary answers must be "Agree", "Unsure", or "Disagree".');
    }
    case 'rating': {
      const scale = ratingScaleFor(question);
      const number = typeof value === 'string' && trim(value) !== '' ? Number(value) : value;
      if (!Number.isInteger(number) || number < scale.min || number > scale.max) {
        return fail(`Rating answers must be a whole number from ${scale.min} to ${scale.max}.`);
      }
      return { ok: true, value: number };
    }
    case 'multichoice': {
      const options = optionsOf(question);
      const picks = Array.isArray(value) ? value : [value];
      const chosen = [];
      for (const pick of picks) {
        const option = matchOption(options, pick);
        if (!option) return fail(`"${trim(pick)}" is not one of this question's options: ${options.join(' | ')}`);
        if (!chosen.includes(option)) chosen.push(option);
      }
      if (!chosen.length) return fail('Choose at least one option.');
      if (isSingleSelect(question) && chosen.length !== 1) return fail('This question accepts exactly one option.');
      const max = Number(question.maxSelections);
      if (Number.isInteger(max) && max > 0 && chosen.length > max) return fail(`Choose at most ${max} options.`);
      return { ok: true, value: chosen };
    }
    case 'quadratic': {
      const votes = Array.isArray(value) ? value.map((vote) => (typeof vote === 'string' && trim(vote) !== '' ? Number(vote) : vote)) : value;
      const error = validateQuadraticAllocation(votes, question);
      if (error) {
        return fail(`${error} Options in order: ${optionsOf(question).join(' | ')}; budget ${getVoiceCredits(question)} credits (sum of squared votes).`);
      }
      return { ok: true, value: votes };
    }
    case 'freeform': {
      const text = trim(value);
      if (!text) return fail('Freeform answers must be non-empty text.');
      if (text.length > MAX_FREEFORM_LENGTH) return fail(`Freeform answers must be ${MAX_FREEFORM_LENGTH} characters or fewer.`);
      return { ok: true, value: text };
    }
    default:
      return fail(`Unsupported question type "${trim(question.type)}".`);
  }
};
