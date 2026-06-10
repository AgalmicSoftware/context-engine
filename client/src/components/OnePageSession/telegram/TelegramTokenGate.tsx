import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import styles from '../OnePageSession.module.scss';

type TelegramTokenGateProps = {
  connected?: boolean;
  loginError?: string;
  loginInput: string;
  loginStatus?: string;
  showReentry?: boolean;
  onInputChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onToggleReentry?: () => void;
};

const TelegramTokenForm = ({
  loginError = '',
  loginInput,
  loginStatus = '',
  onInputChange,
  onSubmit,
}: TelegramTokenGateProps): React.ReactElement => (
  <form
    className={styles.telegramTokenLoginForm}
    onSubmit={onSubmit}
    data-testid="ce-session-telegram-token-login"
  >
    <label className={styles.telegramTokenLoginLabel} htmlFor="ce-session-telegram-token-input">
      Telegram bot token
    </label>
    <textarea
      id="ce-session-telegram-token-input"
      className={styles.telegramTokenLoginInput}
      value={loginInput}
      onChange={onInputChange}
      placeholder="Paste the token or the full copied bot message"
      rows={4}
      autoComplete="off"
      data-testid="ce-session-telegram-token-input"
    />
    {loginError ? (
      <div className={styles.telegramTokenLoginError} role="alert">
        {loginError}
      </div>
    ) : null}
    <button
      type="submit"
      className={styles.telegramTokenLoginButton}
      disabled={loginStatus === 'loading'}
      data-testid="ce-session-telegram-token-submit"
    >
      {loginStatus === 'loading' ? (
        <>
          <FontAwesomeIcon icon={faSpinner} spin />
          <span>Logging in...</span>
        </>
      ) : (
        <span>Log in with Telegram Token</span>
      )}
    </button>
  </form>
);

export default function TelegramTokenGate({
  connected = false,
  loginError = '',
  loginInput,
  loginStatus = '',
  showReentry = false,
  onInputChange,
  onSubmit,
  onToggleReentry,
}: TelegramTokenGateProps): React.ReactElement {
  if (!connected) {
    return (
      <TelegramTokenForm
        loginError={loginError}
        loginInput={loginInput}
        loginStatus={loginStatus}
        onInputChange={onInputChange}
        onSubmit={onSubmit}
      />
    );
  }
  return (
    <div className={styles.telegramTokenConnectedPanel}>
      <div className={styles.telegramTokenConnectedBar}>
        <span>Telegram session connected</span>
        <button
          type="button"
          className={styles.telegramTokenChangeButton}
          data-testid="ce-session-telegram-change-token"
          onClick={onToggleReentry}
        >
          Change token
        </button>
      </div>
      {showReentry ? (
        <TelegramTokenForm
          loginError={loginError}
          loginInput={loginInput}
          loginStatus={loginStatus}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
        />
      ) : null}
    </div>
  );
}
