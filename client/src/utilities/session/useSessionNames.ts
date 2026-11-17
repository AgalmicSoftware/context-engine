/** @file useSessionNames.ts: a session view's names, reloaded after a save or a sign-in. */
import { useEffect, useRef, useState } from 'react';
import { subscribeWorkerSessionToken } from '../worker/workerAuth';
import { getUsableSessionWorkerUrl } from './sessionWorkerAvailability';
import { resolveSessionCapabilityProjection } from './sessionCapabilityProjection';
import {
  resolveSessionNamesSource,
  subscribeSessionNames,
  type SessionNames,
  type SessionNamesOptions,
  type SessionNamesSource,
} from './sessionNames';

export type SessionNamesState = {
  source: SessionNamesSource | null;
  names: SessionNames;
  /**
   * Whether answers may show the names they carried: only where the session has no place for names (on-chain,
   * or a Worker from before names). False while that's unknown or couldn't be learned.
   */
  answerNamesShown: boolean;
};

const NO_STORE: SessionNamesState = { source: null, names: {}, answerNamesShown: true };
const UNKNOWN: SessionNamesState = { source: null, names: {}, answerNamesShown: false };

/**
 * Only a loaded config whose authority isn't a Worker (on-chain, or the older registry) says the session has no
 * place for names. A config still loading, or one for another slug, says nothing yet.
 */
const hasNoNameStore = (sessionConfig: unknown): boolean => {
  if (!sessionConfig) return false;
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  return projection.source === 'legacy_registry' || (projection.profileValid && !projection.isWorkerCanonical);
};

const sameNames = (a: SessionNames, b: SessionNames): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

/** Loads the session's names once per session and reader; a session with no place for names gives none. */
export const useSessionNames = (options: SessionNamesOptions): SessionNamesState => {
  const [state, setState] = useState<SessionNamesState>(UNKNOWN);
  const latest = useRef(options);
  // Reads can finish out of order (one started before a sign-in came back): only the latest one counts.
  const loadSeq = useRef(0);
  latest.current = options;
  const { sessionSlug, account } = options;
  const namesOff =
    !!options.sessionConfig && (options.sessionConfig as { namesEnabled?: unknown }).namesEnabled === false;
  // A session's config can arrive after the view: reload once it names a Worker.
  const workerUrl = getUsableSessionWorkerUrl({
    slug: sessionSlug,
    sessionConfig: options.sessionConfig,
    requireExactWorkerSession: true,
  });
  const noStore = !workerUrl && hasNoNameStore(options.sessionConfig);
  useEffect(() => {
    let current = true;
    setState(noStore ? NO_STORE : UNKNOWN);
    const load = async () => {
      if (!workerUrl) return;
      const seq = ++loadSeq.current;
      let next: SessionNamesState;
      try {
        const source = await resolveSessionNamesSource(latest.current);
        next = { source, names: source ? await source.readAll() : {}, answerNamesShown: !source };
      } catch {
        next = UNKNOWN;
      }
      // Keep the same state when nothing changed, so the views using it don't render again.
      if (current && seq === loadSeq.current) {
        setState((was) =>
          was.source === next.source &&
          was.answerNamesShown === next.answerNamesShown &&
          sameNames(was.names, next.names)
            ? was
            : next,
        );
      }
    };
    void load();
    const stopNames = subscribeSessionNames(() => void load());
    const stopToken = subscribeWorkerSessionToken(() => void load());
    return () => {
      current = false;
      stopNames();
      stopToken();
    };
  }, [sessionSlug, account, workerUrl, namesOff, noStore]);
  return state;
};
