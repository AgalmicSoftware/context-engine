import { ethers } from 'ethers';
import * as clientPolicy from './litChipotlePolicy.js';
import * as workerPolicy from '../../../../workers/sessionCorsWorker/litChipotlePolicyCore.mjs';
import { DEFAULT_CHIPOTLE_ACTION_CODE } from './litChipotleCatalog';

// Three copies canonicalize and fingerprint Chipotle policies: this client
// module, the session Worker core (ethers v6) and the Lit action code. Wrapped
// keys carry the fingerprint, so any drift locks people out of their data.
const actionPolicy = new Function(
  'ethers',
  `${DEFAULT_CHIPOTLE_ACTION_CODE}\nreturn { buildPolicy, fingerprintPolicy, parseWrappedPlaintext, stableStringify };`,
)(ethers);

const SBT_A = ethers.utils.getAddress('0x00000000000000000000000000000000000000aa');
const SBT_B = '0x00000000000000000000000000000000000000bb';
const CEK_HEX = `0x${'Ab'.repeat(32)}`;

const POLICIES = [
  {
    chainId: 11155420,
    gateMode: 'any',
    sbtAddresses: [SBT_A],
    litActionCid: 'bafybeiactioncid',
    litPkpId: 'pkp-session-key',
  },
  {
    chainId: '84532',
    gateMode: 'ALL',
    sbtAddresses: [SBT_B, SBT_A.toLowerCase(), SBT_B.toUpperCase().replace('0X', '0x'), ''],
    litActionCid: '  bafybeiothercid  ',
    litPkpId: ' pkp-é-👋 ',
  },
  {
    chainId: 10,
    gateMode: 'some',
    sbtAddresses: SBT_B,
    litActionCid: 'cid-"quoted"\\path',
    litPkpId: 'pkp',
    version: 'ignored',
    extra: { nested: true },
  },
];

describe('Chipotle policy parity across client, Worker and Lit action', () => {
  it.each(POLICIES.map((policy, index) => [index, policy]))(
    'canonicalizes and fingerprints policy %i identically',
    (_index, policy) => {
      const canonical = clientPolicy.buildLitChipotlePolicy(policy);
      const fingerprint = clientPolicy.fingerprintLitChipotlePolicy(policy);

      expect(workerPolicy.buildLitChipotlePolicy(policy)).toEqual(canonical);
      expect(actionPolicy.buildPolicy(policy)).toEqual(canonical);
      expect(workerPolicy.stableChipotleStringify(canonical)).toBe(clientPolicy.stableChipotleStringify(canonical));
      expect(actionPolicy.stableStringify(canonical)).toBe(clientPolicy.stableChipotleStringify(canonical));
      expect(workerPolicy.fingerprintLitChipotlePolicy(policy)).toBe(fingerprint);
      expect(actionPolicy.fingerprintPolicy(policy)).toBe(fingerprint);

      const wrapped = clientPolicy.buildLitChipotleWrappedPlaintext({ cekHex: CEK_HEX, policy });
      expect(workerPolicy.buildLitChipotleWrappedPlaintext({ cekHex: CEK_HEX, policy })).toEqual(wrapped);
      const message = JSON.stringify(wrapped);
      expect(workerPolicy.parseLitChipotleWrappedPlaintext(message)).toEqual(
        clientPolicy.parseLitChipotleWrappedPlaintext(message),
      );
      expect(actionPolicy.parseWrappedPlaintext(message)).toEqual({
        cekHex: wrapped.cekHex,
        policyFingerprint: fingerprint,
        policy: canonical,
      });
    },
  );

  it('keeps the shipped canonical form and fingerprint for an existing policy', () => {
    const canonicalJson =
      '{"chainId":11155420,"gateMode":"any","litActionCid":"bafybeiactioncid","litPkpId":"pkp-session-key",' +
      '"sbtAddresses":["0x00000000000000000000000000000000000000aa"],"version":"chipotle-sbt-v2"}';
    const policy = clientPolicy.buildLitChipotlePolicy(POLICIES[0]);

    expect(clientPolicy.stableChipotleStringify(policy)).toBe(canonicalJson);
    expect(clientPolicy.fingerprintLitChipotlePolicy(policy)).toBe(
      '0x59ba0db5f7e4e12a7649800c25e91fb07fed33408486c5cf0eff6c6433f584ea',
    );
  });

  it.each([
    ['a missing chain', { chainId: 0 }],
    ['an invalid SBT address', { sbtAddresses: ['0x1234'] }],
    ['no SBT addresses', { sbtAddresses: [] }],
    ['a missing Lit Action CID', { litActionCid: ' ' }],
    ['a missing PKP ID', { litPkpId: '' }],
  ])('rejects a policy with %s in every copy', (_label, overrides) => {
    const policy = { ...POLICIES[0], ...overrides };
    expect(() => clientPolicy.buildLitChipotlePolicy(policy)).toThrow();
    expect(() => workerPolicy.buildLitChipotlePolicy(policy)).toThrow();
    expect(() => actionPolicy.buildPolicy(policy)).toThrow();
  });
});
