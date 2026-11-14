import { stableCanonicalSerialize } from './canonicalJson.mjs';

// The fields POST /admin/set-config accepts for a Worker-canonical session.
export const WORKER_CANONICAL_SET_CONFIG_KEYS = Object.freeze([
  'slug',
  'sessionId',
  'sessionIdHex',
  'configRevision',
  'sessionName',
  'sessionInfo',
  'sessionContext',
  'appearance',
  'sessionHeaderImg',
  'sessionEndsAt',
  'defaultTags',
  'defaultGroupTags',
  'defaultSbtTags',
  'questionsGenPrompt',
  'agentInstructions',
  'interviewMode',
  'interviewModeEnabled',
  'pileAutoAdvanceEnabled',
  'feedbackEnabled',
  'defaultFilterState',
  'defaultFeaturedSBTs',
  'autoFeatureSBTsBySessionSlug',
  'HIGHLIGHTED_QUESTION_IDS',
  'BLOCKED_QUESTION_IDS',
  'HIGHLIGHTED_SURVEY_IDS',
  'BLOCKED_SURVEY_IDS',
  'adminAddress',
  'adminAddresses',
  'resultsAdminAddresses',
  'corsWorkerUrl',
  'allowOrigins',
  'sessionModeProfile',
  'agentSessionWrapped',
  'agentHttp',
  'resultsExposure',
  'workerAuthority',
  'workerRoles',
  'roles',
  'authorization',
  'groupCreationPolicy',
  'groupMemberCeiling',
  'contextAdditionPolicy',
  'sessionAgent',
  'storageProfile',
  'storageEnvelope',
  'ai',
  'limits',
  'scopes',
  'networkChainId',
  'contracts',
  'embeddedDeployHelperEnabled',
  'litCredentials',
  'resultsAnalysis',
  'responseFieldEncryption',
  'linkedWorkerGroups',
  'workerGroupsBootstrap',
]);

// The question and survey IDs an admin highlights or hides. Curation, not
// access, so editing them signs no one out.
export const CURATED_ID_LIST_KEYS = Object.freeze([
  'HIGHLIGHTED_QUESTION_IDS', 'BLOCKED_QUESTION_IDS', 'HIGHLIGHTED_SURVEY_IDS', 'BLOCKED_SURVEY_IDS',
]);
export const MAX_CURATED_IDS = 500;
const CURATED_ID = /^[A-Za-z0-9._:-]{1,128}$/;
export const validCuratedIdList = value =>
  Array.isArray(value) && value.length <= MAX_CURATED_IDS &&
  value.every(id => typeof id === 'string' && CURATED_ID.test(id));

// Results admins build debate atlases, and nothing else an admin does.
export const MAX_RESULTS_ADMINS = 20;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
export const validResultsAdminAddresses = value =>
  Array.isArray(value) && value.length <= MAX_RESULTS_ADMINS &&
  value.every(address => typeof address === 'string' && ADDRESS.test(address)) &&
  new Set(value.map(address => address.toLowerCase())).size === value.length;

// A session's instructions for AI agents, in Markdown. Its Worker serves them
// as text at /llms.txt.
export const MAX_AGENT_INSTRUCTIONS_CHARS = 8000;
export const validAgentInstructions = value =>
  typeof value === 'string' && value.length <= MAX_AGENT_INSTRUCTIONS_CHARS;

const CONTENT_FIELDS = new Set([
  'sessionName', 'sessionInfo', 'sessionContext', 'questionsGenPrompt', 'appearance', 'sessionHeaderImg',
  'agentInstructions',
  // Checked again when each file publishes, so changing it signs no one out.
  'contextAdditionPolicy',
  // Checked on each atlas build and read and never held in a sign-in, so
  // changing it signs no one out either.
  'resultsAdminAddresses',
  // Read on each interview request and never held in a sign-in, so changing
  // any interview setting, even turning interviews off, signs no one out.
  'interviewModeEnabled', 'interviewMode',
  // Checked on each question to the Session Agent, the same way.
  'sessionAgent',
  // Checked on each group join, the same way.
  'groupMemberCeiling',
  // Checked on each feedback send, the same way.
  'feedbackEnabled',
  ...CURATED_ID_LIST_KEYS,
]);
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const same = (left, right) => stableCanonicalSerialize(left) === stableCanonicalSerialize(right);

// set-config merges `ai` one level deep: a sent subkey replaces that subkey
// and an omitted one is kept, so a writer that sees only the public part of
// `ai` cannot drop the rest. Workers before this rule replace `ai` whole.
export const mergeSetConfigAi = (stored, sent) => (record(stored) && record(sent) ? { ...stored, ...sent } : sent);
const without = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.has(key)));

const onlyAddsInvites = (before, after) => {
  const prior = before === undefined ? [] : before;
  const next = after === undefined ? [] : after;
  if (!Array.isArray(prior) || !Array.isArray(next)) return false;
  const unique = rows => rows.every(row => record(row) && typeof row.tokenHash === 'string') &&
    new Set(rows.map(row => row.tokenHash)).size === rows.length;
  if (!unique(prior) || !unique(next)) return false;
  const byHash = new Map(next.map(row => [row.tokenHash, row]));
  return prior.every(row => byHash.has(row.tokenHash) && same(row, byHash.get(row.tokenHash)));
};

const authorityView = (config, additiveInvites) => {
  const result = without(config, CONTENT_FIELDS);
  if (record(result.agentHttp) && additiveInvites) {
    result.agentHttp = without(result.agentHttp, new Set(['invites']));
    if (!Object.keys(result.agentHttp).length) delete result.agentHttp;
  }
  return result;
};

// Compare effective records after validation. Only the explicit content paths
// disappear; newly introduced fields therefore keep revoking by default.
export const sessionConfigRequiresReauthorization = (before, after) => {
  const additiveInvites = onlyAddsInvites(before?.agentHttp?.invites, after?.agentHttp?.invites);
  return !same(authorityView(before, additiveInvites), authorityView(after, additiveInvites));
};

const keysOf = (...values) => [...new Set(values.flatMap(value => Object.keys(value)))];
// Sub-fields that differ; [] when either side is present but not a record.
const changedFields = (before, after) => {
  const fields = value => (value === undefined ? {} : record(value) ? value : null);
  const prior = fields(before);
  const next = fields(after);
  return prior && next ? keysOf(prior, next).filter(key => !same(prior[key], next[key])) : [];
};
// The changed sub-fields of interviewMode or agentHttp, each with its own
// label on the Settings page; otherwise the key itself.
const editedPaths = (key, before, after) => {
  const nested = key === 'interviewMode' || key === 'agentHttp' ? changedFields(before, after) : [];
  return nested.length ? nested.map(field => `${key}.${field}`) : [key];
};

// The edited paths in two effective records, split the way the Worker splits
// them on save: an authority path raises authzEpoch, signing participants out.
// The verdict is the per-field form of sessionConfigRequiresReauthorization.
export const classifySessionConfigEdits = (before, after) => {
  const prior = record(before) ? before : {};
  const next = record(after) ? after : {};
  const additiveInvites = onlyAddsInvites(prior.agentHttp?.invites, next.agentHttp?.invites);
  const priorAuthority = authorityView(prior, additiveInvites);
  const nextAuthority = authorityView(next, additiveInvites);
  const authority = keysOf(priorAuthority, nextAuthority)
    .filter(key => !same(priorAuthority[key], nextAuthority[key]))
    .flatMap(key => editedPaths(key, priorAuthority[key], nextAuthority[key]));
  const content = keysOf(prior, next).flatMap((key) => {
    if (CONTENT_FIELDS.has(key)) return same(prior[key], next[key]) ? [] : editedPaths(key, prior[key], next[key]);
    return key === 'agentHttp' && additiveInvites && !same(prior.agentHttp?.invites, next.agentHttp?.invites)
      ? ['agentHttp.invites']
      : [];
  });
  return { content, authority, signsParticipantsOut: authority.length > 0 };
};
