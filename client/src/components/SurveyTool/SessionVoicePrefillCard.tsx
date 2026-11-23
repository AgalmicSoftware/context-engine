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
const CAN_SUBMIT_ABOUT = 'If checked, the prompt can hold a key and the AI can act on your behalf.';
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

// Said on the card when the box is ticked and the prompt still has no key.
export const NO_KEY_YET = 'The prompt has no AI key yet.';
export const DRAFT_ONLY_SESSION = 'This session lets an AI draft only, so the prompt has no key.';

/**
 * The voice chooser's own-AI option: a prompt to paste into ChatGPT or Claude. Signed in, where the session
 * gives AI keys, ticking "AI can submit for me" puts the person's key in the prompt, so their AI can submit
 * as them; unticked, as it starts, no key is made.
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
  // Unticked to start with: the prompt then only drafts, and no key is made or copied.
  const [canSubmit, setCanSubmit] = useState(false);
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
    keysOffered && Boolean(account) && Boolean(worker) && canSubmit,
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
    // Another person starts where everyone does: drafting only.
    setCanSubmit(false);
  }, [account]);
  // After Sign Agents Out the card is back where it starts: drafting only.
  const { signOuts } = agentKey;
  useEffect(() => {
    if (signOuts) setCanSubmit(false);
  }, [signOuts]);
  useEffect(
    () => () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    },
    [],
  );

  if (!prefill) return null;
  const noteCopied = () => {
    agentKey.markCopied();
    setPromptCopied(true);
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => setPromptCopied(false), 1800);
  };
  const copyPrompt = async (prompt: string) => {
    setPromptCopied(false);
    if (!(await copyText(prompt))) return false;
    noteCopied();
    return true;
  };
  // A key that was copied works until its time, wherever it was pasted, so the line stays while it does.
  const expiry = agentKey.copiedUntil
    ? new Date(agentKey.copiedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  return (
    <section
      className={styles.sessionVoicePrefill}
      aria-labelledby="ce-session-voice-prefill-title"
      data-testid={E2E_TESTIDS.SESSION_VOICE_PREFILL}
    >
      <div className={styles.sessionVoicePrefillHeading}>
        <h3 id="ce-session-voice-prefill-title">Have AI draft your answers</h3>
        <Help id="ce-session-voice-prefill-help" label="About having AI draft your answers">
          {PREFILL_ABOUT}
        </Help>
      </div>
      {keysOffered && account ? (
        <div className={styles.sessionVoicePrefillChoice}>
          <label>
            <input
              type="checkbox"
              checked={canSubmit}
              onChange={(event) => {
                // Ticking is the tap that lets a key be made, after Sign Agents Out too. Unticked again, the key
                // leaves the prompt and this page; one already copied still works.
                if (event.target.checked) agentKey.resume();
                else agentKey.forget();
                setCanSubmit(event.target.checked);
              }}
              aria-describedby="ce-session-voice-prefill-submit-help-about"
              data-testid={E2E_TESTIDS.SESSION_VOICE_PREFILL_CAN_SUBMIT}
            />
            AI can submit for me
          </label>
          <Help id="ce-session-voice-prefill-submit-help" label="About letting AI submit for you">
            {CAN_SUBMIT_ABOUT}
          </Help>
        </div>
      ) : null}
      <SessionInterviewMemoryKickoffCard
        // Another account is checked afresh, for its own ticket.
        key={prefill.accountKey}
        kickoff={prefill.kickoff}
        validateKickoff={prefill.validateKickoff}
        promptCopied={promptCopied}
        onCopyPrompt={copyPrompt}
        // The prompt is about to take the key: a copy now would give the one without it.
        holdCopy={keysOffered && account && canSubmit && (!worker || agentKey.making) ? 'Adding your AI key…' : ''}
        onCopiedByHand={noteCopied}
      >
        {/* Ticked, but the prompt has no key: said, so a copy without one is never a surprise. The status
            region stays in the page, so a screen reader hears its first message; what went wrong when the
            person asked is an alert; the button is beside them, not read out with them. */}
        <div className={styles.sessionVoicePrefillChoice}>
          <div role="status">
            {canSubmit && agentKey.keyMissing && !agentKey.error ? (
              <span data-testid={E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_MISSING}>{NO_KEY_YET}</span>
            ) : null}
            {canSubmit && agentKey.draftOnly ? (
              <span data-testid={E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_MISSING}>{DRAFT_ONLY_SESSION}</span>
            ) : null}
          </div>
          {canSubmit && agentKey.keyMissing && agentKey.error ? (
            <div role="alert" data-testid={E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_MISSING}>
              {agentKey.error}
            </div>
          ) : null}
          {canSubmit && agentKey.keyMissing ? (
            <button type="button" className={styles.sessionVoicePrefillAddKey} onClick={agentKey.ask}>
              Add my AI key
            </button>
          ) : null}
        </div>
        {expiry ? (
          <div className={styles.sessionVoicePrefillChoice} data-testid={E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE}>
            <span>Key can answer as you until {expiry}</span>
            <Help id="ce-session-voice-prefill-key-help" label="About your AI key">
              {KEY_ABOUT}
            </Help>
          </div>
        ) : null}
      </SessionInterviewMemoryKickoffCard>
    </section>
  );
}
