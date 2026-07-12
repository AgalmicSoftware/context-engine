export const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
// Cloudflare KV's hard value limit is 25 MiB. Keep one MiB of headroom for
// serialization drift and reject the final encoded record, not just raw input.
export const DEFAULT_MAX_KV_VALUE_BYTES = 24 * 1024 * 1024;
export const MAX_UPLOAD_BYTES_ENV = 'CE_MAX_UPLOAD_BYTES';
export const UPLOAD_TOO_LARGE_ERROR = 'Upload payload too large.';
export const KV_VALUE_TOO_LARGE_ERROR = 'KV storage payload too large after encoding.';

const toFinitePositiveInteger = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return null;
  return Math.floor(numberValue);
};

export const resolveMaxUploadBytes = ({ env, deps, maxUploadBytes } = {}) => (
  toFinitePositiveInteger(maxUploadBytes) ||
  toFinitePositiveInteger(deps?.maxUploadBytes) ||
  toFinitePositiveInteger(env?.[MAX_UPLOAD_BYTES_ENV]) ||
  DEFAULT_MAX_UPLOAD_BYTES
);

export const resolveMaxKvValueBytes = ({ deps, maxKvValueBytes } = {}) => Math.min(
  toFinitePositiveInteger(maxKvValueBytes) ||
    toFinitePositiveInteger(deps?.maxKvValueBytes) ||
    DEFAULT_MAX_KV_VALUE_BYTES,
  DEFAULT_MAX_KV_VALUE_BYTES,
);

const tooLarge = (maxUploadBytes) => ({
  ok: false,
  status: 413,
  error: `${UPLOAD_TOO_LARGE_ERROR} Maximum allowed upload is ${maxUploadBytes} bytes.`,
  payload: null,
});

export const rejectContentLengthOverLimit = ({ request, maxUploadBytes } = {}) => {
  const limit = resolveMaxUploadBytes({ maxUploadBytes });
  const headerValue = request?.headers?.get?.('content-length');
  if (!headerValue) return null;
  const contentLength = Number(headerValue);
  if (!Number.isFinite(contentLength) || contentLength < 0) return null;
  return contentLength > limit ? tooLarge(limit) : null;
};

export const rejectBytesOverLimit = ({ bytes, maxUploadBytes } = {}) => {
  const limit = resolveMaxUploadBytes({ maxUploadBytes });
  const byteLength = Number(bytes?.byteLength ?? bytes?.length ?? 0);
  if (!Number.isFinite(byteLength)) return null;
  return byteLength > limit ? tooLarge(limit) : null;
};

export const rejectKvValueOverLimit = ({ serializedValue, deps, maxKvValueBytes } = {}) => {
  const limit = resolveMaxKvValueBytes({ deps, maxKvValueBytes });
  const encodedBytes = new TextEncoder().encode(String(serializedValue ?? '')).byteLength;
  if (encodedBytes <= limit) return null;
  return {
    ok: false,
    status: 413,
    error: `${KV_VALUE_TOO_LARGE_ERROR} Maximum allowed KV value is ${limit} bytes.`,
    payload: null,
  };
};
