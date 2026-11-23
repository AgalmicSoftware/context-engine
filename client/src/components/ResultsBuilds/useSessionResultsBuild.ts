import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { adminWorkerPorts } from '../../domains/worker/adminWorkerPorts';
import {
  RESULTS_BUILD_KINDS,
  readResultsBuild,
  requestResultsBuild,
  type ResultsBuildKind,
  type ResultsBuildNextBuild,
  type ResultsBuildSummary,
} from '../../domains/resultsBuilds/resultsBuildWorkerClient';
import { mayStartResultsBuilds } from '../../domains/sessionResults/resultsBuilders';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery';

type UnknownRecord = Record<string, unknown>;

export type SessionResultsBuild<TBuild extends ResultsBuildSummary> = {
  /** This session's Worker builds this kind. */
  supported: boolean;
  builds: ResultsBuildSummary[];
  build: TBuild | null;
  /** This account may press Build; the Worker checks again when it is pressed. */
  canBuild: boolean;
  building: boolean;
  loading: boolean;
  /** A read for this reader has come back, so an empty list means none is built. */
  loaded: boolean;
  /** When a build someone started is still running. */
  activeSinceMs: number | null;
  /** When the running build, this reader's or someone else's, started. */
  buildStartedAtMs: number | null;
  /** The model and prompts a build would use, for those who may build. */
  nextBuild: ResultsBuildNextBuild | null;
  /** The Worker that keeps this session's builds. */
  workerUrl: string;
  /** This reader's press lost its connection, and the build it may have started is being followed. */
  dropped: boolean;
  error: string;
  /** True once the press's build shows: when the press returns it, or when a dropped press's build is found. */
  startBuild: () => Promise<boolean>;
  selectBuild: (id: string) => void;
};

// While someone else's build runs, the open Results check back this often.
export const RESULTS_BUILD_ACTIVE_POLL_MS = 20_000;
// A dropped press's build is followed through this many failed reads in a row, as a phone may take a moment to
// come back online, before the reader is told it couldn't be checked.
export const RESULTS_BUILD_FOLLOW_FAILED_READS = 3;
// The Worker keeps this many builds of a kind; the list never offers one it dropped.
export const RESULTS_BUILD_KEPT_BUILDS = 8;

// A build followed after its press dropped: the newest build listed at the press ('' for none, null before any
// read came back), so a read can tell a new one; when it was pressed; the reads that failed in a row; and the
// press's answer, given when the follow ends.
type Follow = {
  newestId: string | null;
  pressedAt: number;
  failedReads: number;
  settle: (built: boolean) => void;
};

type BuildData<TBuild> = {
  builds: ResultsBuildSummary[];
  build: TBuild | null;
  serverCanBuild: boolean;
  activeSinceMs: number | null;
  // Bumped by each read that finds a build running, so the check-back re-arms.
  activeReads: number;
  nextBuild: ResultsBuildNextBuild | null;
};

const EMPTY: BuildData<never> = {
  builds: [],
  build: null,
  serverCanBuild: false,
  activeSinceMs: null,
  activeReads: 0,
  nextBuild: null,
};

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
const lower = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');

// A session's builds of one kind, as the open Results show them: the newest or
// a picked one, the list of those kept, and a build this reader starts.
export const useSessionResultsBuild = <TBuild extends ResultsBuildSummary>({
  account,
  chainId,
  enabled,
  kind,
  provider,
  sessionConfig,
  sessionSlug,
}: {
  account: unknown;
  chainId: unknown;
  enabled: boolean;
  kind: ResultsBuildKind;
  provider: unknown;
  sessionConfig: unknown;
  sessionSlug: string;
}): SessionResultsBuild<TBuild> => {
  const { body, field, name, plural } = RESULTS_BUILD_KINDS[kind];
  const config = toRecord(sessionConfig);
  const workerUrl = useMemo(
    () =>
      getUsableSessionWorkerUrl({
        slug: sessionSlug,
        sessionConfig,
        allowSharedFallback: false,
        requireExactWorkerSession: true,
      }),
    [sessionConfig, sessionSlug],
  );
  const sessionId = resolveWorkerCanonicalSessionIdHex(config);
  const supported = config[field] === true && !!workerUrl;
  // Whose builds these are. A new session, Worker or account starts empty, so
  // nothing read for one reader or session is shown for another.
  const identity = supported ? [workerUrl, sessionSlug, sessionId, lower(account)].join('|') : '';
  const [shownFor, setShownFor] = useState(identity);
  const [data, setData] = useState<BuildData<TBuild>>(EMPTY);
  const [building, setBuilding] = useState(false);
  const [pressedAtMs, setPressedAtMs] = useState<number | null>(null);
  // The build the reader picked; '' follows the newest.
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [dropped, setDropped] = useState(false);
  if (shownFor !== identity) {
    setShownFor(identity);
    setData(EMPTY);
    setBuilding(false);
    setPressedAtMs(null);
    setSelectedId('');
    setLoading(false);
    setLoaded(false);
    setError('');
    setDropped(false);
  }
  const identityRef = useRef(identity);
  const requestSeq = useRef(0);
  const followRef = useRef<Follow | null>(null);
  // The newest build listed, or null before a read has come back.
  const newestIdRef = useRef<string | null>(null);
  newestIdRef.current = loaded ? data.builds[0]?.id || '' : null;
  useEffect(() => {
    identityRef.current = identity;
    requestSeq.current += 1;
    // A followed build belongs to the old reader or session.
    followRef.current?.settle(false);
    followRef.current = null;
  }, [identity]);

  const load = useCallback(
    async (id = ''): Promise<void> => {
      if (!supported) return;
      const seq = (requestSeq.current += 1);
      setLoading(true);
      const result = await readResultsBuild<TBuild>({ account, id, kind, sessionId, sessionSlug, workerUrl });
      if (seq !== requestSeq.current) return;
      setLoading(false);
      const follow = followRef.current;
      // The followed build's press is answered: it built when a new build shows.
      const endFollow = (built: boolean) => {
        followRef.current = null;
        setDropped(false);
        follow?.settle(built);
      };
      if (!result.ok) {
        // A build that is no longer kept: show the newest instead.
        if (id && result.status === 404) {
          setSelectedId('');
          return load('');
        }
        // Refused: this reader may not see this kind here, so none stay on screen.
        if (result.status === 401 || result.status === 403) {
          endFollow(false);
          setData(EMPTY);
          setLoaded(true);
          setError('');
          return;
        }
        if (follow) {
          // A followed build is followed through a failed read or two, as a phone may take a moment to come back
          // online. Then the reader is told, rather than shown a build that may not run.
          follow.failedReads += 1;
          if (follow.failedReads < RESULTS_BUILD_FOLLOW_FAILED_READS) {
            setData((previous) => ({ ...previous, activeReads: previous.activeReads + 1 }));
            return;
          }
          endFollow(false);
          setData((previous) => ({ ...previous, activeSinceMs: null }));
          setError(`Couldn't check on the ${name} build. Reload to see if it finished.`);
          return;
        }
        setError(result.error || `${plural} are unavailable.`);
        return;
      }
      setError('');
      setLoaded(true);
      const activeSinceMs = result.active?.startedAtMs || null;
      if (follow) {
        follow.failedReads = 0;
        if (!activeSinceMs) {
          // The followed build no longer runs: a new one shows, and none means it didn't finish. Pressed before any
          // read came back, a build newer than the press is the new one.
          const newest = result.builds?.[0];
          const built =
            follow.newestId === null
              ? Date.parse(newest?.builtAt || '') > follow.pressedAt
              : (newest?.id || '') !== follow.newestId;
          endFollow(built);
          if (!built) setError(`The ${name} build didn't finish. Press Build to try again.`);
        }
      }
      setData((previous) => ({
        builds: result.builds || [],
        build: result.build || null,
        serverCanBuild: result.canBuild === true,
        activeSinceMs,
        activeReads: previous.activeReads + (activeSinceMs ? 1 : 0),
        nextBuild: result.nextBuild || null,
      }));
    },
    [account, kind, name, plural, sessionId, sessionSlug, supported, workerUrl],
  );

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !data.activeSinceMs || building) return undefined;
    // Checking back keeps the build the reader is looking at.
    const timer = globalThis.setTimeout(() => void load(selectedId), RESULTS_BUILD_ACTIVE_POLL_MS);
    return () => globalThis.clearTimeout(timer);
  }, [data.activeSinceMs, data.activeReads, building, enabled, load, selectedId]);

  useEffect(() => {
    if (!enabled || !(building || data.activeSinceMs)) return undefined;
    // A phone may pause or cut a hidden page's requests, so a build pressed or running is read again on return.
    const readOnReturn = () => {
      if (document.visibilityState === 'visible') void load(selectedId);
    };
    document.addEventListener('visibilitychange', readOnReturn);
    return () => document.removeEventListener('visibilitychange', readOnReturn);
  }, [building, data.activeSinceMs, enabled, load, selectedId]);

  const startBuild = useCallback(async () => {
    if (!supported || building) return false;
    const startedFor = identity;
    const pressedAt = Date.now();
    // Taken now: a read while it builds may already list the build this press makes.
    const newestAtPress = newestIdRef.current;
    setBuilding(true);
    setPressedAtMs(pressedAt);
    setError('');
    const signingChainId = Number(config.networkChainId || chainId || 1) || 1;
    const authorityMode = toRecord(toRecord(config.sessionModeProfile).authority).mode;
    const result = await requestResultsBuild<TBuild>({
      chainId: signingChainId,
      kind,
      sessionSlug,
      workerUrl,
      signAdminAction: ({ action, body: signedBody, workerUrl: signedWorkerUrl }) =>
        adminWorkerPorts.adminAuth.buildSignedAdminActionAuth({
          action,
          slug: sessionSlug,
          sessionId: sessionId || undefined,
          sessionAuthorityMode: typeof authorityMode === 'string' && authorityMode ? authorityMode : undefined,
          body: signedBody,
          workerUrl: signedWorkerUrl,
          context: { account, chainId: signingChainId, providerLike: provider },
        }),
    });
    // The reader or session changed while it built: its build belongs to the old one.
    if (identityRef.current !== startedFor) return false;
    setBuilding(false);
    setPressedAtMs(null);
    if (result.dropped) {
      // The press lost its connection, as a phone may cut its long request, while the Worker builds on without
      // it. Follow that build from the press: read now, then check back as for anyone's running build. The
      // press is answered when the follow ends, so a build that shows opens as a press's own would.
      setDropped(true);
      setSelectedId('');
      setData((previous) => ({ ...previous, activeSinceMs: previous.activeSinceMs || pressedAt }));
      return new Promise<boolean>((settle) => {
        followRef.current = { newestId: newestAtPress, pressedAt, failedReads: 0, settle };
        void load('');
      });
    }
    const built = result.build;
    if (!result.ok || !built) {
      setError(result.error || `The ${name} build failed.`);
      // Only someone else's build that refused the press stays shown as running, checked back for its build. A
      // read while this press built may have found the press's own build running, which no longer runs.
      setData((previous) => ({ ...previous, activeSinceMs: result.active?.startedAtMs || null }));
      return false;
    }
    // The list entry is the build's stamp, without the kind's body.
    const summary = Object.fromEntries(
      Object.entries(built).filter(([key]) => !body.includes(key)),
    ) as ResultsBuildSummary;
    setSelectedId('');
    // A read that started before this build must not replace it.
    requestSeq.current += 1;
    setData((previous) => ({
      ...previous,
      build: built,
      builds: [summary, ...previous.builds.filter((entry) => entry.id !== summary.id)].slice(
        0,
        RESULTS_BUILD_KEPT_BUILDS,
      ),
      activeSinceMs: null,
    }));
    return true;
  }, [
    account,
    body,
    building,
    chainId,
    config,
    identity,
    kind,
    load,
    name,
    provider,
    sessionId,
    sessionSlug,
    supported,
    workerUrl,
  ]);

  const selectBuild = useCallback(
    (id: string) => {
      setSelectedId(id);
      void load(id);
    },
    [load],
  );

  return {
    supported,
    builds: data.builds,
    build: data.build,
    canBuild: supported && (data.serverCanBuild || mayStartResultsBuilds(config, account)),
    building,
    loading,
    loaded,
    activeSinceMs: data.activeSinceMs,
    buildStartedAtMs: building ? pressedAtMs : data.activeSinceMs,
    nextBuild: data.nextBuild,
    workerUrl: supported ? String(workerUrl || '') : '',
    dropped,
    error,
    startBuild,
    selectBuild,
  };
};
