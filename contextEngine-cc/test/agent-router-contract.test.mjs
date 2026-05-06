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

test('agent HTTP routes are present in router source', () => {
  [
    ['GET', '/api/agent/me'],
    ['GET', '/api/agent/sessions'],
    ['GET', '/api/agent/questions'],
    ['GET', '/api/agent/inbox'],
    ['POST', '/api/agent/responses/draft'],
    ['GET', '/api/agent/responses/drafts'],
    ['POST', '/api/agent/responses/submit-request'],
  ].forEach(([method, path]) => extractBranch(path, method));

  assert.match(ROUTER_SOURCE, /path\.startsWith\('\/api\/agent\/requests\/'\) && method === 'GET'/);
});

test('agent submit-request route is approval-gated and does not submit on-chain', () => {
  const branch = extractBranch('/api/agent/responses/submit-request', 'POST');
  assert.match(branch, /buildApprovalRequiredResponse/);
  assert.match(branch, /saveAgentRequest/);
  assert.doesNotMatch(branch, /submitOnChainImpl/);
  assert.doesNotMatch(branch, /ensureWorkerToken/);
});

test('agent draft route uses draft storage instead of legacy respond auto-submit path', () => {
  const branch = extractBranch('/api/agent/responses/draft', 'POST');
  assert.match(branch, /saveAgentResponseDraft/);
  assert.doesNotMatch(branch, /canSubmitImpl/);
  assert.doesNotMatch(branch, /submitOnChainImpl/);
});
