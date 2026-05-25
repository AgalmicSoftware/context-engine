import {
  ADMIN_SECRET_CARDS,
  buildAdminSecretRemoveTestId,
  getAdminSecretFieldInputType,
  getAdminSecretFieldLabel,
  getAdminSecretFieldRows,
} from './adminPageSecretCardHelpers';

describe('adminPageSecretCardHelpers', () => {
  it('keeps worker secret cards and fields in their existing order', () => {
    expect(ADMIN_SECRET_CARDS).toEqual([
      { key: 'ai', label: 'AI', fields: ['openaiKey', 'anthropicKey', 'openrouterKey'] },
      { key: 'rpc', label: 'RPC', fields: ['customRpcUrl', 'customRpcKey'] },
      { key: 'arweave', label: 'Arweave', fields: ['arweaveJwk'] },
      { key: 'faucet', label: 'Faucet', fields: ['faucetPrivateKey'] },
      { key: 'lit', label: 'Lit', fields: ['litAccountApiKey', 'litUsageApiKey'] },
    ]);
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

    expect(buildAdminSecretRemoveTestId('litAccountApiKey')).toBe(
      'ce-admin-secret-remove-lit-account-api-key'
    );
  });
});
