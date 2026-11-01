import { getEffectiveTranscriptionConfig } from '../../utilities/ai/aiSettings';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircle,
  faMicrophone,
  faPause,
  faPlay,
  faQuestionCircle,
  faSpinner,
  faStop,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { Button, UncontrolledTooltip } from 'reactstrap';
import styles from './SurveyTool.module.scss';
import CreateQuestionsAndSurveys from './CreateQuestionsAndSurveys';
import CEConfirmDialog from '../Shared/CEConfirmDialog';
import { SessionRecordingChunks } from './SessionRecordingChunks';
import SessionRecordingInput from './SessionRecordingInput';
import SessionRecordingHelp from './SessionRecordingHelp';
import { SessionRecordingNotices } from './SessionRecordingNotices';
import { SessionNewDraftsCue } from './SessionNewDraftsCue';
import { SessionListeningTranscript, SessionListeningTranscriptToggle } from './SessionListeningTranscript';
import { useRollingTranscriptionRecorder } from '../../utilities/audio/useRollingTranscriptionRecorder';
import { DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS, transcriptSpeech } from '../../utilities/audio/rollingTranscription';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { SessionListeningWaveform } from './SessionListeningWaveform';
export { SessionListeningWaveform } from './SessionListeningWaveform';
import { generateQuestionsFromListeningTranscript, LISTENING_QUESTION_COUNT } from './sessionListeningQuestions';

type SessionListeningPanelProps = Record<string, unknown> & {
  sessionSlug?: string;
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  defaultTags?: string | string[] | null;
  onClose?: () => void;
  panelMode?: 'recordGroup' | 'listening';
  embeddedInModal?: boolean;
  closeActionRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  // Lets the dialog ignore backdrop taps and Escape while the microphone is capturing.
  onCaptureChange?: (capturing: boolean) => void;
};
type CreateQuestionsAndSurveysPanelProps = React.ComponentProps<typeof CreateQuestionsAndSurveys>;
type GeneratedQuestionDraft = {
  id?: unknown;
  prompt?: unknown;
  [key: string]: unknown;
};

const getGeneratedQuestionKey = (question: GeneratedQuestionDraft | null | undefined): string =>
  String(question?.id || question?.prompt || '')
    .trim()
    .toLowerCase();

const getGeneratedQuestionPrompt = (question: GeneratedQuestionDraft | null | undefined): string =>
  String(question?.prompt || '').trim();

const mergeGeneratedQuestionDrafts = (
  previous: GeneratedQuestionDraft[],
  incoming: GeneratedQuestionDraft[],
): GeneratedQuestionDraft[] => {
  const seenKeys = new Set(previous.map(getGeneratedQuestionKey).filter(Boolean));
  const seenPrompts = new Set(
    previous
      .map(getGeneratedQuestionPrompt)
      .map((prompt) => prompt.toLowerCase())
      .filter(Boolean),
  );
  const additions = incoming.filter((question) => {
    const key = getGeneratedQuestionKey(question);
    const prompt = getGeneratedQuestionPrompt(question).toLowerCase();
    if ((!key && !prompt) || (key && seenKeys.has(key)) || (prompt && seenPrompts.has(prompt))) return false;
    if (key) seenKeys.add(key);
    if (prompt) seenPrompts.add(prompt);
    return true;
  });
  return additions.length ? [...previous, ...additions] : previous;
};

export const formatSessionRecordingElapsed = (secondsRaw: unknown) => {
  const seconds = Math.max(0, Math.floor(Number(secondsRaw || 0)));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

const KEEP_AUDIO_HELP =
  'Closes without waiting for transcription. Audio still waiting for it stays on this device and resumes uploading when you reopen this recording.';

const getSessionInstructions = (sessionConfig: unknown) =>
  sessionConfig && typeof sessionConfig === 'object'
    ? (sessionConfig as Record<string, unknown>).questionsGenPrompt || ''
    : '';

export default function SessionListeningPanel(props: SessionListeningPanelProps) {
  const {
    sessionSlug = '',
    sessionConfig = null,
    context,
    workerUrl,
    defaultTags = null,
    onClose,
    panelMode = 'listening',
    embeddedInModal = false,
    closeActionRef,
    onCaptureChange,
  } = props;
  const [labelSpeakers, setLabelSpeakers] = useState(true);
  const [speakerLabelsSupported, setSpeakerLabelsSupported] = useState<boolean | null>(null);
  const [speakerLabelsCheckTimedOut, setSpeakerLabelsCheckTimedOut] = useState(false);
  const recordPressedRef = useRef(false);
  useEffect(() => {
    let current = true;
    let timedOut = false;
    setSpeakerLabelsSupported(null);
    setSpeakerLabelsCheckTimedOut(false);
    const complete = (supported: boolean) => {
      // A late result still applies until Record is pressed, so it never switches labels on during capture.
      if (!current || (timedOut && recordPressedRef.current)) return;
      current = false;
      clearTimeout(timeout);
      setSpeakerLabelsCheckTimedOut(false);
      setSpeakerLabelsSupported(supported);
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      setSpeakerLabelsCheckTimedOut(true);
      setSpeakerLabelsSupported(false);
    }, 2000);
    // Checking availability must not unlock credentials or delay Record indefinitely.
    void getEffectiveTranscriptionConfig({ sessionSlug, sessionConfig }).then(
      (config) => complete(config.provider === 'openai'),
      () => complete(false),
    );
    return () => {
      current = false;
      clearTimeout(timeout);
    };
  }, [sessionSlug, sessionConfig]);
  const [recordSpeakerAudio, setRecordSpeakerAudio] = useState(() => {
    try {
      return window.localStorage.getItem('ce:record-speaker-audio:v1') === 'true';
    } catch {
      return false;
    }
  });
  const speakerHelpId = `ce-record-speaker-help-${useId().replace(/:/g, '')}`;
  const labelsHelpId = `ce-speaker-labels-help-${useId().replace(/:/g, '')}`;
  const keepHelpId = `ce-keep-audio-help-${useId().replace(/:/g, '')}`;
  const recordingContext = useMemo(
    () => ({
      ...(context && typeof context === 'object' ? context : {}),
      account: context && typeof context === 'object' && 'account' in context ? context.account : props.account,
    }),
    [context, props.account],
  );
  const recorder = useRollingTranscriptionRecorder({
    sessionSlug,
    sessionConfig,
    context: recordingContext,
    workerUrl,
    chunkMs: DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS,
    labelSpeakers: panelMode === 'recordGroup' && speakerLabelsSupported === true && labelSpeakers,
    recordSpeakerAudio: panelMode === 'recordGroup' && recordSpeakerAudio,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestionDraft[]>([]);
  const [pendingDraftCount, setPendingDraftCount] = useState<number | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closingRef = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const draftsRef = useRef<HTMLDivElement | null>(null);
  const [closeError, setCloseError] = useState('');
  const isMountedRef = useRef(true);
  const lastAutoRequestedTranscriptRef = useRef('');
  const generationInFlightRef = useRef(false);
  const activeGenerationRequestRef = useRef(0);

  const failedCount = useMemo(
    () => recorder.segments.filter((segment) => segment.status === 'failed').length,
    [recorder.segments],
  );
  const trimmedTranscript = recorder.transcript.trim();
  const hasTranscript = trimmedTranscript.length > 0;
  const draftCount = pendingDraftCount ?? generatedQuestions.length;
  const hasGeneratedDraft = draftCount > 0;
  const latestSuccessfulTranscriptAt = useMemo(() => {
    // The latest to complete decides, not the order of parts: text pasted while a chunk transcribes leaves that
    // chunk's questions automatic, and text added after the last chunk waits for an explicit Generate.
    const latestComplete = [...recorder.segments]
      .filter((segment) => segment.status === 'complete')
      .sort((a, b) => Number(b.completedAt || 0) - Number(a.completedAt || 0) || b.index - a.index)[0];
    if (latestComplete?.source === 'text') return 0;
    return recorder.segments.reduce((latest, segment) => {
      if (segment.source === 'text' || segment.status !== 'complete' || !String(segment.text || '').trim())
        return latest;
      return Math.max(latest, Number(segment.completedAt || segment.startedAt || 0));
    }, 0);
  }, [recorder.segments]);
  const hasVisibleStatus =
    recorder.isRecording ||
    recorder.isPaused ||
    recorder.isBusy ||
    Number(recorder.pendingSegmentCount || 0) > 0 ||
    hasTranscript ||
    hasGeneratedDraft ||
    failedCount > 0 ||
    Boolean(recorder.errorMessage || generationError);
  const isRecorderSessionActive = recorder.isRecording || recorder.isPaused || recorder.isStopping;
  const isCapturing = isRecorderSessionActive || recorder.isBusy;
  useEffect(() => {
    if (!isCapturing || !onCaptureChange) return undefined;
    onCaptureChange(true);
    return () => onCaptureChange(false);
  }, [isCapturing, onCaptureChange]);
  const hasPendingTranscription = Number(recorder.pendingSegmentCount || 0) > 0;
  useEffect(() => {
    // Switching Record/Stop removes the focused button; keep Escape inside the modal.
    if (embeddedInModal && document.activeElement === document.body) panelRef.current?.focus();
  }, [embeddedInModal, isRecorderSessionActive]);

  const spokenLength = useMemo(() => transcriptSpeech(trimmedTranscript).length, [trimmedTranscript]);
  const canGenerate = !isClosing && spokenLength >= 50 && !isGenerating && !hasPendingTranscription;
  // Only audio not yet transcribed stays on the device; Clear asks before deleting it.
  const retainedAudioCount = recorder.downloadableChunkIds?.length ?? 0;
  const isStarting = !isRecorderSessionActive && recorder.isBusy;
  // A stopped recorder leads: an older close or generation error must not hide it.
  const visibleError =
    (recorder.status === 'error' && recorder.errorMessage) ||
    closeError ||
    generationError ||
    recorder.errorMessage ||
    '';
  const gapWarning =
    failedCount > 0 ? "Some audio couldn't be transcribed. Retry transcription or download the audio below." : '';
  const isPreparingRecording = panelMode === 'recordGroup' && speakerLabelsSupported === null;
  const recordButtonLabel = isRecorderSessionActive
    ? recorder.isStopping
      ? 'Stopping'
      : 'Stop'
    : isPreparingRecording
      ? 'Preparing recording'
      : isStarting
        ? 'Starting'
        : hasTranscript
          ? 'Record more'
          : 'Record';
  const recordButtonIcon = isRecorderSessionActive
    ? recorder.isStopping
      ? faSpinner
      : faStop
    : isStarting
      ? faSpinner
      : faMicrophone;
  const isRecordButtonSpinning = recorder.isStopping || isStarting;
  const statusLabel = recorder.isStopping ? 'Stopping recorder' : isStarting ? 'Starting recorder' : '';
  const shouldShowMeta = Boolean(statusLabel || hasPendingTranscription || hasTranscript || isGenerating);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isGenerating) {
      setGenerationElapsedSeconds(0);
      return undefined;
    }
    setGenerationElapsedSeconds(0);
    const timer = setInterval(() => {
      setGenerationElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  useEffect(() => {
    // A group host follows the transcript as it fills, so it opens once text exists; they can still collapse it.
    setIsTranscriptOpen(hasTranscript && panelMode === 'recordGroup');
  }, [hasTranscript, panelMode]);

  const { finalizeRecording, keepAudio } = recorder;
  const handleClose = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    setCloseError('');
    try {
      await finalizeRecording({ waitForTranscription: true });
      await keepAudio();
      if (isMountedRef.current) onClose?.();
    } catch (error) {
      if (isMountedRef.current)
        setCloseError(error instanceof Error ? error.message : 'Could not finish recording. Close again to retry.');
    } finally {
      closingRef.current = false;
      if (isMountedRef.current) setIsClosing(false);
    }
  }, [onClose, finalizeRecording, keepAudio]);

  // Closing during capture would end the recording, so it asks first.
  const capturingAudio = recorder.isRecording || recorder.isPaused;
  const requestClose = useCallback(async () => {
    if (capturingAudio) setConfirmStop(true);
    else await handleClose();
  }, [capturingAudio, handleClose]);

  useEffect(() => {
    if (!closeActionRef) return;
    closeActionRef.current = requestClose;
    return () => {
      closeActionRef.current = null;
    };
  }, [closeActionRef, requestClose]);

  const handleGenerateQuestions = useCallback(
    async ({ auto = false }: { auto?: boolean } = {}) => {
      const transcriptSnapshot = recorder.transcript.trim();
      if (!canGenerate || !transcriptSnapshot || generationInFlightRef.current) return;
      if (auto && lastAutoRequestedTranscriptRef.current === transcriptSnapshot) return;
      lastAutoRequestedTranscriptRef.current = transcriptSnapshot;

      const requestId = activeGenerationRequestRef.current + 1;
      activeGenerationRequestRef.current = requestId;
      generationInFlightRef.current = true;
      const existingPrompts = generatedQuestions.map(getGeneratedQuestionPrompt).filter(Boolean);
      setIsGenerating(true);
      setGenerationError('');
      try {
        // Future optional source path is intentionally disabled for now:
        // generateAudioDiscussionSummary -> uploadMarkdownSummaryToArweave -> documentURLs.
        const result = await generateQuestionsFromListeningTranscript(transcriptSnapshot, {
          sessionSlug,
          sessionConfig,
          context,
          workerUrl,
          defaultTags,
          count: LISTENING_QUESTION_COUNT,
          sessionInstructions: getSessionInstructions(sessionConfig),
          sourceTypeOverride: 'transcript',
          multiSpeakerHintOverride: 'likely_multiple_speakers',
          existingQuestionPrompts: existingPrompts,
        });
        if (!isMountedRef.current || activeGenerationRequestRef.current !== requestId) return;
        setGeneratedQuestions((previous) => mergeGeneratedQuestionDrafts(previous, result.statements));
        setGeneratedTitle((previous) => previous || result.surveyTitle);
      } catch (error) {
        if (!isMountedRef.current || activeGenerationRequestRef.current !== requestId) return;
        const message = error instanceof Error ? error.message : String(error || 'Failed to generate questions.');
        setGenerationError(message);
      } finally {
        if (isMountedRef.current && activeGenerationRequestRef.current === requestId) {
          generationInFlightRef.current = false;
          setIsGenerating(false);
        }
      }
    },
    [canGenerate, context, defaultTags, generatedQuestions, recorder.transcript, sessionConfig, sessionSlug, workerUrl],
  );

  useEffect(() => {
    if (panelMode !== 'recordGroup') return;
    if (!latestSuccessfulTranscriptAt || !canGenerate) return;
    void handleGenerateQuestions({ auto: true });
  }, [canGenerate, handleGenerateQuestions, latestSuccessfulTranscriptAt, panelMode, trimmedTranscript]);

  const handleClear = (discardAudio = false) => {
    recorder.clearDraft(discardAudio);
    activeGenerationRequestRef.current += 1;
    generationInFlightRef.current = false;
    lastAutoRequestedTranscriptRef.current = trimmedTranscript;
    setIsGenerating(false);
    setGeneratedQuestions([]);
    setPendingDraftCount(null);
    setGeneratedTitle('');
    setGenerationError('');
  };

  const showPanelHeader = !embeddedInModal;

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className={[
        styles.sessionListeningPanel,
        embeddedInModal ? styles.sessionListeningPanelEmbedded : '',
        hasGeneratedDraft ? styles.sessionListeningPanelWithDraft : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-busy={isClosing}
      data-testid={E2E_TESTIDS.SESSION_LISTENING_PANEL}
    >
      {panelMode === 'recordGroup' ? <SessionNewDraftsCue count={draftCount} draftsRef={draftsRef} /> : null}
      {isClosing ? <div role="status">Finalizing recording…</div> : null}
      {showPanelHeader ? (
        <div className={styles.sessionListeningHeader}>
          {hasVisibleStatus || panelMode === 'recordGroup' ? (
            <div className={styles.sessionListeningTitle}>
              <FontAwesomeIcon icon={faMicrophone} />
              <span>{panelMode === 'recordGroup' ? 'Group Conversation' : 'Listening'}</span>
              {panelMode === 'recordGroup' ? <SessionRecordingHelp /> : null}
            </div>
          ) : (
            <div aria-hidden="true" />
          )}
          {!embeddedInModal ? (
            <button
              type="button"
              className={styles.sessionListeningClose}
              onClick={() => {
                void requestClose();
              }}
              disabled={isClosing}
              aria-label={isClosing ? 'Finalizing recording before closing' : 'Close listening panel'}
              title={isClosing ? 'Finalizing recording' : 'Close'}
            >
              <FontAwesomeIcon icon={isClosing ? faSpinner : faTimes} spin={isClosing} />
            </button>
          ) : null}
        </div>
      ) : null}

      {panelMode !== 'recordGroup' ? <p>Record, upload audio, or add a transcript.</p> : null}
      <div className={styles.sessionListeningRecordWrap}>
        {isRecorderSessionActive ? (
          <div className={styles.sessionListeningActiveRecorder}>
            <div className={styles.sessionListeningWaveformShell}>
              <SessionListeningWaveform
                key={recorder.captureRestarts}
                streamRef={recorder.mediaStreamRef}
                isActive={isRecorderSessionActive}
                isPaused={recorder.isPaused}
              />
              <div className={styles.sessionListeningWaveformTimer} aria-live="polite" aria-atomic="true">
                <FontAwesomeIcon
                  icon={faCircle}
                  className={
                    recorder.isPaused || recorder.microphonePaused
                      ? styles.sessionListeningTimerDotPaused
                      : styles.sessionListeningTimerDot
                  }
                />
                <span>{recorder.microphonePaused ? 'Mic paused' : recorder.isPaused ? 'Paused' : 'Recording'}</span>
                <span>{formatSessionRecordingElapsed(recorder.elapsedSeconds)}</span>
              </div>
            </div>
            <div className={styles.sessionListeningButtonColumn} role="group" aria-label="Recording controls">
              <button
                type="button"
                className={[styles.sessionListeningAudioButton, styles.sessionListeningStopButton].join(' ')}
                onClick={() => {
                  void recorder.stopRecording();
                }}
                disabled={recorder.isStopping}
                aria-label="Stop recording"
                title="Stop recording"
                data-testid={E2E_TESTIDS.SESSION_LISTENING_STOP}
              >
                <FontAwesomeIcon icon={recorder.isStopping ? faSpinner : faStop} spin={recorder.isStopping} />
                <span className={styles.sessionListeningSrOnly}>Stop</span>
              </button>
              <button
                type="button"
                className={styles.sessionListeningAudioButton}
                onClick={recorder.isPaused ? recorder.resumeRecording : recorder.pauseRecording}
                disabled={recorder.isStopping}
                aria-label={recorder.isPaused ? 'Resume recording' : 'Pause recording'}
                title={recorder.isPaused ? 'Resume recording' : 'Pause recording'}
              >
                <FontAwesomeIcon icon={recorder.isPaused ? faPlay : faPause} />
                <span className={styles.sessionListeningSrOnly}>{recorder.isPaused ? 'Resume' : 'Pause'}</span>
              </button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            className={styles.sessionListeningRecordButton}
            onClick={() => {
              recordPressedRef.current = true;
              void recorder.startRecording();
            }}
            disabled={
              isClosing ||
              recorder.isBusy ||
              isPreparingRecording ||
              Boolean(recorder.ownerNotice) ||
              recorder.openElsewhere ||
              recorder.importing
            }
            data-testid={E2E_TESTIDS.SESSION_LISTENING_START}
          >
            <span className={styles.sessionListeningRecordIcon}>
              <FontAwesomeIcon icon={recordButtonIcon} spin={isRecordButtonSpinning} />
            </span>
            <span className={styles.sessionListeningRecordText}>{recordButtonLabel}</span>
          </Button>
        )}
        <SessionRecordingInput
          disabled={
            isRecorderSessionActive ||
            isClosing ||
            recorder.isBusy ||
            Boolean(recorder.ownerNotice) ||
            Boolean(recorder.openElsewhere)
          }
          onAudio={recorder.addAudio}
          onTranscript={async (text) => {
            await recorder.addTranscript(text);
            setIsTranscriptOpen(true);
          }}
        />
      </div>

      {panelMode === 'recordGroup' ? (
        <div className={styles.sessionRecordingOptions}>
          <span className={styles.sessionRecordingOption}>
            <label>
              <input
                type="checkbox"
                checked={recordSpeakerAudio}
                disabled={isRecorderSessionActive || recorder.isBusy}
                onChange={(event) => {
                  setRecordSpeakerAudio(event.target.checked);
                  try {
                    window.localStorage.setItem('ce:record-speaker-audio:v1', String(event.target.checked));
                  } catch {
                    /* The option still works when browser storage is unavailable. */
                  }
                }}
              />{' '}
              Include voices from this device&apos;s speakers
            </label>
            <button
              type="button"
              id={speakerHelpId}
              className={styles.sessionInterviewHeaderButton}
              aria-label="About including voices from this device's speakers"
            >
              <FontAwesomeIcon icon={faQuestionCircle} />
            </button>
            <UncontrolledTooltip target={speakerHelpId} trigger="hover focus" autohide={false}>
              Turns off echo cancellation so the mic also records people heard through this device&apos;s speakers. Use
              speakers, not headphones.
            </UncontrolledTooltip>
          </span>
          {speakerLabelsSupported ? (
            <span className={styles.sessionRecordingOption}>
              <label>
                <input
                  type="checkbox"
                  checked={labelSpeakers}
                  disabled={isRecorderSessionActive || recorder.isBusy || Boolean(recorder.labelsUnavailableReason)}
                  onChange={(event) => setLabelSpeakers(event.target.checked)}
                />{' '}
                Label speakers
              </label>
              <button
                type="button"
                id={labelsHelpId}
                className={styles.sessionInterviewHeaderButton}
                aria-label="About speaker labels"
              >
                <FontAwesomeIcon icon={faQuestionCircle} />
              </button>
              <UncontrolledTooltip target={labelsHelpId} trigger="hover focus" autohide={false}>
                Shows who spoke as Person 1, Person 2… using OpenAI. Up to four voices keep their number across the
                conversation; a fifth may change number. Numbers don&apos;t identify people.
              </UncontrolledTooltip>
            </span>
          ) : null}
        </div>
      ) : null}

      {shouldShowMeta && (
        <div className={styles.sessionListeningMeta} aria-live="polite">
          {statusLabel && <span>{statusLabel}</span>}
          {hasPendingTranscription && (
            <span className={styles.sessionListeningTranscribingStatus}>
              <FontAwesomeIcon icon={faSpinner} spin />
              <span>Transcribing…</span>
            </span>
          )}
          {hasTranscript && (
            <SessionListeningTranscriptToggle
              length={trimmedTranscript.length}
              open={isTranscriptOpen}
              pending={hasPendingTranscription}
              onToggle={() => setIsTranscriptOpen((open) => !open)}
            />
          )}
          {isGenerating && <span>{`Generating questions... ${generationElapsedSeconds}s`}</span>}
        </div>
      )}

      {visibleError && (
        <div className={styles.sessionListeningError} role="alert">
          {visibleError}
        </div>
      )}

      {gapWarning ? <div role="status">{gapWarning}</div> : null}
      {/* One tap must not end capture: Stop first, then close without waiting for uploads. */}
      {!isCapturing && (hasPendingTranscription || failedCount > 0 || isClosing) && onClose ? (
        <span className={styles.sessionRecordingOption}>
          <Button
            type="button"
            className={styles.sessionRecordingButton}
            aria-describedby={`${keepHelpId}-about`}
            onClick={async () => {
              try {
                await finalizeRecording({ waitForTranscription: false });
                await keepAudio();
                if (isMountedRef.current) onClose();
              } catch (error) {
                setCloseError(
                  error instanceof Error ? error.message : 'Could not keep the audio. Download it before leaving.',
                );
              }
            }}
          >
            Close and keep the audio
          </Button>
          <button
            type="button"
            id={keepHelpId}
            className={styles.sessionInterviewHeaderButton}
            aria-label="About closing and keeping the audio"
            aria-describedby={`${keepHelpId}-about`}
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
          <span id={`${keepHelpId}-about`} hidden>
            {KEEP_AUDIO_HELP}
          </span>
          <UncontrolledTooltip target={keepHelpId} trigger="hover focus" autohide={false}>
            {KEEP_AUDIO_HELP}
          </UncontrolledTooltip>
        </span>
      ) : null}
      <SessionRecordingNotices
        recorder={recorder}
        capturing={isRecorderSessionActive}
        labelCheckTimedOut={panelMode === 'recordGroup' && speakerLabelsCheckTimedOut}
      />

      <SessionRecordingChunks
        segments={recorder.segments}
        downloadableChunkIds={recorder.downloadableChunkIds}
        onRetry={recorder.retryChunk}
        onDownload={recorder.downloadChunk}
        onDownloadRecording={recorder.downloadRecording}
        capturing={isRecorderSessionActive}
        storageFailed={recorder.storageFailed}
      />

      {hasTranscript && isTranscriptOpen && (
        <SessionListeningTranscript
          transcript={recorder.transcript}
          clearDisabled={
            isRecorderSessionActive ||
            recorder.isBusy ||
            recorder.segments.some((segment) => !['complete', 'failed'].includes(segment.status))
          }
          onClear={() => setConfirmClear(true)}
        />
      )}

      <CEConfirmDialog
        isOpen={confirmStop}
        title="Stop recording?"
        body="Stop ends the recording and closes once its audio has uploaded."
        confirmLabel="Stop"
        cancelLabel="Keep recording"
        onCancel={() => setConfirmStop(false)}
        onConfirm={() => {
          setConfirmStop(false);
          void handleClose();
        }}
        testId="ce-recording-stop"
      />

      <CEConfirmDialog
        isOpen={confirmClear}
        title="Clear this recording?"
        body={
          retainedAudioCount
            ? 'This deletes the transcript and the audio not yet transcribed. Download that audio first to keep it.'
            : 'This deletes the transcript from this device.'
        }
        confirmLabel="Clear recording"
        cancelLabel="Keep recording"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          handleClear(true);
        }}
        testId="ce-recording-clear"
      />

      {hasTranscript && !hasGeneratedDraft && (
        <div className={styles.sessionListeningActions}>
          <Button
            type="button"
            className={styles.sessionListeningGenerate}
            onClick={() => {
              void handleGenerateQuestions();
            }}
            disabled={!canGenerate}
            data-testid={E2E_TESTIDS.SESSION_LISTENING_GENERATE}
          >
            <FontAwesomeIcon icon={isGenerating ? faSpinner : faQuestionCircle} spin={isGenerating} />
            <span>{isGenerating ? `Generating... ${generationElapsedSeconds}s` : 'Generate questions'}</span>
          </Button>
        </div>
      )}

      {generatedQuestions.length > 0 && (
        <div
          ref={draftsRef}
          tabIndex={-1}
          role="region"
          aria-label="Draft questions"
          className={styles.sessionListeningCreateWrap}
          data-testid={E2E_TESTIDS.SESSION_LISTENING_SUGGESTIONS}
        >
          <CreateQuestionsAndSurveys
            {...(props as CreateQuestionsAndSurveysPanelProps)}
            interviewQuestionReview
            appendPreformedQuestions
            questionSubmitLabel={isGenerating ? 'Waiting for new drafts…' : 'Submit questions'}
            submitDisabled={isGenerating}
            onDraftQuestionCountChange={setPendingDraftCount}
            preformedQuestions={generatedQuestions as CreateQuestionsAndSurveysPanelProps['preformedQuestions']}
            preformedSurvey={{ title: generatedTitle }}
            preformedMode="questions"
            defaultTags={defaultTags as CreateQuestionsAndSurveysPanelProps['defaultTags']}
            documentURLs={[]}
            submitClassName={styles.sessionListeningSubmit}
          />
        </div>
      )}
    </aside>
  );
}
