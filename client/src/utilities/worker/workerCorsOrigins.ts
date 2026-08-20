/**
 * @file workerCorsOrigins.js
 * @module workerCorsOrigins
 * @description CORS origin allowlist construction for worker deployments.
 *              Builds the allowed-origin list from defaults plus session-specific overrides.
 *
 * Key exports: buildWorkerAllowOrigins, DEFAULT_WORKER_ALLOWED_ORIGINS, workerCorsOrigins
 */
import { normalizeOriginList } from '../urlUtils';
import { toStr } from '../shared/primitives.js';
import { DEFAULT_WORKER_ALLOWED_ORIGINS as SHARED_DEFAULT_WORKER_ALLOWED_ORIGINS } from './defaultWorkerAllowedOrigins.mjs';

export const DEFAULT_WORKER_ALLOWED_ORIGINS = SHARED_DEFAULT_WORKER_ALLOWED_ORIGINS;

const splitOriginListInput = (value: unknown): string[] => {
  const trimmed = toStr(value).trim();
  if (!trimmed) return [];
  return trimmed
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const coerceOriginListInput = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => splitOriginListInput(entry));
  }
  return splitOriginListInput(value);
};

export const buildWorkerAllowOrigins = ({
  currentOrigin,
  extraOrigins,
}: {
  currentOrigin?: unknown;
  extraOrigins?: unknown;
} = {}): string[] => {
  // `allowOrigins` is sometimes stored as a newline/comma-delimited string (legacy configs),
  // so treat strings as lists instead of one opaque entry to keep patches additive.
  const extras = coerceOriginListInput(extraOrigins);
  return normalizeOriginList([currentOrigin, ...SHARED_DEFAULT_WORKER_ALLOWED_ORIGINS, ...extras]);
};
