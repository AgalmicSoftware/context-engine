import { toStr } from '../../utilities/shared/primitives.js';

export const ADMIN_ACTION_NONCE_RETRY_ATTEMPTS = 3;

export type NormalizeAdminWorkerFetchErrorArgs = {
  error?: unknown;
  workerBase?: unknown;
  responseStatus?: unknown;
  responseError?: unknown;
};

export type RetryableAdminNonceFailureArgs = {
  responseStatus?: unknown;
  responseError?: unknown;
};

export const getCurrentOrigin = (): string => {
  try {
    return typeof window !== 'undefined' ? toStr(window.location?.origin).trim() : '';
  } catch (_) {
    return '';
  }
};

export const buildAdminWorkerCorsMessage = (workerBase: unknown, detail: unknown = ''): string => {
  const origin = getCurrentOrigin() || '<current-origin>';
  const worker = toStr(workerBase).trim() || 'session worker';
  const suffix = detail ? ` (${toStr(detail)})` : '';
  return `Worker request could not reach ${worker}${suffix}. This is usually CORS or worker availability; ensure ${origin} is in that worker session's allowOrigins. If this session still resolves an older worker URL, finish deploy/config sync or edit the worker URL override first.`;
};

export const normalizeAdminWorkerFetchError = ({
  error,
  workerBase,
  responseStatus = 0,
  responseError = '',
}: NormalizeAdminWorkerFetchErrorArgs = {}): string => {
  const message = error && typeof error === 'object' && 'message' in error
    ? (error as { message?: unknown }).message
    : undefined;
  const raw = toStr(message || error).trim();
  const lowered = raw.toLowerCase();
  const detail = toStr(responseError).trim();
  const detailLower = detail.toLowerCase();
  if ((Number(responseStatus || 0) === 403 && detailLower.includes('origin')) || detailLower.includes('origin not allowed')) {
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

export const isRetryableAdminNonceFailure = ({
  responseStatus = 0,
  responseError = '',
}: RetryableAdminNonceFailureArgs = {}): boolean => {
  const status = Number(responseStatus || 0);
  const detail = toStr(responseError).trim().toLowerCase();
  if (status !== 400 || !detail) return false;
  return detail.includes('nonce mismatch or expired') || detail.includes('nonce already used');
};

export const sleep = (ms: unknown): Promise<void> => new Promise((resolve) => setTimeout(resolve, Number(ms || 0)));
