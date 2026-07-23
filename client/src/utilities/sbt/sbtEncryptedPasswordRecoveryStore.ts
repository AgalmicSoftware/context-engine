import {
  SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY,
  clearSbtPasswordRecoveryCodes,
  getSbtPasswordRecoveryCodes,
  purgeLegacySbtPasswordRecoveryArtifacts,
  upsertSbtPasswordRecoveryCodes,
} from './sbtPasswordRecoveryStore.js';

export { SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY };
const SBT_ENCRYPTED_PASSWORD_RECOVERY_VERSION = 2;
const SBT_ENCRYPTED_PASSWORD_RECOVERY_KIND = 'sbt-password-recovery';
const SBT_ENCRYPTED_PASSWORD_RECOVERY_KEY_REF = 'tab-memory-v1';

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

export type SbtPasswordRecoveryKeyStore = {
  read: () => Promise<CryptoKey | null>;
  write: (key: CryptoKey) => Promise<void>;
};

type RecoveryArgs = {
  chainId?: unknown;
  sbtAddress?: unknown;
  cryptoApi?: Crypto | null;
  keyStore?: SbtPasswordRecoveryKeyStore | null;
  storage?: StorageLike | null;
  now?: number;
};

type UpsertArgs = RecoveryArgs & {
  mode?: 'replace' | 'append' | string;
  passwords?: unknown;
  ttlMs?: unknown;
};

export const readEncryptedSbtPasswordRecoveryCodes = async ({
  chainId,
  sbtAddress,
  storage,
  now = Date.now(),
}: RecoveryArgs = {}) => {
  purgeLegacySbtPasswordRecoveryArtifacts({ storage });
  const passwords = getSbtPasswordRecoveryCodes({ chainId, sbtAddress, storage, now });
  return {
    ok: true,
    status: passwords.length > 0 ? 'ok' : 'empty',
    passwords,
  };
};

export const upsertEncryptedSbtPasswordRecoveryCodes = async ({
  chainId,
  sbtAddress,
  passwords,
  mode = 'replace',
  storage,
  now = Date.now(),
  ttlMs,
}: UpsertArgs = {}) => {
  purgeLegacySbtPasswordRecoveryArtifacts({ storage });
  return upsertSbtPasswordRecoveryCodes({
    chainId,
    sbtAddress,
    passwords,
    mode,
    storage,
    now,
    ttlMs,
  });
};

export const clearEncryptedSbtPasswordRecoveryCodes = async ({ chainId, sbtAddress, storage }: RecoveryArgs = {}) => {
  purgeLegacySbtPasswordRecoveryArtifacts({ storage });
  return clearSbtPasswordRecoveryCodes({ chainId, sbtAddress, storage });
};

const sbtEncryptedPasswordRecoveryStore = {
  clearEncryptedSbtPasswordRecoveryCodes,
  readEncryptedSbtPasswordRecoveryCodes,
  upsertEncryptedSbtPasswordRecoveryCodes,
};

export default sbtEncryptedPasswordRecoveryStore;
