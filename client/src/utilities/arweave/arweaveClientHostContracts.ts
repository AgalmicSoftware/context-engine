import type { ArweaveTag } from './arweaveGatewayPayloads.js';
import type { ArweaveDebugContext } from './arweaveRuntimeDiagnostics.js';
import type { ArweaveUploadCandidate } from './arweaveUploadCandidates.js';
import type { FailureCacheEntry } from './arweaveFailureCache.js';

type UnknownRecord = Record<string, unknown>;

export interface ArweaveUploadFallbackTelemetryPayload extends UnknownRecord {
  attemptIndex?: number;
  error?: string;
  gateStatus?: string;
  reason?: string;
  requestId?: string;
  responseStatus?: number | null;
  sessionSlug?: string;
  workerUrl?: string;
}

export interface ArweaveUploadFallbackTelemetryEntry extends ArweaveUploadFallbackTelemetryPayload {
  ts: string;
}

export const buildArweaveUploadFallbackTelemetryEntry = (
  payload: unknown = {},
  now: () => Date = () => new Date(),
): ArweaveUploadFallbackTelemetryEntry => ({
  ts: now().toISOString(),
  ...(payload && typeof payload === 'object' ? payload : { value: payload }),
});

export interface ArweaveRuntimeGlobal extends UnknownRecord {
  CE_ARWEAVE_WAYFINDER_RESOLVE?: ArweaveWayfinderResolver;
  __CE_ARWEAVE_UPLOAD_FALLBACK__?: ArweaveUploadFallbackTelemetryEntry[];
}

export type ArweaveFetchInput = RequestInfo | URL;
export type ArweaveFetchPort = (input: ArweaveFetchInput, init?: RequestInit) => Promise<Response>;

export interface ArweaveWayfinderResolverInput {
  attemptedUrls: string[];
  debugContext: ArweaveDebugContext | null;
  txId: string;
}

export type ArweaveWayfinderResolver = (input: ArweaveWayfinderResolverInput) => Promise<unknown> | unknown;

export interface ArweaveGatewayOptions extends UnknownRecord {
  arIoGateway?: unknown;
  debugArweave?: boolean;
  directToArIo?: boolean;
  gateway?: unknown;
  gateways?: unknown[];
  includeRawRoute?: boolean;
  includeTxDataRoute?: boolean;
  useWayfinder?: boolean;
  wayfinderResolver?: ArweaveWayfinderResolver;
}

export interface ArweaveGraphqlOptions extends ArweaveGatewayOptions {
  graphqlTimeoutMs?: number;
  graphqlUrl?: string;
  graphqlUrls?: string[];
}

export interface ArweaveDownloadOptions extends ArweaveGraphqlOptions {
  bypassCache?: boolean;
  bypassFailureCache?: boolean;
  debugContext?: ArweaveDebugContext | string | null;
  disableExistencePrecheck?: boolean;
  gatewayTimeoutMs?: number;
  preflightTxExistence?: boolean;
  retries?: number;
  retryDelayMs?: number;
  shortCircuitNotFound?: boolean;
  stopOnFirst404?: boolean;
}

export interface ArweaveAdminAuthRecord extends UnknownRecord {
  sessionSlug?: unknown;
  slug?: unknown;
}

export interface ArweaveUploadOptions extends UnknownRecord {
  adminAuth?: ArweaveAdminAuthRecord | null;
  arweaveJwk?: string | UnknownRecord | null;
  contentType?: string;
  context?: unknown;
  forceDirectArweaveUpload?: boolean;
  requestId?: string;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  skipAuth?: boolean;
  tags?: ArweaveTag[] | UnknownRecord | null;
  workerUrl?: unknown;
}

export interface ArweaveDirectUploadInput {
  arweaveJwk: string | UnknownRecord;
  contentType: string;
  data: unknown;
  requestId?: string;
  tags: ArweaveTag[] | null;
}

export interface ArweaveUploadAttemptInput {
  attemptIndex?: number;
  bodyBytes?: number | null;
  buildRequestInit: () => RequestInit;
  candidate: ArweaveUploadCandidate;
  hasFormData?: boolean;
}

export type ArweaveUploadAttemptResult =
  | { id: string; ok: true }
  | {
      endpoint: string;
      message: string;
      networkError: boolean;
      ok: false;
      shouldFallback: boolean;
      status: number | null;
    };

export interface ArweaveGatewayFallbackResult {
  error?: Error | null;
  gateway?: string;
  ok: boolean;
  resolvedUrl: string;
  route?: string;
  sawNotFound?: boolean;
  sawRetryableNonNotFound?: boolean;
  text?: string;
}

export interface ArweaveWalletBalanceResult {
  address: string;
  balanceUrl: string;
  gatewayBase: string;
  winston: string;
}

export interface ArweaveClientApi {
  base64DecodeURL: (value: unknown) => unknown;
  base64urlToBase64: (value: unknown) => unknown;
  base64urlToHex: (value: unknown) => unknown;
  buildArweaveGatewayUrl: (txId: unknown, gateway?: unknown) => string;
  checkTxExists: (txId: unknown, opts?: ArweaveGraphqlOptions) => Promise<boolean | null>;
  downloadDataFromArweave: (txId: unknown, opts?: ArweaveDownloadOptions) => Promise<string>;
  formatWinstonToAr: (winston: unknown, decimals?: number) => string;
  hexToBase64url: (value: unknown) => unknown;
  readArweaveWalletBalance: (jwk: unknown, opts?: ArweaveGatewayOptions) => Promise<ArweaveWalletBalanceResult>;
  registerTxContext: (txId: unknown, context?: UnknownRecord) => void;
  uploadDataToArweave: (data: unknown, format?: unknown, opts?: ArweaveUploadOptions) => Promise<string>;
}

export type ArweaveFailureCacheRecord = FailureCacheEntry;
