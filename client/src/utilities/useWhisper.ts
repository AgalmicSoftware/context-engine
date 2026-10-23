/**
 * @file useWhisper.js
 * @module useWhisper
 * @description React hook for audio recording and Whisper transcription — manages microphone access,
 *              voice activity detection, and streaming speech-to-text via the worker.
 *
 * Key exports: useWhisper, RECORDING_STATUS
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getEffectiveTranscriptionConfig } from './ai/aiSettings.js';
import { getCorsProxyUrlOrThrow } from './worker/corsProxy.js';
import { fetchWorkerWithAuth } from './worker/workerAuth.js';
import { defaultStrictAllowDemoFallback } from './worker/workerSessionResolution.js';
import { normalizeBaseUrl } from './urlUtils.js';
import { createLogger } from './logging.js';
import { requestPreferredSpeechMicrophone } from './audio/microphoneSelection.js';
import { mergeTranscript } from './audio/mergeTranscript.js';

type WhisperLegacyValue = any;
type WhisperCallback = (...args: WhisperLegacyValue[]) => void;
type UseWhisperOptions = {
  apiKey?: string;
  model?: string;
  sessionSlug?: WhisperLegacyValue;
  sessionConfig?: WhisperLegacyValue;
  context?: WhisperLegacyValue;
  workerUrl?: string;
  silenceDetection?: boolean;
  timeSlice?: number;
  onTranscriptionUpdate?: WhisperCallback;
  onTranscriptionComplete?: WhisperCallback;
  onError?: WhisperCallback;
  onRecordingStop?: WhisperCallback;
  silenceThresholdDb?: number;
  silenceDurationMs?: number;
};

const whisperLog = createLogger('whisper');

// Heavy audio deps are dynamically imported so they don't inflate initial bundle size.
// Each is cached so it only loads once per session.
const pickDefaultExport = (mod: WhisperLegacyValue): WhisperLegacyValue => (mod && (mod.default || mod)) || mod;

let _recordRtc: WhisperLegacyValue = null;
let _recordRtcPromise: Promise<WhisperLegacyValue> | null = null;
const loadRecordRTC = async () => {
  if (_recordRtc) return _recordRtc;
  if (!_recordRtcPromise) {
    _recordRtcPromise = import('recordrtc').then(pickDefaultExport).catch((err) => {
      // If the chunk fails to load once (transient network/cache issue), allow a later retry.
      _recordRtcPromise = null;
      throw err;
    });
  }
  _recordRtc = await _recordRtcPromise;
  return _recordRtc;
};

let _hark: WhisperLegacyValue = null;
let _harkPromise: Promise<WhisperLegacyValue> | null = null;
const loadHark = async () => {
  if (_hark) return _hark;
  if (!_harkPromise) {
    _harkPromise = import('hark').then(pickDefaultExport).catch((err) => {
      _harkPromise = null;
      throw err;
    });
  }
  _hark = await _harkPromise;
  return _hark;
};

// Tunables
const FADE_DURATION_MS = 300;
const SILENCE_THRESHOLD_DB = -45;
const SILENCE_DURATION_MS = 1500;
const MIN_RECORDING_DURATION_MS = 500;
const STREAMING_TIME_SLICE_MS = 1000;

// Recording state machine
export const RECORDING_STATUS = {
  IDLE: 'idle',
  REQUESTING_PERMISSION: 'requesting_permission',
  PERMISSION_DENIED: 'permission_denied',
  READY: 'ready',
  RECORDING: 'recording',
  PAUSED: 'paused',
  PROCESSING: 'processing',
  STREAMING: 'streaming',
  ERROR: 'error',
};

const resolveAudioExtension = (blob: WhisperLegacyValue): string => {
  const type = String(blob?.type || '').toLowerCase();
  if (type.includes('wav')) return 'wav';
  if (type.includes('webm')) return 'webm';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  return 'wav';
};

const readErrorField = (error: unknown, field: 'message' | 'name'): string => {
  if (error instanceof Error) {
    return String(error[field] || '');
  }
  if (error && typeof error === 'object' && field in error) {
    const value = (error as Record<typeof field, unknown>)[field];
    return typeof value === 'string' ? value : '';
  }
  return '';
};

const getErrorName = (error: unknown): string => readErrorField(error, 'name');

const getErrorMessage = (error: unknown, fallback: string): string => readErrorField(error, 'message') || fallback;

export const useWhisper = ({
  // apiKey intentionally unused (worker holds the secret)
  apiKey = '',
  model,
  sessionSlug,
  sessionConfig,
  context,
  workerUrl,
  silenceDetection = true,
  timeSlice = STREAMING_TIME_SLICE_MS,
  onTranscriptionUpdate = () => {},
  onTranscriptionComplete = () => {},
  onError = () => {},
  onRecordingStop = () => {},
  // NEW: optional silence knobs (non-breaking; defaults preserved)
  silenceThresholdDb,
  silenceDurationMs,
}: UseWhisperOptions = {}) => {
  const effectiveSessionSlug = sessionSlug;
  const effectiveSessionConfig = sessionConfig;
  const [status, setStatus] = useState(RECORDING_STATUS.IDLE);
  const [transcript, setTranscript] = useState({ live: '', final: '' });
  // Mirrors the latest transcript so callbacks run outside state updaters, which
  // React may call during render (updating the parent) or more than once.
  const transcriptRef = useRef({ live: '', final: '' });
  const writeTranscript = useCallback((next: { live: string; final: string }) => {
    transcriptRef.current = next;
    setTranscript(next);
  }, []);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastRecordingTimestamp, setLastRecordingTimestamp] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // refs
  const streamRef = useRef<WhisperLegacyValue>(null);
  const recorderRef = useRef<WhisperLegacyValue>(null);
  const audioContextRef = useRef<WhisperLegacyValue>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechMonitorRef = useRef<WhisperLegacyValue>(null);
  const fadeGainNodeRef = useRef<WhisperLegacyValue>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  // NEW: expose last session's raw recording (native recorder format)
  const lastRecordingBlobRef = useRef<{ blob: Blob | null; mimeType: string }>({ blob: null, mimeType: '' });

  // NEW: abort controller for final (non-streaming) transcription
  const finalAbortControllerRef = useRef<AbortController | null>(null);

  // NEW: gating/throttle + config + unmount guard
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // NEW: live refs to avoid stale-closure reads during streaming gates
  const isStreamingRef = useRef(false);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);
  const isProcessingRef = useRef(false);
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  // NEW: keep latest stopRecording for timeouts/handlers to avoid stale closures
  const stopRecordingRef = useRef<WhisperLegacyValue>(null);

  const speechSinceLastSliceRef = useRef(false);
  const lastStreamAtRef = useRef(0);
  const abortedRef = useRef(false);
  const recordingAttemptRef = useRef(0);
  const startingRef = useRef(false);
  const ownsRecordingAttempt = useCallback(
    (attempt: number) => !abortedRef.current && recordingAttemptRef.current === attempt,
    [],
  );
  const effectiveSilenceThresholdDbRef = useRef(
    typeof silenceThresholdDb === 'number' ? silenceThresholdDb : SILENCE_THRESHOLD_DB,
  );
  const effectiveSilenceDurationMsRef = useRef(
    typeof silenceDurationMs === 'number' ? silenceDurationMs : SILENCE_DURATION_MS,
  );
  const MIN_STREAM_INTERVAL_MS = 3500;

  useEffect(() => {
    if (typeof silenceThresholdDb === 'number') {
      effectiveSilenceThresholdDbRef.current = silenceThresholdDb;
    }
  }, [silenceThresholdDb]);

  useEffect(() => {
    if (typeof silenceDurationMs === 'number') {
      effectiveSilenceDurationMsRef.current = silenceDurationMs;
    }
  }, [silenceDurationMs]);

  useEffect(() => {
    abortedRef.current = false;
    return () => {
      abortedRef.current = true;
    };
  }, []);

  const log = useCallback((msg: string, ...args: WhisperLegacyValue[]) => {
    whisperLog.log(`[useWhisper] ${msg}`, ...args);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const cleanupResources = useCallback(
    (fromUnmount = false) => {
      // Permission and module loading cannot be aborted. Invalidate their owner
      // synchronously so late results cannot install resources into a newer start.
      recordingAttemptRef.current += 1;
      startingRef.current = false;
      clearSilenceTimer();

      if (finalAbortControllerRef.current) {
        try {
          finalAbortControllerRef.current.abort();
        } catch (e) {
          whisperLog.warn('useWhisper: cleanup', e);
        }
        finalAbortControllerRef.current = null;
      }

      if (streamAbortControllerRef.current) {
        try {
          streamAbortControllerRef.current.abort();
        } catch (e) {
          whisperLog.warn('useWhisper: cleanup', e);
        }
        streamAbortControllerRef.current = null;
      }

      if (speechMonitorRef.current) {
        try {
          speechMonitorRef.current.stop();
        } catch (e) {
          whisperLog.warn('useWhisper: cleanup', e);
        }
        speechMonitorRef.current = null;
      }
      if (recorderRef.current) {
        try {
          if (recorderRef.current.state !== 'destroyed') {
            recorderRef.current.destroy();
          }
        } catch (e) {
          whisperLog.warn('useWhisper: cleanup', e);
        }
        recorderRef.current = null;
      }
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((t: WhisperLegacyValue) => t.stop());
        } catch (e) {
          whisperLog.warn('useWhisper: cleanup', e);
        }
        streamRef.current = null;
      }
      const closingContext = audioContextRef.current;
      audioContextRef.current = null;
      if (closingContext && closingContext.state !== 'closed') {
        closingContext.close().catch((e: WhisperLegacyValue) => {
          whisperLog.warn('useWhisper: cleanup', e);
        });
      }
      fadeGainNodeRef.current = null;
      chunksRef.current = [];
      // NEW: reset surfaced blob when tearing down
      lastRecordingBlobRef.current = { blob: null, mimeType: '' };

      if (!fromUnmount) {
        setIsRecording(false);
        setIsPaused(false);
        setIsProcessing(false);
        setIsStreaming(false);
        setStatus((prev) =>
          prev === RECORDING_STATUS.PERMISSION_DENIED ? RECORDING_STATUS.PERMISSION_DENIED : RECORDING_STATUS.IDLE,
        );
      }
    },
    [clearSilenceTimer],
  );

  // Source resets discard audio; ordinary Stop still finalizes and transcribes it.
  const cancelRecording = useCallback(() => cleanupResources(), [cleanupResources]);

  const requestMicrophonePermission = async (attempt: number) => {
    if (statusRef.current === RECORDING_STATUS.PERMISSION_DENIED) {
      setErrorMessage('Microphone permission denied. Please allow microphone access in your browser settings.');
      return null;
    }

    if (streamRef.current && streamRef.current.active) {
      const tracks = streamRef.current.getAudioTracks();
      if (tracks.length > 0 && tracks.every((t: WhisperLegacyValue) => t.readyState === 'live')) {
        return streamRef.current;
      }
      try {
        streamRef.current.getTracks().forEach((t: WhisperLegacyValue) => t.stop());
      } catch (e) {
        whisperLog.warn('useWhisper: cleanup', e);
      }
      streamRef.current = null;
    } else if (streamRef.current && !streamRef.current.active) {
      try {
        streamRef.current.getTracks().forEach((t: WhisperLegacyValue) => t.stop());
      } catch (e) {
        whisperLog.warn('useWhisper: cleanup', e);
      }
      streamRef.current = null;
    }

    setStatus(RECORDING_STATUS.REQUESTING_PERMISSION);
    setErrorMessage('');
    try {
      const stream = await requestPreferredSpeechMicrophone(navigator.mediaDevices);
      if (!ownsRecordingAttempt(attempt)) {
        stream.getTracks().forEach((track) => track.stop());
        return null;
      }
      streamRef.current = stream;
      setStatus(RECORDING_STATUS.READY);
      return stream;
    } catch (error) {
      if (!ownsRecordingAttempt(attempt)) return null;
      const errorName = getErrorName(error);
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        setErrorMessage('Microphone permission denied. Please allow microphone access in your browser settings.');
        setStatus(RECORDING_STATUS.PERMISSION_DENIED);
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setErrorMessage('No microphone found. Please connect a mic or select one in your system/browser settings.');
        setStatus(RECORDING_STATUS.ERROR);
      } else {
        setErrorMessage(`Error accessing microphone: ${getErrorMessage(error, 'Unknown microphone error')}`);
        setStatus(RECORDING_STATUS.ERROR);
        onError(error);
      }
      streamRef.current = null;
      return null;
    }
  };

  const setupSilenceDetection = useCallback(
    async (stream: WhisperLegacyValue, attempt: number) => {
      let hark;
      try {
        hark = await loadHark();
      } catch (error) {
        if (ownsRecordingAttempt(attempt) && statusRef.current === RECORDING_STATUS.RECORDING) throw error;
        return;
      }
      if (!ownsRecordingAttempt(attempt) || statusRef.current !== RECORDING_STATUS.RECORDING) return;
      if (speechMonitorRef.current) {
        try {
          speechMonitorRef.current.stop();
        } catch (e) {
          whisperLog.warn('useWhisper: cleanup', e);
        }
      }
      const options = { threshold: effectiveSilenceThresholdDbRef.current, interval: 100 };
      speechMonitorRef.current = hark(stream, options);

      speechMonitorRef.current.on('speaking', () => {
        if (!ownsRecordingAttempt(attempt)) return;
        clearSilenceTimer();
        // NEW: mark that speech occurred since the last slice
        speechSinceLastSliceRef.current = true;
      });

      speechMonitorRef.current.on('stopped_speaking', () => {
        if (!ownsRecordingAttempt(attempt)) return;
        if (statusRef.current === RECORDING_STATUS.RECORDING && !isPausedRef.current) {
          clearSilenceTimer();
          silenceTimerRef.current = setTimeout(() => {
            // Use live refs to avoid stale closures and double-check state at fire time
            if (
              ownsRecordingAttempt(attempt) &&
              statusRef.current === RECORDING_STATUS.RECORDING &&
              !isPausedRef.current
            ) {
              stopRecordingRef.current?.();
            }
          }, effectiveSilenceDurationMsRef.current);
        }
      });
    },
    [clearSilenceTimer, ownsRecordingAttempt],
  );

  const callWhisperViaWorker = useCallback(
    async (audioBlob: Blob, isStreamingCall = false) => {
      const attempt = recordingAttemptRef.current;
      if (!ownsRecordingAttempt(attempt)) return null;
      if (!audioBlob || audioBlob.size < 100) {
        if (isStreamingCall) return null;
        throw new Error('Audio blob too small');
      }

      const formData = new FormData();
      const ext = resolveAudioExtension(audioBlob);
      formData.append('file', audioBlob, `audio_${Date.now()}.${ext}`);

      let transcriptionCfg;
      try {
        // A hook-level model default would override the configured Worker/local
        // model even when the caller made no explicit model selection.
        transcriptionCfg = await getEffectiveTranscriptionConfig({
          sessionSlug: effectiveSessionSlug,
          sessionConfig: effectiveSessionConfig,
          model,
          apiKey,
          context,
        });
      } catch (err) {
        const msg = getErrorMessage(err, 'Failed to resolve transcription settings.');
        if (ownsRecordingAttempt(attempt)) {
          setErrorMessage(msg);
          onError(new Error(msg));
          if (!isStreamingCall) setStatus(RECORDING_STATUS.ERROR);
        }
        return null;
      }

      if (!ownsRecordingAttempt(attempt)) return null;
      if (transcriptionCfg.provider === 'local') {
        const msg = 'Local transcription is not configured in this build.';
        if (ownsRecordingAttempt(attempt)) {
          setErrorMessage(msg);
          onError(new Error(msg));
          if (!isStreamingCall) setStatus(RECORDING_STATUS.ERROR);
        }
        return null;
      }
      if (transcriptionCfg.provider) formData.append('provider', transcriptionCfg.provider);
      if (transcriptionCfg.model) formData.append('model', transcriptionCfg.model);
      const useLocalOverride = transcriptionCfg.apiKeySource === 'local';
      if (useLocalOverride && transcriptionCfg.apiKey) {
        formData.append('apiKey', transcriptionCfg.apiKey);
      }
      if (transcriptionCfg.provider === 'custom' && transcriptionCfg.rpcUrl) {
        formData.append('rpcUrl', transcriptionCfg.rpcUrl);
      }

      let controller: AbortController | null = null;
      if (isStreamingCall) {
        controller = new AbortController();
        // Abort any in-flight streaming before starting a new one
        if (streamAbortControllerRef.current) {
          try {
            streamAbortControllerRef.current.abort();
          } catch (e) {
            whisperLog.warn('useWhisper: cleanup', e);
          }
        }
        streamAbortControllerRef.current = controller;
        if (ownsRecordingAttempt(attempt)) setIsStreaming(true);
      } else {
        if (ownsRecordingAttempt(attempt)) setIsProcessing(true);
        // Track and make abortable the final request
        controller = new AbortController();
        // Abort any existing final call first
        if (finalAbortControllerRef.current) {
          try {
            finalAbortControllerRef.current.abort();
          } catch (e) {
            whisperLog.warn('useWhisper: cleanup', e);
          }
        }
        finalAbortControllerRef.current = controller;
        // Ensure no lingering streaming call
        if (streamAbortControllerRef.current) {
          try {
            streamAbortControllerRef.current.abort();
          } catch (e) {
            whisperLog.warn('useWhisper: cleanup', e);
          }
          streamAbortControllerRef.current = null;
          if (ownsRecordingAttempt(attempt)) setIsStreaming(false);
        }
      }

      try {
        const explicitWorkerUrl = normalizeBaseUrl(workerUrl || '');
        const corsWorkerUrl =
          explicitWorkerUrl ||
          (await getCorsProxyUrlOrThrow({
            sessionSlug: effectiveSessionSlug,
            sessionConfig: effectiveSessionConfig,
            context,
            allowDemoFallback: defaultStrictAllowDemoFallback(),
          }));
        if (!ownsRecordingAttempt(attempt) || controller?.signal.aborted) return null;
        const endpoint = corsWorkerUrl.endsWith('/transcribe')
          ? corsWorkerUrl
          : `${corsWorkerUrl.replace(/\/+$/, '')}/transcribe`;

        const fetchOpts: RequestInit = { method: 'POST', body: formData };
        if (controller) fetchOpts.signal = controller.signal;

        const baseUrl = corsWorkerUrl.replace(/\/+$/, '').replace(/\/transcribe$/i, '');
        // Regression guard: nonce auth and transcription must share the resolved config;
        // re-resolving by slug can bind a different session identity and return 409.
        const res = await fetchWorkerWithAuth(endpoint, fetchOpts, {
          sessionSlug: effectiveSessionSlug,
          sessionConfig: effectiveSessionConfig,
          context,
          workerUrl: baseUrl,
          // Match file uploads: anonymous access is optional, and signed-in
          // holders can authenticate to use the session's AI key.
          preferAnonymous: true,
          fallbackOnGateUnavailable: true,
          allowDemoFallback: defaultStrictAllowDemoFallback(),
        });

        if (!ownsRecordingAttempt(attempt)) return null;
        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!ownsRecordingAttempt(attempt)) return null;
        if (!res.ok) {
          let message =
            (data && (typeof data.error === 'string' ? data.error : data?.error?.message || data?.message)) ||
            (res.status === 403
              ? 'Forbidden (CORS): origin not allowed by server.'
              : res.status === 401
                ? 'Unauthorized: server missing/invalid OpenAI key.'
                : `Transcription failed (${res.status}).`);
          throw new Error(String(message || 'Transcription failed.'));
        }

        return data && typeof data.text === 'string' ? data.text : '';
      } catch (err) {
        if (getErrorName(err) === 'AbortError') return null;
        const msg = getErrorMessage(err, 'Transcription error');
        if (ownsRecordingAttempt(attempt)) {
          setErrorMessage(msg);
          onError(new Error(msg));
          if (!isStreamingCall) setStatus(RECORDING_STATUS.ERROR);
        }
        return null;
      } finally {
        if (isStreamingCall) {
          if (streamAbortControllerRef.current === controller) {
            streamAbortControllerRef.current = null;
          }
          if (ownsRecordingAttempt(attempt)) setIsStreaming(false);
        } else {
          if (ownsRecordingAttempt(attempt)) setIsProcessing(false);
          if (finalAbortControllerRef.current === controller) {
            finalAbortControllerRef.current = null;
          }
        }
      }
    },
    [apiKey, context, effectiveSessionConfig, effectiveSessionSlug, model, onError, workerUrl, ownsRecordingAttempt],
  );

  const handleStreamingTranscription = useCallback(async () => {
    const attempt = recordingAttemptRef.current;
    if (!ownsRecordingAttempt(attempt)) return;
    // Use live refs for guards to avoid stale-closure churn
    if (
      isStreamingRef.current ||
      isProcessingRef.current ||
      isPausedRef.current ||
      statusRef.current !== RECORDING_STATUS.RECORDING
    )
      return;

    // Speech gate: if no speech since last slice, drop the buffered chunks to avoid waste
    if (!speechSinceLastSliceRef.current) {
      if (chunksRef.current.length) chunksRef.current = [];
      return;
    }

    // Throttle uploads to avoid request storms during long sessions
    const now = Date.now();
    if (now - lastStreamAtRef.current < MIN_STREAM_INTERVAL_MS) return;

    if (chunksRef.current.length === 0) return;

    const chunksToProcess = [...chunksRef.current];
    chunksRef.current = [];
    lastStreamAtRef.current = now;

    // Use the most recent slice only. Concatenating WAVs can produce multi-header blobs.
    const wavBlob = chunksToProcess[chunksToProcess.length - 1];
    if (!wavBlob || wavBlob.size < 500) return;

    try {
      if (ownsRecordingAttempt(attempt)) setIsStreaming(true);
      const streamingText = await callWhisperViaWorker(wavBlob, true);
      if (!ownsRecordingAttempt(attempt)) return;
      if (typeof streamingText === 'string' && streamingText.length > 0) {
        const newLive = mergeTranscript(transcriptRef.current.live, streamingText);
        writeTranscript({ ...transcriptRef.current, live: newLive });
        onTranscriptionUpdate(newLive);
      }
    } finally {
      // Reset the speech flag only after we attempted an upload
      if (ownsRecordingAttempt(attempt)) {
        speechSinceLastSliceRef.current = false;
        setIsStreaming(false);
      }
    }
  }, [callWhisperViaWorker, onTranscriptionUpdate, ownsRecordingAttempt, writeTranscript]);

  const startRecording = async () => {
    if (abortedRef.current || startingRef.current || recorderRef.current || isRecording || isProcessing || isStreaming)
      return;
    if (status === RECORDING_STATUS.PAUSED) return;
    startingRef.current = true;
    const attempt = ++recordingAttemptRef.current;

    // Start fetching the recorder library in parallel with the permission prompt.
    const recordRtcPromise = loadRecordRTC();
    // If we return early (permission denied), ensure a rejected chunk load doesn't surface as an unhandled rejection.
    void recordRtcPromise.catch((e) => {
      whisperLog.warn('useWhisper: fallback', e);
    });

    // Abort any in-flight final transcription from a previous session
    if (finalAbortControllerRef.current) {
      try {
        finalAbortControllerRef.current.abort();
      } catch (e) {
        whisperLog.warn('useWhisper: cleanup', e);
      }
      finalAbortControllerRef.current = null;
    }

    setErrorMessage('');
    writeTranscript({ live: '', final: '' });
    chunksRef.current = [];
    // NEW: clear last surfaced blob at session start
    lastRecordingBlobRef.current = { blob: null, mimeType: '' };
    speechSinceLastSliceRef.current = false;
    lastStreamAtRef.current = 0;

    try {
      const stream = await requestMicrophonePermission(attempt);
      if (!stream || !ownsRecordingAttempt(attempt)) return;
      const RecordRTC = await recordRtcPromise;
      if (!ownsRecordingAttempt(attempt)) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        if (!ownsRecordingAttempt(attempt)) return;
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, audioContextRef.current.currentTime + FADE_DURATION_MS / 1000);
      source.connect(gainNode);
      fadeGainNodeRef.current = gainNode;

      const destination = audioContextRef.current.createMediaStreamDestination();
      gainNode.connect(destination);

      recorderRef.current = new RecordRTC(destination.stream, {
        type: 'audio',
        mimeType: 'audio/wav',
        recorderType: RecordRTC.StereoAudioRecorder,
        sampleRate: 44100,
        numberOfAudioChannels: 1,
        timeSlice: timeSlice && timeSlice > 0 ? timeSlice : 0,
        ondataavailable: (blob: Blob) => {
          if (
            ownsRecordingAttempt(attempt) &&
            statusRef.current === RECORDING_STATUS.RECORDING &&
            !isPausedRef.current &&
            blob.size > 0 &&
            timeSlice &&
            timeSlice > 0
          ) {
            chunksRef.current.push(blob);
            handleStreamingTranscription();
          }
        },
      });
      recorderRef.current.startRecording();
      startingRef.current = false;
      statusRef.current = RECORDING_STATUS.RECORDING;
      setIsRecording(true);
      setIsPaused(false);
      setStatus(RECORDING_STATUS.RECORDING);
      setLastRecordingTimestamp(Date.now());

      if (silenceDetection) await setupSilenceDetection(stream, attempt);
    } catch (error) {
      if (!ownsRecordingAttempt(attempt)) return;
      setErrorMessage(`Error starting recording: ${getErrorMessage(error, 'Unknown recording start error')}`);
      setStatus(RECORDING_STATUS.ERROR);
      onError(error);
      cleanupResources();
    } finally {
      if (ownsRecordingAttempt(attempt)) startingRef.current = false;
    }
  };

  const stopRecording = useCallback(async () => {
    if (startingRef.current) {
      cleanupResources();
      return;
    }
    const currentStatus = statusRef.current;
    if (currentStatus !== RECORDING_STATUS.RECORDING && currentStatus !== RECORDING_STATUS.PAUSED) {
      if (!recorderRef.current) return;
    }

    const attempt = recordingAttemptRef.current;
    clearSilenceTimer();

    const duration = Date.now() - lastRecordingTimestamp;
    if (duration < MIN_RECORDING_DURATION_MS && currentStatus !== RECORDING_STATUS.PAUSED) {
      cleanupResources();
      return;
    }

    setIsRecording(false);
    setIsPaused(false);
    statusRef.current = RECORDING_STATUS.PROCESSING;
    setStatus(RECORDING_STATUS.PROCESSING);
    setIsProcessing(true);

    try {
      if (fadeGainNodeRef.current && audioContextRef.current && audioContextRef.current.state === 'running') {
        const t = audioContextRef.current.currentTime;
        fadeGainNodeRef.current.gain.cancelScheduledValues(t);
        fadeGainNodeRef.current.gain.setValueAtTime(fadeGainNodeRef.current.gain.value, t);
        fadeGainNodeRef.current.gain.linearRampToValueAtTime(0, t + FADE_DURATION_MS / 1000);
        await new Promise<void>((resolve) => setTimeout(resolve, FADE_DURATION_MS + 50));
      }

      if (!ownsRecordingAttempt(attempt)) return;
      if (!recorderRef.current) {
        cleanupResources();
        setIsProcessing(false);
        return;
      }

      // Ensure callers awaiting stopRecording() resolve AFTER blob is finalized & refs updated
      const recorder = recorderRef.current;
      await new Promise<void>((resolve) => {
        recorder.stopRecording(async () => {
          if (!ownsRecordingAttempt(attempt) || recorderRef.current !== recorder) {
            resolve();
            return;
          }
          const finalWavBlob = recorder.getBlob();

          if (speechMonitorRef.current) {
            try {
              speechMonitorRef.current.stop();
            } catch (e) {
              whisperLog.warn('useWhisper: cleanup', e);
            }
            speechMonitorRef.current = null;
          }
          if (streamRef.current) {
            try {
              streamRef.current.getTracks().forEach((track: WhisperLegacyValue) => track.stop());
            } catch (e) {
              whisperLog.warn('useWhisper: cleanup', e);
            }
            streamRef.current = null;
          }
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            try {
              await audioContextRef.current.close();
            } catch (e) {
              whisperLog.warn('useWhisper: cleanup', e);
            }
            if (!ownsRecordingAttempt(attempt)) {
              resolve();
              return;
            }
            audioContextRef.current = null;
          }

          // NEW: surface the native recorder blob (no re-encode for callers)
          if (finalWavBlob && finalWavBlob.size > 0) {
            lastRecordingBlobRef.current = { blob: finalWavBlob, mimeType: 'audio/wav' };
          } else {
            lastRecordingBlobRef.current = { blob: null, mimeType: '' };
          }

          // NEW: clear any residual buffered chunks now that the blob is composed
          chunksRef.current = [];
          speechSinceLastSliceRef.current = false;
          lastStreamAtRef.current = 0;

          // NEW: extend onRecordingStop additively with (blob, mimeType)
          try {
            onRecordingStop?.(finalWavBlob || null, finalWavBlob ? 'audio/wav' : '');
          } catch (e) {
            whisperLog.warn('useWhisper: callback', e);
          }

          // Resolve immediately after blob is finalized + refs updated
          resolve();
          if (!ownsRecordingAttempt(attempt)) return;

          // --- continue existing final transcription flow (unchanged for callers) ---
          if (finalWavBlob && finalWavBlob.size > 0) {
            try {
              const finalText = await callWhisperViaWorker(finalWavBlob, false);
              if (!ownsRecordingAttempt(attempt)) return;
              if (typeof finalText === 'string') {
                const { live, final } = transcriptRef.current;
                const merged = mergeTranscript(live || final || '', finalText);
                writeTranscript({ final: merged, live: '' });
                onTranscriptionComplete(merged);
              } else {
                writeTranscript({ final: '', live: '' });
              }
              if (ownsRecordingAttempt(attempt)) setStatus(RECORDING_STATUS.READY);
            } catch (apiErr) {
              if (ownsRecordingAttempt(attempt)) {
                setErrorMessage(`Final transcription error: ${getErrorMessage(apiErr, 'Unknown transcription error')}`);
                setStatus(RECORDING_STATUS.ERROR);
                onError(apiErr);
                writeTranscript({ final: '', live: '' });
              }
            }
          } else {
            writeTranscript({ live: '', final: '' });
            setStatus(RECORDING_STATUS.READY);
          }

          if (ownsRecordingAttempt(attempt) && recorderRef.current === recorder) {
            try {
              recorderRef.current.destroy();
            } catch (e) {
              whisperLog.warn('useWhisper: cleanup', e);
            }
            recorderRef.current = null;
          }
          if (ownsRecordingAttempt(attempt)) setIsProcessing(false);
        });
      });
    } catch (error) {
      if (!ownsRecordingAttempt(attempt)) return;
      setErrorMessage(`Error stopping recording: ${getErrorMessage(error, 'Unknown recording stop error')}`);
      setStatus(RECORDING_STATUS.ERROR);
      onError(error);
      cleanupResources();
      setIsProcessing(false);
    }
  }, [
    callWhisperViaWorker,
    clearSilenceTimer,
    cleanupResources,
    lastRecordingTimestamp,
    onError,
    onRecordingStop,
    onTranscriptionComplete,
    ownsRecordingAttempt,
    writeTranscript,
  ]);

  // Keep latest stopRecording in a ref for any deferred callbacks (e.g., silence timeout)
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const pauseRecording = useCallback(async () => {
    if (!isRecording || isPaused || isProcessing || isStreaming) return;
    clearSilenceTimer();

    if (!recorderRef.current) return;

    const attempt = recordingAttemptRef.current;
    const recorder = recorderRef.current;
    try {
      await recorder.pauseRecording();
      if (
        !ownsRecordingAttempt(attempt) ||
        recorderRef.current !== recorder ||
        statusRef.current !== RECORDING_STATUS.RECORDING
      )
        return;
      setIsPaused(true);
      setIsRecording(false);
      statusRef.current = RECORDING_STATUS.PAUSED;
      setStatus(RECORDING_STATUS.PAUSED);

      if (speechMonitorRef.current) {
        try {
          speechMonitorRef.current.stop();
        } catch (e) {
          whisperLog.warn('useWhisper: cleanup', e);
        }
      }
    } catch (error) {
      if (
        !ownsRecordingAttempt(attempt) ||
        recorderRef.current !== recorder ||
        statusRef.current !== RECORDING_STATUS.RECORDING
      )
        return;
      setErrorMessage(`Error pausing: ${getErrorMessage(error, 'Unknown pause error')}`);
      setStatus(RECORDING_STATUS.ERROR);
      onError(error);
    }
  }, [clearSilenceTimer, isRecording, isPaused, isProcessing, isStreaming, onError, ownsRecordingAttempt]);

  const resumeRecording = useCallback(async () => {
    if (!isPaused || isRecording || isProcessing || isStreaming) return;

    if (!recorderRef.current) return;

    const attempt = recordingAttemptRef.current;
    const recorder = recorderRef.current;
    try {
      await recorder.resumeRecording();
      if (
        !ownsRecordingAttempt(attempt) ||
        recorderRef.current !== recorder ||
        statusRef.current !== RECORDING_STATUS.PAUSED
      )
        return;
      setIsPaused(false);
      setIsRecording(true);
      statusRef.current = RECORDING_STATUS.RECORDING;
      setStatus(RECORDING_STATUS.RECORDING);

      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        if (
          !ownsRecordingAttempt(attempt) ||
          recorderRef.current !== recorder ||
          statusRef.current !== RECORDING_STATUS.RECORDING
        )
          return;
      }
      if (silenceDetection && streamRef.current) {
        await setupSilenceDetection(streamRef.current, attempt);
      }
    } catch (error) {
      if (
        !ownsRecordingAttempt(attempt) ||
        recorderRef.current !== recorder ||
        ![RECORDING_STATUS.PAUSED, RECORDING_STATUS.RECORDING].includes(statusRef.current)
      )
        return;
      setErrorMessage(`Error resuming: ${getErrorMessage(error, 'Unknown resume error')}`);
      setStatus(RECORDING_STATUS.ERROR);
      onError(error);
    }
  }, [
    isPaused,
    isRecording,
    isProcessing,
    isStreaming,
    setupSilenceDetection,
    silenceDetection,
    onError,
    ownsRecordingAttempt,
  ]);

  useEffect(() => () => cleanupResources(true), [cleanupResources]);

  // NEW: public getter for the last surfaced recording blob
  const getLastRecordingBlob = useCallback(() => lastRecordingBlobRef.current, []);

  return {
    status,
    isRecording,
    isPaused,
    isProcessing,
    isStreaming,
    transcript,
    errorMessage,
    startRecording,
    stopRecording,
    cancelRecording,
    pauseRecording,
    resumeRecording,
    audioContextRef,
    mediaStreamRef: streamRef,
    // NEW: additive API for audio downloaders
    lastRecordingBlobRef,
    getLastRecordingBlob,
  };
};
