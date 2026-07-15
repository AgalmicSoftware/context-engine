import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ethersUtils = ethers?.utils || ethers;
const TEST_ACTION_CID = 'QmAction123';
const TEST_PKP_ID = '0xpkp123';
const TEST_GATE_ADDRESS = '0x29563ff3aCC8AFb220D810F8022218095e25C1f6';
const TEST_REQUESTER = '0x00000000000000000000000000000000000000aa';

const readDefaultChipotleActionCode = () => {
  const catalogPath = resolve(__dirname, '../../client/src/utilities/crypto/litChipotleCatalog.ts');
  const catalogSource = readFileSync(catalogPath, 'utf8');
  const match = catalogSource.match(/export const DEFAULT_CHIPOTLE_ACTION_CODE = `([\s\S]*?)`;/);
  assert.ok(match, 'client Lit Chipotle catalog must export DEFAULT_CHIPOTLE_ACTION_CODE');
  return match[1];
};

const DEFAULT_CHIPOTLE_ACTION_CODE = readDefaultChipotleActionCode();

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
    utils: ethersUtils,
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

const makeActionParams = ({
  op,
  policy = makePolicy(),
  rpcUrl = 'https://op-sepolia.example.test',
  message,
  ciphertext,
} = {}) => ({
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
});

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
  assert.equal(calls[0][1].redirect, 'error');

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

  const result = await main(makeActionParams({
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

  const result = await main(makeActionParams({
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
    () => main(makeActionParams({
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
    () => main(makeActionParams({
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
    () => main(makeActionParams({
      op: 'decrypt',
      policy,
      ciphertext: 'wrapped-cek',
    })),
    /legacy wrapped keys are not supported/i,
  );
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
  assert.deepEqual(result.request, {
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
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: TEST_ACTION_CID,
        litPkpId: TEST_PKP_ID,
      },
    },
    secrets: {
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
          litCredentials: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litActionCid: TEST_ACTION_CID,
            litPkpId: TEST_PKP_ID,
          },
        },
        secrets: { litUsageApiKey: 'usage-key' },
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
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: TEST_ACTION_CID,
        litPkpId: TEST_PKP_ID,
      },
    },
    secrets: {
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
  assert.equal(inlineBody.code, actionCode);
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
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: TEST_ACTION_CID,
        litPkpId: TEST_PKP_ID,
      },
    },
    secrets: {},
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
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: TEST_ACTION_CID,
          litPkpId: TEST_PKP_ID,
        },
      },
      secrets: {
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
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: TEST_ACTION_CID,
          litPkpId: TEST_PKP_ID,
        },
      },
      secrets: {
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
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: 'QmAction123',
          litPkpId: '0xpkp123',
        },
      },
      secrets: {
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
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: 'QmAction123',
        litPkpId: '0xpkp123',
      },
    },
    secrets: {
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
  assert.deepEqual(body.js_params, {
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
      litCredentials: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litActionCid: 'QmAction123',
        litPkpId: '0xpkp123',
      },
    },
    secrets: {
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
      assert.equal(JSON.parse(options.body), 'async function main() { return { ok: true }; }');
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
    config: {
      litCredentials: {
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
    apiBase: 'https://api.chipotle.litprotocol.com',
    litActionCid: 'QmAction123',
    litGroupId: '7',
    litPkpId: '0xpkp123',
    accountWalletAddress: '0xmasterwallet',
    billingBalance: {
      balance_cents: 0,
      balance_display: '$0.00',
    },
    litCredentials: {
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litActionCid: 'QmAction123',
      litGroupId: '7',
      litPkpId: '0xpkp123',
    },
    secretOutputs: {
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
      assert.equal(JSON.parse(options.body), 'async function main() { return { ok: true }; }');
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
    env: {
      LIT_API_BASE: 'http://localhost:8787/core/v1/',
      LIT_CHIPOTLE_ALLOW_LOCAL_API_BASE: 'true',
    },
    config: {
      litCredentials: {},
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
    apiBase: 'http://localhost:8787',
    litActionCid: 'QmAction123',
    litGroupId: '7',
    litPkpId: '0xpkp123',
    billingBalance: {
      balance_cents: 0,
      balance_display: '$0.00',
    },
    litCredentials: {
      litApiBase: 'http://localhost:8787',
      litActionCid: 'QmAction123',
      litGroupId: '7',
      litPkpId: '0xpkp123',
    },
    secretOutputs: {
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

test('provisionLitChipotleAction derives, registers, and attaches a Lit action to the configured group', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([String(url), options]);
    if (String(url).endsWith('/core/v1/list_groups?page_number=0&page_size=100')) {
      return jsonResponse([{ id: '7', name: 'ce-session-content-prod', description: 'prod' }]);
    }
    if (String(url).endsWith('/core/v1/get_lit_action_ipfs_id')) {
      assert.equal(JSON.parse(options.body), 'async function main() { return { ok: true }; }');
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
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await provisionLitChipotleAction({
    runtime: {
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litManagementApiKey: 'account-key',
      apiKeySource: 'worker-env',
      litGroupId: 'ce-session-content-prod',
      litPkpId: '0xpkp123',
    },
    request: {
      actionCode: 'async function main() { return { ok: true }; }',
      actionName: 'ce-sbt-gated-crypto-v3',
      actionDescription: 'Context Engine smoke action',
    },
    fetchImpl,
  });

  assert.deepEqual(result, {
    ok: true,
    apiBase: 'https://api.chipotle.litprotocol.com',
    apiKeySource: 'worker-env',
    litActionCid: 'QmAction123',
    litGroupId: '7',
    litPkpId: '0xpkp123',
    steps: {
      derivedCid: true,
      registeredAction: true,
      addedActionToGroup: true,
      addedPkpToGroup: true,
    },
  });
  assert.equal(calls[0][1].headers['X-Api-Key'], 'account-key');
});
