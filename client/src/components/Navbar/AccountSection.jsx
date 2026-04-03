/** @file AccountSection.jsx */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { toggleLoginModal } from '../../actions/sessionStateActions.js';

import styles from "./Navbar.module.scss";

import LoginButton from 'components/Account/LoginButton.jsx';
import LoginAndSettingsModal from '../Account/LoginAndSettingsModal.jsx'
import { AccountDisplayTorus } from './AccountDisplay.jsx';

import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';
import { createLogger } from 'utilities/logging.js';

const accountLog = createLogger('account');

class AccountSection extends Component {
  state = {};

  componentDidMount() {}

  componentDidUpdate() {}

  launchAccountSettings = () => {
    const open = true;
    this.props.toggleLoginModal(open);
  }

  render() {
    const loggedIn = this.props.loginComplete;
    accountLog.log("AccountSection.jsx – loggedIn: ", loggedIn)

    // Pre-compute blockie for all providers (fallback for wagmi/porto which lack social image)
    const blockieUrl = this.props.account ? generateBlockieDataUrl(this.props.account, 8, 4) : '';

    // Standardized display: use AccountDisplayTorus for all logged-in states (Porto, Wagmi)
    const relevantAccountDisplay =
      <AccountDisplayTorus
        account={this.props.account}
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
        sendTestETH={(amountToSend) => this.props.sendTestETH(amountToSend)}
        demoMode={this.props.demoMode}
        toggleDemoMode={(demoModeOn) => this.props.toggleDemoMode(demoModeOn)}
        />
        { topRight }
      </>
    );
  }
}

AccountSection.propTypes = {
  toggleLoginModal: PropTypes.func.isRequired,
  loginModalToggled: PropTypes.bool,
  userImageURL: PropTypes.string,
  account: PropTypes.string,
  provider: PropTypes.string,
};

const mapStateToProps = state => ({
  loginModalToggled: state.sessionState.loginModalToggled,
  userImageURL: state.profile.userImageURL,
  loginComplete: state.sessionState.loginComplete,
});

export default connect(mapStateToProps, { toggleLoginModal })(AccountSection);
