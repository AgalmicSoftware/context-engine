import { lazy, Suspense, useLayoutEffect } from 'react';
import {
  readAutoJoinLink,
  readPendingAutoJoin,
  removeGroupInviteFromAddress,
  savePendingAutoJoin,
} from '../../domains/worker/workerGroupAutoJoinIntent';
import type { WorkerGroupAutoJoinProps } from './WorkerGroupAutoJoin';

const WorkerGroupAutoJoin = lazy(() => import('./WorkerGroupAutoJoin'));

export default function WorkerGroupAutoJoinHost(props: WorkerGroupAutoJoinProps) {
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  useLayoutEffect(() => {
    const incoming = readAutoJoinLink(path, null);
    const pending = readPendingAutoJoin();
    // Save fresh-browser links before the optional UI chunk arrives. Navigating
    // away during that download must not discard an invitation.
    if (
      incoming &&
      (incoming.token ||
        !pending ||
        pending.groupId !== incoming.groupId ||
        pending.sessionSlug !== incoming.sessionSlug ||
        pending.workerOrigin !== incoming.workerOrigin)
    )
      savePendingAutoJoin(incoming);
    // The invite stays in this tab only: never in the address, its history or a copied link.
    removeGroupInviteFromAddress();
  }, [path]);

  return (
    <Suspense fallback={null}>
      <WorkerGroupAutoJoin {...props} />
    </Suspense>
  );
}
