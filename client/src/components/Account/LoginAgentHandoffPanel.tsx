import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faCheck, faCopy, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
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
};

type Way = 'suggest' | 'submit';

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

const OPTIONS: Array<{ way: Way; title: string; detail: string }> = [
  {
    way: 'suggest',
    title: 'Predict responses',
    detail: 'Your agent drafts your answers. You review and submit them here, on Context Engine.',
  },
  {
    way: 'submit',
    title: 'Full submit',
    detail: "Your agent submits as you. You don't need to come back to Context Engine.",
  },
];

// The two things the agent may do, as a radio group: arrow keys move between them, and each card is its label.
const WayChoice = ({ way, onChange }: { way: Way; onChange: (next: Way) => void }) => (
  <fieldset className={styles.agentHandoffOptions}>
    <legend className={styles.agentHandoffLegend}>What should it do?</legend>
    {OPTIONS.map((option) => {
      const checked = way === option.way;
      return (
        <label
          key={option.way}
          className={`${styles.agentHandoffOption} ${checked ? styles.agentHandoffOptionChecked : ''}`}
          data-testid={`ce-agent-handoff-way-${option.way}`}
        >
          <span className={styles.agentHandoffRadio}>
            <input
              type="radio"
              name="ce-agent-handoff-way"
              value={option.way}
              checked={checked}
              onChange={() => onChange(option.way)}
              aria-labelledby={`ce-agent-handoff-way-${option.way}-title`}
              aria-describedby={`ce-agent-handoff-way-${option.way}-detail`}
            />
            {checked ? <FontAwesomeIcon icon={faCheck} className={styles.agentHandoffRadioTick} /> : null}
          </span>
          <span className={styles.agentHandoffOptionText}>
            <span id={`ce-agent-handoff-way-${option.way}-title`} className={styles.agentHandoffOptionTitle}>
              {option.title}
            </span>
            <span id={`ce-agent-handoff-way-${option.way}-detail`} className={styles.agentHandoffOptionDetail}>
              {option.detail}
            </span>
          </span>
        </label>
      );
    })}
  </fieldset>
);

// "Predict responses": the voice dialog's prefill prompt, named for this session, behind one copy button.
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
  if (!ready) return <p className={styles.agentHandoffHint}>Checking {sessionName}…</p>;
  if (!kickoff) {
    return (
      <p className={styles.agentHandoffHint} data-testid="ce-agent-handoff-suggest-off">
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
    <div className={styles.agentHandoffSuggest}>
      <div className={styles.agentHandoffCopyRow}>
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
            rowClassName: styles.agentHandoffSplit,
            addon: (
              <PromptCaret
                textId="ce-agent-handoff-suggest-prompt-text"
                testId="ce-agent-handoff-suggest-prompt-expand"
                expanded={expanded}
                onToggle={() => setExpanded(!expanded)}
              />
            ),
            renderPreview: (prompt) => (
              <AgentPromptPreview
                prompt={maskPromptTicket(prompt)}
                textId="ce-agent-handoff-suggest-prompt-text"
                testId="ce-agent-handoff-suggest-prompt"
                expanded={expanded}
              />
            ),
          }}
        />
        <Help id="ce-agent-handoff-suggest-about" placement="bottom">
          Paste it into ChatGPT, Claude or another AI. It reads this session&apos;s questions, drafts answers from what
          it knows about you, and gives back a link that opens them here for you to review. No key is needed.
        </Help>
      </div>
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
}: LoginAgentHandoffPanelProps) => {
  // Starts closed so the sign-in dialog stays short; closing only hides it, so a key or choice survives.
  const [open, setOpen] = useState(false);
  const [way, setWay] = useState<Way>('suggest');
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

  const chooseWay = (next: Way) => {
    setWay(next);
    setCopyStatus('');
    setError('');
  };

  const expiry = key ? new Date(key.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const submitPrompt = key ? buildOnMyBehalfPrompt({ key, sessionName, sessionUrl, askFirst }) : '';
  const shownSubmitPrompt = key
    ? buildOnMyBehalfPrompt({ key, sessionName, sessionUrl, askFirst, shownToken: keyShown ? key.token : MASKED_KEY })
    : '';

  // Moot once the key's reply says the session doesn't let agents submit.
  const askChoice =
    key && !key.submitAnswers ? null : (
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
          Ask me if I approve
        </label>
        <Help id="ce-agent-handoff-ask-help" placement="bottom">
          Ticked, your agent shows you its answers in the chat and submits them once you say yes there. Unticked, it
          submits without asking and tells you afterwards what it submitted. The prompt you copy follows this tick.
        </Help>
      </div>
    );

  const submitSteps = !agentHttpEnabled ? (
    <p className={styles.agentHandoffHint} data-testid="ce-agent-handoff-submit-off">
      Not on in {sessionName}
      <Help id="ce-agent-handoff-off-about" placement="bottom">
        Session admins can turn on Agents (HTTP API).
      </Help>
    </p>
  ) : !key ? (
    <>
      {askChoice}
      <div className={styles.agentHandoffActions}>
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
          answers as you (once you say yes in the chat, while Ask me if I approve is ticked), where the session lets
          agents submit; otherwise it shows you drafts. It stops when your sign-in ends (within 4 hours) or when you
          make a new one. It needs an agent that can send web requests, such as Claude Code or Codex.
        </Help>
      </div>
    </>
  ) : (
    <>
      {askChoice}
      <p className={styles.agentHandoffHint} data-testid="ce-agent-handoff-expiry">
        Your key works in {sessionName} only, until {expiry}.
        <Help id="ce-agent-handoff-expiry-about" placement="bottom">
          It ends when your sign-in ends or when you make a new key. The prompt you copy holds it, so paste it only into
          your own agent.
        </Help>
      </p>
      {key.submitAnswers ? null : (
        <p className={styles.agentHandoffHint} data-testid="ce-agent-handoff-drafts-only">
          {sessionName} doesn&apos;t let agents submit, so your agent shows you drafts.
        </p>
      )}
      <div className={styles.agentHandoffCopyRow}>
        <div className={styles.agentHandoffSplit}>
          <button
            type="button"
            className={styles.agentHandoffPrimary}
            onClick={() => copy('submit-prompt', 'prompt', submitPrompt)}
            data-testid="ce-agent-handoff-submit-copy"
          >
            <FontAwesomeIcon icon={copiedStep === 'submit-prompt' ? faCheck : faCopy} />
            {copiedStep === 'submit-prompt' ? 'Copied' : 'Copy prompt'}
          </button>
          <PromptCaret
            textId="ce-agent-handoff-submit-prompt-text"
            testId="ce-agent-handoff-submit-prompt-expand"
            expanded={submitExpanded}
            onToggle={() => setSubmitExpanded(!submitExpanded)}
          />
        </div>
        <button
          type="button"
          className={styles.agentHandoffButton}
          aria-pressed={keyShown}
          aria-label="Show the key"
          onClick={() => {
            // The key sits past the prompt's start, so showing it shows all of the prompt.
            if (!keyShown) setSubmitExpanded(true);
            setKeyShown(!keyShown);
          }}
          data-testid="ce-agent-handoff-key-show"
        >
          {keyShown ? 'Hide' : 'Show'}
        </button>
      </div>
      <AgentPromptPreview
        prompt={shownSubmitPrompt}
        textId="ce-agent-handoff-submit-prompt-text"
        testId="ce-agent-handoff-submit-prompt"
        expanded={submitExpanded}
      />
    </>
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
            aria-expanded={open}
            aria-controls="ce-agent-handoff-body"
            onClick={() => setOpen((wasOpen) => !wasOpen)}
            data-testid="ce-agent-handoff-toggle"
          >
            Your AI agent
            <FontAwesomeIcon icon={open ? faCaretUp : faCaretDown} className={styles.settingsSectionChevron} />
          </button>
        </h3>
        <Help id="ce-agent-handoff-about">
          Your AI agent can work for you in this session. It can predict your responses, which come back to you as a
          link to review and submit yourself, or, with a key you make here, submit as you in full.
        </Help>
      </div>
      <div id="ce-agent-handoff-body" hidden={!open}>
        <p className={styles.agentHandoffLead}>Your agent works for you in this session.</p>
        <WayChoice way={way} onChange={chooseWay} />

        {/* Mounted only once opened: its check may ask to sign in to the session, which only an open box should. */}
        {way === 'suggest' ? (
          open ? (
            <SuggestAnswers
              sessionSlug={sessionSlug}
              sessionUrl={sessionUrl}
              sessionName={sessionName}
              sessionConfig={sessionConfig}
              context={context}
              workerUrl={workerUrl}
              onCopied={() => announce('Copied the prompt.')}
            />
          ) : null
        ) : (
          submitSteps
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
      </div>
    </section>
  );
};

export default LoginAgentHandoffPanel;
