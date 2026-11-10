import { postSignedAdminWorkerRequest } from '../../utilities/worker/signedAdminWorkerRequest';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl';
import { getCachedWorkerAuthHeaders } from '../sessionResults/sessionResultsAnalysisWorkerClient';
import type { DebateAtlasBuild, DebateAtlasBuildSummary, DebateAtlasNextBuild } from './debateAtlasTypes';

export const DEBATE_ATLAS_BUILD_ACTION = 'debate-atlas/build';

export type DebateAtlasReadResult = {
  ok: boolean;
  status: number;
  error?: string;
  active?: { startedAtMs: number } | null;
  build?: DebateAtlasBuild | null;
  builds?: DebateAtlasBuildSummary[];
  canBuild?: boolean;
  /** Sent to those who may build. */
  nextBuild?: DebateAtlasNextBuild | null;
};

export type DebateAtlasBuildResult = {
  ok: boolean;
  status: number;
  error?: string;
  build?: DebateAtlasBuild;
  /** Set when the press was refused because another build is running; the next read gives its start. */
  active?: { startedAtMs: number };
};

type AdminActionSigner = (args: {
  action: string;
  body: Record<string, unknown>;
  chainId: unknown;
  workerUrl: string;
}) => Promise<Record<string, unknown>>;

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const readError = (data: Record<string, unknown>, fallback: string): string =>
  String(data.error || data.reason || '').trim() || fallback;

// Signed in, the Worker also answers whether this account may build.
export const readDebateAtlas = async ({
  account,
  fetchImpl = fetch,
  id = '',
  sessionId,
  sessionSlug,
  workerUrl,
}: {
  account?: unknown;
  fetchImpl?: typeof fetch;
  id?: string;
  sessionId?: unknown;
  sessionSlug: string;
  workerUrl: unknown;
}): Promise<DebateAtlasReadResult> => {
  const baseUrl = normalizeWorkerUrl(workerUrl);
  if (!baseUrl) return { ok: false, status: 0, error: 'This session has no Worker for atlases.' };
  const url = new URL(`${baseUrl}/debate-atlas`);
  url.searchParams.set('sessionSlug', sessionSlug);
  if (id) url.searchParams.set('id', id);
  try {
    const response = await fetchImpl(url.toString(), {
      headers: getCachedWorkerAuthHeaders({ account, sessionSlug, sessionId, workerUrl: baseUrl }),
    });
    const data = toRecord(await response.json().catch(() => ({})));
    if (!response.ok || data.ok !== true) {
      return { ok: false, status: response.status, error: readError(data, 'Atlases are unavailable.') };
    }
    return { ...(data as DebateAtlasReadResult), ok: true, status: response.status };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : 'Atlases are unavailable.' };
  }
};

export const requestDebateAtlasBuild = async ({
  chainId,
  fetchImpl = fetch,
  now = Date.now,
  sessionSlug,
  signAdminAction,
  workerUrl,
}: {
  chainId: unknown;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sessionSlug: string;
  signAdminAction: AdminActionSigner;
  workerUrl: unknown;
}): Promise<DebateAtlasBuildResult> => {
  try {
    const result = await postSignedAdminWorkerRequest({
      action: DEBATE_ATLAS_BUILD_ACTION,
      body: { sessionSlug, source: { kind: 'worker-canonical' } },
      chainId,
      fetchImpl,
      path: `/admin/${DEBATE_ATLAS_BUILD_ACTION}`,
      signAdminAction,
      workerUrl,
    });
    const data = toRecord(result.data);
    const status = result.response?.status || 0;
    if (data.ok !== true || !data.build)
      return { ok: false, status, error: readError(data, 'The atlas build failed.') };
    return { ok: true, status, build: data.build as DebateAtlasBuild };
  } catch (error) {
    // The signed request throws on a refusal, keeping its status, reason and,
    // when a build is already running, when that build started.
    const { status, reason, active } = toRecord(error);
    const startedAtMs = Number(toRecord(active).startedAtMs) || now();
    return {
      ok: false,
      status: Number(status) || 0,
      error: error instanceof Error ? error.message : 'The atlas build failed.',
      ...(reason === 'debate_atlas_build_running' ? { active: { startedAtMs } } : {}),
    };
  }
};
