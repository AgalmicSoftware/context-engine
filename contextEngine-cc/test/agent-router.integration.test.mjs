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
const AGENT_ID = 'telegram:agent-1';
const GRANT_ID = 'agent_grant_router01';

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

function writeHarnessGrant(dataDir, record = {}) {
  const grantDir = resolve(dataDir, 'agent-grants');
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

async function callRoute(handleRoute, {
  path,
  method = 'GET',
  body = {},
  token = 'valid-agent-jwt',
  headers = {},
  deps = {},
} = {}) {
  const res = makeMockRes();
  await handleRoute(makeReq({ token, headers }), res, {
    url: new URL(path, 'http://localhost:7391'),
    method,
    body,
  }, deps);
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

  ['capabilities', 'schemas', 'approvalResponses', 'lifecycle', 'actionInventory', 'bridgePrimitives'].forEach((moduleName) => {
    const href = pathToFileURL(resolve(CC_ROOT, 'lib', 'agent', `${moduleName}.mjs`)).href;
    writeModule(resolve(libDir, 'agent', `${moduleName}.mjs`), `export * from ${JSON.stringify(href)};\n`);
  });
  writeFileSync(resolve(libDir, 'storageRefs.mjs'), readFileSync(resolve(CC_ROOT, 'lib', 'storageRefs.mjs'), 'utf8'));
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

test('agent routes use stable server error envelopes', async (t) => {
  const harness = setupRouterHarness(t);
  const { handleRoute } = await import(harness.routerUrl);

  const result = await callRoute(handleRoute, {
    path: '/api/agent/questions?session=alpha',
    deps: {
      async getRandomUnseen() {
        throw new Error('question cache unavailable');
      },
    },
  });

  assert.equal(result.status, 500);
  assert.deepEqual(result.payload, {
    ok: false,
    status: 'server_error',
    code: 'agent_internal_error',
    error: 'question cache unavailable',
  });
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

test('agent routes reject invalid public session slugs with stable envelopes', async (t) => {
  const harness = setupRouterHarness(t);
  const { handleRoute } = await import(harness.routerUrl);
  const cases = [
    {
      label: 'questions missing session',
      path: '/api/agent/questions',
      error: 'session required.',
    },
    {
      label: 'questions empty session',
      path: '/api/agent/questions?session=',
      error: 'session must be a non-empty agent session slug; use "general" for the general session.',
    },
    {
      label: 'questions path-like session',
      path: '/api/agent/questions?session=..%2Foutside',
      error: 'Invalid session slug.',
    },
    {
      label: 'draft missing session',
      path: '/api/agent/responses/draft',
      method: 'POST',
      body: {
        questionId: QUESTION_ID,
        questionType: 'freeform',
        answer: 'Missing session should be invalid.',
      },
      error: 'session required.',
    },
    {
      label: 'draft empty session',
      path: '/api/agent/responses/draft',
      method: 'POST',
      body: {
        session: '',
        questionId: QUESTION_ID,
        questionType: 'freeform',
        answer: 'Empty session should be invalid.',
      },
      error: 'session must be a non-empty agent session slug; use "general" for the general session.',
    },
    {
      label: 'draft path-like session',
      path: '/api/agent/responses/draft',
      method: 'POST',
      body: {
        session: '../outside',
        questionId: QUESTION_ID,
        questionType: 'freeform',
        answer: 'Path-like session should be invalid.',
      },
      error: 'Invalid session slug.',
    },
    {
      label: 'drafts missing session',
      path: '/api/agent/responses/drafts',
      error: 'session required.',
    },
    {
      label: 'drafts empty session',
      path: '/api/agent/responses/drafts?session=',
      error: 'session must be a non-empty agent session slug; use "general" for the general session.',
    },
    {
      label: 'drafts path-like session',
      path: '/api/agent/responses/drafts?session=..%2Foutside',
      error: 'Invalid session slug.',
    },
    {
      label: 'inbox empty session',
      path: '/api/agent/inbox?session=',
      error: 'session must be a non-empty agent session slug; use "general" for the general session.',
    },
    {
      label: 'inbox path-like session',
      path: '/api/agent/inbox?session=..%2Foutside',
      error: 'Invalid session slug.',
    },
    {
      label: 'submit-request missing session',
      path: '/api/agent/responses/submit-request',
      method: 'POST',
      body: { questionIds: [QUESTION_ID] },
      error: 'session required.',
    },
    {
      label: 'submit-request empty session',
      path: '/api/agent/responses/submit-request',
      method: 'POST',
      body: { session: '', questionIds: [QUESTION_ID] },
      error: 'session must be a non-empty agent session slug; use "general" for the general session.',
    },
    {
      label: 'submit-request path-like session',
      path: '/api/agent/responses/submit-request',
      method: 'POST',
      body: { session: '../outside', questionIds: [QUESTION_ID] },
      error: 'Invalid session slug.',
    },
  ];

  for (const testCase of cases) {
    const result = await callRoute(handleRoute, {
      path: testCase.path,
      method: testCase.method || 'GET',
      body: testCase.body || {},
    });
    assert.equal(result.status, 400, testCase.label);
    assert.deepEqual(result.payload, {
      ok: false,
      status: 'bad_request',
      code: 'invalid_session',
      error: testCase.error,
    }, testCase.label);
  }
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
        note: 'Bearer long-lived-token',
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
  assert.equal(stored.payload.agentContext.note, '[redacted]');
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

  const scopedStatus = await callRoute(handleRoute, {
    path: `/api/agent/requests/${encodeURIComponent(first.payload.requestId)}?session=alpha`,
  });
  assert.equal(scopedStatus.status, 200);
  assert.equal(scopedStatus.payload.request.requestId, first.payload.requestId);

  const wrongSessionStatus = await callRoute(handleRoute, {
    path: `/api/agent/requests/${encodeURIComponent(first.payload.requestId)}?session=beta`,
  });
  assert.equal(wrongSessionStatus.status, 404);
  assert.equal(wrongSessionStatus.payload.code, 'agent_request_not_found');

  const invalidSessionStatus = await callRoute(handleRoute, {
    path: `/api/agent/requests/${encodeURIComponent(first.payload.requestId)}?session=`,
  });
  assert.equal(invalidSessionStatus.status, 400);
  assert.deepEqual(invalidSessionStatus.payload, {
    ok: false,
    status: 'bad_request',
    code: 'invalid_session',
    error: 'session must be a non-empty agent session slug; use "general" for the general session.',
  });

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

test('agent grant routes list read and revoke wallet-scoped delegated grants', async (t) => {
  const harness = setupRouterHarness(t);
  writeHarnessGrant(harness.dataDir);
  writeHarnessGrant(harness.dataDir, {
    grantId: 'agent_grant_other123',
    humanPrincipal: SECOND_WALLET_ADDRESS,
  });
  const { handleRoute } = await import(harness.routerUrl);

  const list = await callRoute(handleRoute, { path: '/api/agent/grants?session=alpha' });
  assert.equal(list.status, 200);
  assert.equal(list.payload.count, 1);
  assert.equal(list.payload.grants[0].grantId, GRANT_ID);
  assert.equal(list.payload.grants[0].humanPrincipal, WALLET_ADDRESS.toLowerCase());
  assert.equal(list.payload.grants[0].signingAuthority, false);
  assert.equal(list.payload.grants[0].workerTokenAuthority, false);

  const read = await callRoute(handleRoute, { path: `/api/agent/grants/${GRANT_ID}?session=alpha` });
  assert.equal(read.status, 200);
  assert.equal(read.payload.grant.agentId, AGENT_ID);
  assert.deepEqual(read.payload.grant.allowedActions, ['agent.response.delegated_execute']);

  const otherWallet = await callRoute(handleRoute, {
    path: `/api/agent/grants/${GRANT_ID}`,
    token: 'second-agent-jwt',
  });
  assert.equal(otherWallet.status, 404);
  assert.equal(otherWallet.payload.code, 'agent_grant_not_found');

  const invalid = await callRoute(handleRoute, { path: '/api/agent/grants/not-a-grant' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.payload.code, 'invalid_grant_id');

  const revoked = await callRoute(handleRoute, {
    path: '/api/agent/grants/revoke',
    method: 'POST',
    body: { grantId: GRANT_ID },
  });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.payload.status, 'grant_revoked');
  assert.equal(revoked.payload.grant.status, 'revoked');
});

test('agent connect request routes create human-approved scoped grants without leaking secrets', async (t) => {
  const harness = setupRouterHarness(t);
  const { handleRoute } = await import(harness.routerUrl);
  const requestBody = {
    agentId: AGENT_ID,
    requestedScopes: ['agent:delegated-execute'],
    requestedSessions: ['alpha'],
    requestedActions: ['agent.response.delegated_execute'],
    riskCeiling: 'medium',
    executionPolicy: 'scoped_delegated_execute',
    auditRequired: true,
    expiresAt: '2099-01-01T00:00:00.000Z',
    idempotencyKey: 'connect:alpha.0001',
    signingAuthority: false,
    agentContext: {
      workerToken: 'must-redact',
      note: 'Bearer long-lived-token',
    },
  };

  const malformed = await callRoute(handleRoute, {
    path: '/api/agent/connect-requests',
    method: 'POST',
    body: {
      ...requestBody,
      requestedScopes: ['agent:delegated-execute', 'agent:sign'],
      idempotencyKey: 'connect:alpha.bad1',
    },
  });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.payload.code, 'invalid_connect_request');
  assert.equal(malformed.payload.reason, 'invalid_requested_scopes');

  const created = await callRoute(handleRoute, {
    path: '/api/agent/connect-requests',
    method: 'POST',
    body: requestBody,
  });
  assert.equal(created.status, 202);
  assert.equal(created.payload.ok, false);
  assert.equal(created.payload.requiresApproval, true);
  assert.equal(created.payload.connectRequest.status, 'pending_approval');
  assert.equal(created.payload.connectRequest.humanPrincipal, WALLET_ADDRESS.toLowerCase());
  assert.equal(created.payload.connectRequest.agentId, AGENT_ID);
  assert.deepEqual(created.payload.connectRequest.requestedSessions, ['alpha']);
  assert.deepEqual(created.payload.connectRequest.requestedActions, ['agent.response.delegated_execute']);
  assert.match(created.payload.connectRequest.fingerprint, /^connect_grant_request\|/);
  assert.equal(created.payload.connectRequest.signingAuthority, false);
  assert.equal(created.payload.connectRequest.workerTokenAuthority, false);

  const requestFile = resolve(harness.dataDir, 'agent-requests', `${created.payload.requestId}.json`);
  assert.equal(existsSync(requestFile), true);
  const stored = JSON.parse(readFileSync(requestFile, 'utf8'));
  assert.equal(stored.payload.agentContext.workerToken, '[redacted]');
  assert.equal(stored.payload.agentContext.note, '[redacted]');

  const read = await callRoute(handleRoute, {
    path: `/api/agent/connect-requests/${created.payload.requestId}`,
  });
  assert.equal(read.status, 200);
  assert.equal(read.payload.connectRequest.requestId, created.payload.requestId);
  assert.equal(read.payload.connectRequest.requiresApproval, true);
  assert.equal(read.payload.connectRequest.grantId, null);

  const alphaInbox = await callRoute(handleRoute, {
    path: '/api/agent/inbox?session=alpha',
  });
  assert.equal(alphaInbox.status, 200);
  assert.deepEqual(
    alphaInbox.payload.requests.map((request) => request.requestId),
    [created.payload.requestId],
  );

  const betaInbox = await callRoute(handleRoute, {
    path: '/api/agent/inbox?session=beta',
  });
  assert.equal(betaInbox.status, 200);
  assert.deepEqual(betaInbox.payload.requests, []);

  const allSessionInbox = await callRoute(handleRoute, {
    path: '/api/agent/inbox',
  });
  assert.equal(allSessionInbox.status, 200);
  assert.deepEqual(
    allSessionInbox.payload.requests.map((request) => request.requestId),
    [created.payload.requestId],
  );

  const replay = await callRoute(handleRoute, {
    path: '/api/agent/connect-requests',
    method: 'POST',
    body: requestBody,
  });
  assert.equal(replay.status, 202);
  assert.equal(replay.payload.idempotent, true);
  assert.equal(replay.payload.requestId, created.payload.requestId);

  const conflict = await callRoute(handleRoute, {
    path: '/api/agent/connect-requests',
    method: 'POST',
    body: {
      ...requestBody,
      requestedSessions: ['beta'],
    },
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.payload.code, 'idempotency_key_conflict');

  const widening = await callRoute(handleRoute, {
    path: '/api/agent/connect-requests/approve',
    method: 'POST',
    body: {
      requestId: created.payload.requestId,
      requestedSessions: ['alpha', 'beta'],
    },
  });
  assert.equal(widening.status, 400);
  assert.equal(widening.payload.code, 'connect_request_scope_override_denied');

  const approved = await callRoute(handleRoute, {
    path: '/api/agent/connect-requests/approve',
    method: 'POST',
    body: {
      requestId: created.payload.requestId,
    },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.payload.status, 'connect_request_approved');
  assert.equal(approved.payload.grant.humanPrincipal, WALLET_ADDRESS.toLowerCase());
  assert.deepEqual(approved.payload.grant.sessions, ['alpha']);
  assert.deepEqual(approved.payload.grant.allowedActions, ['agent.response.delegated_execute']);
  assert.equal(approved.payload.grant.signingAuthority, false);
  assert.equal(approved.payload.grant.workerTokenAuthority, false);

  const grantFile = resolve(harness.dataDir, 'agent-grants', `${approved.payload.grant.grantId}.json`);
  assert.equal(existsSync(grantFile), true);

  const repeatApproval = await callRoute(handleRoute, {
    path: '/api/agent/connect-requests/approve',
    method: 'POST',
    body: {
      requestId: created.payload.requestId,
    },
  });
  assert.equal(repeatApproval.status, 409);
  assert.equal(repeatApproval.payload.reason, 'connect_request_not_pending');

  const mismatchedDelegatedExecute = await callRoute(handleRoute, {
    path: '/api/agent/responses/delegated-execute',
    method: 'POST',
    body: {
      session: 'beta',
      questionIds: [QUESTION_ID],
      grantId: approved.payload.grant.grantId,
      agentId: AGENT_ID,
    },
  });
  assert.equal(mismatchedDelegatedExecute.status, 403);
  assert.equal(mismatchedDelegatedExecute.payload.reason, 'session_mismatch');

  const expiredRequestId = 'agent_req_expiredconnect';
  const expiredRecord = {
    ...stored,
    requestId: expiredRequestId,
    idempotencyKey: 'connect:alpha.expired1',
    expiresAt: '2000-01-01T00:00:00.000Z',
    status: 'pending_approval',
    requiresApproval: true,
  };
  writeFileSync(resolve(harness.dataDir, 'agent-requests', `${expiredRequestId}.json`), JSON.stringify(expiredRecord, null, 2));
  const expiredApproval = await callRoute(handleRoute, {
    path: '/api/agent/connect-requests/approve',
    method: 'POST',
    body: {
      requestId: expiredRequestId,
    },
  });
  assert.equal(expiredApproval.status, 409);
  assert.equal(expiredApproval.payload.reason, 'request_expired');
});

test('agent connect request denial transitions only pending human-scoped requests', async (t) => {
  const harness = setupRouterHarness(t);
  const { handleRoute } = await import(harness.routerUrl);

  const created = await callRoute(handleRoute, {
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
      idempotencyKey: 'connect:alpha.deny1',
    },
  });
  assert.equal(created.status, 202);

  const denied = await callRoute(handleRoute, {
    path: '/api/agent/connect-requests/deny',
    method: 'POST',
    body: {
      requestId: created.payload.requestId,
      reason: 'not now',
    },
  });
  assert.equal(denied.status, 200);
  assert.equal(denied.payload.status, 'connect_request_denied');
  assert.equal(denied.payload.connectRequest.status, 'rejected');
  assert.equal(denied.payload.connectRequest.requiresApproval, false);

  const replay = await callRoute(handleRoute, {
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
      idempotencyKey: 'connect:alpha.deny1',
    },
  });
  assert.equal(replay.status, 409);
  assert.equal(replay.payload.code, 'idempotency_key_not_pending_approval');
});

test('agent managed account routes create metadata and approval-only link requests', async (t) => {
  const harness = setupRouterHarness(t);
  const { handleRoute } = await import(harness.routerUrl);

  const rejectedSecret = await callRoute(handleRoute, {
    path: '/api/agent/accounts/create',
    method: 'POST',
    body: {
      telegramUserId: '555',
      workerDeploymentId: 'worker-demo-1',
      privateKey: `0x${'99'.repeat(32)}`,
    },
  });
  assert.equal(rejectedSecret.status, 400);
  assert.equal(rejectedSecret.payload.code, 'account_secret_material_denied');

  const created = await callRoute(handleRoute, {
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
  assert.equal(created.payload.account.humanPrincipal, WALLET_ADDRESS.toLowerCase());
  assert.match(created.payload.account.accountId, /^agent_account_[a-z0-9]{20}$/);
  assert.match(created.payload.account.accountAddress, /^0x[0-9a-f]{40}$/);
  assert.equal(created.payload.account.signingAuthority, false);
  assert.equal(created.payload.account.workerTokenAuthority, false);
  assert.equal(created.payload.account.privateKeyAuthority, false);
  assert.equal(created.payload.account.rawKeyMaterialExportable, false);
  assert.equal(created.payload.signingEnabled, false);
  assert.equal(created.payload.contractOnly, true);
  assert.equal(created.payload.event.eventType, 'account_created');
  assert.equal(JSON.stringify(created.payload).includes('privateKey'), true);
  assert.equal(JSON.stringify(created.payload).includes(`0x${'99'.repeat(32)}`), false);

  const recovered = await callRoute(handleRoute, {
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

  const rejectedLinkSecret = await callRoute(handleRoute, {
    path: '/api/agent/accounts/link-request',
    method: 'POST',
    body: {
      accountId: created.payload.account.accountId,
      targetPrincipal: { wallet: WALLET_ADDRESS },
      idempotencyKey: 'account:link.0001',
      agentContext: {
        workerToken: 'must-redact',
      },
    },
  });
  assert.equal(rejectedLinkSecret.status, 400);
  assert.equal(rejectedLinkSecret.payload.code, 'account_secret_material_denied');

  const linkRequest = await callRoute(handleRoute, {
    path: '/api/agent/accounts/link-request',
    method: 'POST',
    body: {
      accountId: created.payload.account.accountId,
      targetPrincipal: { wallet: WALLET_ADDRESS },
      idempotencyKey: 'account:link.0001',
    },
  });
  assert.equal(linkRequest.status, 202);
  assert.equal(linkRequest.payload.requiresApproval, true);
  assert.equal(linkRequest.payload.linked, false);
  assert.equal(linkRequest.payload.signingEnabled, false);
  assert.equal(linkRequest.payload.contractOnly, true);
  assert.equal(linkRequest.payload.request.type, 'account_link_request');
  assert.equal(linkRequest.payload.event.eventType, 'link_requested');

  const replay = await callRoute(handleRoute, {
    path: '/api/agent/accounts/link-request',
    method: 'POST',
    body: {
      accountId: created.payload.account.accountId,
      targetPrincipal: { wallet: WALLET_ADDRESS },
      idempotencyKey: 'account:link.0001',
    },
  });
  assert.equal(replay.status, 202);
  assert.equal(replay.payload.idempotent, true);
  assert.equal(replay.payload.request.requestId, linkRequest.payload.request.requestId);
});

test('agent delegated response execution validates grant scope and writes a contract-only audit record', async (t) => {
  const harness = setupRouterHarness(t);
  writeHarnessGrant(harness.dataDir);
  const { handleRoute } = await import(harness.routerUrl);

  const invalidGrant = await callRoute(handleRoute, {
    path: '/api/agent/responses/delegated-execute',
    method: 'POST',
    body: {
      session: 'alpha',
      questionIds: [QUESTION_ID],
      grantId: 'not-a-grant',
      agentId: AGENT_ID,
    },
  });
  assert.equal(invalidGrant.status, 400);
  assert.equal(invalidGrant.payload.code, 'invalid_grant_id');

  const success = await callRoute(handleRoute, {
    path: '/api/agent/responses/delegated-execute',
    method: 'POST',
    body: {
      session: 'alpha',
      questionIds: [QUESTION_ID],
      grantId: GRANT_ID,
      agentId: AGENT_ID,
      idempotencyKey: 'delegated:alpha.0001',
      agentContext: {
        workerToken: 'must-redact',
        note: 'Bearer long-lived-token',
      },
    },
  });
  assert.equal(success.status, 202);
  assert.equal(success.payload.ok, true);
  assert.equal(success.payload.executed, false);
  assert.equal(success.payload.execution.status, 'contract_only_deferred');
  assert.equal(success.payload.execution.productDecisionRequired, true);
  assert.equal(success.payload.request.status, 'approved');
  assert.equal(success.payload.request.requiresApproval, false);
  assert.equal(success.payload.grant.signingAuthority, false);
  assert.equal(success.payload.grant.workerTokenAuthority, false);

  const requestFile = resolve(harness.dataDir, 'agent-requests', `${success.payload.request.requestId}.json`);
  assert.equal(existsSync(requestFile), true);
  const stored = JSON.parse(readFileSync(requestFile, 'utf8'));
  assert.equal(stored.type, 'response_delegated_execute');
  assert.equal(stored.payload.agentContext.workerToken, '[redacted]');
  assert.equal(stored.payload.agentContext.note, '[redacted]');
  assert.equal(stored.grantId, GRANT_ID);
  assert.equal(stored.actionId, 'agent.response.delegated_execute');

  const retry = await callRoute(handleRoute, {
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
  assert.equal(retry.payload.request.requestId, success.payload.request.requestId);

  const wrongSession = await callRoute(handleRoute, {
    path: '/api/agent/responses/delegated-execute',
    method: 'POST',
    body: {
      session: 'beta',
      questionIds: [QUESTION_ID],
      grantId: GRANT_ID,
      agentId: AGENT_ID,
    },
  });
  assert.equal(wrongSession.status, 403);
  assert.equal(wrongSession.payload.code, 'agent_grant_denied');
  assert.equal(wrongSession.payload.reason, 'session_mismatch');

  writeHarnessGrant(harness.dataDir, {
    grantId: 'agent_grant_highrisk',
    riskCeiling: 'low',
  });
  const highRisk = await callRoute(handleRoute, {
    path: '/api/agent/responses/delegated-execute',
    method: 'POST',
    body: {
      session: 'alpha',
      questionIds: [QUESTION_ID],
      grantId: 'agent_grant_highrisk',
      agentId: AGENT_ID,
    },
  });
  assert.equal(highRisk.status, 403);
  assert.equal(highRisk.payload.reason, 'risk_ceiling_exceeded');
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
