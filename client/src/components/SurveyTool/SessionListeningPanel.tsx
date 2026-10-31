import { getEffectiveTranscriptionConfig } from '../../utilities/ai/aiSettings';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
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
import { SessionRecordingChunks } from './SessionRecordingChunks';
import { useRollingTranscriptionRecorder } from '../../utilities/audio/useRollingTranscriptionRecorder';
import { DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS } from '../../utilities/audio/rollingTranscription';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { readThemeToken, subscribeThemeChanges } from '../../utilities/ui/themeRuntime';
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
type BrowserAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

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

type SessionListeningWaveformProps = {
  streamRef?: React.MutableRefObject<MediaStream | null>;
  isActive: boolean;
  isPaused: boolean;
};

const requestWaveformFrame = (callback: FrameRequestCallback) => {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(Date.now()), 33) as unknown as number;
};

const cancelWaveformFrame = (handle: number) => {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
};

export function SessionListeningWaveform({ streamRef, isActive, isPaused }: SessionListeningWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const bufferLenRef = useRef(0);
  const ctx2dRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastDrawRef = useRef(0);
  const waveformColorsRef = useRef({ canvas: 'Canvas', bars: 'Highlight' });

  useEffect(() => {
    const refreshWaveformColors = () => {
      waveformColorsRef.current = {
        canvas: readThemeToken('ce-control-face', 'Canvas'),
        bars: readThemeToken('ce-action-primary', 'Highlight'),
      };
    };
    refreshWaveformColors();
    return subscribeThemeChanges(refreshWaveformColors);
  }, []);

  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(canvas.clientWidth || 0, 260);
    const height = Math.max(canvas.clientHeight || 0, 80);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }, []);

  const drawWaveform = useCallback(function drawWaveform() {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) {
      animationRef.current = null;
      return;
    }

    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
    if (now - lastDrawRef.current < 33) {
      if (animationRef.current !== null) {
        animationRef.current = requestWaveformFrame(drawWaveform);
      }
      return;
    }
    lastDrawRef.current = now;

    let ctx = ctx2dRef.current;
    if (!ctx) {
      ctx = canvas.getContext('2d');
      ctx2dRef.current = ctx;
    }
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    if (!dataArrayRef.current || bufferLenRef.current !== bufferLength) {
      dataArrayRef.current = new Uint8Array(bufferLength);
      bufferLenRef.current = bufferLength;
    }
    const dataArray = dataArrayRef.current;
    analyser.getByteFrequencyData(dataArray);

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const visualHeight = Math.max(1, canvasHeight - 4);
    ctx.fillStyle = waveformColorsRef.current.canvas;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const barWidth = (canvasWidth / bufferLength) * 2.5;
    let peak = 0;
    for (let i = 0; i < bufferLength; i += 1) {
      if (dataArray[i] > peak) peak = dataArray[i];
    }
    const scale = peak > 0 ? visualHeight / Math.max(peak, 16) : 0;
    let x = 0;
    ctx.fillStyle = waveformColorsRef.current.bars;
    for (let i = 0; i < bufferLength; i += 1) {
      const barHeight = peak > 0 ? Math.max(2, Math.min(dataArray[i] * scale, visualHeight)) : 0;
      ctx.fillRect(x, canvasHeight - 2 - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }

    if (animationRef.current !== null) {
      animationRef.current = requestWaveformFrame(drawWaveform);
    }
  }, []);

  const clearRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const cleanupWaveform = useCallback(() => {
    clearRetry();
    if (animationRef.current !== null) {
      cancelWaveformFrame(animationRef.current);
      animationRef.current = null;
    }
    try {
      if (sourceNodeRef.current && analyserRef.current) {
        sourceNodeRef.current.disconnect(analyserRef.current);
      } else if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
      } else if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
    } catch (_) {
      // Best-effort audio graph cleanup.
    }
    sourceNodeRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;
    bufferLenRef.current = 0;
    ctx2dRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => undefined);
    }
    audioContextRef.current = null;
  }, [clearRetry]);

  const ensureWaveformSetup = useCallback(() => {
    if (!isActive || typeof window === 'undefined') return false;
    const stream = streamRef?.current;
    const canvas = canvasRef.current;
    if (!stream || !canvas) return false;
    const audioWindow = window as BrowserAudioWindow;
    const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextCtor) return false;

    try {
      sizeCanvas();
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContextCtor();
      }
      const audioContext = audioContextRef.current;
      if (!audioContext) return false;
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => undefined);
      }
      if (!analyserRef.current) {
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
      }
      if (!sourceNodeRef.current) {
        const analyser = analyserRef.current;
        if (!analyser) return false;
        const sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = sourceNode;
        sourceNode.connect(analyser);
      }
      if (!isPaused && animationRef.current === null) {
        lastDrawRef.current = 0;
        animationRef.current = requestWaveformFrame(drawWaveform);
      }
      return true;
    } catch (_) {
      return false;
    }
  }, [drawWaveform, isActive, isPaused, sizeCanvas, streamRef]);

  useEffect(() => {
    if (!isActive) {
      cleanupWaveform();
      return undefined;
    }

    let cancelled = false;
    const trySetup = () => {
      if (cancelled) return;
      if (ensureWaveformSetup()) {
        clearRetry();
        return;
      }
      clearRetry();
      retryTimeoutRef.current = setTimeout(() => {
        retryTimeoutRef.current = null;
        trySetup();
      }, 50);
    };

    trySetup();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', sizeCanvas);
    }
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', sizeCanvas);
      }
      cleanupWaveform();
    };
  }, [cleanupWaveform, clearRetry, ensureWaveformSetup, isActive, sizeCanvas]);

  useEffect(() => {
    if (!isActive) return;
    if (isPaused) {
      if (animationRef.current !== null) {
        cancelWaveformFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }
    if (analyserRef.current && canvasRef.current && animationRef.current === null) {
      lastDrawRef.current = 0;
      animationRef.current = requestWaveformFrame(drawWaveform);
    }
  }, [drawWaveform, isActive, isPaused]);

  return <canvas ref={canvasRef} className={styles.sessionListeningWaveformCanvas} aria-hidden="true" />;
}

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
  useEffect(() => {
    let current = true;
    setSpeakerLabelsSupported(null);
    setSpeakerLabelsCheckTimedOut(false);
    const complete = (supported: boolean) => {
      if (!current) return;
      current = false;
      clearTimeout(timeout);
      setSpeakerLabelsSupported(supported);
    };
    const timeout = setTimeout(() => {
      if (!current) return;
      setSpeakerLabelsCheckTimedOut(true);
      complete(false);
    }, 2000);
    // Checking availability must not unlock credentials or delay Record indefinitely.
    // Ignore late results so a timeout cannot switch labels on during capture.
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
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closingRef = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);
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
  const hasGeneratedDraft = generatedQuestions.length > 0;
  const latestSuccessfulTranscriptAt = useMemo(
    () =>
      recorder.segments.reduce((latest, segment) => {
        if (segment.status !== 'complete' || !String(segment.text || '').trim()) return latest;
        return Math.max(latest, Number(segment.completedAt || segment.startedAt || 0));
      }, 0),
    [recorder.segments],
  );
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

  const canGenerate = !isClosing && trimmedTranscript.length >= 50 && !isGenerating && !hasPendingTranscription;
  const isStarting = !isRecorderSessionActive && recorder.isBusy;
  // A stopped recorder leads: an older close or generation error must not hide it.
  const visibleError =
    (recorder.status === 'error' && recorder.errorMessage) ||
    closeError ||
    generationError ||
    recorder.errorMessage ||
    '';
  const gapWarning =
    failedCount > 0
      ? `${failedCount} ${failedCount === 1 ? 'part' : 'parts'} of the recording couldn't be transcribed. Retry or download the affected chunks below.`
      : '';
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
    if (!hasTranscript) {
      setIsTranscriptOpen(false);
    }
  }, [hasTranscript]);

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

  useEffect(() => {
    if (!closeActionRef) return;
    closeActionRef.current = handleClose;
    return () => {
      closeActionRef.current = null;
    };
  }, [closeActionRef, handleClose]);

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

  const handleClear = () => {
    recorder.clearDraft();
    activeGenerationRequestRef.current += 1;
    generationInFlightRef.current = false;
    lastAutoRequestedTranscriptRef.current = trimmedTranscript;
    setIsGenerating(false);
    setGeneratedQuestions([]);
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
      {isClosing ? <div role="status">Finalizing recording…</div> : null}
      {showPanelHeader ? (
        <div className={styles.sessionListeningHeader}>
          {hasVisibleStatus ? (
            <div className={styles.sessionListeningTitle}>
              <FontAwesomeIcon icon={faMicrophone} />
              <span>{panelMode === 'recordGroup' ? 'Group Conversation' : 'Listening'}</span>
            </div>
          ) : (
            <div aria-hidden="true" />
          )}
          {!embeddedInModal ? (
            <button
              type="button"
              className={styles.sessionListeningClose}
              onClick={() => {
                void handleClose();
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
              Record speaker audio
            </label>
            <button
              type="button"
              id={speakerHelpId}
              className={styles.sessionInterviewHeaderButton}
              aria-label="About recording speaker audio"
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
                Saves speaker turns with the transcript using OpenAI. Labels restart in each three-minute chunk and do
                not identify people. Speaker review and claiming are not available yet.
              </UncontrolledTooltip>
            </span>
          ) : null}
        </div>
      ) : null}
      {gapWarning ? <div role="status">{gapWarning}</div> : null}
      {/* One tap must not end capture: Stop first, then close without waiting for uploads. */}
      {!isCapturing && (hasPendingTranscription || failedCount > 0 || isClosing) && onClose ? (
        <span className={styles.sessionRecordingOption}>
          <Button
            type="button"
            className={styles.sessionInterviewHeaderButton}
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
      {panelMode === 'recordGroup' && speakerLabelsCheckTimedOut ? (
        <div role="status">Speaker label check timed out. Recording is available with plain transcription.</div>
      ) : null}
      {recorder.labelsUnavailableReason ? (
        <div role="status">{recorder.labelsUnavailableReason} Continuing with plain transcription.</div>
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
          <Button size="sm" onClick={recorder.dismissHiddenPeriods} aria-label="Dismiss hidden-page notice">
            Dismiss
          </Button>
        </div>
      ) : null}
      {isRecorderSessionActive && (recorder.pageHidden || !recorder.wakeLockHeld) ? (
        <div className={styles.sessionRecordingWakeNotice} role="status">
          {recorder.pageHidden
            ? 'Recording page is hidden. Return to this page; your phone may pause the microphone in the background.'
            : 'Screen lock is unavailable. Keep this page visible and the screen unlocked.'}
        </div>
      ) : null}
      {isRecorderSessionActive ? (
        <div className={styles.sessionListeningActiveRecorder}>
          <div className={styles.sessionListeningWaveformShell}>
            <SessionListeningWaveform
              streamRef={recorder.mediaStreamRef}
              isActive={isRecorderSessionActive}
              isPaused={recorder.isPaused}
            />
            <div className={styles.sessionListeningWaveformTimer} aria-live="polite" aria-atomic="true">
              <FontAwesomeIcon
                icon={faCircle}
                className={recorder.isPaused ? styles.sessionListeningTimerDotPaused : styles.sessionListeningTimerDot}
              />
              <span>{recorder.isPaused ? 'Paused' : 'Recording'}</span>
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
        <div className={styles.sessionListeningRecordWrap}>
          <Button
            type="button"
            className={styles.sessionListeningRecordButton}
            onClick={recorder.startRecording}
            disabled={isClosing || recorder.isBusy || isPreparingRecording}
            data-testid={E2E_TESTIDS.SESSION_LISTENING_START}
          >
            <span className={styles.sessionListeningRecordIcon}>
              <FontAwesomeIcon icon={recordButtonIcon} spin={isRecordButtonSpinning} />
            </span>
            <span className={styles.sessionListeningRecordText}>{recordButtonLabel}</span>
          </Button>
        </div>
      )}

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
            <button
              type="button"
              className={styles.sessionListeningTranscriptButton}
              onClick={() => setIsTranscriptOpen((open) => !open)}
              aria-expanded={isTranscriptOpen}
              aria-busy={hasPendingTranscription}
              data-testid={E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT_DETAILS}
            >
              <span>Transcript</span>
              <span>{trimmedTranscript.length} chars</span>
              <FontAwesomeIcon
                icon={faCaretDown}
                className={[
                  styles.sessionListeningTranscriptCaret,
                  isTranscriptOpen ? styles.sessionListeningTranscriptCaretExpanded : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              />
            </button>
          )}
          {isGenerating && <span>{`Generating questions... ${generationElapsedSeconds}s`}</span>}
        </div>
      )}

      {visibleError && (
        <div className={styles.sessionListeningError} role="alert">
          {visibleError}
        </div>
      )}

      <SessionRecordingChunks
        segments={recorder.segments}
        downloadableChunkIds={recorder.downloadableChunkIds}
        onRetry={recorder.retryChunk}
        onDownload={recorder.downloadChunk}
      />

      {hasTranscript && isTranscriptOpen && (
        <div className={styles.sessionListeningTranscriptDetails}>
          <div className={styles.sessionListeningTranscriptShell}>
            <textarea
              className={styles.sessionListeningTranscript}
              value={recorder.transcript}
              readOnly
              placeholder="Transcript"
              data-testid={E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT}
            />
            <button
              type="button"
              className={styles.sessionListeningClearTranscript}
              onClick={handleClear}
              disabled={
                isRecorderSessionActive ||
                recorder.isBusy ||
                recorder.segments.some((segment) => segment.status !== 'complete')
              }
              aria-label="Clear transcript"
              title="Clear transcript"
              data-testid={E2E_TESTIDS.SESSION_LISTENING_CLEAR}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>
      )}

      {hasTranscript && (
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
        <div className={styles.sessionListeningCreateWrap} data-testid={E2E_TESTIDS.SESSION_LISTENING_SUGGESTIONS}>
          <CreateQuestionsAndSurveys
            {...(props as CreateQuestionsAndSurveysPanelProps)}
            appendPreformedQuestions
            preformedQuestions={generatedQuestions as CreateQuestionsAndSurveysPanelProps['preformedQuestions']}
            preformedSurvey={{ title: generatedTitle }}
            preformedMode="questions"
            defaultTags={defaultTags as CreateQuestionsAndSurveysPanelProps['defaultTags']}
            documentURLs={[]}
          />
        </div>
      )}
    </aside>
  );
}
