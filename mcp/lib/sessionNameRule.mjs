// The rule a session that keeps names applies to a name, in the Worker's own
// words: workers/sessionCorsWorker/sessionNames.js (SESSION_NAME_LIMITS and the
// refusals of normalizeSessionName). sessionNames.test.mjs fails if they part.
// The MCP passes a name on as given and never shortens or changes it to fit.
export const SESSION_NAME_RULE = 'A session that keeps names takes at most 32 characters: letters, numbers, spaces and . - _ \' only ' +
  '(a straight \', not ’), so no commas or brackets; and it refuses a name that claims a role, such as admin or host, ' +
  'or looks like an address, web address, key or “(agent)”.';
// How an agent may name itself so readers can tell who it is, within that rule.
export const AGENT_NAME_EXAMPLE = 'Kestrel - Opus 5.5 - North Lab';
