import React, { Suspense, useEffect, useState } from 'react';
import { Button, CardBody, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBookmark,
  faCheck,
  faFingerprint,
  faQuestionCircle,
  faSignOutAlt,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { MetaMaskLoginButton } from '../../app/runtime/walletUiRuntime.js';
import { copyText } from '../../utilities/ui/copyText';
import { buildCopyPageLink } from '../../utilities/ui/arrivalLink';
import { answersCopyTextOnOneLine, buildAnswersCopyText, countUnsavedAnswers } from '../../utilities/ui/answersHandoff';
import styles from './Account.module.scss';
import { AccountMenu, AccountMenuRow } from './AccountMenu';
import { countUnsentAnswers } from 'components/UserPage/userPageAnalyzeLink';
const AgentAccountAccessPanel = React.lazy(() => import('./AgentAccountAccessPanel'));
import LoginFileAccess, { LoginFilePairLine, OrLine, type ChosenLoginFile } from './LoginFileAccess';
import {
  LOGIN_FILE_NOT_MADE_TEXT,
  LOGIN_FILE_PASSWORD_NEEDED_TEXT,
  LOGIN_FILE_PASSWORD_WRONG_TEXT,
  LOGIN_FILE_UNREADABLE_TEXT,
  PASSKEY_CREATE_PRF_UNSUPPORTED_MESSAGE,
  PASSKEYS_UNAVAILABLE_MESSAGE,
  type PasskeyWalletActionMode,
} from './loginAndSettingsPasskeyActions';

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

// Sign-in errors that mean the passkey itself cannot be made or used in this browser, so trying again here will
// not help: no passkeys at all, no PRF, or a create or unlock the device or browser refused. A prompt that was
// closed or timed out, and the errors that point at the other button, are left out: those are fixed here.
const FIXED_HERE = /prompt closed or timed out|try the passkey again|Use Login\.|Sign in, or delete it first/;
// A status about a login file itself, by its exact words: not a passkey's problem, and never one to hide.
const LOGIN_FILE_STATUSES = [
  LOGIN_FILE_UNREADABLE_TEXT,
  LOGIN_FILE_PASSWORD_NEEDED_TEXT,
  LOGIN_FILE_PASSWORD_WRONG_TEXT,
  LOGIN_FILE_NOT_MADE_TEXT,
].flatMap((text) => [`Login failed: ${text}`, `Create failed: ${text}`]);
const isLoginFileStatus = (message: string): boolean => LOGIN_FILE_STATUSES.includes(message);
// Any sign-in that failed in the log-in window, whatever the cause: the status then offers a login file.
export const isLoginIssue = (message: string): boolean =>
  message === PASSKEYS_UNAVAILABLE_MESSAGE ||
  /^(Create|Login) failed: /.test(message) ||
  /^No passkey wallet is saved/.test(message);

export const isPasskeyProblem = (message: string): boolean =>
  message === PASSKEYS_UNAVAILABLE_MESSAGE ||
  (/^(Create|Login) failed: /.test(message) && !FIXED_HERE.test(message) && !isLoginFileStatus(message));

const COPY_ANSWERS_HELP =
  'Copies a link that holds your unsaved answers, so you can finish in a browser where sign-in works. ' +
  'The answers are in the link itself and are not sent to us. Anyone you send the link to can read them. ' +
  'A long set of answers copies as a short link and a code: send the whole message.';

// For a browser where sign-in failed after answers were drafted: the answers, to open on another device. The text
// is made ready as this shows, because a copy has to happen inside the tap itself. `where` names the place to open
// it; `otherwise` shows where this browser cannot pack the answers. The button is the first words of its sentence,
// so a copy that worked marks the button with a check rather than changing its words, and says so to screen readers.
// `afterPhoneOffer` gives it the words that follow the phone offer; `withOr` puts an "or" above it.
const CopyMyAnswers = ({
  where,
  otherwise,
  afterPhoneOffer = false,
  withOr = false,
}: {
  where: string;
  otherwise: React.ReactNode;
  afterPhoneOffer?: boolean;
  withOr?: boolean;
}) => {
  const [text, setText] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState<boolean | null>(null);
  useEffect(() => {
    let current = true;
    void buildAnswersCopyText().then((built) => current && setText(built));
    return () => {
      current = false;
    };
  }, []);
  if (text === undefined) return null;
  if (!text) return <>{otherwise}</>;
  return (
    <div className={styles.passkeyCopyAnswers} data-testid="ce-passkey-copy-answers">
      {withOr ? <OrLine /> : null}
      {/* Unbroken, the button keeps the sentence's first word and the (?) its last as the sentence wraps. */}
      <span className={styles.passkeyCopyAnswersUnbroken}>
        <Button
          type="button"
          size="sm"
          color="primary"
          className={styles.passkeyCopyAnswersButton}
          data-testid="ce-passkey-copy-answers-button"
          onClick={async () => {
            const done = await copyText(text);
            setCopied(done);
            // Offers the text to copy by hand, where the browser shows prompts. Its box holds one line.
            if (!done) window.prompt('Copy this', answersCopyTextOnOneLine(text));
          }}
        >
          {copied ? <FontAwesomeIcon icon={faCheck} className={styles.passkeyCopiedMark} /> : null}
          Copy this link
        </Button>{' '}
        {afterPhoneOffer ? 'to' : 'and'}
      </span>{' '}
      {afterPhoneOffer ? 'paste your responses on a different' : `open it ${where} to recover and submit`}{' '}
      <span className={styles.passkeyCopyAnswersUnbroken}>
        {afterPhoneOffer ? 'device.' : 'responses.'}{' '}
        <button
          type="button"
          id="ce-passkey-copy-answers-help"
          className={styles.passkeyWalletStatusHelp}
          data-ce-control-appearance="frameless"
          aria-label="About copying your answers"
          aria-describedby="ce-passkey-copy-answers-about"
        >
          <FontAwesomeIcon icon={faQuestionCircle} />
        </button>
      </span>
      <span id="ce-passkey-copy-answers-about" hidden>
        {COPY_ANSWERS_HELP}
      </span>
      <UncontrolledTooltip
        target="ce-passkey-copy-answers-help"
        placement="top"
        trigger="hover focus"
        autohide={false}
        className={styles.networkTooltip}
      >
        {COPY_ANSWERS_HELP}
      </UncontrolledTooltip>
      {copied === false ? <div>Copying isn&apos;t allowed here, so the answers could not be copied.</div> : null}
      {copied ? <span className={styles.srOnly}>Link copied.</span> : null}
    </div>
  );
};

const ANOTHER_DEVICE_HELP =
  'This device shows a QR code. Scan it with your phone\u2019s camera and save the passkey on the phone. ' +
  'After that, your phone signs you in on this device.';

// After a Create whose passkey this site cannot use (Windows Hello on a Windows without PRF, or a passkey app
// without it): the same Create, asked of a phone. It is the first of up to three options, an "or" between them:
// "Scan QR with phone to login", "Create login file to login without a passkey", and, where answers are unsaved,
// "Copy this link to paste your responses on a different device."
const UseAnotherDevice = ({ onClick }: { onClick: () => void }) => (
  <div className={styles.passkeyCopyAnswers} data-testid="ce-passkey-another-device">
    <span className={styles.passkeyCopyAnswersUnbroken}>
      <Button
        type="button"
        size="sm"
        color="primary"
        className={styles.passkeyCopyAnswersButton}
        data-testid="ce-passkey-another-device-button"
        onClick={() => onClick()}
      >
        Scan QR with phone
      </Button>{' '}
      to login{' '}
      <button
        type="button"
        id="ce-passkey-another-device-help"
        className={styles.passkeyWalletStatusHelp}
        data-ce-control-appearance="frameless"
        aria-label="About scanning with your phone"
        aria-describedby="ce-passkey-another-device-about"
      >
        <FontAwesomeIcon icon={faQuestionCircle} />
      </button>
    </span>
    <span id="ce-passkey-another-device-about" hidden>
      {ANOTHER_DEVICE_HELP}
    </span>
    <UncontrolledTooltip
      target="ce-passkey-another-device-help"
      placement="top"
      trigger="hover focus"
      autohide={false}
      className={styles.networkTooltip}
    >
      {ANOTHER_DEVICE_HELP}
    </UncontrolledTooltip>
  </div>
);

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
  onAnalyzeLinkOpened?: () => void;
};

type LoginModalDisplayBodyProps = {
  account: string;
  activeSessionConfig: unknown;
  activeSessionNetworkChainId: number | null;
  activeSessionSlug: string;
  handleLogout: () => void;
  handlePasskeyWalletCreate: () => void;
  handlePasskeyWalletCreateOnAnotherDevice: () => void;
  handlePasskeyWalletSignIn: () => void;
  handleLoginFileChosen: (file: ChosenLoginFile) => void;
  handleLoginFilePassword: (password: string) => void;
  handleLoginFileCreate: (password?: string) => void | Promise<void>;
  handleLoginFileBack: () => void;
  loginFileSavedName: string;
  loginFileProtectedName: string;
  loginComplete: boolean;
  loginInProgress: boolean;
  network: unknown;
  openBookmarks: () => void;
  closeAccountDialog: () => void;
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
  handlePasskeyWalletCreateOnAnotherDevice,
  handlePasskeyWalletSignIn,
  handleLoginFileChosen,
  handleLoginFilePassword,
  handleLoginFileCreate,
  handleLoginFileBack,
  loginFileSavedName,
  loginFileProtectedName,
  loginComplete,
  loginInProgress,
  network,
  openBookmarks,
  closeAccountDialog,
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
  const passkeysUnavailable = passkeyWalletStatusMessage === PASSKEYS_UNAVAILABLE_MESSAGE;
  const passkeyLacksPrf = passkeyWalletStatusMessage === PASSKEY_CREATE_PRF_UNSUPPORTED_MESSAGE;
  // After any sign-in that failed, the status is also the list of other ways in: it offers a login file, so
  // "Other options" is not shown beside it. A message about a login file itself stays in view on its own.
  const loginIssue = passkeyWalletStatusTone === 'error' && isLoginIssue(passkeyWalletStatusMessage);
  const aboutLoginFile = isLoginFileStatus(passkeyWalletStatusMessage);
  // Once a login file was saved from there, or one with a password was chosen, the box about it stands in place
  // of that status and its other ways out; Back brings them back.
  const loginFileBox = !!loginFileSavedName || !!loginFileProtectedName;
  const noticeReplacesStatus = loginIssue && !aboutLoginFile && loginFileBox;
  const offersLoginFile = loginIssue && !loginFileBox;
  const copiesAnswers =
    passkeyWalletStatusTone === 'error' && isPasskeyProblem(passkeyWalletStatusMessage) && countUnsavedAnswers() > 0;
  const loginFileLine = (withOr: boolean, last: boolean) => (
    <LoginFilePairLine onCreate={handleLoginFileCreate} onChoose={handleLoginFileChosen} withOr={withOr} last={last} />
  );
  if (!loginComplete && !loginInProgress) {
    return (
      <CardBody>
        <div className={styles.accountWarningContainer}>
          <div className={styles.accountWarningMessage}>
            {sessionIdentityUnavailable ? (
              <p data-testid="ce-session-identity-unavailable">
                This session&apos;s settings didn&apos;t load. Reload the page, then sign in.
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
          {passkeyWalletStatusMessage && !noticeReplacesStatus && (
            <div
              className={`${styles.passkeyWalletStatus} ${
                passkeyWalletStatusTone === 'error' ? styles.passkeyWalletStatusError : ''
              }`}
              role="status"
              id="ce-passkey-wallet-status"
              data-testid="ce-passkey-wallet-status"
            >
              {passkeyWalletStatusMessage}
              {passkeyLacksPrf ? <UseAnotherDevice onClick={handlePasskeyWalletCreateOnAnotherDevice} /> : null}
              {/* The order of the ways in: the phone, a login file, then the answers to take elsewhere. In a
                  browser without passkeys the link to another browser is the way in, so it comes first. */}
              {offersLoginFile && !passkeysUnavailable ? loginFileLine(passkeyLacksPrf, !copiesAnswers) : null}
              {/* When the passkey itself is the problem, unsaved answers can leave with the person; the plain link
                  stays for a browser without passkeys that holds none. */}
              {copiesAnswers ? (
                <CopyMyAnswers
                  afterPhoneOffer={passkeyLacksPrf}
                  withOr={offersLoginFile && !passkeysUnavailable}
                  where={passkeysUnavailable ? 'in Safari or Chrome' : 'on your phone'}
                  otherwise={passkeysUnavailable ? <CopyPageLink /> : null}
                />
              ) : passkeysUnavailable ? (
                <CopyPageLink />
              ) : null}
              {offersLoginFile && passkeysUnavailable ? loginFileLine(true, true) : null}
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

          {/* A failed sign-in's box is the other options, so "Other options" is not shown beside it. */}
          {offersLoginFile ? null : (
            <LoginFileAccess
              onCreate={handleLoginFileCreate}
              onChoose={handleLoginFileChosen}
              savedName={loginFileSavedName}
              protectedName={loginFileProtectedName}
              onPassword={handleLoginFilePassword}
              passwordRefusedBy={
                passkeyWalletStatusMessage === `Login failed: ${LOGIN_FILE_PASSWORD_WRONG_TEXT}`
                  ? 'ce-passkey-wallet-status'
                  : ''
              }
              onBack={handleLoginFileBack}
            />
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
                    onAnalyzeLinkOpened={closeAccountDialog}
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
