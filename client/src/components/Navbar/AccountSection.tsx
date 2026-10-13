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
} from '../Account/loginAndSettingsPasskeyActions';
import { AccountDisplayTorus } from './AccountDisplay';

import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';
import { createLogger } from 'utilities/logging.js';

const accountLog = createLogger('account');

type AccountSectionProps = {
  toggleLoginModal: (isOpen: boolean) => void;
  changeAccount?: PassivePasskeyRestoreDeps['changeAccount'];
  updateLoginInfo?: PassivePasskeyRestoreDeps['updateLoginInfo'];
  loginModalToggled?: boolean;
  userImageURL?: string | null;
  account?: string;
  provider?: string | null;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  sendTestETH?: (amountToSend: unknown) => void;
  demoMode?: unknown;
  toggleDemoMode?: (demoModeOn: boolean) => void;
  sessionConfig?: unknown;
};

const LoginButton = LoginButtonRaw as React.ComponentType<any>;
const LoginAndSettingsModal = React.lazy(() => import('../Account/LoginAndSettingsModal'));

class AccountSection extends Component<AccountSectionProps> {
  state = {};
  _passkeyRestoreId = 0;

  componentDidMount() {
    void this.restorePasskeyLogin();
  }

  componentDidUpdate(prevProps: AccountSectionProps) {
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
  }

  // Regression guard: the lazy login modal stays closed on most loads, so a
  // saved passkey account must be restored here rather than only on modal mount.
  restorePasskeyLogin = async () => {
    if (this.props.loginComplete || this.props.loginInProgress || this.props.loginModalToggled) return;
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
    const open = true;
    this.props.toggleLoginModal(open);
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
              demoMode={this.props.demoMode}
              toggleDemoMode={(demoModeOn: boolean) => this.props.toggleDemoMode?.(demoModeOn)}
              sessionConfig={this.props.sessionConfig}
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
  loginComplete: state.sessionState.loginComplete,
  loginInProgress: state.sessionState.loginInProgress,
});

export default connect(mapStateToProps, { toggleLoginModal, changeAccount, updateLoginInfo })(AccountSection);
