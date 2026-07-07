import {
  areSbtSelectionsEqual,
  buildDefaultGateState,
  buildEmptyProvisionedSponsoredContext,
  buildEncryptionGate,
  buildResourceGateMap,
  getNextGateIndex,
  getOnChainFieldKeyForPath,
  getValueAtPath,
  isSecretFieldPath,
  parseListInput,
  resolveSessionWizardSelectorSourceConfig,
  setValueAtPath,
} from './sessionWizardGateUtils';

describe('sessionWizardGateUtils', () => {
  it('builds default gate state and resource mappings', () => {
    expect(buildDefaultGateState(84532)).toEqual(
      expect.objectContaining({
        default: {
          sbts: [],
          mode: 'all',
          chainId: 84532,
          perMemberLimit: '',
        },
        lit: {
          sbts: [],
          mode: 'all',
          chainId: 84532,
          perMemberLimit: '',
        },
      }),
    );

    expect(buildResourceGateMap([{ id: 'gate-3' }], 'gate-1')).toEqual(
      expect.objectContaining({
        default: 'gate-1',
        ai: 'gate-1',
        lit: 'gate-1',
      }),
    );
  });

  it('compares SBT selections and nested path helpers', () => {
    expect(
      areSbtSelectionsEqual([{ address: '0xABC' }, { address: '0xDEF' }], [{ address: '0xdef' }, { address: '0xabc' }]),
    ).toBe(true);

    const value: { ai: { models: Record<string, { provider: string }> } } = {
      ai: { models: { fast: { provider: 'openai' } } },
    };
    expect(getValueAtPath(value, ['ai', 'models', 'fast', 'provider'])).toBe('openai');
    setValueAtPath(value, ['ai', 'models', 'thinking', 'provider'], 'anthropic');
    expect(value.ai.models.thinking.provider).toBe('anthropic');
  });

  it('resolves on-chain keys, secret paths, lists, and gate numbering', () => {
    expect(getOnChainFieldKeyForPath(['corsWorkerUrl'])).toBe('corsWorkerUrl');
    expect(isSecretFieldPath(['arweave', 'encryptedJwk'])).toBe(true);
    expect(isSecretFieldPath(['sessionName'])).toBe(false);
    expect(parseListInput('alpha\n\nbeta\n gamma ')).toEqual(['alpha', 'beta', 'gamma']);
    expect(getNextGateIndex([{ id: 'gate-1' }, { id: 'gate-3' }])).toBe(1);
    expect(buildEncryptionGate(2)).toEqual(
      expect.objectContaining({
        id: 'gate-3',
        label: expect.stringMatching(/access rule/i),
        type: 'sbt',
        mode: 'all',
      }),
    );
  });

  it('builds an empty sponsored context and resolves selector source config fallbacks', () => {
    expect(buildEmptyProvisionedSponsoredContext()).toEqual({
      sessionSlug: '',
      workerUrl: '',
      fields: expect.any(Object),
    });

    expect(
      resolveSessionWizardSelectorSourceConfig({
        activeSessionSlug: 'demo',
        registryChainId: 84532,
        resolveStrictConfig: () => null,
        resolveDisplayConfig: (slug) =>
          slug === ''
            ? { slug: '', networkChainId: 84532, contracts: { sessionRegistry: { address: '0x123' } } }
            : null,
      }),
    ).toEqual(
      expect.objectContaining({
        slug: 'demo',
        networkChainId: 84532,
        contracts: { sessionRegistry: { address: '0x123' } },
      }),
    );
  });
});
