import { useEffect, useRef, useState } from 'react';
import type { InterviewSavedSlice } from './sessionInterviewSavedAnswers';

export type InterviewSavedAnswerLoader = (questionIds: string[], signal: AbortSignal) => Promise<InterviewSavedSlice>;

export const useInterviewSavedAnswers = ({
  load,
  contextKey,
  questionIds,
  active,
  onLoaded,
}: {
  load?: InterviewSavedAnswerLoader;
  contextKey: string;
  questionIds: string[];
  active: boolean;
  onLoaded: (slice: InterviewSavedSlice) => void;
}) => {
  const loadRef = useRef(load);
  loadRef.current = load;
  const loadedRef = useRef(onLoaded);
  loadedRef.current = onLoaded;
  const idsKey = JSON.stringify([...new Set(questionIds.map((id) => id.toLowerCase()))].sort());
  const key = JSON.stringify([contextKey, idsKey, active]);
  const enabled = !!load;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; slice?: InterviewSavedSlice; error?: string }>({ key: '' });
  useEffect(() => {
    if (!enabled || !active) return;
    const controller = new AbortController();
    setState({ key });
    void loadRef.current!(JSON.parse(idsKey), controller.signal)
      .then((slice) => {
        if (controller.signal.aborted) return;
        // Resolve selection conflicts before readiness can trigger a queued submit.
        loadedRef.current(slice);
        setState({ key, slice });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({ key, error: error instanceof Error ? error.message : 'Could not load your saved answers.' });
      });
    return () => controller.abort();
  }, [enabled, active, key, idsKey, attempt]);
  const current = state.key === key && active ? state : null;
  return {
    ready: !!current?.slice,
    slice: current?.slice,
    error: current?.error || '',
    retry: () => setAttempt((value) => value + 1),
  };
};
