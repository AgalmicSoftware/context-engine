import React, { useRef, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Modal } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWindowClose } from '@fortawesome/free-solid-svg-icons';
import * as passkeyWallet from '../../wallet/passkeyWallet.js';
import { createLogger } from '../../utilities/logging.js';
import styles from './Account.module.scss';
import { Help, LoginWithFileButton, PasswordField, type ChosenLoginFile } from './LoginFileAccess';

const accountLog = createLogger('account');

const DUE_HELP =
  'This browser asks for your login file again after a while. Choose the same file and your Submit goes ahead. ' +
  'A file for another account is not taken.';

const KNOWN = [
  passkeyWallet.LOGIN_FILE_OTHER_ACCOUNT_TEXT,
  passkeyWallet.LOGIN_FILE_UNREADABLE_TEXT,
  passkeyWallet.LOGIN_FILE_PASSWORD_WRONG_TEXT,
  passkeyWallet.LOGIN_FILE_PASSWORD_NEEDED_TEXT,
];

type LoginFileDueModalProps = {
  /** The account the page shows: only its own file is taken. */
  account: string;
  /** The file signed that account back in. */
  onSignedIn: () => void;
  onClose: () => void;
};

// Shown when a Submit meets a login file whose time has run out. The page still shows the account, so this is
// not a sign-in to another one: the same file, chosen here, puts the key back, and the Submit goes ahead. Closing
// it changes nothing; the unsent answers stay.
const LoginFileDueModal = ({ account, onSignedIn, onClose }: LoginFileDueModalProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [protectedFile, setProtectedFile] = useState<ChosenLoginFile | null>(null);
  const password = useRef<HTMLInputElement>(null);
  const signIn = async (text: string, filePassword?: string) => {
    setBusy(true);
    setError('');
    try {
      await passkeyWallet.signInWithLoginFile(text, filePassword, { expectedAddress: account });
      onSignedIn();
    } catch (failure) {
      accountLog.error('Login file sign-in error:', failure);
      const message = String((failure as { message?: unknown } | null)?.message || '');
      setError(KNOWN.includes(message) ? message : 'That file did not sign you in. Try again.');
      // Only a wrong password keeps the same file: for anything else the file itself is the trouble, and the
      // button to choose another comes back.
      if (message !== passkeyWallet.LOGIN_FILE_PASSWORD_WRONG_TEXT) setProtectedFile(null);
      setBusy(false);
    }
  };
  const choose = (file: ChosenLoginFile) => {
    setError('');
    if (passkeyWallet.isLoginFileProtected(file.text)) setProtectedFile(file);
    else void signIn(file.text);
  };
  return (
    <Modal
      isOpen
      modalClassName="modal-login"
      className={styles.web3ModalDialog}
      contentClassName={styles.web3ModalContent}
      centered
      toggle={onClose}
      backdrop="static"
    >
      <Card id={styles.loginModalCard} data-testid="ce-login-file-due">
        <CardHeader>
          <div className={styles.Web3SettingsModalTitle}>LOGIN FILE</div>
          <button
            aria-label="Close"
            className="close"
            type="button"
            onClick={onClose}
            data-testid="ce-login-file-due-close"
          >
            <FontAwesomeIcon id={styles.closeModalIcon} icon={faWindowClose} />
          </button>
        </CardHeader>
        <CardBody>
          <form
            className={styles.passkeyWalletStatus}
            onSubmit={(event) => {
              event.preventDefault();
              const typed = password.current?.value || '';
              if (protectedFile && typed) void signIn(protectedFile.text, typed);
              else password.current?.focus();
            }}
          >
            <div>
              Your unsent answers are{' '}
              <span className={styles.passkeyCopyAnswersUnbroken}>
                kept. <Help id="ce-login-file-due-help" label="About choosing your login file again" text={DUE_HELP} />
              </span>
            </div>
            {protectedFile ? (
              <>
                <div className={styles.passkeyCopyAnswers} data-testid="ce-login-file-due-protected">
                  <span className={styles.loginFileName}>{protectedFile.name}</span> has a password.
                </div>
                <PasswordField
                  inputRef={password}
                  autoComplete="current-password"
                  testId="ce-login-file-due-password"
                  invalidBy={error === passkeyWallet.LOGIN_FILE_PASSWORD_WRONG_TEXT ? 'ce-login-file-due-error' : ''}
                />
                <div className={styles.passkeyCopyAnswers}>
                  <Button
                    type="submit"
                    size="sm"
                    color="primary"
                    className={styles.passkeyCopyAnswersButton}
                    data-testid="ce-login-file-due-submit"
                    disabled={busy}
                  >
                    Login
                  </Button>
                </div>
              </>
            ) : (
              <div className={styles.passkeyCopyAnswers}>
                <LoginWithFileButton
                  onChoose={choose}
                  testId="ce-login-file-due-choose"
                  inputTestId="ce-login-file-due-input"
                  disabled={busy}
                />
              </div>
            )}
            <div role="alert" id="ce-login-file-due-error" data-testid="ce-login-file-due-error">
              {error}
            </div>
          </form>
        </CardBody>
      </Card>
    </Modal>
  );
};

export default LoginFileDueModal;
