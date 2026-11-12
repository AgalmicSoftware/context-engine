import React, { useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import {
  AGENT_KEY_ENV,
  AgentDelegateKeyError,
  MCP_SERVER_COMMAND,
  agentDisplayName,
  buildAgentKeyCommand,
  buildMcpAddCommand,
  buildMcpJoinPrompt,
  buildOnMyBehalfPrompt,
  type AgentDelegateKey,
} from '../../utilities/session/agentHandoff';
import styles from './Account.module.scss';

export type LoginAgentHandoffPanelProps = {
  agentHttpEnabled: boolean;
  sessionUrl: string;
  requestKey: () => Promise<AgentDelegateKey>;
};

const MASKED_KEY = 'ceagt_••••••••';

const keyErrorMessage = (error: unknown): string => {
  const { reason, status } = error instanceof AgentDelegateKeyError ? error : { reason: '', status: 0 };
  if (reason === 'agent_http_disabled') return 'Agents (HTTP API) are off in this session.';
  if (reason === 'agent_delegate_person_required') return 'Sign in as yourself to make a key.';
  if (status === 401) return 'Sign in again, then make a key.';
  return "Couldn't make a key. Try again.";
};

// A short label's "?": its words show on hover and focus, and describe the button.
const Help = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <>
    <button
      type="button"
      id={id}
      className={styles.agentHandoffHelp}
      data-ce-control-appearance="frameless"
      aria-label="More about this"
      aria-describedby={`${id}-about`}
    >
      <FontAwesomeIcon icon={faQuestionCircle} />
    </button>
    <span id={`${id}-about`} hidden>
      {children}
    </span>
    {/* networkTooltip lifts it above the login modal, like the other tooltips here. */}
    <UncontrolledTooltip
      target={id}
      placement="top"
      trigger="hover focus"
      autohide={false}
      className={styles.networkTooltip}
    >
      {children}
    </UncontrolledTooltip>
  </>
);

type StepProps = {
  id: string;
  label: React.ReactNode;
  shown: string;
  copyLabel: string;
  onCopy: () => void;
  children?: React.ReactNode;
};

const Step = ({ id, label, shown, copyLabel, onCopy, children }: StepProps) => (
  <div className={styles.agentHandoffStep}>
    <div className={styles.agentHandoffStepLabel}>{label}</div>
    <code className={styles.agentHandoffCommand} data-testid={`ce-agent-handoff-${id}`}>
      {shown}
    </code>
    <div className={styles.agentHandoffActions}>
      <button
        type="button"
        className={styles.agentHandoffButton}
        onClick={onCopy}
        aria-label={copyLabel}
        data-testid={`ce-agent-handoff-${id}-copy`}
      >
        Copy
      </button>
      {children}
    </div>
  </div>
);

const LoginAgentHandoffPanel = ({ agentHttpEnabled, sessionUrl, requestKey }: LoginAgentHandoffPanelProps) => {
  const [way, setWay] = useState<'self' | 'behalf'>('self');
  const [ownerName, setOwnerName] = useState('');
  // The key lives only here, never in browser storage, and goes when the dialog closes.
  const [key, setKey] = useState<AgentDelegateKey | null>(null);
  const [keyShown, setKeyShown] = useState(false);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  // A new node for each copy, so a screen reader announces a repeated message.
  const [copyCount, setCopyCount] = useState(0);
  const displayName = agentDisplayName(ownerName);

  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`Copied the ${what}.`);
    } catch {
      setCopyStatus(`Couldn't copy the ${what}. Select it and copy it yourself.`);
    }
    setCopyCount((count) => count + 1);
  };

  const makeKey = async () => {
    setMaking(true);
    setError('');
    try {
      setKey(await requestKey());
      setKeyShown(false);
    } catch (err) {
      setError(keyErrorMessage(err));
    } finally {
      setMaking(false);
    }
  };

  const chooseWay = (next: 'self' | 'behalf') => {
    setWay(next);
    setCopyStatus('');
    setError('');
  };

  const mcpCommand = buildMcpAddCommand(displayName);
  const joinPrompt = buildMcpJoinPrompt({ sessionUrl, displayName });
  const expiry = key ? new Date(key.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <section
      className={styles.agentHandoffPanel}
      aria-labelledby="ce-agent-handoff-title"
      data-testid="ce-agent-handoff-panel"
    >
      <div className={styles.agentHandoffHeader}>
        <h3 id="ce-agent-handoff-title" className={styles.agentHandoffTitle}>
          Your AI agent
        </h3>
        <Help id="ce-agent-handoff-about">
          Bring your AI agent to this session. As itself, it takes part with its own key and name, shown as an agent. On
          your behalf, it answers as you, and submits only the answers you approve.
        </Help>
      </div>
      <div className={styles.agentHandoffChoices} role="group" aria-label="How your agent takes part">
        <button
          type="button"
          className={styles.agentHandoffChoice}
          aria-pressed={way === 'self'}
          onClick={() => chooseWay('self')}
          data-testid="ce-agent-handoff-self"
        >
          As itself
        </button>
        <button
          type="button"
          className={styles.agentHandoffChoice}
          aria-pressed={way === 'behalf'}
          onClick={() => chooseWay('behalf')}
          data-testid="ce-agent-handoff-behalf"
        >
          On my behalf
        </button>
      </div>

      {way === 'self' ? (
        <>
          <label className={styles.agentHandoffLabel}>
            <span>Your name</span>
            <input
              type="text"
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              maxLength={60}
              autoComplete="given-name"
              className={styles.agentHandoffInput}
              data-testid="ce-agent-handoff-name"
            />
          </label>
          <Step
            id="mcp"
            label={
              <>
                1. Add the MCP
                <Help id="ce-agent-handoff-mcp-about">
                  For Claude Code. In another MCP host, add the server {MCP_SERVER_COMMAND}
                  {displayName ? `, with CE_MCP_DISPLAY_NAME set to ${displayName}` : ''}.
                </Help>
              </>
            }
            shown={mcpCommand}
            copyLabel="Copy the MCP command"
            onCopy={() => copy('command', mcpCommand)}
          />
          <Step
            id="join"
            label="2. Ask your agent"
            shown={joinPrompt}
            copyLabel="Copy the prompt"
            onCopy={() => copy('prompt', joinPrompt)}
          />
        </>
      ) : !agentHttpEnabled ? (
        <p className={styles.agentHandoffHint}>
          Not on in this session
          <Help id="ce-agent-handoff-off-about">Session admins can turn on Agents (HTTP API).</Help>
        </p>
      ) : !key ? (
        <div className={styles.agentHandoffActions}>
          <button
            type="button"
            className={styles.agentHandoffButton}
            onClick={makeKey}
            disabled={making}
            data-testid="ce-agent-handoff-make-key"
          >
            {making ? 'Making a key…' : 'Make a key'}
          </button>
          <Help id="ce-agent-handoff-key-about">
            The key lets your agent read the questions, save drafts and submit the answers you approve, as you. It stops
            when your sign-in ends or when you make a new one. It needs an agent that runs commands on your computer,
            such as Claude Code or Codex.
          </Help>
        </div>
      ) : (
        <>
          <Step
            id="key"
            label={
              <>
                1. Run in your terminal
                <Help id="ce-agent-handoff-terminal-about">
                  Then start your agent from the same terminal. It reads the key from {AGENT_KEY_ENV}, so the key never
                  goes into the chat. In PowerShell: $env:{AGENT_KEY_ENV} = &apos;…&apos;
                </Help>
              </>
            }
            shown={buildAgentKeyCommand(keyShown ? key.token : MASKED_KEY)}
            copyLabel="Copy the key command"
            onCopy={() => copy('command', buildAgentKeyCommand(key.token))}
          >
            <button
              type="button"
              className={styles.agentHandoffButton}
              aria-pressed={keyShown}
              aria-label="Show the key"
              onClick={() => setKeyShown(!keyShown)}
              data-testid="ce-agent-handoff-key-show"
            >
              Show
            </button>
          </Step>
          <p className={styles.agentHandoffHint}>Works until {expiry}</p>
          <Step
            id="behalf-prompt"
            label="2. Ask your agent"
            shown={buildOnMyBehalfPrompt(key)}
            copyLabel="Copy the prompt"
            onCopy={() => copy('prompt', buildOnMyBehalfPrompt(key))}
          />
        </>
      )}

      {/* Live regions stay mounted, so screen readers hear their first message too. */}
      <div role="alert">
        {error ? (
          <div className={styles.agentHandoffError} data-testid="ce-agent-handoff-error">
            {error}
          </div>
        ) : null}
      </div>
      <div role="status">
        {copyStatus ? (
          <div key={copyCount} className={styles.agentHandoffHint}>
            {copyStatus}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default LoginAgentHandoffPanel;
