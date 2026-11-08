import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEBATE_ATLAS_FIELD } from '@ce-shared/workerSessionPublicConfig.mjs';

import { adminWorkerPorts } from '../../domains/worker/adminWorkerPorts';
import { readDebateAtlas, requestDebateAtlasBuild } from '../../domains/debateAtlas/debateAtlasWorkerClient';
import type { DebateAtlasBuild, DebateAtlasBuildSummary } from '../../domains/debateAtlas/debateAtlasTree';
import { isConfiguredAdmin } from '../../utilities/storage/storageClient';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery';

type UnknownRecord = Record<string, unknown>;

export type SessionDebateAtlas = {
  /** This session's Worker builds atlases. */
  supported: boolean;
  builds: DebateAtlasBuildSummary[];
  build: DebateAtlasBuild | null;
  /** This account may press Build; the Worker checks again when it is pressed. */
  canBuild: boolean;
  building: boolean;
  loading: boolean;
  /** When a build someone started is still running. */
  activeSinceMs: number | null;
  error: string;
  buildAtlas: () => Promise<boolean>;
  selectBuild: (id: string) => void;
};

// While someone else's build runs, the open Results check back this often.
export const DEBATE_ATLAS_ACTIVE_POLL_MS = 20_000;

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

export const useSessionDebateAtlas = ({
  account,
  chainId,
  enabled,
  provider,
  sessionConfig,
  sessionSlug,
}: {
  account: unknown;
  chainId: unknown;
  enabled: boolean;
  provider: unknown;
  sessionConfig: unknown;
  sessionSlug: string;
}): SessionDebateAtlas => {
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
  const supported = config[DEBATE_ATLAS_FIELD] === true && !!workerUrl;
  const [builds, setBuilds] = useState<DebateAtlasBuildSummary[]>([]);
  const [build, setBuild] = useState<DebateAtlasBuild | null>(null);
  const [serverCanBuild, setServerCanBuild] = useState(false);
  const [building, setBuilding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeSinceMs, setActiveSinceMs] = useState<number | null>(null);
  const [error, setError] = useState('');
  const requestSeq = useRef(0);

  const load = useCallback(
    async (id = '') => {
      if (!supported) return;
      const seq = (requestSeq.current += 1);
      setLoading(true);
      const result = await readDebateAtlas({ account, id, sessionId, sessionSlug, workerUrl });
      if (seq !== requestSeq.current) return;
      setLoading(false);
      if (!result.ok) {
        // A session whose Results viewers may not see atlases simply has none to show.
        if (result.status !== 403) setError(result.error || 'Atlases are unavailable.');
        return;
      }
      setError('');
      setBuilds(result.builds || []);
      setBuild(result.build || null);
      setServerCanBuild(result.canBuild === true);
      setActiveSinceMs(result.active?.startedAtMs || null);
    },
    [account, sessionId, sessionSlug, supported, workerUrl],
  );

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !activeSinceMs || building) return undefined;
    const timer = globalThis.setTimeout(() => void load(), DEBATE_ATLAS_ACTIVE_POLL_MS);
    return () => globalThis.clearTimeout(timer);
  }, [activeSinceMs, building, enabled, load]);

  const buildAtlas = useCallback(async () => {
    if (!supported || building) return false;
    setBuilding(true);
    setError('');
    const signingChainId = Number(config.networkChainId || chainId || 1) || 1;
    const authorityMode = toRecord(toRecord(config.sessionModeProfile).authority).mode;
    const result = await requestDebateAtlasBuild({
      chainId: signingChainId,
      sessionSlug,
      workerUrl,
      signAdminAction: ({ action, body, workerUrl: signedWorkerUrl }) =>
        adminWorkerPorts.adminAuth.buildSignedAdminActionAuth({
          action,
          slug: sessionSlug,
          sessionId: sessionId || undefined,
          sessionAuthorityMode: typeof authorityMode === 'string' && authorityMode ? authorityMode : undefined,
          body,
          workerUrl: signedWorkerUrl,
          context: { account, chainId: signingChainId, providerLike: provider },
        }),
    });
    setBuilding(false);
    if (!result.ok || !result.build) {
      setError(result.error || 'The atlas build failed.');
      // Someone else's build is running: show it, and check back for its atlas.
      if (result.active?.startedAtMs) setActiveSinceMs(result.active.startedAtMs);
      return false;
    }
    const { branches, ...summary } = result.build;
    // A read that started before this build must not replace it.
    requestSeq.current += 1;
    setBuild(result.build);
    setBuilds((previous) => [summary, ...previous.filter((entry) => entry.id !== summary.id)]);
    setActiveSinceMs(null);
    return true;
  }, [account, building, chainId, config, provider, sessionId, sessionSlug, supported, workerUrl]);

  const selectBuild = useCallback((id: string) => void load(id), [load]);

  return {
    supported,
    builds,
    build,
    canBuild: supported && (serverCanBuild || mayOfferBuild(config, account)),
    building,
    loading,
    activeSinceMs,
    error,
    buildAtlas,
    selectBuild,
  };
};
