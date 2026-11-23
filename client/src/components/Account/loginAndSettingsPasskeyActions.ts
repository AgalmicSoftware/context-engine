import { PasskeysUnavailableError } from '../../wallet/passkey/unavailable';
import { buildPasskeyWalletNetwork } from './passkeyLoginRestore';

// Kept apart so that the navbar, which restores a saved account at start-up, loads those two and not this file.
export {
  buildPasskeyWalletNetwork,
  restorePasskeyLoginPassively,
  type PasskeyAccountPayload,
  type PassivePasskeyRestoreDeps,
} from './passkeyLoginRestore';

/** Shown where this browser has no passkeys (many apps' built-in browsers); the login offers to copy the link. */
export const PASSKEYS_UNAVAILABLE_MESSAGE = 'Open this link in Safari or Chrome to sign in.';
/** Shown after "Login failed: " or "Create failed: " where the passkey has no PRF; the console keeps the thrown text. */
export const PASSKEY_PRF_UNSUPPORTED_TEXT = "This passkey can't be used here.";
// What the log-in window says of a login file itself; the wallet's own words for the first three. From the
// texts alone: this file is loaded with the navbar, and must not bring the wallet's code with it.
export {
  LOGIN_FILE_PASSWORD_NEEDED_TEXT,
  LOGIN_FILE_PASSWORD_WRONG_TEXT,
  LOGIN_FILE_UNREADABLE_TEXT,
} from '../../utilities/session/loginFileTexts';
/** Shown after "Create failed: " where a login file with a password could not be made. */
export const LOGIN_FILE_NOT_MADE_TEXT = 'The login file could not be made.';
/** The status after a Create whose passkey has no PRF: the login then offers to keep the passkey on a phone. */
export const PASSKEY_CREATE_PRF_UNSUPPORTED_MESSAGE = `Create failed: ${PASSKEY_PRF_UNSUPPORTED_TEXT}`;

export type LoginPasskeyNetwork = Record<string, unknown> & {
  chainId?: unknown;
  id?: unknown;
  name?: unknown;
};

export type PasskeyWalletActionMode = '' | 'create' | 'sign-in';

export type LoginPasskeyWalletPort = {
  createPasskeyWallet: (options?: { anotherDevice?: boolean }) => Promise<unknown>;
  signInWithLoginFile: (text: string, password?: string) => Promise<unknown>;
  getPasskeyWalletChain?: () => unknown;
  isMissingPasskeyWalletRecordError?: (error: unknown) => boolean;
  isPasskeyWalletOperationCancelledError?: (error: unknown) => boolean;
  setPasskeyWalletChain: (chain: unknown) => void;
  unlockPasskeyWallet: (options?: { selectCredential?: boolean }) => Promise<unknown>;
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
  // Each resolves to whether it signed the person in.
  handlePasskeyWalletCreate: () => Promise<boolean>;
  handlePasskeyWalletCreateOnAnotherDevice: () => Promise<boolean>;
  handlePasskeyWalletSignIn: () => Promise<boolean>;
  handleLoginFileSignIn: (text: string, password?: string) => Promise<boolean>;
  syncPasskeyWalletChain: (targetNetwork?: unknown) => unknown;
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
    failureMessage,
  }: {
    action: () => Promise<unknown>;
    mode: Exclude<PasskeyWalletActionMode, ''>;
    /** Shown for any failure, in place of the failure's own words. */
    failureMessage?: string;
  }): Promise<boolean> => {
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
      if (!deps.isCurrentAction(passkeyActionId)) return false;
      _finalizePasskeyWalletLogin(address, passkeyNetwork);
      deps.setActionMode('');
      return true;
    } catch (error) {
      if (deps.passkeyWallet.isPasskeyWalletOperationCancelledError?.(error)) return false;
      deps.accountLogError(mode === 'create' ? 'Passkey wallet create error:' : 'Passkey wallet sign-in error:', error);
      if (!deps.isCurrentAction(passkeyActionId)) return false;
      const isMissingWallet = mode === 'sign-in' && deps.passkeyWallet.isMissingPasskeyWalletRecordError?.(error);
      const message =
        failureMessage ||
        (isMissingWallet
          ? 'No passkey wallet is saved in this browser for this app. Use Create to make one under this RP ID.'
          : error instanceof PasskeysUnavailableError
            ? PASSKEYS_UNAVAILABLE_MESSAGE
            : `${mode === 'create' ? 'Create' : 'Login'} failed: ${
                // Both PRF errors (prf.ts and createCredential.ts) name WebAuthn PRF, which means nothing to a participant.
                /WebAuthn PRF/.test(deps.getErrorMessage(error))
                  ? PASSKEY_PRF_UNSUPPORTED_TEXT
                  : deps.getErrorMessage(error).trim() ||
                    (mode === 'create' ? 'Could not create passkey wallet.' : 'Could not unlock passkey wallet.')
              }`);
      deps.setStatus({
        passkeyWalletStatusMessage: message,
        passkeyWalletStatusTone: 'error',
      });
      deps.setActionMode('');
      deps.updateLoginInfo({ loginInProgress: false, loginComplete: false, provider: null });
      return false;
    }
  };

  return {
    _finalizePasskeyWalletLogin,
    getPasskeyWalletNetwork,
    handlePasskeyWalletCreate: () =>
      runPasskeyWalletAction({
        action: () => deps.passkeyWallet.createPasskeyWallet(),
        mode: 'create',
      }),
    // For a device whose own passkeys lack PRF (Windows Hello on Windows 10, or on an older Windows 11 or
    // browser): the passkey is kept on a phone, reached by QR code. A try that fails, or a prompt that is closed,
    // returns to the message that offered it, so the offer and the copy line stay; the console keeps the cause.
    handlePasskeyWalletCreateOnAnotherDevice: () =>
      runPasskeyWalletAction({
        action: () => deps.passkeyWallet.createPasskeyWallet({ anotherDevice: true }),
        mode: 'create',
        failureMessage: PASSKEY_CREATE_PRF_UNSUPPORTED_MESSAGE,
      }),
    handlePasskeyWalletSignIn: () =>
      runPasskeyWalletAction({
        action: () => deps.passkeyWallet.unlockPasskeyWallet({ selectCredential: true }),
        mode: 'sign-in',
      }),
    // A login file's account is the same kind as a passkey's from here on: the same provider, signatures and
    // transactions. Only the way its key is reached differs.
    handleLoginFileSignIn: (text: string, password?: string) =>
      runPasskeyWalletAction({
        action: () => deps.passkeyWallet.signInWithLoginFile(text, password),
        mode: 'sign-in',
      }),
    syncPasskeyWalletChain,
  };
};
