import {
  buildSponsoredSbtLookupContextKey,
  deepClone,
  formatContractLabel,
  generateSessionId,
  getChainName,
  getSessionWizardErrorMessage,
  mergeDeep,
} from './sessionWizardCoreUtils';

describe('sessionWizardCoreUtils', () => {
  it('generates a formatted session id', () => {
    expect(generateSessionId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('resolves chain names and contract labels', () => {
    expect(getChainName(84532)).toMatch(/Sepolia/i);
    expect(getChainName(0)).toBe('');
    expect(formatContractLabel('sessionRegistry')).toBe('Session Registry');
    expect(formatContractLabel('custom_contractKey')).toBe('Custom Contract Key');
  });

  it('normalizes error messages while preserving fallback text for opaque objects', () => {
    expect(getSessionWizardErrorMessage(new Error('upload failed'), 'fallback')).toBe('upload failed');
    expect(getSessionWizardErrorMessage({ message: 'registry failed' }, 'fallback')).toBe('registry failed');
    expect(getSessionWizardErrorMessage({ code: 500 }, 'Failed to upload metadata.')).toBe(
      'Failed to upload metadata.',
    );
    expect(getSessionWizardErrorMessage('plain failure', 'fallback')).toBe('plain failure');
  });

  it('builds stable sponsored sbt lookup keys', () => {
    expect(
      buildSponsoredSbtLookupContextKey({
        address: '0xABC',
        slug: ' demo ',
        sessionName: ' Session ',
        networkChainId: 84532,
        contracts: { registry: '0x1' },
        registry: { chainId: 84532 },
      }),
    ).toBe(
      '{"address":"0xabc","slug":"demo","sessionName":"Session","networkChainId":84532,"contracts":{"registry":"0x1"},"registry":{"chainId":84532}}',
    );
  });

  it('deep clones and merges nested records', () => {
    const original = { nested: { a: 1 }, list: ['x'] };
    const clone = deepClone(original);
    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
    expect(clone.nested).not.toBe(original.nested);

    expect(mergeDeep({ nested: { a: 1 }, keep: true }, { nested: { b: 2 }, replace: 'yes' })).toEqual({
      nested: { a: 1, b: 2 },
      keep: true,
      replace: 'yes',
    });
  });
});
