import React, { Suspense, useEffect, useState } from 'react';
import { Button, CardBody, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBookmark,
  faFingerprint,
  faQuestionCircle,
  faSignOutAlt,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { MetaMaskLoginButton } from '../../app/runtime/walletUiRuntime.js';
import { copyText } from '../../utilities/ui/copyText';
import { buildCopyPageLink } from '../../utilities/ui/arrivalLink';
import styles from './Account.module.scss';
import { AccountMenu, AccountMenuRow } from './AccountMenu';
import { countUnsentAnswers } from 'components/UserPage/userPageAnalyzeLink';
const AgentAccountAccessPanel = React.lazy(() => import('./AgentAccountAccessPanel'));
import { PASSKEYS_UNAVAILABLE_MESSAGE, type PasskeyWalletActionMode } from './loginAndSettingsPasskeyActions';

// For a browser without passkeys: the same page, to paste into one that has them. The link is the one the person
// arrived with: the app has by now taken a group's invite and any drafted answers out of the address.
const CopyPageLink = () => {
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <>
      <Button
        type="button"
        size="sm"
        color="primary"
        className={styles.passkeyCopyLink}
        data-testid="ce-passkey-copy-link"
        onClick={async () => {
          const link = buildCopyPageLink();
          const done = await copyText(link);
          setCopied(done);
          // Offers the link to copy by hand, where the browser shows prompts.
          if (!done) window.prompt('Copy this link', link);
        }}
      >
        {copied ? 'Link copied' : 'Copy link'}
      </Button>
      {copied === false ? <span> Copying isn&apos;t allowed here, so the link could not be copied.</span> : null}
    </>
  );
};

type AccountUserPageProps = {
  viewAddress?: string;
  account?: string;
  provider?: string;
  minimized?: boolean;
  network?: unknown;
  activeSessionSlug?: string;
  sessionConfig?: unknown;
  networkChainId?: unknown;
  accountMenuRows?: React.ReactNode;
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
  passkeyWalletStatusHelp: string;
  passkeyMode: PasskeyWalletActionMode;
  provider: string;
  renderAgentHandoffPanel: () => React.ReactNode;
  renderAgentTokenLoginPanel: () => React.ReactNode;
  sessionIdentityUnavailable: boolean;
  showAdvancedWalletAccess: boolean;
  showTestnetOnly: boolean;
  showWalletIdentity: boolean;
};

const AccountUserPage = React.lazy(() => import('components/UserPage/UserPage')) as React.LazyExoticComponent<
  React.ComponentType<AccountUserPageProps>
>;

// Shown only once the profile is slow to load: a quick load would otherwise swap its rows, Disconnect among
// them, for the profile's own list just as they are clicked.
export const SlowFallback = ({ children }: { children: React.ReactNode }) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), 1000);
    return () => clearTimeout(timer);
  }, []);
  return shown ? <>{children}</> : null;
};

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
  passkeyWalletStatusHelp,
  passkeyMode,
  provider,
  renderAgentHandoffPanel,
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
              {passkeyWalletStatusMessage === PASSKEYS_UNAVAILABLE_MESSAGE ? <CopyPageLink /> : null}
              {passkeyWalletStatusHelp ? (
                <>
                  <button
                    type="button"
                    id="ce-passkey-wallet-status-help"
                    className={styles.passkeyWalletStatusHelp}
                    data-ce-control-appearance="frameless"
                    aria-label="What does this mean?"
                    aria-describedby="ce-passkey-wallet-status-about"
                  >
                    <FontAwesomeIcon icon={faQuestionCircle} />
                  </button>
                  <span id="ce-passkey-wallet-status-about" hidden>
                    {passkeyWalletStatusHelp}
                  </span>
                  {/* networkTooltip lifts it above the login modal, like the other tooltips here. */}
                  <UncontrolledTooltip
                    target="ce-passkey-wallet-status-help"
                    placement="top"
                    trigger="hover focus"
                    autohide={false}
                    className={styles.networkTooltip}
                  >
                    {passkeyWalletStatusHelp}
                  </UncontrolledTooltip>
                </>
              ) : null}
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
    // The dialog's rows follow the profile's own two ("Analyze me", "Set username") in one list. While the
    // profile is slow to load, Bookmarks and Disconnect show on their own, so "Disconnect" is always there; the agent row
    // waits, so it mounts once and keeps what was chosen or made in it.
    // Disconnect discards this account's unsent answers, so with any it asks once first.
    const disconnect = () => {
      const unsent = countUnsentAnswers(account || '');
      const question =
        unsent === 1
          ? 'You have 1 unsent answer. Disconnect and discard it?'
          : `You have ${unsent} unsent answers. Disconnect and discard them?`;
      if (unsent > 0 && !window.confirm(question)) return;
      handleLogout();
    };
    const menuRows = (agentRow: React.ReactNode) => (
      <>
        <AccountMenuRow icon={faBookmark} onClick={openBookmarks}>
          Bookmarks
        </AccountMenuRow>
        {agentRow ? <li className={`${styles.accountMenuItem} ${styles.accountMenuAgentRow}`}>{agentRow}</li> : null}
        <AccountMenuRow icon={faSignOutAlt} onClick={disconnect} danger testId="ce-account-disconnect">
          Disconnect
        </AccountMenuRow>
      </>
    );
    return (
      <CardBody id={styles.accountModalCard}>
        <div id={styles.accountModalPanel}>
          <div className={styles.accountModalBody}>
            {account ? (
              <div className={styles.accountModalProfileShell}>
                <Suspense
                  fallback={
                    <SlowFallback>
                      <AccountMenu>{menuRows(null)}</AccountMenu>
                    </SlowFallback>
                  }
                >
                  <AccountUserPage
                    viewAddress={account}
                    account={account}
                    provider={provider}
                    minimized={true}
                    network={network}
                    activeSessionSlug={activeSessionSlug}
                    sessionConfig={activeSessionConfig}
                    networkChainId={activeSessionNetworkChainId || undefined}
                    accountMenuRows={menuRows(renderAgentHandoffPanel())}
                  />
                </Suspense>
              </div>
            ) : (
              <AccountMenu>{menuRows(renderAgentHandoffPanel())}</AccountMenu>
            )}
            <div className={styles.accountModalControls}>
              <Suspense fallback={null}>
                <AgentAccountAccessPanel
                  provider={provider}
                  // The dialog's own button look, as Bookmarks has: a bare .btn-secondary is pale text on this panel.
                  buttonClassName={`btn btn-secondary btn-sm ${styles.walletButton}`}
                  primaryButtonClassName={`btn btn-primary btn-sm ${styles.walletButton}`}
                />
              </Suspense>
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
