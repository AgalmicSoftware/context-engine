import { toStr } from '../shared/primitives.js';
import { normalizeWorkerUrl } from './workerUrl.js';

const DEFAULT_LOCAL_ADMIN_ORIGIN = 'http://localhost:3000';

const WORKER_AUTH_FETCH_ERROR_PATTERNS = [
  'failed to fetch',
  'network request failed',
  'networkerror',
  'load failed',
  'fetch failed',
];

export const normalizeOrigin = (value: unknown): string => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if ((parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && !parsed.port) {
      return DEFAULT_LOCAL_ADMIN_ORIGIN;
    }
    return parsed.origin;
  } catch {
    return '';
  }
};

export const isWorkerAuthFetchReachabilityError = (error: unknown): boolean => {
  const message = toStr((error as { message?: unknown })?.message || error)
    .trim()
    .toLowerCase();
  if (!message || message.includes('failed to reach worker auth endpoint')) return false;
  return WORKER_AUTH_FETCH_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

export const buildWorkerAuthReachabilityMessage = (endpoint: unknown): string => {
  const normalizedEndpoint = toStr(endpoint).trim();
  const browserOrigin = (() => {
    try {
      if (typeof window !== 'undefined') return normalizeOrigin(window.location?.origin);
    } catch (_) {}
    return '';
  })();
  const allowOriginsHint = browserOrigin ? ` Check worker URL and allowOrigins includes ${browserOrigin}.` : '';
  return `Failed to reach worker auth endpoint (${normalizedEndpoint}).${allowOriginsHint}`;
};

export const normalizeWorkerAuthFetchError = (error: unknown, endpoint: unknown): unknown => {
  if (!isWorkerAuthFetchReachabilityError(error)) return error;
  const normalized = new Error(buildWorkerAuthReachabilityMessage(endpoint));
  try {
    (normalized as Error & { cause?: unknown }).cause = error;
  } catch (_) {}
  return normalized;
};

export const fetchWorkerAuthEndpoint = async (endpoint: string, init?: RequestInit): Promise<Response> => {
  try {
    return await fetch(endpoint, init);
  } catch (error) {
    throw normalizeWorkerAuthFetchError(error, endpoint);
  }
};

export const resolveAdminActionAudience = (workerUrl: unknown): string => {
  const browserOrigin = (() => {
    try {
      if (typeof window !== 'undefined') return normalizeOrigin(window.location?.origin);
    } catch (_) {}
    return '';
  })();
  if (browserOrigin) return browserOrigin;
  return normalizeOrigin(normalizeWorkerUrl(workerUrl));
};
