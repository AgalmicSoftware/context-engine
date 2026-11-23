import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { copyText } from '../../utilities/ui/copyText';
import { requestAgentDelegateKey } from '../../utilities/session/agentHandoff';
import { isSessionModeProfileAgentHttpEnabled } from '../../utilities/session/sessionModeProfile';
import { useAgentKey } from '../../utilities/session/useAgentKey';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth';
import SessionInterviewMemoryKickoffCard from './SessionInterviewMemoryKickoffCard';
import { useSessionPrefillKickoff } from './useSessionPrefillKickoff';
import styles from './SurveyTool.module.scss';

const PREFILL_ABOUT =
  'Your AI drafts answers from what it knows about you, and you review them here before anything is submitted.';
const KEY_ABOUT =
  'The prompt holds a key to this session. With it an AI can submit answers as you; yours is told to show you its answers and wait for your yes, but nothing stops whoever holds the prompt. Paste it only into your own AI: a chat app keeps what you paste in its history. The key ends with your sign-in, or when you sign agents out.';

type Props = {
  sessionSlug?: string;
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  questionPool?: unknown[];
  existingResponseSlice?: Record<string, unknown> | null;
};

// A short label's "?": its words show on hover and focus. Tooltips aren't read out, so screen readers get the
// description from a hidden span, with its control only: `aria-describedby` still reads hidden text.
const Help = ({ id, label, children }: { id: string; label: string; children: ReactNode }) => (
  <>
    <button
      type="button"
      id={id}
      className={styles.sessionInterviewHeaderButton}
      data-ce-control-appearance="frameless"
      aria-label={label}
      aria-describedby={`${id}-about`}
    >
      <FontAwesomeIcon icon={faQuestionCircle} />
    </button>
    <span id={`${id}-about`} hidden>
      {children}
    </span>
    <UncontrolledTooltip target={id} placement="top" trigger="hover focus" autohide={false}>
      {children}
    </UncontrolledTooltip>
  </>
);

/**
 * The voice chooser's own-AI option: a prompt to paste into ChatGPT or Claude. Signed in, where the session
 * gives AI keys, the prompt holds the person's key, so their AI can ask whether to draft or to submit as them.
 */
export default function SessionVoicePrefillCard({
  sessionSlug = '',
  sessionConfig,
  context,
  workerUrl,
  questionPool,
  existingResponseSlice,
}: Props) {
  const [promptCopied, setPromptCopied] = useState(false);
  // The key of the prompt last copied: the line about it shows only once that prompt has been copied.
  const [copiedKey, setCopiedKey] = useState('');
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const account = String((context as { account?: unknown } | null | undefined)?.account || '');
  const keysOffered = isSessionModeProfileAgentHttpEnabled(sessionConfig);
  // The key is asked of the session's Worker, which the prompt below finds; none is asked for before then.
  const [worker, setWorker] = useState('');
  const agentKey = useAgentKey(
    async ({ prompt }) => {
      // Signed in to the Worker the key is asked of, so the sign-in goes to no other.
      const workerToken = await getWorkerSessionToken({
        sessionSlug,
        sessionConfig,
        context,
        workerUrl: worker,
        prompt,
      });
      if (!workerToken) throw new Error('sign in to this session first');
      return requestAgentDelegateKey({ agentWorkerUrl: worker, sessionSlug, workerToken });
    },
    keysOffered && Boolean(account) && Boolean(worker),
  );
  const sessionName = String(sessionConfig?.sessionName || '').trim();
  const { kickoff: prefill, workerUrl: foundWorker } = useSessionPrefillKickoff({
    sessionSlug,
    sessionConfig,
    context,
    workerUrl,
    questionPool,
    existingResponseSlice,
    // A prompt that lets an AI submit names its session, so it can't take another for it.
    sessionName: agentKey.promptKey ? sessionName || sessionSlug : undefined,
    agentKeysOffered: keysOffered,
    agentKey: agentKey.promptKey,
  });
  useEffect(() => setWorker(foundWorker), [foundWorker]);
  // A key made for one account never stays in the prompt for the next.
  const resetKey = useRef(agentKey.reset);
  resetKey.current = agentKey.reset;
  const firstAccount = useRef(account);
  useEffect(() => {
    if (firstAccount.current === account) return;
    firstAccount.current = account;
    resetKey.current();
  }, [account]);
  useEffect(
    () => () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    },
    [],
  );

  if (!prefill) return null;
  const copyPrompt = async (prompt: string) => {
    setPromptCopied(false);
    if (!(await copyText(prompt))) return false;
    setCopiedKey(agentKey.promptKey?.key.token || '');
    setPromptCopied(true);
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => setPromptCopied(false), 1800);
    return true;
  };
  const { promptKey } = agentKey;
  const expiry = promptKey
    ? new Date(promptKey.key.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  return (
    <section
      className={styles.sessionVoicePrefill}
      aria-labelledby="ce-session-voice-prefill-title"
      data-testid={E2E_TESTIDS.SESSION_VOICE_PREFILL}
    >
      <div className={styles.sessionVoicePrefillHeading}>
        <h3 id="ce-session-voice-prefill-title">Let your AI draft your answers</h3>
        <Help id="ce-session-voice-prefill-help" label="About letting your AI draft your answers">
          {PREFILL_ABOUT}
        </Help>
      </div>
      <SessionInterviewMemoryKickoffCard
        // Another account is checked afresh, for its own ticket.
        key={prefill.accountKey}
        kickoff={prefill.kickoff}
        validateKickoff={prefill.validateKickoff}
        promptCopied={promptCopied}
        onCopyPrompt={copyPrompt}
        // The prompt is about to take the key: a copy now would give the one without it.
        holdCopy={keysOffered && account && (!worker || agentKey.making) ? 'Adding your AI key…' : ''}
      >
        {promptKey && copiedKey === promptKey.key.token ? (
          <div className={styles.sessionVoicePrefillChoice} data-testid={E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE}>
            <span>Whoever gets this prompt can answer as you here until {expiry}</span>
            <Help id="ce-session-voice-prefill-key-help" label="About your AI key">
              {KEY_ABOUT}
            </Help>
          </div>
        ) : null}
      </SessionInterviewMemoryKickoffCard>
    </section>
  );
}
