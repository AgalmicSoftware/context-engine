import { stableCanonicalSerialize } from '../shared/deployHelperCore.mjs';

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

// Compare effective records after validation. Only the explicit content paths
// disappear; newly introduced fields therefore keep revoking by default.
export const sessionConfigRequiresReauthorization = (before, after) => {
  const additiveInvites = onlyAddsInvites(before?.agentHttp?.invites, after?.agentHttp?.invites);
  const authority = config => {
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
  return !same(authority(before), authority(after));
};
