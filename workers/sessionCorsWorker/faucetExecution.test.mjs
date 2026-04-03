import test from 'node:test';
import assert from 'node:assert/strict';

import { faucet } from './faucetExecution.js';

const BASE_HEADERS = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
const RECIPIENT = '0x00000000000000000000000000000000000000aa';
const FROM_ADDRESS = '0x00000000000000000000000000000000000000ff';
const PRIMARY_RPC = 'https://rpc-1.example';
const SECONDARY_RPC = 'https://rpc-2.example';
const MASKED_PRIMARY_RPC = 'masked:https://rpc-1.example';
const MASKED_SECONDARY_RPC = 'masked:https://rpc-2.example';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

const createNormalizedResult = (overrides = {}) => ({
  ok: true,
  status: 200,
  error: '',
  logContext: {
    to: RECIPIENT,
    rpcUrl: MASKED_PRIMARY_RPC,
    rpcUrls: [MASKED_PRIMARY_RPC],
    registryChainId: 84532,
    networkChainId: 84532,
    faucetChainId: 84532,
    expectedChainId: 84532,
    amountEth: '0.0002',
    thresholdEth: '0.001',
  },
  normalized: {
    to: RECIPIENT,
    rpcUrls: [PRIMARY_RPC],
    rpcMasked: MASKED_PRIMARY_RPC,
    amountEth: '0.0002',
    amountWei: '200',
    thresholdEth: '0.001',
    thresholdWei: '1000',
    privateKey: '0xabc123',
    registryChainId: 84532,
    networkChainId: 84532,
    faucetChainId: 84532,
    expectedChainId: 84532,
  },
  ...overrides,
});

const createWalletCtor = ({ signTransaction, capturePrivateKey } = {}) => class WalletStub {
  constructor(privateKey) {
    capturePrivateKey?.(privateKey);
    this.address = FROM_ADDRESS;
  }

  async signTransaction(txRequest) {
    return signTransaction ? signTransaction(txRequest) : '0xsigned';
  }
};

const createDeps = (overrides = {}) => {
  const logs = [];
  const deps = {
    json: createJsonStub(),
    log: (...args) => {
      logs.push(args);
    },
    normalizeFaucetRequest: () => createNormalizedResult(),
    validateFaucetEligibilityRequest: async () => ({ ok: true, flow: 'open', resourceKey: 'txGas' }),
    Wallet: createWalletCtor(),
    rpcRequest: async ({ method }) => {
      switch (method) {
        case 'eth_chainId':
          return '0x14a34';
        case 'eth_getBalance':
          return '0x0';
        case 'eth_getTransactionCount':
          return '0x1';
        case 'eth_gasPrice':
          return '0x2';
        case 'eth_sendRawTransaction':
          return '0xtxhash';
        default:
          throw new Error(`Unexpected method: ${method}`);
      }
    },
    toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
    toChainId: (value) => {
      if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
      if (typeof value === 'string' && value.trim().startsWith('0x')) {
        return parseInt(value, 16) || 0;
      }
      return Number(value) || 0;
    },
    toBigInt: (value) => BigInt(String(value)),
    formatEther: (value) => `eth:${value}`,
    maskRpcUrl: (value) => `masked:${String(value).trim()}`,
    isAddress: () => true,
    parseEther: () => 0n,
    resolveFaucetRpcUrls: () => [PRIMARY_RPC],
    isBytes32Hex: () => true,
    normalizeAddressLower: (value) => String(value || '').trim().toLowerCase(),
    findSessionGateForSbt: async () => ({ ok: true, flow: 'open', resourceKey: 'txGas' }),
    readSbtFaucetValidationState: async () => ({ ok: true, hasPasswordMint: false }),
    validateSbtPasswordForFaucet: async () => ({ ok: true, isValid: true }),
    verifyGroupSignatureForFaucet: () => ({ ok: true }),
    __logs: logs,
  };
  return { ...deps, ...overrides, __logs: logs };
};

const runFaucet = async (deps, overrides = {}) => faucet({
  payload: { action: 'request_test_eth', address: RECIPIENT },
  secrets: { faucetPrivateKey: '0xabc123' },
  config: { faucet: { rpcUrl: PRIMARY_RPC } },
  baseHeaders: BASE_HEADERS,
  slug: 'session-a',
  requesterAddress: RECIPIENT,
  tokenHasFaucetScope: true,
  deps,
  constants: {
    anonymousGateUnavailableError: 'Access denied: on-chain gate data unavailable.',
    zeroBytes32: `0x${'0'.repeat(64)}`,
  },
  defaults: {
    defaultRpcUrl: 'https://default-rpc.example',
    defaultAmountEth: '0.0002',
    defaultThresholdEth: '0.001',
  },
  ...overrides,
});

test('faucet preserves normalized request failure passthrough and request logging', async () => {
  let eligibilityCalled = false;
  const deps = createDeps({
    normalizeFaucetRequest: () => ({
      ok: false,
      status: 500,
      error: 'Invalid faucet amount (expected ETH string).',
      logContext: { to: RECIPIENT, rpcUrl: MASKED_PRIMARY_RPC },
      normalized: null,
    }),
    validateFaucetEligibilityRequest: async () => {
      eligibilityCalled = true;
      return { ok: true };
    },
  });

  const result = await runFaucet(deps);

  assert.equal(eligibilityCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Invalid faucet amount (expected ETH string).' },
    status: 500,
    headers: BASE_HEADERS,
  });
  assert.deepEqual(deps.__logs, [
    ['[faucet] request', { to: RECIPIENT, rpcUrl: MASKED_PRIMARY_RPC }],
  ]);
});

test('faucet preserves eligibility failure passthrough after request normalization', async () => {
  let walletConstructed = false;
  const deps = createDeps({
    validateFaucetEligibilityRequest: async () => ({
      ok: false,
      status: 403,
      error: 'Requested resource gate is unavailable.',
      reason: 'sbt-validation-unavailable',
      details: [{ rpcUrl: MASKED_PRIMARY_RPC, error: 'boom' }],
    }),
    Wallet: class WalletShouldNotConstruct {
      constructor() {
        walletConstructed = true;
      }
    },
  });

  const result = await runFaucet(deps, { tokenHasFaucetScope: false });

  assert.equal(walletConstructed, false);
  assert.deepEqual(result, {
    body: {
      error: 'Requested resource gate is unavailable.',
      reason: 'sbt-validation-unavailable',
      details: [{ rpcUrl: MASKED_PRIMARY_RPC, error: 'boom' }],
    },
    status: 403,
    headers: BASE_HEADERS,
  });
});

test('faucet preserves threshold rejection when current balance is above threshold', async () => {
  const rpcCalls = [];
  const deps = createDeps({
    rpcRequest: async (value) => {
      rpcCalls.push(value);
      switch (value.method) {
        case 'eth_chainId':
          return '0x14a34';
        case 'eth_getBalance':
          return '1001';
        default:
          throw new Error(`Unexpected method: ${value.method}`);
      }
    },
  });

  const result = await runFaucet(deps);

  assert.deepEqual(result, {
    body: {
      error: 'Balance above threshold (0.001 ETH).',
      balanceEth: 'eth:1001',
      thresholdEth: '0.001',
      rpcUrl: MASKED_PRIMARY_RPC,
      chainId: 84532,
    },
    status: 403,
    headers: BASE_HEADERS,
  });
  assert.deepEqual(
    rpcCalls.map(({ method }) => method),
    ['eth_chainId', 'eth_getBalance'],
  );
});

test('faucet preserves chainId mismatch accumulation and final failure normalization', async () => {
  const deps = createDeps({
    normalizeFaucetRequest: () => createNormalizedResult({
      logContext: {
        to: RECIPIENT,
        rpcUrl: MASKED_PRIMARY_RPC,
        rpcUrls: [MASKED_PRIMARY_RPC, MASKED_SECONDARY_RPC],
        registryChainId: 84532,
        networkChainId: 84532,
        faucetChainId: 84532,
        expectedChainId: 84532,
        amountEth: '0.0002',
        thresholdEth: '0.001',
      },
      normalized: {
        ...createNormalizedResult().normalized,
        rpcUrls: [PRIMARY_RPC, SECONDARY_RPC],
      },
    }),
    rpcRequest: async ({ rpcUrl, method }) => {
      assert.equal(method, 'eth_chainId');
      return rpcUrl === PRIMARY_RPC ? '0x14a35' : '0x14a36';
    },
  });

  const result = await runFaucet(deps);

  assert.deepEqual(result, {
    body: {
      error: 'RPC chainId 84534 != expected 84532',
      rpcUrl: MASKED_PRIMARY_RPC,
      chainId: 84532,
      registryChainId: 84532,
      networkChainId: 84532,
      faucetChainId: 84532,
      attempts: [
        {
          rpcUrl: MASKED_PRIMARY_RPC,
          chainId: 84533,
          error: 'RPC chainId 84533 != expected 84532',
        },
        {
          rpcUrl: MASKED_SECONDARY_RPC,
          chainId: 84534,
          error: 'RPC chainId 84534 != expected 84532',
        },
      ],
    },
    status: 502,
    headers: BASE_HEADERS,
  });
  assert.deepEqual(deps.__logs, [
    ['[faucet] request', createNormalizedResult({
      logContext: {
        to: RECIPIENT,
        rpcUrl: MASKED_PRIMARY_RPC,
        rpcUrls: [MASKED_PRIMARY_RPC, MASKED_SECONDARY_RPC],
        registryChainId: 84532,
        networkChainId: 84532,
        faucetChainId: 84532,
        expectedChainId: 84532,
        amountEth: '0.0002',
        thresholdEth: '0.001',
      },
    }).logContext],
    ['[faucet] chainId mismatch', {
      rpcUrl: MASKED_PRIMARY_RPC,
      rpcChainId: 84533,
      registryChainId: 84532,
      networkChainId: 84532,
      faucetChainId: 84532,
    }],
    ['[faucet] chainId mismatch', {
      rpcUrl: MASKED_SECONDARY_RPC,
      rpcChainId: 84534,
      registryChainId: 84532,
      networkChainId: 84532,
      faucetChainId: 84532,
    }],
  ]);
});

test('faucet preserves gas price fallback to 0x3b9aca00 on successful send', async () => {
  let capturedPrivateKey = '';
  let capturedTxRequest = null;
  const rpcCalls = [];
  const deps = createDeps({
    Wallet: createWalletCtor({
      capturePrivateKey: (value) => {
        capturedPrivateKey = value;
      },
      signTransaction: async (txRequest) => {
        capturedTxRequest = txRequest;
        return '0xsigned-fallback-gas';
      },
    }),
    rpcRequest: async (value) => {
      rpcCalls.push(value);
      switch (value.method) {
        case 'eth_chainId':
          return '0x14a34';
        case 'eth_getBalance':
          return '0';
        case 'eth_getTransactionCount':
          return '0x9';
        case 'eth_gasPrice':
          throw new Error('gas price unavailable');
        case 'eth_sendRawTransaction':
          assert.deepEqual(value.params, ['0xsigned-fallback-gas']);
          return '0xtxhash-fallback-gas';
        default:
          throw new Error(`Unexpected method: ${value.method}`);
      }
    },
  });

  const result = await runFaucet(deps);

  assert.equal(capturedPrivateKey, '0xabc123');
  assert.deepEqual(capturedTxRequest, {
    to: RECIPIENT,
    value: '200',
    nonce: '0x9',
    gasLimit: '0x5208',
    gasPrice: '0x3b9aca00',
    chainId: 84532,
  });
  assert.deepEqual(result, {
    body: {
      txHash: '0xtxhash-fallback-gas',
      status: null,
      to: RECIPIENT,
      amountEth: '0.0002',
      chainId: 84532,
      rpcUrl: MASKED_PRIMARY_RPC,
    },
    status: 200,
    headers: BASE_HEADERS,
  });
  assert.deepEqual(
    rpcCalls.map(({ method }) => method),
    ['eth_chainId', 'eth_getBalance', 'eth_getTransactionCount', 'eth_gasPrice', 'eth_sendRawTransaction'],
  );
});

test('faucet preserves signTransaction failure accumulation', async () => {
  const deps = createDeps({
    Wallet: createWalletCtor({
      signTransaction: async () => {
        throw new Error('sign failed');
      },
    }),
    rpcRequest: async ({ method }) => {
      switch (method) {
        case 'eth_chainId':
          return '0x14a34';
        case 'eth_getBalance':
          return '0';
        case 'eth_getTransactionCount':
          return '0x1';
        case 'eth_gasPrice':
          return '0x5';
        default:
          throw new Error(`Unexpected method: ${method}`);
      }
    },
  });

  const result = await runFaucet(deps);

  assert.deepEqual(result, {
    body: {
      error: 'sign failed',
      rpcUrl: MASKED_PRIMARY_RPC,
      chainId: 84532,
      registryChainId: 84532,
      networkChainId: 84532,
      faucetChainId: 84532,
      attempts: [
        {
          rpcUrl: MASKED_PRIMARY_RPC,
          chainId: 84532,
          error: 'sign failed',
        },
      ],
    },
    status: 502,
    headers: BASE_HEADERS,
  });
});

test('faucet preserves send failure logging and accumulated attempts in final failure response', async () => {
  const deps = createDeps({
    rpcRequest: async ({ method }) => {
      switch (method) {
        case 'eth_chainId':
          return '0x14a34';
        case 'eth_getBalance':
          return '0';
        case 'eth_getTransactionCount':
          return '0x1';
        case 'eth_gasPrice':
          return '0x6';
        case 'eth_sendRawTransaction':
          throw new Error('send failed');
        default:
          throw new Error(`Unexpected method: ${method}`);
      }
    },
  });

  const result = await runFaucet(deps);

  assert.deepEqual(result, {
    body: {
      error: 'send failed',
      rpcUrl: MASKED_PRIMARY_RPC,
      chainId: 84532,
      registryChainId: 84532,
      networkChainId: 84532,
      faucetChainId: 84532,
      attempts: [
        {
          rpcUrl: MASKED_PRIMARY_RPC,
          chainId: 84532,
          error: 'send failed',
        },
      ],
    },
    status: 502,
    headers: BASE_HEADERS,
  });
  assert.deepEqual(deps.__logs, [
    ['[faucet] request', createNormalizedResult().logContext],
    ['[faucet] send failed', {
      rpcUrl: MASKED_PRIMARY_RPC,
      rpcChainId: 84532,
      registryChainId: 84532,
      networkChainId: 84532,
      faucetChainId: 84532,
      error: 'send failed',
    }],
  ]);
});
