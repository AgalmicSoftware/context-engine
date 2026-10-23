import { ethers } from 'ethers';
import { getVoiceCredits, validateQuadraticAllocation, validateQuadraticQuestion } from '../../shared/questions/quadraticAllocation.mjs';
import { normalizeRatingScale } from '../../shared/questions/ratingScale.mjs';

// Builds the same stored records the web client writes for a passkey
// participant in a Worker-hosted session, plus a self-declared agent marker.
// Keep in step with client/src/components/SurveyTool/surveyToolResponsePayloadController.ts
// (pile response records) and CreateQuestionsAndSurveys.tsx (question records);
// tests/root/agentParticipant.hydration.test.js checks them against the client.

export const QUESTION_TYPES = Object.freeze(['binary', 'rating', 'multichoice', 'quadratic', 'freeform']);
export const BINARY_ANSWERS = Object.freeze(['Agree', 'Unsure', 'Disagree']);
const MAX_PROMPT_LENGTH = 1000;
const MAX_OPTION_LENGTH = 200;
const MAX_OPTIONS = 12;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 40;
const MAX_FREEFORM_LENGTH = 8000;
const MAX_COMMENT_LENGTH = 4000;

const trim = (value) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const fail = (error) => ({ ok: false, error });

/** Same derivation as client/src/utilities/shared/questionUtils.mjs generateQuestionId. */
export const generateQuestionId = (type, prompt, options = [], singleSelect = false, voiceCredits = 99) => {
  let dataToHash = `${type}:${(prompt || '').trim().toLowerCase()}`;
  const validOptions = Array.isArray(options)
    ? options.filter((option) => typeof option === 'string' && option.trim() !== '')
    : [];
  if (type === 'multichoice') {
    if (validOptions.length > 0) dataToHash += `:${validOptions.map((option) => option.trim()).join(',').toLowerCase()}`;
    if (singleSelect) dataToHash += ':single';
  }
  if (type === 'quadratic') {
    dataToHash += `:${JSON.stringify(validOptions.map((option) => option.trim().toLowerCase()))}:${voiceCredits}`;
  }
  return ethers.utils.id(dataToHash);
};

export const ratingScaleFor = (question = {}) => normalizeRatingScale(question) || { min: 0, max: 10, minLabel: '0', maxLabel: '10' };

const optionsOf = (question) => (Array.isArray(question.options) ? question.options.filter((option) => typeof option === 'string') : []);
// Older questions marked single choice as oneSelectionOnly; the web client honours both.
export const isSingleSelect = (question) =>
  question.singleSelect === true || question.oneSelectionOnly === true || question.singleChoice === true;

// Same test as the web client's isLockedQuestionPayload: gated questions keep
// their text encrypted and need gated (encrypted) answers, which agents cannot
// write yet.
export const isLockedQuestion = (question) =>
  question?.locked === true ||
  !!question?.promptEncrypted ||
  (!!question?.encryption && typeof question.encryption === 'object') ||
  (typeof question?.prompt === 'string' && question.prompt.trim() === '[encrypted]');

export const normalizeRecruitmentSource = (value) => {
  const normalized = (typeof value === 'string' ? value : '').trim().replace(/\s+/g, '-').slice(0, 128);
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(normalized) ? normalized : '';
};

const matchOption = (options, value) => {
  const wanted = trim(value).toLowerCase();
  return options.find((option) => option.trim().toLowerCase() === wanted);
};

const readScore = (value, field) => {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 10) return fail(`${field} must be a whole number from 0 to 10.`);
  return { ok: true, value: number };
};

/** Validates an agent's answer against the question and returns the stored value. */
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

const plaintextField = (value, hash) => ({
  value,
  encrypted: false,
  encryptionAudience: 'self',
  encryptionGateId: null,
  audienceMode: 'explicit',
  hash,
  encryptedPortion: '',
});

const textHash = (value) => (typeof value === 'string' && value ? ethers.utils.id(value) : '');

/** Self-declared participant marker stored with agent answers and statements. */
export const buildParticipantMarker = ({ modelId = '', platform = '' } = {}) => ({
  kind: 'agent',
  ...(trim(modelId) ? { modelId: trim(modelId) } : {}),
  ...(trim(platform) ? { platform: trim(platform) } : {}),
  verification: 'self_reported',
});

/**
 * Builds one response record. Returns { ok, record } or { ok: false, error }.
 * `session` is { sessionSlug, sessionId }; `profile` is { displayName, modelId, platform }.
 */
export const buildResponseRecord = ({
  question,
  value,
  comment = '',
  importance,
  conviction,
  responder,
  session,
  profile = {},
  recruitmentSource = '',
}) => {
  if (!isRecord(question) || !trim(question.id)) return fail('Unknown question.');
  if (isLockedQuestion(question)) return fail('This question is locked to certain members; agents cannot answer locked questions yet.');
  const answer = normalizeAnswerValue(question, value);
  if (!answer.ok) return answer;
  const note = trim(comment);
  if (note.length > MAX_COMMENT_LENGTH) return fail(`Comments must be ${MAX_COMMENT_LENGTH} characters or fewer.`);
  const convictionScore = readScore(conviction, 'Conviction');
  if (!convictionScore.ok) return convictionScore;
  const importanceScore = readScore(importance, 'Importance');
  if (!importanceScore.ok) return importanceScore;
  const displayName = trim(profile.displayName);
  return {
    ok: true,
    record: {
      questionID: trim(question.id).toLowerCase(),
      responder: ethers.utils.getAddress(responder),
      type: question.type,
      prompt: typeof question.prompt === 'string' ? question.prompt : '',
      conviction: convictionScore.value,
      importance: importanceScore.value ?? convictionScore.value,
      // The web client hashes only freeform answers; choices and numbers keep ''.
      answer: plaintextField(answer.value, question.type === 'freeform' ? textHash(answer.value) : ''),
      additional: plaintextField(note, textHash(note)),
      ...(normalizeRecruitmentSource(recruitmentSource) ? { recruitment: { source: normalizeRecruitmentSource(recruitmentSource) } } : {}),
      ...(displayName ? { responderName: displayName } : {}),
      participant: buildParticipantMarker(profile),
      sessionId: session.sessionId,
      sessionSlug: session.sessionSlug,
    },
  };
};

const normalizeOptionList = (options) => {
  const list = (Array.isArray(options) ? options : []).map(trim).filter(Boolean);
  if (list.length < 2) return fail('Provide at least two options.');
  if (list.length > MAX_OPTIONS) return fail(`Provide at most ${MAX_OPTIONS} options.`);
  if (list.some((option) => option.length > MAX_OPTION_LENGTH)) return fail(`Options must be ${MAX_OPTION_LENGTH} characters or fewer.`);
  if (new Set(list.map((option) => option.toLowerCase())).size !== list.length) return fail('Options must be unique.');
  return { ok: true, value: list };
};

/**
 * Builds one question record for a new statement. Returns { ok, id, record }.
 * `session` is { sessionSlug, sessionId, sessionName }.
 */
export const buildQuestionRecord = ({ type = 'binary', prompt, options, singleSelect = false, voiceCredits, tags = [], creator, session, profile = {} }) => {
  if (!QUESTION_TYPES.includes(type)) return fail(`Question type must be one of: ${QUESTION_TYPES.join(', ')}.`);
  // Stored as written (trimmed), like the web client, so ids match its hashing.
  const text = trim(prompt);
  if (!text) return fail('The statement text is empty.');
  if (text.length > MAX_PROMPT_LENGTH) return fail(`Statements must be ${MAX_PROMPT_LENGTH} characters or fewer.`);
  const record = { id: '', type, prompt: text };
  let optionList = [];
  if (type === 'multichoice' || type === 'quadratic') {
    const normalized = normalizeOptionList(options);
    if (!normalized.ok) return normalized;
    optionList = normalized.value;
    record.options = optionList;
  }
  if (type === 'multichoice') record.singleSelect = singleSelect === true;
  let credits = 99;
  if (type === 'quadratic') {
    credits = voiceCredits === undefined || voiceCredits === null ? 99 : Number(voiceCredits);
    record.voiceCredits = credits;
    const error = validateQuadraticQuestion(record);
    if (error) return fail(error);
  }
  const tagList = (Array.isArray(tags) ? tags : []).map(trim).filter(Boolean);
  if (tagList.length > MAX_TAGS || tagList.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    return fail(`Use at most ${MAX_TAGS} tags of ${MAX_TAG_LENGTH} characters or fewer.`);
  }
  record.tags = tagList;
  record.creator = ethers.utils.getAddress(creator);
  record.associatedSurveyId = ethers.constants.HashZero;
  record.participant = buildParticipantMarker(profile);
  record.sessionName = trim(session.sessionName) || session.sessionSlug;
  record.sessionSlug = session.sessionSlug;
  record.sessionId = session.sessionId;
  record.id = generateQuestionId(type, text, optionList, record.singleSelect === true, credits);
  return { ok: true, id: record.id, record };
};
