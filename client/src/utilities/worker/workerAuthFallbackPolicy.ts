import { createLogger } from '../logging.js';
import { toStr } from '../shared/primitives.js';

const accountLog = createLogger('account');

const AUTH_OR_GATE_DENIAL_PATTERNS = [
  /missing authorization header/i,
  /missing requester address for worker sbt gate/i,
  /token missing .* scope/i,
  /token does not match requested session slug/i,
  /token expired/i,
];

const AUTHENTICATED_RETRY_DENIAL_PATTERNS = [
  /missing authorization header/i,
  /token does not match requested session slug/i,
  /token expired/i,
  /invalid token/i,
];

type WorkerAuthTextResponse = {
  status?: number | string;
  clone?: () => {
    text?: () => Promise<string> | string;
  };
};

const shouldFallbackForAnonymousDeny = (normalizedError: unknown): boolean => {
  const msg = toStr(normalizedError).trim().toLowerCase();
  if (!msg.includes('anonymous access denied')) return false;
  return true;
};

export const readRequestApiKey = (body: unknown): string => {
  if (!body) return '';
  try {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      return toStr(body.get('apiKey')).trim();
    }
  } catch (_) {}
  try {
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
      return toStr(body.get('apiKey')).trim();
    }
  } catch (_) {}

  if (typeof body === 'string') {
    const raw = body.trim();
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      return toStr(parsed?.apiKey).trim();
    } catch (e) {
      accountLog.warn('workerAuth: JSON parse failed', e);
      return '';
    }
  }

  if (typeof body === 'object') {
    return toStr((body as { apiKey?: unknown })?.apiKey).trim();
  }
  return '';
};

export const parseErrorMessage = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return '';
  const value = payload as {
    error?: string | { message?: string };
    message?: string;
  };
  const direct = typeof value.error === 'string' ? value.error : '';
  const nested =
    value.error && typeof value.error === 'object' && typeof value.error.message === 'string'
      ? value.error.message
      : '';
  const message = typeof value.message === 'string' ? value.message : '';
  return toStr(direct || nested || message).trim();
};

export const readResponseErrorMessage = async (response?: WorkerAuthTextResponse | null): Promise<string> => {
  if (!response || typeof response.clone !== 'function') return '';
  let text = '';
  try {
    const cloned = response.clone();
    text = toStr(typeof cloned.text === 'function' ? await cloned.text() : '');
  } catch {
    return '';
  }
  const trimmed = toStr(text).trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed);
    return parseErrorMessage(parsed) || trimmed;
  } catch (e) {
    accountLog.warn('workerAuth: JSON parse failed', e);
    return trimmed;
  }
};

export const shouldFallbackToAuthenticatedFlow = async (
  response?: WorkerAuthTextResponse | null,
  { requestApiKey = '', fallbackOnGateUnavailable = false } = {},
): Promise<boolean> => {
  const status = Number(response?.status || 0);
  const errorMessage = await readResponseErrorMessage(response);
  if (!errorMessage) return false;
  const normalizedError = toStr(errorMessage).trim().toLowerCase();
  if (normalizedError.includes('on-chain gate data unavailable')) {
    return fallbackOnGateUnavailable === true;
  }
  if (status === 429 && (normalizedError === 'rate limit exceeded.' || normalizedError === 'rate limit exceeded')) {
    if (toStr(requestApiKey).trim()) return false;
    return true;
  }
  if (status !== 401 && status !== 403) return false;
  // Private storage's structured denial needs a signed principal before its
  // rules can be evaluated. Other rule failures must not prompt another login.
  try {
    const body = JSON.parse(toStr(await response?.clone?.().text?.()));
    if (body?.reason === 'missing_principal' || body?.reason === 'private_response_owner_required') return true;
  } catch (_) {}
  if (shouldFallbackForAnonymousDeny(normalizedError)) {
    return true;
  }
  return AUTH_OR_GATE_DENIAL_PATTERNS.some((pattern) => pattern.test(errorMessage));
};

export const shouldRetryAuthenticatedResponse = async (response?: WorkerAuthTextResponse | null): Promise<boolean> => {
  const status = Number(response?.status || 0);
  if (status === 401) return true;
  if (status !== 403) return false;
  const errorMessage = await readResponseErrorMessage(response);
  if (!errorMessage) return false;
  return AUTHENTICATED_RETRY_DENIAL_PATTERNS.some((pattern) => pattern.test(errorMessage));
};

// Tokens carry the scopes granted at sign-in, so this denial is final only for
// a token issued after access last changed; the caller decides which applies.
export const isTokenScopeDenialResponse = async (response?: WorkerAuthTextResponse | null): Promise<boolean> =>
  Number(response?.status || 0) === 403 && /token missing .* scope/i.test(await readResponseErrorMessage(response));
