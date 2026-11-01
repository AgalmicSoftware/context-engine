import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faTimes } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';

type SessionListeningTranscriptToggleProps = {
  // Characters in the transcript, without surrounding whitespace.
  length: number;
  open: boolean;
  // Audio is still being transcribed into it.
  pending: boolean;
  onToggle: () => void;
};

// The compact pill in the recorder's status row that shows or hides the transcript.
export function SessionListeningTranscriptToggle({
  length,
  open,
  pending,
  onToggle,
}: SessionListeningTranscriptToggleProps) {
  return (
    <button
      type="button"
      className={styles.sessionListeningTranscriptButton}
      onClick={onToggle}
      aria-expanded={open}
      aria-busy={pending}
      data-testid={E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT_DETAILS}
    >
      <span>Transcript</span>
      <span>{length} chars</span>
      <FontAwesomeIcon
        icon={faCaretDown}
        className={[styles.sessionListeningTranscriptCaret, open ? styles.sessionListeningTranscriptCaretExpanded : '']
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      />
    </button>
  );
}

type SessionListeningTranscriptProps = {
  transcript: string;
  // Clearing waits while audio is being captured or transcribed.
  clearDisabled: boolean;
  onClear: () => void;
};

// The open transcript: read-only text with a clear control in its corner.
export function SessionListeningTranscript({ transcript, clearDisabled, onClear }: SessionListeningTranscriptProps) {
  return (
    <div className={styles.sessionListeningTranscriptDetails}>
      <div className={styles.sessionListeningTranscriptShell}>
        <textarea
          className={styles.sessionListeningTranscript}
          value={transcript}
          readOnly
          placeholder="Transcript"
          data-testid={E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT}
        />
        <button
          type="button"
          className={styles.sessionListeningClearTranscript}
          onClick={onClear}
          disabled={clearDisabled}
          aria-label="Clear transcript"
          title="Clear transcript"
          data-testid={E2E_TESTIDS.SESSION_LISTENING_CLEAR}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
    </div>
  );
}
