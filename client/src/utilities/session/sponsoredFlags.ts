import { toStr } from '../shared/primitives.js';

export const SPONSORED_FIELD_KEYS = Object.freeze({
  ai: 'sponsored_ai',
  rpc: 'sponsored_rpc',
  faucet: 'sponsored_faucet',
  arweave: 'sponsored_arweave',
  lit: 'sponsored_lit',
  transcribe: 'sponsored_transcribe',
} as const);

type SponsoredFieldKey = (typeof SPONSORED_FIELD_KEYS)[keyof typeof SPONSORED_FIELD_KEYS];
type SponsoredFieldSnapshot = Record<SponsoredFieldKey, '0' | '1'>;
type LooseRecord = Record<string, unknown>;

type BuildSponsoredFlagFieldsOptions = {
  secrets?: LooseRecord;
  fallbackFields?: LooseRecord;
  workerSecretsEnabled?: boolean;
  includeCustomRpcInAi?: boolean;
};

const createEmptySponsoredFieldSnapshot = (): SponsoredFieldSnapshot =>
  ({
    [SPONSORED_FIELD_KEYS.ai]: '0',
    [SPONSORED_FIELD_KEYS.rpc]: '0',
    [SPONSORED_FIELD_KEYS.faucet]: '0',
    [SPONSORED_FIELD_KEYS.arweave]: '0',
    [SPONSORED_FIELD_KEYS.lit]: '0',
    [SPONSORED_FIELD_KEYS.transcribe]: '0',
  }) as SponsoredFieldSnapshot;

export const normalizeSponsoredFieldSnapshot = (value: LooseRecord = {}): SponsoredFieldSnapshot => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return (Object.values(SPONSORED_FIELD_KEYS) as SponsoredFieldKey[]).reduce((acc, fieldKey) => {
    acc[fieldKey] = toStr(value?.[fieldKey]).trim() === '1' ? '1' : '0';
    return acc;
  }, createEmptySponsoredFieldSnapshot());
};

export const buildSponsoredFlagFields = ({
  secrets = {},
  fallbackFields = {},
  workerSecretsEnabled = true,
  includeCustomRpcInAi = false,
}: BuildSponsoredFlagFieldsOptions = {}): Partial<SponsoredFieldSnapshot> => {
  const persisted = normalizeSponsoredFieldSnapshot(fallbackFields);
  if (!workerSecretsEnabled) {
    const hasPersistedSponsoredField = Object.values(persisted).some((value) => value === '1');
    return hasPersistedSponsoredField ? persisted : {};
  }

  const openaiKey = toStr(secrets.openaiKey).trim();
  const anthropicKey = toStr(secrets.anthropicKey).trim();
  const openrouterKey = toStr(secrets.openrouterKey).trim();
  const customRpcUrl = toStr(secrets.customRpcUrl).trim();
  const customRpcKey = toStr(secrets.customRpcKey).trim();
  const arweaveJwk = toStr(secrets.arweaveJwk).trim();
  const faucetKey = toStr(secrets.faucetPrivateKey).trim();
  const litAccountApiKey = toStr(secrets.litAccountApiKey).trim();
  const litUsageApiKey = toStr(secrets.litUsageApiKey).trim();

  const current = {
    [SPONSORED_FIELD_KEYS.ai]:
      openaiKey || anthropicKey || openrouterKey || (includeCustomRpcInAi ? customRpcUrl : '') ? '1' : '0',
    [SPONSORED_FIELD_KEYS.rpc]: customRpcUrl || customRpcKey ? '1' : '0',
    [SPONSORED_FIELD_KEYS.faucet]: faucetKey ? '1' : '0',
    [SPONSORED_FIELD_KEYS.arweave]: arweaveJwk ? '1' : '0',
    [SPONSORED_FIELD_KEYS.lit]: litUsageApiKey || litAccountApiKey ? '1' : '0',
    [SPONSORED_FIELD_KEYS.transcribe]: openaiKey ? '1' : '0',
  };

  return (Object.values(SPONSORED_FIELD_KEYS) as SponsoredFieldKey[]).reduce((acc, fieldKey) => {
    acc[fieldKey] = current[fieldKey] === '1' || persisted[fieldKey] === '1' ? '1' : '0';
    return acc;
  }, createEmptySponsoredFieldSnapshot());
};
