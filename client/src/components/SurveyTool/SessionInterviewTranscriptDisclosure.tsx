import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

type SessionInterviewTranscriptDisclosureProps = {
  showTranscript: boolean;
  transcript: string;
  onToggleTranscript: () => void;
  variant?: 'card' | 'compact';
};

export default function SessionInterviewTranscriptDisclosure({
  showTranscript,
  transcript,
  onToggleTranscript,
  variant = 'card',
}: SessionInterviewTranscriptDisclosureProps) {
  const wordCount = transcript.trim().split(/\s+/).length;
  const compact = variant === 'compact';
  return (
    <section
      className={[
        styles.sessionInterviewTranscriptDisclosure,
        compact ? styles.sessionInterviewTranscriptDisclosureCompact : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className={styles.sessionInterviewTranscriptToggle}
        onClick={onToggleTranscript}
        aria-expanded={showTranscript}
        aria-controls="ce-session-interview-transcript-content"
        aria-label={compact ? `Transcript ${wordCount} words` : undefined}
        data-testid={E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE}
      >
        <FontAwesomeIcon
          icon={faCaretDown}
          className={`${styles.sessionInterviewTranscriptCaret} ${
            showTranscript ? '' : styles.sessionInterviewTranscriptCaretCollapsed
          }`}
        />
        <strong className={compact ? styles.sessionListeningSrOnly : undefined}>Transcript</strong>
        <span>{wordCount} words</span>
      </button>
    </section>
  );
}
