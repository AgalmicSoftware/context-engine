import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Button } from 'reactstrap';
import styles from './SurveyTool.module.scss';
import CreateQuestionsAndSurveys from './CreateQuestionsAndSurveys';
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
};
type CreateQuestionsAndSurveysPanelProps = React.ComponentProps<typeof CreateQuestionsAndSurveys>;
type BrowserAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export const formatSessionRecordingElapsed = (secondsRaw: unknown) => {
  const seconds = Math.max(0, Math.floor(Number(secondsRaw || 0)));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

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
  } = props;
  const recorder = useRollingTranscriptionRecorder({
    sessionSlug,
    sessionConfig,
    context,
    workerUrl,
    chunkMs: DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<unknown[]>([]);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generationKey, setGenerationKey] = useState(0);
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const failedCount = useMemo(
    () => recorder.segments.filter((segment) => segment.status === 'error').length,
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
  const latestFailedTranscriptAt = useMemo(
    () =>
      recorder.segments.reduce((latest, segment) => {
        if (segment.status !== 'error') return latest;
        return Math.max(latest, Number(segment.completedAt || segment.startedAt || 0));
      }, 0),
    [recorder.segments],
  );
  const hasActionableFailedSegment = latestFailedTranscriptAt > latestSuccessfulTranscriptAt;
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
  const hasPendingTranscription = Number(recorder.pendingSegmentCount || 0) > 0;
  const canGenerate = trimmedTranscript.length >= 50 && !isGenerating && !hasPendingTranscription;
  const isStarting = !isRecorderSessionActive && recorder.isBusy;
  const recorderError = recorder.errorMessage && !hasTranscript ? recorder.errorMessage : '';
  const shouldShowGenericRecorderError = Boolean(
    hasTranscript &&
    (hasActionableFailedSegment ||
      (recorder.errorMessage &&
        latestFailedTranscriptAt > 0 &&
        latestFailedTranscriptAt >= latestSuccessfulTranscriptAt)),
  );
  const visibleError =
    generationError ||
    recorderError ||
    (hasActionableFailedSegment || shouldShowGenericRecorderError
      ? 'Some audio could not be transcribed. You can keep recording or generate questions from the transcript already captured.'
      : '');
  const recordButtonLabel = isRecorderSessionActive
    ? recorder.isStopping
      ? 'Stopping'
      : 'Stop'
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
  const statusLabel = recorder.isStopping
    ? 'Stopping recorder'
    : isStarting
      ? 'Starting recorder'
      : '';
  const shouldShowMeta = Boolean(statusLabel || hasPendingTranscription || hasTranscript || isGenerating);

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

  const handleClose = async () => {
    if (isClosing) return;
    const shouldFinalize = isRecorderSessionActive || hasPendingTranscription;
    if (!shouldFinalize) {
      onClose?.();
      return;
    }

    setIsClosing(true);
    try {
      if (typeof recorder.finalizeRecording === 'function') {
        await recorder.finalizeRecording({ waitForTranscription: true });
      } else if (typeof recorder.stopRecording === 'function') {
        await recorder.stopRecording();
      }
    } finally {
      setIsClosing(false);
      onClose?.();
    }
  };

  const handleGenerateQuestions = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setGenerationError('');
    try {
      // Future optional source path is intentionally disabled for now:
      // generateAudioDiscussionSummary -> uploadMarkdownSummaryToArweave -> documentURLs.
      const result = await generateQuestionsFromListeningTranscript(recorder.transcript, {
        sessionSlug,
        sessionConfig,
        context,
        workerUrl,
        defaultTags,
        count: LISTENING_QUESTION_COUNT,
        sessionInstructions: getSessionInstructions(sessionConfig),
        sourceTypeOverride: 'transcript',
        multiSpeakerHintOverride: 'likely_multiple_speakers',
      });
      setGeneratedQuestions(result.statements);
      setGeneratedTitle(result.surveyTitle);
      setGenerationKey((value) => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'Failed to generate questions.');
      setGenerationError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    recorder.clearDraft();
    setGeneratedQuestions([]);
    setGeneratedTitle('');
    setGenerationError('');
  };

  return (
    <aside
      className={[styles.sessionListeningPanel, hasGeneratedDraft ? styles.sessionListeningPanelWithDraft : '']
        .filter(Boolean)
        .join(' ')}
      data-testid={E2E_TESTIDS.SESSION_LISTENING_PANEL}
    >
      <div className={styles.sessionListeningHeader}>
        {hasVisibleStatus ? (
          <div className={styles.sessionListeningTitle}>
            <FontAwesomeIcon icon={faMicrophone} />
            <span>{panelMode === 'recordGroup' ? 'Group Conversation' : 'Listening'}</span>
          </div>
        ) : (
          <div aria-hidden="true" />
        )}
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
      </div>

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
            disabled={recorder.isBusy}
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
              disabled={isRecorderSessionActive || recorder.isBusy}
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
            onClick={handleGenerateQuestions}
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
            key={`listening-generated-${generationKey}`}
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
