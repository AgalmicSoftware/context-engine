import { useCallback, useEffect, useRef, useState } from 'react';
import { requestPreferredSpeechMicrophone } from './microphoneSelection';
import { useRecordingWakeLock } from './useRecordingWakeLock';
import { useRecordingChunkQueue } from './useRecordingChunkQueue';
import { DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS } from './rollingTranscription';

type UseRollingTranscriptionRecorderOptions = {
  sessionSlug?: string;
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  chunkMs?: number;
  recordSpeakerAudio?: boolean;
  labelSpeakers?: boolean;
};

type FinalizeRecordingOptions = {
  waitForTranscription?: boolean;
};

type RollingRecorderStatus = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopping' | 'error';

const pickSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || 'Unknown recording error');

export const useRollingTranscriptionRecorder = ({
  sessionSlug = '',
  sessionConfig = null,
  context,
  workerUrl,
  chunkMs = DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS,
  recordSpeakerAudio = false,
  labelSpeakers = false,
}: UseRollingTranscriptionRecorderOptions = {}) => {
  const [status, setStatus] = useState<RollingRecorderStatus>('idle');
  const { wakeLockHeld, pageHidden, hiddenPeriods, dismissHiddenPeriods } = useRecordingWakeLock(
    status === 'recording' || status === 'paused',
  );
  const [errorMessage, setErrorMessage] = useState('');
  const chunks = useRecordingChunkQueue({ sessionSlug, sessionConfig, context, workerUrl, labelSpeakers });
  const { segments, transcript, labelsUnavailableReason, beginChunk, prepare, finishTranscription, retryChunk } =
    chunks;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingActiveRef = useRef(false);
  const endingRecordersRef = useRef<Set<MediaRecorder>>(new Set());
  const stopWaitersRef = useRef<Set<() => void>>(new Set());

  const chunkDurationMs =
    Number.isFinite(Number(chunkMs)) && Number(chunkMs) > 0
      ? Math.max(15_000, Math.floor(Number(chunkMs)))
      : DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearRotationTimer = useCallback(() => {
    if (rotationTimerRef.current) {
      clearInterval(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }
  }, []);

  const startElapsedTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
  }, [stopTimer]);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {
          /* noop */
        }
      });
      streamRef.current = null;
    }
  }, []);

  const stopRecorder = useCallback((recorder: MediaRecorder | null, endSession: boolean): boolean => {
    if (!recorder || recorder.state === 'inactive') return false;
    if (endSession) {
      endingRecordersRef.current.add(recorder);
    }
    try {
      recorder.stop();
      return true;
    } catch (error) {
      if (endSession) {
        endingRecordersRef.current.delete(recorder);
      }
      setErrorMessage(describeError(error));
      setStatus('error');
      return false;
    }
  }, []);

  const resolveStopWaiters = useCallback(() => {
    const waiters = Array.from(stopWaitersRef.current);
    stopWaitersRef.current.clear();
    waiters.forEach((resolve) => resolve());
  }, []);

  const createRecorder = useCallback(
    (stream: MediaStream): MediaRecorder => {
      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      let capture: ReturnType<typeof beginChunk> | undefined;
      const fragments: Blob[] = [];
      const snapshot = (finished = false) => {
        const audio = new Blob(fragments, {
          type: recorder.mimeType || mimeType || fragments[0]?.type || 'audio/webm',
        });
        if (!capture && audio.size) capture = beginChunk();
        capture?.(audio, finished);
      };
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          // Timeslice fragments share a container header; persist the cumulative chunk.
          fragments.push(event.data);
          snapshot();
        }
      };
      recorder.onerror = (event: Event) => {
        const error = (event as ErrorEvent)?.error || event;
        recordingActiveRef.current = false;
        clearRotationTimer();
        stopTimer();
        stopTracks();
        setErrorMessage(
          `Recording stopped. Check microphone permission, then press Record again. ${describeError(error)}`,
        );
        setStatus('error');
        if (recorder.state !== 'inactive') stopRecorder(recorder, true);
        else snapshot(true);
      };
      recorder.onstop = () => {
        snapshot(true);
        const shouldEndSession = endingRecordersRef.current.delete(recorder);
        if (!shouldEndSession) {
          if (mediaRecorderRef.current === recorder && !recordingActiveRef.current) {
            mediaRecorderRef.current = null;
          }
          return;
        }

        recordingActiveRef.current = false;
        clearRotationTimer();
        stopTimer();
        stopTracks();
        if (mediaRecorderRef.current === recorder) {
          mediaRecorderRef.current = null;
        }
        resolveStopWaiters();
        if (mountedRef.current) {
          setStatus((previous) => (previous === 'error' ? 'error' : 'idle'));
        }
      };

      // A constructor/start failure must not publish an empty chunk to the queue.
      recorder.start(1000);
      capture ??= beginChunk();
      return recorder;
    },
    [beginChunk, clearRotationTimer, resolveStopWaiters, stopRecorder, stopTimer, stopTracks],
  );

  const rotateRecorder = useCallback(() => {
    if (!recordingActiveRef.current || !streamRef.current) return;
    const previousRecorder = mediaRecorderRef.current;
    if (!previousRecorder || previousRecorder.state === 'inactive') return;

    try {
      const nextRecorder = createRecorder(streamRef.current);
      mediaRecorderRef.current = nextRecorder;
      stopRecorder(previousRecorder, false);
      // Rotation is the only error raised while capture continues; a successful one clears it.
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(describeError(error));
      try {
        previousRecorder.requestData();
      } catch (_) {
        // Keep the active recorder running; the next timer tick will retry rotation.
      }
    }
  }, [createRecorder, stopRecorder]);

  const startRotationTimer = useCallback(() => {
    clearRotationTimer();
    rotationTimerRef.current = setInterval(() => {
      rotateRecorder();
    }, chunkDurationMs);
  }, [chunkDurationMs, clearRotationTimer, rotateRecorder]);

  const startRecording = useCallback(async () => {
    if (status === 'recording' || status === 'paused' || status === 'requesting') return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Microphone recording is not available in this browser.');
      setStatus('error');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setErrorMessage('MediaRecorder is not available in this browser.');
      setStatus('error');
      return;
    }

    const requestGeneration = ++requestGenerationRef.current;
    setStatus('requesting');
    setErrorMessage('');

    try {
      await prepare();
      if (!mountedRef.current || requestGeneration !== requestGenerationRef.current) return;
      const stream = await requestPreferredSpeechMicrophone(navigator.mediaDevices, {
        echoCancellation: !recordSpeakerAudio,
      });
      if (!mountedRef.current || requestGeneration !== requestGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      stream.getTracks().forEach((track) => {
        track.addEventListener?.(
          'ended',
          () => {
            if (!recordingActiveRef.current) return;
            setErrorMessage(
              'Microphone access ended. Restore microphone permission, then press Record to continue. Saved audio remains available.',
            );
            setStatus('error');
            recordingActiveRef.current = false;
            clearRotationTimer();
            stopTimer();
            stopRecorder(mediaRecorderRef.current, true);
          },
          { once: true },
        );
      });
      recordingActiveRef.current = true;
      const recorder = createRecorder(stream);
      mediaRecorderRef.current = recorder;
      setElapsedSeconds(0);
      startElapsedTimer();
      startRotationTimer();
      setStatus('recording');
    } catch (error) {
      if (!mountedRef.current || requestGeneration !== requestGenerationRef.current) return;
      recordingActiveRef.current = false;
      clearRotationTimer();
      stopTimer();
      stopTracks();
      setErrorMessage(
        `Could not start recording. Check microphone permission and recording support, then try again. ${describeError(error)}`,
      );
      setStatus('error');
    }
  }, [
    clearRotationTimer,
    createRecorder,
    recordSpeakerAudio,
    prepare,
    stopRecorder,
    startElapsedTimer,
    startRotationTimer,
    status,
    stopTimer,
    stopTracks,
  ]);

  const pauseRecording = useCallback(() => {
    if (status !== 'recording') return;
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    try {
      recorder.pause();
      clearRotationTimer();
      stopTimer();
      setStatus('paused');
    } catch (error) {
      setErrorMessage(describeError(error));
      setStatus('error');
    }
  }, [clearRotationTimer, status, stopTimer]);

  const resumeRecording = useCallback(() => {
    if (status !== 'paused') return;
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    try {
      recorder.resume();
      startElapsedTimer();
      startRotationTimer();
      setStatus('recording');
    } catch (error) {
      setErrorMessage(describeError(error));
      setStatus('error');
    }
  }, [startElapsedTimer, startRotationTimer, status]);

  const finalizeRecording = useCallback(
    async ({ waitForTranscription = true }: FinalizeRecordingOptions = {}) => {
      if (waitForTranscription) retryChunk();
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        recordingActiveRef.current = false;
        clearRotationTimer();
        stopTimer();
        stopTracks();
        if (mountedRef.current) {
          setStatus('idle');
        }
        if (waitForTranscription) {
          await finishTranscription();
        }
        return;
      }
      setStatus('stopping');
      recordingActiveRef.current = false;
      clearRotationTimer();

      const stopped = await new Promise<boolean>((resolve) => {
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const settle = (value: boolean) => {
          if (settled) return;
          settled = true;
          if (timeout) clearTimeout(timeout);
          resolve(value);
        };
        const waiter = () => settle(true);
        stopWaitersRef.current.add(waiter);
        timeout = setTimeout(() => {
          stopWaitersRef.current.delete(waiter);
          settle(false);
        }, 2000);
        const stopStarted = stopRecorder(recorder, true);
        if (!stopStarted) {
          stopWaitersRef.current.delete(waiter);
          settle(false);
        }
      });

      if (!stopped) {
        stopTimer();
        stopTracks();
        if (waitForTranscription)
          throw new Error('The recorder has not finished saving audio. Keep this dialog open and try closing again.');
      }
      if (waitForTranscription) {
        await finishTranscription();
      }
    },
    [clearRotationTimer, finishTranscription, retryChunk, stopRecorder, stopTimer, stopTracks],
  );

  const stopRecording = useCallback(() => finalizeRecording({ waitForTranscription: false }), [finalizeRecording]);

  const clearDraft = useCallback(() => {
    if (status !== 'idle' && status !== 'error') return;
    void chunks.clearDraft();
    setElapsedSeconds(0);
    setErrorMessage('');
  }, [chunks.clearDraft, status]);

  useEffect(
    () => () => {
      ++requestGenerationRef.current;
      recordingActiveRef.current = false;
      clearRotationTimer();
      stopTimer();
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          stopRecorder(mediaRecorderRef.current, true);
        }
      } catch (_) {
        // cleanup best effort
      }
      stopTracks();
    },
    [chunks.scope, clearRotationTimer, stopRecorder, stopTimer, stopTracks],
  );

  useEffect(() => {
    setStatus('idle');
    setErrorMessage('');
  }, [chunks.scope]);

  const pendingSegmentCount = segments.filter(
    (segment) => segment.status === 'queued' || segment.status === 'transcribing' || segment.status === 'retrying',
  ).length;

  return {
    wakeLockHeld,
    pageHidden,
    hiddenPeriods,
    dismissHiddenPeriods,
    downloadableChunkIds: chunks.downloadableChunkIds,
    status,
    isRecording: status === 'recording',
    isPaused: status === 'paused',
    isStopping: status === 'stopping',
    isBusy: status === 'requesting' || status === 'stopping',
    elapsedSeconds,
    transcript,
    segments,
    pendingSegmentCount,
    // A capture stop leads; the storage and offline notices only say where the audio is kept.
    errorMessage: [
      errorMessage,
      chunks.storageError,
      chunks.offline ? 'Offline. Audio stays on this device; reconnect to resume uploads in order.' : '',
    ]
      .filter(Boolean)
      .join(' '),
    labelsUnavailableReason,
    retryChunk,
    downloadChunk: chunks.downloadChunk,
    keepAudio: chunks.keepAudio,
    mediaStreamRef: streamRef,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    finalizeRecording,
    clearDraft,
  };
};

export default useRollingTranscriptionRecorder;
