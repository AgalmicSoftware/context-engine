import { buildWorkerAuthorizedLitAction } from '../../shared/litChipotleAction.mjs';
import { authorizeLitRequest, litAuthorizationMessage, openLitReply } from './litWorkerAuthorization.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { createRequire } from 'node:module';
const ethersV5 = createRequire(new URL('../../package.json', import.meta.url))('ethers').ethers;

import {
  bootstrapLitChipotleSession,
  executeLitChipotleAction,
  executeSessionLitChipotleAction,
  fetchChipotleJson,
  isLitChipotleLocalApiBaseAllowed,
  normalizeLitChipotleApiBase,
  provisionLitChipotleAction,
  readLitChipotleStatus,
  resolveLitChipotleProvisioningRuntime,
  resolveLitChipotleRuntime,
} from './chipotleClient.js';
import {
  buildLitChipotlePolicy,
  buildLitChipotleWrappedPlaintext,
  fingerprintLitChipotlePolicy,
} from './litChipotlePolicyCore.mjs';

const ethersUtils = ethers?.utils || ethers;
const TEST_ACTION_CID = 'QmAction123';
const TEST_PKP_ID = '0xpkp123';
const TEST_GATE_ADDRESS = '0x29563ff3aCC8AFb220D810F8022218095e25C1f6';
const TEST_REQUESTER = '0x00000000000000000000000000000000000000aa';

const TEST_WALLET = ethers.Wallet.createRandom();
const AUTH_CONFIG = { litAuthorizationVersion: 'worker-signed-v1', litAuthorizationSigner: TEST_WALLET.address };
const AUTH_SECRETS = { litAuthorizationPrivateKey: TEST_WALLET.privateKey };
const DEFAULT_CHIPOTLE_ACTION_CODE = buildWorkerAuthorizedLitAction({ signer: TEST_WALLET.address, pkpId: TEST_PKP_ID, sessionSlug: '' });

const makePolicy = (overrides = {}) => buildLitChipotlePolicy({
  chainId: 11155420,
  gateMode: 'any',
  sbtAddresses: [TEST_GATE_ADDRESS],
  litActionCid: TEST_ACTION_CID,
  litPkpId: TEST_PKP_ID,
  ...overrides,
});

const makeWrappedPlaintext = (policy = makePolicy(), cekHex = `0x${'11'.repeat(32)}`) => (
  JSON.stringify(buildLitChipotleWrappedPlaintext({ cekHex, policy }))
);

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

const validateExistingActionOnly = ({ pkpId = TEST_PKP_ID, sessionSlug = '', cid = TEST_ACTION_CID } = {}) => async (url, options) => {
  assert.ok(url.endsWith('/get_lit_action_ipfs_id'), 'An already provisioned authority must not mutate remote resources');
  assert.equal(JSON.parse(options.body), buildWorkerAuthorizedLitAction({ signer: TEST_WALLET.address, sessionSlug, pkpId }));
  return jsonResponse(cid);
};

const mockBalance = (value = 0) => ({
  isZero: () => BigInt(value || 0) === 0n,
  toString: () => String(value || 0),
});

const createDefaultActionHarness = ({
  chainId = 11155420,
  balances = {},
  decryptPlaintext = '',
} = {}) => {
  const calls = {
    providers: [],
    encryptedMessages: [],
    decryptCiphertexts: [],
  };
  const mockEthers = {
    utils: ethersV5.utils,
    providers: {
      JsonRpcProvider: class JsonRpcProvider {
        constructor(rpcUrl) {
          this.rpcUrl = rpcUrl;
          calls.providers.push(rpcUrl);
        }

        async getNetwork() {
          return { chainId };
        }
      },
    },
    Contract: class Contract {
      constructor(address) {
        this.address = ethersUtils.getAddress(address).toLowerCase();
      }

      async balanceOf() {
        return mockBalance(balances[this.address] || 0);
      }
    },
  };
  const Lit = {
    Actions: {
      Encrypt: async ({ message }) => {
        calls.encryptedMessages.push(message);
        return 'wrapped-cek';
      },
      Decrypt: async ({ ciphertext }) => {
        calls.decryptCiphertexts.push(ciphertext);
        return decryptPlaintext;
      },
    },
  };
  const main = new Function(
    'ethers',
    'Lit',
    `${DEFAULT_CHIPOTLE_ACTION_CODE}; return main;`
  )(mockEthers, Lit);
  return { main, calls };
};

const makeActionParams = async ({
  op,
  policy = makePolicy(),
  rpcUrl = 'https://op-sepolia.example.test',
  message,
  ciphertext,
  signed = true,
} = {}) => {
const params = {
  op,
  pkpId: policy.litPkpId,
  litActionCid: policy.litActionCid,
  requesterAddress: TEST_REQUESTER,
  sbtAddresses: policy.sbtAddresses,
  gateMode: policy.gateMode,
  expectedChainId: policy.chainId,
  expectedPolicyFingerprint: fingerprintLitChipotlePolicy(policy),
  policy,
  ...(rpcUrl ? { rpcUrl } : {}),
  ...(message ? { message } : {}),
  ...(ciphertext ? { ciphertext } : {}),
};
if (signed) await authorizeLitRequest({ wallet: TEST_WALLET, jsParams: params, sessionSlug: '' });
return params;
};

test('normalizeLitChipotleApiBase trims trailing slashes and core prefix', () => {
  assert.equal(
    normalizeLitChipotleApiBase(' https://api.chipotle.litprotocol.com/core/v1/ '),
    'https://api.chipotle.litprotocol.com'
  );
});

test('normalizeLitChipotleApiBase rejects unsafe API bases', () => {
  const rejectedBases = [
    'https://attacker.example',
    'http://api.chipotle.litprotocol.com',
    'https://api.chipotle.litprotocol.com.evil.example',
    'https://127.0.0.1:8787',
    'https://10.0.0.5',
    'https://169.254.169.254',
    'https://[fd00::1]',
    'https://api.chipotle.litprotocol.com:8443',
    'https://api.chipotle.litprotocol.com/other',
    'https://api.chipotle.litprotocol.com/core/v1/extra',
    'https://api.chipotle.litprotocol.com/core/v1?debug=1',
    'not a url',
  ];

  for (const apiBase of rejectedBases) {
    assert.throws(
      () => normalizeLitChipotleApiBase(apiBase),
      /Lit Chipotle API base URL/,
      apiBase,
    );
  }
});

test('normalizeLitChipotleApiBase rejects embedded URL credentials', () => {
  const credentialedApiBase = new URL('https://api.chipotle.litprotocol.com');
  credentialedApiBase.username = 'user';
  credentialedApiBase.password = 'pass';

  assert.throws(
    () => normalizeLitChipotleApiBase(credentialedApiBase.toString()),
    (error) => {
      assert.equal(error.message, 'Lit Chipotle API base URL must not include credentials.');
      return true;
    },
  );
});

test('normalizeLitChipotleApiBase allows only explicit localhost test bases', () => {
  assert.equal(
    normalizeLitChipotleApiBase('http://localhost:8787/core/v1/', { allowLocalApiBase: true }),
    'http://localhost:8787',
  );
  assert.equal(
    normalizeLitChipotleApiBase('http://127.0.0.2:8787', { allowLocalApiBase: true }),
    'http://127.0.0.2:8787',
  );
  assert.throws(
    () => normalizeLitChipotleApiBase('http://192.168.1.5:8787', { allowLocalApiBase: true }),
    /Lit Chipotle API base URL/,
  );
  assert.equal(
    isLitChipotleLocalApiBaseAllowed({ LIT_CHIPOTLE_ALLOW_LOCAL_API_BASE: 'true' }),
    true,
  );
});

test('fetchChipotleJson validates the final URL before credentials are attached', async () => {
  let fetchCalled = false;

  await assert.rejects(
    fetchChipotleJson({
      apiBase: 'https://attacker.example',
      apiKey: 'lit-secret',
      path: '/billing/balance',
      body: { leak: true },
      fetchImpl: async () => {
        fetchCalled = true;
        return jsonResponse({ ok: true });
      },
    }),
    /host is not approved/,
  );

  assert.equal(fetchCalled, false);
});

test('fetchChipotleJson builds approved Chipotle URLs and rejects path escapes', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    return jsonResponse({ ok: true });
  };

  const result = await fetchChipotleJson({
    apiBase: ' https://api.chipotle.litprotocol.com/core/v1/ ',
    apiKey: 'lit-secret',
    path: '/billing/balance',
    fetchImpl,
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0][0], 'https://api.chipotle.litprotocol.com/core/v1/billing/balance');
  assert.equal(calls[0][1].headers['X-Api-Key'], 'lit-secret');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer lit-secret');
  assert.equal(calls[0][1].redirect, 'manual');

  await assert.rejects(
    fetchChipotleJson({
      apiBase: 'https://api.chipotle.litprotocol.com',
      apiKey: 'lit-secret',
      path: '../new_account',
      fetchImpl,
    }),
    /request path/,
  );
  assert.equal(calls.length, 1);
});

test('default Chipotle action lets a non-holder encrypt for an SBT gate', async () => {
  const policy = makePolicy();
  const plaintext = makeWrappedPlaintext(policy, `0x${'44'.repeat(32)}`);
  const { main, calls } = createDefaultActionHarness({
    balances: {
      [TEST_GATE_ADDRESS.toLowerCase()]: 0,
    },
  });

  const result = await main(await makeActionParams({
    op: 'encrypt',
    policy,
    rpcUrl: '',
    message: plaintext,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.ciphertext, 'wrapped-cek');
  assert.deepEqual(calls.providers, []);
  assert.deepEqual(calls.encryptedMessages, [plaintext]);
});

test('default Chipotle action still enforces the SBT gate for decrypt', async () => {
  const policy = makePolicy();
  const { main, calls } = createDefaultActionHarness({
    balances: {
      [TEST_GATE_ADDRESS.toLowerCase()]: 0,
    },
    decryptPlaintext: makeWrappedPlaintext(policy),
  });

  const result = await main(await makeActionParams({
    op: 'decrypt',
    policy,
    ciphertext: 'wrapped-cek',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(calls.decryptCiphertexts.length, 0);
});

test('default Chipotle action denies decrypt when the embedded policy is tampered', async () => {
  const gateA = makePolicy({
    sbtAddresses: [TEST_GATE_ADDRESS],
  });
  const gateB = makePolicy({
    sbtAddresses: ['0x1111111111111111111111111111111111111111'],
  });
  const { main } = createDefaultActionHarness({
    balances: {
      [gateB.sbtAddresses[0]]: 1,
    },
    decryptPlaintext: makeWrappedPlaintext(gateA),
  });

  await assert.rejects(
    async () => main(await makeActionParams({
      op: 'decrypt',
      policy: gateB,
      ciphertext: 'wrapped-cek',
    })),
    /policy mismatch/i,
  );
});

test('default Chipotle action rejects RPC endpoints that report the wrong chain ID', async () => {
  const policy = makePolicy({ chainId: 11155420 });
  const { main } = createDefaultActionHarness({
    chainId: 84532,
    balances: {
      [TEST_GATE_ADDRESS.toLowerCase()]: 1,
    },
    decryptPlaintext: makeWrappedPlaintext(policy),
  });

  await assert.rejects(
    async () => main(await makeActionParams({
      op: 'decrypt',
      policy,
      ciphertext: 'wrapped-cek',
    })),
    /RPC chain ID mismatch/i,
  );
});

test('default Chipotle action rejects legacy bare-hex wrapped keys', async () => {
  const policy = makePolicy();
  const { main } = createDefaultActionHarness({
    balances: {
      [TEST_GATE_ADDRESS.toLowerCase()]: 1,
    },
    decryptPlaintext: `0x${'55'.repeat(32)}`,
  });

  await assert.rejects(
    async () => main(await makeActionParams({
      op: 'decrypt',
      policy,
      ciphertext: 'wrapped-cek',
    })),
    /legacy wrapped keys are not supported/i,
  );
});

test('fetchChipotleJson rejects redirects without forwarding credentials or reading the redirect body', async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    let calls = 0;
    await assert.rejects(fetchChipotleJson({
      apiKey: 'fixture-lit-secret', path: '/billing/balance',
      fetchImpl: async (_url, init) => {
        calls += 1;
        assert.equal(init.redirect, 'manual');
        return { status, ok: false, text: async () => { throw new Error('Redirect body must not be read.'); } };
      },
    }), /Chipotle redirects are not allowed/);
    assert.equal(calls, 1);
  }
});

test('resolveLitChipotleRuntime prefers request, then session secret, then worker env for the API key', () => {
  assert.deepEqual(resolveLitChipotleRuntime({
    env: {
      LIT_ACCOUNT_API_KEY: 'env-key',
      LIT_API_BASE: 'https://api.dev.litprotocol.com',
    },
    config: {
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: 'group_123',
        litPkpId: 'pkp_123',
        litActionCid: 'bafy123',
      },
    },
    secrets: {
      litUsageApiKey: 'session-key',
    },
    body: {
      litUsageApiKey: 'request-key',
      litApiBase: 'https://api.chipotle.litprotocol.com/core/v1',
    },
  }), {
    litApiBase: 'https://api.chipotle.litprotocol.com',
    allowLocalApiBase: false,
    litUsageApiKey: 'request-key',
    apiKeySource: 'request',
    authorizationReady: false,
    litGroupId: 'group_123',
    litPkpId: 'pkp_123',
    litActionCid: 'bafy123',
    customRpcUrl: '',
    customRpcKey: '',
  });
});

test('readLitChipotleStatus reads balance plus group memberships from the configured runtime', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    if (String(url).endsWith('/core/v1/billing/balance')) {
      return jsonResponse({
        balance_cents: -500,
        balance_display: '$5.00 credit',
      });
    }
    if (String(url).endsWith('/core/v1/get_lit_action_client_config')) {
      return jsonResponse({
        timeout_ms: 30000,
        async_timeout_ms: 30000,
        memory_limit_mb: 256,
        max_code_length: 10000,
        max_response_length: 10000,
        max_console_log_length: 10000,
        max_fetch_count: 10,
        max_get_keys_count: 10,
        max_retries: 2,
        client_timeout_ms_buffer: 500,
      });
    }
    if (String(url).includes('/core/v1/list_wallets_in_group')) {
      return jsonResponse([
        { id: 'pkp_123', name: 'wallet', description: 'desc', wallet_address: '0xabc' },
      ]);
    }
    if (String(url).includes('/core/v1/list_actions')) {
      return jsonResponse([
        {
          id: ethersUtils.keccak256(ethersUtils.toUtf8Bytes('bafy123')),
          name: 'action',
          description: 'desc',
        },
      ]);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const status = await readLitChipotleStatus({
    runtime: {
      authorizationReady: true,
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litUsageApiKey: 'lit-secret',
      apiKeySource: 'session-secret',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
    },
    fetchImpl,
  });

  assert.equal(status.ready, true);
  assert.deepEqual(status.balance, {
    balance_cents: -500,
    balance_display: '$5.00 credit',
  });
  assert.deepEqual(status.groupSummary, {
    walletCount: 1,
    actionCount: 1,
    hasConfiguredPkp: true,
    hasConfiguredAction: true,
  });
  assert.equal(calls[0][1].headers['X-Api-Key'], 'lit-secret');
});

test('readLitChipotleStatus tolerates status endpoints that a scoped key cannot read', async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/core/v1/billing/balance')) {
      return jsonResponse({ error: 'forbidden' }, { ok: false, status: 403 });
    }
    if (String(url).endsWith('/core/v1/get_lit_action_client_config')) {
      return jsonResponse({ timeout_ms: 30000 });
    }
    if (String(url).includes('/core/v1/list_wallets_in_group')) {
      return jsonResponse({ error: 'missing scope' }, { ok: false, status: 403 });
    }
    if (String(url).includes('/core/v1/list_actions')) {
      return jsonResponse({ error: 'missing scope' }, { ok: false, status: 403 });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const status = await readLitChipotleStatus({
    runtime: {
      authorizationReady: true,
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litUsageApiKey: 'lit-secret',
      apiKeySource: 'session-secret',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
    },
    fetchImpl,
  });

  assert.equal(status.ok, true);
  assert.equal(status.ready, true);
  assert.equal(status.balance, null);
  assert.equal(status.clientConfig.timeout_ms, 30000);
  assert.deepEqual(status.groupSummary, {
    walletCount: null,
    actionCount: null,
    hasConfiguredPkp: null,
    hasConfiguredAction: null,
  });
  assert.deepEqual(status.warnings.map((entry) => entry.step), [
    'billing.balance',
    'group.wallets',
    'group.actions',
  ]);
});

test('executeLitChipotleAction posts the configured Lit Action CID and js params', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    return jsonResponse({
      has_error: false,
      logs: '',
      response: { ok: true },
    });
  };

  const result = await executeLitChipotleAction({
    runtime: {
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litUsageApiKey: 'lit-secret',
      apiKeySource: 'worker-env',
      litActionCid: 'bafy123',
    },
    request: {
      jsParams: { hello: 'world' },
    },
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.request, undefined);
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    ipfs_id: 'bafy123',
    js_params: { hello: 'world' },
  });
  assert.equal(calls[0][0], 'https://api.chipotle.litprotocol.com/core/v1/lit_action');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer lit-secret');
});

test('executeLitChipotleAction explains Chipotle action 404s as provisioning issues', async () => {
  const fetchImpl = async () => jsonResponse({ message: 'Not found.' }, { ok: false, status: 404 });

  await assert.rejects(
    () => executeLitChipotleAction({
      runtime: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litUsageApiKey: 'lit-secret',
        apiKeySource: 'worker-env',
        litActionCid: 'bafy123',
      },
      request: {
        jsParams: { hello: 'world' },
      },
      fetchImpl,
    }),
    /not found or is not permitted.*re-run Lit Chipotle provisioning/i,
  );
});

test('executeSessionLitChipotleAction validates source code and executes the configured action CID with session params', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    if (String(url).endsWith('/core/v1/get_lit_action_ipfs_id')) {
      return jsonResponse('QmAction123');
    }
    if (String(url).endsWith('/core/v1/lit_action')) {
      return jsonResponse({
        has_error: false,
        logs: '',
        response: {
          ok: true,
          ciphertext: 'wrapped-cek',
        },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await executeSessionLitChipotleAction({
    config: {
      litCredentials: { ...AUTH_CONFIG,
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: TEST_ACTION_CID,
        litPkpId: TEST_PKP_ID,
      },
    },
    secrets: { ...AUTH_SECRETS,
      litUsageApiKey: 'usage-key',
    },
    request: {
      actionCode: 'async function main() { return { ok: true }; }',
      op: 'encrypt',
      sbtAddresses: [TEST_GATE_ADDRESS],
      gateMode: 'all',
      chainId: 11155420,
      message: `0x${'12'.repeat(32)}`,
    },
    requesterAddress: TEST_REQUESTER,
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(calls[1][0], 'https://api.chipotle.litprotocol.com/core/v1/lit_action');
  const body = JSON.parse(calls[1][1].body);
  const expectedPolicy = makePolicy({
    gateMode: 'all',
    sbtAddresses: [TEST_GATE_ADDRESS],
  });
  assert.equal(body.ipfs_id, TEST_ACTION_CID);
  assert.equal(body.js_params.op, 'encrypt');
  assert.equal(body.js_params.pkpId, TEST_PKP_ID);
  assert.equal(body.js_params.requesterAddress, TEST_REQUESTER);
  assert.deepEqual(body.js_params.sbtAddresses, [TEST_GATE_ADDRESS.toLowerCase()]);
  assert.equal(body.js_params.gateMode, 'all');
  assert.equal(body.js_params.expectedChainId, 11155420);
  assert.equal(body.js_params.rpcUrl, undefined);
  assert.deepEqual(body.js_params.policy, expectedPolicy);
  assert.equal(body.js_params.expectedPolicyFingerprint, fingerprintLitChipotlePolicy(expectedPolicy));
  assert.deepEqual(JSON.parse(body.js_params.message), buildLitChipotleWrappedPlaintext({
    cekHex: `0x${'12'.repeat(32)}`,
    policy: expectedPolicy,
  }));
});

test('executeSessionLitChipotleAction rejects malformed explicit gate chains instead of falling through', async () => {
  for (const chainId of ['3.1337e4', '11155420.0', false]) {
    let actionCalls = 0;
    const fetchImpl = async (url) => {
      if (String(url).endsWith('/core/v1/get_lit_action_ipfs_id')) {
        return jsonResponse(TEST_ACTION_CID);
      }
      actionCalls += 1;
      return jsonResponse({ has_error: false, response: { ok: true } });
    };

    await assert.rejects(
      () => executeSessionLitChipotleAction({
        config: {
          networkChainId: 11155420,
          litCredentials: { ...AUTH_CONFIG,
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litActionCid: TEST_ACTION_CID,
            litPkpId: TEST_PKP_ID,
          },
        },
        secrets: { ...AUTH_SECRETS, litUsageApiKey: 'usage-key' },
        request: {
          actionCode: 'async function main() { return { ok: true }; }',
          op: 'encrypt',
          sbtAddresses: [TEST_GATE_ADDRESS],
          chainId,
          message: `0x${'12'.repeat(32)}`,
        },
        requesterAddress: TEST_REQUESTER,
        fetchImpl,
      }),
      /requires a gate chain ID/i,
      String(chainId),
    );
    assert.equal(actionCalls, 0, String(chainId));
  }
});

test('executeSessionLitChipotleAction submits verified source code when configured action CID is not cached yet', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    if (String(url).endsWith('/core/v1/get_lit_action_ipfs_id')) {
      return jsonResponse(TEST_ACTION_CID);
    }
    if (String(url).endsWith('/core/v1/lit_action')) {
      const body = JSON.parse(options.body || '{}');
      if (body.ipfs_id) {
        return jsonResponse({
          error: `No cached code found. Submit the action code at least once before referencing it by IPFS ID.: cache miss for IPFS ID ${TEST_ACTION_CID}`,
        }, { ok: false, status: 502 });
      }
      return jsonResponse({
        has_error: false,
        logs: '',
        response: {
          ok: true,
          ciphertext: 'wrapped-cek',
        },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const actionCode = 'async function main() { return { ok: true }; }';
  const result = await executeSessionLitChipotleAction({
    config: {
      litCredentials: { ...AUTH_CONFIG,
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: TEST_ACTION_CID,
        litPkpId: TEST_PKP_ID,
      },
    },
    secrets: { ...AUTH_SECRETS,
      litUsageApiKey: 'usage-key',
    },
    request: {
      actionCode,
      op: 'encrypt',
      sbtAddresses: [TEST_GATE_ADDRESS],
      chainId: 11155420,
      message: `0x${'12'.repeat(32)}`,
    },
    requesterAddress: TEST_REQUESTER,
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 3);
  const cidBody = JSON.parse(calls[1][1].body);
  assert.equal(cidBody.ipfs_id, TEST_ACTION_CID);
  assert.equal(cidBody.code, undefined);
  const inlineBody = JSON.parse(calls[2][1].body);
  assert.equal(inlineBody.ipfs_id, undefined);
  assert.equal(inlineBody.code, DEFAULT_CHIPOTLE_ACTION_CODE);
  assert.equal(inlineBody.js_params.op, 'encrypt');
});

test('executeSessionLitChipotleAction falls back to worker env Lit API keys for execution', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    if (String(url).endsWith('/core/v1/get_lit_action_ipfs_id')) {
      return jsonResponse(TEST_ACTION_CID);
    }
    if (String(url).endsWith('/core/v1/lit_action')) {
      return jsonResponse({
        has_error: false,
        logs: '',
        response: {
          ok: true,
          ciphertext: 'wrapped-cek',
          policy: makePolicy(),
          policyFingerprint: fingerprintLitChipotlePolicy(makePolicy()),
        },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await executeSessionLitChipotleAction({
    env: {
      LIT_USAGE_API_KEY: 'env-usage-key',
    },
    config: {
      litCredentials: { ...AUTH_CONFIG,
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: TEST_ACTION_CID,
        litPkpId: TEST_PKP_ID,
      },
    },
    secrets: { ...AUTH_SECRETS,},
    request: {
      actionCode: 'async function main() { return { ok: true }; }',
      op: 'encrypt',
      sbtAddresses: [TEST_GATE_ADDRESS],
      chainId: 11155420,
      message: `0x${'34'.repeat(32)}`,
    },
    requesterAddress: TEST_REQUESTER,
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(calls[1][1].headers.Authorization, 'Bearer env-usage-key');
});

test('executeSessionLitChipotleAction rejects unapproved request RPC URLs for decrypt', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/core/v1/get_lit_action_ipfs_id')) {
      return jsonResponse(TEST_ACTION_CID);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  await assert.rejects(
    () => executeSessionLitChipotleAction({
      config: {
        litCredentials: { ...AUTH_CONFIG,
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: TEST_ACTION_CID,
          litPkpId: TEST_PKP_ID,
        },
      },
      secrets: { ...AUTH_SECRETS,
        litUsageApiKey: 'usage-key',
      },
      request: {
        actionCode: 'async function main() { return { ok: true }; }',
        op: 'decrypt',
        sbtAddresses: [TEST_GATE_ADDRESS],
        chainId: 11155420,
        rpcUrl: 'https://attacker-rpc.example.test',
        ciphertext: 'wrapped-cek',
        chipotle: { version: 2 },
      },
      requesterAddress: TEST_REQUESTER,
      fetchImpl,
    }),
    /request RPC URL is not approved/i,
  );
  assert.equal(calls.length, 1);
});

test('Worker RPC authorization preserves path and query case while normalizing the hostname', async () => {
  const executed = [];
  const base = {
    config: { litCredentials: { ...AUTH_CONFIG, litActionCid: TEST_ACTION_CID, litPkpId: TEST_PKP_ID } },
    secrets: { ...AUTH_SECRETS, litUsageApiKey: 'usage-key', customRpcUrl: 'https://rpc.example.test/rpc/TenantA?key=CaseSensitive' },
    requesterAddress: TEST_REQUESTER,
    fetchImpl: async (url, options) => {
      if (url.endsWith('/get_lit_action_ipfs_id')) return jsonResponse(TEST_ACTION_CID);
      executed.push(JSON.parse(options.body).js_params.rpcUrl);
      return jsonResponse({ has_error: false, response: { ok: true, allowed: true } });
    },
  };
  const request = { op: 'check', sbtAddresses: [TEST_GATE_ADDRESS], chainId: 11155420 };
  for (const rpcUrl of ['https://rpc.example.test/rpc/tenanta?key=CaseSensitive', 'https://rpc.example.test/rpc/TenantA?key=casesensitive']) {
    await assert.rejects(executeSessionLitChipotleAction({ ...base, request: { ...request, rpcUrl } }), /request RPC URL is not approved/);
  }
  assert.deepEqual(executed, []);
  await executeSessionLitChipotleAction({ ...base, request: { ...request, rpcUrl: 'https://RPC.EXAMPLE.TEST/rpc/TenantA?key=CaseSensitive' } });
  assert.deepEqual(executed, [base.secrets.customRpcUrl]);
  // Two explicitly approved endpoints can differ only by a case-sensitive path.
  await executeSessionLitChipotleAction({
    ...base,
    config: { ...base.config, rpcUrlsByChainId: { 11155420: ['https://rpc.example.test/rpc/tenanta?key=CaseSensitive'] } },
    request: { ...request, rpcUrl: 'https://rpc.example.test/rpc/tenanta?key=CaseSensitive' },
  });
  assert.equal(executed[1], 'https://rpc.example.test/rpc/tenanta?key=CaseSensitive');
});

test('executeSessionLitChipotleAction rejects legacy v1 Chipotle wrapped-key metadata', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/core/v1/get_lit_action_ipfs_id')) {
      return jsonResponse(TEST_ACTION_CID);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  await assert.rejects(
    () => executeSessionLitChipotleAction({
      config: {
        litCredentials: { ...AUTH_CONFIG,
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: TEST_ACTION_CID,
          litPkpId: TEST_PKP_ID,
        },
      },
      secrets: { ...AUTH_SECRETS,
        litUsageApiKey: 'usage-key',
      },
      request: {
        actionCode: 'async function main() { return { ok: true }; }',
        op: 'decrypt',
        sbtAddresses: [TEST_GATE_ADDRESS],
        chainId: 11155420,
        ciphertext: 'wrapped-cek',
        chipotle: { version: 1 },
      },
      requesterAddress: TEST_REQUESTER,
      fetchImpl,
    }),
    /legacy wrapped keys are not supported/i,
  );
  assert.equal(calls.length, 1);
});

test('executeSessionLitChipotleAction rejects action code that does not match the configured CID', async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/core/v1/get_lit_action_ipfs_id')) {
      return jsonResponse('QmDifferentAction');
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  await assert.rejects(
    () => executeSessionLitChipotleAction({
      config: {
        litCredentials: { ...AUTH_CONFIG,
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: 'QmAction123',
          litPkpId: '0xpkp123',
        },
      },
      secrets: { ...AUTH_SECRETS,
        litUsageApiKey: 'usage-key',
      },
      request: {
        actionCode: 'async function main() { return { ok: true }; }',
        op: 'check',
        sbtAddresses: ['0x29563ff3aCC8AFb220D810F8022218095e25C1f6'],
        rpcUrl: 'https://sepolia.optimism.io',
      },
      requesterAddress: '0x00000000000000000000000000000000000000aa',
      fetchImpl,
    }),
    /does not match the configured Lit Action CID/i,
  );
});

test('executeSessionLitChipotleAction falls back to a default public RPC for the gate chain when no custom RPC is provided', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    if (String(url).endsWith('/core/v1/get_lit_action_ipfs_id')) {
      return jsonResponse('QmAction123');
    }
    if (String(url).endsWith('/core/v1/lit_action')) {
      return jsonResponse({
        has_error: false,
        logs: '',
        response: {
          ok: true,
          allowed: true,
        },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await executeSessionLitChipotleAction({
    config: {
      litCredentials: { ...AUTH_CONFIG,
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: 'QmAction123',
        litPkpId: '0xpkp123',
      },
    },
    secrets: { ...AUTH_SECRETS,
      litUsageApiKey: 'usage-key',
    },
    request: {
      actionCode: 'async function main() { return { ok: true }; }',
      op: 'check',
      sbtAddresses: ['0x29563ff3aCC8AFb220D810F8022218095e25C1f6'],
      chainId: 11155420,
    },
    requesterAddress: '0x00000000000000000000000000000000000000aa',
    fetchImpl,
  });

  assert.equal(result.ok, true);
  const body = JSON.parse(calls[1][1].body);
  const expectedPolicy = makePolicy();
  assert.equal(body.ipfs_id, TEST_ACTION_CID);
  assert.ok(body.js_params.authorization.signature);
  assert.deepEqual({ ...body.js_params, authorization: undefined }, {
    authorization: undefined,
    op: 'check',
    pkpId: TEST_PKP_ID,
    litActionCid: TEST_ACTION_CID,
    requesterAddress: TEST_REQUESTER,
    sbtAddresses: [TEST_GATE_ADDRESS.toLowerCase()],
    gateMode: 'any',
    expectedChainId: 11155420,
    expectedPolicyFingerprint: fingerprintLitChipotlePolicy(expectedPolicy),
    policy: expectedPolicy,
    rpcUrl: 'https://op-sepolia-testnet.api.pocket.network/',
  });
});

test('executeSessionLitChipotleAction prefers the session-secret custom RPC over public fallbacks', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    if (String(url).endsWith('/core/v1/get_lit_action_ipfs_id')) {
      return jsonResponse('QmAction123');
    }
    if (String(url).endsWith('/core/v1/lit_action')) {
      return jsonResponse({
        has_error: false,
        logs: '',
        response: { ok: true, allowed: true },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  await executeSessionLitChipotleAction({
    config: {
      networkChainId: 11155420,
      litCredentials: { ...AUTH_CONFIG,
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: 'QmAction123',
        litPkpId: '0xpkp123',
      },
    },
    secrets: { ...AUTH_SECRETS,
      litUsageApiKey: 'usage-key',
      customRpcUrl: 'https://rpc.example.test',
    },
    request: {
      actionCode: 'async function main() { return { ok: true }; }',
      op: 'check',
      sbtAddresses: ['0x29563ff3aCC8AFb220D810F8022218095e25C1f6'],
      chainId: 11155420,
    },
    requesterAddress: '0x00000000000000000000000000000000000000aa',
    fetchImpl,
  });

  const body = JSON.parse(calls[1][1].body);
  assert.equal(body.js_params.rpcUrl, 'https://rpc.example.test/');
});


test('resolveLitChipotleProvisioningRuntime prefers session account secrets before worker env credentials and accepts group names', () => {
  assert.deepEqual(resolveLitChipotleProvisioningRuntime({
    env: {
      LIT_ACCOUNT_API_KEY: 'env-account-key',
      LIT_API_BASE: 'https://api.dev.litprotocol.com',
    },
    config: {
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: 'ce-session-content-prod',
        litPkpId: 'pkp_123',
      },
    },
    secrets: {
      litAccountApiKey: 'session-account-key',
    },
  }), {
    litApiBase: 'https://api.chipotle.litprotocol.com',
    allowLocalApiBase: false,
    litManagementApiKey: 'session-account-key',
    apiKeySource: 'session-secret',
    litGroupId: 'ce-session-content-prod',
    litPkpId: 'pkp_123',
    litActionCid: '',
  });
});

test('Lit Chipotle runtime resolution rejects unapproved API bases', () => {
  assert.throws(
    () => resolveLitChipotleRuntime({
      secrets: { litUsageApiKey: 'session-key' },
      body: { litApiBase: 'https://attacker.example' },
    }),
    /host is not approved/,
  );
  assert.throws(
    () => resolveLitChipotleProvisioningRuntime({
      secrets: { litAccountApiKey: 'session-account-key' },
      body: { litApiBase: 'https://api.chipotle.litprotocol.com.evil.example' },
    }),
    /host is not approved/,
  );
});

test('bootstrapLitChipotleSession creates a per-session account, group, wallet, usage key, and default action wiring', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    if (String(url).endsWith('/core/v1/new_account')) {
      assert.deepEqual(JSON.parse(options.body), {
        account_name: 'ce-session-session-a',
        account_description: 'Context Engine Lit account for session Session A',
      });
      return jsonResponse({
        api_key: 'account-key',
        wallet_address: '0xmasterwallet',
      });
    }
    if (String(url).endsWith('/core/v1/add_group')) {
      assert.deepEqual(JSON.parse(options.body), {
        group_name: 'ce-session-session-a-default',
        group_description: 'Default Lit group for session Session A',
        pkp_ids_permitted: [],
        cid_hashes_permitted: [],
      });
      return jsonResponse({
        success: true,
        group_id: '7',
      });
    }
    if (String(url).endsWith('/core/v1/create_wallet')) {
      return jsonResponse({
        wallet_address: '0xpkp123',
      });
    }
    if (String(url).endsWith('/core/v1/list_wallets?page_number=0&page_size=100')) {
      return jsonResponse([
        {
          id: '0',
          name: 'wallet',
          description: 'desc',
          wallet_address: '0xpkp123',
        },
      ]);
    }
    if (String(url).endsWith('/core/v1/get_lit_action_ipfs_id')) {
      assert.equal(JSON.parse(options.body), buildWorkerAuthorizedLitAction({ signer: TEST_WALLET.address, sessionSlug: 'session-a', pkpId: TEST_PKP_ID }));
      return jsonResponse('QmAction123');
    }
    if (String(url).endsWith('/core/v1/list_actions?page_number=0&page_size=100')) {
      return jsonResponse([]);
    }
    if (String(url).endsWith('/core/v1/add_action')) {
      assert.deepEqual(JSON.parse(options.body), {
        action_ipfs_cid: 'QmAction123',
        name: 'ce-sbt-gated-crypto-v3',
        description: 'Context Engine smoke action',
      });
      return jsonResponse({ success: true });
    }
    if (String(url).endsWith('/core/v1/list_actions?group_id=7&page_number=0&page_size=100')) {
      return jsonResponse([]);
    }
    if (String(url).endsWith('/core/v1/add_action_to_group')) {
      assert.deepEqual(JSON.parse(options.body), {
        group_id: 7,
        action_ipfs_cid: 'QmAction123',
      });
      return jsonResponse({ success: true });
    }
    if (String(url).endsWith('/core/v1/list_wallets_in_group?group_id=7&page_number=0&page_size=100')) {
      return jsonResponse([]);
    }
    if (String(url).endsWith('/core/v1/add_pkp_to_group')) {
      assert.deepEqual(JSON.parse(options.body), {
        group_id: 7,
        pkp_id: '0xpkp123',
      });
      return jsonResponse({ success: true });
    }
    if (String(url).endsWith('/core/v1/add_usage_api_key')) {
      assert.deepEqual(JSON.parse(options.body), {
        name: 'ce-session-session-a-default-runtime',
        description: 'Scoped runtime key for session Session A',
        can_create_groups: false,
        can_delete_groups: false,
        can_create_pkps: false,
        manage_ipfs_ids_in_groups: [],
        add_pkp_to_groups: [],
        remove_pkp_from_groups: [],
        execute_in_groups: [7],
      });
      return jsonResponse({
        success: true,
        usage_api_key: 'usage-key',
      });
    }
    if (String(url).endsWith('/core/v1/billing/balance')) {
      return jsonResponse({
        balance_cents: 0,
        balance_display: '$0.00',
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await bootstrapLitChipotleSession({
    secrets: AUTH_SECRETS,
    config: {
      litCredentials: { ...AUTH_CONFIG,
        litApiBase: 'https://api.chipotle.litprotocol.com',
      },
    },
    request: {
      sessionName: 'Session A',
      actionCode: 'async function main() { return { ok: true }; }',
      actionName: 'ce-sbt-gated-crypto-v3',
      actionDescription: 'Context Engine smoke action',
    },
    sessionSlug: 'session-a',
    fetchImpl,
  });

  assert.deepEqual(result, {
    ok: true,
    bootstrapMode: 'session-account',
    alreadyBootstrapped: false,
    ...AUTH_CONFIG,
    apiBase: 'https://api.chipotle.litprotocol.com',
    litActionCid: 'QmAction123',
    litGroupId: '7',
    litPkpId: '0xpkp123',
    accountWalletAddress: '0xmasterwallet',
    billingBalance: {
      balance_cents: 0,
      balance_display: '$0.00',
    },
    litCredentials: { ...AUTH_CONFIG,
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litActionCid: 'QmAction123',
      litGroupId: '7',
      litPkpId: '0xpkp123',
    },
    secretOutputs: { ...AUTH_SECRETS,
      litAccountApiKey: 'account-key',
      litUsageApiKey: 'usage-key',
    },
    steps: {
      createdAccount: true,
      createdGroup: true,
      createdWallet: true,
      derivedCid: true,
      registeredAction: true,
      addedActionToGroup: true,
      addedPkpToGroup: true,
      createdUsageKey: true,
    },
  });
  assert.equal(calls[0][1].headers.Authorization, undefined);
});

test('bootstrapLitChipotleSession reuses a request account key to create missing group, PKP, usage key, and action wiring', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    if (String(url).endsWith('/core/v1/add_group')) {
      assert.deepEqual(JSON.parse(options.body), {
        group_name: 'ce-session-session-a-default',
        group_description: 'Default Lit group for session Session A',
        pkp_ids_permitted: [],
        cid_hashes_permitted: [],
      });
      return jsonResponse({
        success: true,
        group_id: '7',
      });
    }
    if (String(url).endsWith('/core/v1/create_wallet')) {
      return jsonResponse({
        wallet_address: '0xpkp123',
      });
    }
    if (String(url).endsWith('/core/v1/list_wallets?page_number=0&page_size=100')) {
      return jsonResponse([
        {
          id: '0',
          name: 'wallet',
          description: 'desc',
          wallet_address: '0xpkp123',
        },
      ]);
    }
    if (String(url).endsWith('/core/v1/get_lit_action_ipfs_id')) {
      assert.equal(JSON.parse(options.body), buildWorkerAuthorizedLitAction({ signer: TEST_WALLET.address, sessionSlug: 'session-a', pkpId: TEST_PKP_ID }));
      return jsonResponse('QmAction123');
    }
    if (String(url).endsWith('/core/v1/list_actions?page_number=0&page_size=100')) {
      return jsonResponse([]);
    }
    if (String(url).endsWith('/core/v1/add_action')) {
      assert.deepEqual(JSON.parse(options.body), {
        action_ipfs_cid: 'QmAction123',
        name: 'ce-sbt-gated-crypto-v3',
        description: 'Context Engine smoke action',
      });
      return jsonResponse({ success: true });
    }
    if (String(url).endsWith('/core/v1/list_actions?group_id=7&page_number=0&page_size=100')) {
      return jsonResponse([]);
    }
    if (String(url).endsWith('/core/v1/add_action_to_group')) {
      assert.deepEqual(JSON.parse(options.body), {
        group_id: 7,
        action_ipfs_cid: 'QmAction123',
      });
      return jsonResponse({ success: true });
    }
    if (String(url).endsWith('/core/v1/list_wallets_in_group?group_id=7&page_number=0&page_size=100')) {
      return jsonResponse([]);
    }
    if (String(url).endsWith('/core/v1/add_pkp_to_group')) {
      assert.deepEqual(JSON.parse(options.body), {
        group_id: 7,
        pkp_id: '0xpkp123',
      });
      return jsonResponse({ success: true });
    }
    if (String(url).endsWith('/core/v1/add_usage_api_key')) {
      assert.deepEqual(JSON.parse(options.body), {
        name: 'ce-session-session-a-default-runtime',
        description: 'Scoped runtime key for session Session A',
        can_create_groups: false,
        can_delete_groups: false,
        can_create_pkps: false,
        manage_ipfs_ids_in_groups: [],
        add_pkp_to_groups: [],
        remove_pkp_from_groups: [],
        execute_in_groups: [7],
      });
      return jsonResponse({
        success: true,
        usage_api_key: 'usage-key',
      });
    }
    if (String(url).endsWith('/core/v1/billing/balance')) {
      return jsonResponse({
        balance_cents: 0,
        balance_display: '$0.00',
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await bootstrapLitChipotleSession({
    secrets: AUTH_SECRETS,
    env: {
      LIT_API_BASE: 'http://localhost:8787/core/v1/',
      LIT_CHIPOTLE_ALLOW_LOCAL_API_BASE: 'true',
    },
    config: {
      litCredentials: { ...AUTH_CONFIG,},
    },
    request: {
      litAccountApiKey: 'account-key',
      sessionName: 'Session A',
      actionCode: 'async function main() { return { ok: true }; }',
      actionName: 'ce-sbt-gated-crypto-v3',
      actionDescription: 'Context Engine smoke action',
    },
    sessionSlug: 'session-a',
    fetchImpl,
  });

  assert.deepEqual(result, {
    ok: true,
    bootstrapMode: 'existing-account',
    alreadyBootstrapped: false,
    ...AUTH_CONFIG,
    apiBase: 'http://localhost:8787',
    litActionCid: 'QmAction123',
    litGroupId: '7',
    litPkpId: '0xpkp123',
    billingBalance: {
      balance_cents: 0,
      balance_display: '$0.00',
    },
    litCredentials: { ...AUTH_CONFIG,
      litApiBase: 'http://localhost:8787',
      litActionCid: 'QmAction123',
      litGroupId: '7',
      litPkpId: '0xpkp123',
    },
    secretOutputs: { ...AUTH_SECRETS,
      litAccountApiKey: 'account-key',
      litUsageApiKey: 'usage-key',
    },
    steps: {
      createdAccount: false,
      createdGroup: true,
      createdWallet: true,
      derivedCid: true,
      registeredAction: true,
      addedActionToGroup: true,
      addedPkpToGroup: true,
      createdUsageKey: true,
    },
  });
  assert.equal(
    calls.some(([url]) => url.endsWith('/core/v1/new_account')),
    false,
  );
  assert.ok(calls.every(([url]) => url.startsWith('http://localhost:8787/core/v1/')));
  assert.equal(calls[0][1].headers.Authorization, 'Bearer account-key');
});

test('manual provisioning keeps only hardened authority and rejects legacy reuse', async () => {
  const config = { litCredentials: { ...AUTH_CONFIG, litGroupId: '7', litPkpId: TEST_PKP_ID, litActionCid: TEST_ACTION_CID } };
  const secrets = { ...AUTH_SECRETS, litAccountApiKey: 'account-key', litUsageApiKey: 'usage-key' };
  const runtime = { litApiBase: 'https://api.chipotle.litprotocol.com', litManagementApiKey: 'account-key' };
  const result = await provisionLitChipotleAction({ runtime, config, secrets, fetchImpl: validateExistingActionOnly() });
  assert.equal(result.alreadyBootstrapped, true);
  assert.equal(result.litCredentials.litAuthorizationSigner, TEST_WALLET.address);
  await assert.rejects(provisionLitChipotleAction({ runtime, config: { litCredentials: { litPkpId: TEST_PKP_ID } }, secrets }), /reprovision Lit/);
});

test('Worker-account bootstrap explicitly clears the session account in fresh and repeated finalization', async () => {
  const env = { LIT_ACCOUNT_API_KEY: 'env-account-key' };
  const secrets = { ...AUTH_SECRETS, litAccountApiKey: '', litUsageApiKey: 'old-usage' };
  const result = await bootstrapLitChipotleSession({
    env, secrets, sessionSlug: 'session-a', request: { freshAuthority: true },
    config: { litCredentials: { litGroupId: 'old-group', litPkpId: 'old-pkp', litActionCid: 'old-action' } },
    fetchImpl: async (url, options = {}) => {
      const path = new URL(url).pathname.replace('/core/v1', '');
      if (path !== '/get_lit_action_ipfs_id') assert.equal(options.headers.Authorization, 'Bearer env-account-key');
      if (path === '/add_group') return jsonResponse({ group_id: 8 });
      if (path === '/create_wallet') return jsonResponse({ wallet_address: 'fresh-wallet' });
      if (path === '/list_wallets') return jsonResponse([{ id: 'fresh-pkp', wallet_address: 'fresh-wallet' }]);
      if (path === '/get_lit_action_ipfs_id') return jsonResponse('fresh-action');
      if (path === '/list_actions' || path === '/list_wallets_in_group') return jsonResponse([]);
      if (['/add_action', '/add_action_to_group', '/add_pkp_to_group'].includes(path)) return jsonResponse({ success: true });
      if (path === '/add_usage_api_key') return jsonResponse({ usage_api_key: 'fresh-usage' });
      if (path === '/billing/balance') return jsonResponse({ balance_cents: 0 });
      assert.fail(`Unexpected ${path}`);
    },
  });
  assert.equal(result.secretOutputs.litAccountApiKey, '');
  assert.equal(result.secretOutputs.litUsageApiKey, 'fresh-usage');
  const retry = await bootstrapLitChipotleSession({
    env, config: { litCredentials: result.litCredentials }, secrets: { ...secrets, ...result.secretOutputs },
    sessionSlug: 'session-a', fetchImpl: validateExistingActionOnly({ pkpId: 'fresh-pkp', sessionSlug: 'session-a', cid: 'fresh-action' }),
  });
  assert.equal(retry.alreadyBootstrapped, true);
  assert.equal(retry.secretOutputs.litAccountApiKey, '');
});

test('direct unsigned Action cannot impersonate a holder or choose a balance oracle', async () => {
  const policy = makePolicy();
  const { main, calls } = createDefaultActionHarness({
    balances: { [TEST_GATE_ADDRESS.toLowerCase()]: 1 },
    decryptPlaintext: makeWrappedPlaintext(policy),
  });
  await assert.rejects(main(await makeActionParams({
    op: 'decrypt', policy, ciphertext: 'captured-wrapped-key', signed: false,
    rpcUrl: 'https://attacker.example.test',
  })), /authorization/i);
  assert.deepEqual(calls.decryptCiphertexts, []);
});

test('signed decrypt returns an opaque reply on every replay, readable only with the original Worker key', async () => {
  const { main } = createDefaultActionHarness({ balances: { [TEST_GATE_ADDRESS.toLowerCase()]: 1 }, decryptPlaintext: makeWrappedPlaintext() });
  const params = await makeActionParams({ op: 'decrypt', ciphertext: 'captured-wrapped-key' });
  const context = await authorizeLitRequest({ wallet: TEST_WALLET, jsParams: params, sessionSlug: '' });
  for (let replay = 0; replay < 2; replay += 1) {
    const response = await main(params);
    assert.equal(response.plaintext, undefined);
    assert.equal(await openLitReply(response.encryptedReply, context), `0x${'11'.repeat(32)}`);
    const unrelatedContext = await authorizeLitRequest({ wallet: TEST_WALLET, jsParams: { ...params }, sessionSlug: '' });
    await assert.rejects(openLitReply(response.encryptedReply, unrelatedContext));
    await assert.rejects(openLitReply({ ...response.encryptedReply, iv: `0x${'00'.repeat(12)}` }, context));
  }
});

test('Action authenticates every authorization field before any membership or key operation', async () => {
  const { main, calls } = createDefaultActionHarness({ balances: { [TEST_GATE_ADDRESS.toLowerCase()]: 1 }, decryptPlaintext: makeWrappedPlaintext() });
  const original = await makeActionParams({ op: 'decrypt', ciphertext: 'captured-wrapped-key' });
  const mutations = [
    (p) => { p.requesterAddress = '0x00000000000000000000000000000000000000bb'; },
    (p) => { p.rpcUrl = 'https://attacker.example.test'; },
    (p) => { p.ciphertext += '-substituted'; },
    (p) => { p.op = 'encrypt'; },
    (p) => { p.expectedChainId = 84532; },
    (p) => { p.expectedPolicyFingerprint = `0x${'00'.repeat(32)}`; },
    (p) => { p.pkpId = 'another-pkp'; },
    (p) => { p.litActionCid = 'another-action'; },
    (p) => { p.authorization.sessionSlug = 'another-session'; },
    (p) => { p.authorization.requestId = `0x${'00'.repeat(32)}`; },
    (p) => { p.authorization.replyPublicKey = `0x04${'00'.repeat(64)}`; },
    (p) => { p.authorization.issuedAt -= 1; },
    (p) => { p.authorization.expiresAt += 1; },
    (p) => { p.authorization.signature = '0x1234'; },
  ];
  for (const mutate of mutations) {
    const params = structuredClone(original);
    mutate(params);
    await assert.rejects(main(params), /authorization/i);
  }
  const impostor = structuredClone(original);
  impostor.authorization.signature = await ethers.Wallet.createRandom().signMessage(litAuthorizationMessage(impostor));
  await assert.rejects(main(impostor), /authorization/i);
  for (const now of [Math.floor(Date.now() / 1000) - 61, Math.floor(Date.now() / 1000) + 60]) {
    const params = structuredClone(original);
    await authorizeLitRequest({ wallet: TEST_WALLET, jsParams: params, sessionSlug: '', now });
    await assert.rejects(main(params), /expired Worker authorization/i);
  }
  assert.deepEqual(calls.providers, []);
  assert.deepEqual(calls.decryptCiphertexts, []);
});

test('valid Worker signatures preserve Any and All gate decisions', async () => {
  const otherGate = '0x00000000000000000000000000000000000000bb';
  const { main, calls } = createDefaultActionHarness({ balances: { [TEST_GATE_ADDRESS.toLowerCase()]: 1 } });
  for (const gateMode of ['any', 'all']) {
    const policy = makePolicy({ gateMode, sbtAddresses: [TEST_GATE_ADDRESS, otherGate] });
    const result = await main(await makeActionParams({ op: 'check', policy }));
    assert.equal(result.allowed, gateMode === 'any');
  }
  assert.equal(calls.providers.length, 2);
});

test('Worker executes its own specialized Action and returns only decrypted CEK to its authenticated caller', async () => {
  const { main } = createDefaultActionHarness({ balances: { [TEST_GATE_ADDRESS.toLowerCase()]: 1 }, decryptPlaintext: makeWrappedPlaintext() });
  let submitted;
  const result = await executeSessionLitChipotleAction({
    config: { litCredentials: { ...AUTH_CONFIG, litPkpId: TEST_PKP_ID, litActionCid: TEST_ACTION_CID } },
    secrets: { ...AUTH_SECRETS, litUsageApiKey: 'scoped-key' },
    sessionSlug: '', requesterAddress: TEST_REQUESTER,
    request: { op: 'decrypt', ciphertext: 'captured-wrapped-key', chainId: 11155420,
      sbtAddresses: [TEST_GATE_ADDRESS], code: 'return secrets', requesterAddress: 'attacker', authorization: { signer: 'attacker' } },
    fetchImpl: async (url, options) => {
      if (url.endsWith('/get_lit_action_ipfs_id')) {
        assert.equal(JSON.parse(options.body), DEFAULT_CHIPOTLE_ACTION_CODE);
        return jsonResponse(TEST_ACTION_CID);
      }
      submitted = JSON.parse(options.body).js_params;
      return jsonResponse({ has_error: false, logs: 'do not reflect logs', response: await main(submitted) });
    },
  });
  assert.equal(submitted.requesterAddress, TEST_REQUESTER);
  assert.equal(result.response.plaintext, `0x${'11'.repeat(32)}`);
  assert.equal(result.request, undefined);
  const serialized = JSON.stringify(result);
  for (const secret of [submitted.authorization.signature, submitted.authorization.replyPublicKey, TEST_WALLET.privateKey, 'encryptedReply', 'do not reflect logs']) {
    assert.equal(serialized.includes(secret), false);
  }
});

test('Worker rejects missing authorization config and unencrypted legacy replies', async () => {
  const options = {
    config: { litCredentials: { ...AUTH_CONFIG, litPkpId: TEST_PKP_ID, litActionCid: TEST_ACTION_CID } },
    secrets: { ...AUTH_SECRETS, litUsageApiKey: 'scoped-key' },
    request: { op: 'decrypt', ciphertext: 'captured-wrapped-key', chainId: 11155420, sbtAddresses: [TEST_GATE_ADDRESS] },
    requesterAddress: TEST_REQUESTER,
    fetchImpl: async (url) => jsonResponse(url.endsWith('/get_lit_action_ipfs_id') ? TEST_ACTION_CID : { has_error: false, response: { ok: true, allowed: true, plaintext: `0x${'11'.repeat(32)}` } }),
  };
  await assert.rejects(executeSessionLitChipotleAction(options), /Invalid encrypted Lit authorization reply/);
  await assert.rejects(executeSessionLitChipotleAction({ ...options, secrets: { litUsageApiKey: 'scoped-key' } }), /reprovision Lit/);
  await assert.rejects(executeSessionLitChipotleAction({ ...options, config: { litCredentials: { litPkpId: TEST_PKP_ID, litActionCid: TEST_ACTION_CID } } }), /reprovision Lit/);
});

test('fresh-authority bootstrap isolates the new PKP from every old Action permission', async () => {
  const oldConfig = { litCredentials: { litApiBase: 'https://api.chipotle.litprotocol.com', litGroupId: '7', litPkpId: 'old-pkp', litActionCid: 'old-action' } };
  const persisted = { ...AUTH_SECRETS, litAccountApiKey: 'account-key', litUsageApiKey: 'old-usage' };
  const groups = new Map([['7', { actions: ['old-action'], pkps: ['old-pkp'] }]]);
  const usageGroups = new Map([['old-usage', ['7']]]);
  let specializedSource;
  let persistCount = 0;
  const fetchImpl = async (url, options = {}) => {
    const path = new URL(url).pathname.replace('/core/v1', '');
    const body = options.body ? JSON.parse(options.body) : {};
    assert.ok(persistCount > 0, 'signer persisted before any remote side effect');
    if (path === '/add_group') {
      assert.deepEqual(body.pkp_ids_permitted, []);
      assert.deepEqual(body.cid_hashes_permitted, []);
      groups.set('8', { actions: [], pkps: [] });
      return jsonResponse({ group_id: 8 });
    }
    if (path === '/create_wallet') return jsonResponse({ wallet_address: 'fresh-wallet' });
    if (path === '/list_wallets') return jsonResponse([{ id: 'fresh-pkp', wallet_address: 'fresh-wallet' }]);
    if (path === '/get_lit_action_ipfs_id') {
      specializedSource = body;
      assert.equal(body, buildWorkerAuthorizedLitAction({ signer: TEST_WALLET.address, sessionSlug: 'session-a', pkpId: 'fresh-pkp' }));
      return jsonResponse('fresh-action');
    }
    if (path === '/list_actions' || path === '/list_wallets_in_group') return jsonResponse([]);
    if (path === '/add_action') return jsonResponse({ success: true });
    if (path === '/add_action_to_group') {
      groups.get(String(body.group_id)).actions.push(body.action_ipfs_cid);
      return jsonResponse({ success: true });
    }
    if (path === '/add_pkp_to_group') {
      groups.get(String(body.group_id)).pkps.push(body.pkp_id);
      return jsonResponse({ success: true });
    }
    if (path === '/add_usage_api_key') {
      assert.deepEqual(body.execute_in_groups, [8]);
      for (const field of ['can_create_groups', 'can_delete_groups', 'can_create_pkps']) assert.equal(body[field], false);
      for (const field of ['manage_ipfs_ids_in_groups', 'add_pkp_to_groups', 'remove_pkp_from_groups']) assert.deepEqual(body[field], []);
      usageGroups.set('fresh-usage', body.execute_in_groups.map(String));
      return jsonResponse({ usage_api_key: 'fresh-usage' });
    }
    if (path === '/billing/balance') return jsonResponse({ balance_cents: 0 });
    if (path === '/lit_action') {
      const key = options.headers.Authorization.replace('Bearer ', '');
      const permitted = key === 'account-key' ? [...groups.keys()] : usageGroups.get(key) || [];
      // Lit authorizes the actual executed CID and PKP together, never a CID claimed in jsParams.
      const permittedKeyOperation = permitted.some((id) => groups.get(id).actions.includes(body.ipfs_id) && groups.get(id).pkps.includes(body.js_params.pkpId));
      if (!permittedKeyOperation) return jsonResponse({ error: 'Action/PKP is not permitted in a common group' }, { ok: false, status: 403 });
      return jsonResponse({ has_error: false, response: { ok: true } });
    }
    throw new Error(`Unexpected ${path}`);
  };
  await assert.rejects(bootstrapLitChipotleSession({ config: oldConfig, secrets: persisted, fetchImpl }), /reprovision Lit/);
  assert.equal(persistCount, 0);
  const result = await bootstrapLitChipotleSession({
    config: oldConfig, secrets: persisted, request: { freshAuthority: true }, sessionSlug: 'session-a', fetchImpl,
    persistAuthorizationSecret: async (key) => { persistCount += 1; persisted.litAuthorizationPrivateKey = key; },
  });
  assert.equal(result.litPkpId, 'fresh-pkp');
  assert.equal(result.litGroupId, '8');
  assert.equal(result.secretOutputs.litUsageApiKey, 'fresh-usage');
  assert.equal(result.secretOutputs.litAuthorizationPrivateKey, TEST_WALLET.privateKey);
  assert.ok(specializedSource);
  assert.deepEqual(groups.get('8'), { actions: ['fresh-action'], pkps: ['fresh-pkp'] });
  for (const usageKey of ['old-usage', 'fresh-usage', 'account-key']) {
    await assert.rejects(executeLitChipotleAction({
      runtime: { litApiBase: oldConfig.litCredentials.litApiBase, litUsageApiKey: usageKey },
      request: { ipfsId: 'old-action', jsParams: { pkpId: 'fresh-pkp', litActionCid: 'fresh-action' } }, fetchImpl,
    }), /not permitted/);
  }
  const retry = await bootstrapLitChipotleSession({
    config: { litCredentials: result.litCredentials }, secrets: { ...persisted, ...result.secretOutputs }, sessionSlug: 'session-a',
    fetchImpl: validateExistingActionOnly({ pkpId: 'fresh-pkp', sessionSlug: 'session-a', cid: 'fresh-action' }),
  });
  assert.equal(retry.alreadyBootstrapped, true);
  assert.equal(retry.litAuthorizationSigner, TEST_WALLET.address);
});

test('invalid private signer state is redacted and legacy status never claims readiness', async () => {
  const malformed = 'private-material-that-must-never-appear-in-errors';
  const config = { litCredentials: { ...AUTH_CONFIG, litPkpId: TEST_PKP_ID, litActionCid: TEST_ACTION_CID } };
  const secrets = { litUsageApiKey: 'usage-key', litAuthorizationPrivateKey: malformed };
  await assert.rejects(executeSessionLitChipotleAction({ config, secrets }), (error) => {
    assert.match(error.message, /session admin/);
    assert.equal(error.message.includes(malformed), false);
    return true;
  });
  const runtime = resolveLitChipotleRuntime({ config, secrets });
  assert.equal(runtime.authorizationReady, false);
  const status = await readLitChipotleStatus({ runtime, fetchImpl: async () => jsonResponse([]) });
  assert.equal(status.ready, false);
  assert.equal(status.needsFreshAuthority, true);
});

test('legacy status remains actionable without execution or account keys and makes no provider calls', async () => {
  const runtime = resolveLitChipotleRuntime({
    config: { litCredentials: { litGroupId: '7', litPkpId: 'old-pkp', litActionCid: 'old-action' } },
  });
  const status = await readLitChipotleStatus({
    runtime,
    fetchImpl: () => assert.fail('Missing credentials must be reported locally'),
  });
  assert.equal(status.ok, true);
  assert.equal(status.ready, false);
  assert.equal(status.needsFreshAuthority, true);
  assert.equal(status.apiKeySource, 'missing');
  assert.equal(status.groupSummary.hasConfiguredAction, null);
  assert.match(status.warnings[0].message, /API key.*not configured/i);
});

for (const complete of [false, true]) {
  test(`provisioning rejects a mismatched stored Action before mutation (${complete ? 'complete' : 'partial'} authority)`, async () => {
    const calls = [];
    await assert.rejects(provisionLitChipotleAction({
      runtime: { litApiBase: 'https://api.chipotle.litprotocol.com', litManagementApiKey: 'account-key' },
      config: { litCredentials: { ...AUTH_CONFIG, litPkpId: TEST_PKP_ID, litActionCid: 'old-unsigned-action', ...(complete ? { litGroupId: '7' } : {}) } },
      secrets: { ...AUTH_SECRETS, litAccountApiKey: 'account-key', ...(complete ? { litUsageApiKey: 'usage-key' } : {}) },
      sessionSlug: 'session-a',
      fetchImpl: async (url, options) => {
        calls.push(new URL(url).pathname);
        assert.ok(url.endsWith('/get_lit_action_ipfs_id'), 'No account, metadata, group, key, or permission mutation');
        assert.equal(JSON.parse(options.body), buildWorkerAuthorizedLitAction({ signer: TEST_WALLET.address, sessionSlug: 'session-a', pkpId: TEST_PKP_ID }));
        return jsonResponse(TEST_ACTION_CID);
      },
    }), /does not match the configured Lit Action CID/);
    assert.deepEqual(calls, ['/core/v1/get_lit_action_ipfs_id']);
  });
}

test('fresh-authority provisioning without an account key explains the missing management credential', async () => {
  await assert.rejects(provisionLitChipotleAction({
    config: { litCredentials: { litPkpId: 'old-pkp' } },
    secrets: { litUsageApiKey: 'usage-key' },
    request: { freshAuthority: true },
    fetchImpl: () => assert.fail('Provisioning needs a management credential before contacting Lit'),
  }), /Lit account API key not configured/);
});

test('provider errors cannot reflect signed tickets back to the participant', async () => {
  let signature;
  await assert.rejects(executeSessionLitChipotleAction({
    config: { litCredentials: { ...AUTH_CONFIG, litPkpId: TEST_PKP_ID, litActionCid: TEST_ACTION_CID } },
    secrets: { ...AUTH_SECRETS, litUsageApiKey: 'usage-key' },
    request: { op: 'check', chainId: 11155420, sbtAddresses: [TEST_GATE_ADDRESS] }, requesterAddress: TEST_REQUESTER,
    fetchImpl: async (url, options) => {
      if (url.endsWith('/get_lit_action_ipfs_id')) return jsonResponse(TEST_ACTION_CID);
      signature = JSON.parse(options.body).js_params.authorization.signature;
      return jsonResponse({ error: options.body }, { ok: false, status: 502 });
    },
  }), (error) => {
    assert.match(error.message, /Lit Action execution failed/);
    assert.equal(error.message.includes(signature), false);
    return true;
  });
});

for (const request of [{ litAccountApiKey: 'replacement-private-key' }, { litApiBase: 'http://localhost:4000' }]) {
  test(`resuming Lit setup refuses conflicting ${Object.keys(request)[0]} without exposing credentials`, async () => {
    let calls = 0;
    await assert.rejects(bootstrapLitChipotleSession({
      config: {}, secrets: AUTH_SECRETS, sessionSlug: 'fixture', request,
      provisioning: { litAccountApiKey: 'saved-private-key', litGroupId: '7', litApiBase: 'https://api.chipotle.litprotocol.com' },
      fetchImpl: async () => { calls++; throw new Error('unexpected provider call'); },
    }), error => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'lit_provisioning_credentials_conflict');
      assert.match(error.message, /conflict with saved setup/);
      assert.ok(!error.message.includes('private-key'));
      return true;
    });
    assert.equal(calls, 0);
  });
}
