import React from 'react';

import {
  clearEncryptedSbtPasswordRecoveryCodes,
  readEncryptedSbtPasswordRecoveryCodes,
  upsertEncryptedSbtPasswordRecoveryCodes,
} from '../../utilities/sbt/sbtEncryptedPasswordRecoveryStore.js';
import {
  clearSbtPasswordRecoveryCodes,
  getSbtPasswordRecoveryCodes,
} from '../../utilities/sbt/sbtPasswordRecoveryStore.js';

type RecoveryResult = { ok: boolean; status: string; passwords?: string[] };
type RecoveryPatch = {
  cachedPasswords?: string[];
  encryptedRecoveryEnabled: boolean;
  encryptedRecoveryStatus: string;
};
type RecoveryScope = { chainId?: unknown; sbtAddress?: unknown };

export type SbtEncryptedRecoveryControlProps = {
  checked: boolean;
  clearButtonClassName?: string;
  hasLocalRecovery?: boolean;
  mode: 'admin' | 'create';
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onClear?: React.MouseEventHandler<HTMLButtonElement>;
  status: string;
};

export const SbtEncryptedRecoveryControl = ({
  checked,
  clearButtonClassName = '',
  hasLocalRecovery = false,
  mode,
  onChange,
  onClear,
  status,
}: SbtEncryptedRecoveryControlProps): React.ReactElement => (
  <div>
    {mode === 'create' && <p>Export-only is the default; codes are stored only after this explicit opt-in.</p>}
    <label>
      <input type="checkbox" checked={checked} disabled={status === 'saving'} onChange={onChange} />
      Keep encrypted recovery on this browser
    </label>
    <p>
      Optional AES-GCM browser-local recovery does not sync across devices and does not protect against a compromised
      browser profile.{mode === 'admin' ? ' Uncheck it to clear encrypted recovery for this group.' : ''}
    </p>
    {status === 'saved' && <p>Encrypted local recovery saved.</p>}
    {status === 'ready' && <p>New passwords will be kept encrypted on this browser.</p>}
    {status === 'unavailable' && <p>Encrypted recovery unavailable; export-only remains active.</p>}
    {status === 'unreadable' && <p>Encrypted recovery cannot be decrypted by this browser.</p>}
    {status === 'cleared' && <p>Encrypted local recovery cleared.</p>}
    {mode === 'admin' && hasLocalRecovery && onClear && (
      <>
        <p>Legacy recovery may contain plaintext. Clear local recovery after exporting anything you still need.</p>
        <button type="button" onClick={onClear} className={clearButtonClassName}>
          Clear local recovery
        </button>
      </>
    )}
  </div>
);

export const selectCreateEncryptedRecovery = async ({
  chainId,
  enabled,
  passwords,
  sbtAddress,
  clear = clearEncryptedSbtPasswordRecoveryCodes,
  write = upsertEncryptedSbtPasswordRecoveryCodes,
}: RecoveryScope & {
  enabled: boolean;
  passwords?: unknown;
  clear?: (scope: RecoveryScope) => Promise<RecoveryResult>;
  write?: (input: RecoveryScope & { mode: 'replace'; passwords?: unknown }) => Promise<RecoveryResult>;
}): Promise<{ patch: RecoveryPatch; warning: string }> => {
  if (!enabled) {
    await clear({ chainId, sbtAddress });
    return { patch: { encryptedRecoveryEnabled: false, encryptedRecoveryStatus: 'cleared' }, warning: '' };
  }
  const result = await write({ chainId, sbtAddress, passwords, mode: 'replace' });
  return result.ok
    ? { patch: { encryptedRecoveryEnabled: true, encryptedRecoveryStatus: 'saved' }, warning: '' }
    : {
        patch: { encryptedRecoveryEnabled: false, encryptedRecoveryStatus: 'unavailable' },
        warning: 'Encrypted local recovery is unavailable. Export these passwords before leaving this page.',
      };
};

export const loadSbtRecoverySnapshot = async ({
  chainId,
  sbtAddress,
  readEncrypted = readEncryptedSbtPasswordRecoveryCodes,
  readLegacy = getSbtPasswordRecoveryCodes,
}: RecoveryScope & {
  readEncrypted?: (scope: RecoveryScope) => Promise<RecoveryResult>;
  readLegacy?: (scope: RecoveryScope) => string[];
}): Promise<RecoveryPatch> => {
  const legacy = readLegacy({ chainId, sbtAddress });
  const encrypted = await readEncrypted({ chainId, sbtAddress });
  if (encrypted.ok && encrypted.status === 'ok') {
    return {
      cachedPasswords: [...new Set([...legacy, ...(encrypted.passwords || [])])],
      encryptedRecoveryEnabled: true,
      encryptedRecoveryStatus: 'saved',
    };
  }
  return {
    cachedPasswords: legacy,
    encryptedRecoveryEnabled: false,
    encryptedRecoveryStatus: encrypted.ok ? 'idle' : encrypted.status === 'unavailable' ? 'unavailable' : 'unreadable',
  };
};

export const appendEncryptedSbtRecovery = (scope: RecoveryScope & { passwords: string[] }): Promise<RecoveryResult> =>
  upsertEncryptedSbtPasswordRecoveryCodes({ ...scope, mode: 'append' });

export const selectAdminEncryptedRecovery = async ({
  chainId,
  enabled,
  sbtAddress,
}: RecoveryScope & { enabled: boolean }): Promise<RecoveryPatch> => {
  if (enabled) return { encryptedRecoveryEnabled: true, encryptedRecoveryStatus: 'ready' };
  await clearEncryptedSbtPasswordRecoveryCodes({ chainId, sbtAddress });
  return {
    cachedPasswords: getSbtPasswordRecoveryCodes({ chainId, sbtAddress }),
    encryptedRecoveryEnabled: false,
    encryptedRecoveryStatus: 'cleared',
  };
};

export const clearAllSbtRecovery = async (scope: RecoveryScope): Promise<RecoveryPatch> => {
  await clearEncryptedSbtPasswordRecoveryCodes(scope);
  clearSbtPasswordRecoveryCodes(scope);
  return { cachedPasswords: [], encryptedRecoveryEnabled: false, encryptedRecoveryStatus: 'cleared' };
};

export default SbtEncryptedRecoveryControl;
