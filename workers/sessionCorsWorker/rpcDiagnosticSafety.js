export const PRIVATE_SESSION_RPC_LABEL = '[private-session-rpc]';
export const RPC_ENDPOINT_LABEL = '[rpc-endpoint]';

const toTrimmedString = (value) => (
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
);

const flattenRpcUrls = (value) => {
  if (Array.isArray(value)) return value.flatMap(flattenRpcUrls);
  const rpcUrl = toTrimmedString(value);
  return rpcUrl ? [rpcUrl] : [];
};

export const normalizeSafeRpcStatus = (error) => {
  const value = Number(error?.rpcStatus ?? error?.status);
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
};

export const normalizeSafeRpcCode = (error) => {
  const value = error?.rpcCode ?? error?.code ?? error?.rpcError?.code;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = toTrimmedString(value);
  if (/^-?\d{1,12}$/.test(normalized)) return normalized;
  return null;
};

export const createRpcDiagnosticMasker = ({
  privateRpcUrls,
  maskRpcUrl,
} = {}) => {
  const privateUrls = new Set(flattenRpcUrls(privateRpcUrls));
  const privateOrigins = new Set(
    [...privateUrls].flatMap((rpcUrl) => {
      try {
        return [new URL(rpcUrl).origin];
      } catch {
        return [];
      }
    }),
  );
  return (value, { isPrivate = false } = {}) => {
    const rpcUrl = toTrimmedString(value);
    if (!rpcUrl) return '';
    if (rpcUrl === PRIVATE_SESSION_RPC_LABEL || isPrivate || privateUrls.has(rpcUrl)) {
      return PRIVATE_SESSION_RPC_LABEL;
    }
    if (!/^https?:\/\//i.test(rpcUrl)) return RPC_ENDPOINT_LABEL;
    try {
      const origin = new URL(rpcUrl).origin;
      if (privateOrigins.has(origin)) return PRIVATE_SESSION_RPC_LABEL;
      // Apply legacy formatting only after discarding credentials, paths, query
      // strings, and fragments. This keeps existing log formatting without
      // allowing a permissive formatter to re-expose endpoint secrets.
      return typeof maskRpcUrl === 'function'
        ? (toTrimmedString(maskRpcUrl(origin)) || origin)
        : origin;
    } catch {
      return RPC_ENDPOINT_LABEL;
    }
  };
};

export const buildSafeRpcFailure = ({
  rpcUrl,
  error,
  errorLabel = 'RPC request failed.',
  maskRpcUrl,
  privateRpcUrls,
  isPrivate = false,
} = {}) => {
  const mask = createRpcDiagnosticMasker({ privateRpcUrls, maskRpcUrl });
  const failure = {
    rpcUrl: mask(rpcUrl, { isPrivate }),
    status: normalizeSafeRpcStatus(error),
  };
  const code = normalizeSafeRpcCode(error);
  if (code != null) failure.code = code;
  failure.error = toTrimmedString(errorLabel) || 'RPC request failed.';
  return failure;
};

export const sanitizeRpcFailureDetails = (details, options = {}) => (
  (Array.isArray(details) ? details : []).map((entry) => buildSafeRpcFailure({
    ...options,
    rpcUrl: entry?.rpcUrl,
    error: {
      rpcStatus: entry?.status ?? entry?.rpcStatus,
      rpcCode: entry?.code ?? entry?.rpcCode,
      rpcError: entry?.rpcError,
    },
  }))
);

export const createSafeRpcError = (error, errorLabel = 'RPC request failed.') => {
  const safe = new Error(toTrimmedString(errorLabel) || 'RPC request failed.');
  const status = normalizeSafeRpcStatus(error);
  const code = normalizeSafeRpcCode(error);
  if (status != null) safe.rpcStatus = status;
  if (code != null) safe.rpcCode = code;
  return safe;
};
