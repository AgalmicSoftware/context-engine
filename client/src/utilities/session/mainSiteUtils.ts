/**
 * @module utilities/session/mainSiteUtils
 */

import { ethers } from 'ethers';
import { createLogger, emitForcedLog } from 'utilities/logging.js';

type LoggerMethod = (...args: unknown[]) => void;
type LoggerShape = ReturnType<typeof createLogger> & Record<string, unknown>;
type PerfCounterScope = Record<string, number | string | null | undefined>;
type PerfCounterStore = Record<string, PerfCounterScope | unknown>;
type MainSiteCacheManagerReadyStatePatch = {
  isCacheManagerReady: boolean;
};
type MainSiteLitHooksStatePatch<T> = {
  litHooks: T;
};
type CoreSbtMetadataCandidate = {
  tokenURI?: unknown;
  tokenUri?: unknown;
  mintingEndTime?: unknown;
  burnAuth?: unknown;
  admin?: unknown;
  admin_?: unknown;
  hasPasswordMint?: unknown;
  maxTokens?: unknown;
};

declare global {
  var CE_SBT_SELECTOR_DEBUG: unknown | undefined;
  var ENABLE_CE_UI_PERF_STATS: boolean | undefined;
  var ENABLE_CE_DEBUG_COUNTERS: boolean | undefined;
  var __CE_DEBUG_COUNTERS__: boolean | undefined;
  var __CE_PERF_COUNTERS__: PerfCounterStore | undefined;
}

const mainSiteLog: LoggerShape = createLogger('mainSite') as LoggerShape;
const SBT_SELECTOR_DEBUG_STORAGE_KEY = 'ce:sbtSelectorDebug';
const SBT_SELECTOR_DEBUG_QUERY_KEY = 'ceSbtSelectorDebug';
const MAIN_SITE_PERF_SCOPE = 'mainSite';

export const readBoolishDebugFlag = (value: unknown): boolean => {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

export const isForcedSbtSelectorDebugEnabled = (): boolean => {
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
    if (
      typeof localStorage !== 'undefined' &&
      readBoolishDebugFlag(localStorage.getItem(SBT_SELECTOR_DEBUG_STORAGE_KEY))
    ) {
      return true;
    }
  } catch (_) {
    return false;
  }
  try {
    if (
      typeof sessionStorage !== 'undefined' &&
      readBoolishDebugFlag(sessionStorage.getItem(SBT_SELECTOR_DEBUG_STORAGE_KEY))
    ) {
      return true;
    }
  } catch (_) {
    return false;
  }
  return false;
};

export const emitMainSiteSbtDebug = (level: string, message: string, payload?: unknown): void => {
  const loggerMethod =
    typeof mainSiteLog?.[level] === 'function'
      ? (mainSiteLog[level] as LoggerMethod).bind(mainSiteLog)
      : mainSiteLog.log.bind(mainSiteLog);

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

export const isRouteResponderAddress = (value: unknown): boolean =>
  /^0x[0-9a-fA-F]{40}$/.test(String(value || '').trim());

export const hasCoreSbtMetadata = (info: unknown): boolean => {
  if (!info || typeof info !== 'object') return false;

  const typedInfo = info as CoreSbtMetadataCandidate;
  const hasValue = (value: unknown): boolean => value !== undefined && value !== null && String(value).trim() !== '';
  const tokenUri = typedInfo.tokenURI ?? typedInfo.tokenUri ?? null;
  const mintingEndRaw = typedInfo.mintingEndTime;
  const burnAuthRaw = typedInfo.burnAuth;
  const adminAddress = String(typedInfo.admin || typedInfo.admin_ || '').trim();
  const zeroAddress = String(ethers.constants.AddressZero || '').toLowerCase();
  const mintingEndOk = mintingEndRaw !== undefined && mintingEndRaw !== null && Number.isFinite(Number(mintingEndRaw));
  const burnAuthOk = burnAuthRaw !== undefined && burnAuthRaw !== null && Number.isFinite(Number(burnAuthRaw));
  const adminOk = !!adminAddress && adminAddress.toLowerCase() !== zeroAddress;

  return (
    hasValue(tokenUri) &&
    mintingEndOk &&
    burnAuthOk &&
    typeof typedInfo.hasPasswordMint === 'boolean' &&
    hasValue(typedInfo.maxTokens) &&
    adminOk
  );
};

export const buildMainSiteLitHooksStatePatch = <T>(litHooks: T): MainSiteLitHooksStatePatch<T> => ({
  litHooks,
});

export const buildMainSiteCacheManagerReadyStatePatch = ({
  ready = true,
}: {
  ready?: unknown;
} = {}): MainSiteCacheManagerReadyStatePatch => ({
  isCacheManagerReady: ready === true,
});

export const isMainSitePerfCountersEnabled = (): boolean => {
  try {
    return (
      typeof globalThis !== 'undefined' &&
      (globalThis.ENABLE_CE_UI_PERF_STATS === true ||
        globalThis.ENABLE_CE_DEBUG_COUNTERS === true ||
        globalThis.__CE_DEBUG_COUNTERS__ === true)
    );
  } catch (_) {
    return false;
  }
};

export const bumpMainSitePerfCounter = (key: string, inc = 1): void => {
  if (!isMainSitePerfCountersEnabled()) return;

  try {
    if (!globalThis.__CE_PERF_COUNTERS__ || typeof globalThis.__CE_PERF_COUNTERS__ !== 'object') {
      globalThis.__CE_PERF_COUNTERS__ = {};
    }

    const perfCounters = globalThis.__CE_PERF_COUNTERS__ as PerfCounterStore;

    if (!perfCounters[MAIN_SITE_PERF_SCOPE] || typeof perfCounters[MAIN_SITE_PERF_SCOPE] !== 'object') {
      perfCounters[MAIN_SITE_PERF_SCOPE] = {};
    }

    const scope = perfCounters[MAIN_SITE_PERF_SCOPE] as PerfCounterScope;
    scope[key] = Number(scope[key] || 0) + Number(inc || 0);
  } catch (e) {
    void e; /* fallback: perf counter update. */
  }
};

export const getMainSitePerfNow = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};
