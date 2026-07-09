import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio } from '../ai/aiClient.js';
import {
  DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS,
  RollingTranscriptSegment,
  clearListeningDraft,
  readListeningDraft,
  stitchRollingTranscriptSegments,
  writeListeningDraft,
} from './rollingTranscription';

type UseRollingTranscriptionRecorderOptions = {
  sessionSlug?: string;
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  chunkMs?: number;
  retainRawAudio?: boolean;
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
  retainRawAudio = false,
}: UseRollingTranscriptionRecorderOptions = {}) => {
  const [status, setStatus] = useState<RollingRecorderStatus>('idle');
  const [segments, setSegments] = useState<RollingTranscriptSegment[]>([]);
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);
  const segmentsRef = useRef<RollingTranscriptSegment[]>([]);
  const segmentIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingActiveRef = useRef(false);
  const endingRecordersRef = useRef<Set<MediaRecorder>>(new Set());
  const stopWaitersRef = useRef<Set<() => void>>(new Set());
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const rawChunksRef = useRef<Map<string, Blob>>(new Map());

  const chunkDurationMs =
    Number.isFinite(Number(chunkMs)) && Number(chunkMs) > 0
      ? Math.max(15_000, Math.floor(Number(chunkMs)))
      : DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS;

  const updateSegments = useCallback(
    (updater: (previous: RollingTranscriptSegment[]) => RollingTranscriptSegment[]) => {
      const next = updater(segmentsRef.current);
      segmentsRef.current = next;
      const stitched = stitchRollingTranscriptSegments(next);
      setSegments(next);
      setTranscript(stitched);
      writeListeningDraft(sessionSlug, { transcript: stitched, segments: next });
    },
    [sessionSlug],
  );

  useEffect(() => {
    mountedRef.current = true;
    const draft = readListeningDraft(sessionSlug);
    if (draft) {
      const restoredTranscript = draft.transcript || stitchRollingTranscriptSegments(draft.segments);
      segmentsRef.current = draft.segments;
      setSegments(draft.segments);
      setTranscript(restoredTranscript);
      writeListeningDraft(sessionSlug, { transcript: restoredTranscript, segments: draft.segments });
      const maxIndex = draft.segments.reduce((max, segment) => Math.max(max, Number(segment.index || 0)), -1);
      segmentIndexRef.current = maxIndex + 1;
    }
    return () => {
      mountedRef.current = false;
    };
  }, [sessionSlug]);

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

  const processSegment = useCallback(
    (blob: Blob) => {
      if (!blob || blob.size < 100) return;
      const index = segmentIndexRef.current;
      segmentIndexRef.current += 1;
      const id = `segment-${Date.now()}-${index}`;
      const startedAt = Date.now();
      const segment: RollingTranscriptSegment = {
        id,
        index,
        status: 'queued',
        text: '',
        startedAt,
      };

      if (retainRawAudio) {
        rawChunksRef.current.set(id, blob);
      }

      updateSegments((previous) => [...previous, segment]);

      queueRef.current = queueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (!mountedRef.current) return;
          updateSegments((previous) =>
            previous.map((entry) => (entry.id === id ? { ...entry, status: 'transcribing' } : entry)),
          );

          try {
            const text = await transcribeAudio(blob, {
              sessionSlug,
              sessionConfig,
              context,
              workerUrl,
            });
            if (!mountedRef.current) return;
            const cleanedText = String(text || '').trim();
            if (cleanedText) {
              setErrorMessage('');
            }
            updateSegments((previous) =>
              previous.map((entry) =>
                entry.id === id
                  ? {
                      ...entry,
                      status: 'complete',
                      text: cleanedText,
                      completedAt: Date.now(),
                    }
                  : entry,
              ),
            );
            if (!retainRawAudio) {
              rawChunksRef.current.delete(id);
            }
          } catch (error) {
            if (!mountedRef.current) return;
            const message = describeError(error);
            setErrorMessage(message);
            updateSegments((previous) =>
              previous.map((entry) =>
                entry.id === id ? { ...entry, status: 'error', error: message, completedAt: Date.now() } : entry,
              ),
            );
          }
        });
    },
    [context, retainRawAudio, sessionConfig, sessionSlug, updateSegments, workerUrl],
  );

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

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          processSegment(event.data);
        }
      };
      recorder.onerror = (event: Event) => {
        const error = (event as ErrorEvent)?.error || event;
        recordingActiveRef.current = false;
        clearRotationTimer();
        stopTimer();
        stopTracks();
        setErrorMessage(describeError(error));
        setStatus('error');
      };
      recorder.onstop = () => {
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

      return recorder;
    },
    [clearRotationTimer, processSegment, resolveStopWaiters, stopTimer, stopTracks],
  );

  const rotateRecorder = useCallback(() => {
    if (!recordingActiveRef.current || !streamRef.current) return;
    const previousRecorder = mediaRecorderRef.current;
    if (!previousRecorder || previousRecorder.state === 'inactive') return;

    try {
      const nextRecorder = createRecorder(streamRef.current);
      nextRecorder.start();
      mediaRecorderRef.current = nextRecorder;
      stopRecorder(previousRecorder, false);
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

    setStatus('requesting');
    setErrorMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const recorder = createRecorder(stream);
      mediaRecorderRef.current = recorder;

      recordingActiveRef.current = true;
      recorder.start();
      setElapsedSeconds(0);
      startElapsedTimer();
      startRotationTimer();
      setStatus('recording');
    } catch (error) {
      recordingActiveRef.current = false;
      clearRotationTimer();
      stopTimer();
      stopTracks();
      setErrorMessage(describeError(error));
      setStatus('error');
    }
  }, [clearRotationTimer, createRecorder, startElapsedTimer, startRotationTimer, status, stopTimer, stopTracks]);

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
          await queueRef.current.catch(() => undefined);
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
      }
      if (waitForTranscription) {
        await queueRef.current.catch(() => undefined);
      }
    },
    [clearRotationTimer, stopRecorder, stopTimer, stopTracks],
  );

  const stopRecording = useCallback(() => finalizeRecording({ waitForTranscription: false }), [finalizeRecording]);

  const clearDraft = useCallback(() => {
    if (status === 'recording' || status === 'paused' || status === 'requesting' || status === 'stopping') return;
    rawChunksRef.current.clear();
    segmentIndexRef.current = 0;
    setSegments([]);
    segmentsRef.current = [];
    setTranscript('');
    setElapsedSeconds(0);
    setErrorMessage('');
    clearListeningDraft(sessionSlug);
  }, [sessionSlug, status]);

  useEffect(
    () => () => {
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
    [clearRotationTimer, stopRecorder, stopTimer, stopTracks],
  );

  const pendingSegmentCount = segments.filter(
    (segment) => segment.status === 'queued' || segment.status === 'transcribing',
  ).length;

  return {
    status,
    isRecording: status === 'recording',
    isPaused: status === 'paused',
    isStopping: status === 'stopping',
    isBusy: status === 'requesting' || status === 'stopping',
    elapsedSeconds,
    transcript,
    segments,
    pendingSegmentCount,
    errorMessage,
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
