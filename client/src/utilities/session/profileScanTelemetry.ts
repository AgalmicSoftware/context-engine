/**
 * @module utilities/session/profileScanTelemetry
 */

import { createLogger } from 'utilities/logging.js';

const mainSiteLog = createLogger('mainSite');

type RuntimeGlobals = typeof globalThis & Record<string, unknown> & {
  location?: {
    pathname?: unknown;
  };
};

type ProfileScanTelemetryContext = {
  readBoolishRuntimeFlag: (raw: unknown, fallback?: boolean) => boolean;
  _profileScanTelemetrySeq?: number;
  isProfileScanTelemetryEnabled: () => boolean;
  isProfileScanColdDiagEnabled: () => boolean;
  emitProfileScanTelemetry: (event: string, payload?: Record<string, unknown>) => unknown;
};

const isTelemetryRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object'
);

export function isProfileScanTelemetryEnabled(this: ProfileScanTelemetryContext): boolean {
  try {
    if (typeof globalThis === 'undefined') return false;
    const runtimeGlobals = globalThis as RuntimeGlobals;
    if (typeof runtimeGlobals.CE_PROFILE_SCAN_TELEMETRY !== 'undefined') {
      return this.readBoolishRuntimeFlag(runtimeGlobals.CE_PROFILE_SCAN_TELEMETRY, true);
    }
    const pathname = String(globalThis.location?.pathname || '');
    return pathname.startsWith('/u/');
  } catch (_) {
    return false;
  }
}

export function emitProfileScanTelemetry(
  this: ProfileScanTelemetryContext,
  event: string,
  payload: unknown = {}
): void {
  if (!this.isProfileScanTelemetryEnabled()) return;
  try {
    const safeEvent = String(event || '').trim() || 'unknown';
    const safePayload = isTelemetryRecord(payload)
      ? payload
      : { value: payload };
    const seq = Number(this._profileScanTelemetrySeq || 0) + 1;
    this._profileScanTelemetrySeq = seq;
    const entry = {
      ts: new Date().toISOString(),
      seq,
      source: 'MainSite',
      event: safeEvent,
      ...safePayload,
    };
    const key = '__CE_PROFILE_SCAN_TELEMETRY__';
    const runtimeGlobals = globalThis as RuntimeGlobals;
    const bucket = Array.isArray(runtimeGlobals[key])
      ? runtimeGlobals[key] as Array<Record<string, unknown>>
      : [];
    bucket.push(entry);
    if (bucket.length > 800) bucket.splice(0, bucket.length - 800);
    runtimeGlobals[key] = bucket;
    console.info(`[CE_PROFILE_SCAN][MainSite] ${safeEvent}`, entry);
  } catch (e) { mainSiteLog.warn('MainSite: telemetry', e); }
}

export function isProfileScanColdDiagEnabled(this: ProfileScanTelemetryContext): boolean {
  try {
    if (typeof globalThis === 'undefined') return false;
    const runtimeGlobals = globalThis as RuntimeGlobals;
    if (typeof runtimeGlobals.CE_PROFILE_SCAN_COLD_DIAG !== 'undefined') {
      return this.readBoolishRuntimeFlag(runtimeGlobals.CE_PROFILE_SCAN_COLD_DIAG, false);
    }
  } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
  return false;
}

export function emitProfileScanColdDiag(
  this: ProfileScanTelemetryContext,
  event: string,
  payload: unknown = {}
): void {
  if (!this.isProfileScanColdDiagEnabled()) return;
  const name = String(event || '').trim().toLowerCase() || 'unknown';
  const safePayload = isTelemetryRecord(payload) ? payload : { value: payload };
  this.emitProfileScanTelemetry(`cold-diag:${name}`, safePayload);
}
