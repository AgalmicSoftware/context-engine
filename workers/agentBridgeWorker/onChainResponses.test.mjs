import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import {
  __test__onChainResponses,
  authenticateSessionWorker,
  base64urlToHex,
  directSubmitFeatureEnabled,
  requestManagedAccountFaucetOnJoin,
  requestSessionWorkerFaucet,
  resolveSurveysAddress,
  submitAgentResponseOnChain,
} from './onChainResponses.mjs';
import { normalizeLegacyManagedPrincipal } from './legacyCompatibility.mjs';
import { parseSiweMessage, validateSiweResources } from '../sessionCorsWorker/siweMessageValidation.js';
import { buildSiweMessage } from '../../shared/auth/siweMessage.mjs';

const bytes32QuestionId = `0x${'12'.repeat(32)}`;
const surveysAddress = '0x1111111111111111111111111111111111111111';
const faucetTxHash = `0x${'34'.repeat(32)}`;

test('Bridge session ID normalization follows the browser, MCP and Worker vectors', () => {
  const id = '0x00112233445566778899aabbccddeeff';
  for (const [input, expected] of [
    [id, id], [id.toUpperCase(), id], [id.slice(2), id], ['00112233-4455-6677-8899-AABBCCDDEEFF', id],
    ['0x00000000000000000000000000000000', ''], ['00000000-0000-0000-0000-000000000000', ''],
    [` ${id}`, ''], [`${id} `, ''], ['0x0011-2233445566778899aabbccddeeff', ''],
    ['00112233445566778899aabbccddeeff-', ''], ['0x1234', ''], [null, ''], [{}, ''],
  ]) assert.equal(__test__onChainResponses.normalizeCanonicalWorkerSessionId(input), expected);
});

function arweaveId(byte = 7) {
  return Buffer.from(Uint8Array.from({ length: 32 }, () => byte)).toString('base64url');
}

test('worker-login fallback candidates include the canonical .sh site before the legacy redirect origin', () => {
  const candidates = __test__onChainResponses.resolveLoginOriginCandidates({}, {});

  assert.ok(candidates.indexOf('https://contextengine.sh') >= 0);
  assert.ok(candidates.indexOf('https://contextengine.xyz') >= 0);
  assert.ok(candidates.indexOf('https://contextengine.sh') < candidates.indexOf('https://contextengine.xyz'));
});

async function makeAccount() {
  const principal = normalizeLegacyManagedPrincipal({ telegramUserId: '42', username: 'participant' });
  const account = await deriveManagedDemoAccount({
    principal,
    deploymentId: 'deploy-a',
    rootSecret: 'root-a',
  });
  return { principal, account };
}

function makeWorkerFetch(calls = [], {
  txId = arweaveId(),
} = {}) {
  return async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url).endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token', exp: 2000000000 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url).endsWith('/storage/upload')) {
      return new Response(JSON.stringify({
        id: txId,
        storageRef: { backend: 'arweave', id: txId, resource: 'responses' },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ amountEth: '0.05', txHash: faucetTxHash }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

test('preview identities cannot obtain a session Worker credential', async () => {
  const principal = normalizeLegacyManagedPrincipal({ telegramUserId: 'preview-user' });
  const account = await deriveManagedDemoAccount({ principal, deploymentId: 'deploy-a', rootSecret: 'root-a' });
  const calls = [];
  const result = await authenticateSessionWorker({
    env: { DEMO_SIGNER_ROOT_SECRET: 'root-a', AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a', DEFAULT_CHAIN_ID: '11155420' },
    session: { sessionSlug: 'alpha', sessionWorkerUrl: 'https://session.example' },
    principal, account, fetchImpl: makeWorkerFetch(calls),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'preview_credential_forbidden');
  assert.equal(calls.length, 0);
});

test('authenticates managed Telegram account against the session worker without exposing key material', async () => {
  const { principal, account } = await makeAccount();
  const calls = [];
  const result = await authenticateSessionWorker({
    env: {
      DEMO_SIGNER_ROOT_SECRET: 'root-a',
      AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
      DEFAULT_CHAIN_ID: '11155420',
    },
    session: { sessionSlug: 'alpha', sessionWorkerUrl: 'https://session.example' },
    principal,
    account,
    fetchImpl: makeWorkerFetch(calls),
    now: new Date('2026-05-11T12:00:00.000Z'),
  });

  assert.equal(result.ok, true);
  assert.equal(result.token, 'worker-token');
  assert.equal(result.accountAddress, account.accountAddress);
  assert.equal(result.origin, 'http://localhost:7391');
  assert.equal(result.privateKey, undefined);
  assert.equal(JSON.stringify(result).includes('root-a'), false);
  assert.equal(calls.length, 2);

  const nonceBody = JSON.parse(calls[0].init.body);
  const loginBody = JSON.parse(calls[1].init.body);
  assert.equal(calls[0].init.headers.Origin, 'http://localhost:7391');
  assert.equal(Object.hasOwn(calls[0].init.headers, 'origin'), false);
  assert.equal(Object.hasOwn(calls[1].init.headers, 'origin'), false);
  assert.equal(nonceBody.address, account.accountAddress);
  assert.equal(nonceBody.sessionSlug, 'alpha');
  assert.equal(loginBody.address, account.accountAddress);
  assert.match(loginBody.message, /^localhost:7391 wants you to sign in with your Ethereum account:/);
  assert.equal(loginBody.message.includes('root-a'), false);
  assert.match(loginBody.signature, /^0x[0-9a-f]+$/);
});

test('worker-canonical agent auth sends and verifies the exact session identity', async () => {
  const { principal, account } = await makeAccount();
  const calls = [];
  const sessionId = `0x${'12'.repeat(16)}`;
  const result = await authenticateSessionWorker({
    env: {
      DEMO_SIGNER_ROOT_SECRET: 'root-a',
      AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
      DEFAULT_CHAIN_ID: '11155420',
      CE_SESSION_WORKER_BASE_URL: 'https://generic-worker.example',
    },
    session: {
      sessionSlug: 'alpha',
      sessionIdHex: ` ${sessionId} `,
      sessionWorkerUrl: 'https://session.example',
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    },
    principal,
    account,
    workerUrl: 'https://caller-selected-worker.example',
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/auth/nonce')) {
        return new Response(JSON.stringify({
          nonce: 'nonceexact123',
          sessionSlug: 'alpha',
          sessionId,
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const message = JSON.parse(init.body).message;
      assert.equal(message, buildSiweMessage({ address: account.accountAddress, nonce: 'nonceexact123',
        domain: 'localhost:7391', uri: 'http://localhost:7391', chainId: 11155420,
        statement: 'Sign in to Context Engine.', issuedAt: '2026-05-11T12:00:00.000Z',
        expirationTime: '2026-05-12T12:00:00.000Z', workerUrl: 'https://session.example', sessionId }));
      const siwe = parseSiweMessage(message);
      assert.deepEqual(validateSiweResources({
        siwe,
        request: new Request(String(url)),
        config: { sessionId, sessionModeProfile: { authority: { mode: 'worker_canonical' } } },
        targetSlug: 'alpha',
      }), { ok: true });
      return new Response(JSON.stringify({
        token: 'worker-token',
        exp: 2_000_000_000,
        sessionSlug: 'alpha',
        sessionId,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
    now: new Date('2026-05-11T12:00:00.000Z'),
  });

  assert.equal(result.ok, true);
  assert.equal(result.sessionId, sessionId);
  assert.equal(result.workerUrl, 'https://session.example');
  assert.equal(calls.every(({ url }) => String(url).startsWith('https://session.example/')), true);
  assert.equal(JSON.parse(calls[0].init.body).sessionId, sessionId);
  assert.equal(JSON.parse(calls[1].init.body).sessionId, sessionId);
});

for (const [configuredSlug, targetSlug] of [['alpha', 'alpha'], ['debate', 'rxc'], ['general', '']]) {
  test(`managed account SIWE resources match the Worker for session ${configuredSlug}`, async () => {
    const { principal, account } = await makeAccount();
    let loginCount = 0;
    const result = await authenticateSessionWorker({
      env: { DEMO_SIGNER_ROOT_SECRET: 'root-a', AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a' },
      session: { sessionSlug: configuredSlug, sessionWorkerUrl: 'https://session.example' },
      principal,
      account,
      fetchImpl: async (url, init) => {
        if (String(url).endsWith('/auth/nonce')) return Response.json({ nonce: 'nonce123456' });
        const siwe = parseSiweMessage(JSON.parse(init.body).message);
        const result = validateSiweResources({ siwe, request: new Request(url), config: {}, targetSlug });
        assert.deepEqual(result, { ok: true });
        loginCount += 1;
        return Response.json({ token: 'worker-token' });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(loginCount, 1);
  });
}

test('a named-session mismatch fails closed before signing for an unknown fallback session', async () => {
  const { principal, account } = await makeAccount();
  const calls = [];
  await assert.rejects(authenticateSessionWorker({
    env: { DEMO_SIGNER_ROOT_SECRET: 'root-a', AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a' },
    session: { sessionSlug: 'alpha', sessionWorkerUrl: 'https://session.example' },
    principal,
    account,
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      if (JSON.parse(init.body).sessionSlug) {
        return Response.json({ error: 'sessionSlug does not match worker session.' }, { status: 400 });
      }
      return Response.json({ nonce: 'nonce123456', token: 'wrong-session-token' });
    },
  }), /session_worker_identity_mismatch/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.sessionSlug, 'alpha');
});

test('worker-canonical agent auth does not inherit caller-selected or generic Worker URLs', async () => {
  const { principal, account } = await makeAccount();
  let fetchCalls = 0;
  const result = await authenticateSessionWorker({
    env: {
      DEMO_SIGNER_ROOT_SECRET: 'root-a',
      AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
      CE_SESSION_WORKER_BASE_URL: 'https://generic-worker.example',
      SESSION_WORKER_URL: 'https://other-generic-worker.example',
    },
    session: {
      sessionSlug: 'alpha',
      sessionIdHex: `0x${'12'.repeat(16)}`,
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    },
    principal,
    account,
    workerUrl: 'https://caller-selected-worker.example',
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('must not fetch');
    },
  });

  assert.deepEqual(result, { ok: false, skipped: true, reason: 'session_worker_url_missing' });
  assert.equal(fetchCalls, 0);
});

test('worker-canonical agent auth fails before signing when canonical identity is missing', async () => {
  const { principal, account } = await makeAccount();
  let fetchCalls = 0;
  const result = await authenticateSessionWorker({
    env: {
      DEMO_SIGNER_ROOT_SECRET: 'root-a',
      AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
    },
    session: {
      sessionSlug: 'alpha',
      sessionWorkerUrl: 'https://session.example',
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    },
    principal,
    account,
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('must not fetch');
    },
  });

  assert.deepEqual(result, { ok: false, reason: 'session_worker_identity_missing' });
  assert.equal(fetchCalls, 0);
});

test('worker-canonical agent auth rejects malformed or conflicting identity aliases even when one alias is valid', async () => {
  const { principal, account } = await makeAccount();
  const validSessionId = `0x${'12'.repeat(16)}`;
  let fetchCalls = 0;
  for (const identityAliases of [
    { sessionId: validSessionId, sessionIdHex: 'not-a-session-id' },
    { sessionId: validSessionId, sessionIdHex: `0x${'34'.repeat(16)}` },
  ]) {
    const result = await authenticateSessionWorker({
      env: {
        DEMO_SIGNER_ROOT_SECRET: 'root-a',
        AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
      },
      session: {
        sessionSlug: 'alpha',
        ...identityAliases,
        sessionWorkerUrl: 'https://session.example',
        sessionModeProfile: { authority: { mode: 'worker_canonical' } },
      },
      principal,
      account,
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error('must not fetch');
      },
    });

    assert.deepEqual(result, { ok: false, reason: 'session_worker_identity_missing' });
  }
  assert.equal(fetchCalls, 0);
});

test('session worker auth retries trusted fallback origins after CORS origin rejection', async () => {
  const { principal, account } = await makeAccount();
  const calls = [];
  const result = await authenticateSessionWorker({
    env: {
      DEMO_SIGNER_ROOT_SECRET: 'root-a',
      AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
      DEFAULT_CHAIN_ID: '11155420',
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    },
    session: { sessionSlug: 'alpha', sessionWorkerUrl: 'https://session.example' },
    principal,
    account,
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (init.headers?.Origin !== 'http://localhost:3000') {
        return new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).endsWith('/auth/nonce')) {
        return new Response(JSON.stringify({ nonce: 'nonce-456' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).endsWith('/auth/login')) {
        return new Response(JSON.stringify({ token: 'worker-token', exp: 2000000000 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'unexpected_url' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    },
    now: new Date('2026-05-11T12:00:00.000Z'),
  });

  assert.equal(result.ok, true);
  assert.equal(result.origin, 'http://localhost:3000');
  assert.deepEqual(calls.map((call) => [
    new URL(call.url).pathname,
    call.init.headers.Origin,
  ]), [
    ['/auth/nonce', 'https://bridge.example'],
    ['/auth/nonce', 'http://localhost:3000'],
    ['/auth/login', 'http://localhost:3000'],
  ]);
  assert.match(JSON.parse(calls[2].init.body).message, /^localhost:3000 wants you to sign in with your Ethereum account:/);
});

test('session worker auth failures include sanitized upstream route diagnostics', async () => {
  const { principal, account } = await makeAccount();
  await assert.rejects(
    authenticateSessionWorker({
      env: {
        DEMO_SIGNER_ROOT_SECRET: 'root-a',
        AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
        DEFAULT_CHAIN_ID: '11155420',
      },
      session: { sessionSlug: 'alpha', sessionWorkerUrl: 'https://session.example/private?token=hidden' },
      principal,
      account,
      fetchImpl: async () => new Response('nonce route missing', { status: 404 }),
      now: new Date('2026-05-11T12:00:00.000Z'),
    }),
    /worker_nonce_failed: nonce route missing \(404\) at https:\/\/session\.example\/private\/auth\/nonce/
  );
});

test('private join faucet uses latest session worker when session policy allows it', async () => {
  const { principal, account } = await makeAccount();
  const calls = [];
  const result = await requestManagedAccountFaucetOnJoin({
    env: {
      DEMO_SIGNER_ROOT_SECRET: 'root-a',
      AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
      DEFAULT_CHAIN_ID: '11155420',
    },
    session: {
      sessionSlug: 'alpha',
      sessionWorkerUrl: 'https://session.example',
      sponsoredFaucetAllowed: true,
    },
    principal,
    account,
    fetchImpl: makeWorkerFetch(calls),
  });

  assert.equal(result.ok, true);
  assert.equal(result.txHash, faucetTxHash);
  assert.equal(calls.length, 3);
  const faucetCall = calls[2];
  assert.equal(faucetCall.url, 'https://session.example/');
  assert.equal(faucetCall.init.headers.Authorization, 'Bearer worker-token');
  assert.equal(Object.hasOwn(faucetCall.init.headers, 'origin'), false);
  assert.equal(Object.hasOwn(faucetCall.init.headers, 'authorization'), false);
  assert.deepEqual(JSON.parse(faucetCall.init.body), {
    action: 'request_test_eth',
    sessionSlug: 'alpha',
    to: account.accountAddress,
  });
});

test('private join faucet is skipped when session policy does not allow sponsored faucet', async () => {
  const { principal, account } = await makeAccount();
  const result = await requestManagedAccountFaucetOnJoin({
    env: {},
    session: { sessionSlug: 'alpha', sessionWorkerUrl: 'https://session.example' },
    principal,
    account,
    fetchImpl: async () => {
      throw new Error('faucet should not be called');
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'session_faucet_not_allowed');
});

test('direct submit defaults on and remains explicitly disableable', () => {
  assert.equal(directSubmitFeatureEnabled({}), true);
  assert.equal(directSubmitFeatureEnabled({ BROADCAST_ENABLED: 'true' }), true);
  assert.equal(directSubmitFeatureEnabled({ AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED: 'true', BROADCAST_ENABLED: 'false' }), false);
  assert.equal(directSubmitFeatureEnabled({ BROADCAST_ENABLED: 'false' }), false);
  assert.equal(directSubmitFeatureEnabled({ AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED: 'false', BROADCAST_ENABLED: 'true' }), false);
});

test('direct submit RPC resolution keeps default first and adds fallback RPC URLs', () => {
  assert.deepEqual(
    __test__onChainResponses.resolveRpcUrls({
      DEFAULT_RPC_URL: 'https://default-rpc.example',
      RPC_URL: 'https://default-rpc.example',
      ADDITIONAL_RPC_URL: 'https://fallback-one.example, https://fallback-two.example',
    }, {
      sessionSlug: 'alpha',
      fallbackRpcUrl: 'https://session-fallback.example',
    }),
    [
      'https://default-rpc.example',
      'https://session-fallback.example',
      'https://fallback-one.example',
      'https://fallback-two.example',
    ],
  );
});

test('direct submit resolves OP Sepolia Surveys default when session policy omits it', () => {
  assert.equal(
    resolveSurveysAddress({ DEFAULT_CHAIN_ID: '11155420' }, { sessionSlug: 'alpha' }),
    '0x59664B9dA510a33F2edB7E14Cf0c2749bf506B8A'
  );
  assert.equal(
    resolveSurveysAddress(
      { DEFAULT_CHAIN_ID: '11155420', AGENT_BRIDGE_SURVEYS_ADDRESS: '0x1111111111111111111111111111111111111111' },
      { sessionSlug: 'alpha' }
    ),
    surveysAddress
  );
});

test('direct submit uploads response and calls Surveys.submitResponses with managed wallet', async () => {
  const { principal, account } = await makeAccount();
  const calls = [];
  const txId = arweaveId(9);
  const submitted = {};
  const result = await submitAgentResponseOnChain({
    env: {
      DEMO_SIGNER_ROOT_SECRET: 'root-a',
      AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
      DEFAULT_CHAIN_ID: '11155420',
      DEFAULT_RPC_URL: 'https://rpc.example',
    },
    session: {
      sessionSlug: 'alpha',
      sessionWorkerUrl: 'https://session.example',
      surveysAddress,
      managedAccountSubmitAllowed: true,
      sponsoredFaucetAllowed: true,
    },
    principal,
    account,
    questionRef: {
      sessionSlug: 'alpha',
      questionId: bytes32QuestionId,
      questionType: 'rating',
    },
    answer: {
      questionType: 'rating',
      value: 7,
      comments: 'Useful context',
    },
    idempotencyKey: 'telegram_mini_submit:42:alpha:test',
    fetchImpl: makeWorkerFetch(calls, { txId }),
    contractFactory: ({ surveysAddress: address, signer }) => ({
      async submitResponses(questionIds, responseHashes, surveyId, surveyResponseHash) {
        submitted.address = address;
        submitted.signer = signer.address;
        submitted.questionIds = questionIds;
        submitted.responseHashes = responseHashes;
        submitted.surveyId = surveyId;
        submitted.surveyResponseHash = surveyResponseHash;
        return {
          hash: `0x${'56'.repeat(32)}`,
          wait: async () => ({ blockNumber: 123 }),
        };
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'direct_submitted');
  assert.equal(result.accountAddress, account.accountAddress);
  assert.equal(result.txHash, `0x${'56'.repeat(32)}`);
  assert.equal(result.arweaveTxId, txId);
  assert.deepEqual(result.storageRef, { backend: 'arweave', id: txId, resource: 'responses' });
  assert.equal(submitted.address, surveysAddress);
  assert.equal(submitted.signer, account.accountAddress);
  assert.deepEqual(submitted.questionIds, [bytes32QuestionId]);
  assert.deepEqual(submitted.responseHashes, [base64urlToHex(txId)]);
  assert.equal(submitted.surveyId, `0x${'0'.repeat(64)}`);
  assert.equal(submitted.surveyResponseHash, `0x${'0'.repeat(64)}`);

  const uploadCall = calls.find((call) => call.url.endsWith('/storage/upload'));
  assert.equal(uploadCall.init.headers.Authorization, 'Bearer worker-token');
  assert.equal(Object.hasOwn(uploadCall.init.headers, 'authorization'), false);
  const uploadBody = JSON.parse(uploadCall.init.body);
  assert.equal(uploadBody.resource, 'responses');
  const payload = uploadBody.data;
  assert.equal(payload.source, 'telegram-agent-bridge');
  assert.equal(payload.responder, account.accountAddress);
  assert.equal(payload.answer.value, 7);
  assert.equal(JSON.stringify(payload).includes('root-a'), false);
});

test('direct submit accepts Cloudflare storage refs as bytes32 response pointers', async () => {
  const { principal, account } = await makeAccount();
  const calls = [];
  const storageId = arweaveId(10);
  const submitted = {};
  const result = await submitAgentResponseOnChain({
    env: {
      DEMO_SIGNER_ROOT_SECRET: 'root-a',
      AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
      DEFAULT_CHAIN_ID: '11155420',
      DEFAULT_RPC_URL: 'https://rpc.example',
    },
    session: {
      sessionSlug: 'alpha',
      sessionWorkerUrl: 'https://session.example',
      surveysAddress,
      managedAccountSubmitAllowed: true,
    },
    principal,
    account,
    questionRef: {
      sessionSlug: 'alpha',
      questionId: bytes32QuestionId,
      questionType: 'freeform',
    },
    answer: {
      questionType: 'freeform',
      text: 'Cloudflare-backed answer',
    },
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/auth/nonce')) {
        return new Response(JSON.stringify({ nonce: 'nonce-123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).endsWith('/auth/login')) {
        return new Response(JSON.stringify({ token: 'worker-token', exp: 2000000000 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).endsWith('/storage/upload')) {
        return new Response(JSON.stringify({
          id: storageId,
          storageRef: { backend: 'cloudflare', id: storageId, resource: 'responses' },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected call ${url}`);
    },
    contractFactory: () => ({
      async submitResponses(questionIds, responseHashes) {
        submitted.questionIds = questionIds;
        submitted.responseHashes = responseHashes;
        return { hash: `0x${'66'.repeat(32)}`, wait: async () => ({ blockNumber: 124 }) };
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.storageId, storageId);
  assert.equal(result.arweaveTxId, undefined);
  assert.deepEqual(result.storageRef, { backend: 'cloudflare', id: storageId, resource: 'responses' });
  assert.deepEqual(submitted.questionIds, [bytes32QuestionId]);
  assert.deepEqual(submitted.responseHashes, [base64urlToHex(storageId)]);
  assert.equal(calls.some((call) => call.url === 'https://session.example/storage/upload'), true);
});

test('direct submit waits for sponsored faucet balance before raw RPC broadcast', async () => {
  const { principal, account } = await makeAccount();
  const calls = [];
  const workerFetch = makeWorkerFetch(calls, { txId: arweaveId(12) });
  const rpcCalls = [];
  const txHash = `0x${'78'.repeat(32)}`;
  let balanceChecks = 0;
  const fetchImpl = async (url, init = {}) => {
    const urlText = String(url);
    if (urlText === 'https://rpc.example') {
      const body = JSON.parse(init.body);
      rpcCalls.push(body.method);
      let result = null;
      switch (body.method) {
        case 'eth_chainId':
          result = '0xaa37dc';
          break;
        case 'eth_getBalance':
          balanceChecks += 1;
          result = balanceChecks === 1 ? '0x0' : '0x10';
          break;
        case 'eth_getTransactionCount':
          result = '0x0';
          break;
        case 'eth_gasPrice':
          result = '0x3b9aca00';
          break;
        case 'eth_estimateGas':
          result = '0x186a0';
          break;
        case 'eth_sendRawTransaction':
          result = txHash;
          break;
        default:
          throw new Error(`unexpected RPC method ${body.method}`);
      }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return workerFetch(url, init);
  };

  const result = await submitAgentResponseOnChain({
    env: {
      DEMO_SIGNER_ROOT_SECRET: 'root-a',
      AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
      DEFAULT_CHAIN_ID: '11155420',
      DEFAULT_RPC_URL: 'https://rpc.example',
      AGENT_BRIDGE_FAUCET_BALANCE_WAIT_MS: '0',
    },
    session: {
      sessionSlug: 'alpha',
      sessionWorkerUrl: 'https://session.example',
      surveysAddress,
      managedAccountSubmitAllowed: true,
      sponsoredFaucetAllowed: true,
    },
    principal,
    account,
    questionRef: {
      sessionSlug: 'alpha',
      questionId: bytes32QuestionId,
      questionType: 'rating',
    },
    answer: {
      questionType: 'rating',
      value: 5,
    },
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.txHash, txHash);
  assert.equal(result.faucet.ok, true);
  assert.deepEqual(result.faucet.balanceWait, {
    ok: true,
    attempts: 2,
    balanceWei: '0x10',
  });
  assert.deepEqual(rpcCalls, [
    'eth_chainId',
    'eth_getBalance',
    'eth_getBalance',
    'eth_chainId',
    'eth_getTransactionCount',
    'eth_gasPrice',
    'eth_estimateGas',
    'eth_sendRawTransaction',
  ]);
});

test('direct submit falls back to additive RPC when the default RPC cannot detect the network', async () => {
  const { principal, account } = await makeAccount();
  const calls = [];
  const workerFetch = makeWorkerFetch(calls, { txId: arweaveId(11) });
  const rpcCalls = [];
  const txHash = `0x${'77'.repeat(32)}`;
  const fetchImpl = async (url, init = {}) => {
    const urlText = String(url);
    if (urlText.includes('bad-rpc')) {
      rpcCalls.push({ url: urlText, method: JSON.parse(init.body).method });
      throw new Error('could not detect network');
    }
    if (urlText.includes('good-rpc')) {
      const body = JSON.parse(init.body);
      rpcCalls.push({ url: urlText, method: body.method });
      const result = {
        eth_chainId: '0xaa37dc',
        eth_getTransactionCount: '0x0',
        eth_gasPrice: '0x3b9aca00',
        eth_estimateGas: '0x186a0',
        eth_sendRawTransaction: txHash,
      }[body.method];
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return workerFetch(url, init);
  };
  const result = await submitAgentResponseOnChain({
    env: {
      DEMO_SIGNER_ROOT_SECRET: 'root-a',
      AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
      DEFAULT_CHAIN_ID: '11155420',
      DEFAULT_RPC_URL: 'https://bad-rpc.example',
      ADDITIONAL_RPC_URL: 'https://good-rpc.example',
    },
    session: {
      sessionSlug: 'alpha',
      sessionWorkerUrl: 'https://session.example',
      surveysAddress,
      managedAccountSubmitAllowed: true,
    },
    principal,
    account,
    questionRef: {
      sessionSlug: 'alpha',
      questionId: bytes32QuestionId,
      questionType: 'rating',
    },
    answer: {
      questionType: 'rating',
      value: 6,
    },
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.txHash, txHash);
  assert.deepEqual(rpcCalls.map((call) => [call.url, call.method]), [
    ['https://bad-rpc.example', 'eth_chainId'],
    ['https://good-rpc.example', 'eth_chainId'],
    ['https://good-rpc.example', 'eth_getTransactionCount'],
    ['https://good-rpc.example', 'eth_gasPrice'],
    ['https://good-rpc.example', 'eth_estimateGas'],
    ['https://good-rpc.example', 'eth_sendRawTransaction'],
  ]);
  assert.equal(typeof result.storageRef, 'object');
});


test('faucet authentication uses execution time rather than old account creation time', async () => {
  const { principal, account } = await makeAccount();
  const calls = [];
  const now = new Date('2026-10-17T01:30:00.000Z');
  const result = await requestSessionWorkerFaucet({
    env: { DEMO_SIGNER_ROOT_SECRET: 'root-a', AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a' },
    session: { sessionSlug: 'alpha', sessionWorkerUrl: 'https://session.example' },
    principal, account, createdAt: '2026-01-01T00:00:00.000Z', now,
    fetchImpl: makeWorkerFetch(calls),
  });
  assert.equal(result.ok, true);
  const login = JSON.parse(calls.find(({ url }) => url.endsWith('/auth/login')).init.body);
  assert.ok(login.message.includes(`Issued At: ${now.toISOString()}`));
});

test('an uncertain raw broadcast preserves its transaction hash without retry or signer material', async () => {
  const { principal, account } = await makeAccount();
  const workerFetch = makeWorkerFetch([], { txId: arweaveId(13) });
  let rawTransaction;
  const result = await submitAgentResponseOnChain({
    env: {
      DEMO_SIGNER_ROOT_SECRET: 'root-a', AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
      DEFAULT_CHAIN_ID: '11155420', DEFAULT_RPC_URL: 'https://rpc.example',
    },
    session: { sessionSlug: 'alpha', sessionWorkerUrl: 'https://session.example', surveysAddress, managedAccountSubmitAllowed: true },
    principal, account, questionRef: { sessionSlug: 'alpha', questionId: bytes32QuestionId },
    answer: { questionType: 'freeform', value: 'Approved answer' },
    fetchImpl: async (url, init) => {
      if (url !== 'https://rpc.example') return workerFetch(url, init);
      const { method, params } = JSON.parse(init.body);
      if (method === 'eth_sendRawTransaction') {
        [rawTransaction] = params;
        throw new TypeError('broadcast connection lost');
      }
      const rpcResults = { eth_chainId: '0xaa37dc', eth_getTransactionCount: '0x0', eth_gasPrice: '0x3b9aca00', eth_estimateGas: '0x186a0' };
      return Response.json({ jsonrpc: '2.0', id: 1, result: rpcResults[method] });
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.retryable, false);
  assert.equal(result.reconciliationRequired, true);
  assert.equal(result.txHash, ethers.utils.keccak256(rawTransaction));
  assert.equal(result.storageId, arweaveId(13));
  assert.equal(JSON.stringify(result).includes(rawTransaction), false);
  assert.equal(JSON.stringify(result).includes('root-a'), false);
});
