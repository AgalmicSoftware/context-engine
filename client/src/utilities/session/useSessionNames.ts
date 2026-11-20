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

/**
 * Where this reader's names stand, so a view can show a lookup under way and never take a failed or withheld read
 * for proof that nobody set a name:
 * - pending: the first read for this session and reader hasn't come back yet;
 * - named: it came back with names;
 * - empty: a signed-in read came back with none this reader may see; the Worker answers the same for a reader it
 *   doesn't let see names, so this never means that nobody set one;
 * - failed: the read couldn't be made (one retry may follow);
 * - unavailable: names don't apply to this reader: signed out, no session sign-in in this tab, names turned off,
 *   or a session with no place for names (or none known yet).
 */
export type SessionNamesStatus = 'pending' | 'named' | 'empty' | 'failed' | 'unavailable';

export type SessionNamesState = {
  status: SessionNamesStatus;
  source: SessionNamesSource | null;
  names: SessionNames;
  /**
   * Whether answers may show the names they carried: only where the session has no place for names (on-chain,
   * or a Worker from before names). False while that's unknown or couldn't be learned.
   */
  answerNamesShown: boolean;
  /**
   * Set when the person is connected but this tab holds no session sign-in, so names read as none: signs them
   * in, after which the names reload by themselves. Null when names are already read as this person, or as no one.
   */
  signIn: (() => Promise<void>) | null;
};

const NO_STORE: SessionNamesState = {
  status: 'unavailable',
  source: null,
  names: {},
  answerNamesShown: true,
  signIn: null,
};
const UNKNOWN: SessionNamesState = { ...NO_STORE, answerNamesShown: false };
const PENDING: SessionNamesState = { ...UNKNOWN, status: 'pending' };
const FAILED: SessionNamesState = { ...UNKNOWN, status: 'failed' };

/**
 * Only a loaded config whose authority isn't a Worker (on-chain, or the older registry) says the session has no
 * place for names. A config still loading, or one for another slug, says nothing yet.
 */
const hasNoNameStore = (sessionConfig: unknown): boolean => {
  if (!sessionConfig) return false;
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  return projection.source === 'legacy_registry' || (projection.profileValid && !projection.isWorkerCanonical);
};

// A Worker that couldn't say whether it keeps names (its capabilities timed out or failed) leaves them unknown, and
// nothing else asks again until the reader or the session changes. Asked once more a little later, one slow answer
// doesn't hide an older Worker's answer names, or a newer one's names, for the whole visit.
export const NAMES_RETRY_MS = 5000;
// A first read that hangs anywhere (the capabilities check, a quiet sign-in, the read itself) counts as failed by
// then, so a view never shows a lookup under way for good; a read that comes back later still shows its names.
export const NAMES_PENDING_LIMIT_MS = 15_000;

const sameNames = (a: SessionNames, b: SessionNames): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

/** A read that came back: one made as no one (signed out, or no session sign-in in this tab) shows nothing. */
const readStatus = (source: SessionNamesSource | null, names: SessionNames, signedIn: boolean): SessionNamesStatus =>
  !source?.enabled ? 'unavailable' : Object.keys(names).length ? 'named' : signedIn ? 'empty' : 'unavailable';

/** Loads the session's names once per session and reader; a session with no place for names gives none. */
export const useSessionNames = (options: SessionNamesOptions): SessionNamesState => {
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
  // Only a read that can show this reader names is waited on: someone signed out, or a session with names off, is
  // never shown a lookup under way.
  const start = noStore ? NO_STORE : workerUrl && account && !namesOff ? PENDING : UNKNOWN;
  const [state, setState] = useState<SessionNamesState>(start);
  useEffect(() => {
    let current = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    // One retry for each run of failures, counted when it runs: a read that works earns the next failure its own,
    // and a sign-in or a save that reads early and fails too doesn't use it up.
    let retried = false;
    setState(start);
    const giveUp =
      start === PENDING
        ? setTimeout(
            () => setState((was) => (was.status === 'pending' ? { ...was, status: 'failed' } : was)),
            NAMES_PENDING_LIMIT_MS,
          )
        : undefined;
    const load = async () => {
      if (!workerUrl) return;
      const seq = ++loadSeq.current;
      // A newer read stands in for a retry still waiting.
      clearTimeout(retry);
      let next: SessionNamesState;
      let failed = false;
      try {
        const source = await resolveSessionNamesSource(latest.current);
        // A names read that fails keeps its source, as an empty read did before, but says it failed.
        const names = source
          ? await source.readAllOrFail().catch(() => {
              failed = true;
              return {};
            })
          : {};
        const signIn = source && !(await source.hasSignIn()) ? source.signIn : null;
        next = {
          status: failed ? 'failed' : readStatus(source, names, !!latest.current.account && !signIn),
          source,
          names,
          answerNamesShown: !source,
          signIn,
        };
      } catch {
        next = FAILED;
        failed = true;
      }
      // Keep the same state when nothing changed, so the views using it don't render again.
      if (current && seq === loadSeq.current) {
        setState((was) =>
          was.status === next.status &&
          was.source === next.source &&
          was.answerNamesShown === next.answerNamesShown &&
          was.signIn === next.signIn &&
          sameNames(was.names, next.names)
            ? was
            : next,
        );
        if (!failed) retried = false;
        else if (!retried) {
          retry = setTimeout(() => {
            retried = true;
            void load();
          }, NAMES_RETRY_MS);
        }
      }
    };
    void load();
    const stopNames = subscribeSessionNames(() => void load());
    const stopToken = subscribeWorkerSessionToken(() => void load());
    return () => {
      current = false;
      clearTimeout(retry);
      clearTimeout(giveUp);
      stopNames();
      stopToken();
    };
  }, [sessionSlug, account, workerUrl, namesOff, noStore, start]);
  return state;
};
