import React, { Suspense } from 'react';
import { Button, CardBody } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookmark, faFingerprint, faSignOutAlt, faSpinner } from '@fortawesome/free-solid-svg-icons';
import MetaMaskLogo from 'assets/img/metamask_icon_white.png';
import styles from './Account.module.scss';

type AccountUserPageProps = {
  viewAddress?: string;
  account?: string;
  provider?: string;
  minimized?: boolean;
  network?: unknown;
  activeSessionSlug?: string;
  sessionConfig?: unknown;
  networkChainId?: unknown;
};

type LoginModalDisplayBodyProps = {
  account: string;
  activeSessionConfig: unknown;
  activeSessionSlug: string;
  handleLogout: () => void;
  handlePasskeyWalletCreate: () => void;
  handlePasskeyWalletSignIn: () => void;
  loginComplete: boolean;
  loginInProgress: boolean;
  network: unknown;
  openBookmarks: () => void;
  openCryptoModal: () => void;
  passkeyWalletStatusMessage: string;
  passkeyWalletStatusTone: string;
  provider: string;
  renderAgentTokenLoginPanel: () => React.ReactNode;
  showTestnetOnly: boolean;
};

const AccountUserPage = React.lazy(() => import('components/UserPage/UserPage')) as React.LazyExoticComponent<
  React.ComponentType<AccountUserPageProps>
>;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const LoginModalDisplayBody = ({
  account,
  activeSessionConfig,
  activeSessionSlug,
  handleLogout,
  handlePasskeyWalletCreate,
  handlePasskeyWalletSignIn,
  loginComplete,
  loginInProgress,
  network,
  openBookmarks,
  openCryptoModal,
  passkeyWalletStatusMessage,
  passkeyWalletStatusTone,
  provider,
  renderAgentTokenLoginPanel,
  showTestnetOnly,
}: LoginModalDisplayBodyProps) => {
  if (!loginComplete && !loginInProgress) {
    return (
      <CardBody>
        <div className={styles.accountWarningContainer}>
          <div className={styles.accountWarningMessage}>
            <p>
              Account is an{' '}
              <a href="https://ethereum.org/en/wallets/" target="_blank" rel="noopener noreferrer">
                Ethereum wallet
              </a>
              :
            </p>
            <ul>
              <li>controlled by you</li>
              <li>no password</li>
              {showTestnetOnly && <li>test network only</li>}
            </ul>
          </div>

          <div className={styles.passkeyButtonContainer}>
            <Button
              onClick={handlePasskeyWalletCreate}
              color="primary"
              className={`${styles.passkeyButton} ${styles.passkeyButtonPrimary}`}
            >
              <FontAwesomeIcon icon={faFingerprint} size="2x" />
              <span>Create </span>
            </Button>
            <Button
              onClick={handlePasskeyWalletSignIn}
              color="secondary"
              outline
              className={`${styles.passkeyButton} ${styles.passkeyButtonOutline}`}
            >
              <FontAwesomeIcon icon={faFingerprint} size="2x" />
              <span> Login</span>
            </Button>
          </div>
          {passkeyWalletStatusMessage && (
            <div
              className={`${styles.passkeyWalletStatus} ${
                passkeyWalletStatusTone === 'error' ? styles.passkeyWalletStatusError : ''
              }`}
              role="status"
              data-testid="ce-passkey-wallet-status"
            >
              {passkeyWalletStatusMessage}
            </div>
          )}

          {renderAgentTokenLoginPanel()}

          <button
            type="button"
            aria-label="Open Crypto Login (RainbowKit)"
            onClick={openCryptoModal}
            className={styles.cryptoLoginLink}
          >
            <img src={MetaMaskLogo} alt="MetaMask" className={styles.cryptoLoginIcon} />
          </button>
        </div>
      </CardBody>
    );
  }

  if (loginInProgress) {
    return (
      <CardBody>
        <div id={styles.loadingIconContainer}>
          <h3 id={styles.verifyingText}> logging in... </h3>
          <FontAwesomeIcon icon={faSpinner} pulse id={styles.verifyingTXloadingIcon} />
        </div>
      </CardBody>
    );
  }

  if (loginComplete) {
    return (
      <CardBody id={styles.accountModalCard}>
        <div id={styles.accountModalPanel}>
          <div className={styles.accountModalBody}>
            {account && (
              <div className={styles.accountModalProfileShell}>
                <Suspense fallback={null}>
                  <AccountUserPage
                    viewAddress={account}
                    account={account}
                    provider={provider}
                    minimized={true}
                    network={network}
                    activeSessionSlug={activeSessionSlug}
                    sessionConfig={activeSessionConfig}
                    networkChainId={asRecord(activeSessionConfig).networkChainId}
                  />
                </Suspense>
              </div>
            )}
            <div className={styles.accountModalControls}>
              <Button color="secondary" size="sm" onClick={openBookmarks} className={styles.walletButton}>
                <FontAwesomeIcon icon={faBookmark} /> Bookmarks
              </Button>
              <Button color="danger" size="sm" onClick={handleLogout} className={styles.disconnectButton}>
                <FontAwesomeIcon icon={faSignOutAlt} /> Disconnect
              </Button>
            </div>
          </div>
        </div>
      </CardBody>
    );
  }

  return (
    <CardBody>
      <p>Please log in.</p>
    </CardBody>
  );
};

export default LoginModalDisplayBody;
