import { toStr } from '../shared/primitives.js';
import { normalizeWorkerUrl } from './workerUrl';

export const ADMIN_ACTION_NONCE_RETRY_ATTEMPTS = 3;

export type AdminSignedWorkerRequestArgs = {
  action?: string;
  body?: Record<string, unknown>;
  path?: string;
  chainId?: unknown;
  workerUrl?: unknown;
  retryAttempts?: number;
};

type AdminActionSigner = (args: {
  action: string;
  body: Record<string, unknown>;
  chainId: unknown;
  workerUrl: string;
}) => Promise<Record<string, unknown>>;

type AdminSignedWorkerRequestRuntime = AdminSignedWorkerRequestArgs & {
  signAdminAction: AdminActionSigner;
  fetchImpl?: typeof fetch;
  sleepImpl?: typeof sleep;
};

const getCurrentOrigin = (): string => {
  try {
    return typeof window !== 'undefined' ? toStr(window.location?.origin).trim() : '';
  } catch (_) {
    return '';
  }
};

const buildAdminWorkerCorsMessage = (workerBase: unknown, detail: unknown = ''): string => {
  const origin = getCurrentOrigin() || '<current-origin>';
  const worker = toStr(workerBase).trim() || 'session worker';
  const suffix = detail ? ` (${toStr(detail)})` : '';
  return `Worker request could not reach ${worker}${suffix}. This is usually CORS or worker availability; ensure ${origin} is in that worker session's allowOrigins. If this session still resolves an older worker URL, finish deploy/config sync or edit the worker URL override first.`;
};

const normalizeAdminWorkerFetchError = ({
  error,
  workerBase,
  responseStatus = 0,
  responseError = '',
}: {
  error?: unknown;
  workerBase?: unknown;
  responseStatus?: unknown;
  responseError?: unknown;
} = {}): string => {
  const message =
    error && typeof error === 'object' && 'message' in error ? (error as { message?: unknown }).message : undefined;
  const raw = toStr(message || error).trim();
  const lowered = raw.toLowerCase();
  const detail = toStr(responseError).trim();
  const detailLower = detail.toLowerCase();
  if (
    (Number(responseStatus || 0) === 403 && detailLower.includes('origin')) ||
    detailLower.includes('origin not allowed')
  ) {
    return buildAdminWorkerCorsMessage(workerBase, detail || 'Origin not allowed');
  }
  if (lowered.includes('origin not allowed')) {
    return buildAdminWorkerCorsMessage(workerBase, raw);
  }
  if (lowered.includes('failed to fetch') || lowered.includes('networkerror')) {
    return buildAdminWorkerCorsMessage(workerBase);
  }
  return raw || 'Failed to update worker allowOrigins.';
};

const isRetryableAdminNonceFailure = ({
  responseStatus = 0,
  responseError = '',
}: {
  responseStatus?: unknown;
  responseError?: unknown;
} = {}): boolean => {
  const status = Number(responseStatus || 0);
  const detail = toStr(responseError).trim().toLowerCase();
  if (status !== 400 || !detail) return false;
  return detail.includes('nonce mismatch or expired') || detail.includes('nonce already used');
};

export const sleep = (ms: unknown): Promise<void> => new Promise((resolve) => setTimeout(resolve, Number(ms || 0)));

export const postSignedAdminWorkerRequest = async ({
  action = 'set-config',
  body = {},
  path = '',
  chainId = null,
  workerUrl,
  retryAttempts = ADMIN_ACTION_NONCE_RETRY_ATTEMPTS,
  signAdminAction,
  fetchImpl = fetch,
  sleepImpl = sleep,
}: AdminSignedWorkerRequestRuntime) => {
  const baseUrl = normalizeWorkerUrl(workerUrl);
  if (!baseUrl) throw new Error('Worker URL is missing.');

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    const auth = await signAdminAction({ action, body, chainId, workerUrl: baseUrl });
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ...auth }),
      });
    } catch (error) {
      throw new Error(normalizeAdminWorkerFetchError({ error, workerBase: baseUrl }));
    }

    const data = await response.json().catch(() => ({}));
    if (response.ok) return { baseUrl, response, data };

    const responseError = data?.error || '';
    if (attempt < retryAttempts && isRetryableAdminNonceFailure({ responseStatus: response.status, responseError })) {
      await sleepImpl(250 * attempt);
      continue;
    }

    lastError = new Error(
      normalizeAdminWorkerFetchError({
        error: responseError || `Request failed (${response.status}).`,
        workerBase: baseUrl,
        responseStatus: response.status,
        responseError,
      }),
    );
    Object.assign(lastError, {
      status: response.status,
      reason: typeof data?.reason === 'string' ? data.reason : '',
    });
    throw lastError;
  }

  throw lastError || new Error(`Failed admin action: ${action}`);
};
