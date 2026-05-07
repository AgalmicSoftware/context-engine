// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_CANONICAL_ROUTES,
  AGENT_ROUTE_EQUIVALENCE,
  getAgentRouteByCanonical,
  getAgentRoutesForLegacy,
  routeKey,
} from './routeEquivalence.mjs';
import { ROUTE_INVENTORY, ROUTE_INVENTORY_BY_KEY, routeKey as inventoryRouteKey } from '../routeInventory.mjs';

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

test('route equivalence and inventory stay aligned for every /api/agent route', () => {
  const equivalenceKeys = new Set(AGENT_CANONICAL_ROUTES.map(routeKey));
  const inventoryAgentKeys = ROUTE_INVENTORY
    .filter((entry) => entry.path.startsWith('/api/agent/'))
    .map(inventoryRouteKey);

  assert.deepEqual([...equivalenceKeys].sort(), inventoryAgentKeys.sort());
  for (const route of AGENT_CANONICAL_ROUTES) {
    const inventoryRoute = ROUTE_INVENTORY_BY_KEY[routeKey(route)];
    assert.equal(inventoryRoute.owner, 'agent');
    assert.equal(inventoryRoute.auth, 'local-jwt');
  }
});
