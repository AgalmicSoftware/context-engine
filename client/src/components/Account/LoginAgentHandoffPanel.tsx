import React, { useEffect, useRef, useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faQuestionCircle, faUserCog } from '@fortawesome/free-solid-svg-icons';
import { buildAgentKeyHandover, type AgentDelegateKey } from '../../utilities/session/agentHandoff';
import { useAgentKey } from '../../utilities/session/useAgentKey';
import type { KickoffAgentKey } from '../SurveyTool/sessionInterview';
import { copyText } from '../../utilities/ui/copyText';
import SessionInterviewMemoryKickoffCard from '../SurveyTool/SessionInterviewMemoryKickoffCard';
import { useSessionPrefillKickoff } from '../SurveyTool/useSessionPrefillKickoff';
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
const TEST_IDS = {
  copy: 'ce-agent-handoff-copy',
  toggle: 'ce-agent-handoff-prompt-expand',
  prompt: 'ce-agent-handoff-prompt',
};

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
  onCopied,
  children,
}: Pick<
  LoginAgentHandoffPanelProps,
  'sessionSlug' | 'sessionUrl' | 'sessionName' | 'sessionConfig' | 'context' | 'workerUrl' | 'agentHttpEnabled'
> & {
  agentKey: KickoffAgentKey | null;
  /** The person came for their key: the prompt is the short one that hands it over. */
  keyOnly: boolean;
  /** While set, the button turns and nothing is copied: a copy then would give the prompt without the key. */
  holdCopy: string;
  /** The prompt was copied: by the button, or by selecting it in the opened box. */
  onCopied: () => void;
  /** The line about the key, under the button. */
  children: React.ReactNode;
}) => {
  const [copied, setCopied] = useState(false);
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
  const noteCopied = () => {
    setCopied(true);
    onCopied();
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1800);
  };
  const copyPrompt = async (prompt: string) => {
    setCopied(false);
    if (!(await copyText(prompt))) return false;
    noteCopied();
    return true;
  };
  return (
    <SessionInterviewMemoryKickoffCard
      // Another account is checked afresh, for its own ticket.
      key={handover ? 'handover' : kickoff?.accountKey}
      kickoff={handover || kickoff?.kickoff || ''}
      validateKickoff={handover || !kickoff ? handoverCheck.current : kickoff.validateKickoff}
      promptCopied={copied}
      onCopyPrompt={copyPrompt}
      holdCopy={holdCopy}
      onCopiedByHand={noteCopied}
      centered={keyOnly}
      testIds={TEST_IDS}
    >
      {children}
    </SessionInterviewMemoryKickoffCard>
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
  // Unticked to start with: the prompt then only drafts, and no key is made or copied. A person sent here by
  // their AI's link came for the key, so for them it starts ticked.
  const [canSubmit, setCanSubmit] = useState(promptRequested);
  const keysOffered = agentHttpEnabled && signedIn;
  // The key is made once the row is open, since only an open row should ask the session anything.
  const agentKey = useAgentKey(requestKey, keysOffered && open && canSubmit);
  const { promptKey } = agentKey;
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
    setCanSubmit(false);
    setOpen(false);
    setSignOutShown(true);
    setCopyStatus('');
  }, [agentsSignedOut]);

  // After Sign Agents Out the row is back where it starts: drafting only.
  const { signOuts } = agentKey;
  useEffect(() => {
    if (signOuts) setCanSubmit(false);
  }, [signOuts]);
  // A key that was copied works until its time, wherever it was pasted, so the line stays while it does.
  const expiry = agentKey.copiedUntil
    ? new Date(agentKey.copiedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  // The line about a key that was copied. It shows while that key works, with the copy button or without it.
  const keyLine = expiry ? (
    <p className={styles.agentHandoffHint} data-testid="ce-agent-handoff-expiry">
      Key can answer as you until {expiry}
      <Help id="ce-agent-handoff-expiry-about" placement="bottom">
        The prompt holds a key to {sessionName} only. Paste it only into your own AI: a chat app keeps what you paste in
        its history. The key ends when your sign-in ends or when you sign agents out.
      </Help>
    </p>
  ) : null;
  return (
    <section
      className={styles.agentHandoffPanel}
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
          you and gives back a link that opens them here for you to review and submit. With &quot;AI can submit for
          me&quot; ticked, the prompt also holds a key that lets an AI submit answers as you: yours is told to show you
          its answers and wait for your yes, but nothing stops whoever holds the prompt, so paste it only into your own
          AI.
        </Help>
      </div>
      <div id="ce-agent-handoff-body" className={styles.agentHandoffBody} hidden={!open}>
        {keysOffered ? (
          <div className={styles.agentHandoffCanSubmit}>
            <label>
              <input
                type="checkbox"
                checked={canSubmit}
                onChange={(event) => {
                  // Ticking is the tap that lets a key be made, after Sign Agents Out too. Unticked again, the
                  // key leaves the prompt and this page; one already copied still works.
                  if (event.target.checked) agentKey.resume();
                  else agentKey.forget();
                  setCanSubmit(event.target.checked);
                }}
                aria-describedby="ce-agent-handoff-can-submit-about-about"
                data-testid="ce-agent-handoff-can-submit"
              />
              AI can submit for me
            </label>
            <Help id="ce-agent-handoff-can-submit-about" placement="bottom">
              If checked, the prompt can hold a key and the AI can act on your behalf.
            </Help>
          </div>
        ) : null}
        {/* Mounted only once opened: its check may ask to sign in to the session, which only an open box should.
            Someone who came by the link came for the key: until there is one, nothing is offered to copy, since
            the long prompt without a key is not what their AI asked for. */}
        {open && !(promptRequested && canSubmit && agentKey.keyMissing) ? (
          <PromptCopy
            sessionSlug={sessionSlug}
            sessionUrl={sessionUrl}
            sessionName={sessionName}
            sessionConfig={sessionConfig}
            context={context}
            workerUrl={workerUrl}
            agentHttpEnabled={agentHttpEnabled}
            agentKey={promptKey}
            keyOnly={promptRequested && canSubmit}
            holdCopy={agentKey.making ? 'Adding your AI key…' : ''}
            onCopied={() => {
              agentKey.markCopied();
              setCopyStatus('Copied the prompt.');
              setCopyCount((count) => count + 1);
            }}
          >
            {keyLine}
          </PromptCopy>
        ) : open ? (
          keyLine
        ) : null}
        {/* Live regions stay mounted, so screen readers hear their first message too. */}
        <div role="alert">
          {agentKey.error ? (
            <div className={styles.agentHandoffError} data-testid="ce-agent-handoff-error">
              {agentKey.error}
            </div>
          ) : null}
        </div>
        {/* Ticked, but the prompt has no key: said, so a copy without one is never a surprise. Where the key
            needs a fresh sign-in to the session, that is the person's to start: a link or a tick alone never
            raises a signing prompt. */}
        <div role="status">
          {canSubmit && agentKey.keyMissing && !agentKey.error ? (
            <p className={styles.agentHandoffHint} data-testid="ce-agent-handoff-key-missing">
              The prompt has no AI key yet.
            </p>
          ) : null}
          {canSubmit && agentKey.draftOnly ? (
            <p className={styles.agentHandoffHint} data-testid="ce-agent-handoff-key-missing">
              This session lets an AI draft only, so the prompt has no key.
            </p>
          ) : null}
        </div>
        {/* Beside the message, not read out with it. */}
        {canSubmit && agentKey.keyMissing ? (
          <button
            type="button"
            className={styles.agentHandoffButton}
            onClick={agentKey.ask}
            data-testid="ce-agent-handoff-add-key"
          >
            Add my AI key
          </button>
        ) : null}
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
