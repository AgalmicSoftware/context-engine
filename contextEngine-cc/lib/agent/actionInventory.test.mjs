// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_ACTION_IDS,
  AGENT_ACTION_INVENTORY,
  AGENT_ACTION_INVENTORY_BY_ID,
  AGENT_ACTION_STATUS,
  getAgentAction,
} from './actionInventory.mjs';
import {
  AGENT_EXECUTION_POLICIES,
  AGENT_GRANT_SCOPES,
  AGENT_RISK_LEVELS,
} from './lifecycle.mjs';

test('agent action inventory covers private web UX action families', () => {
  for (const actionId of Object.values(AGENT_ACTION_IDS)) {
    assert.ok(AGENT_ACTION_INVENTORY_BY_ID[actionId], `missing action inventory entry: ${actionId}`);
  }

  const families = new Set(AGENT_ACTION_INVENTORY.map((entry) => entry.family));
  for (const family of ['read', 'response', 'decrypt', 'grant', 'account', 'worker_setup', 'question', 'survey', 'sbt_group', 'session', 'session_storage', 'deliberation']) {
    assert.equal(families.has(family), true, `missing family: ${family}`);
  }

  assert.equal(getAgentAction(AGENT_ACTION_IDS.RESPONSE_DELEGATED_EXECUTE).approvalBehavior, AGENT_EXECUTION_POLICIES.SCOPED_DELEGATED_EXECUTE);
  assert.equal(getAgentAction(AGENT_ACTION_IDS.RESPONSE_DELEGATED_EXECUTE).status, AGENT_ACTION_STATUS.CONTRACT_ONLY);
  assert.deepEqual(getAgentAction(AGENT_ACTION_IDS.RESPONSE_DELEGATED_EXECUTE).requiredScopes, [
    AGENT_GRANT_SCOPES.DELEGATED_EXECUTE,
  ]);
  assert.equal(getAgentAction(AGENT_ACTION_IDS.ACCOUNT_CREATE).status, AGENT_ACTION_STATUS.CONTRACT_ONLY);
  assert.equal(getAgentAction(AGENT_ACTION_IDS.ACCOUNT_CREATE).route.path, '/api/agent/accounts/create');
  assert.equal(getAgentAction(AGENT_ACTION_IDS.ACCOUNT_LINK_REQUEST).route.path, '/api/agent/accounts/link-request');
  assert.equal(getAgentAction(AGENT_ACTION_IDS.WORKER_SETUP_STATUS).route.path, '/api/agent/worker-setup');
  assert.equal(getAgentAction(AGENT_ACTION_IDS.SESSION_STORAGE_ACCESS_REQUEST).route.path, '/api/agent/session-storage/access-request');
  assert.equal(getAgentAction(AGENT_ACTION_IDS.SESSION_STORAGE_ACCESS_REQUEST).status, AGENT_ACTION_STATUS.DEFERRED);
  assert.equal(getAgentAction(AGENT_ACTION_IDS.SESSION_STORAGE_ACCESS_REQUEST).signingOrWorkerAuthority, 'session_worker_short_lived_storage_permission');
});

test('agent action inventory exposes only canonical agent routes and no remote authority', () => {
  const seen = new Set();
  const allowedStatuses = new Set(Object.values(AGENT_ACTION_STATUS));
  const allowedRisks = new Set(Object.values(AGENT_RISK_LEVELS));

  for (const action of AGENT_ACTION_INVENTORY) {
    assert.equal(seen.has(action.actionId), false, `duplicate action id: ${action.actionId}`);
    seen.add(action.actionId);
    assert.match(action.actionId, /^agent\./);
    assert.match(action.route.path, /^\/api\/agent\//, action.actionId);
    assert.match(action.route.method, /^(GET|POST)$/);
    assert.equal(allowedStatuses.has(action.status), true, action.actionId);
    assert.equal(allowedRisks.has(action.riskLevel), true, action.actionId);
    assert.ok(Array.isArray(action.requiredScopes), action.actionId);
    assert.ok(action.requiredScopes.length > 0, action.actionId);
    assert.equal(action.signingAuthority, undefined, action.actionId);
    assert.equal(action.workerTokenAuthority, undefined, action.actionId);
    assert.notEqual(action.signingOrWorkerAuthority, 'remote');
    assert.equal(typeof action.adaptersMayCallDirectly.telegram, 'boolean');
    assert.equal(typeof action.adaptersMayCallDirectly.openclaw, 'boolean');
  }
});

test('implemented action routes are the current canonical agent surface', () => {
  const implementedRoutes = AGENT_ACTION_INVENTORY
    .filter((entry) => entry.status === AGENT_ACTION_STATUS.IMPLEMENTED)
    .map((entry) => `${entry.route.method} ${entry.route.path}`)
    .sort();

  assert.deepEqual(implementedRoutes, [
    'GET /api/agent/me',
    'GET /api/agent/connect-requests/:id',
    'GET /api/agent/questions',
    'GET /api/agent/sessions',
    'POST /api/agent/connect-requests',
    'POST /api/agent/connect-requests/approve',
    'POST /api/agent/connect-requests/deny',
    'POST /api/agent/grants/revoke',
    'POST /api/agent/responses/draft',
    'POST /api/agent/responses/submit-request',
  ].sort());
});
