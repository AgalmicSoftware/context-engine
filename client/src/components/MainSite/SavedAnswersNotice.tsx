import React, { useEffect, useState } from 'react';
import { isWorkerCanonicalSessionConfig } from '../../utilities/survey/workerResponseHydration';

export const SAVED_ANSWERS_SLOW_MS = 20_000;

/**
 * On a Worker session the form finds a person's saved answers only inside the session's full answer
 * list, so until that list has loaded their answered questions look blank. Says so, instead of
 * letting a returning person think their answers are gone.
 */
export default function SavedAnswersNotice({
  sessionConfig,
  signedIn,
  answersLoaded,
}: {
  sessionConfig: unknown;
  signedIn: boolean;
  answersLoaded: boolean;
}) {
  const loading = signedIn && !answersLoaded;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!loading) return undefined;
    const timer = setTimeout(() => setSlow(true), SAVED_ANSWERS_SLOW_MS);
    return () => clearTimeout(timer);
  }, [loading]);
  if (!isWorkerCanonicalSessionConfig(sessionConfig)) return null;
  if (!signedIn) {
    return (
      <div className="alert alert-info" role="status">
        Answered before? Log in to see your saved answers.
      </div>
    );
  }
  if (!loading) return null;
  return (
    <div className="alert alert-info" role="status">
      {slow
        ? 'Your saved answers are still loading. They are kept by the session: if they do not appear, reload the page.'
        : 'Loading your saved answers...'}
    </div>
  );
}
