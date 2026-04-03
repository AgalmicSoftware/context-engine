/**
 * @module components/MainSite/mainSiteUtils
 */

import { ethers } from 'ethers';
import { createLogger, emitForcedLog } from 'utilities/logging.js';

const mainSiteLog = createLogger('mainSite');
const SBT_SELECTOR_DEBUG_STORAGE_KEY = 'ce:sbtSelectorDebug';
const SBT_SELECTOR_DEBUG_QUERY_KEY = 'ceSbtSelectorDebug';
const MAIN_SITE_PERF_SCOPE = 'mainSite';

export const readBoolishDebugFlag = (value) => {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

export const isForcedSbtSelectorDebugEnabled = () => {
  try {
    if (typeof globalThis !== 'undefined' && readBoolishDebugFlag(globalThis.CE_SBT_SELECTOR_DEBUG)) {
      return true;
    }
  } catch (_) {
    return false;
  }
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location?.search || '');
      if (params.has(SBT_SELECTOR_DEBUG_QUERY_KEY) && readBoolishDebugFlag(params.get(SBT_SELECTOR_DEBUG_QUERY_KEY))) {
        return true;
      }
    }
  } catch (_) {
    return false;
  }
  try {
    if (typeof localStorage !== 'undefined' && readBoolishDebugFlag(localStorage.getItem(SBT_SELECTOR_DEBUG_STORAGE_KEY))) {
      return true;
    }
  } catch (_) {
    return false;
  }
  try {
    if (typeof sessionStorage !== 'undefined' && readBoolishDebugFlag(sessionStorage.getItem(SBT_SELECTOR_DEBUG_STORAGE_KEY))) {
      return true;
    }
  } catch (_) {
    return false;
  }
  return false;
};

export const emitMainSiteSbtDebug = (level, message, payload) => {
  const loggerMethod = typeof mainSiteLog?.[level] === 'function' ? mainSiteLog[level].bind(mainSiteLog) : mainSiteLog.log.bind(mainSiteLog);
  if (isForcedSbtSelectorDebugEnabled()) {
    if (typeof payload === 'undefined') {
      emitForcedLog(level, message);
    } else {
      emitForcedLog(level, message, payload);
    }
    return;
  }
  if (typeof payload === 'undefined') {
    loggerMethod(message);
  } else {
    loggerMethod(message, payload);
  }
};

export const isRouteResponderAddress = (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value || '').trim());

export const hasCoreSbtMetadata = (info) => {
  if (!info || typeof info !== 'object') return false;
  const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';
  const tokenUri = info.tokenURI ?? info.tokenUri ?? null;
  const mintingEndRaw = info.mintingEndTime;
  const burnAuthRaw = info.burnAuth;
  const adminAddress = String(info.admin || info.admin_ || '').trim();
  const zeroAddress = String(ethers.constants.AddressZero || '').toLowerCase();
  const mintingEndOk = mintingEndRaw !== undefined && mintingEndRaw !== null && Number.isFinite(Number(mintingEndRaw));
  const burnAuthOk = burnAuthRaw !== undefined && burnAuthRaw !== null && Number.isFinite(Number(burnAuthRaw));
  const adminOk = !!adminAddress && adminAddress.toLowerCase() !== zeroAddress;
  return (
    hasValue(tokenUri) &&
    mintingEndOk &&
    burnAuthOk &&
    typeof info.hasPasswordMint === 'boolean' &&
    hasValue(info.maxTokens) &&
    adminOk
  );
};

export const isMainSitePerfCountersEnabled = () => {
  try {
    return typeof globalThis !== 'undefined' && (
      globalThis.ENABLE_CE_UI_PERF_STATS === true ||
      globalThis.ENABLE_CE_DEBUG_COUNTERS === true ||
      globalThis.__CE_DEBUG_COUNTERS__ === true
    );
  } catch (_) {
    return false;
  }
};

export const bumpMainSitePerfCounter = (key, inc = 1) => {
  if (!isMainSitePerfCountersEnabled()) return;
  try {
    if (!globalThis.__CE_PERF_COUNTERS__ || typeof globalThis.__CE_PERF_COUNTERS__ !== 'object') {
      globalThis.__CE_PERF_COUNTERS__ = {};
    }
    if (
      !globalThis.__CE_PERF_COUNTERS__[MAIN_SITE_PERF_SCOPE] ||
      typeof globalThis.__CE_PERF_COUNTERS__[MAIN_SITE_PERF_SCOPE] !== 'object'
    ) {
      globalThis.__CE_PERF_COUNTERS__[MAIN_SITE_PERF_SCOPE] = {};
    }
    const scope = globalThis.__CE_PERF_COUNTERS__[MAIN_SITE_PERF_SCOPE];
    scope[key] = Number(scope[key] || 0) + Number(inc || 0);
  } catch (e) { void e; /* fallback: perf counter update. */ }
};

export const getMainSitePerfNow = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};
