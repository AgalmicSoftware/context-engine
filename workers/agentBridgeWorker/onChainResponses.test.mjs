import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import {
  authenticateSessionWorker,
  base64urlToHex,
  directSubmitFeatureEnabled,
  requestManagedAccountFaucetOnJoin,
  resolveSurveysAddress,
  submitTelegramResponseOnChain,
} from './onChainResponses.mjs';
import { normalizeTelegramPrincipal } from './telegramUpdates.mjs';

const bytes32QuestionId = `0x${'12'.repeat(32)}`;
const surveysAddress = '0x1111111111111111111111111111111111111111';
const faucetTxHash = `0x${'34'.repeat(32)}`;

function arweaveId(byte = 7) {
  return Buffer.from(Uint8Array.from({ length: 32 }, () => byte)).toString('base64url');
}

async function makeAccount() {
  const principal = normalizeTelegramPrincipal({ telegramUserId: '42', username: 'participant' });
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
    if (String(url).endsWith('/arweave/upload')) {
      return new Response(JSON.stringify({ id: txId }), {
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
  assert.equal(result.privateKey, undefined);
  assert.equal(JSON.stringify(result).includes('root-a'), false);
  assert.equal(calls.length, 2);

  const nonceBody = JSON.parse(calls[0].init.body);
  const loginBody = JSON.parse(calls[1].init.body);
  assert.equal(calls[0].init.headers.Origin, 'http://localhost:7391');
  assert.equal(nonceBody.address, account.accountAddress);
  assert.equal(nonceBody.sessionSlug, 'alpha');
  assert.equal(loginBody.address, account.accountAddress);
  assert.match(loginBody.message, /^localhost:7391 wants you to sign in with your Ethereum account:/);
  assert.equal(loginBody.message.includes('root-a'), false);
  assert.match(loginBody.signature, /^0x[0-9a-f]+$/);
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
  const result = await submitTelegramResponseOnChain({
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
  assert.equal(submitted.address, surveysAddress);
  assert.equal(submitted.signer, account.accountAddress);
  assert.deepEqual(submitted.questionIds, [bytes32QuestionId]);
  assert.deepEqual(submitted.responseHashes, [base64urlToHex(txId)]);
  assert.equal(submitted.surveyId, `0x${'0'.repeat(64)}`);
  assert.equal(submitted.surveyResponseHash, `0x${'0'.repeat(64)}`);

  const uploadCall = calls.find((call) => call.url.endsWith('/arweave/upload'));
  const uploadBody = JSON.parse(uploadCall.init.body);
  const payload = JSON.parse(uploadBody.data);
  assert.equal(payload.source, 'telegram-agent-bridge');
  assert.equal(payload.responder, account.accountAddress);
  assert.equal(payload.answer.value, 7);
  assert.equal(JSON.stringify(payload).includes('root-a'), false);
});
