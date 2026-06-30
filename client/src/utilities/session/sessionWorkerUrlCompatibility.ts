import type { SessionConfigLike } from './sessionTypes.js';

const hasOwn = (value: unknown, key: string): boolean => (
  Object.prototype.hasOwnProperty.call(value || {}, key)
);

export const SESSION_WORKER_URL_COMPATIBILITY_KEYS = Object.freeze([
  'corsWorkerURL',
  'CorsWorkerURL',
  'workerUrl',
  'sessionCorsWorkerUrl',
  'sessionWorkerUrl',
  'sessionWorkerURL',
  'workerURL',
] as const);

export const SESSION_WORKER_METADATA_ALIAS_KEYS = Object.freeze([
  'rpcUrl',
  ...SESSION_WORKER_URL_COMPATIBILITY_KEYS,
] as const);

export const readConfiguredSessionWorkerUrlCandidate = (
  sessionConfig: unknown = null
): unknown => {
  if (!sessionConfig || typeof sessionConfig !== 'object' || Array.isArray(sessionConfig)) {
    return undefined;
  }
  const source = sessionConfig as SessionConfigLike;
  if (hasOwn(source, 'corsWorkerUrl')) return source.corsWorkerUrl;
  for (const key of SESSION_WORKER_URL_COMPATIBILITY_KEYS) {
    if (hasOwn(source, key)) return source[key];
  }
  return undefined;
};
