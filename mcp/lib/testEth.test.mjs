import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { createTestEthRequester } from './testEth.mjs';
import { createWorkerClient } from './workerClient.mjs';

const wallet = ethers.Wallet.createRandom();
const chainId = 11155420;
const hash = '0x' + 'a'.repeat(64);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const fixture = ({ status = 200, body = { txHash: hash, amountEth: '0.0002', chainId }, scope = true, rpcChain = chainId, paid = true, configuredChain = chainId, allowLocalWorkers = false } = {}) => {
  let balance = ethers.constants.Zero;
  let clock = 0;
  const calls = [];
  const client = createWorkerClient({
    workerOrigin: 'https://worker.example', slug: 'example', trustedOrigins: ['https://contextengine.sh'], wallet,
    fetchImpl: async (url, init) => {
      const path = new URL(url).pathname;
      if (path === '/session-config') return json({ config: {
        sessionId: '0x00112233445566778899aabbccddeeff', networkChainId: configuredChain,
        sessionModeProfile: { authority: { mode: 'worker_canonical' } },
        workerAuthority: { participantScopes: scope ? ['faucet'] : [] },
      } });
      if (path === '/resource-presence') return json({ resources: { txGas: true } });
      if (path === '/auth/nonce') return json({ nonce: 'abcdefgh1234' });
      if (path === '/auth/login') return json({ token: Buffer.from(JSON.stringify({ scopes: { faucet: scope } })).toString('base64url') + '.sig' });
      calls.push(JSON.parse(init.body));
      if (paid && status === 200) balance = ethers.utils.parseEther('0.0002');
      return json(body, status);
    },
  });
  const request = createTestEthRequester({
    config: { allowLocalWorkers }, wallet, now: () => clock, sleep: async (ms) => { clock += ms; },
    createProvider: () => ({ send: async () => rpcChain, getBalance: async () => balance }),
  });
  return { client, request: (args = {}) => request({ ctx: { client, info: { slug: 'example' } }, ...args }), calls };
};

test('discovers offers before sign-in, reports the token scope, and always funds its own address', async () => {
  const f = fixture();
  await f.client.loadConfig();
  assert.equal((await f.client.describeTestEth()).offered, true);
  assert.equal((await f.client.describeTestEth()).tokenHasFaucetScope, undefined);
  await f.client.login();
  assert.equal((await f.client.describeTestEth()).tokenHasFaucetScope, true);
  assert.deepEqual(await f.request({ to: ethers.Wallet.createRandom().address }), {
    sent: true, txHash: hash, amountEth: '0.0002', chainId, balanceEth: '0.0002',
  });
  assert.deepEqual(f.calls, [{ action: 'request_test_eth', to: wallet.address }]);
});

test('does not advertise or request an unavailable participant faucet', async () => {
  const f = fixture({ scope: false });
  await f.client.loadConfig();
  assert.equal((await f.client.describeTestEth()).offered, false);
  await assert.rejects(f.request(), /This session does not offer test ETH to you/);
  assert.equal(f.calls.length, 0);
});

test('maps a high balance to a plain result with the private threshold returned by the Worker', async () => {
  const f = fixture({ status: 403, body: { error: 'Balance above threshold (0.001 ETH).', balanceEth: '0.002', thresholdEth: '0.001', chainId } });
  assert.deepEqual(await f.request(), { sent: false, reason: 'balance_high', balanceEth: '0.002', thresholdEth: '0.001' });
});

test('explains daily caps, missing keys, scope refusals and chain outages', async () => {
  for (const [status, error, message] of [
    [429, 'Rate limited', /Today's test-ETH limit/],
    [401, 'Session secrets not configured.', /faucet is not set up/],
    [401, 'faucetPrivateKey is missing', /faucet is not set up/],
    [403, 'Missing faucet scope', /does not offer test ETH to you/],
    [502, 'RPC error', /could not reach the chain/],
  ]) await assert.rejects(fixture({ status, body: { error } }).request(), message);
});

test('refuses an RPC mismatch before requesting and a wrong-chain Worker response', async () => {
  const wrongRpc = fixture({ rpcChain: 1 });
  await assert.rejects(wrongRpc.request(), /reports chain 1/);
  assert.equal(wrongRpc.calls.length, 0);
  await assert.rejects(fixture({ body: { txHash: hash, amountEth: '0.0002', chainId: 1 } }).request(), /faucet.*chain 1/);
});

test('caps balance polling at sixty seconds and reports a pending transfer', async () => {
  const result = await fixture({ paid: false }).request();
  assert.equal(result.sent, true);
  assert.equal(result.pending, true);
  assert.equal(result.balanceEth, '0.0');
});

test('keeps the transaction reference if balance polling fails after the send', async () => {
  let reads = 0;
  const provider = {
    send: async () => chainId,
    getBalance: async () => {
      if (reads++) throw new Error('RPC unavailable after broadcast');
      return ethers.constants.Zero;
    },
  };
  const result = await fixture().request({ provider });
  assert.equal(result.sent, true);
  assert.equal(result.txHash, hash);
  assert.equal(result.pending, true);
});

test('cancelling post-send polling still returns the transaction reference', async () => {
  const controller = new AbortController();
  let reads = 0;
  const provider = {
    send: async () => chainId,
    getBalance: async () => {
      if (reads++) controller.abort();
      return ethers.constants.Zero;
    },
  };
  const result = await fixture({ paid: false }).request({ provider, signal: controller.signal });
  assert.equal(result.sent, true);
  assert.equal(result.txHash, hash);
  assert.equal(result.pending, true);
});

test('never requests mainnet funds and permits a local chain only with explicit development opt-in', async () => {
  for (const configuredChain of [1, 31337]) {
    const f = fixture({ configuredChain });
    await assert.rejects(f.request(), /only on OP Sepolia or Base Sepolia/);
    assert.equal(f.calls.length, 0);
  }
  const result = await fixture({ configuredChain: 31337, rpcChain: 31337, allowLocalWorkers: true, body: { txHash: hash, amountEth: '0.0002', chainId: 31337 } }).request();
  assert.equal(result.chainId, 31337);
});
