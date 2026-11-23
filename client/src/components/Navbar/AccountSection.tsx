/** @file AccountSection.tsx */
import React, { Component, Suspense } from 'react';
import { connect } from 'react-redux';
import { changeAccount } from '../../actions/accountActions.js';
import { toggleLoginModal, updateLoginInfo } from '../../actions/sessionStateActions.js';
import type { RootState } from '../../reducers/index.js';

import styles from './Navbar.module.scss';

import LoginButtonRaw from 'components/Account/LoginButton';
import {
  buildPasskeyWalletNetwork,
  restorePasskeyLoginPassively,
  type PassivePasskeyRestoreDeps,
} from '../Account/passkeyLoginRestore';
import { AccountDisplayTorus } from './AccountDisplay';

import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';
import { holdsAgentLinkAccountForPath } from 'utilities/session/agentLinkAccount';
// The event's name alone, and the request's shape: the asking itself is loaded with the Submit, not the navbar.
import { LOGIN_FILE_DUE_EVENT } from 'utilities/session/loginFileTexts';
import type { LoginFileDueRequest } from 'utilities/session/loginFileDue';
import { createLogger } from 'utilities/logging.js';

const accountLog = createLogger('account');

type AccountSectionProps = {
  toggleLoginModal: (isOpen: boolean) => void;
  changeAccount?: PassivePasskeyRestoreDeps['changeAccount'];
  updateLoginInfo?: PassivePasskeyRestoreDeps['updateLoginInfo'];
  loginModalToggled?: boolean;
  userImageURL?: string | null;
  account?: string;
  // The signed-in account as the store holds it, for the login-file window whichever layout rendered this.
  signedInAccount?: string;
  provider?: string | null;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  sendTestETH?: (amountToSend: unknown) => void;
  sessionConfig?: unknown;
};

const LoginButton = LoginButtonRaw as React.ComponentType<any>;
const LoginAndSettingsModal = React.lazy(() => import('../Account/LoginAndSettingsModal'));
const loadLoginFileDueModal = () => import('../Account/LoginFileDueModal');
const LoginFileDueModal = React.lazy(loadLoginFileDueModal);

type AccountSectionState = {
  // A Submit met a login file whose time had run out, and waits while the file is asked for again.
  loginFileDue: LoginFileDueRequest | null;
};

class AccountSection extends Component<AccountSectionProps, AccountSectionState> {
  state: AccountSectionState = { loginFileDue: null };
  _passkeyRestoreId = 0;

  componentDidMount() {
    void this.restorePasskeyLogin();
    window.addEventListener(LOGIN_FILE_DUE_EVENT, this.askForLoginFile);
  }

  componentDidUpdate(prevProps: AccountSectionProps) {
    // The window is for the account the page showed when it was asked for: a sign-out or another account ends it.
    if (
      this.state.loginFileDue &&
      (!this.props.loginComplete ||
        (prevProps.account || prevProps.signedInAccount) !== (this.props.account || this.props.signedInAccount))
    ) {
      this.answerLoginFile(false);
    }
    // Any login activity, or the modal's own restore, supersedes a pending start-up restore.
    if (
      prevProps.loginComplete !== this.props.loginComplete ||
      prevProps.loginInProgress !== this.props.loginInProgress ||
      prevProps.loginModalToggled !== this.props.loginModalToggled
    ) {
      this._passkeyRestoreId += 1;
    }
  }

  componentWillUnmount() {
    this._passkeyRestoreId += 1;
    window.removeEventListener(LOGIN_FILE_DUE_EVENT, this.askForLoginFile);
    this.state.loginFileDue?.answer(false);
  }

  // Only for the account the page still shows. The window's code is fetched first: a page open this long may
  // have outlived a release, and if it cannot be had the Submit fails as before, with its line under the bar.
  askForLoginFile = (event: Event) => {
    const request = (event as CustomEvent<LoginFileDueRequest>).detail;
    if (!this.props.loginComplete || !this.signedInAccount() || typeof request?.answer !== 'function') return;
    request.take();
    const account = this.signedInAccount();
    void loadLoginFileDueModal().then(
      () => {
        // A sign-out or another account while it loaded, or a later Submit that asked: this one is not shown.
        if (!this.props.loginComplete || this.signedInAccount() !== account) return request.answer(false);
        this.state.loginFileDue?.answer(false);
        this.setState({ loginFileDue: request });
      },
      (error) => {
        accountLog.warn('The login file window could not be loaded:', error);
        request.answer(false);
      },
    );
  };

  signedInAccount = (): string => this.props.account || this.props.signedInAccount || '';

  // Ends the window with its answer: whether the file signed the same account back in. The Submit that asked
  // goes ahead on `true`, and fails with its line under the bar on `false`.
  answerLoginFile = (signedIn: boolean) => {
    const request = this.state.loginFileDue;
    if (!request) return;
    this.setState({ loginFileDue: null }, () => request.answer(signedIn));
  };

  // Regression guard: the lazy login modal stays closed on most loads, so a
  // saved passkey account must be restored here rather than only on modal mount.
  restorePasskeyLogin = async () => {
    if (this.props.loginComplete || this.props.loginInProgress || this.props.loginModalToggled) return;
    // A reload of the session this tab holds an agent's account for opens that account again (the session page
    // does it); a saved passkey is not signed in over it.
    if (holdsAgentLinkAccountForPath(window.location.pathname)) return;
    const restoreId = ++this._passkeyRestoreId;
    try {
      const passkeyWallet = await import('../../wallet/passkeyWallet.js');
      if (restoreId !== this._passkeyRestoreId) return;
      await restorePasskeyLoginPassively({
        changeAccount: (payload) => this.props.changeAccount?.(payload),
        getNetwork: () => buildPasskeyWalletNetwork(passkeyWallet.getPasskeyWalletChain()),
        isCurrent: () => restoreId === this._passkeyRestoreId,
        restoreSession: (options) => passkeyWallet.restorePasskeyWalletSession(options),
        updateLoginInfo: (payload) => this.props.updateLoginInfo?.(payload),
      });
    } catch (error) {
      accountLog.warn('Saved passkey account restore failed:', error);
    }
  };

  launchAccountSettings = () => {
    this.props.toggleLoginModal(true);
  };

  render() {
    const loggedIn = this.props.loginComplete;
    accountLog.log('AccountSection.tsx - loggedIn: ', loggedIn);

    // Pre-compute blockie for all providers (fallback for wagmi/passkey which lack social image)
    const blockieUrl = this.props.account ? generateBlockieDataUrl(this.props.account, 8, 4) : '';

    // Standardized display: use AccountDisplayTorus for all logged-in states (passkey wallet, Wagmi)
    const relevantAccountDisplay = (
      <AccountDisplayTorus
        account={this.props.account || ''}
        loginComplete={this.props.loginComplete}
        launchAccountSettings={this.launchAccountSettings}
        userImageURL={this.props.userImageURL}
        provider={this.props.provider}
        avatarUrl={blockieUrl}
      />
    );

    const topRight = loggedIn ? (
      <>
        <div id={styles.AccountSectionLoggedIn}>
          <div id={styles.addressDisplay}>{relevantAccountDisplay}</div>
        </div>
      </>
    ) : (
      <>
        <LoginButton launchAccountModal={this.launchAccountSettings} />
      </>
    );

    return (
      <>
        {this.props.loginModalToggled ? (
          <Suspense fallback={null}>
            <LoginAndSettingsModal
              sendTestETH={(amountToSend: unknown) => this.props.sendTestETH?.(amountToSend)}
              sessionConfig={this.props.sessionConfig}
            />
          </Suspense>
        ) : null}
        {this.state.loginFileDue && this.props.loginComplete && this.signedInAccount() ? (
          <Suspense fallback={null}>
            <LoginFileDueModal
              account={this.signedInAccount()}
              onSignedIn={() => this.answerLoginFile(true)}
              onClose={() => this.answerLoginFile(false)}
            />
          </Suspense>
        ) : null}
        {topRight}
      </>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  loginModalToggled: state.sessionState.loginModalToggled,
  userImageURL: state.profile.userImageURL,
  signedInAccount: state.profile.account,
  loginComplete: state.sessionState.loginComplete,
  loginInProgress: state.sessionState.loginInProgress,
});

export default connect(mapStateToProps, { toggleLoginModal, changeAccount, updateLoginInfo })(AccountSection);
