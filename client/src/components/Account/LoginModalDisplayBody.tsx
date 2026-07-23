import React, { Suspense } from 'react';
import { Button, CardBody } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookmark, faFingerprint, faSignOutAlt, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { MetaMaskLoginButton } from '../../app/runtime/walletUiRuntime.js';
import styles from './Account.module.scss';
import type { PasskeyWalletActionMode } from './loginAndSettingsPasskeyActions';

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
  activeSessionNetworkChainId: number | null;
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
  passkeyMode: PasskeyWalletActionMode;
  provider: string;
  renderAgentTokenLoginPanel: () => React.ReactNode;
  sessionIdentityUnavailable: boolean;
  showAdvancedWalletAccess: boolean;
  showTestnetOnly: boolean;
  showWalletIdentity: boolean;
};

const AccountUserPage = React.lazy(() => import('components/UserPage/UserPage')) as React.LazyExoticComponent<
  React.ComponentType<AccountUserPageProps>
>;

const LoginModalDisplayBody = ({
  account,
  activeSessionConfig,
  activeSessionNetworkChainId,
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
  passkeyMode,
  provider,
  renderAgentTokenLoginPanel,
  sessionIdentityUnavailable,
  showAdvancedWalletAccess,
  showTestnetOnly,
  showWalletIdentity,
}: LoginModalDisplayBodyProps) => {
  if (!loginComplete && !loginInProgress) {
    return (
      <CardBody>
        <div className={styles.accountWarningContainer}>
          <div className={styles.accountWarningMessage}>
            {sessionIdentityUnavailable ? (
              <p data-testid="ce-session-identity-unavailable">
                This session&apos;s capability profile is unavailable or invalid. Reload or repair the canonical session
                configuration before using session-specific access.
              </p>
            ) : null}
            {showWalletIdentity ? (
              <p>
                Account is an{' '}
                <a href="https://ethereum.org/en/wallets/" target="_blank" rel="noopener noreferrer">
                  Ethereum wallet
                </a>
                :
              </p>
            ) : (
              <p>Account uses a passkey:</p>
            )}
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
              data-testid="ce-passkey-wallet-create"
            >
              <FontAwesomeIcon icon={faFingerprint} size="2x" />
              <span>Create </span>
            </Button>
            <Button
              onClick={handlePasskeyWalletSignIn}
              color="secondary"
              outline
              className={`${styles.passkeyButton} ${styles.passkeyButtonOutline}`}
              data-testid="ce-passkey-wallet-sign-in"
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

          {showAdvancedWalletAccess ? (
            <div className={styles.advancedWalletAccessNotice} data-testid="ce-advanced-wallet-access">
              <strong>Advanced on-chain access</strong>
              <span>Use an Ethereum wallet only for this session&apos;s optional on-chain gates.</span>
            </div>
          ) : null}
          {showWalletIdentity || showAdvancedWalletAccess ? (
            <MetaMaskLoginButton
              onClick={openCryptoModal}
              className={styles.cryptoLoginLink}
              iconClassName={styles.cryptoLoginIcon}
            />
          ) : null}
        </div>
      </CardBody>
    );
  }

  if (loginInProgress) {
    const progressLabel = passkeyMode === 'create' ? 'creating passkey...' : 'logging in...';
    return (
      <CardBody>
        <div id={styles.loadingIconContainer}>
          <h3 id={styles.verifyingText}>{progressLabel}</h3>
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
                    networkChainId={activeSessionNetworkChainId || undefined}
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
