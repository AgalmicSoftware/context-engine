import { canonicalizeSessionWizardJson, fingerprintSessionWizardJson } from './sessionWizardCanonicalJson';

describe('sessionWizardCanonicalJson', () => {
  const unordered = {
    z: undefined,
    b: { d: 2, c: 1 },
    a: ['é', { y: 2, x: 1 }],
  };

  it('recursively sorts object keys while preserving arrays and omitting undefined fields', () => {
    expect(canonicalizeSessionWizardJson(unordered)).toEqual({
      a: ['é', { x: 1, y: 2 }],
      b: { c: 1, d: 2 },
    });
  });

  it('preserves the established namespaced CryptoJS fingerprint', () => {
    expect(fingerprintSessionWizardJson('context-engine:test:v1', unordered)).toBe(
      '03b4643039c4a20535c7199ad6c0ed2d735941d979c3f14da36a2eb56483d50d',
    );
  });
});
