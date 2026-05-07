// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CC_ROOT = resolve(__dirname, '..');
const ROUTER_SOURCE_PATH = resolve(CC_ROOT, 'lib', 'router.mjs');
const QUESTION_ID = `0x${'11'.repeat(32)}`;
const SECOND_QUESTION_ID = `0x${'22'.repeat(32)}`;
const WALLET_ADDRESS = `0x${'12'.repeat(20)}`;
const SECOND_WALLET_ADDRESS = `0x${'34'.repeat(20)}`;

function writeModule(path, source) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
}

function makeMockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers || {};
    },
    end(chunk) {
      this.body += chunk ? String(chunk) : '';
    },
  };
}

function makeReq({ token = 'valid-agent-jwt', headers: headerOverrides = {} } = {}) {
  const headers = { host: 'localhost:7391', ...headerOverrides };
  if (token) headers.authorization = `Bearer ${token}`;
  return {
    headers,
    socket: { remoteAddress: '127.0.0.1' },
  };
}

async function callRoute(handleRoute, {
  path,
  method = 'GET',
  body = {},
  token = 'valid-agent-jwt',
  headers = {},
} = {}) {
  const res = makeMockRes();
  await handleRoute(makeReq({ token, headers }), res, {
    url: new URL(path, 'http://localhost:7391'),
    method,
    body,
  });
  return {
    status: res.statusCode,
    payload: JSON.parse(res.body || '{}'),
  };
}

function setupRouterHarness(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-agent-router-integration-'));
  const libDir = resolve(root, 'lib');
  const dataDir = resolve(root, 'data');
  const hookStateDir = resolve(root, 'hook-state');
  mkdirSync(libDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(hookStateDir, { recursive: true });
  writeFileSync(
    resolve(hookStateDir, 'config.json'),
    JSON.stringify({
      serverUrl: 'http://localhost:7391',
      selectedSessions: ['alpha', 'beta'],
      defaultSession: 'alpha',
    }, null, 2),
  );

  writeModule(resolve(root, 'node_modules', 'ethers', 'package.json'), JSON.stringify({
    type: 'module',
    main: 'index.js',
  }));
  writeModule(resolve(root, 'node_modules', 'ethers', 'index.js'), `
    class BigNumberish {
      lt() { return false; }
    }
    export const ethers = {
      constants: { HashZero: '0x${'00'.repeat(32)}' },
      utils: {
        parseEther() { return new BigNumberish(); },
        formatEther() { return '0.0'; },
        isAddress(value) { return /^0x[0-9a-fA-F]{40}$/.test(String(value || '')); },
        isHexString(value, length) {
          const raw = String(value || '');
          return /^0x[0-9a-fA-F]*$/.test(raw) && (!length || raw.length === 2 + Number(length) * 2);
        },
      },
      providers: { JsonRpcProvider: class {} },
      Contract: class {},
      Wallet: class {
        constructor(privateKey) {
          this.privateKey = privateKey;
          this.address = '${WALLET_ADDRESS}';
        }
        async signMessage() { return '0xsig'; }
      },
    };
  `);

  writeModule(resolve(libDir, 'jwt.mjs'), `
    export function decodeTokenPayload() { return {}; }
    export function verifyJwt(token) {
      return token === 'valid-agent-jwt'
        ? { ok: true, payload: { sub: '${WALLET_ADDRESS}', scope: 'agent-test' } }
        : { ok: false, error: 'Invalid token.' };
    }
    export function signJwt(payload) { return 'valid-agent-jwt'; }
  `);
  writeModule(resolve(libDir, 'log.mjs'), `
    export function debug() {}
    export function warn() {}
    export function error() {}
  `);
  writeModule(resolve(libDir, 'keyEncryption.mjs'), `
    import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
    import { dirname } from 'node:path';
    export function decryptFromFile(path) { return Buffer.from(readFileSync(path, 'utf8')); }
    export function encryptToFile(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
    export function isEncryptedFile() { return false; }
    export function migrateToEncrypted() {}
    export function writeSecureFile(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
  `);
  writeModule(resolve(libDir, 'localAuth.mjs'), `
    export function requireLocalJwtAuth(req = {}) {
      const token = String(req.headers?.authorization || '').replace(/^Bearer\\s+/i, '');
      if (token === 'valid-agent-jwt') {
        return { ok: true, payload: { sub: '${WALLET_ADDRESS}', scope: 'agent-test' } };
      }
      if (token === 'second-agent-jwt') {
        return { ok: true, payload: { sub: '${SECOND_WALLET_ADDRESS}', scope: 'agent-test' } };
      }
      return { ok: false, status: 401, error: token ? 'Invalid token.' : 'Missing Authorization header.' };
    }
  `);
  writeModule(resolve(libDir, 'sessions.mjs'), `
    export async function listScopedSessions() {
      return { scoped: ['alpha', 'beta'], all: ['alpha', 'beta', 'gamma'] };
    }
    export async function getCorsWorkerUrl(slug) { return 'http://worker.example/' + slug; }
    export async function getSessionMetadata(slug) { return { slug, gates: [] }; }
  `);
  writeModule(resolve(libDir, 'constants.mjs'), `
    export const CE_SESSION_SCAN_SCOPE = 'configured';
    export const CE_SESSION_SCAN_SLUGS = ['alpha', 'beta'];
    export const DEFAULT_CHAIN_ID = 11155420;
    export const DEFAULT_CHAIN_METADATA = { name: 'OP Sepolia', txExplorerTxBaseUrl: 'https://explorer.example/tx/' };
    export function resolveRpcUrlsForChain() { return ['http://127.0.0.1:8545']; }
  `);
  writeModule(resolve(libDir, 'questions.mjs'), `
    export async function fetchQuestionIds() { return ['${QUESTION_ID}']; }
    export async function getRandomUnseen(slug) {
      if (slug === 'empty') return { question: null, totalCount: 0, answeredCount: 0 };
      return {
        question: {
          id: '${QUESTION_ID}',
          type: 'freeform',
          prompt: 'What should this agent do next?',
          options: [],
          tags: ['agent'],
        },
        totalCount: 1,
        answeredCount: 0,
      };
    }
    export async function getMergedAnsweredQuestionIds() { return new Set(); }
    export function formatQuestionForTerminal(question) { return question.prompt; }
    export function warmQuestionCache() {}
    export function clearServed() {}
  `);
  writeModule(resolve(libDir, 'submit.mjs'), `
    export async function submitResponses() { return { ok: true, txHash: '0xtx' }; }
    export async function submitQuestions() { return { ok: true }; }
    export function canSubmit() { return { ready: true, hasKey: true, hasContract: true }; }
  `);
  writeModule(resolve(libDir, 'localRequest.mjs'), `
    export function isTrustedLocalRequest() { return { ok: true }; }
  `);
  writeModule(resolve(libDir, 'submissionState.mjs'), `
    export function recordConfirmedSubmission() {}
  `);
  writeModule(resolve(root, 'public', 'js', 'sessionSlugs.mjs'), `
    export function normalizeConfiguredSessions({ selectedSessions, defaultSession } = {}) {
      const selected = Array.isArray(selectedSessions) ? selectedSessions.filter(Boolean) : [];
      if (selected.length) return selected;
      return defaultSession ? [defaultSession] : [];
    }
  `);
  writeModule(resolve(libDir, 'responseAudience.mjs'), `
    export function deriveResponseGateOptionsFromMetadata() {
      return { gateOptions: [], defaultGateId: '' };
    }
    export function normalizeResponseAudienceSelections({
      answerAudience,
      answerGateId,
      additionalAudience,
      additionalGateId,
      encryptRequested,
      encryptAdditionalRequested,
      hasAdditionalText,
    } = {}) {
      const answerEncryptionAudience = answerAudience || (encryptRequested ? 'self' : 'none');
      const additionalEncryptionAudience = additionalAudience || (hasAdditionalText && encryptAdditionalRequested ? 'self' : 'none');
      return {
        answerEncryptionAudience,
        answerEncryptionGateId: answerGateId || null,
        additionalEncryptionAudience,
        additionalEncryptionGateId: additionalGateId || null,
        additionalAudienceMode: additionalEncryptionAudience,
      };
    }
    export function isEncryptedAudience(value) {
      return value === 'self' || value === 'gate';
    }
  `);

  ['capabilities', 'schemas', 'approvalResponses', 'lifecycle'].forEach((moduleName) => {
    const href = pathToFileURL(resolve(CC_ROOT, 'lib', 'agent', `${moduleName}.mjs`)).href;
    writeModule(resolve(libDir, 'agent', `${moduleName}.mjs`), `export * from ${JSON.stringify(href)};\n`);
  });
  writeFileSync(resolve(libDir, 'router.mjs'), readFileSync(ROUTER_SOURCE_PATH, 'utf8'));

  const previousDataDir = process.env.CE_CC_DATA_DIR;
  const previousHookStateDir = process.env.CE_CC_HOOK_STATE_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  process.env.CE_CC_HOOK_STATE_DIR = hookStateDir;
  t.after(() => {
    if (previousDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = previousDataDir;
    if (previousHookStateDir == null) delete process.env.CE_CC_HOOK_STATE_DIR;
    else process.env.CE_CC_HOOK_STATE_DIR = previousHookStateDir;
  });

  return {
    root,
    dataDir,
    routerUrl: `${pathToFileURL(resolve(libDir, 'router.mjs')).href}?t=${Date.now()}-${Math.random()}`,
  };
}

test('agent routes reject missing auth before returning adapter payloads', async (t) => {
  const harness = setupRouterHarness(t);
  const { handleRoute } = await import(harness.routerUrl);

  const result = await callRoute(handleRoute, {
    path: '/api/agent/me',
    token: '',
  });

  assert.equal(result.status, 401);
  assert.deepEqual(result.payload, {
    ok: false,
    status: 'auth_error',
    code: 'agent_auth_required',
    error: 'Missing Authorization header.',
  });
});

test('agent routes use stable auth error envelopes before route-specific work', async (t) => {
  const harness = setupRouterHarness(t);
  const { handleRoute } = await import(harness.routerUrl);
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
    const result = await callRoute(handleRoute, {
      path: route.path,
      method: route.method,
      body: route.body || {},
      token: '',
    });
    assert.equal(result.status, 401, `${route.method} ${route.path}`);
    assert.deepEqual(result.payload, {
      ok: false,
      status: 'auth_error',
      code: 'agent_auth_required',
      error: 'Missing Authorization header.',
    });
  }
});

test('agent read adapters return canonical identity, sessions, and questions', async (t) => {
  const harness = setupRouterHarness(t);
  const { handleRoute } = await import(harness.routerUrl);

  const me = await callRoute(handleRoute, { path: '/api/agent/me' });
  assert.equal(me.status, 200);
  assert.equal(me.payload.ok, true);
  assert.equal(me.payload.wallet, WALLET_ADDRESS);
  assert.equal(me.payload.auth.type, 'local-jwt');
  assert.equal(me.payload.capabilities.submission.remoteAutoSubmit, false);

  const sessions = await callRoute(handleRoute, { path: '/api/agent/sessions' });
  assert.equal(sessions.status, 200);
  assert.deepEqual(sessions.payload.sessions, ['alpha', 'beta']);
  assert.deepEqual(sessions.payload.selectedSessions, ['alpha', 'beta']);

  const missingSessionQuestions = await callRoute(handleRoute, { path: '/api/agent/questions' });
  assert.equal(missingSessionQuestions.status, 400);
  assert.equal(missingSessionQuestions.payload.code, 'invalid_session');

  const emptySessionQuestions = await callRoute(handleRoute, { path: '/api/agent/questions?session=' });
  assert.equal(emptySessionQuestions.status, 400);
  assert.equal(emptySessionQuestions.payload.code, 'invalid_session');

  const questions = await callRoute(handleRoute, { path: '/api/agent/questions?session=alpha' });
  assert.equal(questions.status, 200);
  assert.equal(questions.payload.ok, true);
  assert.equal(questions.payload.session, 'alpha');
  assert.equal(questions.payload.question.version, 'agent-contract-v1');
  assert.equal(questions.payload.question.session, 'alpha');
  assert.equal(questions.payload.question.questionId, QUESTION_ID);
  assert.equal(questions.payload.question.questionType, 'freeform');
  assert.equal(questions.payload.question.id, QUESTION_ID);
  assert.deepEqual(questions.payload.questions, [questions.payload.question]);

  const generalQuestions = await callRoute(handleRoute, { path: '/api/agent/questions?session=general' });
  assert.equal(generalQuestions.status, 200);
  assert.equal(generalQuestions.payload.session, 'general');

  const emptyQuestions = await callRoute(handleRoute, { path: '/api/agent/questions?session=empty' });
  assert.equal(emptyQuestions.status, 200);
  assert.equal(emptyQuestions.payload.ok, true);
  assert.equal(emptyQuestions.payload.question, null);
  assert.equal(emptyQuestions.payload.count, 0);
  assert.equal(emptyQuestions.payload.message, 'No questions available.');
});

test('agent question and draft routes validate payloads and expose local drafts', async (t) => {
  const harness = setupRouterHarness(t);
  const { handleRoute } = await import(harness.routerUrl);

  const invalidSession = await callRoute(handleRoute, {
    path: '/api/agent/questions?session=..%2Foutside',
  });
  assert.equal(invalidSession.status, 400);
  assert.equal(invalidSession.payload.ok, false);
  assert.equal(invalidSession.payload.code, 'invalid_session');
  assert.equal(invalidSession.payload.error, 'Invalid session slug.');

  const invalidDraft = await callRoute(handleRoute, {
    path: '/api/agent/responses/draft',
    method: 'POST',
    body: { session: 'alpha', questionId: 'not-a-question-id', answer: 'yes' },
  });
  assert.equal(invalidDraft.status, 400);
  assert.equal(invalidDraft.payload.ok, false);
  assert.equal(invalidDraft.payload.code, 'invalid_question_id');
  assert.equal(invalidDraft.payload.error, 'questionId must be a 32-byte hex string.');

  const draft = await callRoute(handleRoute, {
    path: '/api/agent/responses/draft',
    method: 'POST',
    body: {
      session: 'alpha',
      questionId: QUESTION_ID,
      questionType: 'freeform',
      answer: 'Use the canonical HTTP contract.',
      additional: 'Keep MCP thin.',
    },
  });
  assert.equal(draft.status, 200);
  assert.equal(draft.payload.ok, true);
  assert.equal(draft.payload.status, 'draft_saved');
  assert.equal(draft.payload.submitted, false);
  assert.equal(draft.payload.draft.questionId, QUESTION_ID);

  const drafts = await callRoute(handleRoute, {
    path: '/api/agent/responses/drafts?session=alpha',
  });
  assert.equal(drafts.status, 200);
  assert.equal(drafts.payload.count, 1);
  assert.equal(drafts.payload.drafts[0].answer, 'Use the canonical HTTP contract.');
  assert.equal(Object.hasOwn(drafts.payload.summaries[0], 'answer'), false);

  const inbox = await callRoute(handleRoute, {
    path: '/api/agent/inbox?session=alpha',
  });
  assert.equal(inbox.status, 200);
  assert.equal(inbox.payload.pendingResponses.length, 1);
  assert.equal(inbox.payload.inbox[0].type, 'response_draft');
});

test('agent response routes require explicit public session slugs', async (t) => {
  const harness = setupRouterHarness(t);
  const { handleRoute } = await import(harness.routerUrl);

  const emptyDraft = await callRoute(handleRoute, {
    path: '/api/agent/responses/draft',
    method: 'POST',
    body: {
      session: '',
      questionId: QUESTION_ID,
      questionType: 'freeform',
      answer: 'This must not write into the empty-session bucket.',
    },
  });
  assert.equal(emptyDraft.status, 400);
  assert.equal(emptyDraft.payload.code, 'invalid_session');

  const missingDraft = await callRoute(handleRoute, {
    path: '/api/agent/responses/draft',
    method: 'POST',
    body: {
      questionId: QUESTION_ID,
      questionType: 'freeform',
      answer: 'Missing session should be invalid.',
    },
  });
  assert.equal(missingDraft.status, 400);
  assert.equal(missingDraft.payload.code, 'invalid_session');

  const emptyDrafts = await callRoute(handleRoute, {
    path: '/api/agent/responses/drafts?session=',
  });
  assert.equal(emptyDrafts.status, 400);
  assert.equal(emptyDrafts.payload.code, 'invalid_session');

  const emptyInbox = await callRoute(handleRoute, {
    path: '/api/agent/inbox?session=',
  });
  assert.equal(emptyInbox.status, 400);
  assert.equal(emptyInbox.payload.code, 'invalid_session');

  const emptySubmitRequest = await callRoute(handleRoute, {
    path: '/api/agent/responses/submit-request',
    method: 'POST',
    body: {
      session: '',
      questionIds: [QUESTION_ID],
    },
  });
  assert.equal(emptySubmitRequest.status, 400);
  assert.equal(emptySubmitRequest.payload.code, 'invalid_session');

  const generalDraft = await callRoute(handleRoute, {
    path: '/api/agent/responses/draft',
    method: 'POST',
    body: {
      session: 'general',
      questionId: QUESTION_ID,
      questionType: 'freeform',
      answer: 'Use the explicit public general session.',
    },
  });
  assert.equal(generalDraft.status, 200);
  assert.equal(generalDraft.payload.draft.session, 'general');

  const generalDrafts = await callRoute(handleRoute, {
    path: '/api/agent/responses/drafts?session=general',
  });
  assert.equal(generalDrafts.status, 200);
  assert.equal(generalDrafts.payload.session, 'general');
  assert.equal(generalDrafts.payload.count, 1);
});

test('agent submit-request creates approval records and idempotent retries', async (t) => {
  const harness = setupRouterHarness(t);
  const { handleRoute } = await import(harness.routerUrl);

  const invalid = await callRoute(handleRoute, {
    path: '/api/agent/responses/submit-request',
    method: 'POST',
    body: { session: 'alpha', questionIds: [] },
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(invalid.payload, {
    ok: false,
    status: 'bad_request',
    code: 'invalid_question_ids',
    error: 'questionIds must contain at least one 32-byte hex string.',
  });

  const first = await callRoute(handleRoute, {
    path: '/api/agent/responses/submit-request',
    method: 'POST',
    headers: {
      host: 'attacker.example',
      'x-forwarded-proto': 'https',
    },
    body: {
      session: 'alpha',
      questionIds: [QUESTION_ID],
      idempotencyKey: 'submit:alpha.0001',
      agentContext: {
        source: 'integration-test',
        workerToken: 'must-redact',
      },
    },
  });
  assert.equal(first.status, 202);
  assert.equal(first.payload.ok, false);
  assert.equal(first.payload.requiresApproval, true);
  assert.equal(first.payload.status, 'pending_approval');
  assert.match(first.payload.requestId, /^agent_req_/);
  assert.match(first.payload.approvalUrl, /\/agent\/requests\/agent_req_/);
  assert.match(first.payload.approvalUrl, /^http:\/\/localhost:7391\/agent\/requests\/agent_req_/);
  assert.equal(first.payload.approvalUrl.includes('attacker.example'), false);
  assert.equal(first.payload.request.questionIds[0], QUESTION_ID);

  const requestFile = resolve(harness.dataDir, 'agent-requests', `${first.payload.requestId}.json`);
  assert.equal(existsSync(requestFile), true);
  const stored = JSON.parse(readFileSync(requestFile, 'utf8'));
  assert.equal(stored.payload.agentContext.workerToken, '[redacted]');
  assert.equal(stored.idempotencyKey, 'submit:alpha.0001');

  const retry = await callRoute(handleRoute, {
    path: '/api/agent/responses/submit-request',
    method: 'POST',
    body: {
      session: 'alpha',
      questionIds: [QUESTION_ID],
      idempotencyKey: 'submit:alpha.0001',
    },
  });
  assert.equal(retry.status, 202);
  assert.equal(retry.payload.requestId, first.payload.requestId);
  assert.equal(retry.payload.idempotent, true);

  const conflict = await callRoute(handleRoute, {
    path: '/api/agent/responses/submit-request',
    method: 'POST',
    body: {
      session: 'alpha',
      questionIds: [SECOND_QUESTION_ID],
      idempotencyKey: 'submit:alpha.0001',
    },
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.payload.ok, false);
  assert.equal(conflict.payload.code, 'idempotency_key_conflict');

  const secondWalletSameKey = await callRoute(handleRoute, {
    path: '/api/agent/responses/submit-request',
    method: 'POST',
    token: 'second-agent-jwt',
    body: {
      session: 'alpha',
      questionIds: [QUESTION_ID],
      idempotencyKey: 'submit:alpha.0001',
    },
  });
  assert.equal(secondWalletSameKey.status, 202);
  assert.notEqual(secondWalletSameKey.payload.requestId, first.payload.requestId);
  assert.equal(secondWalletSameKey.payload.request.requester, SECOND_WALLET_ADDRESS.toLowerCase());

  const secondWalletInbox = await callRoute(handleRoute, {
    path: '/api/agent/inbox?session=alpha',
    token: 'second-agent-jwt',
  });
  assert.deepEqual(
    secondWalletInbox.payload.requests.map((request) => request.requestId),
    [secondWalletSameKey.payload.requestId],
  );

  const status = await callRoute(handleRoute, {
    path: `/api/agent/requests/${encodeURIComponent(first.payload.requestId)}`,
  });
  assert.equal(status.status, 200);
  assert.equal(status.payload.ok, true);
  assert.equal(status.payload.request.requestId, first.payload.requestId);
  assert.equal(status.payload.request.status, 'pending_approval');

  const inbox = await callRoute(handleRoute, { path: '/api/agent/inbox?session=alpha' });
  assert.equal(inbox.status, 200);
  assert.equal(inbox.payload.requests.length, 1);
  assert.equal(inbox.payload.requests[0].requestId, first.payload.requestId);

  const betaRequest = await callRoute(handleRoute, {
    path: '/api/agent/responses/submit-request',
    method: 'POST',
    body: {
      session: 'beta',
      questionIds: [QUESTION_ID],
    },
  });
  assert.equal(betaRequest.status, 202);

  const alphaInbox = await callRoute(handleRoute, { path: '/api/agent/inbox?session=alpha' });
  assert.equal(alphaInbox.status, 200);
  assert.deepEqual(alphaInbox.payload.requests.map((request) => request.requestId), [first.payload.requestId]);

  const allSessionInbox = await callRoute(handleRoute, { path: '/api/agent/inbox' });
  assert.equal(allSessionInbox.status, 200);
  assert.deepEqual(
    allSessionInbox.payload.requests.map((request) => request.requestId).sort(),
    [first.payload.requestId, betaRequest.payload.requestId].sort()
  );

  const invalidStatus = await callRoute(handleRoute, {
    path: '/api/agent/requests/not-a-request-id',
  });
  assert.equal(invalidStatus.status, 400);
  assert.deepEqual(invalidStatus.payload, {
    ok: false,
    status: 'bad_request',
    code: 'invalid_request_id',
    error: 'Invalid agent request id.',
  });

  const missingStatus = await callRoute(handleRoute, {
    path: '/api/agent/requests/agent_req_missing123',
  });
  assert.equal(missingStatus.status, 404);
  assert.deepEqual(missingStatus.payload, {
    ok: false,
    status: 'not_found',
    code: 'agent_request_not_found',
    error: 'Agent request not found.',
  });

  const otherWalletStatus = await callRoute(handleRoute, {
    path: `/api/agent/requests/${encodeURIComponent(first.payload.requestId)}`,
    token: 'second-agent-jwt',
  });
  assert.equal(otherWalletStatus.status, 404);
  assert.equal(otherWalletStatus.payload.code, 'agent_request_not_found');
});

test('agent request reads normalize expired and revoked lifecycle states', async (t) => {
  const harness = setupRouterHarness(t);
  const { handleRoute } = await import(harness.routerUrl);
  const requestDir = resolve(harness.dataDir, 'agent-requests');
  mkdirSync(requestDir, { recursive: true });

  function writeRequest(record) {
    writeFileSync(resolve(requestDir, `${record.requestId}.json`), JSON.stringify({
      type: 'response_submit_request',
      requestId: record.requestId,
      status: 'pending_approval',
      requiresApproval: true,
      approvalUrl: `http://localhost:7391/agent/requests/${record.requestId}`,
      session: 'alpha',
      questionIds: [QUESTION_ID],
      requester: WALLET_ADDRESS,
      idempotencyKey: '',
      fingerprint: '',
      createdAt: '2026-05-06T00:00:00.000Z',
      updatedAt: '2026-05-06T00:00:00.000Z',
      ...record,
    }, null, 2));
  }

  writeRequest({
    requestId: 'agent_req_expired123',
    expiresAt: '2000-01-01T00:00:00.000Z',
    idempotencyKey: 'submit:alpha.expired1',
    fingerprint: `response_submit_request|${WALLET_ADDRESS.toLowerCase()}|alpha|${QUESTION_ID.toLowerCase()}`,
  });
  writeRequest({
    requestId: 'agent_req_revoked123',
    status: 'revoked',
    revokedAt: '2026-05-06T00:01:00.000Z',
  });
  writeRequest({ requestId: 'agent_req_pending123' });
  writeRequest({ requestId: 'agent_req_approved123', status: 'approved' });
  writeRequest({ requestId: 'agent_req_denied123', status: 'denied' });
  writeRequest({ requestId: 'agent_req_submitted123', status: 'submitted' });
  writeRequest({ requestId: 'agent_req_failed123', status: 'failed' });

  const expired = await callRoute(handleRoute, {
    path: '/api/agent/requests/agent_req_expired123',
  });
  assert.equal(expired.status, 200);
  assert.equal(expired.payload.request.status, 'expired');
  assert.equal(expired.payload.request.requiresApproval, false);
  assert.equal(expired.payload.request.terminal, true);
  assert.equal(expired.payload.lifecycle.reason, 'request_expired');

  const revoked = await callRoute(handleRoute, {
    path: '/api/agent/requests/agent_req_revoked123',
  });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.payload.request.status, 'revoked');
  assert.equal(revoked.payload.request.requiresApproval, false);
  assert.equal(revoked.payload.request.terminal, true);
  assert.equal(revoked.payload.lifecycle.reason, 'request_revoked');

  const inbox = await callRoute(handleRoute, { path: '/api/agent/inbox?session=alpha' });
  assert.equal(inbox.status, 200);
  const byId = Object.fromEntries(inbox.payload.requests.map((request) => [request.requestId, request]));
  assert.equal(byId.agent_req_expired123.status, 'expired');
  assert.equal(byId.agent_req_expired123.requiresApproval, false);
  assert.equal(byId.agent_req_revoked123.status, 'revoked');
  assert.equal(byId.agent_req_revoked123.requiresApproval, false);
  assert.deepEqual(inbox.payload.requestStatusCounts, {
    expired: 1,
    revoked: 1,
    pending_approval: 1,
    approved: 1,
    denied: 1,
    submitted: 1,
    failed: 1,
  });

  const retryExpired = await callRoute(handleRoute, {
    path: '/api/agent/responses/submit-request',
    method: 'POST',
    body: {
      session: 'alpha',
      questionIds: [QUESTION_ID],
      idempotencyKey: 'submit:alpha.expired1',
    },
  });
  assert.equal(retryExpired.status, 409);
  assert.equal(retryExpired.payload.code, 'idempotency_key_not_pending_approval');
  assert.equal(retryExpired.payload.request.status, 'expired');
  assert.equal(retryExpired.payload.request.requiresApproval, false);
});
