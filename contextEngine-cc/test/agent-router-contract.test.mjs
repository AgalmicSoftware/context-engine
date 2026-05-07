// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTER_SOURCE = readFileSync(resolve(__dirname, '..', 'lib', 'router.mjs'), 'utf8');

function extractBranch(path, method = 'GET') {
  const marker = `if (path === '${path}' && method === '${method}')`;
  const start = ROUTER_SOURCE.indexOf(marker);
  assert.notEqual(start, -1, `missing route branch ${method} ${path}`);
  const next = ROUTER_SOURCE.indexOf('\n  if (path ', start + marker.length);
  return ROUTER_SOURCE.slice(start, next === -1 ? undefined : next);
}

function extractPrefixBranch(prefix, method = 'GET') {
  const marker = `if (path.startsWith('${prefix}') && method === '${method}')`;
  const start = ROUTER_SOURCE.indexOf(marker);
  assert.notEqual(start, -1, `missing route branch ${method} ${prefix}:id`);
  const next = ROUTER_SOURCE.indexOf('\n  if (path ', start + marker.length);
  return ROUTER_SOURCE.slice(start, next === -1 ? undefined : next);
}

test('agent HTTP routes are present in router source', () => {
  [
    ['GET', '/api/agent/me'],
    ['GET', '/api/agent/sessions'],
    ['GET', '/api/agent/questions'],
    ['GET', '/api/agent/inbox'],
    ['POST', '/api/agent/responses/draft'],
    ['GET', '/api/agent/responses/drafts'],
    ['POST', '/api/agent/responses/submit-request'],
    ['POST', '/api/agent/responses/delegated-execute'],
    ['GET', '/api/agent/grants'],
    ['POST', '/api/agent/grants/revoke'],
  ].forEach(([method, path]) => extractBranch(path, method));

  assert.match(ROUTER_SOURCE, /path\.startsWith\('\/api\/agent\/requests\/'\) && method === 'GET'/);
  assert.match(ROUTER_SOURCE, /path\.startsWith\('\/api\/agent\/grants\/'\) && method === 'GET'/);
});

test('agent HTTP route branches require local JWT auth before work', () => {
  const branches = [
    extractBranch('/api/agent/me', 'GET'),
    extractBranch('/api/agent/sessions', 'GET'),
    extractBranch('/api/agent/questions', 'GET'),
    extractBranch('/api/agent/inbox', 'GET'),
    extractBranch('/api/agent/responses/draft', 'POST'),
    extractBranch('/api/agent/responses/drafts', 'GET'),
    extractBranch('/api/agent/responses/submit-request', 'POST'),
    extractBranch('/api/agent/responses/delegated-execute', 'POST'),
    extractBranch('/api/agent/grants', 'GET'),
    extractBranch('/api/agent/grants/revoke', 'POST'),
    extractPrefixBranch('/api/agent/requests/', 'GET'),
    extractPrefixBranch('/api/agent/grants/', 'GET'),
  ];

  for (const branch of branches) {
    assert.match(branch, /const auth = requireAuth\(req\);/);
    assert.match(branch, /if \(!auth\.ok\) return agentAuthError\(res, auth\);/);
  }
});

test('agent delegated execution route validates grants and stays contract-only', () => {
  const branch = extractBranch('/api/agent/responses/delegated-execute', 'POST');
  assert.match(branch, /evaluateScopedDelegatedExecutionGrant/);
  assert.match(branch, /saveAgentRequest/);
  assert.match(branch, /contract_only_deferred/);
  assert.match(branch, /agent_grant_denied/);
  assert.doesNotMatch(branch, /submitOnChainImpl/);
  assert.doesNotMatch(branch, /ensureWorkerToken/);
  assert.doesNotMatch(branch, /loadWorkerToken/);
});

test('agent grant routes do not create or expand scoped grants', () => {
  const listBranch = extractBranch('/api/agent/grants', 'GET');
  const readBranch = extractPrefixBranch('/api/agent/grants/', 'GET');
  const revokeBranch = extractBranch('/api/agent/grants/revoke', 'POST');

  assert.match(listBranch, /loadAgentGrantsForWallet/);
  assert.match(readBranch, /loadAgentGrant/);
  assert.match(revokeBranch, /saveAgentGrant/);
  assert.match(revokeBranch, /status: 'revoked'/);
  assert.doesNotMatch(`${listBranch}\n${readBranch}\n${revokeBranch}`, /createApprovalRequestId/);
  assert.doesNotMatch(`${listBranch}\n${readBranch}\n${revokeBranch}`, /signingAuthority: true/);
  assert.doesNotMatch(`${listBranch}\n${readBranch}\n${revokeBranch}`, /workerTokenAuthority: true/);
});

test('agent submit-request route is approval-gated and does not submit on-chain', () => {
  const branch = extractBranch('/api/agent/responses/submit-request', 'POST');
  assert.match(branch, /buildApprovalRequiredResponse/);
  assert.match(branch, /saveAgentRequest/);
  assert.match(branch, /idempotencyKey/);
  assert.match(branch, /loadAgentRequestByIdempotencyKey/);
  assert.match(branch, /buildAgentRequestFingerprint/);
  assert.match(branch, /idempotency_key_conflict/);
  assert.doesNotMatch(branch, /submitOnChainImpl/);
  assert.doesNotMatch(branch, /ensureWorkerToken/);
});

test('agent draft route uses draft storage instead of legacy respond auto-submit path', () => {
  const branch = extractBranch('/api/agent/responses/draft', 'POST');
  assert.match(branch, /saveAgentResponseDraft/);
  assert.doesNotMatch(branch, /canSubmitImpl/);
  assert.doesNotMatch(branch, /submitOnChainImpl/);
});
