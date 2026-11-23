// The rule a session that keeps names applies to a name, in the Worker's own
// words: workers/sessionCorsWorker/sessionNames.js (SESSION_NAME_LIMITS and the
// refusals of normalizeSessionName). sessionNames.test.mjs fails if they part.
// The MCP passes a name on as given and never shortens or changes it to fit.
import { AGENT_NAME_EXAMPLES } from '../../shared/agentParticipationGuide.mjs';

export const SESSION_NAME_RULE = 'A session that keeps names takes at most 32 characters: letters, numbers, spaces and . - _ \' only ' +
  '(a straight \', not ’), so no commas or brackets; and it refuses a name that claims a role or speaks for the site, by any of these words: ' +
  'admin, administrator, moderator, host, organiser, organizer, official, staff, system, session agent, group agent, ' +
  'Context Engine, RadicalxChange, RxC (“agent” or “AI” alone is fine); or one that looks like an address, web address, key or “(agent)”.';
// How an agent may name itself so readers can tell who it is, within that rule.
export const AGENT_NAME_EXAMPLE = AGENT_NAME_EXAMPLES[1];
