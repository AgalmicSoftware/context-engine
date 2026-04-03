const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

export const SESSION_WORKER_URL_COMPATIBILITY_KEYS = Object.freeze([
  'corsWorkerURL',
  'CorsWorkerURL',
  'workerUrl',
  'sessionCorsWorkerUrl',
  'sessionWorkerUrl',
  'sessionWorkerURL',
  'workerURL',
]);

export const SESSION_WORKER_METADATA_ALIAS_KEYS = Object.freeze([
  'rpcUrl',
  ...SESSION_WORKER_URL_COMPATIBILITY_KEYS,
]);

export const readConfiguredSessionWorkerUrlCandidate = (sessionConfig = null) => {
  if (!sessionConfig || typeof sessionConfig !== 'object' || Array.isArray(sessionConfig)) {
    return undefined;
  }
  if (hasOwn(sessionConfig, 'corsWorkerUrl')) return sessionConfig.corsWorkerUrl;
  for (const key of SESSION_WORKER_URL_COMPATIBILITY_KEYS) {
    if (hasOwn(sessionConfig, key)) return sessionConfig[key];
  }
  return undefined;
};
