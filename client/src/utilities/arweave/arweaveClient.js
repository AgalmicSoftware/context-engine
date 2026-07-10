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
    log.warn('arweaveClient: telemetry', e);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
        log.warn('arweaveClient: cleanup', e);
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
      log.warn('arweaveClient: fallback', e);
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
    log.warn('arweaveClient: fallback', e);
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
          if (gatewayPayload.reason === 'empty') {
            sawRetryableNonNotFound = true;
            continue;
          }
          const derivedStatus = gatewayPayload.status;
          const kind = gatewayPayload.statusKind;
          const retryable = gatewayPayload.retryable;
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
          log.warn('arweaveClient: fallback', e);
        }
      },
      true,
    );
  } catch (e) {
    log.warn('arweaveClient: fallback', e);
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
      // eslint-disable-next-line no-await-in-loop
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
    const authSlug = normalizeUploadSessionSlug(
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

    let payload = await parseWorkerUploadResponseJson(response, log);
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
        const bootstrapPayload = await parseWorkerUploadResponseJson(bootstrapResponse, log);
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
          // eslint-disable-next-line no-await-in-loop
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
          log.warn('arweaveClient: fallback', e);
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
                  const contentType = String(resp?.headers?.get?.('content-type') || '')
                    .trim()
                    .toLowerCase();
                  const gatewayPayload = classifyArweaveGatewayPayloadResponse({
                    txId: normalizedTxId,
                    gateway,
                    attempt,
                    text,
                    contentType,
                  });
                  if (!gatewayPayload.ok) {
                    if (gatewayPayload.reason === 'empty') {
                      throw gatewayPayload.error;
                    }
                    const derivedStatus = gatewayPayload.status;
                    const kind = gatewayPayload.statusKind;
                    const retryable = gatewayPayload.retryable;
                    lastStatus = derivedStatus;
                    lastError = gatewayPayload.error;
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
                  if (!cacheBypass) setArweaveTextCacheEntry(normalizedTxId, gatewayPayload.text);
                  if (!bypassFailureCache) clearFailureCacheEntry(normalizedTxId);
                  return gatewayPayload.text;
                }
                lastStatus = resp.status;
                const failure = buildArweaveGatewayHttpFailure({
                  txId: normalizedTxId,
                  status: resp.status,
                  gateway,
                  attempt,
                });
                const kind = failure.statusKind;
                const retryable = failure.retryable;
                lastError = failure.error;
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
        const entry = recordFailureCacheEntry(normalizedTxId, error, {
          useShortNotFoundCooldown: shouldUseShortNotFoundCooldown(debugContext),
        });
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
