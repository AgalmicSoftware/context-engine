import { useCallback, useEffect, useRef, useState } from 'react';
import { requestPreferredSpeechMicrophone } from './microphoneSelection';
import { useRecordingWakeLock } from './useRecordingWakeLock';
import { useRecordingLeaveGuard } from './useRecordingLeaveGuard';
import { useRecordingChunkQueue } from './useRecordingChunkQueue';
import { DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS, type CaptureGap } from './rollingTranscription';

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
// How long a stopped recorder gets to hand over its last audio and confirm the stop.
const STOP_WAIT_MS = 2000;
// How often to check that audio still arrives. A browser may deliver it only at each chunk's end, so the
// microphone is restarted only after a chunk length and 30 seconds without any.
const STALL_CHECK_MS = 5000;
const STALL_GRACE_MS = 30_000;
const CAPTURE_RESTARTED_NOTICE = 'No audio arrived for a while, so the microphone was restarted.';

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
  const [errorMessage, setErrorMessage] = useState('');
  const chunks = useRecordingChunkQueue({
    sessionSlug,
    sessionConfig,
    context,
    workerUrl,
    labelSpeakers,
    capturing: status !== 'idle' && status !== 'error',
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { pageHidden: savePageHidden } = chunks;
  const onPageHidden = useCallback(
    (at: number) => {
      savePageHidden(at);
      // Hand over the part second not yet delivered, so it is saved too.
      try {
        mediaRecorderRef.current?.requestData();
      } catch (_) {
        // An inactive recorder has nothing more to give.
      }
    },
    [savePageHidden],
  );
  const { wakeLockHeld, pageHidden } = useRecordingWakeLock(
    status === 'recording' || status === 'paused',
    onPageHidden,
    chunks.pageShown,
  );
  const { segments, transcript, labelsUnavailableReason, beginChunk, prepare, finishTranscription, retryChunk } =
    chunks;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // The device took the microphone (a call, Siri) without hiding the page; recording goes on when it returns.
  const [microphonePaused, setMicrophonePaused] = useState(false);
  const mutedAtRef = useRef<number | null>(null);
  const lastAudioAtRef = useRef(0);
  const restartingRef = useRef(false);
  const [captureRestarts, setCaptureRestarts] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingActiveRef = useRef(false);
  const endingRecordersRef = useRef<Set<MediaRecorder>>(new Set());
  const stopWaitersRef = useRef<Set<() => void>>(new Set());
  // Ends a recorder's chunk with the audio it has delivered, for when it never confirms Stop.
  const finishersRef = useRef(new WeakMap<MediaRecorder, () => void>());

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
      // The stop event finishes the recorder's chunk. If it never comes, finish the chunk with the audio
      // already delivered, or it stays Recording and holds up every later upload.
      setTimeout(() => finishersRef.current.get(recorder)?.(), STOP_WAIT_MS);
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
    (stream: MediaStream, gapBefore?: CaptureGap): MediaRecorder => {
      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      let capture: ReturnType<typeof beginChunk> | undefined;
      let finished = false;
      const fragments: Blob[] = [];
      const snapshot = (finishing = false) => {
        // Once the chunk is finished, with or without the stop event, later audio from this recorder is
        // ignored: it would turn the finished chunk back into Recording.
        if (finished) return;
        finished = finishing;
        const audio = new Blob(fragments, {
          type: recorder.mimeType || mimeType || fragments[0]?.type || 'audio/webm',
        });
        if (!capture && audio.size) capture = beginChunk(gapBefore);
        capture?.(audio, finishing);
      };
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          lastAudioAtRef.current = Date.now();
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
        // A recorder that stops by itself while capturing (no Stop, rotation or error event) has ended the
        // recording; without this the dialog would keep showing Recording while nothing is captured.
        const stoppedItself = !shouldEndSession && mediaRecorderRef.current === recorder && recordingActiveRef.current;
        if (stoppedItself) {
          setErrorMessage('Recording stopped. Press Record to continue. Saved audio remains available.');
          setStatus('error');
        } else if (!shouldEndSession) {
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
      capture ??= beginChunk(gapBefore);
      finishersRef.current.set(recorder, () => snapshot(true));
      return recorder;
    },
    [beginChunk, clearRotationTimer, resolveStopWaiters, stopRecorder, stopTimer, stopTracks],
  );

  const rotateRecorder = useCallback(
    (gapBefore?: CaptureGap) => {
      if (!recordingActiveRef.current || !streamRef.current) return;
      const previousRecorder = mediaRecorderRef.current;
      if (!previousRecorder || previousRecorder.state === 'inactive') return;

      try {
        const nextRecorder = createRecorder(streamRef.current, gapBefore);
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
    },
    [createRecorder, stopRecorder],
  );

  const startRotationTimer = useCallback(() => {
    clearRotationTimer();
    rotationTimerRef.current = setInterval(() => {
      rotateRecorder();
    }, chunkDurationMs);
  }, [chunkDurationMs, clearRotationTimer, rotateRecorder]);

  const watchMicrophone = useCallback(
    (stream: MediaStream) => {
      stream.getTracks().forEach((track) => {
        track.addEventListener?.(
          'ended',
          () => {
            if (streamRef.current !== stream || !recordingActiveRef.current) return;
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
        track.addEventListener?.('mute', () => {
          if (streamRef.current !== stream || !recordingActiveRef.current) return;
          mutedAtRef.current ??= Date.now();
          setMicrophonePaused(true);
        });
        track.addEventListener?.('unmute', () => {
          const startedAt = mutedAtRef.current;
          if (streamRef.current !== stream || startedAt == null) return;
          mutedAtRef.current = null;
          setMicrophonePaused(false);
          // Nothing was captured meanwhile: speech carries on in a new chunk, and the transcript notes the gap.
          if (mediaRecorderRef.current?.state !== 'recording') return;
          rotateRecorder({ startedAt, endedAt: Date.now(), cause: 'muted' });
          startRotationTimer();
        });
      });
    },
    [clearRotationTimer, rotateRecorder, startRotationTimer, stopRecorder, stopTimer],
  );

  // Audio stopped arriving with no event, as when a phone's capture dies after an interruption. A new recorder
  // on the same stream would hear nothing either, so take a fresh microphone stream.
  const restartCapture = useCallback(async () => {
    // One restart at a time: asking for the microphone can take longer than another stall.
    if (restartingRef.current) return;
    restartingRef.current = true;
    const generation = requestGenerationRef.current;
    const stalledSince = lastAudioAtRef.current;
    lastAudioAtRef.current = Date.now();
    const stalled = mediaRecorderRef.current;
    // The silent recorder's stop must not end the recording. Audio it still holds comes with its stop event,
    // which finishes its chunk; without that event the chunk ends with what it delivered.
    mediaRecorderRef.current = null;
    clearRotationTimer();
    const finishStalled = () => stalled && finishersRef.current.get(stalled)?.();
    try {
      if (stalled?.state === 'inactive') finishStalled();
      else if (stalled) {
        stalled.stop();
        setTimeout(finishStalled, STOP_WAIT_MS);
      }
    } catch (_) {
      finishStalled();
    }
    stopTracks();
    setCaptureRestarts((restarts) => restarts + 1);
    // Stop, a new Record press or closing the recorder while the microphone is asked for ends this restart.
    const superseded = () =>
      !mountedRef.current || !recordingActiveRef.current || generation !== requestGenerationRef.current;
    try {
      const stream = await requestPreferredSpeechMicrophone(navigator.mediaDevices, {
        echoCancellation: !recordSpeakerAudio,
      });
      if (superseded()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      watchMicrophone(stream);
      mediaRecorderRef.current = createRecorder(stream, {
        startedAt: stalledSince,
        endedAt: Date.now(),
        cause: 'stalled',
      });
      lastAudioAtRef.current = Date.now();
      startRotationTimer();
    } catch (error) {
      if (superseded()) return;
      recordingActiveRef.current = false;
      stopTimer();
      stopTracks();
      setErrorMessage(
        `Recording stopped: no audio arrived and the microphone couldn't restart. Press Record to continue. Saved audio remains available. ${describeError(error)}`,
      );
      setStatus('error');
    } finally {
      restartingRef.current = false;
    }
  }, [
    clearRotationTimer,
    createRecorder,
    recordSpeakerAudio,
    startRotationTimer,
    stopTimer,
    stopTracks,
    watchMicrophone,
  ]);

  useEffect(() => {
    if (status !== 'recording') return undefined;
    lastAudioAtRef.current = Date.now();
    const timer = setInterval(() => {
      // No audio is expected while the page is hidden or the device holds the microphone.
      if (document.visibilityState === 'hidden' || mutedAtRef.current != null) lastAudioAtRef.current = Date.now();
      else if (Date.now() - lastAudioAtRef.current > chunkDurationMs + STALL_GRACE_MS) void restartCapture();
    }, STALL_CHECK_MS);
    return () => clearInterval(timer);
  }, [chunkDurationMs, restartCapture, status]);

  const startRecording = useCallback(async () => {
    if (status === 'recording' || status === 'paused' || status === 'requesting') return;
    // Another account's recording, or another tab, holds this one; its notice says what to do.
    if (chunks.ownerNotice || chunks.openElsewhereNotice) return;
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
      watchMicrophone(stream);
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
    startElapsedTimer,
    startRotationTimer,
    status,
    stopTimer,
    stopTracks,
    watchMicrophone,
    chunks.ownerNotice,
    chunks.openElsewhereNotice,
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
        // A recorder that went quiet without a stop event still holds its chunk open.
        if (recorder) finishersRef.current.get(recorder)?.();
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
        }, STOP_WAIT_MS);
        const stopStarted = stopRecorder(recorder, true);
        if (!stopStarted) {
          stopWaitersRef.current.delete(waiter);
          settle(false);
        }
      });

      if (!stopped) {
        // The browser never confirmed Stop. Finish the chunk with the audio delivered so far, so it uploads,
        // and leave Stopping; a stop event that turns up later finds the chunk finished.
        endingRecordersRef.current.delete(recorder);
        finishersRef.current.get(recorder)?.();
        if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
        stopTimer();
        stopTracks();
        if (mountedRef.current) setStatus((previous) => (previous === 'error' ? 'error' : 'idle'));
      }
      if (waitForTranscription) {
        await finishTranscription();
      }
    },
    [clearRotationTimer, finishTranscription, retryChunk, stopRecorder, stopTimer, stopTracks],
  );

  const stopRecording = useCallback(() => finalizeRecording({ waitForTranscription: false }), [finalizeRecording]);

  const clearDraft = useCallback(
    (discardAudio = false) => {
      if (status !== 'idle' && status !== 'error') return;
      void chunks.clearDraft(discardAudio);
      setElapsedSeconds(0);
      setErrorMessage('');
    },
    [chunks.clearDraft, status],
  );

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

  useEffect(() => {
    if (status !== 'idle' && status !== 'error') return;
    mutedAtRef.current = null;
    setMicrophonePaused(false);
    setCaptureRestarts(0);
  }, [status]);

  const pendingSegmentCount = segments.filter(
    (segment) => segment.status === 'queued' || segment.status === 'transcribing' || segment.status === 'retrying',
  ).length;
  const backBlocked = useRecordingLeaveGuard(
    status === 'recording' || status === 'paused' || status === 'stopping',
    pendingSegmentCount > 0 || chunks.unsavedAudio,
  );

  return {
    wakeLockHeld,
    pageHidden,
    hiddenPeriods: chunks.hiddenPeriods,
    dismissHiddenPeriods: chunks.dismissHiddenPeriods,
    downloadableChunkIds: chunks.downloadableChunkIds,
    ownerNotice: chunks.ownerNotice,
    openElsewhere: Boolean(chunks.openElsewhereNotice),
    status,
    isRecording: status === 'recording',
    isPaused: status === 'paused',
    isStopping: status === 'stopping',
    isBusy: status === 'requesting' || status === 'stopping',
    elapsedSeconds,
    microphonePaused,
    // Counts microphone restarts in this recording, so a waveform can follow the new stream.
    captureRestarts,
    captureNotice: captureRestarts ? CAPTURE_RESTARTED_NOTICE : '',
    transcript,
    segments,
    pendingSegmentCount,
    backBlocked,
    // A capture stop leads; the storage and offline notices only say where the audio is kept.
    errorMessage: [
      errorMessage,
      chunks.ownerNotice,
      chunks.openElsewhereNotice,
      chunks.storageError,
      chunks.offline ? 'Offline. Audio stays on this device; reconnect to resume uploads in order.' : '',
    ]
      .filter(Boolean)
      .join(' '),
    labelsUnavailableReason,
    retryChunk,
    downloadChunk: chunks.downloadChunk,
    downloadRecording: chunks.downloadRecording,
    addAudio: chunks.addAudio,
    addTranscript: chunks.addTranscript,
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
