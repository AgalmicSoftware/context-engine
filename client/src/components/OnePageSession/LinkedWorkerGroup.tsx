import React, { useEffect, useState } from 'react';
import { fetchWorkerCanonicalSessionBootstrap } from '../../utilities/session/sessionWorkerDiscovery';
import WorkerSessionGroupsPanel, { type WorkerSessionGroupsPanelProps } from './WorkerSessionGroupsPanel';

export type LinkedWorkerGroupReference = {
  sessionSlug: string;
  sessionId: string;
  workerUrl: string;
  groupId: string;
};

type Props = Pick<
  WorkerSessionGroupsPanelProps,
  'account' | 'provider' | 'networkChainId' | 'toggleLoginModal' | 'refreshNonce'
> & {
  reference: LinkedWorkerGroupReference;
};

export default function LinkedWorkerGroup({ reference, ...props }: Props) {
  const { sessionSlug, sessionId, workerUrl, groupId } = reference;
  const target = `${sessionSlug}:${sessionId}:${workerUrl}:${groupId}`;
  const [state, setState] = useState<{ target: string; config?: Record<string, unknown>; error?: string }>();
  useEffect(() => {
    const abort = new AbortController();
    // Bootstrap the owning Worker and pin its identity before passing any auth
    // context. Memberships are read/joined there, never copied into this session.
    void fetchWorkerCanonicalSessionBootstrap({ sessionSlug, workerQueryValue: workerUrl, signal: abort.signal })
      .then((result) => {
        if (result.sessionId.toLowerCase() !== sessionId.toLowerCase())
          throw new Error('Linked group session identity mismatch.');
        if (!abort.signal.aborted) setState({ target, config: result.config });
      })
      .catch(() => {
        if (!abort.signal.aborted) setState({ target, error: 'Unable to verify the linked group’s session.' });
      });
    return () => abort.abort();
  }, [sessionSlug, sessionId, workerUrl, target, props.refreshNonce]);
  if (state?.target !== target) return <p role="status">Loading community group…</p>;
  if (!state.config) return <p role="alert">{state.error}</p>;
  return (
    <WorkerSessionGroupsPanel
      {...props}
      sessionConfig={state.config}
      sessionSlug={sessionSlug}
      selectedGroupId={groupId}
      showCreate={false}
      showGroupDescriptions={false}
      showMembershipListHeader={false}
    />
  );
}
