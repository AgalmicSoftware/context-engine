import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faCheck, faCopy, faSpinner } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import AiPromptBox from '../Shared/AiPromptBox';
import { findPromptVariables } from './aiPromptVariables';
import { InterviewBusyLabel } from './SessionInterviewModalHeader';

/** The prompt a check approved, when it differs from `kickoff`, and when to check again before its link runs out. */
export type ValidatedKickoff = { prompt: string; renewAtMs?: number };

type SessionInterviewMemoryKickoffCardProps = {
  kickoff: string;
  /** `retry` is true when the person pressed Retry. */
  validateKickoff: (request: { retry: boolean }) => Promise<ValidatedKickoff | void>;
  promptCopied: boolean;
  /** Resolves false when the prompt could not be copied, so it is shown selected instead. */
  onCopyPrompt: (prompt: string) => Promise<boolean>;
  /** While set, nothing is copied and the button turns: the prompt is about to change, as while a key is made. */
  holdCopy?: string;
  /** The button at a modest width in the middle of its row, for a person sent here to copy. */
  centered?: boolean;
  /** Lines under the button, such as the one about the key. */
  children?: ReactNode;
  /** The ids its copy button, its caret and its opened prompt answer to; the voice dialog's by default. */
  testIds?: { copy: string; toggle: string; prompt: string };
};

const VOICE_TEST_IDS = {
  copy: E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT,
  toggle: E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE,
  prompt: E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT,
};

// A renewal never runs sooner than this, so a link that can't be renewed isn't checked in a loop.
const MIN_RENEW_DELAY_MS = 30 * 1000;

/**
 * The AI prompt as one split button: "Copy AI prompt" on the left, and on the right a caret that opens the
 * prompt to read, in the "AI Prompt" box. The session is checked before anything can be copied.
 */
export default function SessionInterviewMemoryKickoffCard({
  kickoff,
  validateKickoff,
  promptCopied,
  onCopyPrompt,
  holdCopy = '',
  centered = false,
  children,
  testIds = VOICE_TEST_IDS,
}: SessionInterviewMemoryKickoffCardProps) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [validation, setValidation] = useState({ kickoff: '', pending: true, error: '', prompt: '', renewAtMs: 0 });
  const [copyError, setCopyError] = useState('');
  // A tap while the session is checked can't copy, since the copy must start in the tap: it says so.
  const [copyWaiting, setCopyWaiting] = useState(false);
  // Where copying is refused, the exact prompt is shown selected in a field: the formatted view shortens links.
  // The prompt in that field; it stays through a renewal check and takes the renewed link after it.
  const [manualPrompt, setManualPrompt] = useState('');
  const [selectRequest, setSelectRequest] = useState(0);
  const manualCopyRef = useRef<HTMLTextAreaElement>(null);
  const validateRef = useRef(validateKickoff);
  validateRef.current = validateKickoff;
  const retryRef = useRef(false);
  const activeKickoff = useRef(kickoff);
  activeKickoff.current = kickoff;
  useEffect(() => {
    let active = true;
    const retry = retryRef.current;
    retryRef.current = false;
    setValidation({ kickoff, pending: true, error: '', prompt: '', renewAtMs: 0 });
    void validateRef
      .current({ retry })
      .then((validated) => {
        if (!active) return;
        setCopyWaiting(false);
        setValidation({
          kickoff,
          pending: false,
          error: '',
          prompt: validated?.prompt || kickoff,
          renewAtMs: validated?.renewAtMs || 0,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCopyWaiting(false);
        setValidation({
          kickoff,
          pending: false,
          error: error instanceof Error ? error.message : 'Could not check the session. Try again.',
          prompt: '',
          renewAtMs: 0,
        });
      });
    return () => {
      active = false;
    };
  }, [kickoff, attempt]);
  // A renewal keeps the field, whose prompt follows it; another prompt starts afresh.
  useEffect(() => {
    setCopyError('');
    setManualPrompt('');
  }, [kickoff]);
  const { renewAtMs } = validation;
  useEffect(() => {
    if (!renewAtMs) return undefined;
    // A prompt whose private link runs out is checked again, and so renewed, before it does.
    const timer = setTimeout(
      () => setAttempt((value) => value + 1),
      Math.max(MIN_RENEW_DELAY_MS, renewAtMs - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [renewAtMs]);
  const checking = validation.kickoff !== kickoff || validation.pending;
  const validationError = validation.kickoff === kickoff ? validation.error : '';
  const compatible = !checking && !validationError;
  const prompt = compatible ? validation.prompt : kickoff;
  const copyPrompt = () => {
    if (holdCopy) return;
    if (checking) {
      setCopyWaiting(true);
      return;
    }
    if (!compatible) return;
    // A timer can sleep through a renewal, as on a closed laptop: check again rather than copy a link
    // that ran out, and the person copies the renewed one.
    if (renewAtMs && Date.now() >= renewAtMs) {
      setCopyWaiting(true);
      setAttempt((value) => value + 1);
      return;
    }
    setCopyError('');
    // Safari requires the copy to begin in the tap stack; never await a catalog fetch here.
    void onCopyPrompt(prompt).then((copied) => {
      if (activeKickoff.current !== kickoff) return;
      setManualPrompt(copied ? '' : prompt);
      if (copied) return;
      setCopyError('Copying isn’t allowed here, so the prompt below is selected. Copy it yourself.');
      setSelectRequest((value) => value + 1);
    });
  };
  const renewedPrompt = compatible ? validation.prompt : '';
  useEffect(() => {
    if (renewedPrompt) setManualPrompt((current) => (current ? renewedPrompt : current));
  }, [renewedPrompt]);
  useLayoutEffect(() => {
    const field = manualCopyRef.current;
    if (!selectRequest || !field) return;
    field.focus();
    field.setSelectionRange(0, field.value.length);
  }, [selectRequest]);
  useLayoutEffect(() => {
    // A renewed link replaces the text; a field still in use is selected again, and focus is never taken.
    const field = manualCopyRef.current;
    if (field && document.activeElement === field) field.setSelectionRange(0, field.value.length);
  }, [manualPrompt]);
  const busy = Boolean(holdCopy) || checking;
  const promptId = `${testIds.prompt}-box`;
  // A refused copy shows the field below instead, so the prompt never shows twice.
  const promptShown = open && compatible && !manualPrompt;
  return (
    <div className={styles.aiPromptCopyForm}>
      <div className={centered ? `${styles.aiPromptCopy} ${styles.aiPromptCopyCentered}` : styles.aiPromptCopy}>
        <button
          type="button"
          className={styles.aiPromptCopyMain}
          onClick={copyPrompt}
          aria-disabled={!compatible || Boolean(holdCopy)}
          data-testid={testIds.copy}
        >
          <FontAwesomeIcon icon={busy ? faSpinner : promptCopied ? faCheck : faCopy} spin={busy} />
          {promptCopied && !busy ? 'Copied' : 'Copy AI prompt'}
        </button>
        <button
          type="button"
          className={styles.aiPromptCopyCaret}
          aria-label={open ? 'Hide the AI prompt' : 'Read the AI prompt'}
          aria-expanded={promptShown}
          aria-controls={promptId}
          aria-disabled={!compatible}
          onClick={() => {
            if (open || compatible) setOpen(!open);
          }}
          data-testid={testIds.toggle}
        >
          <FontAwesomeIcon icon={open ? faCaretUp : faCaretDown} />
        </button>
      </div>
      {children}
      {promptShown ? (
        <AiPromptBox
          id={promptId}
          testId={testIds.prompt}
          prompt={prompt}
          variables={findPromptVariables(prompt)}
          onCopy={copyPrompt}
          copied={promptCopied}
        />
      ) : null}
      {/* Said to a screen reader; on screen the button turns. */}
      {holdCopy ? (
        <div role="status" className={styles.sessionListeningSrOnly}>
          {holdCopy}
        </div>
      ) : null}
      {checking && !holdCopy ? (
        <div role="status" className={copyWaiting ? undefined : styles.sessionListeningSrOnly}>
          <InterviewBusyLabel
            label={
              copyWaiting
                ? 'Checking the session. Tap Copy again when this finishes.'
                : 'Checking session compatibility…'
            }
          />
        </div>
      ) : null}
      {validationError ? (
        <div role="alert">
          {validationError}{' '}
          <button
            type="button"
            onClick={() => {
              retryRef.current = true;
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </button>
        </div>
      ) : null}
      {copyError ? <div role="alert">{copyError}</div> : null}
      {/* The whole prompt, any key in it included: this field is what the person copies by hand. */}
      {manualPrompt && !validationError ? (
        <textarea
          ref={manualCopyRef}
          className={styles.sessionAgentKickoffManualCopy}
          readOnly
          rows={6}
          value={manualPrompt}
          aria-label="AI prompt to copy"
        />
      ) : null}
    </div>
  );
}
