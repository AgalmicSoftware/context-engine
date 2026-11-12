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
import { isConfiguredAdmin } from '../../utilities/storage/storageClient';
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
  /** When a build someone started is still running. */
  activeSinceMs: number | null;
  /** When the running build, this reader's or someone else's, started. */
  buildStartedAtMs: number | null;
  /** The model and prompts a build would use, for those who may build. */
  nextBuild: ResultsBuildNextBuild | null;
  /** The Worker that keeps this session's builds. */
  workerUrl: string;
  error: string;
  startBuild: () => Promise<boolean>;
  selectBuild: (id: string) => void;
};

// While someone else's build runs, the open Results check back this often.
export const RESULTS_BUILD_ACTIVE_POLL_MS = 20_000;
// The Worker keeps this many builds of a kind; the list never offers one it dropped.
export const RESULTS_BUILD_KEPT_BUILDS = 8;

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

// Admins, co-admins and results admins; on a hat session any signed-in account
// is offered the button, and the Worker decides, as for AI Views.
const mayOfferBuild = (config: UnknownRecord, account: unknown): boolean => {
  const address = lower(account);
  if (!address) return false;
  const resultsAdmins = Array.isArray(config.resultsAdminAddresses) ? config.resultsAdminAddresses.map(lower) : [];
  return (
    isConfiguredAdmin(config, { account: address }) ||
    resultsAdmins.includes(address) ||
    (!!lower(config.adminHatId) && !!lower(config.hatsAddress))
  );
};

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
  const [error, setError] = useState('');
  if (shownFor !== identity) {
    setShownFor(identity);
    setData(EMPTY);
    setBuilding(false);
    setPressedAtMs(null);
    setSelectedId('');
    setLoading(false);
    setError('');
  }
  const identityRef = useRef(identity);
  const requestSeq = useRef(0);
  useEffect(() => {
    identityRef.current = identity;
    requestSeq.current += 1;
  }, [identity]);

  const load = useCallback(
    async (id = ''): Promise<void> => {
      if (!supported) return;
      const seq = (requestSeq.current += 1);
      setLoading(true);
      const result = await readResultsBuild<TBuild>({ account, id, kind, sessionId, sessionSlug, workerUrl });
      if (seq !== requestSeq.current) return;
      setLoading(false);
      if (!result.ok) {
        // A build that is no longer kept: show the newest instead.
        if (id && result.status === 404) {
          setSelectedId('');
          return load('');
        }
        // Refused: this reader may not see this kind here, so none stay on screen.
        if (result.status === 401 || result.status === 403) {
          setData(EMPTY);
          setError('');
          return;
        }
        setError(result.error || `${plural} are unavailable.`);
        return;
      }
      setError('');
      const activeSinceMs = result.active?.startedAtMs || null;
      setData((previous) => ({
        builds: result.builds || [],
        build: result.build || null,
        serverCanBuild: result.canBuild === true,
        activeSinceMs,
        activeReads: previous.activeReads + (activeSinceMs ? 1 : 0),
        nextBuild: result.nextBuild || null,
      }));
    },
    [account, kind, plural, sessionId, sessionSlug, supported, workerUrl],
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

  const startBuild = useCallback(async () => {
    if (!supported || building) return false;
    const startedFor = identity;
    setBuilding(true);
    setPressedAtMs(Date.now());
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
    const built = result.build;
    if (!result.ok || !built) {
      setError(result.error || `The ${name} build failed.`);
      // Someone else's build is running: show it, and check back for its build.
      const startedAtMs = result.active?.startedAtMs;
      if (startedAtMs) setData((previous) => ({ ...previous, activeSinceMs: startedAtMs }));
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
    canBuild: supported && (data.serverCanBuild || mayOfferBuild(config, account)),
    building,
    loading,
    activeSinceMs: data.activeSinceMs,
    buildStartedAtMs: building ? pressedAtMs : data.activeSinceMs,
    nextBuild: data.nextBuild,
    workerUrl: supported ? String(workerUrl || '') : '',
    error,
    startBuild,
    selectBuild,
  };
};
