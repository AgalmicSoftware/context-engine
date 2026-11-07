import { useLayoutEffect, useRef } from 'react';
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

// Within about a line of the end still counts as reading the newest line.
const FOLLOW_SLACK_PX = 24;

// Enough colours that a room's speakers stay apart; a ninth voice shares the first's.
const SPEAKER_COLORS = 8;
const SPEAKER_LINE = /^(Person (\d+):) (.*)$/;

// The open transcript: read-only text with a clear control in its corner, each speaker's label bold and in
// that person's colour. As chunks arrive it keeps the newest line in view, unless the host has scrolled up to
// reread; scrolling back to the end resumes.
export function SessionListeningTranscript({ transcript, clearDisabled, onClear }: SessionListeningTranscriptProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(true);
  // Where a host who scrolled up is reading; restored in case replacing the text moved it.
  const readingTopRef = useRef(0);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = followRef.current ? box.scrollHeight : readingTopRef.current;
  }, [transcript]);
  return (
    <div className={styles.sessionListeningTranscriptDetails}>
      <div className={styles.sessionListeningTranscriptShell}>
        <div
          ref={boxRef}
          className={styles.sessionListeningTranscript}
          // It scrolls, so the keyboard has to be able to reach it.
          tabIndex={0}
          role="region"
          aria-label="Transcript"
          onScroll={({ currentTarget: box }) => {
            readingTopRef.current = box.scrollTop;
            followRef.current = box.scrollHeight - box.scrollTop - box.clientHeight <= FOLLOW_SLACK_PX;
          }}
          data-testid={E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT}
        >
          {transcript.split('\n').map((line, index) => {
            const turn = SPEAKER_LINE.exec(line);
            return (
              <p key={index}>
                {turn ? (
                  <>
                    <strong
                      style={{
                        color: `var(--ce-speaker-${((Number(turn[2]) - 1 + SPEAKER_COLORS) % SPEAKER_COLORS) + 1})`,
                      }}
                    >
                      {turn[1]}
                    </strong>{' '}
                    {turn[3]}
                  </>
                ) : (
                  line
                )}
              </p>
            );
          })}
        </div>
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
