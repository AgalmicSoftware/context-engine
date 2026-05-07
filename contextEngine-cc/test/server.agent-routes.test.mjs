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
