/** @file useContextGroups.ts: the session's groups a person may lock a context file to. */
import { useEffect, useRef, useState } from 'react';

import { getUsableSessionWorkerUrl } from '../session/sessionWorkerAvailability';
import { resolveWorkerCanonicalSessionIdHex } from '../session/sessionWorkerDiscovery';
import {
  getWorkerSessionToken,
  hasCachedWorkerSessionToken,
  subscribeWorkerSessionToken,
} from '../worker/workerAuth.js';

export type ContextGroup = { groupId: string; label: string };

const NO_GROUPS: ContextGroup[] = [];

// A list that can't be read, as on a private session before sign-in, leaves the session-wide choice.
// Someone already signed in to the session reads it as themselves; listing never asks them to sign.
export function useContextGroups({
  sessionSlug,
  sessionConfig,
  account = '',
  enabled = true,
}: {
  sessionSlug: string;
  sessionConfig: unknown;
  account?: unknown;
  enabled?: boolean;
}): ContextGroup[] {
  const workerUrl = getUsableSessionWorkerUrl({ slug: sessionSlug, sessionConfig });
  const sessionId = resolveWorkerCanonicalSessionIdHex(sessionConfig);
  const reader = String(account || '').toLowerCase();
  // Whose list it is: another session or reader never sees it, while theirs loads or when it can't be read.
  const owner = JSON.stringify([workerUrl, sessionId, reader]);
  const configRef = useRef(sessionConfig);
  configRef.current = sessionConfig;
  const active = enabled && !!workerUrl && !!sessionId;
  const [loaded, setLoaded] = useState({ owner: '', groups: NO_GROUPS });
  const [revision, setRevision] = useState(0);
  // A new Worker token can show groups the last list couldn't.
  useEffect(() => {
    if (!active) return undefined;
    return subscribeWorkerSessionToken(() => setRevision((value) => value + 1));
  }, [active]);
  useEffect(() => {
    if (!active) return undefined;
    let current = true;
    const signedIn = { sessionSlug, sessionConfig: configRef.current, context: { account: reader } };
    void (async () => {
      const ports = await import('../../domains/worker/workerGroupPorts');
      if (!(await hasCachedWorkerSessionToken(signedIn))) {
        return ports.loadPublicWorkerGroups({ workerUrl, sessionId, sessionSlug });
      }
      const credentialToken = await getWorkerSessionToken(signedIn);
      return (await ports.loadWorkerGroupOverview({ workerUrl, credentialToken, sessionId, sessionSlug })).groups;
    })()
      .then((groups) => {
        if (current) setLoaded({ owner, groups: groups.map(({ groupId, label }) => ({ groupId, label })) });
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [active, owner, workerUrl, sessionId, sessionSlug, reader, revision]);
  return enabled && loaded.owner === owner ? loaded.groups : NO_GROUPS;
}
