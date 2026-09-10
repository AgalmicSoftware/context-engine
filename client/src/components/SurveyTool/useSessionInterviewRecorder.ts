import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startSessionRealtimeInterview,
  type RealtimeInterviewSession,
} from '../../utilities/audio/realtimeInterviewClient';

type RecorderState = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping';

type Options = {
  sessionSlug: string;
  resolveWorkerUrl: () => Promise<string>;
  onStatus: (value: string) => void;
  onError: (value: string) => void;
  onTranscript: (value: string) => void;
};

export function useSessionInterviewRecorder({
  sessionSlug,
  resolveWorkerUrl,
  onStatus,
  onError,
  onTranscript,
}: Options) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<RealtimeInterviewSession | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const stateRef = useRef<RecorderState>('idle');
  const [recordingState, setRecordingState] = useState<RecorderState>('idle');
  const [recordingElapsedSeconds, setElapsed] = useState(0);
  const update = useCallback((value: RecorderState) => {
    stateRef.current = value;
    if (mountedRef.current) setRecordingState(value);
  }, []);
  const dispose = useCallback(() => {
    const session = sessionRef.current;
    const controller = controllerRef.current;
    controllerRef.current = null;
    sessionRef.current = null;
    mediaStreamRef.current = null;
    void session?.stop().catch(() => {});
    controller?.abort();
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      dispose();
    };
  }, [dispose]);
  useEffect(() => {
    if (recordingState !== 'recording') return;
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [recordingState]);

  const start = async (instructions: string) => {
    if (stateRef.current !== 'idle' || !audioRef.current) return false;
    const audioElement = audioRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const current = () => controllerRef.current === controller && !controller.signal.aborted;
    update('starting');
    setElapsed(0);
    onError('');
    onStatus('Connecting');
    onTranscript('');
    try {
      const workerUrl = await resolveWorkerUrl();
      if (!current()) return false;
      const session = await startSessionRealtimeInterview({
        workerUrl,
        sessionSlug,
        instructions,
        audioElement,
        signal: controller.signal,
        onStatus: (value) => {
          if (current()) onStatus(value);
        },
        onError: (error) => {
          if (current()) {
            onError(error.message);
            onStatus('Error');
          }
        },
        onTranscript: (value) => {
          if (current()) onTranscript(value);
        },
        onRecordingState: (value) => {
          if (!current()) return;
          if (value === 'stopped') {
            sessionRef.current = null;
            mediaStreamRef.current = null;
            if (stateRef.current !== 'stopping') update('idle');
          } else update(value);
        },
      });
      if (!current()) {
        await session.stop();
        return false;
      }
      sessionRef.current = session;
      mediaStreamRef.current = session.mediaStream;
      return true;
    } catch (error) {
      if (!current()) return false;
      update('idle');
      const message = error instanceof Error ? error.message : 'Could not start the interview. Try again.';
      onError(
        /worker.*(url|configured)/i.test(message)
          ? `${message} Ask the session owner to configure the Worker URL.`
          : message,
      );
      onStatus('Error');
      return false;
    }
  };

  const stop = async () => {
    if (stateRef.current === 'stopping' || !sessionRef.current) return null;
    const session = sessionRef.current;
    const controller = controllerRef.current;
    update('stopping');
    onStatus('Ending');
    // Invalidate every callback before teardown; stop captures the transcript already received.
    controllerRef.current = null;
    const result = session.stop();
    controller?.abort();
    sessionRef.current = null;
    mediaStreamRef.current = null;
    try {
      return await result;
    } finally {
      update('idle');
    }
  };
  const pause = () => sessionRef.current?.pause();
  const resume = () => sessionRef.current?.resume();
  return { audioRef, mediaStreamRef, recordingState, recordingElapsedSeconds, start, stop, pause, resume };
}
