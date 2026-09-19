import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

type SessionInterviewTranscriptDisclosureProps = {
  showTranscript: boolean;
  transcript: string;
  onToggleTranscript: () => void;
};

export default function SessionInterviewTranscriptDisclosure({
  showTranscript,
  transcript,
  onToggleTranscript,
}: SessionInterviewTranscriptDisclosureProps) {
  return (
    <section className={styles.sessionInterviewTranscriptDisclosure}>
      <button
        type="button"
        className={styles.sessionInterviewTranscriptToggle}
        onClick={onToggleTranscript}
        aria-expanded={showTranscript}
        aria-controls="ce-session-interview-transcript-content"
        data-testid={E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE}
      >
        <FontAwesomeIcon
          icon={faCaretDown}
          className={`${styles.sessionInterviewTranscriptCaret} ${
            showTranscript ? '' : styles.sessionInterviewTranscriptCaretCollapsed
          }`}
        />
        <strong>Transcript</strong>
        <span>{transcript.trim().split(/\s+/).length} words</span>
      </button>
    </section>
  );
}
