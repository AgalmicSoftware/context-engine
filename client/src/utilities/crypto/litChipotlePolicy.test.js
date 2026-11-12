const {
  CHIPOTLE_POLICY_VERSION,
  CHIPOTLE_WRAPPED_KEY_VERSION,
  buildLitChipotlePolicy,
  buildLitChipotleWrappedPlaintext,
  fingerprintLitChipotlePolicy,
  normalizeChipotleCekHex,
  normalizeChipotleChainId,
  normalizeChipotleGateMode,
  normalizeChipotleSbtAddresses,
  normalizeLitChipotleMetadataVersion,
  stableChipotleStringify,
} = require('./litChipotlePolicy.js');
const { ethers } = require('ethers');
const { DEFAULT_CHIPOTLE_ACTION_CODE } = require('./litChipotleCatalog');

// Wrapped keys are parsed only inside the Lit action, so test its parser.
const parseWrappedPlaintext = new Function('ethers', `${DEFAULT_CHIPOTLE_ACTION_CODE}\nreturn parseWrappedPlaintext;`)(
  ethers,
);
const parseWrapped = (value) => parseWrappedPlaintext(JSON.stringify(value));

const SBT_A = '0x00000000000000000000000000000000000000aa';
const SBT_B = '0x00000000000000000000000000000000000000bb';
const LIT_ACTION_CID = 'bafybeiactioncid';
const LIT_PKP_ID = 'pkp-session-key';
const CEK_HEX = `0x${'ab'.repeat(32)}`;

const makePolicyInput = (overrides = {}) => ({
  chainId: '11155420',
  gateMode: 'ALL',
  sbtAddresses: [SBT_B, SBT_A, SBT_B],
  litActionCid: ` ${LIT_ACTION_CID} `,
  litPkpId: ` ${LIT_PKP_ID} `,
  ...overrides,
});

describe('litChipotlePolicy helpers', () => {
  it('normalizes supported v2 policy inputs without mutating caller-owned objects', () => {
    const input = makePolicyInput();
    const original = JSON.parse(JSON.stringify(input));

    const policy = buildLitChipotlePolicy(input);

    expect(input).toEqual(original);
    expect(policy).toEqual({
      version: CHIPOTLE_POLICY_VERSION,
      chainId: 11155420,
      gateMode: 'all',
      sbtAddresses: [SBT_A, SBT_B],
      litActionCid: LIT_ACTION_CID,
      litPkpId: LIT_PKP_ID,
    });
    expect(normalizeChipotleGateMode('all')).toBe('all');
    expect(normalizeChipotleGateMode('')).toBe('any');
    expect(normalizeChipotleChainId('11155420')).toBe(11155420);
    expect(normalizeChipotleSbtAddresses([SBT_B, SBT_A, SBT_B])).toEqual([SBT_A, SBT_B]);
  });

  it('binds wrapped CEK payloads to the canonical policy fingerprint', () => {
    const policyInput = makePolicyInput();
    const original = JSON.parse(JSON.stringify(policyInput));
    const wrapped = buildLitChipotleWrappedPlaintext({
      cekHex: `0x${'AB'.repeat(32)}`,
      policy: policyInput,
    });
    const expectedPolicy = buildLitChipotlePolicy(policyInput);
    const expectedFingerprint = fingerprintLitChipotlePolicy({
      litPkpId: LIT_PKP_ID,
      litActionCid: LIT_ACTION_CID,
      sbtAddresses: [SBT_A, SBT_B],
      gateMode: 'all',
      chainId: 11155420,
    });

    expect(policyInput).toEqual(original);
    expect(wrapped).toEqual({
      v: CHIPOTLE_WRAPPED_KEY_VERSION,
      cekHex: CEK_HEX,
      policyFingerprint: expectedFingerprint,
      policy: expectedPolicy,
    });
    expect(fingerprintLitChipotlePolicy(expectedPolicy)).toBe(expectedFingerprint);
    expect(
      stableChipotleStringify({
        b: 2,
        a: { d: 4, c: 3 },
      }),
    ).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  it('parses a v2 wrapped key in the Lit action', () => {
    const wrapped = buildLitChipotleWrappedPlaintext({
      cekHex: CEK_HEX,
      policy: makePolicyInput(),
    });

    expect(parseWrapped(wrapped)).toEqual({
      cekHex: wrapped.cekHex,
      policyFingerprint: wrapped.policyFingerprint,
      policy: wrapped.policy,
    });
    expect(normalizeLitChipotleMetadataVersion({ version: 2 })).toBe(2);
    expect(normalizeLitChipotleMetadataVersion({ v: '2' })).toBe(2);
    expect(normalizeLitChipotleMetadataVersion(null)).toBe(0);
  });

  it('rejects legacy and bare wrapped-key formats', () => {
    const wrapped = buildLitChipotleWrappedPlaintext({
      cekHex: CEK_HEX,
      policy: makePolicyInput(),
    });

    expect(() => parseWrapped({ ...wrapped, v: 1 })).toThrow('Lit Chipotle legacy wrapped keys are not supported.');
    expect(() => parseWrapped({ cekHex: CEK_HEX })).toThrow('Lit Chipotle legacy wrapped keys are not supported.');
    expect(() => parseWrapped(null)).toThrow('Lit Chipotle legacy wrapped keys are not supported.');
    expect(() => parseWrappedPlaintext(CEK_HEX)).toThrow('Lit Chipotle legacy wrapped keys are not supported.');
    expect(() => parseWrapped({ ...wrapped, cekHex: '0x1234' })).toThrow('Lit Chipotle wrapped key CEK is invalid.');
  });

  it('rejects malformed policies, CEKs, and fingerprint mismatches', () => {
    const wrapped = buildLitChipotleWrappedPlaintext({
      cekHex: CEK_HEX,
      policy: makePolicyInput(),
    });

    expect(() => buildLitChipotlePolicy(makePolicyInput({ chainId: 0 }))).toThrow(
      'Lit Chipotle policy requires a chain ID.',
    );
    expect(() => buildLitChipotlePolicy(makePolicyInput({ sbtAddresses: [] }))).toThrow(
      'Lit Chipotle policy requires at least one SBT address.',
    );
    expect(() => buildLitChipotlePolicy(makePolicyInput({ sbtAddresses: ['not-an-address'] }))).toThrow(
      'Lit Chipotle policy contains an invalid SBT address.',
    );
    expect(() => buildLitChipotlePolicy(makePolicyInput({ litActionCid: '' }))).toThrow(
      'Lit Chipotle policy requires a Lit Action CID.',
    );
    expect(() => buildLitChipotlePolicy(makePolicyInput({ litPkpId: '' }))).toThrow(
      'Lit Chipotle policy requires a Lit PKP ID.',
    );
    expect(() => normalizeChipotleCekHex('0x1234')).toThrow('Lit Chipotle CEK must be a 32-byte hex string.');
    expect(() => parseWrapped({ ...wrapped, policyFingerprint: `0x${'00'.repeat(32)}` })).toThrow(
      'Lit Chipotle wrapped key policy fingerprint mismatch.',
    );
    expect(() => parseWrappedPlaintext('')).toThrow('Lit Chipotle legacy wrapped keys are not supported.');
  });
});
