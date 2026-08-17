/** @file AudioInput.tsx */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input, InputGroupText } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrophone,
  faCircle,
  faLock,
  faUnlock,
  faArrowLeft,
  faHandSparkles,
  faSpinner,
  faPause,
  faPlay,
  faStop,
  faDownload,
} from '@fortawesome/free-solid-svg-icons';

import styles from './AudioInput.module.scss';
import { requestAiRewrite, setVadTrimEnabled } from '../../../utilities/ai/aiClient.js';
import { useWhisper, RECORDING_STATUS } from '../../../utilities/useWhisper.js';
import { createLogger } from '../../../utilities/logging.js';
import { readThemeToken, subscribeThemeChanges } from '../../../utilities/ui/themeRuntime';

const surveyLog = createLogger('surveys');
const LIVE_CONVERSATION_RECORDER_DISABLED_REASON =
  'Recording is temporarily disabled while we move long-form conversation capture into a future workflow.';

type SessionConfig = Record<string, unknown>;

type LastRecording = {
  blob: Blob | null;
  mimeType?: string;
};

type UseWhisperResult = {
  status: string;
  isRecording: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  isStreaming: boolean;
  transcript: {
    live?: string;
    final?: string;
  };
  errorMessage: string;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  audioContextRef?: React.MutableRefObject<AudioContext | null>;
  mediaStreamRef?: React.MutableRefObject<MediaStream | null>;
  lastRecordingBlobRef?: React.MutableRefObject<LastRecording | null>;
  getLastRecordingBlob?: () => LastRecording | null | undefined;
};

type UseWhisperOptions = {
  apiKey?: string;
  silenceDetection?: boolean;
  timeSlice?: number;
  sessionSlug?: string;
  sessionConfig?: SessionConfig | null;
  context?: unknown;
  workerUrl?: string;
  onTranscriptionUpdate?: (transcript: string) => void;
  onTranscriptionComplete?: (finalText: string) => void;
  onError?: (err: unknown) => void;
  onRecordingStop?: (blob?: Blob | null, mimeType?: string) => void;
};

type UseWhisperHook = (options?: UseWhisperOptions) => UseWhisperResult;

type AudioInputProps = {
  placeholder?: string;
  updateFunction?: (text: string) => void;
  toggleEncryption?: (encrypted: boolean) => void;
  value?: string | number | null;
  encrypted?: boolean;
  dataTestId?: string;
  dataCeQuestionId?: string;
  hideEncryption?: boolean;
  enableAiRewrite?: boolean;
  smallEncryptToggle?: boolean;
  forceGlow?: boolean;
  disableEncryption?: boolean;
  placeholderOpacity?: number | string | null;
  disabled?: boolean;
  recordingDisabled?: boolean;
  sessionSlug?: string;
  sessionConfig?: SessionConfig | null;
  context?: unknown;
  workerUrl?: string;
  longFormMode?: boolean;
  showRecorderControlsInTextbox?: boolean;
  showRecordingTimerInTextbox?: boolean;
  recordingDurationSeconds?: number | string | null;
  enableDownloads?: boolean;
  style?: React.CSSProperties;
};

type PlaceholderStyle = React.CSSProperties & {
  '--placeholder-opacity'?: string;
};

const useWhisperHook = useWhisper as UseWhisperHook;

const describeError = (err: unknown) => (err instanceof Error ? err.message : err);

const AudioInput = ({
  placeholder,
  updateFunction,
  toggleEncryption,
  value,
  encrypted,
  dataTestId = '',
  dataCeQuestionId = '',
  hideEncryption = false,
  enableAiRewrite = true,
  smallEncryptToggle = false,
  forceGlow = false,
  disableEncryption = false,
  placeholderOpacity = null,
  disabled = false,
  recordingDisabled = false,

  sessionSlug,
  sessionConfig,
  context,
  workerUrl,

  longFormMode = false,
  showRecorderControlsInTextbox = false,
  showRecordingTimerInTextbox = false,
  recordingDurationSeconds = null,
  enableDownloads = false,
}: AudioInputProps) => {
  const [encryptBoxChecked, setEncryptBoxChecked] = useState<boolean | undefined>(encrypted);
  const [userText, setUserText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [rewrittenText, setRewrittenText] = useState('');
  const [aiRewriteActive, setAiRewriteActive] = useState(false);
  const [waitingForAI, setWaitingForAI] = useState(false);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [recorderNotice, setRecorderNotice] = useState('');
  const waitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Live mirror to avoid stale closure in waiting timer effect
  const waitingForAIRef = useRef(false);
  useEffect(() => {
    waitingForAIRef.current = waitingForAI;
  }, [waitingForAI]);

  // Elapsed timer for long-form sessions (seconds)
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTriggeredRef = useRef(false);

  // Waveform overlay refs
  const textareaWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const waveformSetupRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastDrawRef = useRef(0);
  const resizeListenerAttachedRef = useRef(false);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const bufferLenRef = useRef(0);
  const ctx2dRef = useRef<CanvasRenderingContext2D | null>(null);
  const waveformColorsRef = useRef({ track: 'Canvas', bars: 'Highlight' });

  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const isRecorderDisabled = !!recordingDisabled;

  useEffect(() => {
    const refreshWaveformColors = () => {
      waveformColorsRef.current = {
        track: readThemeToken('ce-control-face', 'Canvas'),
        bars: readThemeToken('ce-action-primary', 'Highlight'),
      };
    };
    refreshWaveformColors();
    return subscribeThemeChanges(refreshWaveformColors);
  }, []);

  const effectiveSessionSlug = sessionSlug;
  const effectiveSessionConfig = sessionConfig;

  // Guard against state updates after unmount / async completion
  const abortedRef = useRef(false);
  const parentUpdateRafRef = useRef<number | null>(null);
  const parentUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedParentTextRef = useRef<string | undefined>(undefined);
  const lastEmittedTextRef = useRef('');
  const hasEmittedTextRef = useRef(false);
  const updateFunctionRef = useRef<AudioInputProps['updateFunction']>(updateFunction);

  useEffect(() => {
    updateFunctionRef.current = updateFunction;
  }, [updateFunction]);

  const cancelPendingParentUpdate = useCallback(() => {
    if (
      parentUpdateRafRef.current !== null &&
      typeof window !== 'undefined' &&
      typeof window.cancelAnimationFrame === 'function'
    ) {
      window.cancelAnimationFrame(parentUpdateRafRef.current);
    }
    if (parentUpdateTimeoutRef.current !== null) {
      clearTimeout(parentUpdateTimeoutRef.current);
    }
    parentUpdateRafRef.current = null;
    parentUpdateTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    abortedRef.current = false;
    return () => {
      abortedRef.current = true;
      cancelPendingParentUpdate();
    };
  }, [cancelPendingParentUpdate]);

  // Silence-trim (VAD) toggle - local component state only (no visible UI)
  const [trimOn, setTrimOn] = useState(true);

  // Keep the module-scoped flag in sync with component state
  useEffect(() => {
    setVadTrimEnabled(trimOn);
  }, [trimOn]);

  const flushQueuedParentUpdate = useCallback(() => {
    parentUpdateRafRef.current = null;
    parentUpdateTimeoutRef.current = null;
    if (abortedRef.current || typeof updateFunctionRef.current !== 'function') return;
    const nextText = queuedParentTextRef.current;
    queuedParentTextRef.current = undefined;
    if (nextText === undefined) return;
    if (hasEmittedTextRef.current && nextText === lastEmittedTextRef.current) return;
    lastEmittedTextRef.current = nextText;
    hasEmittedTextRef.current = true;
    updateFunctionRef.current(nextText);
  }, []);

  // Defer and coalesce parent updates; avoid re-emitting identical text
  const callParentUpdate = useCallback(
    (text: string) => {
      if (typeof updateFunctionRef.current !== 'function' || abortedRef.current) return;
      if (queuedParentTextRef.current === text) return;
      if (
        queuedParentTextRef.current === undefined &&
        hasEmittedTextRef.current &&
        text === lastEmittedTextRef.current
      ) {
        return;
      }
      queuedParentTextRef.current = text;
      if (parentUpdateRafRef.current !== null || parentUpdateTimeoutRef.current !== null) return;
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        parentUpdateRafRef.current = window.requestAnimationFrame(flushQueuedParentUpdate);
      } else {
        parentUpdateTimeoutRef.current = setTimeout(flushQueuedParentUpdate, 0);
      }
    },
    [flushQueuedParentUpdate],
  );

  // Record-completed flag for strict dock gating (in addition to lastRecordingBlobRef)
  const hasRecordedRef = useRef(false);

  const {
    status,
    isRecording,
    isPaused,
    isProcessing,
    isStreaming,
    transcript,
    errorMessage,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    audioContextRef,
    mediaStreamRef,
    lastRecordingBlobRef,
    getLastRecordingBlob,
  } = useWhisperHook({
    apiKey: '',
    silenceDetection: false,
    timeSlice: 0,
    sessionSlug: effectiveSessionSlug,
    sessionConfig: effectiveSessionConfig,
    context,
    workerUrl,
    // Live words are distracting - do not inject into textarea while recording
    onTranscriptionUpdate: () => {},
    // Final text: append to existing content (defer parent update to avoid setState-in-render warnings)
    onTranscriptionComplete: (finalText: string) => {
      const cleaned = (finalText || '').trim();
      if (!cleaned) return;
      setUserText((prev) => {
        const base = (prev || '').trimEnd();
        const spacer = base.length ? (/\s$/.test(base) ? '' : ' ') : '';
        const next = `${base}${spacer}${cleaned}`;
        callParentUpdate(next);
        return next;
      });
    },
    onError: (err: unknown) => {
      surveyLog.error('[AudioInput] Transcription error:', describeError(err));
    },
    onRecordingStop: () => {
      hasRecordedRef.current = true;
    },
  }) as UseWhisperResult;

  // Live flags for visibility handler to avoid stale closures
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Sync external value
  useEffect(() => {
    let syncedText: string;
    if (value && value !== placeholder) {
      syncedText = String(value);
      setUserText(syncedText);
    } else if (!value) {
      syncedText = '';
      setUserText('');
    } else {
      return;
    }

    // Keep dedupe/coalescing refs aligned with externally-controlled text.
    cancelPendingParentUpdate();
    queuedParentTextRef.current = undefined;
    lastEmittedTextRef.current = syncedText;
    hasEmittedTextRef.current = true;
  }, [value, placeholder, cancelPendingParentUpdate]);

  // Sync encryption checkbox
  useEffect(() => {
    setEncryptBoxChecked(encrypted);
  }, [encrypted]);

  // AI waiting timer (clean up on unmount)
  useEffect(() => {
    if (waitingForAI && !waitTimerRef.current) {
      waitTimerRef.current = setInterval(() => setWaitingSeconds((s) => s + 1), 1000);
    }
    if (!waitingForAI && waitTimerRef.current) {
      clearInterval(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    return () => {
      if (waitTimerRef.current) {
        clearInterval(waitTimerRef.current);
        waitTimerRef.current = null;
      }
    };
  }, [waitingForAI]);

  // Keep "Waiting for AI" message local so it never becomes a persisted answer.
  useEffect(() => {
    if (!waitingForAIRef.current) return;
    const msg = `Waiting for AI... ${waitingSeconds}s`;
    setUserText(msg);
  }, [waitingSeconds]);

  // Recording elapsed timer lifecycle
  const longFormEnabled = !!longFormMode;
  const wantsTimer = !!(showRecordingTimerInTextbox || longFormEnabled);
  const wantsInlineControls = !!(showRecorderControlsInTextbox || longFormEnabled);
  const isTranscriptionRecordingMode = !!(
    longFormEnabled ||
    showRecorderControlsInTextbox ||
    showRecordingTimerInTextbox
  );
  const recordingDurationLimitSeconds =
    Number.isFinite(Number(recordingDurationSeconds)) && Number(recordingDurationSeconds) > 0
      ? Math.floor(Number(recordingDurationSeconds))
      : null;

  useEffect(() => {
    // Ticks only while actively recording and the overlay is visible
    const shouldTick = isRecording && !isPaused && (wantsTimer || wantsInlineControls);

    if (shouldTick) {
      if (!recordTimerRef.current) {
        recordTimerRef.current = setInterval(() => {
          setRecordingSeconds((s) => s + 1);
        }, 1000);
      }
    } else if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    // Reset when session ends (neither recording nor paused)
    if (!isRecording && !isPaused) {
      setRecordingSeconds(0);
    }

    // Unmount handled by a separate effect below
    return () => {};
  }, [isRecording, isPaused, wantsTimer, wantsInlineControls]);

  useEffect(() => {
    if (!isRecording && !isPaused) {
      autoStopTriggeredRef.current = false;
      return;
    }
    if (!isRecording || isPaused) return;
    if (recordingDurationLimitSeconds == null) return;
    if (autoStopTriggeredRef.current) return;
    if (recordingSeconds < recordingDurationLimitSeconds) return;

    autoStopTriggeredRef.current = true;
    stopRecording();
  }, [isRecording, isPaused, recordingDurationLimitSeconds, recordingSeconds, stopRecording]);

  // Safety: clear timer on unmount (single effect)
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    };
  }, []);

  // Waveform draw (throttled to ~30 FPS), memoized with no per-frame allocations
  const drawWaveform = React.useCallback(function drawWaveform() {
    if (!analyserRef.current || !canvasRef.current) {
      // stop scheduling if prerequisites are gone; controller effect will re-start if needed
      animationRef.current = null;
      return;
    }

    // ~30 FPS throttle
    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    if (now - lastDrawRef.current < 33) {
      if (animationRef.current !== null) {
        animationRef.current = window.requestAnimationFrame(drawWaveform);
      }
      return;
    }
    lastDrawRef.current = now;

    const canvas = canvasRef.current;
    let ctx = ctx2dRef.current;
    if (!ctx) {
      ctx = canvas.getContext('2d');
      ctx2dRef.current = ctx;
    }
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    if (!dataArrayRef.current || bufferLenRef.current !== bufferLength) {
      dataArrayRef.current = new Uint8Array(bufferLength);
      bufferLenRef.current = bufferLength;
    }
    const dataArray = dataArrayRef.current;

    analyser.getByteFrequencyData(dataArray);

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = waveformColorsRef.current.track;
    ctx.fillRect(0, 0, W, H);

    const barWidth = (W / bufferLength) * 2.5;
    let x = 0;
    ctx.fillStyle = waveformColorsRef.current.bars;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = Math.min(dataArray[i] / 2, H);
      ctx.fillRect(x, H - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }

    // Only continue the loop if we still own the handle
    if (animationRef.current !== null) {
      animationRef.current = window.requestAnimationFrame(drawWaveform);
    }
  }, []);

  // Mounted once: visibility/pagehide handler with live refs
  useEffect(() => {
    const onVis = () => {
      const hidden =
        document.hidden || (typeof document.visibilityState === 'string' && document.visibilityState !== 'visible');
      if (hidden) {
        if (animationRef.current) {
          window.cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        return;
      }
      const ctxReady = !!(audioContextRef?.current && mediaStreamRef?.current);
      const shouldAnimate =
        isRecordingRef.current && !isPausedRef.current && ctxReady && analyserRef.current && canvasRef.current;

      if (shouldAnimate && !animationRef.current) {
        lastDrawRef.current = 0;
        animationRef.current = window.requestAnimationFrame(drawWaveform);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onVis);
    };
  }, [audioContextRef, mediaStreamRef, drawWaveform]);

  // Keep canvas sized to wrapper
  const sizeCanvasToWrap = useCallback(() => {
    const wrapEl = textareaWrapRef.current;
    const canvasEl = canvasRef.current;
    if (wrapEl && canvasEl) {
      const { clientWidth, clientHeight } = wrapEl;
      // Ensure at least our textarea min-height
      const minH = Math.max(clientHeight, 80);
      if (canvasEl.width !== clientWidth) canvasEl.width = clientWidth;
      if (canvasEl.height !== minH) canvasEl.height = minH;
    }
  }, []);

  const clearWaveformSetupRetry = useCallback(() => {
    if (waveformSetupRetryTimeoutRef.current !== null) {
      clearTimeout(waveformSetupRetryTimeoutRef.current);
      waveformSetupRetryTimeoutRef.current = null;
    }
  }, []);

  const ensureWaveformSetup = useCallback(() => {
    const ctx = audioContextRef?.current;
    const stream = mediaStreamRef?.current;
    if (!ctx || !stream || !canvasRef.current) return false;

    try {
      sizeCanvasToWrap();

      if (ctx.state === 'suspended') {
        ctx.resume().catch((e) => {
          surveyLog.warn('AudioInput: fallback', e);
        });
      }

      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
      }

      if (!sourceNodeRef.current) {
        const analyser = analyserRef.current;
        if (!analyser) return false;
        const source = ctx.createMediaStreamSource(stream);
        sourceNodeRef.current = source;
        source.connect(analyser);
      }

      // Ensure waveform buffers and context are ready
      if (canvasRef.current && !ctx2dRef.current) {
        ctx2dRef.current = canvasRef.current.getContext('2d');
      }
      const analyser = analyserRef.current;
      if (!analyser) return false;
      const blen = analyser.frequencyBinCount;
      if (!dataArrayRef.current || bufferLenRef.current !== blen) {
        dataArrayRef.current = new Uint8Array(blen);
        bufferLenRef.current = blen;
      }

      // Keep canvas in sync with layout while the session exists
      if (!resizeListenerAttachedRef.current) {
        window.addEventListener('resize', sizeCanvasToWrap);
        resizeListenerAttachedRef.current = true;
      }

      // If we are actively recording, nodes are now ready, and no RAF is running yet,
      // start the animation loop immediately so the waveform appears right away.
      if (
        (isRecordingRef.current || isRecording) &&
        !(isPausedRef.current || isPaused) &&
        analyserRef.current &&
        canvasRef.current &&
        !animationRef.current
      ) {
        lastDrawRef.current = 0;
        animationRef.current = window.requestAnimationFrame(drawWaveform);
      }
      return !!(analyserRef.current && sourceNodeRef.current);
    } catch (e) {
      // Gate noisy warning in production
      if (process.env.NODE_ENV !== 'production') {
        surveyLog.warn('[AudioInput] Waveform setup failed:', e);
      }
      return false;
    }
  }, [audioContextRef, mediaStreamRef, sizeCanvasToWrap, drawWaveform, isRecording, isPaused]);

  // Waveform lifecycle - attach/detach nodes for the entire session (paused or not)
  useEffect(() => {
    let cancelled = false;
    const sessionActive = isRecording || isPaused;
    if (sessionActive) {
      const trySetup = () => {
        if (cancelled) return;
        if (ensureWaveformSetup()) {
          clearWaveformSetupRetry();
          return;
        }
        clearWaveformSetupRetry();
        waveformSetupRetryTimeoutRef.current = setTimeout(() => {
          waveformSetupRetryTimeoutRef.current = null;
          trySetup();
        }, 50);
      };

      trySetup();
    }

    // Cleanup: always tear down listener/RAF and release nodes/buffers unconditionally.
    return () => {
      cancelled = true;
      clearWaveformSetupRetry();
      if (resizeListenerAttachedRef.current) {
        window.removeEventListener('resize', sizeCanvasToWrap);
        resizeListenerAttachedRef.current = false;
      }
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
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
      } catch (e) {
        surveyLog.warn('AudioInput: cleanup', e);
      }
      sourceNodeRef.current = null;
      analyserRef.current = null;
      ctx2dRef.current = null;
      dataArrayRef.current = null;
      bufferLenRef.current = 0;
    };
  }, [isRecording, isPaused, ensureWaveformSetup, clearWaveformSetupRetry, sizeCanvasToWrap]);

  // Animation controller - run RAF only while actively recording (not paused)
  useEffect(() => {
    const nodesReady = !!(analyserRef.current && canvasRef.current);
    const shouldAnimate = isRecording && !isPaused && nodesReady;

    if (shouldAnimate) {
      if (!animationRef.current) {
        // reset throttle timestamp at (re)start to avoid burst
        lastDrawRef.current = 0;
        animationRef.current = window.requestAnimationFrame(drawWaveform);
      }
    } else {
      // Pause/resume/stop: stop RAF but keep last frame on the canvas
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  }, [isRecording, isPaused, drawWaveform]);

  // Handlers
  const handleRecordClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) e.preventDefault();
    if (isRecorderDisabled) {
      setRecorderNotice(LIVE_CONVERSATION_RECORDER_DISABLED_REASON);
      return;
    }
    if (isRecording || isPaused) {
      // Single control toggles stop while live
      stopRecording();
    } else {
      // Each cycle appends on completion
      setRewrittenText('');
      setOriginalText('');
      setAiRewriteActive(false);
      setWaitingForAI(false);
      setWaitingSeconds(0);
      startRecording();
    }
  };

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    if (!waitingForAI) {
      const next = e.target.value;
      if (recorderNotice) setRecorderNotice('');
      setUserText(next);
      callParentUpdate(next);
    }
  };

  const handleEncryptCheckbox = () => {
    const next = !encryptBoxChecked;
    setEncryptBoxChecked(next);
    if (typeof toggleEncryption === 'function') toggleEncryption(next);
  };

  const handleAiRewrite = async () => {
    const currentRewriteText = userText;
    try {
      setOriginalText(currentRewriteText);
      setRewrittenText('');
      setAiRewriteActive(false);
      setWaitingForAI(true);
      setWaitingSeconds(0);
      const cleaned = String(
        await requestAiRewrite(currentRewriteText, {
          sessionSlug: effectiveSessionSlug,
          sessionConfig: effectiveSessionConfig,
          context,
          workerUrl,
        }),
      );
      if (abortedRef.current) return;
      setWaitingForAI(false);
      setWaitingSeconds(0);
      setRewrittenText(cleaned);
      setAiRewriteActive(true);
      setUserText(cleaned);
      callParentUpdate(cleaned);
    } catch (err) {
      surveyLog.error('[AudioInput] AI rewrite error:', err);
      if (abortedRef.current) return;
      setWaitingForAI(false);
      setWaitingSeconds(0);
      setRewrittenText('');
      setAiRewriteActive(false);
      setUserText(currentRewriteText);
      callParentUpdate(currentRewriteText);
    }
  };

  const handleRevertText = () => {
    setAiRewriteActive(false);
    setRewrittenText('');
    setUserText(originalText);
    callParentUpdate(originalText);
  };

  const getPlaceholder = () => (userText ? '' : placeholder || '');

  // UI state
  const visibleText = userText;
  const isActiveRecording = isRecording && !isPaused;
  const isProcessingUI = status === RECORDING_STATUS.PROCESSING || !!isProcessing;

  const lockGlow = !!(encryptBoxChecked || forceGlow);
  const showInlineOverlay = (wantsTimer || wantsInlineControls) && (isRecording || isPaused);

  // Download helpers
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const makeTimestamp = () => {
    const d = new Date();
    const YYYY = d.getFullYear();
    const MM = pad2(d.getMonth() + 1);
    const DD = pad2(d.getDate());
    const HH = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return { YYYY, MM, DD, HH, mm, ss };
  };
  const extFromMime = (mt?: string) => {
    if (!mt) return 'mp3';
    const map: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/opus': 'opus',
      'audio/mp4': 'mp4',
      'audio/aac': 'aac',
    };
    return map[mt] || mt.split('/')[1] || 'mp3';
  };

  const downloadAudio = () => {
    const rec =
      typeof getLastRecordingBlob === 'function'
        ? getLastRecordingBlob()
        : lastRecordingBlobRef?.current || { blob: null, mimeType: '' };

    if (!rec?.blob) return;
    const { blob, mimeType } = rec;
    const { YYYY, MM, DD, HH, mm, ss } = makeTimestamp();
    const ext = extFromMime(mimeType || blob.type || 'audio/mpeg');
    const fname = `recording-${YYYY}${MM}${DD}-${HH}${mm}${ss}.${ext}`;
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      const revoke = () => {
        URL.revokeObjectURL(url);
        window.removeEventListener('pagehide', revoke);
      };
      setTimeout(revoke, 4000);
      window.addEventListener('pagehide', revoke, { once: true });
    }
  };

  const downloadTranscript = () => {
    const text = String(userText || '').trim();
    const { YYYY, MM, DD, HH, mm, ss } = makeTimestamp();
    const fname = `transcript-${YYYY}${MM}${DD}-${HH}${mm}${ss}.txt`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      const revoke = () => {
        URL.revokeObjectURL(url);
        window.removeEventListener('pagehide', revoke);
      };
      setTimeout(revoke, 4000);
      window.addEventListener('pagehide', revoke, { once: true });
    }
  };

  const hasRecordingBlob = !!(
    (typeof getLastRecordingBlob === 'function' && getLastRecordingBlob()?.blob) ||
    (lastRecordingBlobRef?.current && lastRecordingBlobRef.current.blob)
  );

  // Show actual extension for the last recording blob
  const getDownloadExt = useCallback(() => {
    const rec =
      typeof getLastRecordingBlob === 'function'
        ? getLastRecordingBlob()
        : lastRecordingBlobRef?.current || { blob: null, mimeType: '' };
    const t = rec?.mimeType || (rec?.blob && rec.blob.type) || 'audio/mpeg';
    return extFromMime(t);
  }, [getLastRecordingBlob, lastRecordingBlobRef]);

  // Strict gating for download dock
  const hasText = (visibleText || '').trim().length > 0;
  const hasAudio = !!lastRecordingBlobRef?.current?.blob || hasRecordedRef.current === true;
  const showDownloadDock = !!enableDownloads && hasText && hasAudio && !isProcessingUI;
  const placeholderStyle: PlaceholderStyle | undefined =
    placeholderOpacity === null || placeholderOpacity === undefined
      ? undefined
      : { '--placeholder-opacity': String(placeholderOpacity) };

  return (
    <div className={styles.audioInputContainer}>
      {/* topControls: AI rewrite + encryption */}
      <div className={styles.topControls}>
        {enableAiRewrite && visibleText.trim().length > 0 && !aiRewriteActive && !waitingForAI && (
          <button
            onClick={handleAiRewrite}
            title="AI rewrite"
            aria-label="AI rewrite"
            className={styles.aiRewriteButton}
            type="button"
          >
            <FontAwesomeIcon icon={faHandSparkles} />
          </button>
        )}

        {enableAiRewrite && aiRewriteActive && !waitingForAI && (
          <button
            onClick={handleRevertText}
            title="Revert to original"
            aria-label="Revert to original"
            className={styles.backArrowButton}
            type="button"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
        )}

        {/* Hide encryption UI when either prop requests it */}
        {!(disableEncryption || hideEncryption) &&
          (smallEncryptToggle ? (
            <button
              type="button"
              onClick={handleEncryptCheckbox}
              title={encryptBoxChecked ? 'Response is encrypted' : 'Encrypt response'}
              aria-label={encryptBoxChecked ? 'Response is encrypted' : 'Encrypt response'}
              aria-pressed={encryptBoxChecked}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--ce-text-muted)',
                opacity: 0.7,
                cursor: 'pointer',
              }}
            >
              <FontAwesomeIcon
                icon={encryptBoxChecked ? faLock : faUnlock}
                className={`${styles.smallEncryptIcon} ${lockGlow ? styles.iconGlow : ''}`}
              />
            </button>
          ) : (
            <div
              className={styles.encryptOptionButton}
              role="button"
              tabIndex={0}
              aria-pressed={encryptBoxChecked}
              aria-label={encryptBoxChecked ? 'Response is encrypted' : 'Encrypt response'}
              onClick={handleEncryptCheckbox}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleEncryptCheckbox();
                }
              }}
            >
              <FontAwesomeIcon
                className={`${styles.encryptIcon} ${lockGlow ? styles.iconGlow : ''}`}
                icon={encryptBoxChecked ? faLock : faUnlock}
              />
              <InputGroupText className={styles.inputGroupText}>
                <input
                  {...({ addon: 'true' } as React.InputHTMLAttributes<HTMLInputElement> & { addon: string })}
                  type="checkbox"
                  aria-label="encrypt"
                  checked={encryptBoxChecked}
                  onChange={handleEncryptCheckbox}
                  onClick={(e) => e.stopPropagation()} // avoid wrapper double-toggle
                  className={styles.encryptCheckbox}
                />
                Encrypt
              </InputGroupText>
            </div>
          ))}
      </div>

      {/* Inline, non-blocking error surfacing from hook */}
      {errorMessage && (
        <div className={styles.errorMessage} role="alert" style={{ marginBottom: 8 }}>
          {errorMessage}
        </div>
      )}
      {!errorMessage && recorderNotice && (
        <div className={styles.errorMessage} role="status" style={{ marginBottom: 8 }}>
          {recorderNotice}
        </div>
      )}

      {/* Text input + microphone (waveform/spinner overlays live inside the textarea) */}
      <div className={styles.inputRow}>
        <div
          className={`${styles.textareaWrap} ${showDownloadDock ? styles.hasDownloadDock : ''}`}
          ref={textareaWrapRef}
        >
          <Input
            type="textarea"
            placeholder={getPlaceholder()}
            value={visibleText}
            className={`${styles.audioTextarea} ${isActiveRecording || isProcessingUI || isPaused ? styles.textHidden : ''}`}
            style={placeholderStyle}
            onChange={handleInputChange}
            readOnly={disabled || isRecording || isProcessingUI || isPaused || waitingForAI}
            data-testid={dataTestId || undefined}
            data-ce-question-id={dataCeQuestionId || undefined}
          />
          {(isRecording || isPaused) && (
            <canvas ref={canvasRef} className={styles.waveformOverlay} aria-hidden="true" />
          )}

          {/* Inline overlay for timer and mini controls */}
          {showInlineOverlay && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--ce-tooltip-bg)',
                border: 'var(--ce-border-control-width) solid var(--ce-tooltip-border)',
                color: 'var(--ce-tooltip-text)',
                padding: '4px 8px',
                borderRadius: 'var(--ce-radius-12)',
                fontSize: '0.85rem',
                zIndex: 2,
                pointerEvents: 'auto',
              }}
              role="group"
              aria-label="Recording controls"
            >
              {wantsTimer && (
                <span
                  aria-live="polite"
                  aria-atomic="true"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <FontAwesomeIcon
                    icon={faCircle}
                    style={{ color: isPaused ? 'var(--ce-control-disabled-text)' : 'var(--ce-status-error)' }}
                  />
                  {isPaused ? `Paused — ${recordingSeconds}s` : `Recording… ${recordingSeconds}s`}
                </span>
              )}

              {wantsInlineControls && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {isPaused ? (
                    <button
                      type="button"
                      onClick={resumeRecording}
                      aria-label="Resume recording"
                      title="Resume recording"
                      style={{
                        background: 'var(--ce-control-face)',
                        border: 'var(--ce-border-control-width) solid var(--ce-border-raised)',
                        color: 'var(--ce-control-text)',
                        padding: '2px 6px',
                        borderRadius: 'var(--ce-radius-8)',
                        lineHeight: 1.2,
                        cursor: 'pointer',
                      }}
                    >
                      <FontAwesomeIcon icon={faPlay} /> <span className="sr-only">Resume</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={pauseRecording}
                      aria-label="Pause recording"
                      title="Pause recording"
                      style={{
                        background: 'var(--ce-control-face)',
                        border: 'var(--ce-border-control-width) solid var(--ce-border-raised)',
                        color: 'var(--ce-control-text)',
                        padding: '2px 6px',
                        borderRadius: 'var(--ce-radius-8)',
                        lineHeight: 1.2,
                        cursor: 'pointer',
                      }}
                    >
                      <FontAwesomeIcon icon={faPause} /> <span className="sr-only">Pause</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={stopRecording}
                    aria-label="Stop recording"
                    title="Stop recording"
                    style={{
                      background: 'var(--ce-control-face)',
                      border: 'var(--ce-border-control-width) solid var(--ce-border-raised)',
                      color: 'var(--ce-control-text)',
                      padding: '2px 6px',
                      borderRadius: 'var(--ce-radius-8)',
                      lineHeight: 1.2,
                      cursor: 'pointer',
                    }}
                  >
                    <FontAwesomeIcon icon={faStop} /> <span className="sr-only">Stop</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Compact downloads cluster */}
          {showDownloadDock && (
            <div
              className={styles.downloadDock}
              role="group"
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                zIndex: 3,
                pointerEvents: 'none',
              }}
              aria-label="Download options"
            >
              <button
                type="button"
                onClick={() => setDownloadsOpen((o) => !o)}
                aria-expanded={downloadsOpen}
                aria-label="Toggle downloads"
                title="Downloads"
                className={styles.downloadToggle}
                style={{
                  background: 'var(--ce-tooltip-bg)',
                  border: 'var(--ce-border-control-width) solid var(--ce-tooltip-border)',
                  color: 'var(--ce-tooltip-text)',
                  padding: '4px 6px',
                  borderRadius: 'var(--ce-radius-10)',
                  lineHeight: 1,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              >
                <FontAwesomeIcon icon={faDownload} />
              </button>

              {downloadsOpen && (
                <div className={styles.downloadMenu} style={{ display: 'inline-flex', gap: 6, pointerEvents: 'auto' }}>
                  {isTranscriptionRecordingMode && (
                    <button
                      type="button"
                      onClick={downloadAudio}
                      disabled={!hasRecordingBlob}
                      aria-disabled={!hasRecordingBlob}
                      aria-label="Download last recording audio"
                      title={hasRecordingBlob ? 'Download last recording audio' : 'No recording available yet'}
                      className={styles.downloadChoice}
                      style={{
                        background: 'var(--ce-tooltip-bg)',
                        border: 'var(--ce-border-control-width) solid var(--ce-tooltip-border)',
                        color: hasRecordingBlob ? 'var(--ce-tooltip-text)' : 'var(--ce-control-disabled-text)',
                        padding: '2px 6px',
                        borderRadius: 'var(--ce-radius-8)',
                        lineHeight: 1.2,
                        cursor: hasRecordingBlob ? 'pointer' : 'not-allowed',
                        opacity: hasRecordingBlob ? 1 : 0.6,
                      }}
                    >
                      .{getDownloadExt()}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={downloadTranscript}
                    aria-label="Download final transcript"
                    title="Download final transcript"
                    className={styles.downloadChoice}
                    style={{
                      background: 'var(--ce-tooltip-bg)',
                      border: 'var(--ce-border-control-width) solid var(--ce-tooltip-border)',
                      color: 'var(--ce-tooltip-text)',
                      padding: '2px 6px',
                      borderRadius: 'var(--ce-radius-8)',
                      lineHeight: 1.2,
                      cursor: 'pointer',
                    }}
                  >
                    .txt
                  </button>
                </div>
              )}
            </div>
          )}

          {isProcessingUI && (
            <div className={styles.spinnerOverlay} aria-live="polite" role="status">
              <FontAwesomeIcon icon={faSpinner} spin size="2x" style={{ color: 'var(--ce-panel-text)' }} />
              <span className={styles.srOnly}>Processing audio…</span>
            </div>
          )}
        </div>

        {/* Mic button: Record / Stop */}
        <button
          onClick={handleRecordClick}
          className={`${styles.microphoneButton} ${
            isActiveRecording ? `${styles.recording} ${styles.pinnedLeft}` : ''
          }`}
          type="button"
          title={
            !isRecorderDisabled
              ? isActiveRecording
                ? 'Stop recording'
                : 'Start recording'
              : 'Recording temporarily disabled'
          }
          aria-label={
            !isRecorderDisabled
              ? isActiveRecording
                ? 'Stop recording'
                : 'Start recording'
              : 'Recording temporarily disabled'
          }
          aria-pressed={isActiveRecording}
          disabled={disabled}
        >
          {isActiveRecording ? <FontAwesomeIcon icon={faCircle} /> : <FontAwesomeIcon icon={faMicrophone} />}
        </button>
      </div>
    </div>
  );
};

export default AudioInput;
