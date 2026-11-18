import React, { useEffect, useState } from 'react';
import { isWorkerCanonicalSessionConfig } from '../../utilities/survey/workerResponseHydration';
import { resolveWorkerResponseHydrationRun } from '../../utilities/survey/workerResponseHydrationRuntime';
import type { WorkerResponseLoadProgress } from '../../utilities/survey/workerResponseHydration';
import { WORKER_CANONICAL_CACHE_SCOPE_KEY } from '../../utilities/survey/workerCanonicalCacheIdentity';
import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import { readSurveyToolScopedCacheNode } from '../SurveyTool/surveyToolWorkerCacheIsolation';

export const SAVED_ANSWERS_SLOW_MS = 20_000;
// A saved sign-in comes back a moment after the page loads; until then the person only looks signed out.
export const SIGNED_OUT_NOTICE_DELAY_MS = 3_000;

/** The session pages that hold the answer form: the session itself and its questions view, not docs or settings. */
export const isSavedAnswersRoute = (path: string): boolean => {
  const [root, , section = '', sub = ''] = String(path || '')
    .toLowerCase()
    .split('/')
    .filter(Boolean);
  return root === 'session' && (section === '' || (section === 'questions' && ['', 'results'].includes(sub)));
};

/** How much of the session's answer list has been read, as Results counts it; null before the first rows land. */
export const readSavedAnswersProgress = (
  sessionConfig: unknown,
  sessionSlug: string,
): WorkerResponseLoadProgress | null => {
  const node = readSurveyToolScopedCacheNode({
    cache: peekCacheSync('questionsCache', sessionSlug, { clone: false }),
    cacheScope: WORKER_CANONICAL_CACHE_SCOPE_KEY,
    sessionConfig,
    sessionSlug,
  });
  const progress = node?.workerResponseLoadProgress as WorkerResponseLoadProgress | undefined;
  return progress && Number.isFinite(progress.loaded) && Number.isFinite(progress.listed) ? progress : null;
};

/**
 * " (1,200 of 2,000+ session answers read)": a person's answers are found only by reading everyone's,
 * so this counts that read. The "+" while the list is still being read.
 */
export const savedAnswersProgressText = (progress: WorkerResponseLoadProgress | null): string =>
  progress
    ? ` (${progress.loaded.toLocaleString()} of ${progress.listed.toLocaleString()}${
        progress.listComplete ? '' : '+'
      } session answers read)`
    : '';

/** True once `active` has held for `ms`; false again as soon as it stops. */
const useHeldFor = (active: boolean, ms: number): boolean => {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => setHeld(true), ms);
    return () => {
      clearTimeout(timer);
      setHeld(false);
    };
  }, [active, ms]);
  return active && held;
};

/**
 * On a Worker session the form finds a person's saved answers only inside the session's full answer
 * list, so until that list has loaded their answered questions look blank. Says so, instead of
 * letting a returning person think their answers are gone. A failed load has its own message.
 */
export default function SavedAnswersNotice({
  sessionConfig,
  sessionSlug,
  signedIn,
  answersReady,
  answersFailed,
  partialRuns,
}: {
  sessionConfig: unknown;
  sessionSlug: string;
  signedIn: boolean;
  answersReady: boolean;
  answersFailed: boolean;
  partialRuns?: Record<string, boolean>;
}) {
  // A private session's shell loads no answers; the page reads the session again once the person is let in.
  const workerSession =
    isWorkerCanonicalSessionConfig(sessionConfig) && !(sessionConfig as { privateSession?: unknown })?.privateSession;
  let partial = false;
  if (workerSession && partialRuns) {
    try {
      const run = resolveWorkerResponseHydrationRun({ sessionConfig, sessionSlug });
      partial = !!run && !!partialRuns[run.key];
    } catch {
      partial = false;
    }
  }
  // A partial load has its own notice and never becomes ready.
  const loading = workerSession && signedIn && !answersReady && !partial && !answersFailed;
  const slow = useHeldFor(loading, SAVED_ANSWERS_SLOW_MS);
  const signedOut = useHeldFor(workerSession && !signedIn, SIGNED_OUT_NOTICE_DELAY_MS);
  if (signedOut) {
    return (
      <div className="alert alert-info" role="status">
        Answered before? Log in to see your saved answers.
      </div>
    );
  }
  if (!loading) return null;
  // Read on each render: the page renders again as each batch of answers lands.
  const count = savedAnswersProgressText(readSavedAnswersProgress(sessionConfig, sessionSlug));
  return (
    <div className="alert alert-info" role="status">
      {slow
        ? `Your saved answers are still loading${count}. They are kept by the session: if they do not appear, reload the page.`
        : `Loading your saved answers...${count}`}
    </div>
  );
}
