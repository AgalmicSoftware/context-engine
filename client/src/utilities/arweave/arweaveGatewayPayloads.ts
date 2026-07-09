import {
  DEFAULT_ARWEAVE_LINK_GATEWAY,
  getPreferredArweaveGateway,
  normalizeGatewayBase,
  parseArweaveTxId,
} from './arweaveUrls';

export type ArweaveGatewayClientConfig = {
  gatewayBase: string;
  init: {
    host: string;
    port: number;
    protocol: 'http' | 'https';
  };
};

export type ArweaveTag = {
  name: string;
  value: string;
};

export type ArweaveGatewayRouteCandidate = {
  route: 'direct' | 'raw' | 'tx-data';
  url: string;
};

export const getArweaveGatewayClientConfig = (gatewayOverride = ''): ArweaveGatewayClientConfig => {
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

export const formatWinstonToAr = (winston: unknown, decimals: unknown = 6): string => {
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

export const extractArweaveTxId = (value: unknown): string => {
  return parseArweaveTxId(value, {
    allowQueryParams: true,
    allowUnknownGatewayHost: true,
  });
};

export const normalizeArweaveUploadId = (value: unknown): string => {
  const normalized = extractArweaveTxId(value);
  if (normalized) return normalized;
  return String(value || '').trim();
};

export const buildArweaveGatewayUrl = (txId: unknown, gateway?: unknown): string => {
  const normalizedTxId = normalizeArweaveUploadId(txId);
  if (!normalizedTxId) return '';
  const base = getPreferredArweaveGateway(gateway);
  return `${base}/${normalizedTxId}`;
};

export const buildArweaveGatewayTxDataUrl = (txId: unknown, gateway?: unknown): string => {
  const normalizedTxId = normalizeArweaveUploadId(txId);
  if (!normalizedTxId) return '';
  const base = getPreferredArweaveGateway(gateway);
  return `${base}/tx/${normalizedTxId}/data`;
};

export const buildArweaveGatewayRawUrl = (txId: unknown, gateway?: unknown): string => {
  const normalizedTxId = normalizeArweaveUploadId(txId);
  if (!normalizedTxId) return '';
  const base = getPreferredArweaveGateway(gateway);
  return `${base}/raw/${normalizedTxId}`;
};

const AR_IO_GATEWAY_HOST_SET = new Set(['ar-io.dev', 'ar-io.net', 'ar.io']);
const AR_IO_GATEWAY_HOST_SUFFIXES = ['.ar-io.dev', '.ar-io.net', '.ar.io'];

export const isArIoGatewayHost = (host: unknown = ''): boolean => {
  const lowered = String(host || '')
    .trim()
    .toLowerCase();
  if (!lowered) return false;
  if (AR_IO_GATEWAY_HOST_SET.has(lowered)) return true;
  return AR_IO_GATEWAY_HOST_SUFFIXES.some((suffix) => lowered.endsWith(suffix));
};

export const isArIoGatewayBase = (gateway: unknown = ''): boolean => {
  const normalized = normalizeGatewayBase(gateway);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return isArIoGatewayHost(parsed.hostname);
  } catch {
    return false;
  }
};

export const buildArweaveGatewayRouteCandidates = (
  txId: unknown,
  gateway?: unknown,
  opts: { includeRawRoute?: boolean; includeTxDataRoute?: boolean } = {},
): ArweaveGatewayRouteCandidate[] => {
  const gatewayBase = getPreferredArweaveGateway(gateway);
  const isArIoGateway = isArIoGatewayBase(gatewayBase);
  const includeRawRoute = opts?.includeRawRoute !== false && !isArIoGateway;
  const includeTxDataRoute = opts?.includeTxDataRoute !== false && !isArIoGateway;
  const routeCandidates = [
    { route: 'direct' as const, url: buildArweaveGatewayUrl(txId, gatewayBase) },
    ...(includeRawRoute ? [{ route: 'raw' as const, url: buildArweaveGatewayRawUrl(txId, gatewayBase) }] : []),
    ...(includeTxDataRoute ? [{ route: 'tx-data' as const, url: buildArweaveGatewayTxDataUrl(txId, gateway) }] : []),
  ].filter((entry) => !!entry.url);
  const seen = new Set<string>();
  return routeCandidates.filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
};

const readTagRecordField = (tag: object, key: 'name' | 'value'): unknown => {
  const record = tag as { [field: string]: unknown };
  return record[key];
};

export const normalizeTagsPayload = (raw: unknown): ArweaveTag[] | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const tags = raw
      .filter((t): t is object => t && typeof t === 'object')
      .map((t) => ({
        name:
          typeof readTagRecordField(t, 'name') === 'string'
            ? readTagRecordField(t, 'name')
            : String(readTagRecordField(t, 'name') || ''),
        value:
          typeof readTagRecordField(t, 'value') === 'string'
            ? readTagRecordField(t, 'value')
            : String(readTagRecordField(t, 'value') || ''),
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
