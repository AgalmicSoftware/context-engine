import React, { useRef, useState } from 'react';
import { Button, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCheck, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import styles from './Account.module.scss';

const LOGIN_FILE_HELP =
  'A login file signs you in without a passkey. Anyone who has the file can sign in as you, so keep it private, ' +
  'and keep it: it cannot be replaced. This browser asks for the file again after 6 hours, and after you disconnect.';

/** Saves a new login file to the person's downloads. */
export const saveLoginFile = ({ name, text }: { name: string; text: string }): void => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // After the click has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Between ways to sign in: larger than the text, so each reads as its own way. */
export const OrLine = () => <div className={styles.passkeyOr}>or</div>;

/**
 * "Create login file to login without a passkey", as one of the ways to sign in. `withOr` puts an "or" above it;
 * `last` ends the sentence where nothing follows; `help` is a (?) at its end.
 */
export const CreateLoginFileLine = ({
  onClick,
  testId,
  withOr = false,
  last = false,
  help = null,
}: {
  onClick: () => void;
  testId: string;
  withOr?: boolean;
  last?: boolean;
  /** A (?) that ends the line. */
  help?: React.ReactNode;
}) => (
  <div className={styles.passkeyCopyAnswers} data-testid={testId}>
    {withOr ? <OrLine /> : null}
    <span className={styles.passkeyCopyAnswersUnbroken}>
      <Button
        type="button"
        size="sm"
        color="primary"
        className={styles.passkeyCopyAnswersButton}
        data-testid={`${testId}-button`}
        onClick={() => onClick()}
      >
        Create login file
      </Button>{' '}
      to
    </span>{' '}
    login without a{' '}
    <span className={styles.passkeyCopyAnswersUnbroken}>
      passkey{last ? '.' : ''}
      {help ? <> {help}</> : null}
    </span>
  </div>
);

type LoginFileAccessProps = {
  /** Makes a login file and saves it to the person's downloads. */
  onCreate: () => void;
  onSignIn: (text: string) => void;
  /** The name of the login file just saved: the notice about it then stands in place of every other choice. */
  savedName: string;
  /** Leaves the notice, back to the choices. */
  onBack: () => void;
};

// Sign-in for someone whose device cannot use a passkey here: a file they keep, and choose again to sign in.
// Creating one never signs in by itself: choosing the file to sign in shows that the person has it.
// Three states, one box at most: the "Other options" button; its two choices; and, once a file was saved, a notice
// that says how to sign in with it, with a way back.
const LoginFileAccess = ({ onCreate, onSignIn, savedName, onBack }: LoginFileAccessProps) => {
  const [opened, setOpened] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const chooseFile = (
    <Button
      type="button"
      size="sm"
      color="primary"
      className={styles.passkeyCopyAnswersButton}
      data-testid="ce-login-file-choose"
      onClick={() => input.current?.click()}
    >
      Login with file
    </Button>
  );
  const help = (
    <>
      <button
        type="button"
        id="ce-login-file-help"
        className={styles.passkeyWalletStatusHelp}
        data-ce-control-appearance="frameless"
        aria-label="About login files"
        aria-describedby="ce-login-file-about"
      >
        <FontAwesomeIcon icon={faQuestionCircle} />
      </button>
      <span id="ce-login-file-about" hidden>
        {LOGIN_FILE_HELP}
      </span>
      <UncontrolledTooltip
        target="ce-login-file-help"
        placement="top"
        trigger="hover focus"
        autohide={false}
        className={styles.networkTooltip}
      >
        {LOGIN_FILE_HELP}
      </UncontrolledTooltip>
    </>
  );
  const fileInput = (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,.txt,application/json,text/plain"
        hidden
        data-testid="ce-login-file-input"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          // Cleared, so choosing the same file again is a change too.
          event.target.value = '';
          if (!file) return;
          setUnreadable(false);
          try {
            // A login file is a few hundred bytes; something far larger was chosen by mistake.
            if (file.size > 64 * 1024) throw new Error('too large');
            onSignIn(await file.text());
          } catch (_) {
            setUnreadable(true);
          }
        }}
      />
      <div aria-live="polite">{unreadable ? 'That file could not be read.' : null}</div>
    </>
  );

  if (savedName) {
    return (
      <div className={styles.passkeyWalletStatus} data-testid="ce-login-file">
        <div className={styles.loginFileBackRow}>
          <button
            type="button"
            className={styles.loginFileBack}
            data-ce-control-appearance="frameless"
            data-testid="ce-login-file-back"
            onClick={onBack}
          >
            <FontAwesomeIcon icon={faArrowLeft} /> Back
          </button>
        </div>
        <div role="status" className={styles.loginFileSaved} data-testid="ce-login-file-saved">
          <FontAwesomeIcon icon={faCheck} className={styles.passkeyCopiedMark} />
          Saved {savedName} to your downloads.
        </div>
        <div className={styles.passkeyCopyAnswers}>
          Keep it safe. To login, here or on another device,{' '}
          <span className={styles.passkeyCopyAnswersUnbroken}>
            choose it with {chooseFile} {help}
          </span>
        </div>
        {fileInput}
      </div>
    );
  }
  if (!opened) {
    return (
      // In the status box, whose text reads on the dialog in every theme.
      <div className={styles.passkeyWalletStatus}>
        <button
          type="button"
          className={styles.loginFileToggle}
          data-ce-control-appearance="frameless"
          data-testid="ce-login-file-open"
          aria-expanded={false}
          onClick={() => setOpened(true)}
        >
          Other options
        </button>
      </div>
    );
  }
  return (
    <div className={styles.passkeyWalletStatus} data-testid="ce-login-file">
      <CreateLoginFileLine onClick={onCreate} testId="ce-login-file-create" help={help} />
      <div className={styles.passkeyCopyAnswers}>
        <OrLine />
        <span className={styles.passkeyCopyAnswersUnbroken}>{chooseFile} if</span> you have one.
      </div>
      {fileInput}
    </div>
  );
};

export default LoginFileAccess;
