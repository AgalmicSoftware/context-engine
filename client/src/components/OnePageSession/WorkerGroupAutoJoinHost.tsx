import React, { lazy, Suspense, useLayoutEffect } from 'react';
import {
  readAutoJoinLink,
  readPendingAutoJoin,
  savePendingAutoJoin,
} from '../../domains/worker/workerGroupAutoJoinIntent';
import type { WorkerGroupAutoJoinProps } from './WorkerGroupAutoJoin';

const WorkerGroupAutoJoin = lazy(() => import('./WorkerGroupAutoJoin'));

export default function WorkerGroupAutoJoinHost(props: WorkerGroupAutoJoinProps) {
  const path = `${window.location.pathname}${window.location.search}`;
  useLayoutEffect(() => {
    const incoming = readAutoJoinLink(path, null);
    const pending = readPendingAutoJoin();
    // Save fresh-browser links before the optional UI chunk arrives. Navigating
    // away during that download must not discard an invitation.
    if (
      incoming &&
      (!pending ||
        pending.groupId !== incoming.groupId ||
        pending.sessionSlug !== incoming.sessionSlug ||
        pending.workerOrigin !== incoming.workerOrigin)
    )
      savePendingAutoJoin(incoming);
  }, [path]);

  return (
    <Suspense fallback={null}>
      <WorkerGroupAutoJoin {...props} />
    </Suspense>
  );
}
