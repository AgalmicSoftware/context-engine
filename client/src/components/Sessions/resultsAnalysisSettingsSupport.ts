import { toStr } from '../../utilities/shared/primitives.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const getStorageBackend = (config: unknown): string => {
  const record = asRecord(config);
  const profile = asRecord(record.sessionModeProfile);
  const profileStorage = asRecord(profile.storage);
  const storageProfile = asRecord(record.storageProfile);
  return toStr(profileStorage.backend || storageProfile.backend)
    .trim()
    .toLowerCase();
};

const claimsWorkerCanonical = (config: unknown): boolean => {
  const profile = asRecord(asRecord(config).sessionModeProfile);
  const authority = asRecord(profile.authority);
  return toStr(authority.mode).trim() === 'worker_canonical';
};

export const supportsBackgroundResultsAnalysis = (config: unknown): boolean => {
  const capabilities = resolveSessionCapabilityProjection(config);
  return capabilities.isWorkerCanonical && getStorageBackend(config) === 'cloudflare';
};

export const getBackgroundResultsAnalysisUnsupportedReason = (config: unknown): string => {
  const capabilities = resolveSessionCapabilityProjection(config);
  if (!capabilities.isWorkerCanonical && claimsWorkerCanonical(config) && getStorageBackend(config) !== 'cloudflare') {
    return 'Background automatic runs require Cloudflare-backed result storage. This session can still use manual generation.';
  }
  if (!capabilities.isWorkerCanonical) {
    return 'Background automatic runs are available for Worker-canonical Cloudflare sessions. This session can still use manual generation.';
  }
  if (getStorageBackend(config) !== 'cloudflare') {
    return 'Background automatic runs require Cloudflare-backed result storage. This session can still use manual generation.';
  }
  return '';
};
