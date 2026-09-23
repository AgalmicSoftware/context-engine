import React from 'react';
import { Alert } from 'reactstrap';
import { resolveWorkerResponseHydrationRun } from '../../utilities/survey/workerResponseHydrationRuntime';

export default function WorkerResponseHydrationNotice({ sessionConfig, sessionSlug, partialRuns }: {
  sessionConfig: unknown;
  sessionSlug: string;
  partialRuns?: Record<string, boolean>;
}) {
  if (!partialRuns || !Object.values(partialRuns).some(Boolean)) return null;
  let run;
  try {
    run = resolveWorkerResponseHydrationRun({ sessionConfig, sessionSlug });
  } catch {
    return null;
  }
  if (!run || !partialRuns?.[run.key]) return null;
  return <Alert color="warning" role="alert">
    Only part of this session’s responses could be loaded. Results and exports may omit answers or recent edits.
    The session has exceeded the current loading limit.
  </Alert>;
}
