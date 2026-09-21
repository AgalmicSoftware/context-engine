import React from 'react';
import { Button, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faMicrophone, faPause, faPlay, faSpinner, faStop } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import SessionInterviewTranscriptDisclosure from './SessionInterviewTranscriptDisclosure';
import { formatSessionRecordingElapsed, SessionListeningWaveform } from './SessionListeningPanel';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

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
      <Label for="ce-interview-context">Imported responder context details</Label>
      <Input
        id="ce-interview-context"
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
};

export function SessionInterviewVoiceControls({
  isRecorderSessionActive,
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
}: SessionInterviewVoiceControlsProps) {
  return (
    <div className={styles.sessionInterviewActions}>
      {!isRecorderSessionActive ? (
        <div className={styles.sessionInterviewPrimaryAction}>
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
