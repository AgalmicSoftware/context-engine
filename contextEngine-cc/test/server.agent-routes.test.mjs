import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test, { after } from 'node:test';

const WALLET_ADDRESS = `0x${'12'.repeat(20)}`;
const QUESTION_ID = `0x${'11'.repeat(32)}`;
const AGENT_ID = 'telegram:agent-1';
const GRANT_ID = 'agent_grant_route123';
const TEST_ROOT = mkdtempSync(resolve(tmpdir(), 'ce-server-agent-routes-'));
const DATA_DIR = resolve(TEST_ROOT, 'data');
const HOOK_STATE_DIR = resolve(TEST_ROOT, 'hook-state');
const previousDataDir = process.env.CE_CC_DATA_DIR;
const previousHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(HOOK_STATE_DIR, { recursive: true });
writeFileSync(
  resolve(HOOK_STATE_DIR, 'config.json'),
  JSON.stringify({
    serverUrl: 'http://localhost:7391',
    selectedSessions: ['alpha', 'beta'],
    defaultSession: 'alpha',
  }, null, 2),
);

process.env.CE_CC_DATA_DIR = DATA_DIR;
process.env.CE_CC_HOOK_STATE_DIR = HOOK_STATE_DIR;

const [{ signJwt }, { startContextEngineServer }] = await Promise.all([
  import('../lib/jwt.mjs'),
  import('../server.mjs'),
]);

after(() => {
  if (previousDataDir == null) delete process.env.CE_CC_DATA_DIR;
  else process.env.CE_CC_DATA_DIR = previousDataDir;
  if (previousHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
  else process.env.CE_CC_HOOK_STATE_DIR = previousHookStateDir;
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

async function withServer(run) {
  const server = startContextEngineServer({ host: '127.0.0.1', port: 0 });
  try {
    await once(server, 'listening');
    const address = server.address();
    assert.equal(typeof address, 'object');
    return await run(address.port);
  } finally {
    await new Promise((resolveClose, rejectClose) => {
      server.close((err) => {
        if (err) rejectClose(err);
        else resolveClose();
      });
    });
  }
}

async function requestJson(port, {
  path,
  method = 'GET',
  token = signJwt({ sub: WALLET_ADDRESS, scope: 'agent-test' }),
  body = null,
} = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers['Content-Type'] = 'application/json';

  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

function resetRuntimeState() {
  rmSync(resolve(DATA_DIR, 'responses'), { recursive: true, force: true });
  rmSync(resolve(DATA_DIR, 'agent-requests'), { recursive: true, force: true });
  rmSync(resolve(DATA_DIR, 'agent-grants'), { recursive: true, force: true });
  rmSync(resolve(DATA_DIR, 'agent-accounts'), { recursive: true, force: true });
  rmSync(resolve(DATA_DIR, 'agent-events'), { recursive: true, force: true });
}

function writeGrant(record = {}) {
  const grantDir = resolve(DATA_DIR, 'agent-grants');
  mkdirSync(grantDir, { recursive: true });
  const grant = {
    type: 'agent_grant',
    version: 'agent-contract-v1',
    grantId: GRANT_ID,
    humanPrincipal: WALLET_ADDRESS,
    agentId: AGENT_ID,
    subject: AGENT_ID,
    scopes: ['agent:delegated-execute', 'agent:revoke-grant'],
    sessions: ['alpha'],
    allowedActions: ['agent.response.delegated_execute'],
    riskCeiling: 'medium',
    executionPolicy: 'scoped_delegated_execute',
    auditRequired: true,
    status: 'active',
    expiresAt: '2099-01-01T00:00:00.000Z',
    createdAt: '2026-05-07T00:00:00.000Z',
    revokedAt: null,
    signingAuthority: false,
    workerTokenAuthority: false,
    ...record,
  };
  writeFileSync(resolve(grantDir, `${grant.grantId}.json`), JSON.stringify(grant, null, 2));
  return grant;
}

test('agent HTTP routes reject missing bearer auth at the app-server boundary', async () => {
  await withServer(async (port) => {
    const routes = [
      { method: 'GET', path: '/api/agent/me' },
      { method: 'GET', path: '/api/agent/sessions' },
      { method: 'GET', path: '/api/agent/questions?session=alpha' },
      { method: 'GET', path: '/api/agent/inbox' },
      {
        method: 'POST',
        path: '/api/agent/responses/draft',
        body: { session: 'alpha', questionId: QUESTION_ID, answer: 'draft answer' },
      },
      { method: 'GET', path: '/api/agent/responses/drafts?session=alpha' },
      {
        method: 'POST',
        path: '/api/agent/responses/submit-request',
        body: { session: 'alpha', questionIds: [QUESTION_ID] },
      },
      {
        method: 'POST',
        path: '/api/agent/responses/delegated-execute',
        body: { session: 'alpha', questionIds: [QUESTION_ID], grantId: GRANT_ID, agentId: AGENT_ID },
      },
      {
        method: 'POST',
        path: '/api/agent/connect-requests',
        body: {
          agentId: AGENT_ID,
          requestedScopes: ['agent:delegated-execute'],
          requestedSessions: ['alpha'],
          requestedActions: ['agent.response.delegated_execute'],
          riskCeiling: 'medium',
          executionPolicy: 'scoped_delegated_execute',
          expiresAt: '2099-01-01T00:00:00.000Z',
          idempotencyKey: 'connect:alpha.0001',
        },
      },
      { method: 'GET', path: '/api/agent/connect-requests/agent_req_missing123' },
      {
        method: 'POST',
        path: '/api/agent/connect-requests/approve',
        body: { requestId: 'agent_req_missing123' },
      },
      {
        method: 'POST',
        path: '/api/agent/connect-requests/deny',
        body: { requestId: 'agent_req_missing123' },
      },
      {
        method: 'POST',
        path: '/api/agent/accounts/create',
        body: { telegramUserId: '555', workerDeploymentId: 'worker-demo-1' },
      },
      {
        method: 'POST',
        path: '/api/agent/accounts/link-request',
        body: { accountId: 'agent_account_missing12345678' },
      },
      { method: 'GET', path: '/api/agent/grants' },
      { method: 'GET', path: `/api/agent/grants/${GRANT_ID}` },
      {
        method: 'POST',
        path: '/api/agent/grants/revoke',
        body: { grantId: GRANT_ID },
      },
      { method: 'GET', path: '/api/agent/requests/agent_req_missing123' },
    ];

    for (const route of routes) {
      const result = await requestJson(port, { ...route, token: '' });
      assert.equal(result.status, 401, `${route.method} ${route.path}`);
      assert.deepEqual(result.payload, {
        ok: false,
        status: 'auth_error',
        code: 'agent_auth_required',
        error: 'Missing Authorization header.',
      });
    }
  });
});

test('agent HTTP draft and inbox routes persist local drafts without on-chain submission', async () => {
  resetRuntimeState();

  await withServer(async (port) => {
    const me = await requestJson(port, { path: '/api/agent/me' });
    assert.equal(me.status, 200);
    assert.equal(me.payload.ok, true);
    assert.equal(me.payload.wallet, WALLET_ADDRESS);
    assert.equal(me.payload.capabilities.submission.remoteAutoSubmit, false);

    const draft = await requestJson(port, {
      path: '/api/agent/responses/draft',
      method: 'POST',
      body: {
        session: 'alpha',
        questionId: QUESTION_ID,
        questionType: 'freeform',
        answer: 'Use the canonical HTTP API.',
        additional: 'MCP stays thin.',
      },
    });
    assert.equal(draft.status, 200);
    assert.equal(draft.payload.ok, true);
    assert.equal(draft.payload.status, 'draft_saved');
    assert.equal(draft.payload.submitted, false);
    assert.equal(draft.payload.draft.questionId, QUESTION_ID);

    const drafts = await requestJson(port, {
      path: '/api/agent/responses/drafts?session=alpha',
    });
    assert.equal(drafts.status, 200);
    assert.equal(drafts.payload.count, 1);
    assert.equal(drafts.payload.drafts[0].answer, 'Use the canonical HTTP API.');
    assert.equal(Object.hasOwn(drafts.payload.summaries[0], 'answer'), false);

    const inbox = await requestJson(port, {
      path: '/api/agent/inbox?session=alpha',
    });
    assert.equal(inbox.status, 200);
    assert.equal(inbox.payload.count, 1);
    assert.equal(inbox.payload.pendingResponses[0].questionId, QUESTION_ID);
    assert.equal(inbox.payload.inbox[0].type, 'response_draft');
  });
});

test('agent HTTP submit-request route creates approval records and preserves idempotency', async () => {
  resetRuntimeState();

  await withServer(async (port) => {
    const submitRequest = await requestJson(port, {
      path: '/api/agent/responses/submit-request',
      method: 'POST',
      body: {
        session: 'alpha',
        questionIds: [QUESTION_ID],
        idempotencyKey: 'agent-http-test-0001',
      },
    });
    assert.equal(submitRequest.status, 202);
    assert.equal(submitRequest.payload.ok, false);
    assert.equal(submitRequest.payload.requiresApproval, true);
    assert.match(submitRequest.payload.requestId, /^agent_req_/);
    assert.equal(submitRequest.payload.request.status, 'pending_approval');

    const requestRead = await requestJson(port, {
      path: `/api/agent/requests/${submitRequest.payload.requestId}?session=alpha`,
    });
    assert.equal(requestRead.status, 200);
    assert.equal(requestRead.payload.ok, true);
    assert.equal(requestRead.payload.request.requestId, submitRequest.payload.requestId);
    assert.equal(requestRead.payload.lifecycle.status, 'pending_approval');

    const idempotent = await requestJson(port, {
      path: '/api/agent/responses/submit-request',
      method: 'POST',
      body: {
        session: 'alpha',
        questionIds: [QUESTION_ID],
        idempotencyKey: 'agent-http-test-0001',
      },
    });
    assert.equal(idempotent.status, 202);
    assert.equal(idempotent.payload.requestId, submitRequest.payload.requestId);
    assert.equal(idempotent.payload.idempotent, true);
  });
});

test('agent HTTP routes require explicit public session slugs', async () => {
  resetRuntimeState();

  await withServer(async (port) => {
    const emptyDraft = await requestJson(port, {
      path: '/api/agent/responses/draft',
      method: 'POST',
      body: {
        session: '',
        questionId: QUESTION_ID,
        questionType: 'freeform',
        answer: 'empty public session must not be accepted',
      },
    });
    assert.equal(emptyDraft.status, 400);
    assert.equal(emptyDraft.payload.code, 'invalid_session');

    const emptyDrafts = await requestJson(port, {
      path: '/api/agent/responses/drafts?session=',
    });
    assert.equal(emptyDrafts.status, 400);
    assert.equal(emptyDrafts.payload.code, 'invalid_session');

    const generalDraft = await requestJson(port, {
      path: '/api/agent/responses/draft',
      method: 'POST',
      body: {
        session: 'general',
        questionId: QUESTION_ID,
        questionType: 'freeform',
        answer: 'explicit general session is valid',
      },
    });
    assert.equal(generalDraft.status, 200);
    assert.equal(generalDraft.payload.draft.session, 'general');
  });
});

test('agent HTTP grant routes list read and revoke scoped grants by wallet', async () => {
  resetRuntimeState();
  writeGrant();
  writeGrant({
    grantId: 'agent_grant_otherwallet',
    humanPrincipal: `0x${'34'.repeat(20)}`,
  });

  await withServer(async (port) => {
    const list = await requestJson(port, { path: '/api/agent/grants?session=alpha' });
    assert.equal(list.status, 200);
    assert.equal(list.payload.ok, true);
    assert.equal(list.payload.count, 1);
    assert.equal(list.payload.grants[0].grantId, GRANT_ID);
    assert.equal(list.payload.grants[0].signingAuthority, false);
    assert.equal(list.payload.grants[0].workerTokenAuthority, false);

    const read = await requestJson(port, { path: `/api/agent/grants/${GRANT_ID}?session=alpha` });
    assert.equal(read.status, 200);
    assert.equal(read.payload.grant.agentId, AGENT_ID);
    assert.deepEqual(read.payload.grant.allowedActions, ['agent.response.delegated_execute']);

    const wrongSession = await requestJson(port, { path: `/api/agent/grants/${GRANT_ID}?session=beta` });
    assert.equal(wrongSession.status, 404);
    assert.equal(wrongSession.payload.code, 'agent_grant_not_found');

    const revoked = await requestJson(port, {
      path: '/api/agent/grants/revoke',
      method: 'POST',
      body: { grantId: GRANT_ID },
    });
    assert.equal(revoked.status, 200);
    assert.equal(revoked.payload.status, 'grant_revoked');
    assert.equal(revoked.payload.grant.status, 'revoked');
    assert.equal(revoked.payload.grant.revokedAt.length > 0, true);
  });
});

test('agent HTTP connect request routes approve scoped grants only after local auth', async () => {
  resetRuntimeState();

  await withServer(async (port) => {
    const malformed = await requestJson(port, {
      path: '/api/agent/connect-requests',
      method: 'POST',
      body: {
        agentId: AGENT_ID,
        requestedScopes: ['agent:sign'],
        requestedSessions: ['alpha'],
        requestedActions: ['agent.response.delegated_execute'],
        riskCeiling: 'medium',
        executionPolicy: 'scoped_delegated_execute',
        expiresAt: '2099-01-01T00:00:00.000Z',
        idempotencyKey: 'connect:server.bad1',
      },
    });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.payload.code, 'invalid_connect_request');

    const created = await requestJson(port, {
      path: '/api/agent/connect-requests',
      method: 'POST',
      body: {
        agentId: AGENT_ID,
        requestedScopes: ['agent:delegated-execute'],
        requestedSessions: ['alpha'],
        requestedActions: ['agent.response.delegated_execute'],
        riskCeiling: 'medium',
        executionPolicy: 'scoped_delegated_execute',
        auditRequired: true,
        expiresAt: '2099-01-01T00:00:00.000Z',
        idempotencyKey: 'connect:server.0001',
        agentContext: {
          workerToken: 'must-redact',
        },
      },
    });
    assert.equal(created.status, 202);
    assert.equal(created.payload.requiresApproval, true);
    assert.equal(created.payload.connectRequest.status, 'pending_approval');
    assert.equal(created.payload.connectRequest.signingAuthority, false);
    assert.equal(created.payload.connectRequest.workerTokenAuthority, false);

    const read = await requestJson(port, {
      path: `/api/agent/connect-requests/${created.payload.requestId}`,
    });
    assert.equal(read.status, 200);
    assert.equal(read.payload.connectRequest.requestId, created.payload.requestId);
    assert.equal(read.payload.connectRequest.grantId, null);

    const override = await requestJson(port, {
      path: '/api/agent/connect-requests/approve',
      method: 'POST',
      body: {
        requestId: created.payload.requestId,
        requestedActions: ['agent.response.delegated_execute', 'agent.session.create_request'],
      },
    });
    assert.equal(override.status, 400);
    assert.equal(override.payload.code, 'connect_request_scope_override_denied');

    const approved = await requestJson(port, {
      path: '/api/agent/connect-requests/approve',
      method: 'POST',
      body: {
        requestId: created.payload.requestId,
      },
    });
    assert.equal(approved.status, 200);
    assert.equal(approved.payload.status, 'connect_request_approved');
    assert.equal(approved.payload.grant.status, 'active');
    assert.deepEqual(approved.payload.grant.sessions, ['alpha']);
    assert.deepEqual(approved.payload.grant.allowedActions, ['agent.response.delegated_execute']);
    assert.equal(approved.payload.grant.signingAuthority, false);
    assert.equal(approved.payload.grant.workerTokenAuthority, false);

    const replay = await requestJson(port, {
      path: '/api/agent/connect-requests/approve',
      method: 'POST',
      body: {
        requestId: created.payload.requestId,
      },
    });
    assert.equal(replay.status, 409);
    assert.equal(replay.payload.reason, 'connect_request_not_pending');
  });
});

test('agent HTTP managed account routes stay metadata-only', async () => {
  resetRuntimeState();

  await withServer(async (port) => {
    const created = await requestJson(port, {
      path: '/api/agent/accounts/create',
      method: 'POST',
      body: {
        telegramUserId: '555',
        workerDeploymentId: 'worker-demo-1',
        session: 'alpha',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.payload.status, 'account_created');
    assert.equal(created.payload.account.principalId, 'telegram:555');
    assert.match(created.payload.account.accountAddress, /^0x[0-9a-f]{40}$/);
    assert.equal(created.payload.account.signingAuthority, false);
    assert.equal(created.payload.account.workerTokenAuthority, false);
    assert.equal(created.payload.account.privateKeyAuthority, false);
    assert.equal(created.payload.account.rawKeyMaterialExportable, false);
    assert.equal(created.payload.signingEnabled, false);
    assert.equal(created.payload.event.eventType, 'account_created');

    const recovered = await requestJson(port, {
      path: '/api/agent/accounts/create',
      method: 'POST',
      body: {
        telegramUserId: '555',
        workerDeploymentId: 'worker-demo-1',
        session: 'alpha',
      },
    });
    assert.equal(recovered.status, 200);
    assert.equal(recovered.payload.status, 'account_recovered');
    assert.equal(recovered.payload.account.accountId, created.payload.account.accountId);
    assert.equal(recovered.payload.event.eventType, 'account_recovered');

    const linkRequest = await requestJson(port, {
      path: '/api/agent/accounts/link-request',
      method: 'POST',
      body: {
        accountId: created.payload.account.accountId,
        targetPrincipal: { wallet: WALLET_ADDRESS },
        idempotencyKey: 'account:server.0001',
      },
    });
    assert.equal(linkRequest.status, 202);
    assert.equal(linkRequest.payload.requiresApproval, true);
    assert.equal(linkRequest.payload.linked, false);
    assert.equal(linkRequest.payload.request.type, 'account_link_request');
    assert.equal(linkRequest.payload.event.eventType, 'link_requested');
  });
});

test('agent HTTP delegated execution validates scoped grants and records audit without signing', async () => {
  resetRuntimeState();
  writeGrant();

  await withServer(async (port) => {
    const delegated = await requestJson(port, {
      path: '/api/agent/responses/delegated-execute',
      method: 'POST',
      body: {
        session: 'alpha',
        questionIds: [QUESTION_ID],
        grantId: GRANT_ID,
        agentId: AGENT_ID,
        idempotencyKey: 'delegated:alpha.0001',
        agentContext: {
          source: 'server-test',
          workerToken: 'must-redact',
          note: 'Bearer long-lived-token',
        },
      },
    });
    assert.equal(delegated.status, 202);
    assert.equal(delegated.payload.ok, true);
    assert.equal(delegated.payload.executed, false);
    assert.equal(delegated.payload.execution.status, 'contract_only_deferred');
    assert.equal(delegated.payload.execution.productDecisionRequired, true);
    assert.equal(delegated.payload.request.status, 'approved');
    assert.equal(delegated.payload.request.requiresApproval, false);
    assert.equal(delegated.payload.grant.signingAuthority, false);
    assert.equal(delegated.payload.grant.workerTokenAuthority, false);

    const retry = await requestJson(port, {
      path: '/api/agent/responses/delegated-execute',
      method: 'POST',
      body: {
        session: 'alpha',
        questionIds: [QUESTION_ID],
        grantId: GRANT_ID,
        agentId: AGENT_ID,
        idempotencyKey: 'delegated:alpha.0001',
      },
    });
    assert.equal(retry.status, 202);
    assert.equal(retry.payload.idempotent, true);
    assert.equal(retry.payload.request.requestId, delegated.payload.request.requestId);

    const denied = await requestJson(port, {
      path: '/api/agent/responses/delegated-execute',
      method: 'POST',
      body: {
        session: 'beta',
        questionIds: [QUESTION_ID],
        grantId: GRANT_ID,
        agentId: AGENT_ID,
      },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.payload.code, 'agent_grant_denied');
    assert.equal(denied.payload.reason, 'session_mismatch');
  });
});
