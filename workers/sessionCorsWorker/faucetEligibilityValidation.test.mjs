import test from 'node:test';
import assert from 'node:assert/strict';

import { validateFaucetEligibilityRequest } from './faucetEligibilityValidation.js';

const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;
const REQUESTER = '0x00000000000000000000000000000000000000aa';
const OTHER = '0x00000000000000000000000000000000000000bb';
const SBT_ADDRESS = '0x0000000000000000000000000000000000000101';
const HASHED_PASSWORD = `0x${'1'.repeat(64)}`;

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const isAddress = (value) => /^0x[0-9a-fA-F]{40}$/.test(toStr(value).trim());
const isBytes32Hex = (value) => /^0x[0-9a-fA-F]{64}$/.test(toStr(value).trim());
const normalizeAddressLower = (value) => {
  const raw = toStr(value).trim();
  return isAddress(raw) ? raw.toLowerCase() : '';
};

const createDeps = (overrides = {}) => ({
  toStr,
  isAddress,
  isBytes32Hex,
  normalizeAddressLower,
  findSessionGateForSbt: async ({ sbtAddress }) => ({
    ok: true,
    resourceKey: 'txGas',
    gate: { chainId: 84532 },
    sbtAddress,
  }),
  readSbtFaucetValidationState: async () => ({
    ok: true,
    hasPasswordMint: false,
    groupPasswordHash: ZERO_BYTES32,
  }),
  validateSbtPasswordForFaucet: async () => ({
    ok: true,
    isValid: true,
  }),
  verifyGroupSignatureForFaucet: () => ({
    ok: true,
    signer: REQUESTER.toLowerCase(),
  }),
  ...overrides,
});

const constants = {
  anonymousGateUnavailableError: 'Requested resource gate is unavailable.',
  zeroBytes32: ZERO_BYTES32,
};

test('validateFaucetEligibilityRequest preserves authenticated-token fallback when faucet scope is already present', async () => {
  const result = await validateFaucetEligibilityRequest({
    payload: {
      address: REQUESTER,
    },
    config: {},
    slug: 'session-a',
    requesterAddress: REQUESTER,
    tokenHasFaucetScope: true,
    deps: createDeps(),
    constants,
  });

  assert.deepEqual(result, {
    ok: true,
    flow: 'authenticated-token',
    resourceKey: 'txGas',
  });
});

test('validateFaucetEligibilityRequest allows same-wallet requests without token scope when current txGas gate is open', async () => {
  let chainAttestationCache;
  const result = await validateFaucetEligibilityRequest({
    payload: {
      address: REQUESTER,
    },
    config: {
      registryAddress: '0x0000000000000000000000000000000000000001',
      registryChainId: 84532,
    },
    slug: 'session-open',
    requesterAddress: REQUESTER,
    tokenHasFaucetScope: false,
    deps: createDeps({
      resolveRegistryRpcUrls: () => ['https://registry.example'],
      toRegistrySessionSlug: (value) => toStr(value).trim().toLowerCase() || 'general',
      readSessionExistsOnChain: async (value) => {
        assert.equal(value.expectedChainId, 84532);
        assert.ok(value.chainAttestationCache instanceof Map);
        chainAttestationCache = value.chainAttestationCache;
        return {
          exists: true,
          rpcUrl: 'https://registry.example',
          errors: [],
        };
      },
      readResourceGateOnChain: async (value) => {
        assert.equal(value.expectedChainId, 84532);
        assert.equal(value.chainAttestationCache, chainAttestationCache);
        return {
          ok: true,
          gate: {
            sbtAddresses: [],
            chainId: 84532,
            mode: 0,
          },
          rpcUrl: 'https://registry.example',
          errors: [],
        };
      },
      resolveRpcUrlListForGate: () => ['https://rpc.example'],
      checkSbtGate: async () => false,
      maskRpcUrl: (value) => `masked:${value}`,
    }),
    constants,
  });

  assert.deepEqual(result, {
    ok: true,
    flow: 'authenticated-self-funding',
    resourceKey: 'txGas',
  });
});

test('validateFaucetEligibilityRequest denies same-wallet requests without token scope when current txGas gate fails', async () => {
  const result = await validateFaucetEligibilityRequest({
    payload: {
      address: REQUESTER,
    },
    config: {
      registryAddress: '0x0000000000000000000000000000000000000001',
      registryChainId: 84532,
    },
    slug: 'session-locked',
    requesterAddress: REQUESTER,
    tokenHasFaucetScope: false,
    deps: createDeps({
      resolveRegistryRpcUrls: () => ['https://registry.example'],
      toRegistrySessionSlug: (value) => toStr(value).trim().toLowerCase() || 'general',
      readSessionExistsOnChain: async () => ({
        exists: true,
        rpcUrl: 'https://registry.example',
        errors: [],
      }),
      readResourceGateOnChain: async () => ({
        ok: true,
        gate: {
          sbtAddresses: [SBT_ADDRESS],
          chainId: 84532,
          mode: 0,
        },
        rpcUrl: 'https://registry.example',
        errors: [],
      }),
      resolveRpcUrlListForGate: () => ['https://rpc.example'],
      checkSbtGate: async () => false,
      maskRpcUrl: (value) => `masked:${value}`,
    }),
    constants,
  });

  assert.deepEqual(result, {
    ok: false,
    status: 403,
    error: 'Access denied: txGas gate failed for this wallet.',
    reason: 'txgas-gate-denied',
  });
});

test('validateFaucetEligibilityRequest preserves proof-backed requester and recipient preconditions', async () => {
  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: REQUESTER,
        sbtAddress: SBT_ADDRESS,
      },
      config: {},
      slug: 'session-b',
      requesterAddress: '',
      tokenHasFaucetScope: false,
      deps: createDeps(),
      constants,
    }),
    {
      ok: false,
      status: 403,
      error: 'Authenticated wallet required for proof-backed faucet requests.',
    }
  );

  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        sbtAddress: SBT_ADDRESS,
      },
      config: {},
      slug: 'session-b',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: createDeps(),
      constants,
    }),
    {
      ok: false,
      status: 400,
      error: 'Missing address.',
    }
  );

  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: OTHER,
        sbtAddress: SBT_ADDRESS,
      },
      config: {},
      slug: 'session-b',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: createDeps(),
      constants,
    }),
    {
      ok: false,
      status: 403,
      error: 'Proof-backed faucet requests must fund the authenticated wallet.',
    }
  );
});

test('validateFaucetEligibilityRequest preserves missing and invalid sbtAddress failures', async () => {
  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: REQUESTER,
      },
      config: {},
      slug: 'session-c',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: createDeps(),
      constants,
    }),
    {
      ok: false,
      status: 400,
      error: 'Missing sbtAddress.',
    }
  );

  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: REQUESTER,
        sbtAddress: 'not-an-address',
      },
      config: {},
      slug: 'session-c',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: createDeps(),
      constants,
    }),
    {
      ok: false,
      status: 400,
      error: 'Invalid sbtAddress.',
    }
  );
});

test('validateFaucetEligibilityRequest preserves gate and validation-state failures', async () => {
  const gateFailure = {
    ok: false,
    status: 403,
    error: 'Requested SBT is not part of a session gate.',
    reason: 'sbt-not-gated',
  };

  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: REQUESTER,
        sbtAddress: SBT_ADDRESS,
      },
      config: {},
      slug: 'session-d',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: createDeps({
        findSessionGateForSbt: async () => gateFailure,
      }),
      constants,
    }),
    gateFailure
  );

  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: REQUESTER,
        sbtAddress: SBT_ADDRESS,
      },
      config: {},
      slug: 'session-d',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: createDeps({
        readSbtFaucetValidationState: async () => ({
          ok: false,
          errors: [{ rpcUrl: 'https://rpc.example', error: 'boom' }],
        }),
      }),
      constants,
    }),
    {
      ok: false,
      status: 403,
      error: 'Requested resource gate is unavailable.',
      reason: 'sbt-validation-unavailable',
      details: [{
        rpcUrl: 'https://rpc.example',
        status: null,
        error: 'SBT validation RPC request failed.',
      }],
    }
  );
});

test('validateFaucetEligibilityRequest preserves password-mint validation branches', async () => {
  const passwordDeps = createDeps({
    readSbtFaucetValidationState: async () => ({
      ok: true,
      hasPasswordMint: true,
      groupPasswordHash: ZERO_BYTES32,
    }),
  });

  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: REQUESTER,
        sbtAddress: SBT_ADDRESS,
      },
      config: {},
      slug: 'session-e',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: passwordDeps,
      constants,
    }),
    {
      ok: false,
      status: 400,
      error: 'Missing hashedPassword.',
    }
  );

  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: REQUESTER,
        sbtAddress: SBT_ADDRESS,
        hashedPassword: HASHED_PASSWORD,
      },
      config: {},
      slug: 'session-e',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: createDeps({
        readSbtFaucetValidationState: async () => ({
          ok: true,
          hasPasswordMint: true,
          groupPasswordHash: ZERO_BYTES32,
        }),
        validateSbtPasswordForFaucet: async () => ({
          ok: false,
          errors: [{ rpcUrl: 'https://rpc.example', error: 'bad rpc' }],
        }),
      }),
      constants,
    }),
    {
      ok: false,
      status: 403,
      error: 'Requested resource gate is unavailable.',
      reason: 'password-validation-unavailable',
      details: [{
        rpcUrl: 'https://rpc.example',
        status: null,
        error: 'SBT password validation RPC request failed.',
      }],
    }
  );

  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: REQUESTER,
        sbtAddress: SBT_ADDRESS,
        hashedPassword: HASHED_PASSWORD,
      },
      config: {},
      slug: 'session-e',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: createDeps({
        readSbtFaucetValidationState: async () => ({
          ok: true,
          hasPasswordMint: true,
          groupPasswordHash: ZERO_BYTES32,
        }),
        validateSbtPasswordForFaucet: async () => ({
          ok: true,
          isValid: false,
        }),
      }),
      constants,
    }),
    {
      ok: false,
      status: 403,
      error: 'Invalid password.',
    }
  );

  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: REQUESTER,
        sbtAddress: SBT_ADDRESS,
        hashedPassword: HASHED_PASSWORD,
      },
      config: {},
      slug: 'session-e',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: passwordDeps,
      constants,
    }),
    {
      ok: true,
      flow: 'password',
      resourceKey: 'txGas',
    }
  );
});

test('validateFaucetEligibilityRequest preserves group-signature and open-mint branches', async () => {
  const groupFailure = {
    ok: false,
    status: 400,
    error: 'Missing group signature.',
  };

  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: REQUESTER,
        sbtAddress: SBT_ADDRESS,
      },
      config: {},
      slug: 'session-f',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: createDeps({
        readSbtFaucetValidationState: async () => ({
          ok: true,
          hasPasswordMint: false,
          groupPasswordHash: HASHED_PASSWORD,
        }),
        verifyGroupSignatureForFaucet: () => groupFailure,
      }),
      constants,
    }),
    groupFailure
  );

  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: REQUESTER,
        sbtAddress: SBT_ADDRESS,
        signature: '0xsigned',
      },
      config: {},
      slug: 'session-f',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: createDeps({
        readSbtFaucetValidationState: async () => ({
          ok: true,
          hasPasswordMint: false,
          groupPasswordHash: HASHED_PASSWORD,
        }),
      }),
      constants,
    }),
    {
      ok: true,
      flow: 'group-signature',
      resourceKey: 'txGas',
    }
  );

  assert.deepEqual(
    await validateFaucetEligibilityRequest({
      payload: {
        address: REQUESTER,
        sbtAddress: SBT_ADDRESS,
      },
      config: {},
      slug: 'session-f',
      requesterAddress: REQUESTER,
      tokenHasFaucetScope: false,
      deps: createDeps({
        readSbtFaucetValidationState: async () => ({
          ok: true,
          hasPasswordMint: false,
          groupPasswordHash: ZERO_BYTES32,
        }),
      }),
      constants,
    }),
    {
      ok: true,
      flow: 'open',
      resourceKey: 'txGas',
    }
  );
});
