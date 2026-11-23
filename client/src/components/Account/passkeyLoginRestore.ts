// What the navbar needs at start-up to show a saved passkey account. In a file of its own: the navbar is loaded
// on every page, and the log-in window's actions, which also use these, are loaded only with that window.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const buildPasskeyWalletNetwork = (targetNetwork: unknown): unknown => {
  if (!isRecord(targetNetwork)) return targetNetwork;
  const chainId = Number(targetNetwork.id ?? targetNetwork.chainId ?? 0);
  if (!chainId) return targetNetwork;
  const nameBase = String(targetNetwork.name || `Chain ${chainId}`);
  const name = /\(Passkey\)$/.test(nameBase) ? nameBase : `${nameBase} (Passkey)`;
  return { ...targetNetwork, id: chainId, chainId, name };
};

export type PasskeyAccountPayload = {
  account: unknown;
  provider: 'passkey_eoa';
  network: unknown;
  userImageURL: undefined;
};

export type PassivePasskeyRestoreDeps = {
  changeAccount: (payload: PasskeyAccountPayload) => void;
  getNetwork: () => unknown;
  isCurrent: () => boolean;
  restoreSession: (options: { requireSigner: false }) => Promise<unknown>;
  updateLoginInfo: (payload: { loginComplete: boolean; loginInProgress: boolean; provider: string | null }) => void;
};

// Shows a saved passkey account without a prompt; signing still unlocks the
// wallet first. isCurrent lets callers drop a restore that a login superseded.
export const restorePasskeyLoginPassively = async (deps: PassivePasskeyRestoreDeps): Promise<unknown> => {
  const network = deps.getNetwork();
  const address = await deps.restoreSession({ requireSigner: false });
  if (!address || !deps.isCurrent()) return null;
  deps.changeAccount({ account: address, provider: 'passkey_eoa', network, userImageURL: undefined });
  deps.updateLoginInfo({ loginInProgress: false, loginComplete: true, provider: 'passkey_eoa' });
  return address;
};
