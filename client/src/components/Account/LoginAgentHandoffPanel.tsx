import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretUp,
  faCheck,
  faCopy,
  faQuestionCircle,
  faUserCog,
} from '@fortawesome/free-solid-svg-icons';
import {
  ASK_BEFORE_SUBMIT_DEFAULT,
  AgentDelegateKeyError,
  MCP_PROMPT_LINE,
  buildOnMyBehalfPrompt,
  type AgentDelegateKey,
} from '../../utilities/session/agentHandoff';
import { copyText, selectText } from '../../utilities/ui/copyText';
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
  // What the suggestions prompt needs to read the session's questions as this person.
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  requestKey: () => Promise<AgentDelegateKey>;
  /** "Sign Agents Out", under both options. */
  signAgentsOut?: React.ReactNode;
  /** Counts each Sign Agents Out: the key shown and the suggestions prompt's ticket are dead after one. */
  agentsSignedOut?: number;
};

const MASKED_KEY = 'ceagt_••••••••';

const keyErrorMessage = (error: unknown): string => {
  const { reason, status } = error instanceof AgentDelegateKeyError ? error : { reason: '', status: 0 };
  if (reason === 'agent_http_disabled') return 'Agents (HTTP API) are off in this session.';
  if (reason === 'agent_delegate_person_required') return 'Sign in as yourself to make a key.';
  if (status === 401) return 'Sign in again, then make a key.';
  return "Couldn't make a key. Try again.";
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

const SUGGEST = { id: 'ce-agent-handoff-option-suggest', title: 'Suggest answers' };
const SUBMIT = { id: 'ce-agent-handoff-option-submit', title: 'Answer for me' };

// One of the two things your agent can do: its title and one line on the left, its Copy prompt button on the
// right (under them on a phone), then its own settings and its prompt, once shown.
const AgentOption = ({
  id,
  title,
  detail,
  help = null,
  children,
}: {
  id: string;
  title: string;
  detail: string;
  help?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div
    role="group"
    aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-detail`}
    className={styles.agentHandoffOption}
    data-testid={id}
  >
    <div className={styles.agentHandoffOptionText}>
      <span className={styles.agentHandoffOptionTitleRow}>
        <span id={`${id}-title`} className={styles.agentHandoffOptionTitle}>
          {title}
        </span>
        {help}
      </span>
      <span id={`${id}-detail`} className={styles.agentHandoffOptionDetail}>
        {detail}
      </span>
    </div>
    {children}
  </div>
);

// "Suggest answers": the voice dialog's prefill prompt, named for this session, behind one split copy button.
const SuggestAnswers = ({
  sessionSlug,
  sessionUrl,
  sessionName,
  sessionConfig,
  context,
  workerUrl,
  onCopied,
}: Pick<
  LoginAgentHandoffPanelProps,
  'sessionSlug' | 'sessionUrl' | 'sessionName' | 'sessionConfig' | 'context' | 'workerUrl'
> & { onCopied: () => void }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  const { ready, kickoff } = useSessionPrefillKickoff({
    sessionSlug,
    sessionConfig,
    context,
    workerUrl,
    sessionUrl: suggestReturnUrl(sessionSlug, sessionUrl),
    sessionName,
    note: MCP_PROMPT_LINE,
  });
  if (!ready)
    return <p className={`${styles.agentHandoffHint} ${styles.agentHandoffOptionSlot}`}>Checking {sessionName}…</p>;
  if (!kickoff) {
    return (
      <p
        className={`${styles.agentHandoffHint} ${styles.agentHandoffOptionSlot}`}
        data-testid="ce-agent-handoff-suggest-off"
      >
        Not available in {sessionName}
        <Help id="ce-agent-handoff-suggest-off-about" placement="bottom">
          Suggestions read the session&apos;s questions from its Worker, and this session has none.
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
        key={kickoff.accountKey}
        kickoff={kickoff.kickoff}
        validateKickoff={kickoff.validateKickoff}
        promptCopied={copied}
        showAgentPrompt={false}
        onCopyPrompt={copyPrompt}
        onTogglePrompt={() => undefined}
        copyButton={{
          className: styles.agentHandoffPrimary,
          testId: 'ce-agent-handoff-suggest-copy',
          ariaLabel: `Copy prompt: ${SUGGEST.title}`,
          rowClassName: `${styles.agentHandoffSplit} ${styles.agentHandoffOptionSlot}`,
          addon: (
            <PromptCaret
              textId="ce-agent-handoff-suggest-prompt-text"
              testId="ce-agent-handoff-suggest-prompt-expand"
              label={SUGGEST.title}
              expanded={expanded}
              onToggle={() => setExpanded(!expanded)}
            />
          ),
          renderPreview: (prompt) => (
            <AgentPromptPreview
              prompt={maskPromptTicket(prompt)}
              textId="ce-agent-handoff-suggest-prompt-text"
              testId="ce-agent-handoff-suggest-prompt"
              label={SUGGEST.title}
              expanded={expanded}
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
}: LoginAgentHandoffPanelProps) => {
  // Starts closed so the sign-in dialog stays short; closing only hides it, so a key or tick survives.
  const [open, setOpen] = useState(false);
  // The key lives only here, never in browser storage, and goes when the dialog closes.
  const [key, setKey] = useState<AgentDelegateKey | null>(null);
  const [keyShown, setKeyShown] = useState(false);
  const [submitExpanded, setSubmitExpanded] = useState(false);
  const [askFirst, setAskFirst] = useState(ASK_BEFORE_SUBMIT_DEFAULT);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  // A new node for each copy, so a screen reader announces a repeated message.
  const [copyCount, setCopyCount] = useState(0);
  // The step whose icon shows a tick, for a moment after it was copied.
  const [copiedStep, setCopiedStep] = useState('');
  // The step whose text is selected, once shown, because copying it was refused.
  const [selectStep, setSelectStep] = useState('');
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  // After Sign Agents Out the key is dead, so it goes; the row stays open, with Sign Agents Out's message.
  const signedOutSeen = useRef(agentsSignedOut);
  useEffect(() => {
    if (signedOutSeen.current === agentsSignedOut) return;
    signedOutSeen.current = agentsSignedOut;
    setKey(null);
    setKeyShown(false);
    setSubmitExpanded(false);
    setCopyStatus('');
    setCopiedStep('');
  }, [agentsSignedOut]);

  const announce = (message: string) => {
    setCopyStatus(message);
    setCopyCount((count) => count + 1);
  };

  const copy = async (step: string, what: string, text: string) => {
    clearTimeout(copiedTimer.current);
    setCopiedStep('');
    if (await copyText(text)) {
      announce(`Copied the ${what}.`);
      setCopiedStep(step);
      copiedTimer.current = setTimeout(() => setCopiedStep(''), 1800);
    } else {
      announce(`Copying isn't allowed here, so the ${what} is selected. Copy it yourself.`);
      // A hidden key is shown, and the whole prompt, since the masked or shortened one is no use to copy.
      if (step === 'submit-prompt') {
        setKeyShown(true);
        setSubmitExpanded(true);
      }
      setSelectStep(step);
    }
  };
  useLayoutEffect(() => {
    if (!selectStep) return;
    setSelectStep('');
    selectText(document.getElementById(`ce-agent-handoff-${selectStep}-text`));
  }, [selectStep]);

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

  const expiry = key ? new Date(key.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const submitPrompt = key ? buildOnMyBehalfPrompt({ key, sessionName, sessionUrl, askFirst }) : '';
  const shownSubmitPrompt = key
    ? buildOnMyBehalfPrompt({ key, sessionName, sessionUrl, askFirst, shownToken: keyShown ? key.token : MASKED_KEY })
    : '';

  // Moot while agents are off, and once the key's reply says the session doesn't let agents submit.
  const askChoice =
    !agentHttpEnabled || (key && !key.submitAnswers) ? null : (
      <div className={styles.agentHandoffAskRow}>
        <label className={styles.agentHandoffAsk} data-testid="ce-agent-handoff-ask">
          <span className={`${styles.agentHandoffRadio} ${styles.agentHandoffCheck}`}>
            <input
              type="checkbox"
              checked={askFirst}
              onChange={(event) => {
                setAskFirst(event.target.checked);
                setCopyStatus('');
                // The prompt just changed, so an earlier "Copied" no longer describes it.
                clearTimeout(copiedTimer.current);
                setCopiedStep('');
              }}
              aria-describedby="ce-agent-handoff-ask-help-about"
            />
            {askFirst ? <FontAwesomeIcon icon={faCheck} className={styles.agentHandoffRadioTick} /> : null}
          </span>
          Ask me before submitting
        </label>
        <Help id="ce-agent-handoff-ask-help" placement="bottom">
          Ticked, your agent shows you its answers in the chat and submits them once you say yes there. Unticked, it
          submits without asking and tells you afterwards what it submitted. The prompt you copy follows this tick.
        </Help>
      </div>
    );

  // In the Copy prompt button's place: what is missing first, while the session is off or there is no key yet.
  const submitAction = !agentHttpEnabled ? (
    <p
      className={`${styles.agentHandoffHint} ${styles.agentHandoffOptionSlot}`}
      data-testid="ce-agent-handoff-submit-off"
    >
      Not on in {sessionName}
      <Help id="ce-agent-handoff-off-about" placement="bottom">
        Session admins can turn on Agents (HTTP API).
      </Help>
    </p>
  ) : !key ? (
    <div className={`${styles.agentHandoffActions} ${styles.agentHandoffOptionSlot}`}>
      <button
        type="button"
        className={styles.agentHandoffPrimary}
        onClick={makeKey}
        disabled={making}
        data-testid="ce-agent-handoff-make-key"
      >
        {making ? 'Making a key…' : 'Make a key'}
      </button>
      <Help id="ce-agent-handoff-key-about" placement="bottom">
        The key goes into the prompt you copy. With it, your agent reads this session&apos;s questions and submits
        answers as you (once you say yes in the chat, while Ask me before submitting is ticked), where the session lets
        agents submit; otherwise it shows you drafts. It stops when your sign-in ends (within 4 hours) or when you make
        a new one. It needs an agent that can send web requests, such as Claude Code or Codex.
      </Help>
    </div>
  ) : (
    <div className={`${styles.agentHandoffSplit} ${styles.agentHandoffOptionSlot}`}>
      <button
        type="button"
        className={styles.agentHandoffPrimary}
        onClick={() => copy('submit-prompt', 'prompt', submitPrompt)}
        aria-label={`Copy prompt: ${SUBMIT.title}`}
        data-testid="ce-agent-handoff-submit-copy"
      >
        <FontAwesomeIcon icon={copiedStep === 'submit-prompt' ? faCheck : faCopy} />
        {copiedStep === 'submit-prompt' ? 'Copied' : 'Copy prompt'}
      </button>
      <PromptCaret
        textId="ce-agent-handoff-submit-prompt-text"
        testId="ce-agent-handoff-submit-prompt-expand"
        label={SUBMIT.title}
        expanded={submitExpanded}
        onToggle={() => setSubmitExpanded(!submitExpanded)}
      />
    </div>
  );

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
            onClick={() => setOpen((wasOpen) => !wasOpen)}
            data-testid="ce-agent-handoff-toggle"
          >
            {/* Its row's icon in the account dialog's list. */}
            <FontAwesomeIcon icon={faUserCog} className={styles.accountMenuIcon} aria-hidden="true" fixedWidth />
            Your AI agent
            <FontAwesomeIcon icon={open ? faCaretUp : faCaretDown} className={styles.settingsSectionChevron} />
          </button>
        </h3>
        <Help id="ce-agent-handoff-about">
          Your AI agent can work for you in this session. It can suggest your answers, which come back to you as a link
          to review and submit yourself, or, with a key you make here, answer for you in full.
        </Help>
      </div>
      <div id="ce-agent-handoff-body" hidden={!open}>
        <AgentOption
          id={SUGGEST.id}
          title={SUGGEST.title}
          detail="Your AI drafts answers for you to review"
          help={
            <Help id="ce-agent-handoff-suggest-about" placement="bottom">
              Paste it into ChatGPT, Claude or another AI. It reads this session&apos;s questions, drafts answers from
              what it knows about you, and gives back a link that opens them here for you to review. No key is needed.
            </Help>
          }
        >
          {/* Mounted only once opened: its check may ask to sign in to the session, which only an open box should. */}
          {open ? (
            <SuggestAnswers
              // Checked afresh after Sign Agents Out, for a new ticket.
              key={agentsSignedOut}
              sessionSlug={sessionSlug}
              sessionUrl={sessionUrl}
              sessionName={sessionName}
              sessionConfig={sessionConfig}
              context={context}
              workerUrl={workerUrl}
              onCopied={() => announce('Copied the prompt.')}
            />
          ) : null}
        </AgentOption>

        <AgentOption id={SUBMIT.id} title={SUBMIT.title} detail="Your AI submits answers as you">
          {askChoice}
          {submitAction}
          {key ? (
            <p className={styles.agentHandoffHint} data-testid="ce-agent-handoff-expiry">
              Your key works in {sessionName} only, until {expiry}.
              <Help id="ce-agent-handoff-expiry-about" placement="bottom">
                It ends when your sign-in ends or when you make a new key. The prompt you copy holds it, so paste it
                only into your own agent.
              </Help>
            </p>
          ) : null}
          {key && !key.submitAnswers ? (
            <p className={styles.agentHandoffHint} data-testid="ce-agent-handoff-drafts-only">
              {sessionName} doesn&apos;t let agents submit, so your agent shows you drafts.
            </p>
          ) : null}
          {key ? (
            <AgentPromptPreview
              prompt={shownSubmitPrompt}
              textId="ce-agent-handoff-submit-prompt-text"
              testId="ce-agent-handoff-submit-prompt"
              label={SUBMIT.title}
              expanded={open && submitExpanded}
              tools={
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
              }
            />
          ) : null}
        </AgentOption>

        {signAgentsOut ? <div className={styles.agentHandoffSignOut}>{signAgentsOut}</div> : null}

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
      </div>
    </section>
  );
};

export default LoginAgentHandoffPanel;
