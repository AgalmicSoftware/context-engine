/** @file AccountSection.tsx */
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { toggleLoginModal } from '../../actions/sessionStateActions.js';
import type { RootState } from '../../reducers/index.js';

import styles from "./Navbar.module.scss";

import LoginButtonRaw from 'components/Account/LoginButton';
import LoginAndSettingsModalRaw from '../Account/LoginAndSettingsModal'
import { AccountDisplayTorus } from './AccountDisplay';

import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';
import { createLogger } from 'utilities/logging.js';

const accountLog = createLogger('account');

type AccountSectionProps = {
  toggleLoginModal: (isOpen: boolean) => void;
  loginModalToggled?: boolean;
  userImageURL?: string | null;
  account?: string;
  provider?: string | null;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  sendTestETH?: (amountToSend: unknown) => void;
  demoMode?: unknown;
  toggleDemoMode?: (demoModeOn: boolean) => void;
};

const LoginButton = LoginButtonRaw as React.ComponentType<any>;
const LoginAndSettingsModal = LoginAndSettingsModalRaw as React.ComponentType<any>;

class AccountSection extends Component<AccountSectionProps> {
  state = {};

  componentDidMount() {}

  componentDidUpdate() {}

  launchAccountSettings = () => {
    const open = true;
    this.props.toggleLoginModal(open);
  }

  render() {
    const loggedIn = this.props.loginComplete;
    accountLog.log("AccountSection.tsx - loggedIn: ", loggedIn)

    // Pre-compute blockie for all providers (fallback for wagmi/passkey which lack social image)
    const blockieUrl = this.props.account ? generateBlockieDataUrl(this.props.account, 8, 4) : '';

    // Standardized display: use AccountDisplayTorus for all logged-in states (passkey wallet, Wagmi)
    const relevantAccountDisplay =
      <AccountDisplayTorus
        account={this.props.account || ''}
        loginComplete={this.props.loginComplete}
        launchAccountSettings={this.launchAccountSettings}
        userImageURL={this.props.userImageURL}
        provider={this.props.provider}
        avatarUrl={blockieUrl}
      />;

    const topRight = loggedIn ? (
      <>
        <div id={styles.AccountSectionLoggedIn}>
          <div id={styles.addressDisplay}>
            { relevantAccountDisplay }
          </div>
        </div >
      </>
    ) : (
      <>
        <LoginButton launchAccountModal={this.launchAccountSettings} />
      </>
    );

    return (
      <>
        <LoginAndSettingsModal
        sendTestETH={(amountToSend: unknown) => this.props.sendTestETH?.(amountToSend)}
        demoMode={this.props.demoMode}
        toggleDemoMode={(demoModeOn: boolean) => this.props.toggleDemoMode?.(demoModeOn)}
        />
        { topRight }
      </>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  loginModalToggled: state.sessionState.loginModalToggled,
  userImageURL: state.profile.userImageURL,
  loginComplete: state.sessionState.loginComplete,
});

export default connect(mapStateToProps, { toggleLoginModal })(AccountSection);
