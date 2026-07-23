import React from 'react';
import { Button } from 'reactstrap';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import styles from './Account.module.scss';

export type LoginAgentTokenPanelProps = {
  agentTokenError: string;
  agentTokenInput: string;
  agentTokenLoginOpen: boolean;
  agentTokenStatus: string;
  cachedEnvelope: AgentClientLoginEnvelope | null;
  onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onToggle: () => void;
};

const LoginAgentTokenPanel = ({
  agentTokenError,
  agentTokenInput,
  agentTokenLoginOpen,
  agentTokenStatus,
  cachedEnvelope,
  onInputChange,
  onSubmit,
  onToggle,
}: LoginAgentTokenPanelProps) => (
  <div className={styles.agentTokenLoginPanel} data-testid="ce-agent-token-login-panel">
    <button
      type="button"
      className={styles.agentTokenLoginToggle}
      onClick={onToggle}
      data-testid="ce-agent-token-login-toggle"
      aria-expanded={agentTokenLoginOpen}
    >
      Log in with agent token
    </button>
    {cachedEnvelope ? (
      <div className={styles.agentTokenLoginHint}>
        A Telegram client session is active in this page. Reloading requires login again.
      </div>
    ) : null}
    {agentTokenLoginOpen ? (
      <form onSubmit={onSubmit}>
        <p className={styles.agentTokenLoginCopy}>
          Only paste tokens from the Context Engine bot. Tokens grant limited access until they expire.
        </p>
        <label className={styles.agentTokenLoginLabel}>
          <span>Raw agent token</span>
          <input
            type="password"
            autoComplete="one-time-code"
            value={agentTokenInput}
            onChange={onInputChange}
            className={styles.agentTokenLoginInput}
            data-testid="ce-agent-token-login-input"
          />
        </label>
        <div className={styles.agentTokenLoginHint}>Telegram bot → /me → Create Agent Token</div>
        {agentTokenError ? (
          <div className={styles.agentTokenLoginError} role="alert" data-testid="ce-agent-token-login-error">
            {agentTokenError}
          </div>
        ) : null}
        <Button
          type="submit"
          color="primary"
          size="sm"
          disabled={agentTokenStatus === 'loading'}
          data-testid="ce-agent-token-login-submit"
        >
          {agentTokenStatus === 'loading' ? 'Logging in...' : 'Login'}
        </Button>
      </form>
    ) : null}
  </div>
);

export default LoginAgentTokenPanel;
