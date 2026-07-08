import { getCacheBackendDiagnostics } from '../cache/cacheScripts.js';
import {
  CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS,
  CE_ARWEAVE_PREFLIGHT_SBT_METADATA,
  CE_ARWEAVE_PREFLIGHT_SESSION_METADATA,
} from '../../variables/appConfig.js';
import { getDefaultArweaveGateways, isDirectToArIoEnabled, normalizeGatewayList } from './arweaveUrls';

export type ArweaveDebugContext = {
  category?: string;
  caller?: string;
  scope?: string;
  slug?: string;
  chainId?: number;
  enabled?: true;
  fn?: string;
};

type ArweaveDownloadOptions = {
  arIoGateway?: unknown;
  debugArweave?: boolean;
  directToArIo?: boolean;
  disableExistencePrecheck?: boolean;
  gateway?: unknown;
  gateways?: unknown[];
  preflightTxExistence?: boolean;
  shortCircuitNotFound?: boolean;
  stopOnFirst404?: boolean;
};

type PreflightDecision = {
  enabled: boolean;
  source: string;
};

type LoggerLike = Record<string, unknown>;

export const normalizeArweaveDebugContext = (raw: unknown): ArweaveDebugContext | null => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const category = raw.trim();
    return category ? { category } : null;
  }
  if (typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const category = String(record.category || record.kind || record.source || '').trim();
  const caller = String(record.caller || record.fn || '').trim();
  const slug = String(record.slug || '').trim();
  const scope = String(record.scope || '').trim();
  const chainId = Number(record.chainId || 0) || 0;
  const normalized: ArweaveDebugContext = {};
  if (category) normalized.category = category;
  if (caller) normalized.caller = caller;
  if (scope) normalized.scope = scope;
  if (slug) normalized.slug = slug;
  if (chainId) normalized.chainId = chainId;
  if (record.enabled === true) normalized.enabled = true;
  return Object.keys(normalized).length ? normalized : null;
};

export const shouldStopOnFirstNotFound = (opts: ArweaveDownloadOptions = {}): boolean =>
  opts?.stopOnFirst404 === true || opts?.shortCircuitNotFound === true;

const readBoolish = (raw: unknown, defaultVal = false): boolean => {
  if (typeof raw === 'boolean') return raw;
  const value = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase();
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false;
  return defaultVal;
};

const readGlobalBool = (key: string, defaultVal = false): boolean => {
  try {
    const runtimeGlobal = globalThis as Record<string, unknown>;
    if (typeof globalThis !== 'undefined' && typeof runtimeGlobal[key] !== 'undefined') {
      return readBoolish(runtimeGlobal[key], defaultVal);
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }
  return defaultVal;
};

export const readArweaveRuntimeDiagnostics = (): {
  cacheBackend: string;
  cacheBackendProbeState: string;
  devicePixelRatio: number | null;
  userAgent: string | null;
  viewportHeight: number | null;
  viewportWidth: number | null;
} => {
  let userAgent = null;
  let viewportWidth = null;
  let viewportHeight = null;
  let devicePixelRatio = null;
  try {
    if (typeof navigator !== 'undefined' && navigator?.userAgent) {
      userAgent = String(navigator.userAgent);
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }
  try {
    if (typeof window !== 'undefined') {
      viewportWidth = Number(window.innerWidth || 0) || null;
      viewportHeight = Number(window.innerHeight || 0) || null;
      devicePixelRatio = Number(window.devicePixelRatio || 0) || null;
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }

  const cacheBackend = getCacheBackendDiagnostics();
  return {
    cacheBackend: String(cacheBackend?.persistentBackend || 'unknown'),
    cacheBackendProbeState: String(cacheBackend?.probeState || 'unprobed'),
    userAgent,
    viewportWidth,
    viewportHeight,
    devicePixelRatio,
  };
};

const isResponsePayloadCategory = (debugContext: ArweaveDebugContext | null = null): boolean => {
  const category = String(debugContext?.category || '')
    .trim()
    .toLowerCase();
  return category === 'question_response_payload' || category === 'survey_response_payload';
};

const isDisplayCriticalMetadataCategory = (debugContext: ArweaveDebugContext | null = null): boolean => {
  const category = String(debugContext?.category || '')
    .trim()
    .toLowerCase();
  return (
    category === 'session_registry_metadata' ||
    category === 'sbt_metadata' ||
    category === 'question_metadata' ||
    category === 'survey_metadata'
  );
};

export const resolvePreflightTxExistenceDecision = (
  opts: ArweaveDownloadOptions = {},
  debugContext: ArweaveDebugContext | null = null,
): PreflightDecision => {
  if (opts?.disableExistencePrecheck === true) {
    return { enabled: false, source: 'opts:disableExistencePrecheck' };
  }
  if (opts?.preflightTxExistence === false) {
    return { enabled: false, source: 'opts:preflightTxExistence=false' };
  }
  if (opts?.preflightTxExistence === true) {
    return { enabled: true, source: 'opts:preflightTxExistence=true' };
  }
  const category = String(debugContext?.category || '')
    .trim()
    .toLowerCase();
  if (category === 'session_registry_metadata') {
    return {
      enabled: readGlobalBool('CE_ARWEAVE_PREFLIGHT_SESSION_METADATA', !!CE_ARWEAVE_PREFLIGHT_SESSION_METADATA),
      source: 'config:session_metadata',
    };
  }
  if (category === 'sbt_metadata') {
    return {
      enabled: readGlobalBool('CE_ARWEAVE_PREFLIGHT_SBT_METADATA', !!CE_ARWEAVE_PREFLIGHT_SBT_METADATA),
      source: 'config:sbt_metadata',
    };
  }
  if (isResponsePayloadCategory(debugContext)) {
    return {
      enabled: readGlobalBool('CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS', !!CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS),
      source: 'config:response_payloads',
    };
  }
  return { enabled: false, source: 'default:skip' };
};

export const shouldUseShortNotFoundCooldown = (debugContext: ArweaveDebugContext | null = null): boolean => {
  if (isResponsePayloadCategory(debugContext)) return true;
  if (!isDisplayCriticalMetadataCategory(debugContext)) return false;
  const category = String(debugContext?.category || '')
    .trim()
    .toLowerCase();
  if (category === 'question_metadata' || category === 'survey_metadata') return true;
  return resolvePreflightTxExistenceDecision({}, debugContext).enabled === false;
};

export const resolveDownloadGatewaysForContext = (
  opts: ArweaveDownloadOptions = {},
  debugContext: ArweaveDebugContext | null = null,
): string[] => {
  void debugContext;
  const configuredGateways =
    Array.isArray(opts.gateways) && opts.gateways.length ? normalizeGatewayList(opts.gateways) : [];
  if (configuredGateways.length) return configuredGateways;
  return getDefaultArweaveGateways(opts);
};

export const resolveDirectToArIoForContext = (
  opts: ArweaveDownloadOptions = {},
  debugContext: ArweaveDebugContext | null = null,
): boolean => {
  void debugContext;
  return isDirectToArIoEnabled(opts);
};

const shouldLogArweaveFetchDebug = (
  opts: ArweaveDownloadOptions = {},
  debugContext: ArweaveDebugContext | null = null,
): boolean => {
  if (opts?.debugArweave === true) return true;
  if (debugContext?.enabled === true) return true;
  try {
    if (typeof window !== 'undefined') {
      const runtimeWindow = window as Window & {
        __CE_ARWEAVE_DEBUG__?: boolean;
        ENABLE_RPC_DEBUG_LOGGING?: boolean;
      };
      if (runtimeWindow.__CE_ARWEAVE_DEBUG__ === true) return true;
      if (runtimeWindow.ENABLE_RPC_DEBUG_LOGGING === true) return true;
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }
  return false;
};

export const createArweaveFetchDebugLogger =
  (logger: LoggerLike) =>
  (
    level: string,
    message: string,
    payload: unknown,
    opts: ArweaveDownloadOptions = {},
    debugContext: ArweaveDebugContext | null = null,
  ): void => {
    if (!shouldLogArweaveFetchDebug(opts, debugContext)) return;
    const method = typeof logger?.[level] === 'function' ? level : 'log';
    const writer = logger?.[method];
    if (typeof writer === 'function') {
      writer.call(logger, message, payload);
    }
  };
