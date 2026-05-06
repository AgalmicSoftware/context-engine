import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_CANONICAL_ROUTES,
  AGENT_ROUTE_EQUIVALENCE,
  getAgentRouteByCanonical,
  getAgentRoutesForLegacy,
  routeKey,
} from './routeEquivalence.mjs';

test('agent route equivalence table covers the v1 canonical routes', () => {
  const canonicalKeys = AGENT_CANONICAL_ROUTES.map(routeKey).sort();
  assert.deepEqual(canonicalKeys, [
    'GET /api/agent/inbox',
    'GET /api/agent/me',
    'GET /api/agent/questions',
    'GET /api/agent/requests/:id',
    'GET /api/agent/responses/drafts',
    'GET /api/agent/sessions',
    'POST /api/agent/responses/draft',
    'POST /api/agent/responses/submit-request',
  ]);
});

test('legacy routes map to canonical agent adapters where applicable', () => {
  assert.equal(getAgentRoutesForLegacy('GET', '/api/me')[0].canonical.path, '/api/agent/me');
  assert.equal(getAgentRoutesForLegacy('POST', '/api/respond')[0].canonical.path, '/api/agent/responses/draft');
  assert.equal(getAgentRoutesForLegacy('POST', '/api/responses/submit-onchain')[0].relation, 'approval-gated-request');
});

test('canonical lookup returns relation metadata', () => {
  const entry = getAgentRouteByCanonical('GET', '/api/agent/requests/:id');
  assert.equal(entry.relation, 'agent-native');
  assert.equal(entry.legacy, null);
  assert.equal(AGENT_ROUTE_EQUIVALENCE.every((route) => route.notes), true);
});
