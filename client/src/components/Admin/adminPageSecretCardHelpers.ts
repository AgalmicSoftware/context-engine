export type AdminSecretCard = {
  key: string;
  label: string;
  fields: readonly string[];
};

export const ADMIN_SECRET_CARDS: readonly AdminSecretCard[] = Object.freeze([
  { key: 'ai', label: 'AI', fields: ['openaiKey', 'anthropicKey', 'openrouterKey'] },
  { key: 'rpc', label: 'RPC', fields: ['customRpcUrl', 'customRpcKey'] },
  { key: 'arweave', label: 'Arweave', fields: ['arweaveJwk'] },
  { key: 'faucet', label: 'Faucet', fields: ['faucetPrivateKey'] },
  { key: 'lit', label: 'Lit', fields: ['litAccountApiKey', 'litUsageApiKey'] },
]);

const ADMIN_SECRET_FIELD_LABELS: Record<string, string> = Object.freeze({
  openaiKey: 'OpenAI API key',
  anthropicKey: 'Anthropic API key',
  openrouterKey: 'OpenRouter API key',
  customRpcUrl: 'Custom RPC URL',
  customRpcKey: 'Custom RPC key',
  arweaveJwk: 'Arweave JWK (JSON)',
  faucetPrivateKey: 'Faucet private key',
  litAccountApiKey: 'Lit account API key',
  litUsageApiKey: 'Lit usage API key',
});

export const getAdminSecretFieldLabel = (fieldKey: unknown): string => {
  const key = String(fieldKey);
  return ADMIN_SECRET_FIELD_LABELS[key] || key;
};

export const getAdminSecretFieldInputType = (fieldKey: unknown): 'password' | 'text' | 'textarea' => {
  const key = String(fieldKey);
  if (key === 'arweaveJwk') return 'textarea';
  if (key === 'customRpcUrl') return 'text';
  return 'password';
};

export const getAdminSecretFieldRows = (fieldKey: unknown): number | undefined => (
  getAdminSecretFieldInputType(fieldKey) === 'textarea' ? 3 : undefined
);

export const buildAdminSecretRemoveTestId = (fieldKey: unknown): string => (
  `ce-admin-secret-remove-${String(fieldKey).replace(/([A-Z])/g, '-$1').toLowerCase()}`
);
