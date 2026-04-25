/**
 * @module components/MainSite/debugTelemetry
 */

import { createLogger } from 'utilities/logging.js';

const mainSiteLog = createLogger('mainSite');

export function isProfileScanTelemetryEnabled(this: any): boolean {
  try {
    if (typeof globalThis === 'undefined') return false;
    const runtimeGlobals = globalThis as Record<string, any>;
    if (typeof runtimeGlobals.CE_PROFILE_SCAN_TELEMETRY !== 'undefined') {
      return this.readBoolishRuntimeFlag(runtimeGlobals.CE_PROFILE_SCAN_TELEMETRY, true);
    }
    const pathname = String(globalThis.location?.pathname || '');
    return pathname.startsWith('/u/');
  } catch (_) {
    return false;
  }
}

export function emitProfileScanTelemetry(this: any, event: any, payload: any = {}): void {
  if (!this.isProfileScanTelemetryEnabled()) return;
  try {
    const safeEvent = String(event || '').trim() || 'unknown';
    const safePayload = (payload && typeof payload === 'object')
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
    const runtimeGlobals = globalThis as Record<string, any>;
    const bucket = Array.isArray(runtimeGlobals[key]) ? runtimeGlobals[key] : [];
    bucket.push(entry);
    if (bucket.length > 800) bucket.splice(0, bucket.length - 800);
    runtimeGlobals[key] = bucket;
    console.info(`[CE_PROFILE_SCAN][MainSite] ${safeEvent}`, entry);
  } catch (e) { mainSiteLog.warn('MainSite: telemetry', e); }
}

export function isProfileScanColdDiagEnabled(this: any): boolean {
  try {
    if (typeof globalThis === 'undefined') return false;
    const runtimeGlobals = globalThis as Record<string, any>;
    if (typeof runtimeGlobals.CE_PROFILE_SCAN_COLD_DIAG !== 'undefined') {
      return this.readBoolishRuntimeFlag(runtimeGlobals.CE_PROFILE_SCAN_COLD_DIAG, false);
    }
  } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
  return false;
}

export function emitProfileScanColdDiag(this: any, event: any, payload: any = {}): void {
  if (!this.isProfileScanColdDiagEnabled()) return;
  const name = String(event || '').trim().toLowerCase() || 'unknown';
  this.emitProfileScanTelemetry(`cold-diag:${name}`, payload);
}
