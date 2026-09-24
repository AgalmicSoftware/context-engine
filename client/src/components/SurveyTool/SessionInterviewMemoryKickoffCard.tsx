import React, { useEffect, useRef, useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCheck, faCopy, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionInterviewPrompt from './SessionInterviewPrompt';
import { shouldIgnorePromptCopyEvent } from './sessionInterviewModalState';

type SessionInterviewMemoryKickoffCardProps = {
  kickoff: string;
  validateKickoff: () => Promise<void>;
  promptCopied: boolean;
  showAgentPrompt: boolean;
  onCopyPrompt: () => Promise<void>;
  onTogglePrompt: () => void;
};

export default function SessionInterviewMemoryKickoffCard({
  kickoff,
  validateKickoff,
  promptCopied,
  showAgentPrompt,
  onCopyPrompt,
  onTogglePrompt,
}: SessionInterviewMemoryKickoffCardProps) {
  const [attempt, setAttempt] = useState(0);
  const [validation, setValidation] = useState({ kickoff: '', pending: true, error: '' });
  const [copyError, setCopyError] = useState('');
  const validateRef = useRef(validateKickoff);
  validateRef.current = validateKickoff;
  const activeKickoff = useRef(kickoff);
  activeKickoff.current = kickoff;
  useEffect(() => {
    let active = true;
    setValidation({ kickoff, pending: true, error: '' });
    setCopyError('');
    void validateRef
      .current()
      .then(() => {
        if (active) setValidation({ kickoff, pending: false, error: '' });
      })
      .catch((error: unknown) => {
        if (active)
          setValidation({
            kickoff,
            pending: false,
            error: error instanceof Error ? error.message : 'Could not check the session. Try again.',
          });
      });
    return () => {
      active = false;
    };
  }, [kickoff, attempt]);
  const checking = validation.kickoff !== kickoff || validation.pending;
  const validationError = validation.kickoff === kickoff ? validation.error : '';
  const compatible = !checking && !validationError;
  const copyPrompt = () => {
    if (!compatible) return;
    setCopyError('');
    // Safari requires writeText to begin in the tap stack; never await a catalog fetch here.
    void onCopyPrompt().catch(() => {
      if (activeKickoff.current !== kickoff) return;
      setCopyError('Could not copy to the clipboard. Copy the prompt below by hand.');
      if (!showAgentPrompt) onTogglePrompt();
    });
  };
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
            <span>
              {promptCopied
                ? ' prompt to clipboard'
                : ' and paste this prompt into ChatGPT or Claude to augment your interview and draft responses.'}
            </span>
          </span>
        </div>
        <div className={styles.sessionAgentKickoffActions}>
          <button
            type="button"
            className={styles.sessionAgentKickoffToggle}
            onClick={() => {
              if (showAgentPrompt || compatible) onTogglePrompt();
            }}
            aria-expanded={showAgentPrompt && compatible}
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
      {checking ? <div role="status">Checking session compatibility…</div> : null}
      {validationError ? (
        <div role="alert">
          {validationError}{' '}
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Retry
          </button>
        </div>
      ) : null}
      {copyError ? <div role="alert">{copyError}</div> : null}
      {showAgentPrompt && compatible ? (
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
          <SessionInterviewPrompt prompt={kickoff} />
        </div>
      ) : null}
    </div>
  );
}
