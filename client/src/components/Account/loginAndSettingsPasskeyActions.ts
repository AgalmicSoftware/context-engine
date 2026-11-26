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
/** After Cancel on the spinner, or closing the dialog on it: a passkey made before that still signs in. */
export const PASSKEY_STOPPED_MESSAGE = 'Stopped. If you just made a passkey, choose Login and pick it.';

export type LoginPasskeyNetwork = Record<string, unknown> & {
  chainId?: unknown;
  id?: unknown;
  name?: unknown;
};

// 'file' is a login file's sign-in: a step like a passkey Login, with no passkey window to look for.
export type PasskeyWalletActionMode = '' | 'create' | 'sign-in' | 'file';

export type LoginPasskeyWalletPort = {
  cancelPasskeyWalletOperation?: () => void;
  createPasskeyWallet: () => Promise<unknown>;
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
  /** Ends the action under way, if any; on closing, the status is kept for the dialog's next opening. */
  cancelPasskeyWalletAction: (options?: { closing?: boolean }) => void;
  getPasskeyWalletNetwork: (targetNetwork?: unknown) => unknown;
  // Each resolves to whether it signed the person in.
  handlePasskeyWalletCreate: () => Promise<boolean>;
  handlePasskeyWalletSignIn: () => Promise<boolean>;
  handleLoginFileSignIn: (text: string, password?: string) => Promise<boolean>;
  syncPasskeyWalletChain: (targetNetwork?: unknown) => unknown;
};

// The dialog closes by unmounting, so what it said on closing waits here for its next opening.
let statusForNextOpening = '';
/** The status to open with, once: the dialog was closed on its spinner. */
export const takePasskeyStatusForNextOpening = (): string => {
  const status = statusForNextOpening;
  statusForNextOpening = '';
  return status;
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

    // An action that is no longer current leaves the sign-in state alone: whatever ended it (a newer action, Cancel,
    // closing the dialog, signing out) has set it.
    try {
      const passkeyNetwork = getPasskeyWalletNetwork();
      const address = await action();
      if (!deps.isCurrentAction(passkeyActionId)) return false;
      _finalizePasskeyWalletLogin(address, passkeyNetwork);
      deps.setActionMode('');
      return true;
    } catch (error) {
      if (deps.passkeyWallet.isPasskeyWalletOperationCancelledError?.(error)) {
        // Cancelled by a wallet operation from outside this dialog, such as a login file's window: no newer action
        // here has taken over, so the spinner ends here.
        if (deps.isCurrentAction(passkeyActionId)) {
          deps.setActionMode('');
          deps.updateLoginInfo({ loginInProgress: false, loginComplete: false, provider: null });
        }
        return false;
      }
      deps.accountLogError(mode === 'create' ? 'Passkey wallet create error:' : 'Passkey wallet sign-in error:', error);
      if (!deps.isCurrentAction(passkeyActionId)) return false;
      const isMissingWallet = mode === 'sign-in' && deps.passkeyWallet.isMissingPasskeyWalletRecordError?.(error);
      const message = isMissingWallet
        ? 'No passkey wallet is saved in this browser for this app. Use Create to make one under this RP ID.'
        : error instanceof PasskeysUnavailableError
          ? PASSKEYS_UNAVAILABLE_MESSAGE
          : `${mode === 'create' ? 'Create' : 'Login'} failed: ${
              // Both PRF errors (prf.ts and createCredential.ts) name WebAuthn PRF, which means nothing to a participant.
              /WebAuthn PRF/.test(deps.getErrorMessage(error))
                ? PASSKEY_PRF_UNSUPPORTED_TEXT
                : deps.getErrorMessage(error).trim() ||
                  (mode === 'create' ? 'Could not create passkey wallet.' : 'Could not unlock passkey wallet.')
            }`;
      deps.setStatus({
        passkeyWalletStatusMessage: message,
        passkeyWalletStatusTone: 'error',
      });
      deps.setActionMode('');
      deps.updateLoginInfo({ loginInProgress: false, loginComplete: false, provider: null });
      return false;
    }
  };

  // Cancel on the spinner, or closing the dialog on it, as where the passkey step after Create never ends (its
  // prompt hidden, or the page waiting for focus). The wallet goes no further, and a late end of the action changes
  // nothing here, as a new action id makes it no longer current.
  const cancelPasskeyWalletAction = ({ closing = false }: { closing?: boolean } = {}): void => {
    deps.startAction();
    deps.passkeyWallet.cancelPasskeyWalletOperation?.();
    deps.setActionMode('');
    if (closing) statusForNextOpening = PASSKEY_STOPPED_MESSAGE;
    else deps.setStatus({ passkeyWalletStatusMessage: PASSKEY_STOPPED_MESSAGE, passkeyWalletStatusTone: '' });
    deps.updateLoginInfo({ loginInProgress: false, loginComplete: false, provider: null });
  };

  return {
    _finalizePasskeyWalletLogin,
    cancelPasskeyWalletAction,
    getPasskeyWalletNetwork,
    handlePasskeyWalletCreate: () =>
      runPasskeyWalletAction({
        action: () => deps.passkeyWallet.createPasskeyWallet(),
        mode: 'create',
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
        mode: 'file',
      }),
    syncPasskeyWalletChain,
  };
};
