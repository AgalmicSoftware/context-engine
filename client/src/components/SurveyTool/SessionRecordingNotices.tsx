import { useId } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { Button, UncontrolledTooltip } from 'reactstrap';
import styles from './SurveyTool.module.scss';
import type { useRollingTranscriptionRecorder } from '../../utilities/audio/useRollingTranscriptionRecorder';

const RENUMBERED_HELP =
  'Some voices could not be matched to earlier speech. A Person number may refer to someone different later in the conversation.';

type SessionRecordingNoticesProps = {
  recorder: Pick<
    ReturnType<typeof useRollingTranscriptionRecorder>,
    | 'segments'
    | 'labelsUnavailableReason'
    | 'hiddenPeriods'
    | 'dismissHiddenPeriods'
    | 'captureNotice'
    | 'microphonePaused'
    | 'backBlocked'
    | 'pageHidden'
    | 'wakeLockHeld'
  >;
  // Recording, paused or stopping; the microphone notices apply only then.
  capturing: boolean;
  labelCheckTimedOut: boolean;
};

// What a recording says about its capture: how speakers are labelled, and what may have paused the microphone.
export function SessionRecordingNotices({ recorder, capturing, labelCheckTimedOut }: SessionRecordingNoticesProps) {
  const renumberedHelpId = `ce-renumbered-help-${useId().replace(/:/g, '')}`;
  const renumberedChunks = recorder.segments
    .filter((segment) => segment.speakersRenumbered)
    .map((segment) => segment.index + 1);
  return (
    <>
      {labelCheckTimedOut ? (
        <div role="status">Speaker label check timed out. Recording is available with plain transcription.</div>
      ) : null}
      {recorder.labelsUnavailableReason ? (
        <div role="status">{recorder.labelsUnavailableReason} Continuing with plain transcription.</div>
      ) : null}
      {renumberedChunks.length ? (
        <span className={styles.sessionRecordingOption}>
          <span role="status">Some speaker numbers may change during the conversation.</span>
          <button
            type="button"
            id={renumberedHelpId}
            className={styles.sessionInterviewHeaderButton}
            aria-label="About restarted Person numbers"
            aria-describedby={`${renumberedHelpId}-about`}
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
          <span id={`${renumberedHelpId}-about`} hidden>
            {RENUMBERED_HELP}
          </span>
          <UncontrolledTooltip target={renumberedHelpId} trigger="hover focus" autohide={false}>
            {RENUMBERED_HELP}
          </UncontrolledTooltip>
        </span>
      ) : null}
      {recorder.hiddenPeriods?.length ? (
        <div className={styles.sessionRecordingWakeNotice} role="status">
          {recorder.hiddenPeriods.map((period, index) => (
            <p key={`${period.startedAt}-${index}`}>
              The page was hidden{' '}
              {new Date(period.startedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
              })}
              –
              {new Date(period.endedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
              })}
              ; recording may have paused.
            </p>
          ))}
          <Button
            size="sm"
            className={styles.sessionRecordingButton}
            onClick={recorder.dismissHiddenPeriods}
            aria-label="Dismiss hidden-page notice"
          >
            Dismiss
          </Button>
        </div>
      ) : null}
      {capturing && recorder.captureNotice ? (
        <div className={styles.sessionRecordingWakeNotice} role="status">
          {recorder.captureNotice}
        </div>
      ) : null}
      {capturing && recorder.microphonePaused ? (
        <div className={styles.sessionRecordingWakeNotice} role="status">
          Microphone paused by the device. Recording resumes when it returns.
        </div>
      ) : null}
      {capturing && recorder.backBlocked ? (
        <div className={styles.sessionRecordingWakeNotice} role="status">
          Still recording. Press Stop before leaving.
        </div>
      ) : null}
      {capturing && (recorder.pageHidden || !recorder.wakeLockHeld) ? (
        <div className={styles.sessionRecordingWakeNotice} role="status">
          {recorder.pageHidden
            ? 'Recording page is hidden. Return to this page; your phone may pause the microphone in the background.'
            : 'Screen lock is unavailable. Keep this page visible and the screen unlocked.'}
        </div>
      ) : null}
    </>
  );
}
