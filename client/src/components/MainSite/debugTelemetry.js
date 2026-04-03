/**
 * @module components/MainSite/debugTelemetry
 */

import { createLogger } from 'utilities/logging.js';

const mainSiteLog = createLogger('mainSite');

export function isProfileScanTelemetryEnabled() {
  try {
    if (typeof globalThis === 'undefined') return false;
    if (typeof globalThis.CE_PROFILE_SCAN_TELEMETRY !== 'undefined') {
      return this.readBoolishRuntimeFlag(globalThis.CE_PROFILE_SCAN_TELEMETRY, true);
    }
    const pathname = String(globalThis.location?.pathname || '');
    return pathname.startsWith('/u/');
  } catch (_) {
    return false;
  }
}

export function emitProfileScanTelemetry(event, payload = {}) {
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
    const bucket = Array.isArray(globalThis[key]) ? globalThis[key] : [];
    bucket.push(entry);
    if (bucket.length > 800) bucket.splice(0, bucket.length - 800);
    globalThis[key] = bucket;
    console.info(`[CE_PROFILE_SCAN][MainSite] ${safeEvent}`, entry);
  } catch (e) { mainSiteLog.warn('MainSite: telemetry', e); }
}

export function isProfileScanColdDiagEnabled() {
  try {
    if (typeof globalThis === 'undefined') return false;
    if (typeof globalThis.CE_PROFILE_SCAN_COLD_DIAG !== 'undefined') {
      return this.readBoolishRuntimeFlag(globalThis.CE_PROFILE_SCAN_COLD_DIAG, false);
    }
  } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
  return false;
}

export function emitProfileScanColdDiag(event, payload = {}) {
  if (!this.isProfileScanColdDiagEnabled()) return;
  const name = String(event || '').trim().toLowerCase() || 'unknown';
  this.emitProfileScanTelemetry(`cold-diag:${name}`, payload);
}
