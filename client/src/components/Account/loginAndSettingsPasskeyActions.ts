export type LoginPasskeyNetwork = Record<string, unknown> & {
  chainId?: unknown;
  id?: unknown;
  name?: unknown;
};

export type PasskeyWalletActionMode = '' | 'create' | 'sign-in';

export type LoginPasskeyWalletPort = {
  createPasskeyWallet: () => Promise<unknown>;
  getPasskeyWalletChain?: () => unknown;
  isMissingPasskeyWalletRecordError?: (error: unknown) => boolean;
  setPasskeyWalletChain: (chain: unknown) => void;
  unlockPasskeyWallet: () => Promise<unknown>;
};

export type LoginPasskeyActionsDeps = {
  accountLogError: (message: string, error: unknown) => void;
  changeAccount: (payload: unknown) => void;
  clearAllWorkerSessionTokens: () => void;
  getAccount: () => unknown;
  getErrorMessage: (error: unknown, fallback?: string) => string;
  getProvider: () => unknown;
  getTargetNetwork: () => unknown;
  isCurrentAction: (actionId: number) => boolean;
  normalizeAccountForComparison: (account: unknown) => string;
  notifyInfo: (message: string) => void;
  passkeyWallet: LoginPasskeyWalletPort;
  setActionMode: (mode: PasskeyWalletActionMode) => void;
  setStatus: (patch: { passkeyWalletStatusMessage: string; passkeyWalletStatusTone: string }) => void;
  startAction: () => number;
  updateLoginInfo: (payload: { loginComplete: boolean; loginInProgress: boolean; provider: string | null }) => void;
};

export type LoginPasskeyActions = {
  _finalizePasskeyWalletLogin: (address: unknown, targetNetwork?: unknown) => void;
  getPasskeyWalletNetwork: (targetNetwork?: unknown) => unknown;
  handlePasskeyWalletCreate: () => Promise<void>;
  handlePasskeyWalletSignIn: () => Promise<void>;
  syncPasskeyWalletChain: (targetNetwork?: unknown) => unknown;
};

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

export const createLoginPasskeyActions = (deps: LoginPasskeyActionsDeps): LoginPasskeyActions => {
  const syncPasskeyWalletChain = (targetNetwork: unknown = null): unknown => {
    const tn = targetNetwork || deps.getTargetNetwork();
    deps.passkeyWallet.setPasskeyWalletChain(tn);
    if (typeof deps.passkeyWallet.getPasskeyWalletChain === 'function') {
      return deps.passkeyWallet.getPasskeyWalletChain();
    }
    return tn;
  };

  const getPasskeyWalletNetwork = (targetNetwork: unknown = null): unknown =>
    buildPasskeyWalletNetwork(syncPasskeyWalletChain(targetNetwork));

  const _finalizePasskeyWalletLogin = (address: unknown, targetNetwork: unknown = null): void => {
    const passkeyNetwork = getPasskeyWalletNetwork(targetNetwork);
    const previousPasskeyAccount =
      deps.getProvider() === 'passkey_eoa' ? deps.normalizeAccountForComparison(deps.getAccount()) : '';
    const nextPasskeyAccount = deps.normalizeAccountForComparison(address);
    if (previousPasskeyAccount && nextPasskeyAccount && previousPasskeyAccount !== nextPasskeyAccount) {
      deps.clearAllWorkerSessionTokens();
      deps.notifyInfo('Passkey account switched.');
    }
    deps.changeAccount({
      account: address,
      provider: 'passkey_eoa',
      network: passkeyNetwork,
      userImageURL: undefined,
    });
    deps.updateLoginInfo({
      loginInProgress: false,
      loginComplete: true,
      provider: 'passkey_eoa',
    });
  };

  const runPasskeyWalletAction = async ({
    action,
    mode,
  }: {
    action: () => Promise<unknown>;
    mode: Exclude<PasskeyWalletActionMode, ''>;
  }): Promise<void> => {
    const passkeyActionId = deps.startAction();
    deps.setActionMode(mode);
    deps.setStatus({
      passkeyWalletStatusMessage: '',
      passkeyWalletStatusTone: '',
    });
    deps.updateLoginInfo({
      loginInProgress: true,
      loginComplete: false,
      provider: 'passkey_eoa',
    });

    try {
      const passkeyNetwork = getPasskeyWalletNetwork();
      const address = await action();
      if (!deps.isCurrentAction(passkeyActionId)) return;
      _finalizePasskeyWalletLogin(address, passkeyNetwork);
      deps.setActionMode('');
    } catch (error) {
      deps.accountLogError(mode === 'create' ? 'Passkey wallet create error:' : 'Passkey wallet sign-in error:', error);
      if (!deps.isCurrentAction(passkeyActionId)) return;
      const isMissingWallet = mode === 'sign-in' && deps.passkeyWallet.isMissingPasskeyWalletRecordError?.(error);
      const message = isMissingWallet
        ? 'No passkey wallet is saved in this browser for this app. Use Create to make one under this RP ID.'
        : mode === 'create'
          ? `Create failed: ${deps.getErrorMessage(error).trim() || 'Could not create passkey wallet.'}`
          : `Login failed: ${deps.getErrorMessage(error).trim() || 'Could not unlock passkey wallet.'}`;
      deps.setStatus({
        passkeyWalletStatusMessage: message,
        passkeyWalletStatusTone: 'error',
      });
      deps.setActionMode('');
      deps.updateLoginInfo({ loginInProgress: false, loginComplete: false, provider: null });
    }
  };

  return {
    _finalizePasskeyWalletLogin,
    getPasskeyWalletNetwork,
    handlePasskeyWalletCreate: () =>
      runPasskeyWalletAction({
        action: deps.passkeyWallet.createPasskeyWallet,
        mode: 'create',
      }),
    handlePasskeyWalletSignIn: () =>
      runPasskeyWalletAction({
        action: deps.passkeyWallet.unlockPasskeyWallet,
        mode: 'sign-in',
      }),
    syncPasskeyWalletChain,
  };
};
