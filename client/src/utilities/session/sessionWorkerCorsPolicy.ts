import { normalizeOrigin } from '../urlUtils';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const readAllowOriginEntries = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(/[,\n]/);
  return value == null ? [] : [value];
};

export const isBrowserOriginAllowedBySessionWorkerConfig = (
  sessionConfig: unknown,
  browserOrigin: unknown = typeof window !== 'undefined' ? window.location.origin : '',
): boolean => {
  const config = asRecord(sessionConfig);
  if (!Object.prototype.hasOwnProperty.call(config, 'allowOrigins')) return true;

  const entries = readAllowOriginEntries(config.allowOrigins)
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
  if (entries.length === 0) return true;

  const origin = normalizeOrigin(browserOrigin);
  if (!origin) return false;
  return entries.map(normalizeOrigin).filter(Boolean).includes(origin);
};
