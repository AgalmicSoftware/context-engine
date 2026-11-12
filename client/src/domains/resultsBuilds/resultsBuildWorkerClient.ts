import { DEBATE_ATLAS_FIELD, RISK_MATRIX_FIELD } from '@ce-shared/workerSessionPublicConfig.mjs';

import { postSignedAdminWorkerRequest } from '../../utilities/worker/signedAdminWorkerRequest';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl';
import { getCachedWorkerAuthHeaders } from '../sessionResults/sessionResultsAnalysisWorkerClient';

// The Results views admins build with AI on the Session Worker
// (workers/sessionCorsWorker/resultsBuild.js). `field` is the public config
// field of a Worker that builds the kind; `body` holds what a build has beyond
// its listed stamp.
export const RESULTS_BUILD_KINDS = Object.freeze({
  'debate-atlas': {
    field: DEBATE_ATLAS_FIELD,
    path: '/debate-atlas',
    action: 'debate-atlas/build',
    running: 'debate_atlas_build_running',
    body: ['branches'],
    name: 'atlas',
    plural: 'Atlases',
  },
  'risk-matrix': {
    field: RISK_MATRIX_FIELD,
    path: '/risk-matrix',
    action: 'risk-matrix/build',
    running: 'risk_matrix_build_running',
    body: ['areas', 'notes'],
    name: 'risk matrix',
    plural: 'Risk matrices',
  },
});
export type ResultsBuildKind = keyof typeof RESULTS_BUILD_KINDS;

// A build's stamp, as the Worker lists it.
export type ResultsBuildSummary = {
  id: string;
  builtAt: string;
  builtBy?: string;
  model?: string;
  title?: string;
  counts?: {
    responses?: number;
    participants?: number;
    questions?: number;
    aiResponses?: number;
    aiQuestions?: number;
  };
};
// What a build would send now: the model, and its prompts with the session's data as placeholders.
export type ResultsBuildNextBuild = { model?: string; prompts?: Record<string, string> };

export type ResultsBuildReadResult<TBuild extends ResultsBuildSummary> = {
  ok: boolean;
  status: number;
  error?: string;
  active?: { startedAtMs: number } | null;
  build?: TBuild | null;
  builds?: ResultsBuildSummary[];
  canBuild?: boolean;
  /** Sent to those who may build. */
  nextBuild?: ResultsBuildNextBuild | null;
};

export type ResultsBuildResult<TBuild extends ResultsBuildSummary> = {
  ok: boolean;
  status: number;
  error?: string;
  build?: TBuild;
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
export const readResultsBuild = async <TBuild extends ResultsBuildSummary>({
  account,
  fetchImpl = fetch,
  id = '',
  kind,
  sessionId,
  sessionSlug,
  workerUrl,
}: {
  account?: unknown;
  fetchImpl?: typeof fetch;
  id?: string;
  kind: ResultsBuildKind;
  sessionId?: unknown;
  sessionSlug: string;
  workerUrl: unknown;
}): Promise<ResultsBuildReadResult<TBuild>> => {
  const { path, plural } = RESULTS_BUILD_KINDS[kind];
  const baseUrl = normalizeWorkerUrl(workerUrl);
  if (!baseUrl) return { ok: false, status: 0, error: `This session has no Worker for ${plural.toLowerCase()}.` };
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.set('sessionSlug', sessionSlug);
  if (id) url.searchParams.set('id', id);
  try {
    const response = await fetchImpl(url.toString(), {
      headers: getCachedWorkerAuthHeaders({ account, sessionSlug, sessionId, workerUrl: baseUrl }),
    });
    const data = toRecord(await response.json().catch(() => ({})));
    if (!response.ok || data.ok !== true) {
      return { ok: false, status: response.status, error: readError(data, `${plural} are unavailable.`) };
    }
    return { ...(data as ResultsBuildReadResult<TBuild>), ok: true, status: response.status };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : `${plural} are unavailable.` };
  }
};

export const requestResultsBuild = async <TBuild extends ResultsBuildSummary>({
  chainId,
  fetchImpl = fetch,
  kind,
  now = Date.now,
  sessionSlug,
  signAdminAction,
  workerUrl,
}: {
  chainId: unknown;
  fetchImpl?: typeof fetch;
  kind: ResultsBuildKind;
  now?: () => number;
  sessionSlug: string;
  signAdminAction: AdminActionSigner;
  workerUrl: unknown;
}): Promise<ResultsBuildResult<TBuild>> => {
  const { action, name, running } = RESULTS_BUILD_KINDS[kind];
  try {
    const result = await postSignedAdminWorkerRequest({
      action,
      body: { sessionSlug, source: { kind: 'worker-canonical' } },
      chainId,
      fetchImpl,
      path: `/admin/${action}`,
      signAdminAction,
      workerUrl,
    });
    const data = toRecord(result.data);
    const status = result.response?.status || 0;
    if (data.ok !== true || !data.build)
      return { ok: false, status, error: readError(data, `The ${name} build failed.`) };
    return { ok: true, status, build: data.build as TBuild };
  } catch (error) {
    // The signed request throws on a refusal, keeping its status, reason and,
    // when a build is already running, when that build started.
    const { status, reason, active } = toRecord(error);
    const startedAtMs = Number(toRecord(active).startedAtMs) || now();
    return {
      ok: false,
      status: Number(status) || 0,
      error: error instanceof Error ? error.message : `The ${name} build failed.`,
      ...(reason === running ? { active: { startedAtMs } } : {}),
    };
  }
};
