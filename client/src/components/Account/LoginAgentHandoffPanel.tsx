import React, { useEffect, useRef, useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faQuestionCircle, faUserCog } from '@fortawesome/free-solid-svg-icons';
import { buildAgentKeyHandover, maskAgentKey, type AgentDelegateKey } from '../../utilities/session/agentHandoff';
import { useAgentKey } from '../../utilities/session/useAgentKey';
import type { KickoffAgentKey } from '../SurveyTool/sessionInterview';
import { copyText } from '../../utilities/ui/copyText';
import SessionInterviewMemoryKickoffCard from '../SurveyTool/SessionInterviewMemoryKickoffCard';
import { useSessionPrefillKickoff } from '../SurveyTool/useSessionPrefillKickoff';
import AgentPromptPreview, { PromptCaret, maskPromptTicket } from './AgentPromptPreview';
import styles from './Account.module.scss';

export type LoginAgentHandoffPanelProps = {
  agentHttpEnabled: boolean;
  sessionUrl: string;
  // The session's title, or its slug where it has none.
  sessionName: string;
  sessionSlug: string;
  // What the prompt needs to read the session's questions as this person.
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  /** Makes the person's AI key; `prompt` false asks them nothing, and fails where a sign-in would be needed. */
  requestKey: (options: { prompt: boolean }) => Promise<AgentDelegateKey>;
  /** "Sign Agents Out", under the prompt. */
  signAgentsOut?: React.ReactNode;
  /** Counts each Sign Agents Out: the key shown and the prompt's ticket are dead after one. */
  agentsSignedOut?: number;
  /** The person came by a link their AI gave them to fetch the AI prompt: the box opens on it. */
  promptRequested?: boolean;
};

// Drafts come back to this page when it is the session's own, which keeps its join link; else to the session.
const suggestReturnUrl = (sessionSlug: string, sessionUrl: string): string | undefined => {
  if (typeof window === 'undefined') return sessionUrl;
  const parts = window.location.pathname.split('/').filter(Boolean);
  let pageSlug = '';
  try {
    pageSlug = parts.at(-2) === 'session' ? decodeURIComponent(parts.at(-1) || '') : '';
  } catch {
    // A malformed path is not the session's page.
  }
  // The Worker matches the slug without case, as the dialog's slug is lowercased.
  return pageSlug && pageSlug.toLowerCase() === sessionSlug.toLowerCase() ? undefined : sessionUrl;
};

// A short label's "?": its words show on hover and focus, and describe the button. Below, where above would
// cover the controls it explains.
const Help = ({
  id,
  placement = 'top',
  children,
}: {
  id: string;
  placement?: 'top' | 'bottom';
  children: React.ReactNode;
}) => (
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
      placement={placement}
      trigger="hover focus"
      autohide={false}
      className={styles.networkTooltip}
    >
      {children}
    </UncontrolledTooltip>
  </>
);

const LABEL = 'Your AI agent';

// The AI prompt behind one split copy button, whose caret opens it to read.
const PromptCopy = ({
  sessionSlug,
  sessionUrl,
  sessionName,
  sessionConfig,
  context,
  workerUrl,
  agentHttpEnabled,
  agentKey,
  keyOnly,
  holdCopy,
  keyShown,
  tools,
  onCopied,
}: Pick<
  LoginAgentHandoffPanelProps,
  'sessionSlug' | 'sessionUrl' | 'sessionName' | 'sessionConfig' | 'context' | 'workerUrl' | 'agentHttpEnabled'
> & {
  agentKey: KickoffAgentKey | null;
  /** The person came for their key: the prompt is the short one that hands it over. */
  keyOnly: boolean;
  /** Said in place of a copy while the key is made: a copy then would give the prompt without it. */
  holdCopy: string;
  keyShown: boolean;
  tools: React.ReactNode;
  onCopied: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  // The prompt just changed, so an earlier "Copied" no longer describes it.
  useEffect(() => setCopied(false), [agentKey?.key.token]);
  const { ready, kickoff } = useSessionPrefillKickoff({
    sessionSlug,
    sessionConfig,
    context,
    workerUrl,
    sessionUrl: suggestReturnUrl(sessionSlug, sessionUrl),
    sessionName,
    agentKeysOffered: agentHttpEnabled,
    agentKey,
  });
  // Their AI already has the steps and the questions: it asked only for the key.
  const handover = keyOnly && agentKey ? buildAgentKeyHandover({ key: agentKey.key, sessionName, sessionUrl }) : '';
  const handoverCheck = useRef(async () => undefined);
  if (!handover && !ready) return <p className={styles.agentHandoffHint}>Checking {sessionName}…</p>;
  if (!handover && !kickoff) {
    return (
      <p className={styles.agentHandoffHint} data-testid="ce-agent-handoff-off">
        Not available in {sessionName}
        <Help id="ce-agent-handoff-off-about" placement="bottom">
          The prompt reads the session&apos;s questions from its Worker, and this session has none.
        </Help>
      </p>
    );
  }
  const copyPrompt = async (prompt: string) => {
    setCopied(false);
    if (!(await copyText(prompt))) return false;
    setCopied(true);
    onCopied();
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1800);
    return true;
  };
  return (
    <div className={styles.agentHandoffKickoff}>
      <SessionInterviewMemoryKickoffCard
        // Another account is checked afresh, for its own ticket.
        key={handover ? 'handover' : kickoff?.accountKey}
        kickoff={handover || kickoff?.kickoff || ''}
        validateKickoff={handover || !kickoff ? handoverCheck.current : kickoff.validateKickoff}
        promptCopied={copied}
        showAgentPrompt={false}
        onCopyPrompt={copyPrompt}
        onTogglePrompt={() => undefined}
        holdCopy={holdCopy}
        copyButton={{
          className: styles.agentHandoffPrimary,
          testId: 'ce-agent-handoff-copy',
          rowClassName: styles.agentHandoffSplit,
          addon: (
            <PromptCaret
              textId="ce-agent-handoff-prompt-text"
              testId="ce-agent-handoff-prompt-expand"
              label={LABEL}
              expanded={expanded}
              onToggle={() => setExpanded(!expanded)}
            />
          ),
          renderPreview: (prompt) => (
            <AgentPromptPreview
              prompt={maskPromptTicket(keyShown ? prompt : maskAgentKey(prompt))}
              textId="ce-agent-handoff-prompt-text"
              testId="ce-agent-handoff-prompt"
              label={LABEL}
              expanded={expanded}
              tools={tools}
            />
          ),
        }}
      />
    </div>
  );
};

const LoginAgentHandoffPanel = ({
  agentHttpEnabled,
  sessionUrl,
  sessionName,
  sessionSlug,
  sessionConfig,
  context,
  workerUrl,
  requestKey,
  signAgentsOut = null,
  agentsSignedOut = 0,
  promptRequested = false,
}: LoginAgentHandoffPanelProps) => {
  const signedIn = Boolean((context as { account?: unknown } | null | undefined)?.account);
  // Starts closed so the sign-in dialog stays short; a link for the prompt opens it.
  const [open, setOpen] = useState(promptRequested);
  // Signed in, where the session gives keys, the prompt holds the person's: made once the row is open, since
  // only an open row should ask the session anything.
  const agentKey = useAgentKey(requestKey, agentHttpEnabled && signedIn && open);
  const { promptKey } = agentKey;
  const [keyShown, setKeyShown] = useState(false);
  // The key of the prompt last copied: the line about it shows only once that prompt has been copied.
  const [copiedKey, setCopiedKey] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  // A new node for each copy, so a screen reader announces a repeated message.
  const [copyCount, setCopyCount] = useState(0);
  // After Sign Agents Out the key is dead, so it goes, and the row closes, as reopening it is what checks the
  // session again; Sign Agents Out's message stays in view under it until the row is next closed.
  const signedOutSeen = useRef(agentsSignedOut);
  const [signOutShown, setSignOutShown] = useState(false);
  const resetKey = useRef(agentKey.reset);
  resetKey.current = agentKey.reset;
  useEffect(() => {
    if (signedOutSeen.current === agentsSignedOut) return;
    signedOutSeen.current = agentsSignedOut;
    resetKey.current();
    setOpen(false);
    setSignOutShown(true);
    setKeyShown(false);
    setCopyStatus('');
  }, [agentsSignedOut]);

  const expiry = promptKey
    ? new Date(promptKey.key.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  return (
    <section
      className={
        promptRequested && signedIn
          ? `${styles.agentHandoffPanel} ${styles.agentHandoffArrived}`
          : styles.agentHandoffPanel
      }
      aria-labelledby="ce-agent-handoff-title"
      data-testid="ce-agent-handoff-panel"
    >
      <div className={styles.agentHandoffHeader}>
        <h3 id="ce-agent-handoff-title" className={styles.agentHandoffTitle}>
          <button
            type="button"
            className={styles.agentHandoffToggle}
            data-ce-control-appearance="frameless"
            aria-expanded={open}
            aria-controls="ce-agent-handoff-body"
            onClick={() => {
              // Opening it again after Sign Agents Out is the tap that lets a new key be made.
              if (!open) agentKey.resume();
              setOpen(!open);
              setSignOutShown(false);
            }}
            data-testid="ce-agent-handoff-toggle"
          >
            {/* Its row's icon in the account dialog's list. */}
            <FontAwesomeIcon icon={faUserCog} className={styles.accountMenuIcon} aria-hidden="true" fixedWidth />
            {LABEL}
            <FontAwesomeIcon icon={open ? faCaretUp : faCaretDown} className={styles.settingsSectionChevron} />
          </button>
        </h3>
        <Help id="ce-agent-handoff-about">
          Copy the prompt and paste it into ChatGPT, Claude or another AI. It drafts answers from what it knows about
          you and gives back a link that opens them here for you to review and submit. Signed in, where this session
          allows it, the prompt also holds a key that lets an AI submit answers as you: yours is told to show you its
          answers and wait for your yes, but nothing stops whoever holds the prompt, so paste it only into your own AI.
        </Help>
      </div>
      <div id="ce-agent-handoff-body" className={styles.agentHandoffBody} hidden={!open}>
        {/* Mounted only once opened: its check may ask to sign in to the session, which only an open box should. */}
        {open ? (
          <PromptCopy
            sessionSlug={sessionSlug}
            sessionUrl={sessionUrl}
            sessionName={sessionName}
            sessionConfig={sessionConfig}
            context={context}
            workerUrl={workerUrl}
            agentHttpEnabled={agentHttpEnabled}
            agentKey={promptKey}
            keyOnly={promptRequested}
            holdCopy={agentKey.making ? 'Adding your AI key…' : ''}
            keyShown={keyShown}
            onCopied={() => {
              setCopiedKey(promptKey?.key.token || '');
              setCopyStatus('Copied the prompt.');
              setCopyCount((count) => count + 1);
            }}
            tools={
              promptKey ? (
                <button
                  type="button"
                  className={styles.agentHandoffButton}
                  aria-pressed={keyShown}
                  aria-label="Show the key"
                  onClick={() => setKeyShown(!keyShown)}
                  data-testid="ce-agent-handoff-key-show"
                >
                  {keyShown ? 'Hide key' : 'Show key'}
                </button>
              ) : null
            }
          />
        ) : null}
        {promptKey && copiedKey === promptKey.key.token ? (
          <p className={styles.agentHandoffHint} data-testid="ce-agent-handoff-expiry">
            Whoever gets this prompt can answer as you here until {expiry}
            <Help id="ce-agent-handoff-expiry-about" placement="bottom">
              The prompt holds a key to {sessionName} only. Paste it only into your own AI: a chat app keeps what you
              paste in its history. The key ends when your sign-in ends or when you sign agents out.
            </Help>
          </p>
        ) : null}
        {/* Someone who came by the link came for the key. Where it needs a fresh sign-in to the session, that
            is theirs to start: a link alone never raises a signing prompt. */}
        {promptRequested && agentKey.quietFailed ? (
          <button
            type="button"
            className={styles.agentHandoffButton}
            onClick={agentKey.ask}
            data-testid="ce-agent-handoff-add-key"
          >
            Add my AI key
          </button>
        ) : null}
        {/* Live regions stay mounted, so screen readers hear their first message too. */}
        <div role="alert">
          {agentKey.error ? (
            <div className={styles.agentHandoffError} data-testid="ce-agent-handoff-error">
              {agentKey.error}
            </div>
          ) : null}
        </div>
        {/* Read out only: on screen the button itself turns to "Copied". */}
        <div role="status" className={styles.srOnly}>
          {copyStatus ? <div key={copyCount}>{copyStatus}</div> : null}
        </div>
      </div>
      {/* Outside the body, in one place, so its message outlives the row closing after it is used. */}
      {signAgentsOut ? (
        <div className={styles.agentHandoffSignOut} hidden={!open && !signOutShown}>
          {signAgentsOut}
        </div>
      ) : null}
    </section>
  );
};

export default LoginAgentHandoffPanel;
