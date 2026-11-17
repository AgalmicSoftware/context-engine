/** @file SessionDictation.tsx: a microphone that writes speech down into the text field beside it. */
import { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faMicrophone } from '@fortawesome/free-solid-svg-icons';

import type { FeedbackOptions } from '../../domains/worker/sessionFeedbackPorts';
import { RECORDING_STATUS, useWhisper } from '../../utilities/useWhisper';
import CETooltip from '../Shared/CETooltip';
import styles from './SessionDictation.module.scss';

type Props = {
  options: FeedbackOptions;
  onWords: (words: string) => void;
  /** Recording or writing down, during which sending would lose the words. */
  onBusy: (busy: boolean) => void;
  testId: string;
};

/**
 * The answer field's dictation: the same recorder, written down by the session's Worker on the session's AI
 * allowance. Mounted only while its form shows, so closing the dialog stops it and keeps no audio.
 */
export default function SessionDictation({ options, onWords, onBusy, testId }: Props) {
  const mic = useRef<HTMLButtonElement>(null);
  const { status, isRecording, isProcessing, errorMessage, startRecording, stopRecording } = useWhisper({
    apiKey: '',
    silenceDetection: false,
    timeSlice: 0,
    sessionSlug: options.sessionSlug,
    sessionConfig: options.sessionConfig,
    context: { account: options.account },
    // Like sending, speaking never asks for a signature or passkey.
    signInPrompt: false,
    onTranscriptionComplete: onWords,
  });
  const writing = isProcessing || status === RECORDING_STATUS.PROCESSING;
  const busy = isRecording || writing;
  useEffect(() => {
    onBusy(busy);
  }, [busy, onBusy]);
  useEffect(() => () => onBusy(false), [onBusy]);
  return (
    <>
      <span className={styles.dictation}>
        {isRecording || writing ? (
          <span className={styles.hint} role="status">
            {isRecording ? 'Recording…' : 'Processing audio…'}
          </span>
        ) : null}
        <button
          ref={mic}
          type="button"
          className={`${styles.mic} ${isRecording ? styles.recording : ''}`}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          aria-pressed={isRecording}
          // Not disabled, which would drop keyboard focus out of the dialog: a press while writing does nothing.
          aria-disabled={writing}
          data-ce-control-appearance="frameless"
          data-testid={testId}
          onClick={() => {
            if (!writing) void (isRecording ? stopRecording() : startRecording());
          }}
        >
          <FontAwesomeIcon icon={isRecording ? faCircle : faMicrophone} />
        </button>
        <CETooltip target={mic} placement="top" trigger="hover focus">
          {isRecording
            ? 'Stop recording and add the transcript to this text.'
            : 'Record speech and add its transcript to this text.'}
        </CETooltip>
      </span>
      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
}
