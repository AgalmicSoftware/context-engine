import { adminWorkerPorts } from '../../domains/worker/adminWorkerPorts';
import {
  buildInitialGeneratedResultsControllerState,
  resolveGeneratedResultsControllerState,
} from '../../domains/sessionResults/sessionResultsAnalysisController';
import { buildResultsAnalysisBrowserSnapshotFromCacheNode } from '../../domains/sessionResults/sessionResultsAnalysisBrowserSnapshot';
import {
  readSessionResultsAnalysisArtifact,
  readSessionResultsAnalysisStatus,
  startSessionResultsAnalysisGeneration,
} from '../../domains/sessionResults/sessionResultsAnalysisWorkerClient';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery';
import type { ResultsAnalysisBrowserSnapshotResult } from '../../domains/sessionResults/sessionResultsAnalysisBrowserSnapshot';
import type { GeneratedResultsControllerState } from '../../domains/sessionResults/sessionResultsAnalysisController';
import { normalizeOnePageSessionSlug, type OnePageSessionPropsLike } from './onePageSessionTelegramController';
import { resolveOnePageSessionSurveySlug } from './onePageSessionAggregatorCacheRuntime';
import { resolveOnePageSessionAggregatorCacheScope } from './onePageSessionRouteRuntime';

type UnknownRecord = Record<string, unknown>;

type OnePageGeneratedResultsHost = {
  props: UnknownRecord;
  state: UnknownRecord & {
    generatedResultsAnalysis?: GeneratedResultsControllerState;
    generatedResultsStatusBody?: unknown;
    resultsViewMode?: unknown;
  };
  _generatedResultsRequestSeq?: number;
  setState: (patch: UnknownRecord | ((prev: UnknownRecord) => UnknownRecord | null), callback?: () => void) => void;
  resolveCurrentSessionConfig: (props?: OnePageSessionPropsLike) => UnknownRecord;
  resolveCurrentSessionSlug: (props?: OnePageSessionPropsLike) => string;
};

type RuntimePorts = {
  now?: () => number;
  pollAttempts?: number;
  pollIntervalMs?: number;
  randomUUID?: () => string;
  readQuestionsCache: (slug: string) => unknown;
  readArtifact?: typeof readSessionResultsAnalysisArtifact;
  readStatus?: typeof readSessionResultsAnalysisStatus;
  sleep?: (ms: number) => Promise<void>;
  startGeneration?: typeof startSessionResultsAnalysisGeneration;
};

type GeneratedResultsRuntime = {
  capability: UnknownRecord;
  isWorkerCanonical: boolean;
  sessionId: string;
  sessionSlug: string;
  sourceKind: 'worker-canonical' | 'admin-snapshot';
  snapshotResult: ResultsAnalysisBrowserSnapshotResult | null;
  unsupportedReason: string;
  workerUrl: string;
};

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
const toText = (value: unknown): string => (value == null ? '' : String(value).trim());
const toStatusCode = (value: unknown): number => Number(toRecord(value).status || toRecord(value).httpStatus || 0) || 0;
const isAuthFailureStatus = (value: unknown): boolean => {
  const body = toRecord(value);
  const statusCode = toStatusCode(body);
  return statusCode === 401 || statusCode === 403 || body.authPending === true;
};
const isRunningJobStatus = (value: unknown): boolean => {
  const body = toRecord(value);
  const state = toRecord(body.state);
  const jobState = toText(state.jobState || body.jobState).toLowerCase();
  return jobState === 'running' || jobState === 'queued';
};
const readErrorMessage = (value: unknown, fallback: string): string => {
  const body = toRecord(value);
  return toText(body.error || body.message || body.reason) || fallback;
};
const readErrorStatus = (error: unknown): number => {
  if (!error || typeof error !== 'object') return 0;
  return Number((error as { status?: unknown }).status || (error as { httpStatus?: unknown }).httpStatus || 0) || 0;
};
const readChainId = (host: OnePageGeneratedResultsHost, sessionConfig: UnknownRecord): number =>
  Number(
    sessionConfig.networkChainId ||
      host.props.networkChainId ||
      toRecord(host.props.network).id ||
      toRecord(host.props.network).chainId ||
      1,
  ) || 1;

const defaultPorts: RuntimePorts = {
  now: () => Date.now(),
  pollAttempts: 96,
  pollIntervalMs: 5000,
  randomUUID: () => globalThis.crypto?.randomUUID?.() || `r${Date.now().toString(36)}`,
  readQuestionsCache: () => ({}),
  readArtifact: readSessionResultsAnalysisArtifact,
  readStatus: readSessionResultsAnalysisStatus,
  sleep: (ms: number) => new Promise((resolve) => globalThis.setTimeout(resolve, ms)),
  startGeneration: startSessionResultsAnalysisGeneration,
};

export const buildGeneratedResultsIdentityKey = ({
  account,
  loginComplete,
  sessionConfig,
  sessionId,
  sessionSlug,
  workerUrl,
}: {
  account?: unknown;
  loginComplete?: unknown;
  sessionConfig?: UnknownRecord;
  sessionId?: unknown;
  sessionSlug?: unknown;
  workerUrl?: unknown;
} = {}): string => {
  const config = toRecord(sessionConfig);
  const chainId = Number(config.networkChainId || 0) || 0;
  return [
    normalizeOnePageSessionSlug(sessionSlug || config.slug || ''),
    toText(sessionId || resolveWorkerCanonicalSessionIdHex(config)),
    toText(workerUrl),
    chainId,
    toText(account).toLowerCase(),
    loginComplete === true ? 'login' : 'anon',
  ].join('|');
};

export const resolveGeneratedResultsRuntime = (
  host: OnePageGeneratedResultsHost,
  {
    ports = defaultPorts,
    sessionConfig = host.resolveCurrentSessionConfig(),
    sessionSlug = host.resolveCurrentSessionSlug(),
  }: { ports?: Partial<RuntimePorts>; sessionConfig?: UnknownRecord; sessionSlug?: unknown } = {},
): GeneratedResultsRuntime => {
  const mergedPorts = { ...defaultPorts, ...ports };
  const normalizedSlug = normalizeOnePageSessionSlug(sessionSlug || sessionConfig.slug || '');
  const capability = resolveSessionCapabilityProjection(sessionConfig) as UnknownRecord;
  const isWorkerCanonical = capability.isWorkerCanonical === true;
  const workerUrl = getUsableSessionWorkerUrl({
    slug: normalizedSlug,
    sessionConfig,
    allowSharedFallback: false,
    requireExactWorkerSession: isWorkerCanonical,
  });
  const sessionId = toText(
    resolveWorkerCanonicalSessionIdHex(sessionConfig) || sessionConfig.sessionId || sessionConfig.sessionIdHex,
  );
  const sourceKind: GeneratedResultsRuntime['sourceKind'] = isWorkerCanonical ? 'worker-canonical' : 'admin-snapshot';
  let snapshotResult: ResultsAnalysisBrowserSnapshotResult | null = null;

  if (!isWorkerCanonical) {
    const questionSourceSlug = resolveOnePageSessionSurveySlug({ ...host.props, sessionConfig });
    const cacheScope = resolveOnePageSessionAggregatorCacheScope({ ...host.props, sessionConfig });
    const questionsCache = toRecord(mergedPorts.readQuestionsCache(questionSourceSlug));
    snapshotResult = buildResultsAnalysisBrowserSnapshotFromCacheNode({
      networkNode: questionsCache[cacheScope],
      sessionSlug: normalizedSlug,
    });
    if (snapshotResult.ok && sessionId) {
      snapshotResult.snapshot = { ...snapshotResult.snapshot, sessionId } as typeof snapshotResult.snapshot;
    }
  }

  return {
    capability,
    isWorkerCanonical,
    sessionId,
    sessionSlug: normalizedSlug,
    sourceKind,
    snapshotResult,
    unsupportedReason: workerUrl
      ? !isWorkerCanonical && !snapshotResult?.ok
        ? snapshotResult?.reason || 'Submitted-response cache is not ready for browser snapshot generation.'
        : ''
      : 'Generated AI views need a configured session Worker.',
    workerUrl,
  };
};

const preserveViewerArtifactOnAdminAuthFailure = ({
  fallbackBody,
  previousStatusBody,
}: {
  fallbackBody: unknown;
  previousStatusBody: unknown;
}): UnknownRecord => {
  const previous = toRecord(previousStatusBody);
  const previousState = toRecord(previous.state);
  const previousLastGood = toRecord(previousState.lastGood);
  const hasViewerArtifact = previous.viewerAuthorized === true && !!toRecord(previousLastGood.artifact).kind;
  if (!hasViewerArtifact) return toRecord(fallbackBody);
  return {
    ...previous,
    ok: true,
    adminAuthorized: false,
    viewerAuthorized: true,
    capability: {
      ...toRecord(previous.capability),
      manual: {
        ...toRecord(toRecord(previous.capability).manual),
        supported: false,
        reason: readErrorMessage(fallbackBody, 'Authenticate with the session Worker to refresh generated views.'),
      },
    },
    state: {
      ...previousState,
      active: null,
      jobState: 'idle',
      lastFailure: {
        error: readErrorMessage(fallbackBody, 'Authenticate with the session Worker to refresh generated views.'),
      },
      lastGood: previousState.lastGood,
    },
  };
};

const normalizeArtifactResponseBody = ({
  artifactBody,
  previousStatusBody,
}: {
  artifactBody: unknown;
  previousStatusBody: unknown;
}): UnknownRecord => {
  const body = toRecord(artifactBody);
  if (body.ok === false) return body;
  const previous = toRecord(previousStatusBody);
  const bodyState: UnknownRecord = { ...toRecord(body.state), ...(body.jobState ? { jobState: body.jobState } : {}) };
  const stateLastGood = toRecord(bodyState.lastGood);
  const draft = toRecord(body.draft);
  const artifact = toRecord(body.artifact);
  const lastGood =
    stateLastGood.kind || stateLastGood.artifact
      ? stateLastGood
      : draft.artifact
        ? draft
        : artifact.kind
          ? {
              draftId: body.draftId || body.requestId || '',
              generatedAt: body.generatedAt || artifact.generatedAt || '',
              source: body.source || {},
              artifact,
              snapshot: body.snapshot || {},
            }
          : {};
  return {
    ...previous,
    ok: true,
    pollExpired: false,
    adminAuthorized: previous.adminAuthorized === true,
    viewerAuthorized: true,
    settings: body.settings || previous.settings,
    capability: previous.capability || {
      manual: { supported: false, reason: 'Sign in as an admin to generate or refresh.' },
    },
    state: {
      ...toRecord(previous.state),
      ...bodyState,
      jobState: toText(bodyState.jobState || 'succeeded'),
      active: null,
      lastFailure: null,
      lastGood,
    },
  };
};

const normalizePendingArtifactResponseBody = ({
  artifactBody,
  previousStatusBody,
  sessionConfig,
}: {
  artifactBody: unknown;
  previousStatusBody: unknown;
  sessionConfig: UnknownRecord;
}): UnknownRecord => {
  const body = toRecord(artifactBody);
  const previous = toRecord(previousStatusBody);
  const previousState = toRecord(previous.state);
  const bodyState: UnknownRecord = { ...toRecord(body.state), ...(body.jobState ? { jobState: body.jobState } : {}) };
  const jobState = toText(bodyState.jobState || 'queued') || 'queued';
  return {
    ...previous,
    ok: true,
    pollExpired: false,
    adminAuthorized: previous.adminAuthorized === true,
    viewerAuthorized: true,
    settings: body.settings || previous.settings || toRecord(sessionConfig).resultsAnalysis,
    capability: previous.capability || {
      manual: { supported: false, reason: 'Sign in as an admin to generate or refresh.' },
    },
    state: {
      ...previousState,
      ...bodyState,
      jobState,
      active: bodyState.active || previousState.active || { requestId: body.requestId || 'viewer-artifact-pending' },
      lastFailure: null,
      lastGood: bodyState.lastGood || previousState.lastGood || null,
    },
  };
};

const markGeneratedResultsPollExpired = ({
  host,
  previousStatusBody,
  resultDraft,
}: {
  host: OnePageGeneratedResultsHost;
  previousStatusBody: unknown;
  resultDraft: unknown;
}): void => {
  const previous = toRecord(previousStatusBody);
  const previousState = toRecord(previous.state);
  applyGeneratedResultsStatusBody(
    host,
    {
      ...previous,
      ok: true,
      pollExpired: true,
      state: {
        ...previousState,
        active: null,
        jobState: 'idle',
        lastFailure: null,
        lastGood: previousState.lastGood || null,
      },
    },
    resultDraft,
  );
};

const normalizeTransientStatusFailureBody = ({
  failureBody,
  previousStatusBody,
}: {
  failureBody: unknown;
  previousStatusBody: unknown;
}): UnknownRecord => {
  const previous = toRecord(previousStatusBody);
  const previousState = toRecord(previous.state);
  return {
    ...previous,
    ok: true,
    pollExpired: false,
    state: {
      ...previousState,
      active: null,
      jobState: 'idle',
      lastFailure: { error: readErrorMessage(failureBody, 'Generated results status refresh failed.') },
      lastGood: previousState.lastGood || null,
    },
  };
};

export const resetGeneratedResultsAnalysis = (host: OnePageGeneratedResultsHost): void => {
  host._generatedResultsRequestSeq = Number(host._generatedResultsRequestSeq || 0) + 1;
  host.setState({
    generatedResultsAnalysis: buildInitialGeneratedResultsControllerState(),
    generatedResultsStatusBody: null,
  });
};

export const buildGeneratedResultsIdentityForHost = (
  host: OnePageGeneratedResultsHost,
  runtime: Pick<GeneratedResultsRuntime, 'sessionId' | 'sessionSlug' | 'workerUrl'>,
  sessionConfig: UnknownRecord,
): string =>
  buildGeneratedResultsIdentityKey({
    account: host.props.account,
    loginComplete: host.props.loginComplete,
    sessionConfig,
    sessionId: runtime.sessionId,
    sessionSlug: runtime.sessionSlug,
    workerUrl: runtime.workerUrl,
  });

export const authorizeGeneratedResultsForHost = async (
  host: OnePageGeneratedResultsHost,
  { ports = defaultPorts }: { ports?: Partial<RuntimePorts> } = {},
): Promise<void> => {
  const mergedPorts = { ...defaultPorts, ...ports };
  const sessionConfig = host.resolveCurrentSessionConfig();
  const runtime = resolveGeneratedResultsRuntime(host, {
    ports,
    sessionConfig,
    sessionSlug: host.resolveCurrentSessionSlug(),
  });
  if (!runtime.workerUrl) {
    const body = { ok: false, unsupported: true, error: runtime.unsupportedReason };
    host.setState({
      generatedResultsStatusBody: body,
      generatedResultsAnalysis: resolveGeneratedResultsControllerState({ statusBody: body }),
    });
    return;
  }

  const requestSeq = Number(host._generatedResultsRequestSeq || 0) + 1;
  host._generatedResultsRequestSeq = requestSeq;
  host.setState({
    generatedResultsAnalysis: {
      ...(host.state.generatedResultsAnalysis || buildInitialGeneratedResultsControllerState()),
      status: 'loading',
      statusLabel: 'Checking generated AI views…',
      error: '',
    },
  });
  const body = await (mergedPorts.readStatus || readSessionResultsAnalysisStatus)({
    account: host.props.account,
    chainId: readChainId(host, sessionConfig),
    provider: host.props.provider,
    sessionConfig,
    sessionSlug: runtime.sessionSlug,
    sessionId: runtime.sessionId,
    workerUrl: runtime.workerUrl,
  });
  if (requestSeq !== host._generatedResultsRequestSeq) return;
  const nextBody = isAuthFailureStatus(body)
    ? preserveViewerArtifactOnAdminAuthFailure({
        fallbackBody: body,
        previousStatusBody: host.state.generatedResultsStatusBody,
      })
    : body;
  applyGeneratedResultsStatusBody(host, nextBody, toRecord(toRecord(nextBody).state).lastGood);
  if (isRunningJobStatus(nextBody)) {
    await pollGeneratedResultsStatusForHost({ host, mergedPorts, requestSeq, runtime, sessionConfig });
  }
};

const enabledSectionsFromStatus = (statusBody: unknown): string[] => {
  const settings = toRecord(toRecord(statusBody).settings);
  const views = toRecord(settings.views);
  const out = [];
  if (views.circles !== false) out.push('circles');
  if (views.breakdown !== false) out.push('breakdown');
  if (views.riskMatrix !== false) out.push('riskMatrix');
  return out;
};

const applyGeneratedResultsStatusBody = (
  host: OnePageGeneratedResultsHost,
  statusBody: unknown,
  resultDraft: unknown,
): void => {
  const nextControllerState = resolveGeneratedResultsControllerState({
    previousSelectedView: host.state.resultsViewMode,
    statusBody,
  });
  host.setState({
    generatedResultsStatusBody: statusBody,
    generatedResultsAnalysis: nextControllerState,
    resultsViewMode: resultDraft ? nextControllerState.selectedView : host.state.resultsViewMode,
  });
};

const pollGeneratedResultsStatusForHost = async ({
  host,
  mergedPorts,
  requestSeq,
  runtime,
  sessionConfig,
}: {
  host: OnePageGeneratedResultsHost;
  mergedPorts: RuntimePorts;
  requestSeq: number;
  runtime: GeneratedResultsRuntime;
  sessionConfig: UnknownRecord;
}): Promise<void> => {
  const attempts = Math.max(0, Number(mergedPorts.pollAttempts ?? defaultPorts.pollAttempts) || 0);
  const intervalMs = Math.max(0, Number(mergedPorts.pollIntervalMs ?? defaultPorts.pollIntervalMs) || 0);
  for (let index = 0; index < attempts; index += 1) {
    if (intervalMs > 0) await (mergedPorts.sleep || defaultPorts.sleep || (() => Promise.resolve()))(intervalMs);
    if (requestSeq !== host._generatedResultsRequestSeq) return;
    const body = await (mergedPorts.readStatus || readSessionResultsAnalysisStatus)({
      account: host.props.account,
      chainId: readChainId(host, sessionConfig),
      provider: host.props.provider,
      sessionConfig,
      sessionSlug: runtime.sessionSlug,
      sessionId: runtime.sessionId,
      workerUrl: runtime.workerUrl,
    });
    if (requestSeq !== host._generatedResultsRequestSeq) return;
    const nextBody = isAuthFailureStatus(body)
      ? preserveViewerArtifactOnAdminAuthFailure({
          fallbackBody: body,
          previousStatusBody: host.state.generatedResultsStatusBody,
        })
      : toRecord(body).ok === false
        ? normalizeTransientStatusFailureBody({
            failureBody: body,
            previousStatusBody: host.state.generatedResultsStatusBody,
          })
        : body;
    applyGeneratedResultsStatusBody(host, nextBody, toRecord(toRecord(nextBody).state).lastGood);
    if (isAuthFailureStatus(body)) return;
    if (!isRunningJobStatus(nextBody)) return;
  }
  if (requestSeq !== host._generatedResultsRequestSeq) return;
  markGeneratedResultsPollExpired({
    host,
    previousStatusBody: host.state.generatedResultsStatusBody,
    resultDraft: toRecord(toRecord(host.state.generatedResultsStatusBody).state).lastGood,
  });
};

const pollGeneratedResultsArtifactForHost = async ({
  host,
  mergedPorts,
  requestSeq,
  runtime,
  sessionConfig,
}: {
  host: OnePageGeneratedResultsHost;
  mergedPorts: RuntimePorts;
  requestSeq: number;
  runtime: GeneratedResultsRuntime;
  sessionConfig: UnknownRecord;
}): Promise<void> => {
  const attempts = Math.max(0, Number(mergedPorts.pollAttempts ?? defaultPorts.pollAttempts) || 0);
  const intervalMs = Math.max(0, Number(mergedPorts.pollIntervalMs ?? defaultPorts.pollIntervalMs) || 0);
  for (let index = 0; index < attempts; index += 1) {
    if (intervalMs > 0) await (mergedPorts.sleep || defaultPorts.sleep || (() => Promise.resolve()))(intervalMs);
    if (requestSeq !== host._generatedResultsRequestSeq) return;
    const artifactBody = await (mergedPorts.readArtifact || readSessionResultsAnalysisArtifact)({
      account: host.props.account,
      includeSnapshot: true,
      sessionSlug: runtime.sessionSlug,
      sessionId: runtime.sessionId,
      workerUrl: runtime.workerUrl,
    });
    if (requestSeq !== host._generatedResultsRequestSeq) return;
    if (artifactBody.ok === true) {
      const previousStatusBody = toRecord(host.state.generatedResultsStatusBody);
      const statusBody = normalizeArtifactResponseBody({
        artifactBody,
        previousStatusBody: previousStatusBody.settings
          ? previousStatusBody
          : { ...previousStatusBody, settings: toRecord(sessionConfig).resultsAnalysis },
      });
      applyGeneratedResultsStatusBody(host, statusBody, toRecord(toRecord(statusBody).state).lastGood);
      if (!isRunningJobStatus(statusBody)) return;
      continue;
    }
    if (isAuthFailureStatus(artifactBody)) {
      applyGeneratedResultsStatusBody(host, artifactBody, null);
      return;
    }
    if (!isRunningJobStatus(artifactBody)) {
      markGeneratedResultsPollExpired({
        host,
        previousStatusBody: host.state.generatedResultsStatusBody,
        resultDraft: toRecord(toRecord(host.state.generatedResultsStatusBody).state).lastGood,
      });
      return;
    }
    const pendingStatusBody = normalizePendingArtifactResponseBody({
      artifactBody,
      previousStatusBody: host.state.generatedResultsStatusBody,
      sessionConfig,
    });
    applyGeneratedResultsStatusBody(host, pendingStatusBody, toRecord(toRecord(pendingStatusBody).state).lastGood);
  }
  if (requestSeq !== host._generatedResultsRequestSeq) return;
  markGeneratedResultsPollExpired({
    host,
    previousStatusBody: host.state.generatedResultsStatusBody,
    resultDraft: toRecord(toRecord(host.state.generatedResultsStatusBody).state).lastGood,
  });
};

export const loadGeneratedResultsArtifactForHost = async (
  host: OnePageGeneratedResultsHost,
  { ports = defaultPorts }: { ports?: Partial<RuntimePorts> } = {},
): Promise<void> => {
  const mergedPorts = { ...defaultPorts, ...ports };
  const sessionConfig = host.resolveCurrentSessionConfig();
  const runtime = resolveGeneratedResultsRuntime(host, {
    ports: { ...ports, readQuestionsCache: () => ({}) },
    sessionConfig,
    sessionSlug: host.resolveCurrentSessionSlug(),
  });
  if (!runtime.workerUrl) return;
  const requestSeq = Number(host._generatedResultsRequestSeq || 0) + 1;
  host._generatedResultsRequestSeq = requestSeq;
  const artifactBody = await (mergedPorts.readArtifact || readSessionResultsAnalysisArtifact)({
    account: host.props.account,
    includeSnapshot: true,
    sessionSlug: runtime.sessionSlug,
    sessionId: runtime.sessionId,
    workerUrl: runtime.workerUrl,
  });
  if (requestSeq !== host._generatedResultsRequestSeq) return;
  if (artifactBody.ok !== true) {
    if (isAuthFailureStatus(artifactBody)) {
      applyGeneratedResultsStatusBody(host, artifactBody, null);
      return;
    }
    if (isRunningJobStatus(artifactBody)) {
      const pendingStatusBody = normalizePendingArtifactResponseBody({
        artifactBody,
        previousStatusBody: host.state.generatedResultsStatusBody,
        sessionConfig,
      });
      applyGeneratedResultsStatusBody(host, pendingStatusBody, toRecord(toRecord(pendingStatusBody).state).lastGood);
      await pollGeneratedResultsArtifactForHost({ host, mergedPorts, requestSeq, runtime, sessionConfig });
      return;
    }
    markGeneratedResultsPollExpired({
      host,
      previousStatusBody: host.state.generatedResultsStatusBody,
      resultDraft: toRecord(toRecord(host.state.generatedResultsStatusBody).state).lastGood,
    });
    return;
  }
  const previousStatusBody = toRecord(host.state.generatedResultsStatusBody);
  const statusBody = normalizeArtifactResponseBody({
    artifactBody,
    previousStatusBody: previousStatusBody.settings
      ? previousStatusBody
      : { ...previousStatusBody, settings: toRecord(sessionConfig).resultsAnalysis },
  });
  applyGeneratedResultsStatusBody(host, statusBody, toRecord(toRecord(statusBody).state).lastGood);
  if (isRunningJobStatus(statusBody)) {
    await pollGeneratedResultsArtifactForHost({ host, mergedPorts, requestSeq, runtime, sessionConfig });
  }
};

export const generateResultsForHost = async (
  host: OnePageGeneratedResultsHost,
  { ports = defaultPorts, refresh = true }: { ports?: Partial<RuntimePorts>; refresh?: boolean } = {},
): Promise<void> => {
  const mergedPorts = { ...defaultPorts, ...ports };
  const current = host.state.generatedResultsAnalysis;
  if (current?.isRunning) return;
  const sessionConfig = host.resolveCurrentSessionConfig();
  const runtime = resolveGeneratedResultsRuntime(host, {
    ports,
    sessionConfig,
    sessionSlug: host.resolveCurrentSessionSlug(),
  });
  if (!runtime.workerUrl || (runtime.sourceKind === 'admin-snapshot' && !runtime.snapshotResult?.ok)) {
    const body = { ok: false, unsupported: true, error: runtime.unsupportedReason };
    host.setState({
      generatedResultsStatusBody: body,
      generatedResultsAnalysis: resolveGeneratedResultsControllerState({ statusBody: body }),
    });
    return;
  }

  const previousStatusBody = toRecord(host.state.generatedResultsStatusBody);
  const requestSeq = Number(host._generatedResultsRequestSeq || 0) + 1;
  host._generatedResultsRequestSeq = requestSeq;
  const requestId = `manual:${mergedPorts.randomUUID?.() || defaultPorts.randomUUID?.()}`;
  const source: UnknownRecord = { kind: 'worker-canonical' };
  if (runtime.sourceKind === 'admin-snapshot') {
    const snapshotResult = runtime.snapshotResult;
    if (!snapshotResult?.ok) return;
    source.kind = 'admin-snapshot';
    source.snapshot = snapshotResult.snapshot;
  }
  const requestBody: UnknownRecord = {
    sessionSlug: runtime.sessionSlug,
    requestId,
    refresh: refresh === true,
    sections: enabledSectionsFromStatus(previousStatusBody),
    source,
  };
  host.setState({
    generatedResultsAnalysis: {
      ...(current || buildInitialGeneratedResultsControllerState()),
      isRunning: true,
      status: 'running',
      statusLabel: refresh ? 'Refreshing generated views…' : 'Generating views…',
      error: '',
    },
  });
  const chainId = readChainId(host, sessionConfig);
  const result: UnknownRecord = await (mergedPorts.startGeneration || startSessionResultsAnalysisGeneration)({
    body: requestBody,
    chainId,
    signAdminAction: ({ action, body, workerUrl }) =>
      adminWorkerPorts.adminAuth.buildSignedAdminActionAuth({
        action,
        slug: runtime.sessionSlug,
        sessionId: runtime.sessionId || undefined,
        sessionAuthorityMode: toText(toRecord(toRecord(sessionConfig.sessionModeProfile).authority).mode) || undefined,
        body,
        workerUrl,
        context: {
          account: host.props.account,
          chainId,
          providerLike: host.props.provider,
        },
      }),
    workerUrl: runtime.workerUrl,
  }).catch((error) => ({
    ok: false,
    status: readErrorStatus(error),
    error: error instanceof Error ? error.message : 'Generated results request failed.',
  }));
  if (requestSeq !== host._generatedResultsRequestSeq) return;

  const previousState = toRecord(previousStatusBody.state);
  const transientFailure = result.ok === false;
  if (isAuthFailureStatus(result)) {
    const authFailureBody = {
      ok: false,
      status: toStatusCode(result),
      adminAuthorized: false,
      error: readErrorMessage(result, 'Generated results authorization expired.'),
    };
    const nextBody = preserveViewerArtifactOnAdminAuthFailure({
      fallbackBody: authFailureBody,
      previousStatusBody,
    });
    applyGeneratedResultsStatusBody(host, nextBody, toRecord(toRecord(nextBody).state).lastGood);
    return;
  }
  const nextStatusBody = {
    ...previousStatusBody,
    ok: true,
    adminAuthorized: true,
    capability: result.capability || previousStatusBody.capability,
    state: {
      ...previousState,
      active: isRunningJobStatus(result) ? result.reservation || previousState.active || { requestId } : null,
      jobState: result.jobState || (transientFailure ? 'failed' : 'succeeded'),
      lastFailure: transientFailure ? { error: result.error || 'Generated results request failed.' } : null,
      lastGood: result.draft || previousState.lastGood || null,
    },
  };
  applyGeneratedResultsStatusBody(host, nextStatusBody, result.draft);
  if (
    (result.jobState === 'running' || result.jobState === 'queued' || toStatusCode(result) === 202) &&
    !transientFailure
  ) {
    await pollGeneratedResultsStatusForHost({ host, mergedPorts, requestSeq, runtime, sessionConfig });
  }
};
