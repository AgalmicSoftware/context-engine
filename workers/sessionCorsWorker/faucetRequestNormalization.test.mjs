import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeFaucetRequest } from './faucetRequestNormalization.js';
import { toChainId } from './chainIdNormalization.js';

const DEFAULTS = {
  defaultRpcUrl: 'https://default-rpc.example',
  defaultAmountEth: '0.0002',
  defaultThresholdEth: '0.001',
};

const parseEtherToWei = (value) => {
  const text = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error('invalid eth string');
  }
  const [whole, fraction = ''] = text.split('.');
  const normalizedFraction = `${fraction}000000000000000000`.slice(0, 18);
  return (BigInt(whole) * 10n ** 18n) + BigInt(normalizedFraction);
};

const deps = {
  toStr: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
  toChainId: (value) => {
    try {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    } catch {
      return 0;
    }
  },
  toBigInt: (value) => {
    if (typeof value === 'bigint') return value;
    return BigInt(String(value));
  },
  isAddress: (value) => /^0x[a-fA-F0-9]{40}$/.test(String(value).trim()),
  parseEther: parseEtherToWei,
  resolveFaucetRpcUrls: (config, faucetCfg) => {
    const urls = Array.isArray(faucetCfg?.rpcUrls)
      ? faucetCfg.rpcUrls
      : faucetCfg?.rpcUrl
        ? [faucetCfg.rpcUrl]
        : config?.rpcUrl
          ? [config.rpcUrl]
          : [];
    return urls.map((value) => String(value).trim()).filter(Boolean);
  },
  maskRpcUrl: (value) => `masked:${String(value).trim()}`,
};

test('normalizeFaucetRequest preserves address aliases plus RPC, chain, and smaller-amount selection', () => {
  const result = normalizeFaucetRequest({
    payload: {
      recipient: ' 0x1111111111111111111111111111111111111111 ',
      amount: '0.0003',
    },
    config: {
      registryChainId: '84531',
      networkChainId: '84532',
      rpcUrl: 'https://network-rpc.example',
      faucet: {
        chainId: '84533',
        rpcUrl: 'https://faucet-rpc.example',
        amountEth: '0.0005',
        balanceThresholdEth: '0.0025',
      },
    },
    secrets: {
      faucetPrivateKey: ' 0xabc123 ',
    },
    deps,
    defaults: DEFAULTS,
  });

  assert.equal(result.ok, true);
  assert.equal(result.error, '');
  assert.deepEqual(result.logContext, {
    to: '0x1111111111111111111111111111111111111111',
    rpcUrl: 'masked:https://faucet-rpc.example',
    rpcUrls: ['masked:https://faucet-rpc.example'],
    registryChainId: 84531,
    networkChainId: 84532,
    faucetChainId: 84533,
    expectedChainId: 84533,
    amountEth: '0.0003',
    thresholdEth: '0.0025',
  });
  assert.deepEqual(result.normalized, {
    to: '0x1111111111111111111111111111111111111111',
    faucetCfg: {
      chainId: '84533',
      rpcUrl: 'https://faucet-rpc.example',
      amountEth: '0.0005',
      balanceThresholdEth: '0.0025',
    },
    rpcUrls: ['https://faucet-rpc.example'],
    primaryRpc: 'https://faucet-rpc.example',
    rpcMasked: 'masked:https://faucet-rpc.example',
    rpcUrlsMasked: ['masked:https://faucet-rpc.example'],
    registryChainId: 84531,
    networkChainId: 84532,
    faucetChainId: 84533,
    expectedChainId: 84533,
    configuredAmount: '0.0005',
    amountEth: '0.0003',
    amountWei: parseEtherToWei('0.0003'),
    thresholdEth: '0.0025',
    thresholdWei: parseEtherToWei('0.0025'),
    privateKey: '0xabc123',
  });
});

test('normalizeFaucetRequest preserves missing and invalid address failures', () => {
  assert.deepEqual(
    normalizeFaucetRequest({
      payload: {},
      config: {},
      secrets: {},
      deps,
      defaults: DEFAULTS,
    }),
    {
      ok: false,
      status: 400,
      error: 'Missing address',
      normalized: null,
      logContext: null,
    }
  );

  assert.deepEqual(
    normalizeFaucetRequest({
      payload: { address: 'not-an-address' },
      config: {},
      secrets: {},
      deps,
      defaults: DEFAULTS,
    }),
    {
      ok: false,
      status: 400,
      error: 'Invalid address',
      normalized: null,
      logContext: null,
    }
  );
});

test('normalizeFaucetRequest ignores malformed and oversized requested amount overrides', () => {
  const baseConfig = {
    faucet: {
      amountEth: '0.0005',
    },
  };
  const baseSecrets = {
    faucetPrivateKey: '0xabc123',
  };

  const malformed = normalizeFaucetRequest({
    payload: {
      to: '0x1111111111111111111111111111111111111111',
      amountEth: 'bad-value',
    },
    config: baseConfig,
    secrets: baseSecrets,
    deps,
    defaults: DEFAULTS,
  });
  assert.equal(malformed.ok, true);
  assert.equal(malformed.normalized.amountEth, '0.0005');
  assert.equal(malformed.normalized.amountWei, parseEtherToWei('0.0005'));

  const oversized = normalizeFaucetRequest({
    payload: {
      to: '0x1111111111111111111111111111111111111111',
      amount: '0.0006',
    },
    config: baseConfig,
    secrets: baseSecrets,
    deps,
    defaults: DEFAULTS,
  });
  assert.equal(oversized.ok, true);
  assert.equal(oversized.normalized.amountEth, '0.0005');
  assert.equal(oversized.normalized.amountWei, parseEtherToWei('0.0005'));
});

test('normalizeFaucetRequest preserves invalid threshold and amount failures', () => {
  const thresholdFailure = normalizeFaucetRequest({
    payload: {
      to: '0x1111111111111111111111111111111111111111',
    },
    config: {
      faucet: {
        balanceThresholdEth: 'bad-threshold',
      },
    },
    secrets: {
      faucetPrivateKey: '0xabc123',
    },
    deps,
    defaults: DEFAULTS,
  });
  assert.equal(thresholdFailure.ok, false);
  assert.equal(thresholdFailure.status, 500);
  assert.equal(thresholdFailure.error, 'Invalid faucet balance threshold (expected ETH string).');
  assert.deepEqual(thresholdFailure.logContext, {
    to: '0x1111111111111111111111111111111111111111',
    rpcUrl: 'masked:https://default-rpc.example',
    rpcUrls: [],
    registryChainId: 0,
    networkChainId: 0,
    faucetChainId: 0,
    expectedChainId: 0,
    amountEth: '0.0002',
    thresholdEth: 'bad-threshold',
  });

  const amountFailure = normalizeFaucetRequest({
    payload: {
      to: '0x1111111111111111111111111111111111111111',
    },
    config: {
      faucet: {
        amountEth: 'bad-amount',
      },
    },
    secrets: {
      faucetPrivateKey: '0xabc123',
    },
    deps,
    defaults: DEFAULTS,
  });
  assert.equal(amountFailure.ok, false);
  assert.equal(amountFailure.status, 500);
  assert.equal(amountFailure.error, 'Invalid faucet amount (expected ETH string).');
  assert.deepEqual(amountFailure.logContext, {
    to: '0x1111111111111111111111111111111111111111',
    rpcUrl: 'masked:https://default-rpc.example',
    rpcUrls: [],
    registryChainId: 0,
    networkChainId: 0,
    faucetChainId: 0,
    expectedChainId: 0,
    amountEth: 'bad-amount',
    thresholdEth: '0.001',
  });
});

test('normalizeFaucetRequest preserves missing private key preflight failure', () => {
  const result = normalizeFaucetRequest({
    payload: {
      to: '0x1111111111111111111111111111111111111111',
    },
    config: {},
    secrets: {},
    deps,
    defaults: DEFAULTS,
  });

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    error: 'Server misconfigured: faucetPrivateKey is missing.',
    normalized: null,
    logContext: {
      to: '0x1111111111111111111111111111111111111111',
      rpcUrl: 'masked:https://default-rpc.example',
      rpcUrls: [],
      registryChainId: 0,
      networkChainId: 0,
      faucetChainId: 0,
      expectedChainId: 0,
      amountEth: '0.0002',
      thresholdEth: '0.001',
    },
  });
});

test('normalizeFaucetRequest does not let malformed explicit chain ids fall through to another authority chain', () => {
  const base = {
    payload: { to: '0x1111111111111111111111111111111111111111' },
    secrets: { faucetPrivateKey: '0xabc123' },
    deps: { ...deps, toChainId },
    defaults: DEFAULTS,
  };

  const malformedFaucet = normalizeFaucetRequest({
    ...base,
    config: {
      registryChainId: 8453,
      networkChainId: 84532,
      faucet: { chainId: '3.1337e4' },
    },
  });
  assert.equal(malformedFaucet.ok, true);
  assert.equal(malformedFaucet.normalized.expectedChainId, 0);

  const malformedNetwork = normalizeFaucetRequest({
    ...base,
    config: {
      registryChainId: 8453,
      networkChainId: false,
      faucet: {},
    },
  });
  assert.equal(malformedNetwork.ok, true);
  assert.equal(malformedNetwork.normalized.expectedChainId, 0);

  for (const faucetChainId of [undefined, 0, '0x0']) {
    const legacyFallback = normalizeFaucetRequest({
      ...base,
      config: {
        registryChainId: 8453,
        networkChainId: 84532,
        faucet: { chainId: faucetChainId },
      },
    });
    assert.equal(legacyFallback.ok, true);
    assert.equal(legacyFallback.normalized.expectedChainId, 84532);
  }
});
