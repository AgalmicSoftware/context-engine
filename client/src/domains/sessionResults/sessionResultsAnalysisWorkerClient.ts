import { postSignedAdminWorkerRequest } from '../../utilities/worker/signedAdminWorkerRequest';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl';
import { getWorkerAuthHeaders } from '../../utilities/worker/workerAuth';
import { buildTokenCacheKey, readScopedTokenCache } from '../../utilities/worker/workerAuthTokenCache';
import { normalizeAddress } from '../../utilities/web3/addressNormalization';

export type SessionResultsAnalysisStatusRequest = {
  account?: unknown;
  chainId?: unknown;
  fetchImpl?: typeof fetch;
  getAuthHeaders?: typeof getWorkerAuthHeaders;
  includeDraft?: boolean;
  provider?: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  sessionId?: unknown;
  workerUrl?: unknown;
};

export type SessionResultsAnalysisArtifactRequest = {
  account?: unknown;
  fetchImpl?: typeof fetch;
  getCachedAuthHeaders?: typeof getCachedWorkerAuthHeaders;
  includeSnapshot?: boolean;
  sessionSlug?: unknown;
  sessionId?: unknown;
  workerUrl?: unknown;
};

export type SessionResultsAnalysisGenerateRequest = {
  body?: Record<string, unknown>;
  chainId?: unknown;
  fetchImpl?: typeof fetch;
  path?: string;
  signAdminAction: (args: {
    action: string;
    body: Record<string, unknown>;
    chainId: unknown;
    workerUrl: string;
  }) => Promise<Record<string, unknown>>;
  workerUrl?: unknown;
};

const toTrimmedString = (value: unknown): string => (value == null ? '' : String(value).trim());
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const toRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});
const normalizeSessionId = (value: unknown): string =>
  toTrimmedString(value).toLowerCase().replace(/^0x/, '').replace(/-/g, '');

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  const data = await response.json().catch(() => ({}));
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
};

export const buildResultsAnalysisStatusUrl = ({
  includeDraft = true,
  sessionSlug = '',
  workerUrl,
}: {
  includeDraft?: boolean;
  sessionSlug?: unknown;
  sessionId?: unknown;
  workerUrl?: unknown;
} = {}): string => {
  const baseUrl = normalizeWorkerUrl(workerUrl);
  if (!baseUrl) return '';
  const url = new URL(`${baseUrl}/admin/results-analysis/status`);
  const slug = toTrimmedString(sessionSlug);
  if (slug) url.searchParams.set('sessionSlug', slug);
  url.searchParams.set('includeDraft', includeDraft ? 'true' : 'false');
  return url.toString();
};

export const buildResultsAnalysisArtifactUrl = ({
  includeSnapshot = true,
  sessionSlug = '',
  workerUrl,
}: {
  includeSnapshot?: boolean;
  sessionSlug?: unknown;
  sessionId?: unknown;
  workerUrl?: unknown;
} = {}): string => {
  const baseUrl = normalizeWorkerUrl(workerUrl);
  if (!baseUrl) return '';
  const url = new URL(`${baseUrl}/results-analysis/artifact`);
  const slug = toTrimmedString(sessionSlug);
  if (slug) url.searchParams.set('sessionSlug', slug);
  url.searchParams.set('includeSnapshot', includeSnapshot ? 'true' : 'false');
  return url.toString();
};

export const getCachedWorkerAuthHeaders = ({
  account,
  sessionSlug,
  sessionId,
  workerUrl,
}: {
  account?: unknown;
  sessionSlug?: unknown;
  sessionId?: unknown;
  workerUrl?: unknown;
} = {}): Record<string, string> => {
  const baseUrl = normalizeWorkerUrl(workerUrl);
  const address = normalizeAddress(account);
  const slug = toTrimmedString(sessionSlug);
  if (!baseUrl || !address) return {};
  const storageKey = buildTokenCacheKey({ workerUrl: baseUrl, slug, sessionId, address });
  const cached = readScopedTokenCache(storageKey, { workerUrl: baseUrl, sessionId, sessionSlug: slug, address });
  if (!cached?.ok || !cached.token) return {};
  return {
    Authorization: `Bearer ${cached.token}`,
    ...(slug ? { 'X-Group-Slug': slug } : {}),
  };
};

export const readSessionResultsAnalysisStatus = async ({
  account,
  chainId,
  fetchImpl = fetch,
  getAuthHeaders = getWorkerAuthHeaders,
  includeDraft = true,
  provider,
  sessionConfig,
  sessionSlug,
  sessionId,
  workerUrl,
}: SessionResultsAnalysisStatusRequest = {}): Promise<Record<string, unknown>> => {
  const baseUrl = normalizeWorkerUrl(workerUrl);
  if (!baseUrl) {
    return { ok: false, unsupported: true, error: 'Generated AI views need a configured session Worker.' };
  }

  const url = buildResultsAnalysisStatusUrl({ includeDraft, sessionSlug, workerUrl: baseUrl });
  let headers: Record<string, string> = {};
  try {
    headers = await getAuthHeaders({
      sessionSlug,
      sessionConfig,
      workerUrl: baseUrl,
      allowDemoFallback: false,
      context: {
        account,
        chainId,
        providerLike: provider,
      },
    });
  } catch (error) {
    return {
      ok: false,
      authPending: true,
      error:
        error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : 'Authenticate with the session Worker to manage generated views.',
    };
  }

  let response: Response;
  try {
    response = await fetchImpl(url, { method: 'GET', headers });
  } catch (error) {
    return {
      ok: false,
      error:
        error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : 'Generated results status request failed.',
    };
  }

  const data = await readJson(response);
  if (!response.ok) {
    return {
      ...data,
      ok: false,
      status: response.status,
      adminAuthorized: false,
      error: toTrimmedString(data.error) || `Generated results status failed (${response.status}).`,
    };
  }

  const expectedSlug = toTrimmedString(sessionSlug);
  const actualSlug = toTrimmedString(data.sessionSlug);
  const expectedSessionId = normalizeSessionId(sessionId);
  const actualSessionId = normalizeSessionId(data.sessionId || data.sessionIdHex);
  const hasExpectedShape =
    data.ok === true &&
    (!expectedSlug || actualSlug === expectedSlug) &&
    (!expectedSessionId || (actualSessionId && actualSessionId === expectedSessionId)) &&
    isRecord(data.settings) &&
    isRecord(data.capability) &&
    isRecord(data.state);
  if (!hasExpectedShape) {
    return {
      ok: false,
      status: response.status,
      adminAuthorized: false,
      error: 'Generated results status is unavailable from this Worker.',
    };
  }

  return {
    ...data,
    ok: true,
    status: response.status,
    adminAuthorized: true,
  };
};

export const readSessionResultsAnalysisArtifact = async ({
  account,
  fetchImpl = fetch,
  getCachedAuthHeaders = getCachedWorkerAuthHeaders,
  includeSnapshot = true,
  sessionSlug,
  sessionId,
  workerUrl,
}: SessionResultsAnalysisArtifactRequest = {}): Promise<Record<string, unknown>> => {
  const baseUrl = normalizeWorkerUrl(workerUrl);
  if (!baseUrl) {
    return { ok: false, unsupported: true, error: 'Generated AI views need a configured session Worker.' };
  }

  const url = buildResultsAnalysisArtifactUrl({ includeSnapshot, sessionSlug, workerUrl: baseUrl });
  const headers = getCachedAuthHeaders({ account, sessionSlug, sessionId, workerUrl: baseUrl });
  let response: Response;
  try {
    response = await fetchImpl(url, { method: 'GET', headers });
  } catch (error) {
    return {
      ok: false,
      error:
        error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : 'Generated results artifact request failed.',
    };
  }

  const data = await readJson(response);
  if (!response.ok) {
    return {
      ...data,
      ok: false,
      status: response.status,
      viewerAuthorized: false,
      error: toTrimmedString(data.error) || `Generated results artifact failed (${response.status}).`,
    };
  }

  const expectedSlug = toTrimmedString(sessionSlug);
  const actualSlug = toTrimmedString(data.sessionSlug);
  const expectedSessionId = normalizeSessionId(sessionId);
  const actualSessionId = normalizeSessionId(data.sessionId || data.sessionIdHex);
  const jobState = toTrimmedString(data.jobState || toRecord(data.state).jobState).toLowerCase();
  const hasRunningJob = jobState === 'running' || jobState === 'queued';
  const hasArtifact =
    isRecord(data.artifact) || isRecord(data.draft) || isRecord(toRecord(data.state).lastGood) || hasRunningJob;
  const hasExpectedShape =
    data.ok === true &&
    (!expectedSlug || actualSlug === expectedSlug) &&
    (!expectedSessionId || (actualSessionId && actualSessionId === expectedSessionId)) &&
    hasArtifact;
  if (!hasExpectedShape) {
    return {
      ok: false,
      status: response.status,
      viewerAuthorized: false,
      error: 'Generated results artifact is unavailable from this Worker.',
    };
  }

  return {
    ...data,
    ok: true,
    status: response.status,
    viewerAuthorized: true,
  };
};

export const startSessionResultsAnalysisGeneration = async ({
  body = {},
  chainId = null,
  fetchImpl = fetch,
  path = '/admin/results-analysis/generate',
  signAdminAction,
  workerUrl,
}: SessionResultsAnalysisGenerateRequest): Promise<Record<string, unknown>> => {
  if (typeof signAdminAction !== 'function') throw new Error('Generated results signing is unavailable.');
  const result = await postSignedAdminWorkerRequest({
    action: 'results-analysis/generate',
    body,
    chainId,
    fetchImpl,
    path,
    signAdminAction,
    workerUrl,
  });
  const data = result.data && typeof result.data === 'object' ? result.data : {};
  return { ...data, httpStatus: result.response?.status || null };
};
