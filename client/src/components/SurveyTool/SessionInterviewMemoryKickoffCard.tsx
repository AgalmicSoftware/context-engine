import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCheck, faCopy, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionInterviewPrompt from './SessionInterviewPrompt';
import { InterviewBusyLabel } from './SessionInterviewModalHeader';
import { shouldIgnorePromptCopyEvent } from './sessionInterviewModalState';

/** The prompt a check approved, when it differs from `kickoff`, and when to check again before its link runs out. */
export type ValidatedKickoff = { prompt: string; renewAtMs?: number };

type SessionInterviewMemoryKickoffCardProps = {
  kickoff: string;
  /** `retry` is true when the person pressed Retry. */
  validateKickoff: (request: { retry: boolean }) => Promise<ValidatedKickoff | void>;
  promptCopied: boolean;
  showAgentPrompt: boolean;
  /** Resolves false when the prompt could not be copied, so it is shown selected instead. */
  onCopyPrompt: (prompt: string) => Promise<boolean>;
  onTogglePrompt: () => void;
  /** Shows one copy button in place of the card's copy row and its prompt toggle, and under it, once the
   * session is checked, whatever `renderPreview` makes of the prompt that a copy would give. */
  copyButton?: {
    className: string;
    testId: string;
    /** Beside the button, in a row of `rowClassName`, such as the caret of a split button. */
    addon?: ReactNode;
    rowClassName?: string;
    renderPreview?: (prompt: string) => ReactNode;
  };
};

// A renewal never runs sooner than this, so a link that can't be renewed isn't checked in a loop.
const MIN_RENEW_DELAY_MS = 30 * 1000;

export default function SessionInterviewMemoryKickoffCard({
  kickoff,
  validateKickoff,
  promptCopied,
  showAgentPrompt,
  onCopyPrompt,
  onTogglePrompt,
  copyButton,
}: SessionInterviewMemoryKickoffCardProps) {
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
  const promptShown = showAgentPrompt && compatible;
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
  const status = (
    <>
      {checking ? (
        <div role="status">
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
      {manualPrompt && !validationError ? (
        <textarea
          ref={manualCopyRef}
          className={styles.sessionAgentKickoffManualCopy}
          readOnly
          rows={6}
          value={manualPrompt}
          aria-label="Memory augmentation prompt to copy"
        />
      ) : null}
    </>
  );
  if (copyButton) {
    return (
      <div className={styles.sessionAgentKickoffButtonForm}>
        <div className={copyButton.rowClassName}>
          <button
            type="button"
            className={copyButton.className}
            onClick={copyPrompt}
            aria-disabled={!compatible}
            data-testid={copyButton.testId}
          >
            <FontAwesomeIcon icon={promptCopied ? faCheck : faCopy} />
            {promptCopied ? 'Copied' : 'Copy prompt'}
          </button>
          {compatible ? copyButton.addon : null}
        </div>
        {/* A refused copy shows the field below instead, so the prompt never shows twice. */}
        {compatible && !manualPrompt && copyButton.renderPreview ? copyButton.renderPreview(prompt) : null}
        {status}
      </div>
    );
  }
  return (
    <div
      className={styles.sessionAgentKickoff}
      onClick={(event) => {
        if (!shouldIgnorePromptCopyEvent(event.target)) copyPrompt();
      }}
    >
      <div className={styles.sessionAgentKickoffRow}>
        <div
          role="button"
          tabIndex={0}
          className={`${styles.sessionAgentKickoffCopyTarget} ${promptCopied ? styles.sessionAgentKickoffCopied : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            copyPrompt();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              copyPrompt();
            }
          }}
          aria-disabled={!compatible}
          aria-label={promptCopied ? 'Memory augmentation prompt copied' : 'Copy memory augmentation prompt'}
          title={promptCopied ? 'Copied' : 'Copy memory augmentation prompt'}
          data-ce-control-appearance="frameless"
          data-testid={E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT}
        >
          <span className={styles.sessionAgentKickoffTitle}>
            <span className={styles.sessionAgentKickoffCopyBadge} aria-hidden="true">
              <FontAwesomeIcon icon={promptCopied ? faCheck : faCopy} />
              <span>{promptCopied ? 'Copied' : 'Copy'}</span>
            </span>
            <span>{promptCopied ? ' prompt to clipboard' : ' and paste this prompt into ChatGPT or Claude.'}</span>
          </span>
        </div>
        <div className={styles.sessionAgentKickoffActions}>
          <button
            type="button"
            className={styles.sessionAgentKickoffToggle}
            data-ce-control-appearance="frameless"
            onClick={() => {
              if (showAgentPrompt || compatible) onTogglePrompt();
            }}
            aria-expanded={promptShown}
            aria-controls="ce-session-interview-agent-prompt"
            data-testid={E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE}
          >
            <span>Prompt</span>
            <FontAwesomeIcon
              icon={faCaretDown}
              className={`${styles.sessionAgentKickoffCaret} ${
                showAgentPrompt ? styles.sessionAgentKickoffCaretExpanded : ''
              }`}
            />
          </button>
        </div>
      </div>
      {status}
      {promptShown ? (
        <div
          id="ce-session-interview-agent-prompt"
          className={styles.sessionAgentKickoffPrompt}
          data-testid={E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT}
          data-ce-no-background-copy="true"
        >
          <div className={styles.sessionAgentKickoffPromptHelpRow}>
            <button
              type="button"
              id="ce-interview-agent-prompt-help"
              className={styles.sessionInterviewHeaderButton}
              data-ce-control-appearance="frameless"
              aria-label="About the interview prompt"
            >
              <FontAwesomeIcon icon={faQuestionCircle} />
            </button>
            <UncontrolledTooltip
              target="ce-interview-agent-prompt-help"
              placement="top-end"
              fade={false}
              trigger="hover focus"
              autohide={false}
            >
              Allows your agent to predict your responses and raise better interview questions.
            </UncontrolledTooltip>
          </div>
          <SessionInterviewPrompt prompt={prompt} />
        </div>
      ) : null}
    </div>
  );
}
