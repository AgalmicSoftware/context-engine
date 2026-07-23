import React from 'react';

import {
  clearEncryptedSbtPasswordRecoveryCodes,
  readEncryptedSbtPasswordRecoveryCodes,
  upsertEncryptedSbtPasswordRecoveryCodes,
} from '../../utilities/sbt/sbtEncryptedPasswordRecoveryStore.js';

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
    {mode === 'create' && <p>Export is the only durable recovery path. Browser storage is never used for codes.</p>}
    <label>
      <input type="checkbox" checked={checked} disabled={status === 'saving'} onChange={onChange} />
      Keep recovery codes in this tab
    </label>
    <p>
      This optional convenience keeps codes in memory only. Reloading or closing the tab clears them.
      {mode === 'admin' ? ' Uncheck it to clear tab-memory recovery for this group.' : ''}
    </p>
    {status === 'saved' && <p>Recovery codes are available in this tab only.</p>}
    {status === 'ready' && <p>New passwords will be kept in this tab only.</p>}
    {status === 'unavailable' && <p>Tab-memory recovery unavailable; export-only remains active.</p>}
    {status === 'unreadable' && <p>Tab-memory recovery is unavailable.</p>}
    {status === 'cleared' && <p>Tab-memory recovery cleared.</p>}
    {mode === 'admin' && hasLocalRecovery && onClear && (
      <>
        <button type="button" onClick={onClear} className={clearButtonClassName}>
          Clear tab recovery
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
        warning: 'Tab-memory recovery is unavailable. Export these passwords before leaving this page.',
      };
};

export const loadSbtRecoverySnapshot = async ({
  chainId,
  sbtAddress,
  readMemory = readEncryptedSbtPasswordRecoveryCodes,
}: RecoveryScope & {
  readMemory?: (scope: RecoveryScope) => Promise<RecoveryResult>;
}): Promise<RecoveryPatch> => {
  const memory = await readMemory({ chainId, sbtAddress });
  if (memory.ok && memory.status === 'ok') {
    return {
      cachedPasswords: [...new Set(memory.passwords || [])],
      encryptedRecoveryEnabled: true,
      encryptedRecoveryStatus: 'saved',
    };
  }
  return {
    cachedPasswords: [],
    encryptedRecoveryEnabled: false,
    encryptedRecoveryStatus: memory.ok ? 'idle' : memory.status === 'unavailable' ? 'unavailable' : 'unreadable',
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
    cachedPasswords: [],
    encryptedRecoveryEnabled: false,
    encryptedRecoveryStatus: 'cleared',
  };
};

export const clearAllSbtRecovery = async (scope: RecoveryScope): Promise<RecoveryPatch> => {
  await clearEncryptedSbtPasswordRecoveryCodes(scope);
  return { cachedPasswords: [], encryptedRecoveryEnabled: false, encryptedRecoveryStatus: 'cleared' };
};

export default SbtEncryptedRecoveryControl;
