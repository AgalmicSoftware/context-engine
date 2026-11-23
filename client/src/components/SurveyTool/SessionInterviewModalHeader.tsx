import React from 'react';
import { ModalHeader, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionInterviewLanguageMarks from './SessionInterviewLanguageMarks';
import SessionVoiceModeBackButton, { VoiceModeBackContext } from './SessionVoiceModeBack';
import styles from './SurveyTool.module.scss';

type SessionInterviewModalHeaderProps = {
  /** The session's AI provider, which drafts the answers from what was said. */
  aiProvider?: string;
  guidance: string;
  idle: boolean;
  onClose: () => void;
  readinessDetail: string;
  readinessRetry: () => void;
  statusLabel: string;
  statusTone: string;
  statusRef: React.RefObject<HTMLButtonElement>;
  /** How long a long wait (drafting) has run, as m:ss; shown after the status. */
  waitTime?: string;
};

/** Behind the interview's "?": the voice interviewer follows the language someone speaks. */
export const INTERVIEW_LANGUAGE_HINT = 'You can answer in the language you prefer.';

// Who processes an interview, also behind its "?": the voice always runs on OpenAI (the Worker's /realtime/call),
// and the session's AI provider drafts the answers, OpenAI unless the session names another.
const AI_PROVIDER_NAMES: Record<string, string> = { anthropic: 'Anthropic', openrouter: 'OpenRouter' };
const processedBy = (aiProvider: string) => {
  const provider = aiProvider.trim().toLowerCase();
  if (!provider || provider === 'openai') return 'OpenAI';
  return `OpenAI and ${AI_PROVIDER_NAMES[provider] || "the session's own AI service"}`;
};

/** A waiting line in the interview: the app's spinner, then what it is waiting on. */
export function InterviewBusyLabel({ label }: { label: string }) {
  return (
    <>
      <FontAwesomeIcon icon={faSpinner} spin /> {label}
    </>
  );
}

export default function SessionInterviewModalHeader({
  aiProvider = '',
  guidance,
  idle,
  onClose,
  readinessDetail,
  readinessRetry,
  statusLabel,
  statusTone,
  statusRef,
  waitTime = '',
}: SessionInterviewModalHeaderProps) {
  const onBack = React.useContext(VoiceModeBackContext);
  return (
    <ModalHeader toggle={onClose}>
      <span className={styles.sessionInterviewHeader}>
        {onBack ? <SessionVoiceModeBackButton id="ce-interview-back" onBack={onBack} disabled={!idle} /> : null}
        <span id="ce-session-voice-mode-title">Interview</span>
        <button
          type="button"
          id="ce-interview-help"
          className={styles.sessionInterviewHeaderButton}
          data-ce-control-appearance="frameless"
          aria-label="About Interview"
        >
          <FontAwesomeIcon icon={faQuestionCircle} />
        </button>
        <UncontrolledTooltip target="ce-interview-help" placement="bottom" trigger="hover focus" autohide={false}>
          {guidance} {INTERVIEW_LANGUAGE_HINT} Processed by {processedBy(aiProvider)}; future versions will use
          open-source models.
        </UncontrolledTooltip>
        <SessionInterviewLanguageMarks />
        <span className={styles.sessionInterviewStatusSlot}>
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Interview status: ${statusLabel}`}
            data-testid={E2E_TESTIDS.SESSION_INTERVIEW_STATUS}
          >
            <button
              type="button"
              id="ce-interview-status-help"
              ref={statusRef}
              className={styles.sessionInterviewStatusPill}
              data-tone={statusTone}
              onClick={idle ? readinessRetry : undefined}
              aria-label={`Interview status: ${statusLabel}`}
            >
              <span>{statusTone === 'busy' ? <InterviewBusyLabel label={statusLabel} /> : statusLabel}</span>
            </button>
          </span>
          {/* Beside the status, not in it: never cut short with a long status, and seen, not heard, so screen
              readers don't hear the status again each second. */}
          {waitTime ? (
            <span className={styles.sessionInterviewWaitTime} aria-hidden="true">
              {waitTime}
            </span>
          ) : null}
        </span>
        <UncontrolledTooltip
          target="ce-interview-status-help"
          placement="bottom"
          trigger="hover focus"
          autohide={false}
        >
          {/* The status first, as a phone may show only its start. */}
          {/[.…]$/.test(statusLabel) ? statusLabel : `${statusLabel}.`}{' '}
          {idle ? `${readinessDetail} Click to check again.` : guidance}
        </UncontrolledTooltip>
      </span>
    </ModalHeader>
  );
}
