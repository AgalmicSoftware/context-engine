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
  'interviewMode',
  'interviewModeEnabled',
  'pileAutoAdvanceEnabled',
  'defaultFilterState',
  'defaultFeaturedSBTs',
  'autoFeatureSBTsBySessionSlug',
  'adminAddress',
  'adminAddresses',
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

const CONTENT_FIELDS = new Set([
  'sessionName', 'sessionInfo', 'sessionContext', 'questionsGenPrompt', 'appearance', 'sessionHeaderImg',
]);
const INTERVIEW_CONTENT_FIELDS = new Set(['openingPrompt', 'steeringPrompt']);
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const same = (left, right) => stableCanonicalSerialize(left) === stableCanonicalSerialize(right);
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
  if (record(result.interviewMode)) {
    result.interviewMode = without(result.interviewMode, INTERVIEW_CONTENT_FIELDS);
    if (!Object.keys(result.interviewMode).length) delete result.interviewMode;
  }
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
    .flatMap((key) => {
      const nested = key === 'interviewMode' || key === 'agentHttp'
        ? changedFields(priorAuthority[key], nextAuthority[key])
        : [];
      return nested.length ? nested.map(field => `${key}.${field}`) : [key];
    });
  const content = keysOf(prior, next).flatMap((key) => {
    if (CONTENT_FIELDS.has(key)) return same(prior[key], next[key]) ? [] : [key];
    if (key === 'interviewMode') {
      return [...INTERVIEW_CONTENT_FIELDS]
        .filter(field => !same(prior.interviewMode?.[field], next.interviewMode?.[field]))
        .map(field => `interviewMode.${field}`);
    }
    return key === 'agentHttp' && additiveInvites && !same(prior.agentHttp?.invites, next.agentHttp?.invites)
      ? ['agentHttp.invites']
      : [];
  });
  return { content, authority, signsParticipantsOut: authority.length > 0 };
};
