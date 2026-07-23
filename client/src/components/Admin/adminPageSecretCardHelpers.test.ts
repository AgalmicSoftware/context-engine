import {
  ADMIN_SECRET_CARDS,
  buildAdminSecretPresenceTargetKey,
  buildAdminSecretRemoveTestId,
  getAdminSecretCardStatus,
  getAdminSecretFieldInputType,
  getAdminSecretFieldLabel,
  getAdminSecretFieldRows,
  getAdminSecretFieldStatusLabel,
  filterAdminSecretCards,
  normalizeAdminSecretPresence,
  normalizeAdminSecretPresencePatch,
} from './adminPageSecretCardHelpers';

describe('adminPageSecretCardHelpers', () => {
  it('scopes secret-presence state to the normalized session and Worker identity', () => {
    expect(
      buildAdminSecretPresenceTargetKey({
        slug: ' Alpha Session! ',
        workerUrl: 'https://worker.example.test/admin/set-config',
      }),
    ).toBe('alphasession\nhttps://worker.example.test');
    expect(buildAdminSecretPresenceTargetKey({ slug: 'alpha', workerUrl: '' })).toBe('');
  });

  it('keeps worker secret cards and fields in their existing order', () => {
    expect(ADMIN_SECRET_CARDS).toEqual([
      { key: 'ai', label: 'AI', fields: ['openaiKey', 'anthropicKey', 'openrouterKey'] },
      { key: 'rpc', label: 'RPC', fields: ['customRpcUrl', 'customRpcKey'] },
      { key: 'arweave', label: 'Arweave', fields: ['arweaveJwk'] },
      { key: 'faucet', label: 'Faucet', fields: ['faucetPrivateKey'] },
      { key: 'lit', label: 'Lit', fields: ['litAccountApiKey', 'litUsageApiKey'] },
    ]);
  });

  it('projects only enabled secret cards while preserving canonical order', () => {
    expect(filterAdminSecretCards(['ai']).map((card) => card.key)).toEqual(['ai']);
    expect(filterAdminSecretCards(['lit', 'rpc', 'ai']).map((card) => card.key)).toEqual(['ai', 'rpc', 'lit']);
    expect(filterAdminSecretCards([])).toEqual([]);
  });

  it('preserves secret field labels, input types, rows, and remove test IDs', () => {
    expect(getAdminSecretFieldLabel('openaiKey')).toBe('OpenAI API key');
    expect(getAdminSecretFieldLabel('arweaveJwk')).toBe('Arweave JWK (JSON)');
    expect(getAdminSecretFieldLabel('unknownSecret')).toBe('unknownSecret');

    expect(getAdminSecretFieldInputType('arweaveJwk')).toBe('textarea');
    expect(getAdminSecretFieldRows('arweaveJwk')).toBe(3);
    expect(getAdminSecretFieldInputType('customRpcUrl')).toBe('text');
    expect(getAdminSecretFieldRows('customRpcUrl')).toBeUndefined();
    expect(getAdminSecretFieldInputType('customRpcKey')).toBe('password');

    expect(buildAdminSecretRemoveTestId('litAccountApiKey')).toBe('ce-admin-secret-remove-lit-account-api-key');
  });

  it('derives card status from draft, clear, and stored presence state', () => {
    const fields = ['openaiKey', 'anthropicKey'];

    expect(
      getAdminSecretCardStatus({
        fields,
        secrets: {},
        secretPresenceStatus: 'idle',
      }),
    ).toEqual({ label: 'Unknown', iconLocked: false });

    expect(
      getAdminSecretCardStatus({
        fields,
        secrets: { openaiKey: 'sk-draft' },
        secretPresenceStatus: 'loaded',
        storedSecretPresence: { openaiKey: false, anthropicKey: false },
        workerSecretsDirty: true,
      }),
    ).toEqual({ label: 'Unsaved draft', iconLocked: true });

    expect(
      getAdminSecretCardStatus({
        fields,
        secrets: {},
        clearedSecretKeys: new Set(['openaiKey']),
        secretPresenceStatus: 'loaded',
        storedSecretPresence: { openaiKey: true, anthropicKey: false },
      }),
    ).toEqual({ label: 'Will clear on save', iconLocked: true });

    expect(
      getAdminSecretCardStatus({
        fields,
        secrets: {},
        secretPresenceStatus: 'loaded',
        storedSecretPresence: { openaiKey: true, anthropicKey: false },
      }),
    ).toEqual({ label: 'Configured', iconLocked: true });

    expect(
      getAdminSecretCardStatus({
        fields,
        secrets: {},
        secretPresenceStatus: 'loaded',
        storedSecretPresence: { openaiKey: false, anthropicKey: false },
      }),
    ).toEqual({ label: 'Empty', iconLocked: false });

    expect(
      getAdminSecretCardStatus({
        fields,
        secrets: {},
        secretPresenceStatus: 'partial',
        storedSecretPresence: { openaiKey: true },
      }),
    ).toEqual({ label: 'Configured', iconLocked: true });

    expect(
      getAdminSecretCardStatus({
        fields,
        secrets: {},
        secretPresenceStatus: 'partial',
        storedSecretPresence: { openaiKey: false },
      }),
    ).toEqual({ label: 'Unknown', iconLocked: false });

    expect(
      getAdminSecretCardStatus({
        fields,
        secrets: {},
        secretPresenceStatus: 'partial',
        storedSecretPresence: { openaiKey: false, anthropicKey: false },
      }),
    ).toEqual({ label: 'Empty', iconLocked: false });
  });

  it('derives field labels without treating blank drafts as empty stored secrets', () => {
    expect(
      getAdminSecretFieldStatusLabel({
        fieldKey: 'openaiKey',
        secrets: {},
        secretPresenceStatus: 'idle',
      }),
    ).toBe('Stored status unknown');

    expect(
      getAdminSecretFieldStatusLabel({
        fieldKey: 'openaiKey',
        secrets: { openaiKey: 'sk-draft' },
        workerSecretsDirty: true,
      }),
    ).toBe('New value staged');

    expect(
      getAdminSecretFieldStatusLabel({
        fieldKey: 'openaiKey',
        secrets: {},
        clearedSecretKeys: new Set(['openaiKey']),
        secretPresenceStatus: 'loaded',
        storedSecretPresence: { openaiKey: true },
      }),
    ).toBe('Will clear on save');

    expect(
      getAdminSecretFieldStatusLabel({
        fieldKey: 'openaiKey',
        secrets: {},
        secretPresenceStatus: 'loaded',
        storedSecretPresence: { openaiKey: true },
      }),
    ).toBe('Stored in worker; hidden');

    expect(
      getAdminSecretFieldStatusLabel({
        fieldKey: 'openaiKey',
        secrets: {},
        secretPresenceStatus: 'loaded',
        storedSecretPresence: { openaiKey: false },
      }),
    ).toBe('No stored value');

    expect(
      getAdminSecretFieldStatusLabel({
        fieldKey: 'anthropicKey',
        secrets: {},
        secretPresenceStatus: 'partial',
        storedSecretPresence: { openaiKey: true },
      }),
    ).toBe('Stored status unknown');

    expect(
      getAdminSecretFieldStatusLabel({
        fieldKey: 'openaiKey',
        secrets: {},
        secretPresenceStatus: 'partial',
        storedSecretPresence: { openaiKey: true },
      }),
    ).toBe('Stored in worker; hidden');
  });

  it('normalizes allowed secret presence keys only', () => {
    expect(
      normalizeAdminSecretPresence({
        openaiKey: true,
        arweaveJwk: true,
        ignoredSecret: true,
      }),
    ).toEqual({
      openaiKey: true,
      anthropicKey: false,
      openrouterKey: false,
      customRpcUrl: false,
      customRpcKey: false,
      arweaveJwk: true,
      faucetPrivateKey: false,
      litAccountApiKey: false,
      litUsageApiKey: false,
    });

    expect(
      normalizeAdminSecretPresencePatch({
        openaiKey: 'sk-test',
        anthropicKey: '',
        ignoredSecret: true,
        litUsageApiKey: false,
      }),
    ).toEqual({
      openaiKey: true,
      anthropicKey: false,
      litUsageApiKey: false,
    });
  });
});
