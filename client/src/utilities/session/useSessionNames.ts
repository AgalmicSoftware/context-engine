/** @file useSessionNames.ts: a session view's names, reloaded after a save or a sign-in. */
import { useEffect, useRef, useState } from 'react';
import { subscribeWorkerSessionToken } from '../worker/workerAuth';
import { getUsableSessionWorkerUrl } from './sessionWorkerAvailability';
import {
  resolveSessionNamesSource,
  subscribeSessionNames,
  type SessionNames,
  type SessionNamesOptions,
  type SessionNamesSource,
} from './sessionNames';

export type SessionNamesState = { source: SessionNamesSource | null; names: SessionNames };

const NONE: SessionNamesState = { source: null, names: {} };

const sameNames = (a: SessionNames, b: SessionNames): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

/** Loads the session's names once per session and reader; a session with no place for names gives none. */
export const useSessionNames = (options: SessionNamesOptions): SessionNamesState => {
  const [state, setState] = useState<SessionNamesState>(NONE);
  const latest = useRef(options);
  latest.current = options;
  const { sessionSlug, account } = options;
  // A session's config can arrive after the view: reload once it names a Worker.
  const workerUrl = getUsableSessionWorkerUrl({
    slug: sessionSlug,
    sessionConfig: options.sessionConfig,
    requireExactWorkerSession: true,
  });
  useEffect(() => {
    let current = true;
    setState(NONE);
    const load = async () => {
      const source = workerUrl ? await resolveSessionNamesSource(latest.current) : null;
      const names = source ? await source.readAll() : {};
      // Keep the same state when nothing changed, so the views using it don't render again.
      if (current) setState((was) => (was.source === source && sameNames(was.names, names) ? was : { source, names }));
    };
    void load();
    const stopNames = subscribeSessionNames(() => void load());
    const stopToken = subscribeWorkerSessionToken(() => void load());
    return () => {
      current = false;
      stopNames();
      stopToken();
    };
  }, [sessionSlug, account, workerUrl]);
  return state;
};
