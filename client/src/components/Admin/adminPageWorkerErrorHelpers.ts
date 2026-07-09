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

export const addSessionConfigHint = (message: unknown): string => {
  const raw = toStr(message).trim();
  if (!raw)
    return 'Worker session config is missing. Run the AI test again as admin to seed it, or re-deploy for this slug.';
  if (!raw.toLowerCase().includes('session config not found')) return raw;
  return `${raw} Re-run this test while connected as the admin wallet to seed worker config, then verify the worker URL and selected session slug match.`;
};

export const shouldSeedWorkerConfigFromError = (message: unknown): boolean => {
  const raw = toStr(message).toLowerCase();
  if (!raw) return false;
  if (raw.includes('session config not found')) return true;
  return false;
};

export type HealthAuthMismatchStateArgs = {
  unauthStatus?: unknown;
  unauthError?: unknown;
  authError?: unknown;
};

export type HealthAuthMismatchState = {
  healthLabel: string;
  statusMessage: string;
};

export const buildHealthAuthMismatchState = ({
  unauthStatus,
  unauthError = '',
  authError = '',
}: HealthAuthMismatchStateArgs = {}): HealthAuthMismatchState | null => {
  const status = Number(unauthStatus || 0) || 0;
  const authMsg = toStr(authError).toLowerCase();
  const unsupportedAuthRoute =
    status > 0 &&
    (status === 401 || status === 403) &&
    (authMsg.includes('worker login failed (404)') || authMsg.includes('worker auth login route not supported'));
  if (!unsupportedAuthRoute) return null;
  const detail = toStr(unauthError).trim();
  const suffix = detail ? `: ${detail}` : '';
  return {
    healthLabel: `Auth required${suffix}; /auth/login unsupported (404)`,
    statusMessage: 'Health endpoint is gated, but this worker URL does not expose /auth/login.',
  };
};
