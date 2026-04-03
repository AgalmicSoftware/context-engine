import { getLitPayerWalletStatus } from '../crypto/litPayerWallet.js';
import { toStr } from '../shared/primitives.js';

export const SPONSORED_FIELD_KEYS = Object.freeze({
  ai: 'sponsored_ai',
  rpc: 'sponsored_rpc',
  faucet: 'sponsored_faucet',
  arweave: 'sponsored_arweave',
  lit: 'sponsored_lit',
  transcribe: 'sponsored_transcribe',
});

export const normalizeSponsoredFieldSnapshot = (value = {}) => (
  Object.values(SPONSORED_FIELD_KEYS).reduce((acc, fieldKey) => {
    acc[fieldKey] = toStr(value?.[fieldKey]).trim() === '1' ? '1' : '0';
    return acc;
  }, {})
);

export const buildSponsoredFlagFields = ({
  secrets = {},
  fallbackFields = {},
  workerSecretsEnabled = true,
  includeCustomRpcInAi = false,
} = {}) => {
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
  const litPayerStatus = getLitPayerWalletStatus(secrets.litPayerPrivateKey);

  const current = {
    [SPONSORED_FIELD_KEYS.ai]: (
      openaiKey ||
      anthropicKey ||
      openrouterKey ||
      (includeCustomRpcInAi ? customRpcUrl : '')
    ) ? '1' : '0',
    [SPONSORED_FIELD_KEYS.rpc]: (customRpcUrl || customRpcKey) ? '1' : '0',
    [SPONSORED_FIELD_KEYS.faucet]: faucetKey ? '1' : '0',
    [SPONSORED_FIELD_KEYS.arweave]: arweaveJwk ? '1' : '0',
    [SPONSORED_FIELD_KEYS.lit]: litPayerStatus.valid ? '1' : '0',
    [SPONSORED_FIELD_KEYS.transcribe]: openaiKey ? '1' : '0',
  };

  return Object.values(SPONSORED_FIELD_KEYS).reduce((acc, fieldKey) => {
    acc[fieldKey] = current[fieldKey] === '1' || persisted[fieldKey] === '1' ? '1' : '0';
    return acc;
  }, {});
};
