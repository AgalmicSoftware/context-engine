/** @file useContextGroups.ts: the session's groups a person may lock a context file to. */
import { useEffect, useState } from 'react';

import { getUsableSessionWorkerUrl } from '../session/sessionWorkerAvailability';
import { resolveWorkerCanonicalSessionIdHex } from '../session/sessionWorkerDiscovery';

export type ContextGroup = { groupId: string; label: string };

const NO_GROUPS: ContextGroup[] = [];

// A list that can't be read, as on a private session before sign-in, leaves the session-wide choice.
export function useContextGroups({
  sessionSlug,
  sessionConfig,
  enabled = true,
}: {
  sessionSlug: string;
  sessionConfig: unknown;
  enabled?: boolean;
}): ContextGroup[] {
  const workerUrl = getUsableSessionWorkerUrl({ slug: sessionSlug, sessionConfig });
  const sessionId = resolveWorkerCanonicalSessionIdHex(sessionConfig);
  const [groups, setGroups] = useState(NO_GROUPS);
  useEffect(() => {
    if (!enabled || !workerUrl || !sessionId) return undefined;
    let current = true;
    void import('../../domains/worker/workerGroupPorts')
      .then(({ loadPublicWorkerGroups }) => loadPublicWorkerGroups({ workerUrl, sessionId, sessionSlug }))
      .then((loaded) => {
        if (current) setGroups(loaded.map(({ groupId, label }) => ({ groupId, label })));
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [enabled, workerUrl, sessionId, sessionSlug]);
  return enabled ? groups : NO_GROUPS;
}
