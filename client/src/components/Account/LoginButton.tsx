/** @file LoginButton.tsx */
import React, { Component } from 'react';
import { connect } from 'react-redux';
import type { RootState } from '../../reducers/index.js';
import { createLogger } from '../../utilities/logging';

// Reactstrap components
import { Button } from 'reactstrap';

// CSS and icons
import '../../assets/css/contextEngine.scss';
import styles from './Account.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faSpinner } from '@fortawesome/free-solid-svg-icons';

const log = createLogger('account');

type LoginButtonOwnProps = {
  launchAccountModal: () => void;
};

type LoginButtonStateProps = {
  loginInProgress?: boolean;
};

type LoginButtonProps = LoginButtonOwnProps & LoginButtonStateProps;

class LoginButton extends Component<LoginButtonProps> {
  openLoginModal = () => {
    this.props.launchAccountModal();
  };

  render() {
    // Busy when Redux shows a user-initiated login in progress
    const isBusy = !!this.props.loginInProgress;

    return (
      <div className={styles.navConnectContainer}>
        <Button color="none" onClick={this.openLoginModal} className={styles.navConnectButton} disabled={isBusy}>
          {!isBusy && <FontAwesomeIcon className={styles.classicLoginKey} icon={faKey} aria-hidden="true" />}
          <h1 className={styles.loginPromptText}>
            {isBusy ? <FontAwesomeIcon className={styles.loginIcon} icon={faSpinner} pulse /> : ' LOG IN '}
          </h1>
          <h1 className={styles.loginIcons}>{!isBusy && <></>}</h1>
        </Button>
      </div>
    );
  }
}

const mapStateToProps = (state: RootState): LoginButtonStateProps => ({
  loginInProgress: state.sessionState.loginInProgress,
});

export default connect(mapStateToProps)(LoginButton);
