import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveFaucetEligibilityAuthority } from './faucetEligibilityAuthority.js';

const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;
const REQUESTER = '0x00000000000000000000000000000000000000aa';
const SBT_ADDRESS = '0x0000000000000000000000000000000000000101';
const HASHED_PASSWORD = `0x${'1'.repeat(64)}`;

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const isBytes32Hex = (value) => /^0x[0-9a-fA-F]{64}$/.test(toStr(value).trim());

const createDeps = (overrides = {}) => ({
  toStr,
  isBytes32Hex,
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

const createRequest = (overrides = {}) => ({
  payload: {},
  config: {},
  slug: 'session-a',
  recipientAddress: REQUESTER.toLowerCase(),
  sbtAddress: SBT_ADDRESS,
  deps: createDeps(),
  constants,
  ...overrides,
});

test('resolveFaucetEligibilityAuthority preserves session-gate lookup failures', async () => {
  const gateFailure = {
    ok: false,
    status: 403,
    error: 'Requested SBT is not part of a session gate.',
    reason: 'sbt-not-gated',
  };

  const result = await resolveFaucetEligibilityAuthority(createRequest({
    deps: createDeps({
      findSessionGateForSbt: async () => gateFailure,
    }),
  }));

  assert.deepEqual(result, gateFailure);
});

test('resolveFaucetEligibilityAuthority preserves validation-state fail-closed behavior', async () => {
  const result = await resolveFaucetEligibilityAuthority(createRequest({
    deps: createDeps({
      readSbtFaucetValidationState: async () => ({
        ok: false,
        errors: [{ rpcUrl: 'https://rpc.example', error: 'boom' }],
      }),
    }),
  }));

  assert.deepEqual(result, {
    ok: false,
    status: 403,
    error: 'Requested resource gate is unavailable.',
    reason: 'sbt-validation-unavailable',
    details: [{ rpcUrl: 'https://rpc.example', error: 'boom' }],
  });
});

test('resolveFaucetEligibilityAuthority preserves password-mint authority branches', async () => {
  const passwordDeps = createDeps({
    readSbtFaucetValidationState: async () => ({
      ok: true,
      hasPasswordMint: true,
      groupPasswordHash: ZERO_BYTES32,
    }),
  });

  assert.deepEqual(
    await resolveFaucetEligibilityAuthority(createRequest({
      deps: passwordDeps,
    })),
    {
      ok: false,
      status: 400,
      error: 'Missing hashedPassword.',
    }
  );

  assert.deepEqual(
    await resolveFaucetEligibilityAuthority(createRequest({
      payload: { hashedPassword: HASHED_PASSWORD },
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
    })),
    {
      ok: false,
      status: 403,
      error: 'Requested resource gate is unavailable.',
      reason: 'password-validation-unavailable',
      details: [{ rpcUrl: 'https://rpc.example', error: 'bad rpc' }],
    }
  );

  assert.deepEqual(
    await resolveFaucetEligibilityAuthority(createRequest({
      payload: { hashedPassword: HASHED_PASSWORD },
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
    })),
    {
      ok: false,
      status: 403,
      error: 'Invalid password.',
    }
  );

  assert.deepEqual(
    await resolveFaucetEligibilityAuthority(createRequest({
      payload: { hashedPassword: HASHED_PASSWORD },
      deps: passwordDeps,
    })),
    {
      ok: true,
      flow: 'password',
      resourceKey: 'txGas',
    }
  );
});

test('resolveFaucetEligibilityAuthority preserves group-signature and open authority branches', async () => {
  const groupFailure = {
    ok: false,
    status: 400,
    error: 'Missing group signature.',
  };
  const groupCalls = [];

  assert.deepEqual(
    await resolveFaucetEligibilityAuthority(createRequest({
      deps: createDeps({
        readSbtFaucetValidationState: async () => ({
          ok: true,
          hasPasswordMint: false,
          groupPasswordHash: HASHED_PASSWORD,
        }),
        verifyGroupSignatureForFaucet: (value) => {
          groupCalls.push(value);
          return groupFailure;
        },
      }),
    })),
    groupFailure
  );

  assert.deepEqual(groupCalls, [{
    sbtAddress: SBT_ADDRESS,
    recipientAddress: REQUESTER.toLowerCase(),
    signature: undefined,
    expectedGroupPasswordHash: HASHED_PASSWORD,
  }]);

  assert.deepEqual(
    await resolveFaucetEligibilityAuthority(createRequest({
      payload: { signature: '0xsigned' },
      deps: createDeps({
        readSbtFaucetValidationState: async () => ({
          ok: true,
          hasPasswordMint: false,
          groupPasswordHash: HASHED_PASSWORD,
        }),
      }),
    })),
    {
      ok: true,
      flow: 'group-signature',
      resourceKey: 'txGas',
    }
  );

  assert.deepEqual(
    await resolveFaucetEligibilityAuthority(createRequest()),
    {
      ok: true,
      flow: 'open',
      resourceKey: 'txGas',
    }
  );
});
