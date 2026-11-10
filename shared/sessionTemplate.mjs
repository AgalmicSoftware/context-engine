import { DEFAULT_AI_MODELS, DEFAULT_TRANSCRIPTION_MODEL } from './aiDefaults.mjs';
import { stableCanonicalSerialize } from './canonicalJson.mjs';
import { looksSecret } from './secretText.mjs';
import { validateSessionContext } from './sessionContext.mjs';
import { DEFAULT_INTERVIEW_SETTINGS, validInterviewSettings } from './interviewSettings.mjs';
import { DEFAULT_REALTIME_INTERVIEW_MODEL, isRealtimeInterviewModel } from './realtimeInterviewConfig.mjs';
import {
  DEFAULT_RESULTS_ANALYSIS_SETTINGS,
  normalizeResultsAnalysisSettings,
  validateResultsAnalysisSettings,
} from './resultsAnalysisSettings.mjs';

// A session setup's portable fields: never secrets, session IDs, Worker URLs,
// admin addresses or recovery keys. Field names follow the setup draft.
export const SESSION_TEMPLATE_FORMAT = 'ce.session-template/v1';
// Pasted, uploaded and unpacked template JSON stops at this size.
export const SESSION_TEMPLATE_MAX_BYTES = 256 * 1024;

const TOO_LARGE = `This template is larger than ${SESSION_TEMPLATE_MAX_BYTES / 1024} KB.`;

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const clone = (value) => JSON.parse(JSON.stringify(value));
const failure = (path, message) => ({ ok: false, errors: [{ path, message }] });
// UTF-8 is never shorter than UTF-16, so long text is refused before encoding.
const utf8Length = (text) =>
  text.length > SESSION_TEMPLATE_MAX_BYTES ? text.length : new TextEncoder().encode(text).byteLength;

// Leaf types; an array holds the shape of its items; an object lists its fields.
const TEXT = 'string';
const FLAG = 'boolean';
const NUMBER = 'number';
const NUMBER_OR_NULL = 'number|null';
const LEAF = {
  [TEXT]: { ok: (value) => typeof value === 'string', name: 'text' },
  [FLAG]: { ok: (value) => typeof value === 'boolean', name: 'true or false' },
  [NUMBER]: { ok: (value) => Number.isFinite(value), name: 'a number' },
  [NUMBER_OR_NULL]: { ok: (value) => value === null || Number.isFinite(value), name: 'a number or null' },
};
const shapeOf = (value) =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, shapeOf(entry)])) : typeof value;

const ACCESS_CONDITIONS = {
  match: TEXT,
  conditions: [{ kind: TEXT, role: TEXT, scope: TEXT, chainId: NUMBER, contract: TEXT, anyOrAll: TEXT }],
};
// The profile as the Worker stores it (workers/shared/workerConfigModeValidation.mjs).
// Only its shape is checked: the rules table judges the values, so a template
// keeps a conflicting profile for the page to flag.
const PROFILE = {
  profileVersion: NUMBER,
  preset: TEXT,
  authority: { mode: TEXT },
  evm: { registryChainId: NUMBER_OR_NULL },
  storage: {
    backend: TEXT,
    payloadAccessControl: { gate: TEXT, encryption: TEXT, accessConditions: ACCESS_CONDITIONS },
  },
  identity: { default: TEXT, enabled: [TEXT] },
  authorization: { mechanisms: [TEXT] },
  encryption: { mode: TEXT, keyProvider: TEXT, accessConditions: ACCESS_CONDITIONS },
  surfaces: { web: FLAG, telegram: FLAG, miniApp: FLAG, agentHttp: FLAG, mcp: FLAG, ceCc: FLAG },
  results: {
    visibility: TEXT,
    exposure: { aggregateResultsEnabled: FLAG, anonymizedGroupsEnabled: FLAG, minGroupSize: NUMBER },
  },
  export: { scope: TEXT },
};
const GROUP_CREATION_POLICIES = ['participants', 'admin_only'];
// A question's portable fields, as the question editor publishes them. Its ID
// is derived from these when it is added to a session.
const QUESTION = {
  prompt: TEXT,
  type: TEXT,
  tags: [TEXT],
  options: [TEXT],
  singleSelect: FLAG,
  scale: { min: NUMBER, max: NUMBER, minLabel: TEXT, maxLabel: TEXT },
  voiceCredits: NUMBER,
};
const QUESTION_TYPES = ['binary', 'freeform', 'rating', 'multichoice', 'quadratic'];
const MAX_QUESTIONS = 200;
const MAX_QUESTION_TEXT = 2000;

// Equal to a fresh setup draft (checked by the client's template tests).
const DEFAULTS = Object.freeze({
  format: SESSION_TEMPLATE_FORMAT,
  draftId: '',
  sessionName: '',
  sessionInfo: '',
  sessionHeader: '',
  sessionEndsAt: '',
  appearance: { colorSchemeId: 'context-engine' },
  sessionContext: { title: '', paragraphs: [], links: [], html: '' },
  contextFiles: [],
  questionsGenPrompt: '',
  questions: [],
  defaultTags: '',
  defaultGroupTags: 'group, event, idea, demographic, location',
  groupCreationPolicy: 'participants',
  interviewModeEnabled: true,
  interviewMode: { ...DEFAULT_INTERVIEW_SETTINGS, realtimeModel: DEFAULT_REALTIME_INTERVIEW_MODEL },
  resultsAnalysis: DEFAULT_RESULTS_ANALYSIS_SETTINGS,
  ai: {
    reasoningEffort: 'low',
    models: {
      fast: { provider: 'openai', model: DEFAULT_AI_MODELS.fast },
      thinking: { provider: 'openai', model: DEFAULT_AI_MODELS.thinking },
      transcription: { provider: 'openai', model: DEFAULT_TRANSCRIPTION_MODEL },
    },
  },
  // null keeps the page's default profile; a profile is never merged with it.
  sessionModeProfile: null,
});
const SHAPE = {
  ...shapeOf(DEFAULTS),
  sessionContext: { title: TEXT, paragraphs: [TEXT], links: [{ label: TEXT, url: TEXT }], html: TEXT },
  // A file's name and privacy; its bytes never travel, so it is attached again.
  contextFiles: [{ name: TEXT, adminsOnly: FLAG }],
  questions: [QUESTION],
  sessionModeProfile: PROFILE,
};

// Copies the fields `shape` knows, reporting unknown fields and wrong types.
const check = (value, shape, path, errors) => {
  if (typeof shape === 'string') {
    if (LEAF[shape].ok(value)) return value;
    errors.push({ path, message: `${path} must be ${LEAF[shape].name}.` });
    return undefined;
  }
  if (Array.isArray(shape)) {
    if (Array.isArray(value)) return value.map((entry, index) => check(entry, shape[0], `${path}.${index}`, errors));
    errors.push({ path, message: `${path} must be a list.` });
    return undefined;
  }
  if (!isRecord(value)) {
    errors.push({ path, message: `${path} must be an object.` });
    return undefined;
  }
  Object.keys(value)
    .filter((key) => !hasOwn(shape, key))
    .forEach((key) => errors.push({ path: `${path}.${key}`, message: `Unknown field: ${path}.${key}.` }));
  return Object.fromEntries(
    Object.keys(shape)
      .filter((key) => hasOwn(value, key) && value[key] !== undefined)
      .map((key) => [key, check(value[key], shape[key], `${path}.${key}`, errors)]),
  );
};

const withDefaults = (value, defaults) => {
  if (value === undefined) return clone(defaults);
  if (!isRecord(value) || !isRecord(defaults)) return value;
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, withDefaults(value[key], defaults[key])]));
};

// Judges each interview setting alone (this base satisfies the rule that an
// owner-written opening needs its prompt), then that pair together.
const INTERVIEW_KEY_BASE = { ...DEFAULT_INTERVIEW_SETTINGS, openingPrompt: 'set' };
const checkInterviewMode = (value, errors) => {
  const invalid = Object.keys(DEFAULT_INTERVIEW_SETTINGS).filter(
    (key) => !validInterviewSettings({ ...INTERVIEW_KEY_BASE, [key]: value[key] }),
  );
  invalid.forEach((key) =>
    errors.push({ path: `interviewMode.${key}`, message: `interviewMode.${key} has an unsupported value.` }),
  );
  if (!isRealtimeInterviewModel(value.realtimeModel)) {
    errors.push({ path: 'interviewMode.realtimeModel', message: 'interviewMode.realtimeModel is not a supported voice model.' });
  }
  const pair = { openingMode: value.openingMode, openingPrompt: value.openingPrompt };
  if (!invalid.some((key) => hasOwn(pair, key)) && !validInterviewSettings({ ...DEFAULT_INTERVIEW_SETTINGS, ...pair })) {
    errors.push({
      path: 'interviewMode.openingPrompt',
      message: 'interviewMode.openingPrompt is required when openingMode is "owner".',
    });
  }
};

// Each question's fields must suit its type: options for multiple choice and
// quadratic votes, a scale for ratings, voice credits for quadratic votes.
const checkQuestions = (questions, errors) => {
  if (questions.length > MAX_QUESTIONS) {
    errors.push({ path: 'questions', message: `A template holds at most ${MAX_QUESTIONS} questions.` });
  }
  questions.forEach((question, index) => {
    const path = `questions.${index}`;
    const fail = (field, message) => errors.push({ path: `${path}.${field}`, message: `${path}.${field} ${message}` });
    const { prompt, type } = question;
    if (!prompt?.trim()) fail('prompt', 'is required.');
    else if (prompt.length > MAX_QUESTION_TEXT) fail('prompt', `is longer than ${MAX_QUESTION_TEXT} characters.`);
    if (!QUESTION_TYPES.includes(type)) fail('type', `must be one of ${QUESTION_TYPES.join(', ')}.`);
    const choices = type === 'multichoice' || type === 'quadratic';
    if (choices) {
      const options = (question.options || []).map((option) => option.trim());
      if (options.length < 2 || options.some((option) => !option)) fail('options', 'needs at least two options.');
      else if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
        fail('options', 'must not repeat an option.');
      }
    } else if (question.options) fail('options', `is only for multichoice and quadratic questions.`);
    if (question.singleSelect !== undefined && type !== 'multichoice') {
      fail('singleSelect', 'is only for multichoice questions.');
    }
    if (question.scale) {
      if (type !== 'rating') fail('scale', 'is only for rating questions.');
      else if (!(question.scale.min < question.scale.max)) fail('scale', 'needs min below max.');
    }
    if (question.voiceCredits !== undefined) {
      if (type !== 'quadratic') fail('voiceCredits', 'is only for quadratic questions.');
      else if (!Number.isInteger(question.voiceCredits) || question.voiceCredits < 1) {
        fail('voiceCredits', 'must be a whole number of at least 1.');
      }
    }
    (question.tags || []).forEach((tag, tagIndex) => {
      if (!tag.trim()) fail(`tags.${tagIndex}`, 'must not be empty.');
    });
  });
};

const FIELD_RULES = {
  questions: checkQuestions,
  draftId: (value, errors) => {
    if (!/^[\w-]{0,64}$/.test(value)) {
      errors.push({ path: 'draftId', message: 'draftId must be at most 64 letters, digits, "-" or "_".' });
    }
  },
  // The writer's limits, so a template never carries what set-config refuses.
  // A template also keeps no link without its URL.
  sessionContext: (value, errors) => {
    value.links.forEach((link, index) => {
      link.label ??= '';
      if (!link.url?.trim()) {
        const path = `sessionContext.links.${index}.url`;
        errors.push({ path, message: `${path} must be an https:// link.` });
      }
    });
    const checked = validateSessionContext(value);
    if (!checked.ok) errors.push(...checked.errors);
  },
  contextFiles: (value, errors) =>
    value.forEach(({ name }, index) => {
      if (!name?.trim()) errors.push({ path: `contextFiles.${index}.name`, message: 'Each context file needs a name.' });
    }),
  groupCreationPolicy: (value, errors) => {
    if (!GROUP_CREATION_POLICIES.includes(value)) {
      errors.push({ path: 'groupCreationPolicy', message: 'groupCreationPolicy must be "participants" or "admin_only".' });
    }
  },
  interviewMode: checkInterviewMode,
  resultsAnalysis: (value, errors, template) => {
    const result = validateResultsAnalysisSettings(value);
    if (result.ok) template.resultsAnalysis = normalizeResultsAnalysisSettings(value);
    else errors.push({ path: result.path, message: `${result.path}: ${result.error}` });
  },
};

const textLeaves = (value, path = '') => {
  if (typeof value === 'string') return [[path, value]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) => textLeaves(entry, path ? `${path}.${key}` : key));
};

export const validateSessionTemplate = (input) => {
  if (!isRecord(input)) return failure('', 'A session template must be a JSON object.');
  const errors = [];
  if (input.format !== SESSION_TEMPLATE_FORMAT) {
    errors.push({ path: 'format', message: `format must be "${SESSION_TEMPLATE_FORMAT}".` });
  }
  Object.keys(input)
    .filter((key) => !hasOwn(SHAPE, key))
    .forEach((key) => errors.push({ path: key, message: `Unknown field: ${key}.` }));
  const template = { format: SESSION_TEMPLATE_FORMAT };
  for (const key of Object.keys(SHAPE).filter((name) => name !== 'format')) {
    const value = hasOwn(input, key) ? input[key] : undefined;
    const before = errors.length;
    template[key] =
      value === undefined || (key === 'sessionModeProfile' && value === null)
        ? clone(DEFAULTS[key])
        : withDefaults(check(value, SHAPE[key], key, errors), DEFAULTS[key]);
    if (errors.length === before) FIELD_RULES[key]?.(template[key], errors, template);
  }
  textLeaves(template)
    .filter(([, text]) => looksSecret(text))
    .forEach(([path]) =>
      errors.push({
        path,
        message: `${path} looks like a key, token or password. Remove it: secrets are entered only where they are used.`,
      }),
    );
  // The same cap as Import, so every exported template can be imported again.
  if (utf8Length(JSON.stringify(template)) > SESSION_TEMPLATE_MAX_BYTES) errors.push({ path: '', message: TOO_LARGE });
  return errors.length ? { ok: false, errors } : { ok: true, template };
};

// Keeps only the fields a template has, so nothing else can leave the draft.
const pick = (value, shape) => {
  if (Array.isArray(shape)) return Array.isArray(value) ? value.map((entry) => pick(entry, shape[0])) : value;
  if (typeof shape === 'string' || !isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(shape)
      .filter((key) => hasOwn(value, key))
      .map((key) => [key, pick(value[key], shape[key])]),
  );
};

export const sessionTemplateFromDraft = (draft) =>
  validateSessionTemplate({ ...pick(isRecord(draft) ? draft : {}, SHAPE), format: SESSION_TEMPLATE_FORMAT });

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 32;
const findUnsafeField = (root) => {
  const pending = [[root, '', 0]];
  while (pending.length) {
    const [value, path, depth] = pending.pop();
    if (!value || typeof value !== 'object') continue;
    if (depth > MAX_DEPTH) return { path, message: 'This template is nested too deeply.' };
    for (const key of Object.keys(value)) {
      const next = path ? `${path}.${key}` : key;
      if (UNSAFE_KEYS.has(key)) return { path: next, message: `${next} is not an allowed field name.` };
      pending.push([value[key], next, depth + 1]);
    }
  }
  return null;
};

export const parseSessionTemplateJson = (text) => {
  if (typeof text !== 'string') return failure('', 'A template must be JSON text.');
  if (utf8Length(text) > SESSION_TEMPLATE_MAX_BYTES) return failure('', TOO_LARGE);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return failure('', 'This is not valid JSON.');
  }
  const unsafe = findUnsafeField(value);
  return unsafe ? { ok: false, errors: [unsafe] } : validateSessionTemplate(value);
};

// Field-level changes between two validated templates; lists are compared whole.
export const diffSessionTemplates = (before, after) => {
  const changes = [];
  const walk = (left, right, path) => {
    if (isRecord(left) && isRecord(right)) {
      new Set([...Object.keys(left), ...Object.keys(right)]).forEach((key) =>
        walk(left[key], right[key], path ? `${path}.${key}` : key),
      );
    } else if (stableCanonicalSerialize(left) !== stableCanonicalSerialize(right)) {
      changes.push({ path, before: left, after: right });
    }
  };
  walk(before, after, '');
  return changes;
};
