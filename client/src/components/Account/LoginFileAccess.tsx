import React, { useRef, useState } from 'react';
import { Button, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
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

type LoginFileAccessProps = {
  /** Makes a login file and saves it to the person's downloads. */
  onCreate: () => void;
  onSignIn: (text: string) => void;
  /** The name of the login file just saved; with one, the choices are open and say what to do next. */
  savedName: string;
};

// Sign-in for someone whose device cannot use a passkey here: a file they keep, and choose again to sign in.
// Creating one never signs in by itself: choosing the file to sign in shows that the person has it.
const LoginFileAccess = ({ onCreate, onSignIn, savedName }: LoginFileAccessProps) => {
  const [opened, setOpened] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  if (!opened && !savedName) {
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
      <div className={styles.passkeyAnotherDevice}>
        <span className={styles.passkeyCopyAnswersUnbroken}>
          <Button
            type="button"
            size="sm"
            color="primary"
            className={styles.passkeyCopyAnswersButton}
            data-testid="ce-login-file-create"
            onClick={onCreate}
          >
            Create login file
          </Button>{' '}
          and
        </span>{' '}
        keep it{' '}
        <span className={styles.passkeyCopyAnswersUnbroken}>
          safe.{' '}
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
        </span>
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
      </div>
      <div>
        <span className={styles.passkeyCopyAnswersUnbroken}>
          Then{' '}
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
        </span>
      </div>
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
      <div aria-live="polite" className={styles.loginFileSaved} data-testid="ce-login-file-saved">
        {savedName ? `Saved ${savedName} to your downloads. Now login with it.` : null}
      </div>
      <div aria-live="polite">{unreadable ? 'That file could not be read.' : null}</div>
    </div>
  );
};

export default LoginFileAccess;
