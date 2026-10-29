import React from 'react';
import { Button, Input, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faMicrophone, faPause, faPlay, faSpinner, faStop, faTrash } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import SessionInterviewTranscriptDisclosure from './SessionInterviewTranscriptDisclosure';
import { formatSessionRecordingElapsed, SessionListeningWaveform } from './SessionListeningPanel';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

// What Discard does, for its tooltip and for screen readers, which don't get the tooltip.
const DISCARD_EXPLANATION =
  'Clears the transcript, imported AI drafts and unsaved edits, then closes. Responses you’ve submitted are kept.';

type ImportedResponderContextProps = {
  expanded: boolean;
  value: string;
  disabled: boolean;
  onExpandedChange: (value: boolean) => void;
  onChange: (value: string) => void;
};

export function ImportedResponderContextEditor({
  expanded,
  value,
  disabled,
  onExpandedChange,
  onChange,
}: ImportedResponderContextProps) {
  return (
    <details
      className={styles.sessionInterviewContext}
      open={expanded}
      onToggle={(event) => onExpandedChange(event.currentTarget.open)}
    >
      <summary>Imported responder context</summary>
      <Input
        id="ce-interview-context"
        aria-label="Imported responder context details"
        type="textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={styles.sessionInterviewContextInput}
        data-testid={E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT}
      />
    </details>
  );
}

type SessionInterviewVoiceControlsProps = {
  isRecorderSessionActive: boolean;
  wakeLockHeld?: boolean;
  isPaused: boolean;
  isStopping: boolean;
  isStarting: boolean;
  startLabel: string;
  startDisabled: boolean;
  hasTranscript: boolean;
  showTranscript: boolean;
  transcript: string;
  mediaStreamRef: React.MutableRefObject<MediaStream | null>;
  recordingElapsedSeconds: number;
  stopControlRef: React.RefObject<HTMLButtonElement>;
  canGenerateDrafts: boolean;
  onStartInterview: () => void;
  onEndInterview: () => void;
  onPause: () => void;
  onResume: () => void;
  onToggleTranscript: () => void;
  onGenerateDrafts: () => void;
  // Shown beside the microphone while there's an interview to discard.
  onDiscard?: () => void;
  discardDisabled?: boolean;
};

export function SessionInterviewVoiceControls({
  isRecorderSessionActive,
  wakeLockHeld,
  isPaused,
  isStopping,
  isStarting,
  startLabel,
  startDisabled,
  hasTranscript,
  showTranscript,
  transcript,
  mediaStreamRef,
  recordingElapsedSeconds,
  stopControlRef,
  canGenerateDrafts,
  onStartInterview,
  onEndInterview,
  onPause,
  onResume,
  onToggleTranscript,
  onGenerateDrafts,
  onDiscard,
  discardDisabled,
}: SessionInterviewVoiceControlsProps) {
  return (
    <div className={styles.sessionInterviewActions}>
      {isRecorderSessionActive && !wakeLockHeld ? (
        <div className={styles.sessionRecordingWakeNotice}>Keep this screen on.</div>
      ) : null}
      {!isRecorderSessionActive ? (
        <div className={styles.sessionInterviewPrimaryAction}>
          {onDiscard ? (
            <>
              <button
                type="button"
                id="ce-interview-discard-button"
                className={styles.sessionInterviewDiscard}
                data-ce-control-appearance="frameless"
                onClick={onDiscard}
                disabled={discardDisabled}
                aria-label="Discard interview"
                aria-describedby="ce-interview-discard-explanation"
              >
                <span className={styles.sessionInterviewDiscardCircle} aria-hidden="true">
                  <FontAwesomeIcon icon={faTrash} />
                </span>
                <span id="ce-interview-discard-explanation" className={styles.sessionListeningSrOnly}>
                  {DISCARD_EXPLANATION}
                </span>
              </button>
              {/* Hover only: focus returns here after the confirmation, which would reopen it. */}
              <UncontrolledTooltip
                target="ce-interview-discard-button"
                placement="top"
                trigger="hover"
                autohide={false}
              >
                Discard interview: {DISCARD_EXPLANATION}
              </UncontrolledTooltip>
            </>
          ) : null}
          <Button
            color="link"
            className={styles.sessionInterviewMicrophone}
            aria-label={startLabel}
            onClick={onStartInterview}
            disabled={startDisabled}
            data-testid={E2E_TESTIDS.SESSION_INTERVIEW_START}
          >
            <span className={styles.sessionInterviewActionCircle} aria-hidden="true">
              <FontAwesomeIcon icon={isStarting ? faSpinner : faMicrophone} spin={isStarting} />
            </span>
            <span>{startLabel}</span>
          </Button>
          {hasTranscript ? (
            <SessionInterviewTranscriptDisclosure
              variant="compact"
              showTranscript={showTranscript}
              transcript={transcript}
              onToggleTranscript={onToggleTranscript}
            />
          ) : onDiscard ? (
            // Balances the discard button so the microphone stays centered.
            <span className={styles.sessionInterviewDiscardBalance} aria-hidden="true" />
          ) : null}
        </div>
      ) : (
        <div className={styles.sessionListeningActiveRecorder}>
          <div className={styles.sessionListeningWaveformShell}>
            <SessionListeningWaveform
              streamRef={mediaStreamRef}
              isActive={isRecorderSessionActive}
              isPaused={isPaused || isStopping}
            />
            <div className={styles.sessionListeningWaveformTimer}>
              <FontAwesomeIcon
                icon={isStopping ? faSpinner : faCircle}
                spin={isStopping}
                className={isPaused ? styles.sessionListeningTimerDotPaused : styles.sessionListeningTimerDot}
              />
              <span>{isStopping ? 'Ending' : isPaused ? 'Paused' : 'Listening'}</span>
              <span>{formatSessionRecordingElapsed(recordingElapsedSeconds)}</span>
            </div>
          </div>
          <div className={styles.sessionListeningButtonColumn} role="group" aria-label="Interview recording controls">
            <button
              type="button"
              ref={stopControlRef}
              className={[styles.sessionListeningAudioButton, styles.sessionListeningStopButton].join(' ')}
              onClick={onEndInterview}
              disabled={isStopping}
              aria-label={isStopping ? 'Stopping interview' : 'Stop interview'}
              title={isStopping ? 'Stopping interview' : 'Stop interview and generate drafts'}
              data-testid={E2E_TESTIDS.SESSION_INTERVIEW_STOP}
            >
              <FontAwesomeIcon icon={isStopping ? faSpinner : faStop} spin={isStopping} />
              <span className={styles.sessionListeningSrOnly}>{isStopping ? 'Stopping' : 'Stop'}</span>
            </button>
            <button
              type="button"
              className={styles.sessionListeningAudioButton}
              onClick={isPaused ? onResume : onPause}
              disabled={isStopping}
              aria-label={isPaused ? 'Resume interview' : 'Pause interview'}
              title={isPaused ? 'Resume interview' : 'Pause interview'}
            >
              <FontAwesomeIcon icon={isPaused ? faPlay : faPause} />
              <span className={styles.sessionListeningSrOnly}>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
          </div>
        </div>
      )}
      {canGenerateDrafts ? (
        <Button outline onClick={onGenerateDrafts} data-testid={E2E_TESTIDS.SESSION_INTERVIEW_GENERATE}>
          Generate response drafts
        </Button>
      ) : null}
    </div>
  );
}
