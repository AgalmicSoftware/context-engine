/**
 * @file arweaveUrls.js
 * @module arweaveUrls
 * @description Arweave gateway URL construction and transaction ID parsing.
 *              Normalizes Arweave URLs across gateway providers and validates transaction IDs.
 *
 * Key exports: normalizeArweaveUrl, parseArweaveTxId, isArweaveTxId, arweaveUrlUtils
 */
import { arweaveClient } from './arweaveClient.js';
import { ARWEAVE_GATEWAY_URL, CE_ARWEAVE_AR_IO_URL, CE_ARWEAVE_DIRECT_TO_AR_IO } from '../../variables/appConfig.js';
import {
  ARWEAVE_DEFAULT_GATEWAY_CANDIDATES,
  ARWEAVE_GATEWAY_EXACT_HOSTS,
  ARWEAVE_GATEWAY_HOST_SUFFIXES,
} from '../../variables/arweaveGateways.js';
import { toStr } from '../shared/primitives.js';
import { createLogger } from '../logging.js';

const log = createLogger('arweaveUrls');

const ARWEAVE_TXID_RE = /^[a-z0-9_-]{43}$/i;
export const DEFAULT_ARWEAVE_LINK_GATEWAY =
  toStr(ARWEAVE_DEFAULT_GATEWAY_CANDIDATES?.[0]).trim() || 'https://arweave.net';
export const DEFAULT_AR_IO_GATEWAY = 'https://ar-io.dev';

const KNOWN_GATEWAY_EXACT_HOST_SET = new Set(
  (Array.isArray(ARWEAVE_GATEWAY_EXACT_HOSTS) ? ARWEAVE_GATEWAY_EXACT_HOSTS : [])
    .map((host) => toStr(host).trim().toLowerCase())
    .filter(Boolean),
);

const KNOWN_GATEWAY_HOST_SUFFIXES = (Array.isArray(ARWEAVE_GATEWAY_HOST_SUFFIXES) ? ARWEAVE_GATEWAY_HOST_SUFFIXES : [])
  .map((suffix) => toStr(suffix).trim().toLowerCase())
  .filter(Boolean);

export const isArweaveGatewayHost = (hostRaw: unknown): boolean => {
  const host = toStr(hostRaw).trim().toLowerCase();
  if (!host) return false;
  if (KNOWN_GATEWAY_EXACT_HOST_SET.has(host)) return true;
  return KNOWN_GATEWAY_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
};

export const readArweaveTxIdFromPathSegments = (segments: unknown[] = []): string => {
  const parts = Array.isArray(segments) ? segments.map((segment) => toStr(segment).trim()).filter(Boolean) : [];
  if (!parts.length) return '';
  const directCandidate = parts[parts.length - 1] || '';
  if (ARWEAVE_TXID_RE.test(directCandidate)) return directCandidate;
  const maybeTxDataRoute =
    parts.length >= 3 &&
    toStr(parts[parts.length - 3])
      .trim()
      .toLowerCase() === 'tx' &&
    toStr(parts[parts.length - 1])
      .trim()
      .toLowerCase() === 'data';
  if (!maybeTxDataRoute) return '';
  const txDataCandidate = parts[parts.length - 2] || '';
  return ARWEAVE_TXID_RE.test(txDataCandidate) ? txDataCandidate : '';
};

export const normalizeGatewayBase = (value: unknown): string => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const path = toStr(parsed.pathname).trim().replace(/\/+$/, '');
    return `${parsed.origin}${path}`;
  } catch {
    return '';
  }
};

export const normalizeGatewayList = (rawList: unknown[] = []): string[] => {
  const out: string[] = [];
  const seen = new Set();
  (Array.isArray(rawList) ? rawList : []).forEach((entry) => {
    const normalized = normalizeGatewayBase(entry);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

export const normalizeBoolish = (value: unknown, defaultValue = false): boolean => {
  if (typeof value === 'boolean') return value;
  const raw = toStr(value).trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true;
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
  return defaultValue;
};

export const getRuntimeArweaveGatewayOverride = (): string => {
  try {
    if (typeof globalThis === 'undefined') return '';
    return normalizeGatewayBase((globalThis as Record<string, unknown>).CE_ARWEAVE_GATEWAY_URL);
  } catch {
    return '';
  }
};

export const getRuntimeArweaveGatewayFallbacks = (): string[] => {
  try {
    if (typeof globalThis === 'undefined') return [];
    const raw = (globalThis as Record<string, unknown>).CE_ARWEAVE_GATEWAYS;
    if (Array.isArray(raw)) return normalizeGatewayList(raw);
    const text = toStr(raw).trim();
    if (!text) return [];
    return normalizeGatewayList(text.split(/[\s,]+/).filter(Boolean));
  } catch {
    return [];
  }
};

export const isDirectToArIoEnabled = (opts: { directToArIo?: boolean } = {}): boolean => {
  if (typeof opts?.directToArIo === 'boolean') return opts.directToArIo;
  try {
    const runtimeGlobal = globalThis as Record<string, unknown>;
    if (typeof globalThis !== 'undefined' && typeof runtimeGlobal.CE_ARWEAVE_DIRECT_TO_AR_IO !== 'undefined') {
      return normalizeBoolish(runtimeGlobal.CE_ARWEAVE_DIRECT_TO_AR_IO, !!CE_ARWEAVE_DIRECT_TO_AR_IO);
    }
  } catch (e) {
    void e; /* fallback to static config. */
  }
  return !!CE_ARWEAVE_DIRECT_TO_AR_IO;
};

export const getRuntimeArIoGatewayOverride = (): string => {
  try {
    if (typeof globalThis === 'undefined') return '';
    return normalizeGatewayBase((globalThis as Record<string, unknown>).CE_ARWEAVE_AR_IO_URL);
  } catch {
    return '';
  }
};

export const getPreferredArIoGateway = (gatewayOverride: unknown = ''): string =>
  normalizeGatewayBase(gatewayOverride) ||
  getRuntimeArIoGatewayOverride() ||
  normalizeGatewayBase(CE_ARWEAVE_AR_IO_URL) ||
  DEFAULT_AR_IO_GATEWAY;

export const getPreferredArweaveGateway = (gatewayOverride: unknown = ''): string =>
  normalizeGatewayBase(gatewayOverride) ||
  getRuntimeArweaveGatewayOverride() ||
  (isDirectToArIoEnabled() ? getPreferredArIoGateway() : '') ||
  normalizeGatewayBase(ARWEAVE_GATEWAY_URL) ||
  DEFAULT_ARWEAVE_LINK_GATEWAY;

export const getDefaultArweaveGateways = (
  opts: { directToArIo?: boolean; arIoGateway?: unknown; gateway?: unknown } = {},
): string[] =>
  isDirectToArIoEnabled(opts)
    ? normalizeGatewayList([getPreferredArIoGateway(opts?.arIoGateway)])
    : normalizeGatewayList([
        getPreferredArweaveGateway(opts?.gateway),
        ...getRuntimeArweaveGatewayFallbacks(),
        ...ARWEAVE_DEFAULT_GATEWAY_CANDIDATES,
      ]);

export const isArweaveTxId = (value: unknown): boolean => ARWEAVE_TXID_RE.test(toStr(value).trim());

export const parseArweaveTxId = (
  value: unknown,
  {
    allowQueryParams = false,
    allowUnknownGatewayHost = false,
  }: {
    allowQueryParams?: boolean;
    allowUnknownGatewayHost?: boolean;
  } = {},
): string => {
  const raw = toStr(value).trim();
  if (!raw) return '';

  if (raw.startsWith('ar://')) {
    const candidate = raw.slice(5).split(/[/?#]/)[0] || '';
    return isArweaveTxId(candidate) ? candidate : '';
  }

  try {
    const parsed = new URL(raw);
    const host = toStr(parsed.hostname).trim().toLowerCase();
    const segments = parsed.pathname.split('/').filter(Boolean);
    const candidate = readArweaveTxIdFromPathSegments(segments);
    const queryCandidate = allowQueryParams
      ? toStr(parsed.searchParams?.get?.('tx') || parsed.searchParams?.get?.('id') || '').trim()
      : '';

    if (isArweaveGatewayHost(host)) {
      if (isArweaveTxId(candidate)) return candidate;
      return isArweaveTxId(queryCandidate) ? queryCandidate : '';
    }

    if (allowUnknownGatewayHost) {
      if (isArweaveTxId(candidate)) return candidate;
      if (isArweaveTxId(queryCandidate)) return queryCandidate;
    }
  } catch (e) {
    log.warn('arweaveUrls: fallback', e);
  }

  return isArweaveTxId(raw) ? raw : '';
};

// If `value` is an Arweave txId (or `ar://<txId>` / gateway URL), normalize to a gateway URL.
// Otherwise return the original value unchanged.
export const normalizeArweaveUrl = (
  value: unknown,
  {
    gateway = '',
    contextLabel = 'ui_media',
  }: {
    gateway?: unknown;
    contextLabel?: unknown;
  } = {},
): string => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  const txId = parseArweaveTxId(raw);
  if (!txId) return raw;
  try {
    if (arweaveClient && typeof arweaveClient.registerTxContext === 'function') {
      arweaveClient.registerTxContext(txId, {
        category:
          String(contextLabel || 'ui_media')
            .trim()
            .toLowerCase() || 'ui_media',
        caller: 'normalizeArweaveUrl',
        source: 'ui_resource',
      });
    }
  } catch (e) {
    log.warn('arweaveUrls: fallback', e);
  }
  const base = getPreferredArweaveGateway(gateway);
  return `${base}/${txId}`;
};

export const buildArweaveGatewayUrl = (
  value: unknown,
  options: { gateway?: unknown; contextLabel?: unknown } = {},
): string => normalizeArweaveUrl(value, options);

export const buildArweaveGatewayUrlCandidates = (
  value: unknown,
  { gateway = '' }: { gateway?: unknown } = {},
): string[] => {
  const raw = toStr(value).trim();
  if (!raw) return [];
  const txId = parseArweaveTxId(raw);
  if (!txId) return [raw];

  const gateways = normalizeGatewayList([
    gateway,
    getPreferredArweaveGateway(gateway),
    getRuntimeArweaveGatewayOverride(),
    ...getRuntimeArweaveGatewayFallbacks(),
    ...ARWEAVE_DEFAULT_GATEWAY_CANDIDATES,
  ]);

  if (!gateways.length) return [raw];
  return gateways.map((base) => `${base}/${txId}`);
};

export const arweaveUrlUtils = {
  DEFAULT_ARWEAVE_LINK_GATEWAY,
  DEFAULT_AR_IO_GATEWAY,
  normalizeGatewayBase,
  normalizeGatewayList,
  normalizeBoolish,
  getRuntimeArweaveGatewayOverride,
  getRuntimeArweaveGatewayFallbacks,
  isDirectToArIoEnabled,
  getRuntimeArIoGatewayOverride,
  getPreferredArIoGateway,
  getDefaultArweaveGateways,
  getPreferredArweaveGateway,
  isArweaveGatewayHost,
  isArweaveTxId,
  readArweaveTxIdFromPathSegments,
  parseArweaveTxId,
  normalizeArweaveUrl,
  buildArweaveGatewayUrl,
  buildArweaveGatewayUrlCandidates,
};
