import React, { useId, useRef, useState } from 'react';
import { Button, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCaretDown,
  faCaretUp,
  faDownload,
  faLock,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';
import styles from './Account.module.scss';

const LOGIN_FILE_HELP =
  'A login file signs you in without a passkey. Anyone who has the file can sign in as you, so keep it private, ' +
  'and keep it: it cannot be replaced. This browser asks for the file again after 6 hours, and after you disconnect. ' +
  'If no file was saved, open this page in Safari or Chrome and create it there.';

const NEW_PASSWORD_HELP =
  'With a password, the file alone cannot sign in: you type the password each time you log in with the file. ' +
  'It is never stored or sent. It cannot be recovered: if you forget it, the file is of no use.';

const FILE_PASSWORD_HELP =
  'The password was chosen when this file was created. It is never stored or sent, and it cannot be recovered.';

/** A login file the person chose: its name, to show, and its text. */
export type ChosenLoginFile = { name: string; text: string };

/** Saves a new login file to the person's downloads. */
export const saveLoginFile = ({ name, text }: { name: string; text: string }): void => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Long after the click: a phone asks before it downloads, and the address has to last until the answer.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/** Between ways to sign in: larger than the text, so each reads as its own way. */
export const OrLine = () => <div className={styles.passkeyOr}>or</div>;

export const Help = ({ id, label, text }: { id: string; label: string; text: string }) => (
  <>
    <button
      type="button"
      id={id}
      className={styles.passkeyWalletStatusHelp}
      data-ce-control-appearance="frameless"
      aria-label={label}
      aria-describedby={`${id}-about`}
    >
      <FontAwesomeIcon icon={faQuestionCircle} />
    </button>
    <span id={`${id}-about`} hidden>
      {text}
    </span>
    <UncontrolledTooltip
      target={id}
      placement="top"
      trigger="hover focus"
      autohide={false}
      className={styles.networkTooltip}
    >
      {text}
    </UncontrolledTooltip>
  </>
);

/**
 * A password box with its label and a "Show password" tick: one box and no second "confirm" one, so what was
 * typed can be read back. The box keeps what is typed to itself (it is not a controlled input, which would copy
 * the password into the page's markup); the caller reads it through `inputRef` at the moment it is used.
 */
export const PasswordField = ({
  inputRef,
  autoComplete,
  testId,
  invalidBy = '',
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  autoComplete: 'new-password' | 'current-password';
  testId: string;
  /** The id of the message that says this password was refused, when one does. */
  invalidBy?: string;
}) => {
  const [shown, setShown] = useState(false);
  return (
    <div className={styles.loginFilePasswordField}>
      <label className={styles.loginFilePasswordLabel}>
        <span>Password</span>
        <input
          ref={inputRef}
          type={shown ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          // The person just asked for this box; the keyboard may as well be ready.
          autoFocus
          aria-invalid={invalidBy ? true : undefined}
          aria-describedby={invalidBy || undefined}
          className={styles.loginFilePasswordInput}
          data-testid={testId}
        />
      </label>
      <label className={styles.loginFilePasswordCheck}>
        <input
          type="checkbox"
          checked={shown}
          onChange={(event) => setShown(event.target.checked)}
          data-testid={`${testId}-show`}
        />
        <span>Show password</span>
      </label>
    </div>
  );
};

// "Add a password", behind the caret on "Create login file" and closed at first: Create alone makes a file as before.
// Ticked, the file's words are encrypted under the password typed here, and Create waits for one. While it is ticked
// the choice stays open and Create shows a lock, so no file is made with, or without, a password unawares.
const useNewFilePassword = () => {
  const optionsId = useId();
  const [open, setOpen] = useState(false);
  const [wanted, setWanted] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const caret = (
    <Button
      type="button"
      size="sm"
      color="primary"
      className={`${styles.passkeyCopyAnswersButton} ${styles.loginFileCaret}`}
      aria-label="Login file options"
      aria-expanded={open}
      aria-controls={open ? optionsId : undefined}
      disabled={wanted}
      data-testid="ce-login-file-options"
      onClick={() => setOpen((wasOpen) => !wasOpen)}
    >
      <FontAwesomeIcon icon={open ? faCaretUp : faCaretDown} />
    </Button>
  );
  const choice = open ? (
    <div id={optionsId} className={styles.loginFilePassword} data-testid="ce-login-file-password">
      <span className={styles.passkeyCopyAnswersUnbroken}>
        <label className={styles.loginFilePasswordCheck}>
          <input
            type="checkbox"
            checked={wanted}
            onChange={(event) => setWanted(event.target.checked)}
            data-testid="ce-login-file-password-toggle"
          />
          <span>Add a password</span>
        </label>
        <Help id="ce-login-file-password-help" label="About a login file's password" text={NEW_PASSWORD_HELP} />
      </span>
      {wanted ? (
        <>
          <PasswordField inputRef={input} autoComplete="new-password" testId="ce-login-file-new-password" />
          <div className={styles.loginFilePasswordNote}>A forgotten password cannot be recovered.</div>
        </>
      ) : null}
    </div>
  ) : null;
  // The password for the file about to be made: none where the box is unticked, and `null` where it is ticked
  // with nothing typed, which points at the box instead of making a file.
  const read = (): string | undefined | null => {
    if (!wanted) return undefined;
    const typed = input.current?.value || '';
    if (typed) return typed;
    input.current?.focus();
    return null;
  };
  return { caret, choice, read, wanted };
};

type CreateLoginFile = (password?: string) => void | Promise<void>;

// The Create button, held while a file with a password is made: stretching the password takes a moment, and a
// second press would make a second file for a second account.
const CreateLoginFileButton = ({
  onCreate,
  readPassword,
  testId,
  withPassword,
}: {
  onCreate: CreateLoginFile;
  readPassword: () => string | undefined | null;
  testId: string;
  withPassword: boolean;
}) => {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      color="primary"
      className={styles.passkeyCopyAnswersButton}
      data-testid={testId}
      disabled={busy}
      onClick={() => {
        const password = readPassword();
        if (password === null) return;
        setBusy(true);
        // A failure is the caller's to show; here the button only comes back.
        void Promise.resolve(onCreate(password))
          .catch(() => undefined)
          .finally(() => setBusy(false));
      }}
    >
      Create login file
      {withPassword ? (
        <>
          <FontAwesomeIcon icon={faLock} className={styles.loginFileLock} />
          <span className={styles.srOnly}> with a password</span>
        </>
      ) : null}
    </Button>
  );
};

/**
 * "Create login file to login without a passkey", with "Add a password" behind Create's caret. `help` is a (?) at
 * the sentence's end.
 */
const CreateLoginFileLine = ({ onCreate, help }: { onCreate: CreateLoginFile; help: React.ReactNode }) => {
  const { caret, choice, read, wanted } = useNewFilePassword();
  return (
    <div className={styles.passkeyCopyAnswers} data-testid="ce-login-file-create">
      <span className={styles.passkeyCopyAnswersUnbroken}>
        <span className={styles.loginFileSplit}>
          <CreateLoginFileButton
            onCreate={onCreate}
            readPassword={read}
            testId="ce-login-file-create-button"
            withPassword={wanted}
          />
          {caret}
        </span>{' '}
        to
      </span>{' '}
      login without a <span className={styles.passkeyCopyAnswersUnbroken}>passkey {help}</span>
      {choice}
    </div>
  );
};

/**
 * "Login with file": the button, and the hidden file input it opens. The chosen file goes to `onChoose`.
 */
export const LoginWithFileButton = ({
  onChoose,
  testId,
  inputTestId,
  disabled = false,
}: {
  onChoose: (file: ChosenLoginFile) => void;
  testId: string;
  inputTestId: string;
  /** Held while a chosen file is signing in. */
  disabled?: boolean;
}) => {
  const [unreadable, setUnreadable] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        size="sm"
        color="primary"
        className={styles.passkeyCopyAnswersButton}
        data-testid={testId}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        Login with file
      </Button>
      <input
        ref={input}
        type="file"
        accept=".json,.txt,application/json,text/plain"
        hidden
        data-testid={inputTestId}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          // Cleared, so choosing the same file again is a change too.
          event.target.value = '';
          if (!file) return;
          setUnreadable(false);
          try {
            // A login file is a few hundred bytes; something far larger was chosen by mistake.
            if (file.size > 64 * 1024) throw new Error('too large');
            onChoose({ name: file.name, text: await file.text() });
          } catch (_) {
            setUnreadable(true);
          }
        }}
      />
      {unreadable ? <span role="alert"> That file could not be read.</span> : null}
    </>
  );
};

/**
 * Under a sign-in that failed: "Create login file or Login with file to login without a passkey", with "Add a
 * password" behind Create's caret. `withOr` puts an "or" above it; `last` ends the sentence where nothing follows.
 */
export const LoginFilePairLine = ({
  onCreate,
  onChoose,
  withOr,
  last,
}: {
  onCreate: CreateLoginFile;
  onChoose: (file: ChosenLoginFile) => void;
  withOr: boolean;
  last: boolean;
}) => {
  const { caret, choice, read, wanted } = useNewFilePassword();
  return (
    <div className={styles.passkeyCopyAnswers} data-testid="ce-passkey-login-file">
      {withOr ? <OrLine /> : null}
      {/* Its own line height: where the two buttons wrap, their 44px tap areas do not meet. */}
      <div className={styles.loginFilePair}>
        <span className={styles.loginFileSplit}>
          <CreateLoginFileButton
            onCreate={onCreate}
            readPassword={read}
            testId="ce-passkey-create-login-file-button"
            withPassword={wanted}
          />
          {caret}
        </span>{' '}
        <span className={styles.passkeyCopyAnswersUnbroken}>
          or{' '}
          <LoginWithFileButton
            onChoose={onChoose}
            testId="ce-passkey-login-with-file-button"
            inputTestId="ce-passkey-login-file-input"
          />
        </span>
      </div>
      to login without a passkey{last ? '.' : ''}
      {choice}
    </div>
  );
};

const BackRow = ({ onBack }: { onBack: () => void }) => (
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
);

// A chosen file that has a password: the one thing left to give. It stands in place of every other choice, as the
// notice of a new file does, and stays through a wrong password so that it can be tried again.
const PasswordPrompt = ({
  fileName,
  onPassword,
  onBack,
  refusedBy,
}: {
  fileName: string;
  onPassword: (password: string) => void;
  onBack: () => void;
  refusedBy: string;
}) => {
  const input = useRef<HTMLInputElement>(null);
  return (
    <form
      className={styles.passkeyWalletStatus}
      data-testid="ce-login-file"
      onSubmit={(event) => {
        event.preventDefault();
        const password = input.current?.value || '';
        if (password) onPassword(password);
        else input.current?.focus();
      }}
    >
      <BackRow onBack={onBack} />
      <div data-testid="ce-login-file-protected">
        <span className={styles.loginFileName}>{fileName}</span> has a{' '}
        <span className={styles.passkeyCopyAnswersUnbroken}>
          password. <Help id="ce-login-file-help" label="About this file's password" text={FILE_PASSWORD_HELP} />
        </span>
      </div>
      <PasswordField
        inputRef={input}
        autoComplete="current-password"
        testId="ce-login-file-password-input"
        invalidBy={refusedBy}
      />
      <div className={styles.passkeyCopyAnswers}>
        <Button
          type="submit"
          size="sm"
          color="primary"
          className={styles.passkeyCopyAnswersButton}
          data-testid="ce-login-file-password-submit"
        >
          Login
        </Button>
      </div>
    </form>
  );
};

type LoginFileAccessProps = {
  /** Makes a login file, with a password if one is given, and saves it to the person's downloads. */
  onCreate: CreateLoginFile;
  /** Takes the file the person chose: it signs in, or, where the file has a password, asks for it. */
  onChoose: (file: ChosenLoginFile) => void;
  /** The name of the login file just saved: the notice about it then stands in place of every other choice. */
  savedName: string;
  /** The name of a chosen file that has a password: the box then asks for it, in place of every other choice. */
  protectedName: string;
  /** Signs in with the chosen file and this password. */
  onPassword: (password: string) => void;
  /** The id of the message that says the last password was refused, when one shows. */
  passwordRefusedBy: string;
  /** Leaves the notice or the password box, back to the choices. */
  onBack: () => void;
};

// Sign-in for someone whose device cannot use a passkey here: a file they keep, and choose again to sign in.
// Creating one never signs in by itself: choosing the file to sign in shows that the person has it.
// One box at most, in one of four states: the "Other options" button; its two choices; once a file was saved, a
// notice that says how to sign in with it; and, for a chosen file that has a password, the box that asks for it.
const LoginFileAccess = ({
  onCreate,
  onChoose,
  savedName,
  protectedName,
  onPassword,
  passwordRefusedBy,
  onBack,
}: LoginFileAccessProps) => {
  const [opened, setOpened] = useState(false);
  const chooseFile = (
    <LoginWithFileButton onChoose={onChoose} testId="ce-login-file-choose" inputTestId="ce-login-file-input" />
  );
  const help = <Help id="ce-login-file-help" label="About login files" text={LOGIN_FILE_HELP} />;
  if (protectedName) {
    return (
      <PasswordPrompt fileName={protectedName} onPassword={onPassword} onBack={onBack} refusedBy={passwordRefusedBy} />
    );
  }
  if (savedName) {
    return (
      <div className={styles.passkeyWalletStatus} data-testid="ce-login-file">
        <BackRow onBack={onBack} />
        <div role="status" className={styles.loginFileSaved} data-testid="ce-login-file-saved">
          {/* Where to look, not that it worked: the page cannot tell whether the browser saved the file. */}
          <FontAwesomeIcon icon={faDownload} className={styles.passkeyCopiedMark} />
          Check your downloads for {savedName}.
        </div>
        <div className={styles.passkeyCopyAnswers}>
          Keep it safe. To login, here or on another device,{' '}
          <span className={styles.passkeyCopyAnswersUnbroken}>
            choose it with {chooseFile} {help}
          </span>
        </div>
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
      <CreateLoginFileLine onCreate={onCreate} help={help} />
      <div className={styles.passkeyCopyAnswers}>
        <OrLine />
        <span className={styles.passkeyCopyAnswersUnbroken}>{chooseFile} if</span> you have one.
      </div>
    </div>
  );
};

export default LoginFileAccess;
