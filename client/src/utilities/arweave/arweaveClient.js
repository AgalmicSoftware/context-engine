/**
 * @file arweaveClient.js
 * @module arweaveClient
 * @description Arweave transaction creation, signing, and posting.
 *              Handles data upload to Arweave via the CORS proxy worker.
 *
 * Key exports: arweaveClient
 */
import Arweave from 'arweave';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import { createLogger } from '../logging';
import { base64DecodeURL, base64urlToBase64, base64urlToHex, hexToBase64url } from './arweaveEncoding.js';
import {
  buildFetchTimeoutError,
  classifyStatusKind,
  createArweaveFetchError,
  isEmptyGatewayResponseText,
  isRetryableStatus,
  withTimeout,
} from './arweaveFetchErrors.js';
import {
  buildArweaveGatewayHttpFailure,
  classifyArweaveGatewayPayloadResponse,
} from './arweaveGatewayPayloadResponse.js';
import {
  buildArweaveGatewayRouteCandidates,
  buildArweaveGatewayUrl,
  extractArweaveTxId,
  formatWinstonToAr,
  getArweaveGatewayClientConfig,
  normalizeArweaveUploadId,
  normalizeTagsPayload,
} from './arweaveGatewayPayloads.js';
import {
  dedupeTxEvent,
  getArweaveTextCacheEntry,
  getArweaveTxContextLabels,
  registerArweaveTxContext,
  setArweaveTextCacheEntry,
} from './arweaveClientCaches.js';
import { getTxExistenceCacheEntry, setTxExistenceCacheEntry } from './arweaveTxExistenceCache.js';
import {
  buildFailureCacheError,
  clearFailureCacheEntry,
  getFailureCacheEntry,
  recordFailureCacheEntry,
} from './arweaveFailureCache.js';
import {
  createArweaveFetchDebugLogger,
  normalizeArweaveDebugContext,
  readArweaveRuntimeDiagnostics,
  resolveDirectToArIoForContext,
  resolveDownloadGatewaysForContext,
  resolvePreflightTxExistenceDecision,
  shouldStopOnFirstNotFound,
  shouldUseShortNotFoundCooldown,
} from './arweaveRuntimeDiagnostics.js';
import {
  getAvailableGatewaysForAttempt,
  getGraphqlEndpointSortScore,
  isGraphqlEndpointCoolingDown,
  markGatewayFailure,
  markGatewaySuccess,
  markGraphqlEndpointFailure,
  markGraphqlEndpointSuccess,
} from './arweaveGatewayHealth.js';
import { getPreferredArIoGateway, isDirectToArIoEnabled, normalizeGatewayBase } from './arweaveUrls.js';
import {
  isTransientWorkerUploadError,
  isWorkerMissingSessionSecretsError,
  normalizeUploadSessionSlug,
  normalizeWorkerBaseUrl,
  resolveUploadSessionSlug,
  resolveUploadSlugField,
  shouldFallbackUploadCandidate,
} from './arweaveUploadFallbackPolicy.js';
import { buildUploadSessionCandidates } from './arweaveUploadCandidates.js';
import { parseWorkerUploadResponseJson } from './arweaveUploadWorkerResponse.js';
import { buildArweaveUploadFallbackTelemetryEntry } from './arweaveClientHostContracts.js';

const log = createLogger('general');
const logArweaveFetchDebug = createArweaveFetchDebugLogger(log);

/* ==========================================================================
   Arweave utilities used by the chain gateway.
   - Standalone functions with identical logic and preserved formatting/comments
   - Exported together as `arweaveClient`
   ========================================================================== */

const getArweaveGatewayClientConfig = (gatewayOverride = '') => {
  const gatewayBase = getPreferredArweaveGateway(gatewayOverride);
  try {
    const parsed = new URL(gatewayBase);
    const normalizedBase = String(parsed.pathname || '').replace(/\/+$/, '')
      ? `${parsed.origin}${String(parsed.pathname || '').replace(/\/+$/, '')}`
      : parsed.origin;
    return {
      gatewayBase: normalizedBase,
      init: {
        host: parsed.hostname,
        port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)),
        protocol: parsed.protocol === 'http:' ? 'http' : 'https',
      },
    };
  } catch {
    return {
      gatewayBase: DEFAULT_ARWEAVE_LINK_GATEWAY,
      init: {
        host: 'arweave.net',
        port: 443,
        protocol: 'https',
      },
    };
  }
};
const formatWinstonToAr = (winston, decimals = 6) => {
  const normalized = String(winston ?? '').trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error('Invalid Arweave balance.');
  }
  const safeDecimals = Number.isFinite(Number(decimals)) ? Math.max(0, Math.min(12, Number(decimals))) : 6;
  const whole = normalized.length > 12 ? normalized.slice(0, -12) : '0';
  const fractionFull = normalized.padStart(13, '0').slice(-12);
  if (safeDecimals === 0) return whole;
  return `${whole}.${fractionFull.slice(0, safeDecimals).padEnd(safeDecimals, '0')}`;
};

const normalizeArweaveUploadId = (value) => {
  const normalized = extractArweaveTxId(value);
  if (normalized) return normalized;
  return String(value || '').trim();
};
const WORKER_ENDPOINT_SUFFIXES = [
  '/auth/nonce',
  '/auth/login',
  '/admin/set-config',
  '/admin/set-secrets',
  '/admin/set-limits',
  '/admin/secret-presence',
  '/transcribe',
  '/ai',
  '/arweave/upload',
  '/fetch_url',
  '/fetch_image',
  '/fetch',
  '/health',
];
const normalizeWorkerBaseUrl = (rawUrl) => {
  const base = normalizeBaseUrl(rawUrl || '');
  if (!base) return '';
  try {
    const parsed = new URL(base);
    const rawPath = String(parsed.pathname || '').replace(/\/+$/, '');
    const lowerPath = rawPath.toLowerCase();
    for (const suffix of WORKER_ENDPOINT_SUFFIXES) {
      if (lowerPath === suffix) {
        return parsed.origin;
      }
      if (lowerPath.endsWith(suffix)) {
        const nextPath = rawPath.slice(0, rawPath.length - suffix.length).replace(/\/+$/, '');
        return nextPath ? `${parsed.origin}${nextPath}` : parsed.origin;
      }
    }
    return base;
  } catch {
    return base;
  }
};
const normalizeSessionSlug = (raw) => {
  const slug = String(raw ?? '').trim();
  if (!slug || slug === 'general') return '';
  return slug;
};
const resolveUploadSessionSlug = (opts = {}) => {
  if (Object.prototype.hasOwnProperty.call(opts, 'sessionSlug')) {
    return normalizeSessionSlug(opts.sessionSlug);
  }
  const config = opts?.sessionConfig || {};
  return normalizeSessionSlug(config?.slug || '');
};
const resolveUploadSlugField = () => 'sessionSlug';
const ARWEAVE_UPLOAD_FALLBACK_TELEMETRY_KEY = '__CE_ARWEAVE_UPLOAD_FALLBACK__';

const emitArweaveUploadFallbackTelemetry = (payload = {}) => {
  const entry = buildArweaveUploadFallbackTelemetryEntry(payload);
  log.info('[arweave] upload-fallback-attempt', entry);
  try {
    if (typeof globalThis === 'undefined') return;
    const existing = Array.isArray(globalThis[ARWEAVE_UPLOAD_FALLBACK_TELEMETRY_KEY])
      ? globalThis[ARWEAVE_UPLOAD_FALLBACK_TELEMETRY_KEY]
      : [];
    existing.push(entry);
    if (existing.length > 500) existing.splice(0, existing.length - 500);
    globalThis[ARWEAVE_UPLOAD_FALLBACK_TELEMETRY_KEY] = existing;
  } catch (e) {
    log.warn('arweaveScripts: telemetry', e);
  }
};

const isGateUnavailableError = (message = '') => /on-chain gate data unavailable/i.test(String(message || ''));

const isWorkerAuthRouteUnsupportedError = (message = '') =>
  /worker auth (?:nonce|login) route not supported \(404\)/i.test(String(message || ''));

const isWorkerMissingArweaveKeyError = (message = '') => /arweave key not configured/i.test(String(message || ''));

const isWorkerMissingSessionSecretsError = (message = '') =>
  /session secrets not configured/i.test(String(message || ''));

const isTransientWorkerUploadError = ({ message = '', status = null } = {}) => {
  const normalizedMessage = String(message || '')
    .trim()
    .toLowerCase();
  const normalizedStatus = Number(status || 0) || 0;
  if (
    normalizedMessage.includes('could not getprice') ||
    normalizedMessage.includes('bad gateway') ||
    normalizedMessage.includes('gateway timeout') ||
    normalizedMessage.includes('temporary internal error')
  ) {
    return true;
  }
  return normalizedStatus === 502 || normalizedStatus === 503 || normalizedStatus === 504;
};

const shouldFallbackUploadCandidate = ({ message = '' } = {}) =>
  isGateUnavailableError(message) ||
  isWorkerAuthRouteUnsupportedError(message) ||
  isWorkerMissingArweaveKeyError(message);

const readScopeUploadSlugs = () => {
  try {
    const slugs = readSessionScanSlugs();
    return Array.isArray(slugs) ? slugs : [];
  } catch (_) {
    return [];
  }
};

const readSponsoredUploadContext = (selectedSessionSlug = '') => {
  try {
    const context = readSponsoredBootstrapFundingContext();
    if (!context || typeof context !== 'object') return null;
    const selectedSlug = normalizeSessionSlug(selectedSessionSlug);
    const targetSlug = normalizeSessionSlug(context.targetSessionSlug || '');
    if (targetSlug && selectedSlug && targetSlug !== selectedSlug) return null;
    const sessionSlug = normalizeSessionSlug(context.sessionSlug || '');
    const workerUrl = normalizeWorkerBaseUrl(context.workerUrl || '');
    if (!sessionSlug && !workerUrl) return null;
    return {
      sessionSlug,
      workerUrl,
      targetSessionSlug: targetSlug,
    };
  } catch (_) {
    return null;
  }
};

const getGateSnapshotSbtAddresses = (snapshot = null) => {
  const seen = new Set();
  const out = [];
  const push = (value) => {
    const addr = String(value || '').trim();
    if (!addr) return;
    const key = addr.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(addr);
  };
  if (Array.isArray(snapshot?.sbtAddresses)) {
    snapshot.sbtAddresses.forEach(push);
  }
  push(snapshot?.sbtAddress);
  return out;
};

const hasSponsoredArweaveKey = (sessionConfig = null) => {
  const value = sessionConfig?.sponsoredKeys?.arweave;
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const getUploadCandidateReasonPriority = (reason = '') => {
  const normalized = String(reason || '')
    .trim()
    .toLowerCase();
  if (normalized === 'sponsored-referrer') return 0;
  if (normalized === 'shared-fallback') return 1;
  if (normalized === 'scope-list') return 2;
  return 3;
};

const classifyUploadGateStatus = (sessionConfig = null, resourceKey = 'arweave') => {
  const registry =
    sessionConfig?.__registry && typeof sessionConfig.__registry === 'object' ? sessionConfig.__registry : {};
  const gateAuthority = String(registry?.gateAuthority || '')
    .trim()
    .toLowerCase();
  const gatesByResource =
    registry?.gatesByResource && typeof registry.gatesByResource === 'object' ? registry.gatesByResource : null;
  const primaryKey = String(resourceKey || '').trim() || 'arweave';

  const readStatusForKey = (key) => {
    if (gateAuthority !== 'onchain') {
      return { key, status: 'unknown' };
    }
    if (!gatesByResource) {
      return { key, status: 'unavailable' };
    }
    const snapshot = gatesByResource[key];
    if (!snapshot || typeof snapshot !== 'object') {
      return { key, status: 'missing' };
    }
    const lookupStatus = String(snapshot.lookupStatus || '')
      .trim()
      .toLowerCase();
    if (lookupStatus !== 'ok') {
      return { key, status: 'unresolved' };
    }
    const sbtAddresses = getGateSnapshotSbtAddresses(snapshot);
    if (!sbtAddresses.length) {
      return { key, status: 'no-gate' };
    }
    return { key, status: 'restricted' };
  };

  const primary = readStatusForKey(primaryKey);
  const fallback = primaryKey === 'default' ? null : readStatusForKey('default');
  const allowsPrimary = primary.status === 'no-gate';
  const allowsFallback = fallback?.status === 'no-gate';
  const selectedKey = allowsPrimary ? primary.key : allowsFallback ? fallback.key : primary.key;
  const selectedStatus = allowsPrimary ? primary.status : allowsFallback ? fallback.status : primary.status;
  const preferenceRank =
    selectedStatus === 'no-gate'
      ? selectedKey === primaryKey
        ? 0
        : 1
      : selectedStatus === 'unknown' || selectedStatus === 'missing'
        ? 2
        : 3;
  return {
    gateStatus: fallback
      ? `${primary.key}:${primary.status}|default:${fallback.status}`
      : `${primary.key}:${primary.status}`,
    allowsArweaveUpload: selectedStatus === 'no-gate',
    preferenceRank,
  };
};

const buildUploadSessionCandidates = async ({
  selectedSessionSlug = '',
  initialWorkerUrl = '',
  context = null,
} = {}) => {
  const selectedSlug = normalizeSessionSlug(selectedSessionSlug);
  const normalizedInitialWorker = normalizeWorkerBaseUrl(initialWorkerUrl || '');
  const scopedSlugs = readScopeUploadSlugs();
  const sponsoredContext = readSponsoredUploadContext(selectedSlug);
  const sharedFallbackWorkerUrl = normalizeWorkerBaseUrl(getSharedFallbackWorkerUrl() || '');
  const orderedSources = [];
  const seenSourceKeys = new Set();
  const pushSource = ({ slug = '', reason = 'scope-list', explicitWorkerUrl = '' } = {}) => {
    const normalizedSlug = normalizeSessionSlug(slug || '');
    const normalizedWorkerUrl = normalizeWorkerBaseUrl(explicitWorkerUrl || '');
    const sourceKey = `${normalizedSlug}|${normalizedWorkerUrl}`;
    if (seenSourceKeys.has(sourceKey)) return;
    seenSourceKeys.add(sourceKey);
    orderedSources.push({
      slug: normalizedSlug,
      reason,
      explicitWorkerUrl: normalizedWorkerUrl,
    });
  };
  pushSource({
    slug: selectedSlug,
    reason: 'selected-session',
    explicitWorkerUrl: normalizedInitialWorker,
  });
  if (sponsoredContext) {
    pushSource({
      slug: sponsoredContext.sessionSlug,
      reason: 'sponsored-referrer',
      explicitWorkerUrl: sponsoredContext.workerUrl,
    });
  }
  if (sharedFallbackWorkerUrl) {
    pushSource({
      slug: '',
      reason: 'shared-fallback',
      explicitWorkerUrl: sharedFallbackWorkerUrl,
    });
  }
  (Array.isArray(scopedSlugs) ? scopedSlugs : []).forEach((slug) => pushSource({ slug, reason: 'scope-list' }));
  if (!orderedSources.length) pushSource({ slug: '', reason: 'selected-session' });

  const candidates = [];
  for (let index = 0; index < orderedSources.length; index += 1) {
    const source = orderedSources[index];
    const slug = source.slug;
    let resolved = null;
    if (!source.explicitWorkerUrl) {
      try {
        resolved = await resolveCorsProxyUrl({
          sessionSlug: slug,
          context,
          allowDemoFallback: defaultStrictAllowDemoFallback(),
        });
      } catch (_) {
        resolved = null;
      }
    }
    const workerUrl = source.explicitWorkerUrl ? source.explicitWorkerUrl : normalizeWorkerBaseUrl(resolved?.url || '');
    if (!workerUrl) continue;
    const resolvedSessionConfig = resolved?.session || resolved?.group || null;
    const gateSummary = classifyUploadGateStatus(resolvedSessionConfig, 'arweave');
    candidates.push({
      sessionSlug: slug,
      workerUrl,
      reason: source.reason || (index === 0 ? 'selected-session' : 'scope-list'),
      gateStatus: gateSummary.gateStatus,
      preferenceRank: gateSummary.preferenceRank,
      allowsArweaveUpload: gateSummary.allowsArweaveUpload,
      hasSponsoredArweaveKey: hasSponsoredArweaveKey(resolvedSessionConfig),
      order: index,
    });
  }

  if (candidates.length <= 1) return candidates;
  const [first, ...rest] = candidates;
  rest.sort((a, b) => {
    const reasonPriorityA = getUploadCandidateReasonPriority(a.reason);
    const reasonPriorityB = getUploadCandidateReasonPriority(b.reason);
    if (reasonPriorityA !== reasonPriorityB) return reasonPriorityA - reasonPriorityB;
    if (a.preferenceRank !== b.preferenceRank) return a.preferenceRank - b.preferenceRank;
    if (!!a.hasSponsoredArweaveKey !== !!b.hasSponsoredArweaveKey) {
      return a.hasSponsoredArweaveKey ? -1 : 1;
    }
    return a.order - b.order;
  });
  return [first, ...rest];
};

const buildArweaveGatewayUrl = (txId, gateway) => {
  const normalizedTxId = normalizeArweaveUploadId(txId);
  if (!normalizedTxId) return '';
  const base = getPreferredArweaveGateway(gateway);
  return `${base}/${normalizedTxId}`;
};

const buildArweaveGatewayTxDataUrl = (txId, gateway) => {
  const normalizedTxId = normalizeArweaveUploadId(txId);
  if (!normalizedTxId) return '';
  const base = getPreferredArweaveGateway(gateway);
  return `${base}/tx/${normalizedTxId}/data`;
};

const buildArweaveGatewayRawUrl = (txId, gateway) => {
  const normalizedTxId = normalizeArweaveUploadId(txId);
  if (!normalizedTxId) return '';
  const base = getPreferredArweaveGateway(gateway);
  return `${base}/raw/${normalizedTxId}`;
};

const AR_IO_GATEWAY_HOST_SET = new Set(['ar-io.dev', 'ar-io.net', 'ar.io']);
const AR_IO_GATEWAY_HOST_SUFFIXES = ['.ar-io.dev', '.ar-io.net', '.ar.io'];
const isArIoGatewayHost = (host = '') => {
  const lowered = String(host || '')
    .trim()
    .toLowerCase();
  if (!lowered) return false;
  if (AR_IO_GATEWAY_HOST_SET.has(lowered)) return true;
  return AR_IO_GATEWAY_HOST_SUFFIXES.some((suffix) => lowered.endsWith(suffix));
};
const isArIoGatewayBase = (gateway = '') => {
  const normalized = normalizeGatewayBase(gateway);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return isArIoGatewayHost(parsed.hostname);
  } catch {
    return false;
  }
};

const buildArweaveGatewayRouteCandidates = (txId, gateway, opts = {}) => {
  const gatewayBase = getPreferredArweaveGateway(gateway);
  const isArIoGateway = isArIoGatewayBase(gatewayBase);
  const includeRawRoute = opts?.includeRawRoute !== false && !isArIoGateway;
  const includeTxDataRoute = opts?.includeTxDataRoute !== false && !isArIoGateway;
  const routeCandidates = [
    { route: 'direct', url: buildArweaveGatewayUrl(txId, gatewayBase) },
    ...(includeRawRoute ? [{ route: 'raw', url: buildArweaveGatewayRawUrl(txId, gatewayBase) }] : []),
    ...(includeTxDataRoute ? [{ route: 'tx-data', url: buildArweaveGatewayTxDataUrl(txId, gateway) }] : []),
  ].filter((entry) => !!entry.url);
  const seen = new Set();
  return routeCandidates.filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
};

const normalizeTagsPayload = (raw) => {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const tags = raw
      .filter((t) => t && typeof t === 'object')
      .map((t) => ({
        name: typeof t.name === 'string' ? t.name : String(t.name || ''),
        value: typeof t.value === 'string' ? t.value : String(t.value || ''),
      }))
      .map((t) => ({ name: String(t.name || '').trim(), value: String(t.value || '').trim() }))
      .filter((t) => t.name && t.value !== '');
    return tags.length ? tags : null;
  }
  if (raw && typeof raw === 'object') {
    const tags = Object.entries(raw)
      .map(([name, value]) => ({ name: String(name || '').trim(), value: String(value ?? '').trim() }))
      .filter((t) => t.name && t.value !== '');
    return tags.length ? tags : null;
  }
  return null;
};

const isRetryableStatus = (status) =>
  status === 202 ||
  status === 425 ||
  status === 429 ||
  status === 500 ||
  status === 502 ||
  status === 503 ||
  status === 504;

const classifyStatusKind = (status) => {
  if (status === 404) return 'not_found';
  if (status === 202) return 'pending';
  if (status === 425 || status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  if (status >= 400) return 'invalid';
  return 'unknown';
};

const looksLikeHtmlGatewayPayload = ({ text = '', contentType = '' } = {}) => {
  const type = String(contentType || '')
    .trim()
    .toLowerCase();
  const snippet = String(text || '')
    .trimStart()
    .slice(0, 256)
    .toLowerCase();
  if (type.includes('text/html') || type.includes('application/xhtml+xml')) return true;
  return (
    snippet.startsWith('<!doctype html') ||
    snippet.startsWith('<html') ||
    snippet.startsWith('<head') ||
    snippet.startsWith('<body')
  );
};

const inferStatusFromHtmlGatewayPayload = (text = '') => {
  const body = String(text || '');
  const snippet = body.slice(0, 2048);
  const hasTitleStatus = (status) => {
    const escapedStatus = String(status || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`<title[^>]*>\\s*${escapedStatus}\\b`, 'i').test(snippet);
  };

  if (hasTitleStatus(404) || (/\b404\b/.test(snippet) && /page not found|not found/i.test(snippet))) return 404;
  if (hasTitleStatus(429) || (/\b429\b/.test(snippet) && /too many requests|rate limit/i.test(snippet))) return 429;
  if (hasTitleStatus(401) || (/\b401\b/.test(snippet) && /unauthorized|not authorized/i.test(snippet))) return 401;
  if (hasTitleStatus(403) || (/\b403\b/.test(snippet) && /forbidden|access denied|permission denied/i.test(snippet)))
    return 403;
  if (hasTitleStatus(502) || (/\b502\b/.test(snippet) && /bad gateway/i.test(snippet))) return 502;
  if (hasTitleStatus(503) || (/\b503\b/.test(snippet) && /service unavailable|temporarily unavailable/i.test(snippet)))
    return 503;
  if (hasTitleStatus(504) || (/\b504\b/.test(snippet) && /gateway timeout/i.test(snippet))) return 504;
  if (hasTitleStatus(500) || (/\b500\b/.test(snippet) && /internal server error/i.test(snippet))) return 500;
  return null;
};

const createArweaveFetchError = ({
  txId = '',
  status = null,
  retryable = false,
  kind = 'unknown',
  message = 'Arweave fetch failed',
  gateway = '',
  attempt = 0,
  cause = null,
} = {}) => {
  const err = new Error(String(message || 'Arweave fetch failed'));
  err.name = 'ArweaveFetchError';
  err.txId = String(txId || '');
  err.status = Number.isFinite(Number(status)) ? Number(status) : null;
  err.retryable = !!retryable;
  err.kind = String(kind || 'unknown');
  err.gateway = String(gateway || '');
  err.attempt = Number(attempt || 0);
  if (cause) err.cause = cause;
  return err;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildRetryableTimeoutError = (label = 'operation', timeoutMs = 0) => {
  const err = new Error(`${String(label || 'operation')} timed out after ${timeoutMs}ms`);
  err.name = 'TimeoutError';
  err.code = 'ETIMEDOUT';
  err.retryable = true;
  err.kind = 'network';
  err.timeoutMs = Number(timeoutMs || 0) || 0;
  return err;
};

const withTimeout = async (promise, ms, label = 'operation') => {
  const timeoutMs = Math.max(1, Number(ms || 0));
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(buildRetryableTimeoutError(label, timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
};

const isEmptyGatewayResponseText = (text) => String(text ?? '').trim().length === 0;

const createEmptyGatewayResponseError = ({ txId = '', gateway = '', attempt = 0 } = {}) =>
  createArweaveFetchError({
    txId,
    status: null,
    retryable: true,
    kind: 'network',
    gateway,
    attempt,
    message: 'Arweave gateway returned empty response body.',
  });

const readResponseBodyPreview = async (response) => {
  if (!response || typeof response.text !== 'function') return '';
  try {
    return String(await response.text()).slice(0, 200);
  } catch (_) {
    return '';
  }
};

const parseWorkerUploadResponseJson = async (response) => {
  let previewResponse = null;
  try {
    previewResponse = typeof response?.clone === 'function' ? response.clone() : response;
  } catch (_) {
    previewResponse = response;
  }
  try {
    return await response.json();
  } catch (_) {
    const bodyPreview = await readResponseBodyPreview(previewResponse);
    const details = {
      status: Number(response?.status || 0) || null,
      bodyPreview,
    };
    if (!response?.ok) {
      log.warn('arweave upload response parse failed', details);
      return {};
    }
    log.error('arweave upload response parse failed', details);
    throw new Error('arweave upload response malformed');
  }
};

const ARWEAVE_TEXT_CACHE_TTL_MS = 10 * 60 * 1000;
const ARWEAVE_TEXT_CACHE_MAX = 600;
const ARWEAVE_FAILURE_CACHE_MAX = 1200;
const ARWEAVE_FAILURE_BASE_RETRY_MS = 1500;
const ARWEAVE_FAILURE_MAX_RETRY_MS = 2 * 60 * 1000;
const ARWEAVE_FAILURE_NOT_FOUND_RETRY_MS = 10 * 60 * 1000;
const ARWEAVE_FAILURE_RESPONSE_NOT_FOUND_RETRY_MS = 30 * 1000;
const ARWEAVE_FAILURE_PENDING_RETRY_MS = 30 * 1000;
const ARWEAVE_FAILURE_INVALID_RETRY_MS = 30 * 60 * 1000;
const MAX_FAILURE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const ARWEAVE_GRAPHQL_URL = 'https://permagate.io/graphql';
const ARWEAVE_GRAPHQL_ENDPOINTS = [
  'https://permagate.io/graphql',
  'https://g8way.io/graphql',
  'https://arweave.net/graphql',
];
const ARWEAVE_GRAPHQL_TIMEOUT_MS = 3500;
export const ARWEAVE_CHUNK_UPLOAD_TIMEOUT_MS = 30_000;
const MAX_ARWEAVE_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
const arweaveTextInFlight = new Map();
const arweaveTxExistenceInFlight = new Map();
const arweaveTxContextCache = new Map();
const arweaveTxEventDedupe = new Map();
const arweaveGraphqlEndpointHealth = new Map();
const arweaveGatewayHealth = new Map();

const getArweaveTextCacheEntry = (txId) => {
  const key = String(txId || '').trim();
  if (!key) return null;
  const entry = arweaveTextCache.get(key);
  if (!entry) return null;
  if (Date.now() - Number(entry.ts || 0) > ARWEAVE_TEXT_CACHE_TTL_MS) {
    arweaveTextCache.delete(key);
    return null;
  }
  // LRU touch
  arweaveTextCache.delete(key);
  arweaveTextCache.set(key, entry);
  return entry;
};

const setArweaveTextCacheEntry = (txId, text) => {
  const key = String(txId || '').trim();
  if (!key || String(text ?? '').trim().length === 0) return;
  arweaveTextCache.delete(key);
  arweaveTextCache.set(key, { text, ts: Date.now() });
  while (arweaveTextCache.size > ARWEAVE_TEXT_CACHE_MAX) {
    const oldest = arweaveTextCache.keys().next().value;
    if (!oldest) break;
    arweaveTextCache.delete(oldest);
  }
};

const extractArweaveTxId = (value) => {
  return parseArweaveTxId(value, {
    allowQueryParams: true,
    allowUnknownGatewayHost: true,
  });
};

const dedupeTxEvent = (key) => {
  if (!key) return true;
  const now = Date.now();
  const prev = Number(arweaveTxEventDedupe.get(key) || 0);
  if (prev > 0 && now - prev < ARWEAVE_TX_EVENT_DEDUPE_TTL_MS) return false;
  arweaveTxEventDedupe.set(key, now);
  while (arweaveTxEventDedupe.size > ARWEAVE_TX_CONTEXT_CACHE_MAX) {
    const oldest = arweaveTxEventDedupe.keys().next().value;
    if (!oldest) break;
    arweaveTxEventDedupe.delete(oldest);
  }
  return true;
};

const registerArweaveTxContext = (txId, context = {}) => {
  const normalizedTxId = extractArweaveTxId(txId);
  if (!normalizedTxId) return;
  const category =
    String(context?.category || '')
      .trim()
      .toLowerCase() || 'unknown';
  const caller = String(context?.caller || context?.fn || '').trim() || '';
  const source =
    String(context?.source || '')
      .trim()
      .toLowerCase() || 'unknown';
  const label = caller ? `${category}:${caller}:${source}` : `${category}:${source}`;
  const prev = arweaveTxContextCache.get(normalizedTxId) || { labels: [], ts: 0 };
  const labels = Array.isArray(prev.labels) ? [...prev.labels] : [];
  if (!labels.includes(label)) labels.push(label);
  while (labels.length > ARWEAVE_TX_CONTEXT_LABEL_MAX) labels.shift();
  arweaveTxContextCache.set(normalizedTxId, { labels, ts: Date.now() });
  while (arweaveTxContextCache.size > ARWEAVE_TX_CONTEXT_CACHE_MAX) {
    const oldest = arweaveTxContextCache.keys().next().value;
    if (!oldest) break;
    arweaveTxContextCache.delete(oldest);
  }
};

const getArweaveTxContextLabels = (txId) => {
  const normalizedTxId = extractArweaveTxId(txId);
  if (!normalizedTxId) return [];
  const entry = arweaveTxContextCache.get(normalizedTxId);
  if (!entry || !Array.isArray(entry.labels)) return [];
  return [...entry.labels];
};

const readGraphqlEndpointHealth = (endpoint) => {
  const key = String(endpoint || '').trim();
  if (!key) return { failures: 0, cooldownUntilMs: 0, lastStatus: null };
  const raw = arweaveGraphqlEndpointHealth.get(key);
  if (!raw || typeof raw !== 'object') {
    return { failures: 0, cooldownUntilMs: 0, lastStatus: null };
  }
  return {
    failures: Math.max(0, Number(raw.failures || 0)),
    cooldownUntilMs: Math.max(0, Number(raw.cooldownUntilMs || 0)),
    lastStatus: Number.isFinite(Number(raw.lastStatus)) ? Number(raw.lastStatus) : null,
  };
};

const markGraphqlEndpointSuccess = (endpoint) => {
  const key = String(endpoint || '').trim();
  if (!key) return;
  arweaveGraphqlEndpointHealth.set(key, {
    failures: 0,
    cooldownUntilMs: 0,
    lastStatus: 200,
  });
};

const markGraphqlEndpointFailure = (endpoint, status = null) => {
  const key = String(endpoint || '').trim();
  if (!key) return;
  const prev = readGraphqlEndpointHealth(key);
  const failures = Math.max(1, Number(prev.failures || 0) + 1);
  const exponent = Math.max(0, Math.min(8, failures - 1));
  const cooldownMs = Math.min(
    ARWEAVE_GRAPHQL_COOLDOWN_MAX_MS,
    Math.round(ARWEAVE_GRAPHQL_COOLDOWN_BASE_MS * Math.pow(2, exponent)),
  );
  arweaveGraphqlEndpointHealth.set(key, {
    failures,
    cooldownUntilMs: Date.now() + cooldownMs,
    lastStatus: Number.isFinite(Number(status)) ? Number(status) : null,
  });
};

const isGraphqlEndpointCoolingDown = (endpoint) => {
  const health = readGraphqlEndpointHealth(endpoint);
  return Number(health.cooldownUntilMs || 0) > Date.now();
};

const getGraphqlEndpointSortScore = (endpoint) => {
  const health = readGraphqlEndpointHealth(endpoint);
  const coolingDown = Number(health.cooldownUntilMs || 0) > Date.now();
  if (coolingDown) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Number(health.failures || 0));
};

const readGatewayHealth = (gateway) => {
  const key = String(gateway || '').trim();
  if (!key) return { failures: 0, cooldownUntilMs: 0, lastStatus: null };
  const raw = arweaveGatewayHealth.get(key);
  if (!raw || typeof raw !== 'object') {
    return { failures: 0, cooldownUntilMs: 0, lastStatus: null };
  }
  return {
    failures: Math.max(0, Number(raw.failures || 0)),
    cooldownUntilMs: Math.max(0, Number(raw.cooldownUntilMs || 0)),
    lastStatus: Number.isFinite(Number(raw.lastStatus)) ? Number(raw.lastStatus) : null,
  };
};

const markGatewaySuccess = (gateway) => {
  const key = normalizeGatewayBase(gateway);
  if (!key) return;
  arweaveGatewayHealth.set(key, {
    failures: 0,
    cooldownUntilMs: 0,
    lastStatus: 200,
  });
};

const shouldGatewayCooldown = ({ status = null, kind = '' } = {}) => {
  const statusNum = Number(status);
  if (kind === 'network') return true;
  if (!Number.isFinite(statusNum)) return false;
  if (statusNum === 429 || statusNum === 425) return true;
  return statusNum >= 500;
};

const markGatewayFailure = (gateway, { status = null, kind = '' } = {}) => {
  const key = normalizeGatewayBase(gateway);
  if (!key) return;
  const statusNum = Number(status);
  const shouldCool = shouldGatewayCooldown({
    status: Number.isFinite(statusNum) ? statusNum : null,
    kind: String(kind || '')
      .trim()
      .toLowerCase(),
  });
  const prev = readGatewayHealth(key);
  if (!shouldCool) {
    arweaveGatewayHealth.set(key, {
      failures: Math.max(0, Number(prev.failures || 0)),
      cooldownUntilMs: Math.max(0, Number(prev.cooldownUntilMs || 0)),
      lastStatus: Number.isFinite(statusNum) ? statusNum : null,
    });
    return;
  }
  const failures = Math.max(1, Number(prev.failures || 0) + 1);
  const exponent = Math.max(0, Math.min(8, failures - 1));
  const cooldownMs = Math.min(
    ARWEAVE_GATEWAY_COOLDOWN_MAX_MS,
    Math.round(ARWEAVE_GATEWAY_COOLDOWN_BASE_MS * Math.pow(2, exponent)),
  );
  arweaveGatewayHealth.set(key, {
    failures,
    cooldownUntilMs: Date.now() + cooldownMs,
    lastStatus: Number.isFinite(statusNum) ? statusNum : null,
  });
};

const isGatewayCoolingDown = (gateway) => {
  const key = normalizeGatewayBase(gateway);
  if (!key) return false;
  const health = readGatewayHealth(key);
  return Number(health.cooldownUntilMs || 0) > Date.now();
};

const getGatewaySortScore = (gateway) => {
  const key = normalizeGatewayBase(gateway);
  if (!key) return Number.MAX_SAFE_INTEGER;
  const health = readGatewayHealth(key);
  const coolingDown = Number(health.cooldownUntilMs || 0) > Date.now();
  if (coolingDown) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Number(health.failures || 0));
};

const sortGatewaysByHealth = (gateways = []) =>
  [...(Array.isArray(gateways) ? gateways : [])]
    .map((gateway, index) => ({
      gateway,
      index,
      score: getGatewaySortScore(gateway),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.index - b.index;
    })
    .map((item) => item.gateway);

const getAvailableGatewaysForAttempt = (gateways = []) => {
  const ordered = sortGatewaysByHealth(gateways);
  const available = ordered.filter((gateway) => !isGatewayCoolingDown(gateway));
  return available.length ? available : ordered;
};

const buildFetchTimeoutError = (url, timeoutMs, cause = null) => {
  const err = new Error(`Arweave fetch timed out after ${timeoutMs}ms`);
  err.name = 'AbortError';
  err.code = 'ETIMEDOUT';
  err.url = String(url || '');
  err.timeoutMs = Number(timeoutMs || 0) || 0;
  if (cause) {
    try {
      err.cause = cause;
    } catch (_) {}
  }
  return err;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = ARWEAVE_GRAPHQL_TIMEOUT_MS) => {
  const timeout = Math.max(100, Number(timeoutMs || ARWEAVE_GRAPHQL_TIMEOUT_MS));
  let timer = null;
  if (typeof AbortController === 'undefined') {
    const fetchPromise = Promise.resolve(fetch(url, options));
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(buildFetchTimeoutError(url, timeout));
      }, timeout);
    });
    try {
      return await Promise.race([fetchPromise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  }
  const ctrl = new AbortController();
  let didTimeout = false;
  const fetchPromise = Promise.resolve(fetch(url, { ...(options || {}), signal: ctrl.signal }));
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      didTimeout = true;
      try {
        ctrl.abort();
      } catch (e) {
        log.warn('arweaveScripts: cleanup', e);
      }
      reject(buildFetchTimeoutError(url, timeout));
    }, timeout);
  });
  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    if (didTimeout && error?.name === 'AbortError' && !Number.isFinite(Number(error?.timeoutMs || 0))) {
      throw buildFetchTimeoutError(url, timeout, error);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const normalizeHttpUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const getWayfinderResolver = (opts = {}) => {
  if (typeof opts?.wayfinderResolver === 'function') return opts.wayfinderResolver;
  try {
    if (typeof globalThis === 'undefined') return null;
    if (typeof globalThis.CE_ARWEAVE_WAYFINDER_RESOLVE === 'function') {
      return globalThis.CE_ARWEAVE_WAYFINDER_RESOLVE;
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }
  return null;
};

const resolveWayfinderUrlForTx = async ({
  txId = '',
  opts = {},
  debugContext = null,
  attemptedUrls = new Set(),
} = {}) => {
  const normalizedTxId = normalizeArweaveUploadId(txId);
  if (!normalizedTxId) return '';

  if (isDirectToArIoEnabled(opts)) {
    const arIoUrl = buildArweaveGatewayUrl(normalizedTxId, getPreferredArIoGateway(opts?.arIoGateway));
    if (arIoUrl) return arIoUrl;
  }

  const resolver = getWayfinderResolver(opts);
  if (resolver) {
    try {
      const resolved = await resolver({
        txId: normalizedTxId,
        debugContext,
        attemptedUrls: Array.from(attemptedUrls || []),
      });
      const resolvedUrl = normalizeHttpUrl(resolved?.toString ? resolved.toString() : resolved);
      if (resolvedUrl) return resolvedUrl;
    } catch (e) {
      log.warn('arweaveScripts: fallback', e);
    }
  }

  if (opts?.useWayfinder === false) return '';
  // The current @ar.io/wayfinder-core browser stack still pulls OpenTelemetry
  // and Node-polyfill-sensitive subpaths. Use injected resolver hooks only.
  return '';
};

const buildWayfinderRouteCandidates = ({ txId = '', resolvedUrl = '', opts = {} } = {}) => {
  const out = [];
  const seen = new Set();
  const push = (route, url, gateway = 'wayfinder') => {
    const normalizedUrl = normalizeHttpUrl(url);
    if (!normalizedUrl || seen.has(normalizedUrl)) return;
    seen.add(normalizedUrl);
    out.push({ route, url: normalizedUrl, gateway });
  };

  const normalizedResolvedUrl = normalizeHttpUrl(resolvedUrl);
  push('wayfinder', normalizedResolvedUrl, 'wayfinder');
  try {
    const parsed = new URL(normalizedResolvedUrl);
    const gatewayBase = parsed.origin;
    const gatewayRouteOpts = isDirectToArIoEnabled(opts) ? { ...(opts || {}), includeTxDataRoute: false } : opts;
    buildArweaveGatewayRouteCandidates(txId, gatewayBase, gatewayRouteOpts).forEach(({ route, url }) => {
      push(`wayfinder-${route}`, url, normalizeGatewayBase(gatewayBase) || 'wayfinder');
    });
  } catch (e) {
    log.warn('arweaveScripts: fallback', e);
  }

  return out;
};

const tryWayfinderFallback = async ({
  txId = '',
  opts = {},
  debugContext = null,
  attempt = 0,
  gatewayTimeoutMs = 8000,
  attemptedUrls = new Set(),
  allAttemptedUrls = null,
} = {}) => {
  const resolvedUrl = await resolveWayfinderUrlForTx({
    txId,
    opts,
    debugContext,
    attemptedUrls,
  });
  if (!resolvedUrl) return null;

  const routeCandidates = buildWayfinderRouteCandidates({
    txId,
    resolvedUrl,
    opts,
  });
  if (!routeCandidates.length) return null;

  let lastError = null;
  let sawNotFound = false;
  let sawRetryableNonNotFound = false;
  for (let index = 0; index < routeCandidates.length; index += 1) {
    const candidate = routeCandidates[index];
    const hasNextRoute = index < routeCandidates.length - 1;
    const url = String(candidate?.url || '').trim();
    if (!url) continue;
    if (attemptedUrls && attemptedUrls.has(url)) continue;
    try {
      if (attemptedUrls) attemptedUrls.add(url);
      if (allAttemptedUrls) allAttemptedUrls.add(url);
      const resp = await fetchWithTimeout(url, { redirect: 'follow' }, gatewayTimeoutMs);
      if (resp?.ok) {
        const text = await resp.text();
        const contentType = String(resp?.headers?.get?.('content-type') || '')
          .trim()
          .toLowerCase();
        const gatewayPayload = classifyArweaveGatewayPayloadResponse({
          txId,
          gateway: String(candidate.gateway || 'wayfinder'),
          attempt,
          text,
          contentType,
        });
        if (!gatewayPayload.ok) {
          lastError = gatewayPayload.error;
          markGatewayFailure(candidate.gateway, {
            status: gatewayPayload.status,
            kind: gatewayPayload.statusKind,
          });
          markGatewayFailure(candidate.gateway, { status: null, kind: 'network' });
          sawRetryableNonNotFound = true;
          continue;
        }
        const contentType = String(resp?.headers?.get?.('content-type') || '')
          .trim()
          .toLowerCase();
        const derivedStatus = looksLikeHtmlGatewayPayload({ text, contentType })
          ? inferStatusFromHtmlGatewayPayload(text)
          : null;
        if (derivedStatus != null) {
          const kind = classifyStatusKind(derivedStatus);
          const retryable = isRetryableStatus(derivedStatus);
          lastError = createArweaveFetchError({
            txId,
            status: derivedStatus,
            retryable,
            kind,
            gateway: String(candidate.gateway || 'wayfinder'),
            attempt,
            message: `Arweave gateway returned HTML payload (${derivedStatus})`,
          });
          markGatewayFailure(candidate.gateway, { status: derivedStatus, kind });
          if (derivedStatus === 404) {
            sawNotFound = true;
            if (hasNextRoute) continue;
            continue;
          }
          if (retryable) {
            sawRetryableNonNotFound = true;
            if (hasNextRoute) continue;
            continue;
          }
          return {
            ok: false,
            error: lastError,
            sawNotFound,
            sawRetryableNonNotFound,
            resolvedUrl,
          };
        }
        markGatewaySuccess(candidate.gateway);
        return {
          ok: true,
          text: gatewayPayload.text,
          resolvedUrl,
          route: candidate.route,
          gateway: candidate.gateway,
        };
      }
      const failure = buildArweaveGatewayHttpFailure({
        txId,
        status: resp?.status,
        gateway: String(candidate.gateway || 'wayfinder'),
        attempt,
      });
      const kind = failure.statusKind;
      const retryable = failure.retryable;
      lastError = failure.error;
      markGatewayFailure(candidate.gateway, { status: resp?.status, kind });
      if (resp?.status === 404) {
        sawNotFound = true;
        continue;
      }
      if (retryable) {
        sawRetryableNonNotFound = true;
        continue;
      }
      return {
        ok: false,
        error: lastError,
        sawNotFound,
        sawRetryableNonNotFound,
        resolvedUrl,
      };
    } catch (err) {
      lastError = createArweaveFetchError({
        txId,
        status: null,
        retryable: true,
        kind: 'network',
        gateway: String(candidate?.gateway || 'wayfinder'),
        attempt,
        message: err?.message || 'Arweave network request failed',
        cause: err,
      });
      markGatewayFailure(candidate?.gateway, { status: null, kind: 'network' });
      sawRetryableNonNotFound = true;
      continue;
    }
  }
  return {
    ok: false,
    error: lastError,
    sawNotFound,
    sawRetryableNonNotFound,
    resolvedUrl,
  };
};

let arweaveResourceErrorListenerInstalled = false;
const ensureArweaveResourceErrorListener = () => {
  if (arweaveResourceErrorListenerInstalled) return;
  if (typeof window === 'undefined' || !window?.addEventListener) return;
  arweaveResourceErrorListenerInstalled = true;
  try {
    window.addEventListener(
      'error',
      (event) => {
        try {
          const target = event?.target;
          if (!target || target === window) return;
          const rawUrl = String(target.currentSrc || target.src || target.href || '').trim();
          if (!rawUrl) return;
          const txId = extractArweaveTxId(rawUrl);
          if (!txId) return;
          const labels = getArweaveTxContextLabels(txId);
          const dedupeKey = `resource-error|${txId}|${labels.join('|')}`;
          if (!dedupeTxEvent(dedupeKey)) return;
          log.warn('[arweave] resource-load-error', {
            txId,
            labels,
            url: rawUrl,
            tag: String(target.tagName || '').toLowerCase() || null,
          });
        } catch (e) {
          log.warn('arweaveScripts: fallback', e);
        }
      },
      true,
    );
  } catch (e) {
    log.warn('arweaveScripts: fallback', e);
  }
};

const normalizeArweaveDebugContext = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const category = raw.trim();
    return category ? { category } : null;
  }
  if (typeof raw !== 'object') return null;
  const category = String(raw.category || raw.kind || raw.source || '').trim();
  const caller = String(raw.caller || raw.fn || '').trim();
  const slug = String(raw.slug || '').trim();
  const scope = String(raw.scope || '').trim();
  const chainId = Number(raw.chainId || 0) || 0;
  const normalized = {};
  if (category) normalized.category = category;
  if (caller) normalized.caller = caller;
  if (scope) normalized.scope = scope;
  if (slug) normalized.slug = slug;
  if (chainId) normalized.chainId = chainId;
  if (raw.enabled === true) normalized.enabled = true;
  return Object.keys(normalized).length ? normalized : null;
};

const shouldStopOnFirstNotFound = (opts = {}) => opts?.stopOnFirst404 === true || opts?.shortCircuitNotFound === true;

const readBoolish = (raw, defaultVal = false) => {
  if (typeof raw === 'boolean') return raw;
  const value = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase();
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false;
  return defaultVal;
};

const readGlobalBool = (key, defaultVal = false) => {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis[key] !== 'undefined') {
      return readBoolish(globalThis[key], defaultVal);
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }
  return defaultVal;
};

const readArweaveRuntimeDiagnostics = () => {
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

const isResponsePayloadCategory = (debugContext = null) => {
  const category = String(debugContext?.category || '')
    .trim()
    .toLowerCase();
  return category === 'question_response_payload' || category === 'survey_response_payload';
};

const isDisplayCriticalMetadataCategory = (debugContext = null) => {
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

const resolvePreflightTxExistenceDecision = (opts = {}, debugContext = null) => {
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

const shouldUseShortNotFoundCooldown = (debugContext = null) => {
  if (isResponsePayloadCategory(debugContext)) return true;
  if (!isDisplayCriticalMetadataCategory(debugContext)) return false;
  const category = String(debugContext?.category || '')
    .trim()
    .toLowerCase();
  if (category === 'question_metadata' || category === 'survey_metadata') return true;
  return resolvePreflightTxExistenceDecision({}, debugContext).enabled === false;
};

const resolveDownloadGatewaysForContext = (opts = {}, debugContext = null) => {
  void debugContext;
  const configuredGateways =
    Array.isArray(opts.gateways) && opts.gateways.length ? normalizeGatewayList(opts.gateways) : [];
  if (configuredGateways.length) return configuredGateways;
  return getDefaultArweaveGateways(opts);
};

const resolveDirectToArIoForContext = (opts = {}, debugContext = null) => {
  void debugContext;
  return isDirectToArIoEnabled(opts);
};

const shouldLogArweaveFetchDebug = (opts = {}, debugContext = null) => {
  if (opts?.debugArweave === true) return true;
  if (debugContext?.enabled === true) return true;
  try {
    if (typeof window !== 'undefined') {
      if (window.__CE_ARWEAVE_DEBUG__ === true) return true;
      if (window.ENABLE_RPC_DEBUG_LOGGING === true) return true;
    }
  } catch (e) {
    void e; /* fallback: runtime override lookup. */
  }
  return false;
};

const logArweaveFetchDebug = (level, message, payload, opts = {}, debugContext = null) => {
  if (!shouldLogArweaveFetchDebug(opts, debugContext)) return;
  const method = typeof log[level] === 'function' ? level : 'log';
  log[method](message, payload);
};

const getTxExistenceCacheEntry = (txId) => {
  const key = String(txId || '').trim();
  if (!key) return null;
  const entry = arweaveTxExistenceCache.get(key);
  if (!entry || typeof entry !== 'object') return null;
  const ageMs = Date.now() - Number(entry.ts || 0);
  if (!Number.isFinite(ageMs) || ageMs > ARWEAVE_TX_EXISTENCE_CACHE_TTL_MS) {
    arweaveTxExistenceCache.delete(key);
    return null;
  }
  arweaveTxExistenceCache.delete(key);
  arweaveTxExistenceCache.set(key, entry);
  return entry.exists === true;
};

const setTxExistenceCacheEntry = (txId, exists) => {
  const key = String(txId || '').trim();
  if (!key || typeof exists !== 'boolean') return;
  arweaveTxExistenceCache.delete(key);
  arweaveTxExistenceCache.set(key, { exists, ts: Date.now() });
  while (arweaveTxExistenceCache.size > ARWEAVE_TX_EXISTENCE_CACHE_MAX) {
    const oldest = arweaveTxExistenceCache.keys().next().value;
    if (!oldest) break;
    arweaveTxExistenceCache.delete(oldest);
  }
};

const checkArweaveTxExistsViaGraphql = async (txId, opts = {}, debugContext = null) => {
  const normalizedTxId = String(txId || '').trim();
  if (!normalizedTxId) return null;
  const runtimeDiagnostics = readArweaveRuntimeDiagnostics();
  registerArweaveTxContext(normalizedTxId, {
    category:
      String(debugContext?.category || '')
        .trim()
        .toLowerCase() || 'unknown',
    caller: String(debugContext?.caller || debugContext?.fn || '').trim(),
    source: 'graphql_precheck',
  });
  ensureArweaveResourceErrorListener();
  const cached = getTxExistenceCacheEntry(normalizedTxId);
  if (typeof cached === 'boolean') return cached;

  if (arweaveTxExistenceInFlight.has(normalizedTxId)) {
    return await arweaveTxExistenceInFlight.get(normalizedTxId);
  }

  const run = (async () => {
    const configured = Array.isArray(opts?.graphqlUrls) ? opts.graphqlUrls : [];
    const endpoints = [];
    const pushEndpoint = (value) => {
      const endpoint = String(value || '').trim();
      if (!endpoint || endpoints.includes(endpoint)) return;
      endpoints.push(endpoint);
    };
    configured.forEach(pushEndpoint);
    pushEndpoint(opts?.graphqlUrl || ARWEAVE_GRAPHQL_URL);
    ARWEAVE_GRAPHQL_ENDPOINTS.forEach(pushEndpoint);
    if (!endpoints.length) return null;
    endpoints.sort((a, b) => getGraphqlEndpointSortScore(a) - getGraphqlEndpointSortScore(b));

    const query = 'query TxExists($ids:[ID!]) { transactions(ids:$ids, first: 1) { edges { node { id } } } }';
    for (const endpoint of endpoints) {
      if (isGraphqlEndpointCoolingDown(endpoint)) {
        continue;
      }
      try {
        const res = await fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ query, variables: { ids: [normalizedTxId] } }),
          },
          Number(opts?.graphqlTimeoutMs || ARWEAVE_GRAPHQL_TIMEOUT_MS),
        );
        if (!res?.ok) {
          const status = Number(res?.status || 0) || null;
          markGraphqlEndpointFailure(endpoint, status);
          const category =
            String(debugContext?.category || '')
              .trim()
              .toLowerCase() || 'unknown';
          const dedupeKey = `graphql-unhealthy|${endpoint}|${status}|${category}`;
          if (dedupeTxEvent(dedupeKey)) {
            log.warn('[arweave] graphql endpoint unhealthy', {
              endpoint,
              status,
              category,
              caller: String(debugContext?.caller || debugContext?.fn || '').trim() || null,
            });
          }
          continue;
        }
        const payload = await res.json().catch(() => null);
        const edges = payload?.data?.transactions?.edges;
        const exists = Array.isArray(edges) && edges.length > 0;
        setTxExistenceCacheEntry(normalizedTxId, exists);
        markGraphqlEndpointSuccess(endpoint);
        logArweaveFetchDebug(
          'debug',
          '[arweave] tx-existence-check',
          {
            txId: normalizedTxId,
            exists,
            endpoint,
            ...runtimeDiagnostics,
            ...(debugContext || {}),
          },
          opts,
          debugContext,
        );
        return exists;
      } catch (_) {
        markGraphqlEndpointFailure(endpoint, null);
        const category =
          String(debugContext?.category || '')
            .trim()
            .toLowerCase() || 'unknown';
        const dedupeKey = `graphql-network-error|${endpoint}|${category}`;
        if (dedupeTxEvent(dedupeKey)) {
          log.warn('[arweave] graphql endpoint network error', {
            endpoint,
            category,
            caller: String(debugContext?.caller || debugContext?.fn || '').trim() || null,
          });
        }
        continue;
      }
    }
    return null;
  })();

  arweaveTxExistenceInFlight.set(normalizedTxId, run);
  try {
    return await run;
  } finally {
    if (arweaveTxExistenceInFlight.get(normalizedTxId) === run) {
      arweaveTxExistenceInFlight.delete(normalizedTxId);
    }
  }
};

const computeFailureRetryAtMs = ({
  status = null,
  kind = 'unknown',
  retryable = true,
  attempts = 1,
  debugContext = null,
}) => {
  const now = Date.now();
  const safeAttempts = Math.max(1, Number(attempts || 1));
  if (status === 404 || kind === 'not_found') {
    // Gateway-first metadata misses are usually propagation lag, so use a
    // short retry window instead of hiding the asset for the full metadata TTL.
    if (shouldUseShortNotFoundCooldown(debugContext)) {
      return now + ARWEAVE_FAILURE_RESPONSE_NOT_FOUND_RETRY_MS;
    }
    return now + ARWEAVE_FAILURE_NOT_FOUND_RETRY_MS;
  }
  if (status === 202 || kind === 'pending') return now + ARWEAVE_FAILURE_PENDING_RETRY_MS;
  if (!retryable || kind === 'invalid') return now + ARWEAVE_FAILURE_INVALID_RETRY_MS;
  const n = Math.max(0, Math.min(10, safeAttempts - 1));
  const delay = Math.min(ARWEAVE_FAILURE_MAX_RETRY_MS, Math.round(ARWEAVE_FAILURE_BASE_RETRY_MS * Math.pow(2, n)));
  return now + delay;
};

const getFailureCacheEntry = (txId) => {
  const key = String(txId || '').trim();
  if (!key) return null;
  const entry = arweaveFailureCache.get(key);
  if (!entry || typeof entry !== 'object') return null;
  const nextRetryAtMs = Number(entry.nextRetryAtMs || 0);
  if (nextRetryAtMs <= 0) {
    clearFailureCacheEntry(key);
    return null;
  }
  if (nextRetryAtMs > Date.now() + MAX_FAILURE_COOLDOWN_MS) {
    clearFailureCacheEntry(key);
    return null;
  }
  return { ...entry };
};

const setFailureCacheEntry = (txId, entry) => {
  const key = String(txId || '').trim();
  if (!key || !entry || typeof entry !== 'object') return;
  arweaveFailureCache.delete(key);
  arweaveFailureCache.set(key, { ...entry });
  while (arweaveFailureCache.size > ARWEAVE_FAILURE_CACHE_MAX) {
    const oldest = arweaveFailureCache.keys().next().value;
    if (!oldest) break;
    arweaveFailureCache.delete(oldest);
  }
};

const clearFailureCacheEntry = (txId) => {
  const key = String(txId || '').trim();
  if (!key) return;
  arweaveFailureCache.delete(key);
};

const recordFailureCacheEntry = (txId, error, { debugContext = null } = {}) => {
  const key = String(txId || '').trim();
  if (!key) return null;
  const prev = getFailureCacheEntry(key) || {};
  const attempts = Math.max(1, Number(prev.attempts || 0) + 1);
  const now = Date.now();
  const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : null;
  const kind = String(error?.kind || classifyStatusKind(status) || 'unknown');
  const retryable =
    typeof error?.retryable === 'boolean'
      ? error.retryable
      : status === 404 || status === 202 || status === 429 || status >= 500 || kind === 'network';
  const nextRetryAtMs = computeFailureRetryAtMs({ status, kind, retryable, attempts, debugContext });
  const cappedRetryAt = Math.min(nextRetryAtMs, Date.now() + MAX_FAILURE_COOLDOWN_MS);
  const entry = {
    attempts,
    firstFailedAtMs: Number(prev.firstFailedAtMs || 0) > 0 ? Number(prev.firstFailedAtMs) : now,
    lastFailedAtMs: now,
    nextRetryAtMs: cappedRetryAt,
    status,
    kind,
    retryable,
    message: String(error?.message || prev.message || 'Arweave fetch failed'),
  };
  setFailureCacheEntry(key, entry);
  return entry;
};

const buildFailureCacheError = ({ txId, failureEntry }) => {
  const entry = failureEntry && typeof failureEntry === 'object' ? failureEntry : {};
  const status = Number.isFinite(Number(entry.status)) ? Number(entry.status) : null;
  const kind = String(entry.kind || (status === 404 ? 'not_found' : 'cooldown') || 'cooldown');
  const retryable =
    typeof entry.retryable === 'boolean'
      ? entry.retryable
      : kind === 'not_found' ||
        kind === 'pending' ||
        kind === 'network' ||
        kind === 'server' ||
        kind === 'rate_limited';
  const err = createArweaveFetchError({
    txId,
    status,
    retryable,
    kind,
    gateway: 'memo',
    attempt: Number(entry.attempts || 0),
    message: String(entry.message || 'Arweave content not available yet. Retry later.'),
  });
  err.nextRetryAtMs = Number(entry.nextRetryAtMs || 0);
  err.failureAttempts = Number(entry.attempts || 0);
  return err;
};

const parseDirectUploadArweaveJwk = (raw) => {
  if (!raw) throw new Error('Invalid Arweave key.');
  if (typeof raw === 'object') return raw;
  const text = String(raw || '').trim();
  if (!text) throw new Error('Invalid Arweave key.');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid Arweave key.');
  }
};

const uploadDirectToArweave = async ({ data, contentType, tags, arweaveJwk, requestId = '' } = {}) => {
  const jwk = parseDirectUploadArweaveJwk(arweaveJwk);
  const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
    timeout: 60000,
    connectTimeout: 60000,
    logging: false,
  });

  let bytes;
  if (typeof File !== 'undefined' && (data instanceof File || data instanceof Blob)) {
    if (data.size > MAX_ARWEAVE_UPLOAD_BYTES) {
      throw new Error('Arweave upload payload exceeds 100 MB limit. Reduce file size before uploading.');
    }
    bytes = new Uint8Array(await data.arrayBuffer());
  } else {
    const payload =
      contentType === 'application/json' && typeof data !== 'string' ? JSON.stringify(data) : String(data);
    bytes = new TextEncoder().encode(payload);
    if (bytes.length > MAX_ARWEAVE_UPLOAD_BYTES) {
      throw new Error('Arweave upload payload exceeds 100 MB limit.');
    }
  }

  const tx = await arweave.createTransaction({ data: bytes }, jwk);
  if (contentType) tx.addTag('Content-Type', contentType);
  tx.addTag('App-Name', 'ContextEngine');
  (Array.isArray(tags) ? tags : []).forEach((tag) => {
    try {
      tx.addTag(tag.name, tag.value);
    } catch (_) {}
  });

  await arweave.transactions.sign(tx, jwk);
  try {
    const uploader = await arweave.transactions.getUploader(tx);
    while (!uploader.isComplete) {
      await withTimeout(uploader.uploadChunk(), ARWEAVE_CHUNK_UPLOAD_TIMEOUT_MS, 'Arweave chunk upload');
    }
  } catch (err) {
    if (err?.code === 'ETIMEDOUT' && err?.retryable) throw err;
    const res = await arweave.transactions.post(tx);
    if (res?.status !== 200 && res?.status !== 202) {
      throw new Error(`Arweave post failed (${res?.status || 'unknown'})`);
    }
  }

  log.info('[arweave][client] direct upload success', {
    requestId: requestId || null,
    id: tx.id,
    contentType,
    tagCount: Array.isArray(tags) ? tags.length : 0,
  });
  return normalizeArweaveUploadId(tx.id);
};

async function uploadDataToArweave(data, format, opts = {}) {
  if (!data) throw new Error('No data provided for Arweave upload.');
  const resolvedSessionSlug = resolveUploadSessionSlug(opts);
  const tags = normalizeTagsPayload(opts?.tags);

  const requestId =
    typeof opts?.requestId === 'string' && opts.requestId.trim()
      ? opts.requestId.trim()
      : `arw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const explicitWorkerUrl = normalizeWorkerBaseUrl(opts.workerUrl || '');
  let corsWorkerUrl = explicitWorkerUrl;
  if (!corsWorkerUrl) {
    try {
      corsWorkerUrl = await getCorsProxyUrlOrThrow({
        sessionConfig: opts.sessionConfig,
        sessionSlug: opts.sessionSlug,
        context: opts.context,
        allowDemoFallback: defaultStrictAllowDemoFallback(),
      });
    } catch (_) {
      corsWorkerUrl = '';
    }
  }
  const baseUrl = normalizeWorkerBaseUrl(corsWorkerUrl || '');
  const endpoint = baseUrl ? `${baseUrl}/arweave/upload` : '';
  let endpointOrigin = '';
  try {
    endpointOrigin = new URL(endpoint).origin;
  } catch {
    endpointOrigin = '';
  }
  const windowOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  const requestWithAuth = (url, options, attempt = {}) =>
    opts?.skipAuth
      ? fetch(url, options)
      : fetchWorkerWithAuth(url, options, {
          sessionSlug: Object.prototype.hasOwnProperty.call(attempt, 'sessionSlug')
            ? attempt.sessionSlug
            : resolvedSessionSlug,
          context: opts.context,
          workerUrl: normalizeWorkerBaseUrl(attempt.workerUrl || baseUrl),
          allowDemoFallback: defaultStrictAllowDemoFallback(),
        });
  const adminAuth = (() => {
    if (!opts?.adminAuth || typeof opts.adminAuth !== 'object') return null;
    const source = opts.adminAuth;
    const authSlug = normalizeSessionSlug(
      Object.prototype.hasOwnProperty.call(source, 'sessionSlug')
        ? source.sessionSlug
        : Object.prototype.hasOwnProperty.call(source, 'slug')
          ? source.slug
          : resolvedSessionSlug,
    );
    const slugField = resolveUploadSlugField();
    const payload = Object.entries(source).reduce((acc, [key, value]) => {
      if (value == null) return acc;
      acc[key] = value;
      return acc;
    }, {});
    payload[slugField] = authSlug;
    return payload;
  })();
  let arweaveJwkValue = '';
  if (opts?.arweaveJwk) {
    if (typeof opts.arweaveJwk === 'string') {
      arweaveJwkValue = opts.arweaveJwk;
    } else {
      try {
        arweaveJwkValue = JSON.stringify(opts.arweaveJwk);
      } catch {
        arweaveJwkValue = '';
      }
    }
  }
  const shouldForceDirectUpload = opts?.forceDirectArweaveUpload === true && !!arweaveJwkValue;

  // Decide content-type
  let contentType = typeof opts?.contentType === 'string' ? opts.contentType.trim() : '';
  if (!contentType) {
    contentType = 'application/json';
    if (format !== undefined) {
      switch (String(format).toLowerCase()) {
        case 'json':
          contentType = 'application/json';
          break;
        case 'png':
          contentType = 'image/png';
          break;
        case 'jpg':
        case 'jpeg':
          contentType = 'image/jpeg';
          break;
        case 'gif':
          contentType = 'image/gif';
          break;
        case 'mp4':
          contentType = 'video/mp4';
          break;
        case 'md':
        case 'markdown':
          contentType = 'text/markdown';
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } else if (typeof File !== 'undefined' && (data instanceof File || data instanceof Blob)) {
      contentType = data && data.type ? data.type : 'application/octet-stream';
    }
  }
  if (shouldForceDirectUpload) {
    return uploadDirectToArweave({
      data,
      contentType,
      tags,
      arweaveJwk: arweaveJwkValue,
      requestId,
    });
  }

  const uploadCandidates = await buildUploadSessionCandidates({
    selectedSessionSlug: resolvedSessionSlug,
    initialWorkerUrl: baseUrl,
    context: opts.context,
  });
  if (!uploadCandidates.length) {
    if (arweaveJwkValue) {
      return uploadDirectToArweave({
        data,
        contentType,
        tags,
        arweaveJwk: arweaveJwkValue,
        requestId,
      });
    }
    throw new Error('Worker URL is missing for Arweave upload.');
  }

  log.log('[arweave] upload request', {
    requestId,
    endpoint,
    format: format ?? null,
    contentType,
    skipAuth: !!opts?.skipAuth,
    hasAdminAuth: !!adminAuth?.address,
    hasJwk: !!arweaveJwkValue,
    tags: tags ? tags.length : 0,
    candidateCount: uploadCandidates.length,
    candidates: uploadCandidates.map((item) => ({
      sessionSlug: item.sessionSlug || 'general',
      workerUrl: item.workerUrl,
      gateStatus: item.gateStatus,
      reason: item.reason,
    })),
  });
  log.info('[arweave][client] resolved endpoint', {
    requestId,
    explicitWorkerUrl: explicitWorkerUrl || null,
    corsWorkerUrl: corsWorkerUrl || null,
    baseUrl,
    endpoint,
    windowOrigin: windowOrigin || null,
    endpointOrigin: endpointOrigin || null,
  });

  const attemptUploadForCandidate = async ({
    candidate,
    buildRequestInit,
    hasFormData = false,
    bodyBytes = null,
    attemptIndex = 0,
  } = {}) => {
    const candidateBaseUrl = normalizeWorkerBaseUrl(candidate?.workerUrl || '');
    const candidateEndpoint = `${candidateBaseUrl.replace(/\/+$/, '')}/arweave/upload`;
    const t0 = Date.now();
    log.info('[arweave][client] fetch start', {
      requestId,
      method: 'POST',
      contentType,
      hasFormData: !!hasFormData,
      bodyBytes,
      skipAuth: !!opts?.skipAuth,
      sessionSlug: candidate?.sessionSlug || '',
      workerUrl: candidateBaseUrl,
      endpoint: candidateEndpoint,
      attemptIndex,
      ts: new Date().toISOString(),
    });

    let response;
    try {
      response = await requestWithAuth(candidateEndpoint, buildRequestInit(), {
        sessionSlug: candidate?.sessionSlug || '',
        workerUrl: candidateBaseUrl,
      });
    } catch (err) {
      const message = String(err?.message || err || 'network error');
      log.error('[arweave][client] fetch error', {
        requestId,
        message,
        name: err?.name,
        durationMs: Date.now() - t0,
        sessionSlug: candidate?.sessionSlug || '',
        workerUrl: candidateBaseUrl,
        endpoint: candidateEndpoint,
        attemptIndex,
        ts: new Date().toISOString(),
      });
      emitArweaveUploadFallbackTelemetry({
        requestId,
        sessionSlug: candidate?.sessionSlug || '',
        workerUrl: candidateBaseUrl,
        gateStatus: candidate?.gateStatus || 'unknown',
        reason: candidate?.reason || 'unknown',
        responseStatus: null,
        attemptIndex,
        error: message,
      });
      return {
        ok: false,
        status: null,
        endpoint: candidateEndpoint,
        message,
        shouldFallback: shouldFallbackUploadCandidate({ message }),
        networkError: true,
      };
    }

    log.info('[arweave][client] fetch done', {
      requestId,
      status: response?.status,
      ok: response?.ok,
      durationMs: Date.now() - t0,
      sessionSlug: candidate?.sessionSlug || '',
      workerUrl: candidateBaseUrl,
      endpoint: candidateEndpoint,
      attemptIndex,
      ts: new Date().toISOString(),
    });

    let payload = await parseWorkerUploadResponseJson(response);
    let message =
      payload?.error || payload?.message || (response.ok ? '' : `Arweave upload failed (${response.status})`);

    if (!response.ok && arweaveJwkValue && isWorkerMissingSessionSecretsError(message)) {
      log.info('[arweave][client] bootstrap retry', {
        requestId,
        sessionSlug: candidate?.sessionSlug || '',
        workerUrl: candidateBaseUrl,
        endpoint: candidateEndpoint,
        attemptIndex,
        mode: opts?.skipAuth ? 'bootstrap-upload' : 'authenticated-upload',
      });
      try {
        const bootstrapResponse = opts?.skipAuth
          ? await fetch(candidateEndpoint, buildRequestInit())
          : await requestWithAuth(candidateEndpoint, buildRequestInit(), {
              sessionSlug: candidate?.sessionSlug || '',
              workerUrl: candidateBaseUrl,
            });
        const bootstrapPayload = await parseWorkerUploadResponseJson(bootstrapResponse);
        const bootstrapMessage =
          bootstrapPayload?.error ||
          bootstrapPayload?.message ||
          (bootstrapResponse.ok ? '' : `Arweave upload failed (${bootstrapResponse.status})`);
        response = bootstrapResponse;
        payload = bootstrapPayload;
        message = bootstrapMessage;
      } catch (err) {
        const bootstrapError = String(err?.message || err || 'network error');
        return {
          ok: false,
          status: null,
          endpoint: candidateEndpoint,
          message: bootstrapError,
          shouldFallback: shouldFallbackUploadCandidate({ message: bootstrapError }),
          networkError: true,
        };
      }
    }

    if (!response.ok && arweaveJwkValue && isWorkerMissingSessionSecretsError(message)) {
      log.info('[arweave][client] direct upload retry', {
        requestId,
        sessionSlug: candidate?.sessionSlug || '',
        workerUrl: candidateBaseUrl,
        endpoint: candidateEndpoint,
        attemptIndex,
      });
      try {
        const directId = await uploadDirectToArweave({
          data,
          contentType,
          tags,
          arweaveJwk: arweaveJwkValue,
          requestId,
        });
        return {
          ok: true,
          id: directId,
        };
      } catch (err) {
        return {
          ok: false,
          status: null,
          endpoint: candidateEndpoint,
          message: String(err?.message || err || 'Arweave direct upload failed.'),
          shouldFallback: false,
          networkError: false,
        };
      }
    }

    emitArweaveUploadFallbackTelemetry({
      requestId,
      sessionSlug: candidate?.sessionSlug || '',
      workerUrl: candidateBaseUrl,
      gateStatus: candidate?.gateStatus || 'unknown',
      reason: candidate?.reason || 'unknown',
      responseStatus: Number(response?.status || 0) || null,
      attemptIndex,
      error: message || undefined,
    });

    if (!response.ok) {
      return {
        ok: false,
        status: Number(response?.status || 0) || null,
        endpoint: candidateEndpoint,
        message,
        shouldFallback: shouldFallbackUploadCandidate({ message }),
        networkError: false,
      };
    }

    const rawId = payload?.id || payload?.txId || payload?.arweaveTxId || payload?.url || payload?.arweaveUrl || '';
    const normalizedId = normalizeArweaveUploadId(rawId);
    if (!normalizedId) {
      return {
        ok: false,
        status: Number(response?.status || 0) || null,
        endpoint: candidateEndpoint,
        message: 'Arweave upload succeeded but no tx id was returned by worker.',
        shouldFallback: false,
        networkError: false,
      };
    }
    return {
      ok: true,
      id: normalizedId,
    };
  };

  const runUploadAttempts = async ({ buildRequestInit, hasFormData = false, bodyBytes = null } = {}) => {
    let fallbackTriggered = false;
    let attemptCount = 0;
    let lastError = null;
    const maxTransientAttemptsPerCandidate = 3;

    for (let index = 0; index < uploadCandidates.length; index += 1) {
      if (index > 0 && !fallbackTriggered) break;
      const candidate = uploadCandidates[index];
      for (let transientAttempt = 1; transientAttempt <= maxTransientAttemptsPerCandidate; transientAttempt += 1) {
        attemptCount += 1;
        const result = await attemptUploadForCandidate({
          candidate,
          buildRequestInit,
          hasFormData,
          bodyBytes,
          attemptIndex: index * maxTransientAttemptsPerCandidate + transientAttempt - 1,
        });
        if (result.ok) return result.id;

        const rawMessage = String(result?.message || '').trim();
        let error = null;
        if (rawMessage.includes('Arweave key not configured')) {
          error = new Error('No Arweave key configured in the worker.');
        } else if (result?.networkError) {
          error = new Error(`Arweave upload network error (${result.endpoint}): ${rawMessage || 'network error'}`);
        } else {
          error = new Error(rawMessage || `Arweave upload failed (${result?.status || 'unknown'})`);
        }
        error.status = result?.status ?? null;
        error.sessionSlug = candidate?.sessionSlug || '';
        error.workerUrl = candidate?.workerUrl || '';
        lastError = error;

        if (
          isTransientWorkerUploadError({
            message: rawMessage,
            status: result?.status,
          }) &&
          transientAttempt < maxTransientAttemptsPerCandidate
        ) {
          // Keep retrying the same worker briefly for transient upstream pricing/routing failures.
          // These happen in live no-mock runs and usually settle within a couple of quick retries.

          await sleep(750 * transientAttempt);
          continue;
        }

        if (result?.shouldFallback) {
          fallbackTriggered = true;
          break;
        }
        if (!fallbackTriggered) {
          throw error;
        }
        break;
      }
    }

    if (!lastError) {
      throw new Error('Arweave upload failed: no worker candidates available.');
    }
    if (fallbackTriggered && uploadCandidates.length > 1) {
      const exhaustedError = new Error(
        `${lastError.message} (worker fallback exhausted after ${attemptCount} attempt${attemptCount === 1 ? '' : 's'})`,
      );
      exhaustedError.cause = lastError;
      throw exhaustedError;
    }
    throw lastError;
  };

  // File/Blob route
  if (typeof File !== 'undefined' && (data instanceof File || data instanceof Blob)) {
    const buildFormRequestInit = () => {
      const form = new FormData();
      form.append('file', data, data.name || `upload.${(format || '').toString().toLowerCase() || 'bin'}`);
      form.append('contentType', contentType);
      form.append('requestId', requestId);
      if (resolvedSessionSlug) {
        form.append('sessionSlug', resolvedSessionSlug);
      }
      if (tags) {
        try {
          form.append('tags', JSON.stringify(tags));
        } catch (e) {
          log.warn('arweaveScripts: fallback', e);
        }
      }
      if (arweaveJwkValue) form.append('arweaveJwk', arweaveJwkValue);
      if (adminAuth) {
        Object.entries(adminAuth).forEach(([key, value]) => {
          if (value == null) return;
          form.append(key, String(value));
        });
      }
      return { method: 'POST', body: form };
    };
    return await runUploadAttempts({
      buildRequestInit: buildFormRequestInit,
      hasFormData: true,
      bodyBytes: typeof data?.size === 'number' ? data.size : null,
    });
  }

  // JSON/string route
  const payload = contentType === 'application/json' && typeof data !== 'string' ? JSON.stringify(data) : String(data);

  const body = {
    data: payload,
    contentType,
    requestId,
    ...(resolvedSessionSlug ? { sessionSlug: resolvedSessionSlug } : {}),
    ...(tags ? { tags } : {}),
    ...(adminAuth || {}),
    ...(arweaveJwkValue ? { arweaveJwk: arweaveJwkValue } : {}),
  };
  const bodyJson = JSON.stringify(body);
  return await runUploadAttempts({
    buildRequestInit: () => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyJson,
    }),
    hasFormData: false,
    bodyBytes: bodyJson.length,
  });
}

async function downloadDataFromArweave(txID, opts = {}) {
  if (!txID) throw new Error('Missing Arweave txID');
  const normalizedTxId = normalizeArweaveUploadId(txID);
  const cacheBypass = !!opts?.bypassCache;
  const bypassFailureCache = cacheBypass || !!opts?.bypassFailureCache;
  const debugContext = normalizeArweaveDebugContext(opts?.debugContext);
  const stopOnFirst404 = shouldStopOnFirstNotFound(opts, debugContext);
  const preflightDecision = resolvePreflightTxExistenceDecision(opts, debugContext);
  const preflightTxExistence = preflightDecision.enabled;
  const runtimeDiagnostics = readArweaveRuntimeDiagnostics();
  const inFlightKey = normalizedTxId;
  registerArweaveTxContext(normalizedTxId, {
    category:
      String(debugContext?.category || '')
        .trim()
        .toLowerCase() || 'unknown',
    caller: String(debugContext?.caller || debugContext?.fn || '').trim(),
    source: 'gateway_fetch',
  });
  ensureArweaveResourceErrorListener();
  logArweaveFetchDebug(
    'debug',
    '[arweave] preflight-decision',
    {
      txId: normalizedTxId,
      enabled: preflightTxExistence,
      source: preflightDecision.source,
      shortCircuitNotFound: stopOnFirst404,
      ...runtimeDiagnostics,
      ...(debugContext || {}),
    },
    opts,
    debugContext,
  );

  if (!cacheBypass) {
    const cached = getArweaveTextCacheEntry(normalizedTxId);
    if (cached && typeof cached.text === 'string') return cached.text;
    if (arweaveTextInFlight.has(inFlightKey)) {
      return await arweaveTextInFlight.get(inFlightKey);
    }
  }

  if (!bypassFailureCache) {
    const failureEntry = getFailureCacheEntry(normalizedTxId);
    if (failureEntry && Number(failureEntry.nextRetryAtMs || 0) > Date.now()) {
      const cooldownErr = buildFailureCacheError({
        txId: normalizedTxId,
        failureEntry,
      });
      logArweaveFetchDebug(
        'warn',
        '[arweave] tx-fetch-cooldown-hit',
        {
          txId: normalizedTxId,
          status: cooldownErr.status,
          kind: cooldownErr.kind,
          attempts: Number(failureEntry.attempts || 0),
          nextRetryAtMs: Number(failureEntry.nextRetryAtMs || 0),
          shortCircuitedByFailureCache: true,
          ...runtimeDiagnostics,
          ...(debugContext || {}),
        },
        opts,
        debugContext,
      );
      throw cooldownErr;
    }
    if (failureEntry && Number(failureEntry.nextRetryAtMs || 0) <= Date.now()) {
      clearFailureCacheEntry(normalizedTxId);
    }
  }

  const run = (async () => {
    const gateways = resolveDownloadGatewaysForContext(opts, debugContext);
    const retries = Number.isFinite(opts.retries) ? Math.max(0, opts.retries) : 3;
    const retryDelayMs = Number.isFinite(opts.retryDelayMs) ? opts.retryDelayMs : 1500;
    // Guard against a single hung gateway request stalling the entire read path.
    const gatewayTimeoutMs = Number.isFinite(opts.gatewayTimeoutMs)
      ? Math.max(300, Number(opts.gatewayTimeoutMs))
      : 8000;

    let lastStatus = null;
    let lastError = null;
    let lastRetryableNonNotFoundError = null;
    let sawRetryableNonNotFoundOverall = false;
    const directToArIo = resolveDirectToArIoForContext(opts, debugContext);
    const attemptedUrlsAcrossAllPasses = new Set();
    try {
      if (preflightTxExistence) {
        const exists = await checkArweaveTxExistsViaGraphql(normalizedTxId, opts, debugContext);
        if (exists === false) {
          throw createArweaveFetchError({
            txId: normalizedTxId,
            status: 404,
            retryable: true,
            kind: 'not_found',
            gateway: 'graphql',
            attempt: 0,
            message: 'Arweave content not available yet. Retry later.',
          });
        }
      }

      if (directToArIo) {
        // Troubleshooting mode stays on ar.io for the full retry budget and
        // never falls through to the legacy gateway fanout.
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          const arIoOnlyResult = await tryWayfinderFallback({
            txId: normalizedTxId,
            opts,
            debugContext,
            attempt,
            gatewayTimeoutMs,
            attemptedUrls: new Set(),
            allAttemptedUrls: attemptedUrlsAcrossAllPasses,
          });
          if (
            arIoOnlyResult?.ok &&
            typeof arIoOnlyResult.text === 'string' &&
            !isEmptyGatewayResponseText(arIoOnlyResult.text)
          ) {
            logArweaveFetchDebug(
              'log',
              '[arweave] ar.io-only hit',
              {
                txId: normalizedTxId,
                route: arIoOnlyResult.route,
                gateway: arIoOnlyResult.gateway,
                resolvedUrl: arIoOnlyResult.resolvedUrl,
                attempt,
                ...runtimeDiagnostics,
                ...(debugContext || {}),
              },
              opts,
              debugContext,
            );
            if (!cacheBypass) setArweaveTextCacheEntry(normalizedTxId, arIoOnlyResult.text);
            if (!bypassFailureCache) clearFailureCacheEntry(normalizedTxId);
            return arIoOnlyResult.text;
          }
          if (arIoOnlyResult?.error && arIoOnlyResult.error.name === 'ArweaveFetchError') {
            lastError = arIoOnlyResult.error;
            if (Number.isFinite(Number(arIoOnlyResult.error.status))) {
              lastStatus = Number(arIoOnlyResult.error.status);
            }
            if (arIoOnlyResult.sawRetryableNonNotFound) {
              sawRetryableNonNotFoundOverall = true;
            }
            if (arIoOnlyResult.error.kind !== 'not_found' && arIoOnlyResult.error.status !== 404) {
              lastRetryableNonNotFoundError = arIoOnlyResult.error;
              sawRetryableNonNotFoundOverall = true;
            }
            logArweaveFetchDebug(
              'warn',
              '[arweave] ar.io-only miss',
              {
                txId: normalizedTxId,
                status: arIoOnlyResult.error.status,
                kind: arIoOnlyResult.error.kind,
                retryable: arIoOnlyResult.error.retryable,
                resolvedUrl: arIoOnlyResult.resolvedUrl,
                attempt,
                ...(debugContext || {}),
              },
              opts,
              debugContext,
            );
            if (
              arIoOnlyResult.error.retryable === false &&
              arIoOnlyResult.error.kind !== 'not_found' &&
              arIoOnlyResult.error.status !== 404
            ) {
              throw arIoOnlyResult.error;
            }
          }
          if (attempt < retries) {
            const delay = Math.round(retryDelayMs * Math.pow(1.6, attempt));
            await sleep(delay);
          }
        }
      } else {
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          const attemptedUrlsThisAttempt = new Set();
          let sawNotFoundThisAttempt = false;
          let sawRetryableNonNotFound = false;
          let shouldStopGatewayFanout = false;
          const gatewaysForAttempt = getAvailableGatewaysForAttempt(gateways);
          for (const gateway of gatewaysForAttempt) {
            const gatewayUrls = buildArweaveGatewayRouteCandidates(normalizedTxId, gateway, opts);
            for (let routeIndex = 0; routeIndex < gatewayUrls.length; routeIndex += 1) {
              const { url, route } = gatewayUrls[routeIndex];
              const hasNextRoute = routeIndex < gatewayUrls.length - 1;
              try {
                if (attemptedUrlsThisAttempt.has(url)) continue;
                attemptedUrlsThisAttempt.add(url);
                attemptedUrlsAcrossAllPasses.add(url);
                const resp = await fetchWithTimeout(url, { redirect: 'follow' }, gatewayTimeoutMs);
                if (resp.ok) {
                  const text = await resp.text();
                  if (isEmptyGatewayResponseText(text)) {
                    throw createEmptyGatewayResponseError({
                      txId: normalizedTxId,
                      gateway,
                      attempt,
                    });
                  }
                  const contentType = String(resp?.headers?.get?.('content-type') || '')
                    .trim()
                    .toLowerCase();
                  const derivedStatus = looksLikeHtmlGatewayPayload({ text, contentType })
                    ? inferStatusFromHtmlGatewayPayload(text)
                    : null;
                  if (derivedStatus != null) {
                    const kind = classifyStatusKind(derivedStatus);
                    const retryable = isRetryableStatus(derivedStatus);
                    lastStatus = derivedStatus;
                    lastError = createArweaveFetchError({
                      txId: normalizedTxId,
                      status: derivedStatus,
                      retryable,
                      kind,
                      gateway,
                      attempt,
                      message: `Arweave gateway returned HTML payload (${derivedStatus})`,
                    });
                    markGatewayFailure(gateway, { status: derivedStatus, kind });
                    logArweaveFetchDebug(
                      'warn',
                      '[arweave] gateway html payload',
                      {
                        txId: normalizedTxId,
                        gateway,
                        route,
                        status: derivedStatus,
                        kind,
                        retryable,
                        attempt,
                        ...(debugContext || {}),
                      },
                      opts,
                      debugContext,
                    );
                    if (derivedStatus === 404) {
                      if (hasNextRoute) continue;
                      sawNotFoundThisAttempt = true;
                      if (stopOnFirst404) shouldStopGatewayFanout = true;
                      break;
                    }
                    if (!retryable) {
                      throw lastError;
                    }
                    sawRetryableNonNotFound = true;
                    continue;
                  }
                  markGatewaySuccess(gateway);
                  logArweaveFetchDebug(
                    'log',
                    '[arweave] gateway hit',
                    {
                      txId: normalizedTxId,
                      gateway,
                      route,
                      resolvedUrl: url,
                      attempt,
                      ...runtimeDiagnostics,
                      ...(debugContext || {}),
                    },
                    opts,
                    debugContext,
                  );
                  if (!cacheBypass) setArweaveTextCacheEntry(normalizedTxId, text);
                  if (!bypassFailureCache) clearFailureCacheEntry(normalizedTxId);
                  return text;
                }
                lastStatus = resp.status;
                const kind = classifyStatusKind(resp.status);
                const retryable = isRetryableStatus(resp.status);
                lastError = createArweaveFetchError({
                  txId: normalizedTxId,
                  status: resp.status,
                  retryable,
                  kind,
                  gateway,
                  attempt,
                  message: `Arweave fetch failed (${resp.status})`,
                });
                markGatewayFailure(gateway, { status: resp.status, kind });
                logArweaveFetchDebug(
                  'warn',
                  '[arweave] gateway miss',
                  {
                    txId: normalizedTxId,
                    gateway,
                    route,
                    status: resp.status,
                    kind,
                    retryable,
                    attempt,
                    ...(debugContext || {}),
                  },
                  opts,
                  debugContext,
                );
                if (resp.status === 404) {
                  if (hasNextRoute) continue;
                  sawNotFoundThisAttempt = true;
                  const category =
                    String(debugContext?.category || '')
                      .trim()
                      .toLowerCase() || 'unknown';
                  const caller = String(debugContext?.caller || debugContext?.fn || '').trim() || null;
                  const dedupeKey = `gateway-404|${normalizedTxId}|${category}`;
                  if (dedupeTxEvent(dedupeKey)) {
                    log.warn('[arweave] tx-fetch-404-classified', {
                      txId: normalizedTxId,
                      category,
                      caller,
                      gateway,
                      route,
                      attempt,
                    });
                  }
                  if (stopOnFirst404) shouldStopGatewayFanout = true;
                  break;
                }
                if (!retryable) {
                  throw lastError;
                }
                sawRetryableNonNotFound = true;
                sawRetryableNonNotFoundOverall = true;
                lastRetryableNonNotFoundError = lastError;
                if (hasNextRoute) continue;
                break;
              } catch (err) {
                if (err && err.name === 'ArweaveFetchError') {
                  lastError = err;
                  if (err.retryable === false) throw err;
                  if (err.status === 404 || err.kind === 'not_found') {
                    if (hasNextRoute) continue;
                    sawNotFoundThisAttempt = true;
                    if (stopOnFirst404) shouldStopGatewayFanout = true;
                  } else {
                    sawRetryableNonNotFound = true;
                    sawRetryableNonNotFoundOverall = true;
                    lastRetryableNonNotFoundError = err;
                  }
                } else {
                  lastError = createArweaveFetchError({
                    txId: normalizedTxId,
                    status: null,
                    retryable: true,
                    kind: 'network',
                    gateway,
                    attempt,
                    message: err?.message || 'Arweave network request failed',
                    cause: err,
                  });
                  sawRetryableNonNotFound = true;
                  sawRetryableNonNotFoundOverall = true;
                  lastRetryableNonNotFoundError = lastError;
                }
                markGatewayFailure(gateway, { status: lastError?.status, kind: lastError?.kind || 'network' });
                logArweaveFetchDebug(
                  'warn',
                  '[arweave] gateway error',
                  {
                    txId: normalizedTxId,
                    gateway,
                    route,
                    status: lastError?.status ?? null,
                    kind: lastError?.kind || 'network',
                    retryable: lastError?.retryable !== false,
                    attempt,
                    ...(debugContext || {}),
                  },
                  opts,
                  debugContext,
                );
                if (!hasNextRoute) break;
              }
            }
            if (shouldStopGatewayFanout) break;
          }
          // 404s are common for immutable missing txs; avoid repeated multi-attempt hammering
          // if every gateway in this round reported "not found".
          if (sawNotFoundThisAttempt && (stopOnFirst404 || !sawRetryableNonNotFound)) {
            break;
          }
          if (attempt < retries) {
            const delay = Math.round(retryDelayMs * Math.pow(1.6, attempt));
            await sleep(delay);
          }
        }

        const wayfinderResult = await tryWayfinderFallback({
          txId: normalizedTxId,
          opts,
          debugContext,
          attempt: retries + 1,
          gatewayTimeoutMs,
          attemptedUrls: attemptedUrlsAcrossAllPasses,
          allAttemptedUrls: attemptedUrlsAcrossAllPasses,
        });
        if (
          wayfinderResult?.ok &&
          typeof wayfinderResult.text === 'string' &&
          !isEmptyGatewayResponseText(wayfinderResult.text)
        ) {
          logArweaveFetchDebug(
            'log',
            '[arweave] wayfinder fallback hit',
            {
              txId: normalizedTxId,
              route: wayfinderResult.route,
              gateway: wayfinderResult.gateway,
              resolvedUrl: wayfinderResult.resolvedUrl,
              ...runtimeDiagnostics,
              ...(debugContext || {}),
            },
            opts,
            debugContext,
          );
          if (!cacheBypass) setArweaveTextCacheEntry(normalizedTxId, wayfinderResult.text);
          if (!bypassFailureCache) clearFailureCacheEntry(normalizedTxId);
          return wayfinderResult.text;
        }
        if (wayfinderResult?.error && wayfinderResult.error.name === 'ArweaveFetchError') {
          lastError = wayfinderResult.error;
          if (Number.isFinite(Number(wayfinderResult.error.status))) {
            lastStatus = Number(wayfinderResult.error.status);
          }
          if (wayfinderResult.sawRetryableNonNotFound) {
            sawRetryableNonNotFoundOverall = true;
          }
          if (wayfinderResult.error.kind !== 'not_found' && wayfinderResult.error.status !== 404) {
            lastRetryableNonNotFoundError = wayfinderResult.error;
            sawRetryableNonNotFoundOverall = true;
          }
          logArweaveFetchDebug(
            'warn',
            '[arweave] wayfinder fallback miss',
            {
              txId: normalizedTxId,
              status: wayfinderResult.error.status,
              kind: wayfinderResult.error.kind,
              retryable: wayfinderResult.error.retryable,
              resolvedUrl: wayfinderResult.resolvedUrl,
              ...(debugContext || {}),
            },
            opts,
            debugContext,
          );
        }
      }

      if ((lastStatus === 404 || lastStatus === 202) && !sawRetryableNonNotFoundOverall) {
        throw createArweaveFetchError({
          txId: normalizedTxId,
          status: lastStatus,
          retryable: true,
          kind: lastStatus === 404 ? 'not_found' : 'pending',
          message: 'Arweave content not available yet. Retry later.',
          cause: lastError,
        });
      }
      if (lastRetryableNonNotFoundError && lastRetryableNonNotFoundError.name === 'ArweaveFetchError') {
        throw lastRetryableNonNotFoundError;
      }
      if (lastError && lastError.name === 'ArweaveFetchError') throw lastError;
      throw createArweaveFetchError({
        txId: normalizedTxId,
        status: lastStatus,
        retryable: true,
        kind: 'unknown',
        message: lastError?.message || 'Arweave fetch failed',
        cause: lastError,
      });
    } catch (error) {
      if (!bypassFailureCache && error && error.name === 'ArweaveFetchError') {
        const entry = recordFailureCacheEntry(normalizedTxId, error, { debugContext });
        if (entry) {
          error.nextRetryAtMs = Number(entry.nextRetryAtMs || 0);
          error.failureAttempts = Number(entry.attempts || 0);
        }
      }
      throw error;
    }
  })();

  if (!cacheBypass) {
    arweaveTextInFlight.set(inFlightKey, run);
  }
  try {
    return await run;
  } finally {
    if (!cacheBypass && arweaveTextInFlight.get(inFlightKey) === run) {
      arweaveTextInFlight.delete(inFlightKey);
    }
  }
}

function padBase64String(b64string) {
  const remainder = b64string.length % 4;
  return remainder === 0 ? b64string : `${b64string}${'='.repeat(4 - remainder)}`;
}

function encodeBytesToBase64(byteArray) {
  const bytes = byteArray instanceof Uint8Array ? byteArray : Uint8Array.from(byteArray);
  if (typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return globalThis.btoa(binary);
  }
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(bytes).toString('base64');
  }
  throw new Error('No base64 encoder is available.');
}

function decodeBase64ToBytes(b64string) {
  const padded = padBase64String(b64string);
  if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Uint8Array.from(Buffer.from(padded, 'base64'));
  }
  throw new Error('No base64 decoder is available.');
}

function hexToBase64url(hexString) {
  if (!hexString || hexString === '0x') return '';
  let byteArray = ethers.utils.arrayify(hexString);
  let b64string = encodeBytesToBase64(byteArray);
  let b64urlstring = b64string.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b64urlstring;
}

function base64urlToHex(b64urlstring) {
  if (!b64urlstring) return '0x';
  let byteArray = base64DecodeURL(b64urlstring);
  let hexString = ethers.utils.hexlify(byteArray);
  return hexString;
}

function base64DecodeURL(b64urlstring) {
  let b64string = b64urlstring.replace(/-/g, '+').replace(/_/g, '/');
  let byteArray = decodeBase64ToBytes(b64string);
  return byteArray;
}

function base64urlToBase64(b64urlstring) {
  let b64string = b64urlstring.replace(/-/g, '+').replace(/_/g, '/');
  return b64string;
}

export const arweaveClient = {
  buildArweaveGatewayUrl,
  uploadDataToArweave,
  downloadDataFromArweave,
  registerTxContext: (txId, context = {}) => {
    registerArweaveTxContext(txId, context);
    ensureArweaveResourceErrorListener();
  },
  checkTxExists: async (txId, opts = {}) => {
    const normalizedTxId = normalizeArweaveUploadId(txId);
    if (!normalizedTxId) return null;
    const debugContext = normalizeArweaveDebugContext(opts?.debugContext);
    const preflightDecision = resolvePreflightTxExistenceDecision(opts, debugContext);
    if (!preflightDecision.enabled) return null;
    return await checkArweaveTxExistsViaGraphql(normalizedTxId, opts, debugContext);
  },
  readArweaveWalletBalance: async (jwk, opts = {}) => {
    const { gatewayBase, init } = getArweaveGatewayClientConfig(opts?.gateway);
    const arweave = Arweave.init(init);
    const address = await arweave.wallets.jwkToAddress(jwk);
    const balanceUrl = `${gatewayBase}/wallet/${address}/balance`;
    const response = await fetch(balanceUrl);
    const winston = String(await response.text()).trim();
    if (!response.ok) throw new Error('Failed to fetch Arweave balance.');
    if (!/^\d+$/.test(winston)) throw new Error('Invalid Arweave balance.');
    return {
      address,
      balanceUrl,
      gatewayBase,
      winston,
    };
  },
  formatWinstonToAr,
  hexToBase64url,
  base64urlToHex,
  base64DecodeURL,
  base64urlToBase64,
};
