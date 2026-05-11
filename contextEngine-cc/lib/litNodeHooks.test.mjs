import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __test__litNodeHooks,
  buildSbtAccessControlConditions,
  createNodeLitHooks,
} from './litNodeHooks.mjs';
import {
  buildLitChipotlePolicy,
  fingerprintLitChipotlePolicy,
} from '../../client/src/utilities/crypto/litChipotlePolicy.js';

const GATE_ADDRESS = '0x29563ff3aCC8AFb220D810F8022218095e25C1f6';
const GATE_ADDRESS_B = '0x1111111111111111111111111111111111111111';
const TEST_ACTION_CID = 'QmAction123';
const TEST_PKP_ID = '0xpkp123';

const makePolicy = (overrides = {}) => buildLitChipotlePolicy({
  chainId: 84532,
  gateMode: 'all',
  sbtAddresses: [GATE_ADDRESS, GATE_ADDRESS_B],
  litActionCid: TEST_ACTION_CID,
  litPkpId: TEST_PKP_ID,
  ...overrides,
});

test('createNodeLitHooks fails closed when worker-mediated Chipotle config is missing', async () => {
  await assert.rejects(
    () => createNodeLitHooks({
      privateKey: `0x${'11'.repeat(32)}`,
      chainId: 84532,
    }),
    /no longer supports direct browser-Lit SDK encryption/,
  );
});

test('createNodeLitHooks wraps keys through the session worker Chipotle endpoint', async () => {
  const calls = [];
  const policy = makePolicy();
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        response: {
          response: {
            ok: true,
            ciphertext: 'wrapped-cek',
            policy,
            policyFingerprint: fingerprintLitChipotlePolicy(policy),
          },
        },
      }),
    };
  };

  const hooks = await createNodeLitHooks({
    workerUrl: 'https://worker.example.test/',
    token: 'worker-token',
    sessionSlug: 'session-a',
    chainId: 84532,
    connectTimeout: 0,
    fetchImpl,
  });
  const accessControlConditions = buildSbtAccessControlConditions({
    sbtAddresses: [GATE_ADDRESS, GATE_ADDRESS_B],
    chainId: 84532,
    mode: 'all',
  });

  const result = await hooks.saveKey(new Uint8Array(32).fill(7), {
    accessControlConditions,
    chainId: 84532,
    rpcUrl: 'https://base-sepolia.example.test',
  });

  assert.equal(result.ciphertext, 'wrapped-cek');
  assert.equal(
    result.dataToEncryptHash,
    `chipotle-v3:${TEST_ACTION_CID}:84532:all:${policy.sbtAddresses.join(',')}:${fingerprintLitChipotlePolicy(policy)}`,
  );
  assert.deepEqual(result.chipotle, {
    version: 2,
    litActionCid: TEST_ACTION_CID,
    litPkpId: TEST_PKP_ID,
    sbtAddresses: policy.sbtAddresses,
    gateMode: 'all',
    chainId: 84532,
    policyFingerprint: fingerprintLitChipotlePolicy(policy),
    policy,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://worker.example.test/lit/chipotle-action');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer worker-token');
  assert.equal(calls[0][1].headers['X-Session-Slug'], 'session-a');

  const body = JSON.parse(calls[0][1].body);
  assert.equal(body.action, 'lit_chipotle_execute');
  assert.equal(body.op, 'encrypt');
  assert.equal(body.gateMode, 'all');
  assert.equal(body.chainId, 84532);
  assert.deepEqual(body.sbtAddresses, [GATE_ADDRESS, GATE_ADDRESS_B]);
  assert.match(body.actionCode, /async function main/);
  assert.equal(body.message, `0x${'07'.repeat(32)}`);
  assert.equal(body.rpcUrl, undefined);
});

test('createNodeLitHooks surfaces worker-mediated SBT gate denials', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      response: {
        ok: false,
        allowed: false,
        reason: 'Requester does not satisfy the SBT gate.',
      },
    }),
  });
  const hooks = await createNodeLitHooks({
    workerUrl: 'https://worker.example.test',
    token: 'worker-token',
    sessionSlug: 'session-a',
    chainId: 84532,
    connectTimeout: 0,
    fetchImpl,
  });

  await assert.rejects(
    () => hooks.saveKey(new Uint8Array(32).fill(1), {
      accessControlConditions: buildSbtAccessControlConditions({
        sbtAddresses: [GATE_ADDRESS],
        chainId: 84532,
      }),
      chainId: 84532,
      rpcUrl: 'https://base-sepolia.example.test',
    }),
    /Requester does not satisfy the SBT gate/,
  );
});

test('resolveGateFromOptions extracts SBT gate details from CE access conditions', () => {
  const accessControlConditions = buildSbtAccessControlConditions({
    sbtAddresses: [GATE_ADDRESS, GATE_ADDRESS_B],
    chainId: 84532,
    mode: 'all',
  });

  assert.deepEqual(__test__litNodeHooks.resolveGateFromOptions({
    accessControlConditions,
    rpcUrl: 'https://base-sepolia.example.test',
  }), {
    sbtAddresses: [GATE_ADDRESS, GATE_ADDRESS_B],
    gateChainId: 84532,
    gateMode: 'all',
  });
});
