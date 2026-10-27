import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ethers } from 'ethers';
import { deriveManagedDemoAccount, deriveDemoPrivateKeyMaterial } from './agent/managedAccounts.mjs';
import { submitAgentResponseOnChain } from './agent/onChainResponses.mjs';
const rootRequire = createRequire(new URL('../../package.json', import.meta.url));
const ethers5 = rootRequire('ethers').ethers;
const sessionId = '0x11111111111111111111111111111111';
const principal = { principalId: 'cep_fixture', kind: 'user', adapter: 'http' };
const rootSecret = 'fixture-fresh-managed-secret';
const surveys = '0x1111111111111111111111111111111111111111';
const qid = `0x${'2'.repeat(64)}`;
const pointer = Buffer.alloc(32, 3).toString('base64url');

test('fresh session/principal derivation agrees across ethers boundaries and never exposes signer material', async () => {
  const account = await deriveManagedDemoAccount({ principal, deploymentId: sessionId, rootSecret });
  const key = await deriveDemoPrivateKeyMaterial({ principal, deploymentId: sessionId, rootSecret });
  assert.equal(account.accountAddress, ethers5.utils.computeAddress(key));
  assert.equal(account.accountAddress, ethers.computeAddress(key));
  assert.equal(account.rawKeyMaterialExportable, false);
  assert.ok(!JSON.stringify(account).includes(key));
  for (const change of [{ deploymentId: `0x${'2'.repeat(32)}` }, { principal: { ...principal, principalId: 'cep_other' } }, { rootSecret: 'other-root' }]) {
    const other = await deriveManagedDemoAccount({ principal, deploymentId: sessionId, rootSecret, ...change });
    assert.notEqual(other.accountAddress, account.accountAddress);
  }
  await assert.rejects(deriveManagedDemoAccount({ principal, deploymentId: 'old-deployment', rootSecret }));
  await assert.rejects(deriveManagedDemoAccount({ principal, deploymentId: sessionId, rootSecret: '' }));
});

async function fixture({ uncertain = false, chainId = 11155420 } = {}) {
  const account = await deriveManagedDemoAccount({ principal, deploymentId: sessionId, rootSecret });
  let rawTx; let uploads = 0; const calls = [];
  const env = { AGENT_MANAGED_ROOT_SECRET: rootSecret, DEFAULT_RPC_URL: 'https://rpc.example',
    AGENT_CONTEXT: { scopes: { storage: true, arweave: true }, sessionId, origin: 'https://session.example', address: account.accountAddress, config: { agentHttp: { managedAccountSubmitAllowed: true } } },
    AGENT_SERVICES: { current: async () => {}, storage: async () => { uploads++; return Response.json({ id: pointer, backend: 'arweave', storageRef: { backend: 'arweave', id: pointer } }); } } };
  const fetchImpl = async (_url, init) => {
    const payload = JSON.parse(init.body); calls.push(payload.method);
    if (payload.method === 'eth_sendRawTransaction') {
      rawTx = payload.params[0];
      if (uncertain) throw new Error('lost RPC response with private diagnostics');
      return Response.json({ result: ethers.keccak256(rawTx) });
    }
    return Response.json({ result: { eth_chainId: '0xaa37dc', eth_getTransactionCount: '0x2', eth_gasPrice: '0x3b9aca00', eth_estimateGas: '0x186a0' }[payload.method] });
  };
  const result = await submitAgentResponseOnChain({ env, principal, account,
    session: { sessionSlug: 'fixture', surveysAddress: surveys, chainId, managedAccountSubmitAllowed: true },
    questionRef: { sessionSlug: 'fixture', questionId: qid, questionType: 'binary', prompt: 'Fixture question?' },
    answer: { value: 'Agree' }, idempotencyKey: 'fixture-submit', fetchImpl });
  return { result, rawTx, uploads, calls, account };
}

test('v6 signing preserves v5 transaction decoding, gas buffer and typed ABI arguments', async () => {
  const { result, rawTx, account } = await fixture();
  assert.equal(result.ok, true, JSON.stringify(result));
  const decoded = ethers5.utils.parseTransaction(rawTx);
  assert.equal(decoded.from, account.accountAddress); assert.equal(decoded.chainId, 11155420);
  assert.equal(decoded.nonce, 2); assert.equal(decoded.gasLimit.toString(), '130000');
  const iface = new ethers5.utils.Interface(['function submitResponses(bytes32[],bytes32[],bytes32,bytes32)']);
  const args = iface.decodeFunctionData('submitResponses', decoded.data);
  assert.equal(args[0][0], qid); assert.equal(args[1][0], `0x${'03'.repeat(32)}`);
});
test('uncertain broadcasts preserve one public transaction hash and are never retried inline', async () => {
  const { result, rawTx, calls } = await fixture({ uncertain: true });
  assert.equal(result.reconciliationRequired, true); assert.equal(result.safeToRetry, false);
  assert.equal(result.txHash, ethers.keccak256(rawTx)); assert.equal(calls.filter(value => value === 'eth_sendRawTransaction').length, 1);
  assert.ok(!JSON.stringify(result).includes('private diagnostics')); assert.ok(!JSON.stringify(result).includes(rawTx));
});
test('managed submissions reject mainnet before uploads or RPC calls', async () => {
  const { result, uploads, calls } = await fixture({ chainId: 1 });
  assert.equal(result.reason, 'agent_testnet_required'); assert.equal(uploads, 0); assert.equal(calls.length, 0);
});
