export const AGENT_ROUTE_EQUIVALENCE = Object.freeze([
  {
    canonical: { method: 'GET', path: '/api/agent/me' },
    legacy: { method: 'GET', path: '/api/me' },
    relation: 'read-adapter',
    notes: 'Adds agent capability metadata around the local JWT identity.',
  },
  {
    canonical: { method: 'GET', path: '/api/agent/sessions' },
    legacy: { method: 'GET', path: '/api/sessions' },
    relation: 'read-adapter',
    notes: 'Uses the same scoped session discovery and question-cache warmup.',
  },
  {
    canonical: { method: 'GET', path: '/api/agent/questions' },
    legacy: { method: 'GET', path: '/api/questions' },
    relation: 'read-adapter',
    notes: 'Returns JSON-first question and one-element questions array shapes.',
  },
  {
    canonical: { method: 'GET', path: '/api/agent/inbox' },
    legacy: { method: 'GET', path: '/api/responses/pending' },
    relation: 'summary-adapter',
    notes: 'Summarizes local pending responses without exposing Telegram callback payloads.',
  },
  {
    canonical: { method: 'POST', path: '/api/agent/responses/draft' },
    legacy: { method: 'POST', path: '/api/respond' },
    relation: 'draft-only-adapter',
    notes: 'Stores the same local response record but never triggers auto-submit.',
  },
  {
    canonical: { method: 'GET', path: '/api/agent/responses/drafts' },
    legacy: { method: 'GET', path: '/api/responses/pending' },
    relation: 'draft-list-adapter',
    notes: 'Lists authenticated-wallet local pending responses as agent drafts.',
  },
  {
    canonical: { method: 'POST', path: '/api/agent/responses/submit-request' },
    legacy: { method: 'POST', path: '/api/responses/submit-onchain' },
    relation: 'approval-gated-request',
    notes: 'Creates an approval request instead of signing or submitting.',
  },
  {
    canonical: { method: 'POST', path: '/api/agent/responses/delegated-execute' },
    legacy: { method: 'POST', path: '/api/responses/submit-onchain' },
    relation: 'scoped-delegation-contract',
    notes: 'Validates scoped grants and records an audit entry without remote signing authority.',
  },
  {
    canonical: { method: 'GET', path: '/api/agent/requests/:id' },
    legacy: null,
    relation: 'agent-native',
    notes: 'Reads approval request status by opaque request id.',
  },
  {
    canonical: { method: 'GET', path: '/api/agent/grants' },
    legacy: null,
    relation: 'agent-native',
    notes: 'Lists authenticated-wallet scoped delegated grants.',
  },
  {
    canonical: { method: 'GET', path: '/api/agent/grants/:id' },
    legacy: null,
    relation: 'agent-native',
    notes: 'Reads a scoped delegated grant by id inside the authenticated wallet scope.',
  },
  {
    canonical: { method: 'POST', path: '/api/agent/grants/revoke' },
    legacy: null,
    relation: 'agent-native',
    notes: 'Revokes a scoped delegated grant without creating or expanding authority.',
  },
]);

export function routeKey(route = {}) {
  return `${String(route.method || '').toUpperCase()} ${String(route.path || '')}`;
}

export const AGENT_CANONICAL_ROUTES = Object.freeze(
  AGENT_ROUTE_EQUIVALENCE.map((entry) => Object.freeze({
    ...entry.canonical,
    owner: 'agent',
    legacy: entry.legacy,
    relation: entry.relation,
    notes: entry.notes,
  }))
);

export function getAgentRouteByCanonical(method, path) {
  const key = routeKey({ method, path });
  return AGENT_ROUTE_EQUIVALENCE.find((entry) => routeKey(entry.canonical) === key) || null;
}

export function getAgentRoutesForLegacy(method, path) {
  const key = routeKey({ method, path });
  return AGENT_ROUTE_EQUIVALENCE.filter((entry) => entry.legacy && routeKey(entry.legacy) === key);
}
