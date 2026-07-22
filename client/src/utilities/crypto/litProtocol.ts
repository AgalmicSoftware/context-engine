/**
 * @file litProtocol.js
 * @module litProtocol
 * @description Lit Protocol client setup, encrypt/decrypt operations, and SBT-gated access control.
 *              Manages Lit client lifecycle, builds access control conditions, and handles Arweave-backed encrypted payloads.
 *
 * Key exports: getGlobalLitHooks, buildSbtAccessControlConditions, resolveLitChain, litStorage, uploadEncryptedArweaveData
 */
import { Buffer } from 'buffer/';
import { ethers } from 'ethers';
import { cryptoUtils } from './cryptography.js';
import { DEFAULT_CHIPOTLE_ACTION_CODE } from './litChipotleCatalog.js';
import {
  buildLitChipotlePolicy,
  fingerprintLitChipotlePolicy,
  normalizeChipotleCekHex,
  normalizeLitChipotleMetadataVersion,
} from './litChipotlePolicy.js';
import { arweaveScripts } from '../arweave/arweaveScripts.js';
import { createLogger } from '../logging';
import { perfDebugLitGetKey } from '../web3/rpcDebugStats.js';
import { toStr } from '../shared/primitives.js';
import { fetchWorkerWithAuth, normalizeWorkerUrl } from '../worker/workerAuth.js';

type UnknownRecord = Record<string, unknown>;
type ChainInput = unknown;
type ByteInput = Uint8Array | ArrayBuffer | ArrayBufferView | ArrayLike<number>;
type LitProviderLike = unknown;
type LitAccessControlCondition = UnknownRecord & {
  operator?: 'and' | 'or' | string;
  contractAddress?: string;
  standardContractType?: string;
  chain?: string;
  method?: string;
  parameters?: string[];
  returnValueTest?: {
    comparator?: string;
    value?: string;
  };
};
type LitHookOptions = UnknownRecord & {
  accessControlConditions?: unknown;
  chain?: unknown;
  connectTimeout?: unknown;
  litNetwork?: unknown;
  resourceId?: unknown;
  providerLike?: LitProviderLike;
  resourceAbilityRequests?: unknown;
  userMaxPrice?: unknown;
  account?: unknown;
  requesterAddress?: unknown;
  ciphertext?: unknown;
  dataToEncryptHash?: unknown;
  encryptedSymmetricKey?: unknown;
  toDecrypt?: unknown;
  chipotle?: UnknownRecord | null;
  chainId?: unknown;
  rpcUrl?: unknown;
};
type LitHooksApi = UnknownRecord & {
  saveKey?: ((...args: unknown[]) => Promise<unknown> | unknown) | null;
  getKey?: ((...args: unknown[]) => Promise<unknown> | unknown) | null;
  clearCache?: (() => void) | null;
  accessControlConditions?: LitAccessControlCondition[] | null;
  litChain?: unknown;
  litNetwork?: unknown;
  chain?: unknown;
  providerLike?: LitProviderLike;
  connectTimeout?: unknown;
  resourceAbilityRequests?: unknown;
  userMaxPrice?: unknown;
  __e2eMock?: boolean;
};
type LitDevToolsApi = UnknownRecord & {
  encryptForSbt: (options?: UnknownRecord) => Promise<string>;
  decryptEnvelope: (envelopeJson: unknown) => Promise<unknown>;
};
type LitUploadPayload = UnknownRecord & {
  v?: 1;
  kind?: 'text' | 'file' | string;
  name?: string;
  format?: string;
  mime?: string;
  encoding?: 'utf-8' | 'base64' | string;
  data?: string;
};
type ArweaveJwkLike = string | UnknownRecord;
type LitUploadOptions = UnknownRecord & {
  data?: unknown;
  format?: unknown;
  name?: unknown;
  mime?: unknown;
  arweaveJwk?: unknown;
  tags?: unknown;
  arweave?: UnknownRecord;
  providerLike?: LitProviderLike;
  account?: unknown;
  chainId?: unknown;
  contextLabel?: unknown;
  lit?: LitHooksApi;
};
type LitDownloadOptions = UnknownRecord & {
  url?: unknown;
  txId?: unknown;
  providerLike?: LitProviderLike;
  account?: unknown;
  chainId?: unknown;
  lit?: LitHooksApi;
  arweave?: UnknownRecord;
};
type SbtGateInfo = {
  sbtAddresses: string[];
  gateMode: 'any' | 'all';
  litChain: string;
  chainId: number | null;
};
type ChipotleGate = {
  sbtAddresses: string[];
  gateChainId: number | null;
  gateMode: 'any' | 'all';
  litChain: string;
};
type LitChipotlePolicy = UnknownRecord & {
  chainId: number;
  gateMode: 'any' | 'all' | string;
  sbtAddresses: string[];
  litActionCid: string;
  litPkpId: string;
};
type LitGetKeyCacheEntry = {
  expiresAt: number;
  value?: unknown;
  errMsg?: string;
};
type BufferCtorLike = {
  prototype?: UnknownRecord;
  alloc?: (size: number) => Uint8Array & UnknownRecord;
};

declare global {
  interface Window {
    __litHooks?: LitHooksApi | null;
    litHooks?: LitHooksApi | null;
    __litTools?: LitDevToolsApi | null;
  }

  var CE_E2E_LIT_MOCK: boolean | undefined;
}

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});
const toErrorMessage = (err: unknown, fallback = ''): string => {
  if (isRecord(err) && typeof err.message === 'string') return err.message;
  const message = String(err || '').trim();
  return message || fallback;
};
const toBytes = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value && typeof value === 'object' && typeof (value as ArrayLike<number>).length === 'number') {
    return new Uint8Array(value as ArrayLike<number>);
  }
  return new Uint8Array([]);
};

/**
 * @typedef {import('ethers').providers.Provider} EthersProvider
 * @typedef {import('ethers').Signer} EthersSigner
 * @typedef {typeof import('buffer').Buffer} BufferConstructorLike
 */

/**
 * @typedef {string | EthersProvider | EthersSigner | {
 *   provider?: unknown,
 *   request?: (request: { method: string, params?: unknown[] }) => Promise<unknown>
 * } | null | undefined} LitProviderLike
 */

/**
 * @typedef {string | Record<string, unknown>} ArweaveJwkLike
 */

/**
 * @typedef {object} LitAccessControlCondition
 * @property {'and' | 'or'=} operator
 * @property {string=} contractAddress
 * @property {string=} standardContractType
 * @property {string=} chain
 * @property {string=} method
 * @property {string[]=} parameters
 * @property {{ comparator?: string, value?: string }=} returnValueTest
 */

/**
 * @typedef {object} LitEncryptResult
 * @property {string} ciphertext
 * @property {string} dataToEncryptHash
 */

/**
 * @typedef {object} LitUploadPayload
 * @property {1} v
 * @property {'text' | 'file'} kind
 * @property {string} name
 * @property {string} format
 * @property {string} mime
 * @property {'utf-8' | 'base64'} encoding
 * @property {string} data
 */

/**
 * @typedef {object} LitDecryptResult
 * @property {LitUploadPayload} payload
 * @property {string} txId
 * @property {string} url
 */

/**
 * @typedef {object} LitUploadResult
 * @property {string} txId
 * @property {string} url
 * @property {string} arweaveUrl
 * @property {string} envelope
 */

/**
 * @typedef {object} LitHooksApi
 * @property {(symmetricKey: Uint8Array | ArrayLike<number>, opts?: {
 *   accessControlConditions?: LitAccessControlCondition[],
 *   chain?: string,
 *   connectTimeout?: number,
 *   litNetwork?: string,
 *   resourceId?: Record<string, unknown>,
 *   providerLike?: LitProviderLike,
 *   resourceAbilityRequests?: unknown,
 *   userMaxPrice?: unknown,
 *   account?: string,
 *   rpcUrl?: string
 * }) => Promise<LitEncryptResult>} saveKey
 * @property {(opts?: {
 *   accessControlConditions?: LitAccessControlCondition[],
 *   chain?: string,
 *   connectTimeout?: number,
 *   litNetwork?: string,
 *   resourceId?: Record<string, unknown>,
 *   providerLike?: LitProviderLike,
 *   resourceAbilityRequests?: unknown,
 *   userMaxPrice?: unknown,
 *   account?: string,
 *   requesterAddress?: string,
 *   ciphertext?: string,
 *   dataToEncryptHash?: string,
 *   encryptedSymmetricKey?: string,
 *   toDecrypt?: string,
 *   rpcUrl?: string
 * }) => Promise<Uint8Array | string>} getKey
 * @property {(() => void)=} clearCache
 * @property {LitAccessControlCondition[] | null=} accessControlConditions
 * @property {string=} litChain
 * @property {string=} litNetwork
 * @property {string=} chain
 * @property {LitProviderLike=} providerLike
 * @property {number=} connectTimeout
 * @property {unknown=} resourceAbilityRequests
 * @property {unknown=} userMaxPrice
 * @property {boolean=} __e2eMock
 */

/**
 * @typedef {object} LitDevToolsApi
 * @property {(options?: {
 *   value?: unknown,
 *   sbtAddresses?: string | string[],
 *   contextLabel?: string,
 *   chain?: string | number
 * }) => Promise<string>} encryptForSbt
 * @property {(envelopeJson: string | Record<string, unknown>) => Promise<unknown>} decryptEnvelope
 */

/**
 * @typedef {object} LitStorageApi
 * @property {(txId: unknown) => string} buildLitArweaveUrl
 * @property {(url: unknown) => string | null} parseLitArweaveUrl
 * @property {(url: unknown) => boolean} isLitArweaveUrl
 * @property {(options?: {
 *   data?: unknown,
 *   format?: string,
 *   name?: string,
 *   mime?: string,
 *   arweaveJwk?: ArweaveJwkLike,
 *   tags?: Array<Record<string, unknown>>,
 *   arweave?: Record<string, unknown>,
 *   providerLike?: LitProviderLike,
 *   account?: string,
 *   chainId?: number | string | null,
 *   contextLabel?: string,
 *   lit?: LitHooksApi & { accessControlConditions: LitAccessControlCondition[] }
 * }) => Promise<LitUploadResult>} uploadEncryptedArweaveData
 * @property {(options?: {
 *   url?: string,
 *   txId?: string,
 *   providerLike?: LitProviderLike,
 *   account?: string,
 *   chainId?: number | string | null,
 *   lit?: LitHooksApi,
 *   arweave?: Record<string, unknown>
 * }) => Promise<LitDecryptResult>} downloadEncryptedArweaveData
 * @property {(payload: LitUploadPayload | null | undefined) => string} decodeLitPayloadToText
 * @property {(payload: LitUploadPayload | null | undefined) => Blob | null} decodeLitPayloadToBlob
 */

const log = createLogger('sbt');

const buildChipotlePolicy = buildLitChipotlePolicy as (input?: UnknownRecord) => LitChipotlePolicy;
const fingerprintChipotlePolicy = fingerprintLitChipotlePolicy as (policy?: UnknownRecord) => string;

const DEFAULT_LIT_NETWORK = 'chipotle';
const DEFAULT_LIT_CHAIN = 'ethereum';
const DEFAULT_LIT_CONNECT_TIMEOUT = 45000;
const DEFAULT_LIT_SESSION_TTL_MS = 1000 * 60 * 10;

const getGlobalScope = (): (typeof globalThis & { Buffer?: BufferCtorLike }) | null => {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  return null;
};

const bufferHasBigUIntWrite = (BufferCtor: BufferCtorLike | null | undefined) => {
  try {
    if (!BufferCtor || typeof BufferCtor.alloc !== 'function') return false;
    const probe = BufferCtor.alloc(8);
    return typeof probe?.writeBigUInt64BE === 'function' || typeof probe?.writeBigUint64BE === 'function';
  } catch (_) {
    return false;
  }
};

const installBufferBigUIntWriteShim = (BufferCtor: BufferCtorLike | null | undefined) => {
  if (!BufferCtor || !BufferCtor.prototype) return false;

  const writeCompat = function writeBigUInt64BECompat(this: Uint8Array, value: string | number | bigint, offset = 0) {
    const bigIntCtor =
      typeof globalThis !== 'undefined' && typeof globalThis.BigInt === 'function' ? globalThis.BigInt : null;
    if (!bigIntCtor) {
      throw new TypeError('BigInt is not supported in this runtime.');
    }
    const start = Number(offset);
    if (!Number.isInteger(start) || start < 0 || start + 8 > this.length) {
      throw new RangeError('Index out of range');
    }

    let x = typeof value === 'bigint' ? value : bigIntCtor(value);
    if (x < 0n || x > 0xffffffffffffffffn) {
      throw new RangeError('value out of range');
    }

    for (let i = 7; i >= 0; i -= 1) {
      this[start + i] = Number(x & 0xffn);
      x >>= 8n;
    }
    return start + 8;
  };

  const prototype = BufferCtor.prototype;
  if (typeof prototype.writeBigUInt64BE !== 'function') {
    prototype.writeBigUInt64BE = writeCompat;
  }
  if (typeof prototype.writeBigUint64BE !== 'function') {
    prototype.writeBigUint64BE = prototype.writeBigUInt64BE;
  }
  return bufferHasBigUIntWrite(BufferCtor);
};

/**
 * Ensures the active runtime exposes a Buffer implementation compatible with Lit's bigint writes.
 *
 * @returns {BufferConstructorLike | null}
 */
export const ensureLitBufferCompatibility = () => {
  const scope = getGlobalScope();
  if (!scope) return null;

  const runtimeBuffer = scope.Buffer;
  const bundledBuffer = Buffer as BufferCtorLike;
  if (bufferHasBigUIntWrite(runtimeBuffer)) return runtimeBuffer;

  if (bufferHasBigUIntWrite(Buffer as unknown as BufferCtorLike)) {
    scope.Buffer = Buffer as unknown as BufferCtorLike;
    return scope.Buffer;
  }

  if (installBufferBigUIntWriteShim(runtimeBuffer)) {
    return runtimeBuffer;
  }
  if (installBufferBigUIntWriteShim(Buffer as unknown as BufferCtorLike)) {
    scope.Buffer = Buffer as unknown as BufferCtorLike;
    return scope.Buffer;
  }
  return null;
};

ensureLitBufferCompatibility();

const logLit = (level: string, message: string, meta?: unknown) => {
  const logger = log as unknown as Record<string, (...args: unknown[]) => void>;
  const fn = logger[level] || logger.log;
  if (meta === undefined) {
    fn(message);
  } else {
    fn(message, meta);
  }
};

const normalizeConnectTimeout = (value: unknown) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_LIT_CONNECT_TIMEOUT;
  return Math.floor(num);
};

const isE2eLitMockEnabled = () => {
  // Dev/e2e only: never enable in production builds.
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
      return false;
    }
  } catch (e) {
    void e; /* fallback: lit mock detection. */
  }

  if (typeof window === 'undefined') return false;

  try {
    if ((globalThis as typeof globalThis & { CE_E2E_LIT_MOCK?: boolean }).CE_E2E_LIT_MOCK === true) return true;
  } catch (e) {
    void e; /* fallback: lit mock detection. */
  }
  try {
    if (localStorage.getItem('ce-e2e-lit-mock') === '1') return true;
  } catch (e) {
    void e; /* fallback: lit mock detection. */
  }
  try {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('litMock') === '1') return true;
  } catch (e) {
    void e; /* fallback: lit mock detection. */
  }
  return false;
};

const LIT_CHAIN_BY_ID: Readonly<Record<number, string>> = Object.freeze({
  1: 'ethereum',
  10: 'optimism',
  56: 'bsc',
  137: 'polygon',
  42161: 'arbitrum',
  42220: 'celo',
  8453: 'base',
  84532: 'baseSepolia',
  11155111: 'sepolia',
  421614: 'arbitrumSepolia',
  11155420: 'optimismSepolia',
});

const LIT_WALLET_CHAIN_FALLBACKS: Readonly<Record<string, string>> = Object.freeze({
  optimismSepolia: 'sepolia',
});

const CHAIN_ID_BY_LIT_CHAIN: Readonly<Record<string, number>> = Object.freeze(
  Object.entries(LIT_CHAIN_BY_ID).reduce((acc: Record<string, number>, [id, chain]) => {
    acc[chain] = Number(id);
    return acc;
  }, {}),
);

const LIT_UNSUPPORTED_CONTRACT_GATE_ERRORS: Readonly<Record<string, string>> = Object.freeze({
  optimismSepolia: 'Lit does not currently support OP Sepolia for SBT-gated encryption. Choose "only me" private encryption or move the gate to a supported chain such as Base Sepolia.',
});

const LIT_NETWORK_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  chipotle: 'chipotle',
  'chipotle-v3': 'chipotle',
  'naga-dev': 'chipotle',
  nagadev: 'chipotle',
  'naga-test': 'chipotle',
  nagatest: 'chipotle',
  'naga-mainnet': 'chipotle',
  naga: 'chipotle',
  datil: 'chipotle',
  custom: 'custom',
});

/**
 * Normalizes historical Lit network labels to the worker-mediated runtime label used by CE.
 *
 * @param {string | null | undefined} litNetwork
 * @returns {string}
 */
export const resolveLitNetwork = (litNetwork: unknown) => {
  const raw = toStr(litNetwork || DEFAULT_LIT_NETWORK).trim();
  if (!raw) return DEFAULT_LIT_NETWORK;
  const normalized = raw.toLowerCase().replace(/_/g, '-');
  return LIT_NETWORK_ALIASES[normalized] || DEFAULT_LIT_NETWORK;
};

const resolveLitCipherPayload = (value: unknown): UnknownRecord | null => {
  if (!value) return null;
  if (isRecord(value) && value.ciphertext && value.dataToEncryptHash) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (isRecord(parsed) && parsed.ciphertext && parsed.dataToEncryptHash) return parsed;
    } catch (e) {
      log.warn('litProtocol: fallback', e);
    }
  }
  return null;
};

const normalizeSbtAddressList = (values: unknown = []) => {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(values) ? values : []).forEach((raw) => {
    const value = toStr(raw).trim();
    if (!value || !ethers.utils.isAddress(value)) return;
    const normalized = ethers.utils.getAddress(value);
    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    out.push(normalized);
  });
  return out;
};

const extractSbtGateFromAccessControlConditions = (conditions: unknown): SbtGateInfo | null => {
  const entries = Array.isArray(conditions) ? conditions : [];
  const sbtAddresses: string[] = [];
  const seen = new Set<string>();
  let gateMode: 'any' | 'all' = 'any';
  let litChain = '';

  entries.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const operator = toStr(entry.operator).trim().toLowerCase();
    if (operator === 'and') gateMode = 'all';
    if (operator === 'or' && gateMode !== 'all') gateMode = 'any';

    const contractAddress = toStr(entry.contractAddress).trim();
    if (!ethers.utils.isAddress(contractAddress)) return;
    if (toStr(entry.standardContractType).trim().toUpperCase() !== 'ERC721') return;
    if (toStr(entry.method).trim() !== 'balanceOf') return;
    const parameters = Array.isArray(entry.parameters) ? entry.parameters : [];
    if (toStr(parameters[0]).trim() !== ':userAddress') return;
    const comparator = toStr(entry.returnValueTest?.comparator).trim();
    const value = toStr(entry.returnValueTest?.value).trim();
    if (comparator !== '>' || value !== '0') return;

    const normalized = ethers.utils.getAddress(contractAddress);
    const dedupeKey = normalized.toLowerCase();
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      sbtAddresses.push(normalized);
    }
    if (!litChain) litChain = toStr(entry.chain).trim();
  });

  if (!sbtAddresses.length) return null;
  return {
    sbtAddresses,
    gateMode,
    litChain,
    chainId: Number(CHAIN_ID_BY_LIT_CHAIN[litChain] || 0) || null,
  };
};

const encodeChipotleKeyMessage = (raw: unknown) => {
  const bytes = toBytes(raw);
  return ethers.utils.hexlify(bytes);
};

const decodeChipotleKeyMessage = (value: unknown) => {
  const normalized = normalizeChipotleCekHex(value);
  const bytes = ethers.utils.arrayify(normalized);
  if (bytes.length !== 32) {
    throw new Error(`Lit Chipotle CEK had invalid length (${bytes.length}).`);
  }
  return bytes;
};

const parseChipotleActionResponse = (payload: unknown): UnknownRecord => {
  if (isRecord(payload) && isRecord(payload.response)) {
    if (isRecord(payload.response.response)) {
      return payload.response.response;
    }
    return payload.response;
  }
  return isRecord(payload) ? payload : {};
};

const buildChipotleDataHashSentinel = ({
  litActionCid = '',
  chainId = null,
  gateMode = 'any',
  sbtAddresses = [],
  policyFingerprint = '',
}: {
  litActionCid?: unknown;
  chainId?: unknown;
  gateMode?: unknown;
  sbtAddresses?: unknown;
  policyFingerprint?: unknown;
} = {}) =>
  [
    'chipotle-v3',
    toStr(litActionCid).trim() || 'action',
    Number(chainId || 0) || 0,
    toStr(gateMode).trim() || 'any',
    normalizeSbtAddressList(sbtAddresses).join(',').toLowerCase(),
    toStr(policyFingerprint).trim().toLowerCase(),
  ].join(':');

const buildChipotleGateFromOptions = ({
  accessControlConditions,
  chipotle = {},
  chainId,
}: {
  accessControlConditions?: unknown;
  chipotle?: unknown;
  chainId?: unknown;
} = {}): ChipotleGate => {
  const explicitGate = asRecord(chipotle);
  const explicitPolicy = isRecord(explicitGate.policy) ? explicitGate.policy : {};
  const derivedGate =
    extractSbtGateFromAccessControlConditions(accessControlConditions) || ({} as Partial<SbtGateInfo>);
  const sbtAddresses = normalizeSbtAddressList(
    explicitGate.sbtAddresses || explicitPolicy.sbtAddresses || derivedGate.sbtAddresses || [],
  );
  if (!sbtAddresses.length) {
    throw new Error('Lit Chipotle requires at least one SBT gate address.');
  }
  const gateChainId =
    Number(explicitGate.chainId || explicitPolicy.chainId || derivedGate.chainId || chainId || 0) || null;
  const gateMode =
    toStr(explicitGate.gateMode || explicitPolicy.gateMode || derivedGate.gateMode || 'any')
      .trim()
      .toLowerCase() === 'all'
      ? 'all'
      : 'any';
  return {
    sbtAddresses,
    gateChainId,
    gateMode,
    litChain: toStr(explicitGate.litChain || derivedGate.litChain).trim(),
  };
};

const isChipotleRuntimeConfigured = (chipotle: UnknownRecord = {}) =>
  !!toStr(chipotle?.workerUrl).trim() && !!toStr(chipotle?.sessionSlug).trim();

const resolveLitErrorMessage = (err: unknown) => {
  if (!err) return 'Unknown Lit error';
  const errRecord = asRecord(err);
  const direct = toStr(errRecord.message || '').trim();
  if (direct) return direct;
  const nestedError = asRecord(errRecord.error);
  const nestedCause = asRecord(errRecord.cause);
  const nested = toStr(
    nestedError.message || nestedCause.message || errRecord.reason || errRecord.details || '',
  ).trim();
  if (nested) return nested;
  try {
    const asJson = JSON.stringify(err);
    if (asJson && asJson !== '{}') return asJson;
  } catch (e) {
    log.warn('litProtocol: fallback', e);
  }
  return String(err);
};

const normalizeAccessControlConditions = (
  conditions: unknown,
  chainFallback: unknown,
): LitAccessControlCondition[] | null => {
  if (!Array.isArray(conditions)) return null;
  const chain = toStr(chainFallback || '').trim();
  return conditions.map((cond) => {
    if (!isRecord(cond)) return cond as LitAccessControlCondition;
    if (cond.operator) return cond;
    if (cond.chain) return cond;
    if (!chain) return cond;
    return { ...cond, chain };
  });
};

const summarizeAccConditions = (conditions: unknown) => {
  if (!Array.isArray(conditions) || !conditions.length) {
    return {
      hasConditions: false,
      conditionCount: 0,
      firstChain: null,
      firstMethod: null,
      operatorCount: 0,
    };
  }
  const firstCond = conditions.find((c) => c && typeof c === 'object' && !c.operator) || null;
  const operatorCount = conditions.filter((c) => c && typeof c === 'object' && !!c.operator).length;
  return {
    hasConditions: true,
    conditionCount: conditions.length,
    firstChain: toStr(firstCond?.chain || '').trim() || null,
    firstMethod: toStr(firstCond?.method || '').trim() || null,
    operatorCount,
  };
};

/* ----------------------- Lit getKey memoization ------------------------ */

const LIT_GETKEY_SUCCESS_TTL_MS = DEFAULT_LIT_SESSION_TTL_MS; // 10m (matches Lit session ttl)
const LIT_GETKEY_NEG_TTL_MS = 10000; // transient failures only
const LIT_GETKEY_ACC_NEG_TTL_MS = 500; // avoid "mint then still denied" UX
const LIT_GETKEY_SUCCESS_CACHE_MAX = 600;
const LIT_GETKEY_NEG_CACHE_MAX = 250;
const LIT_GETKEY_PRUNE_EVERY_N = 25;

type StableJsonPrimitive = null | string | number | boolean;
type StableJsonValue = StableJsonPrimitive | StableJsonValue[] | StableJsonObject;
type StableJsonObject = { [key: string]: StableJsonValue };

const stableKeyStringify = (value: unknown) => {
  const seen = new Set<object>();
  const walk = (v: unknown): StableJsonValue => {
    if (v == null) return null;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'bigint') return `bigint:${v.toString()}`;
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === 'object') {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
      const record = v as UnknownRecord;
      const out: StableJsonObject = {};
      Object.keys(record)
        .sort()
        .forEach((k) => {
          out[k] = walk(record[k]);
        });
      return out;
    }
    return toStr(v);
  };
  try {
    return JSON.stringify(walk(value));
  } catch (_) {
    try {
      return JSON.stringify(value);
    } catch {
      return toStr(value);
    }
  }
};

const hashStable = (value: unknown) => {
  const raw = typeof value === 'string' ? value : stableKeyStringify(value);
  try {
    return ethers.utils.id(raw);
  } catch (_) {
    return raw;
  }
};

const isAccFailure = (err: unknown) => {
  const errRecord = asRecord(err);
  const msg = toStr(errRecord.message || errRecord.reason || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('access control') ||
    msg.includes('not authorized') ||
    msg.includes('unauthorized') ||
    msg.includes('not satisfied') ||
    msg.includes('auth sig')
  );
};

const isTransientLitError = (err: unknown) => {
  const errRecord = asRecord(err);
  const msg = toStr(errRecord.message || errRecord.reason || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('econn') ||
    msg.includes('enotfound') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('service unavailable')
  );
};

const buildLitGetKeyCacheKey = ({
  requesterAddress,
  litNetwork,
  chain,
  accessControlConditions,
  resourceId,
  ciphertext,
  dataToEncryptHash,
  encryptedSymmetricKey,
  chipotlePolicyFingerprint,
}: LitHookOptions = {}) => {
  const requester = toStr(requesterAddress).trim().toLowerCase();
  const network = resolveLitNetwork(litNetwork);
  const resolvedChain = toStr(chain).trim();
  const condsHash = hashStable(accessControlConditions || null);
  const resourceHash = hashStable(resourceId || null);
  const cipherHash = hashStable({
    ciphertext: toStr(ciphertext).trim(),
    dataToEncryptHash: toStr(dataToEncryptHash).trim(),
    encryptedSymmetricKey: toStr(encryptedSymmetricKey).trim(),
    chipotlePolicyFingerprint: toStr(chipotlePolicyFingerprint).trim().toLowerCase(),
  });
  return hashStable([requester, network, resolvedChain, condsHash, resourceHash, cipherHash].join('|'));
};

const touchLru = (map: Map<string, LitGetKeyCacheEntry>, key: string, value: LitGetKeyCacheEntry) => {
  try {
    map.delete(key);
    map.set(key, value);
  } catch (e) {
    log.warn('litProtocol: fallback', e);
  }
};

const cacheLruSet = (
  map: Map<string, LitGetKeyCacheEntry> | null,
  key: string,
  entry: LitGetKeyCacheEntry,
  maxSize: number,
) => {
  if (!map) return;
  try {
    if (map.has(key)) map.delete(key);
    map.set(key, entry);
    const limit = Number(maxSize || 0);
    if (limit > 0) {
      while (map.size > limit) {
        const oldest = map.keys().next().value;
        if (!oldest) break;
        map.delete(oldest);
      }
    }
  } catch (e) {
    log.warn('litProtocol: fallback', e);
  }
};

const pruneExpiredCacheEntries = (map: Map<string, LitGetKeyCacheEntry>, now: number) => {
  try {
    if (!map || map.size === 0) return;
    const dead: string[] = [];
    for (const [k, v] of map.entries()) {
      if (!v || typeof v !== 'object') continue;
      if (Number(v.expiresAt || 0) <= now) dead.push(k);
    }
    dead.forEach((k) => map.delete(k));
  } catch (e) {
    log.warn('litProtocol: fallback', e);
  }
};

const wrapLitGetKeyWithCache = (
  getKeyUncached: (opts?: LitHookOptions) => Promise<unknown> | unknown,
  context: LitHookOptions = {},
) => {
  const successCache = new Map<string, LitGetKeyCacheEntry>(); // key -> { expiresAt, value }
  const negativeCache = new Map<string, LitGetKeyCacheEntry>(); // key -> { expiresAt, errMsg }
  const inflight = new Map<string, Promise<unknown>>(); // key -> Promise

  let opCount = 0;

  const clearCache = () => {
    successCache.clear();
    negativeCache.clear();
    inflight.clear();
    opCount = 0;
  };

  const getKey = async (opts: LitHookOptions = {}) => {
    perfDebugLitGetKey('attempt');

    const requester = toStr(opts.requesterAddress || opts.account || context.account || '').trim();

    // Fail closed: if there's no valid requester, do not cache (prevents "<anon>" leakage).
    if (!ethers.utils.isAddress(requester)) {
      return await getKeyUncached(opts);
    }

    const effectiveNetwork = resolveLitNetwork(opts.litNetwork || context.litNetwork);
    const chain = opts.chain || context.chain;
    const rawConditions = Array.isArray(opts.accessControlConditions)
      ? opts.accessControlConditions
      : context.accessControlConditions;
    const conditions = normalizeAccessControlConditions(rawConditions, chain);

    const cipherPayload =
      opts.ciphertext && opts.dataToEncryptHash
        ? { ciphertext: opts.ciphertext, dataToEncryptHash: opts.dataToEncryptHash }
        : resolveLitCipherPayload(opts.encryptedSymmetricKey || opts.toDecrypt);

    const key = buildLitGetKeyCacheKey({
      requesterAddress: requester,
      litNetwork: effectiveNetwork,
      chain,
      accessControlConditions: conditions,
      resourceId: opts.resourceId || null,
      ciphertext: cipherPayload?.ciphertext || opts.ciphertext || '',
      dataToEncryptHash: cipherPayload?.dataToEncryptHash || opts.dataToEncryptHash || '',
      encryptedSymmetricKey: opts.encryptedSymmetricKey || opts.toDecrypt || '',
      chipotlePolicyFingerprint: (() => {
        const chipotle = asRecord(opts.chipotle);
        const policy = asRecord(chipotle.policy);
        return chipotle.policyFingerprint || policy.policyFingerprint || '';
      })(),
    });

    const now = Date.now();

    // Opportunistic pruning keeps long-lived sessions bounded even if many unique resources are decrypted.
    opCount += 1;
    if (opCount % LIT_GETKEY_PRUNE_EVERY_N === 0) {
      pruneExpiredCacheEntries(successCache, now);
      pruneExpiredCacheEntries(negativeCache, now);
    }

    const cached = successCache.get(key);
    if (cached) {
      if (Number(cached.expiresAt || 0) > now) {
        perfDebugLitGetKey('cache_hit');
        touchLru(successCache, key, cached);
        return cached.value;
      }
      successCache.delete(key);
    }

    const neg = negativeCache.get(key);
    if (neg) {
      if (Number(neg.expiresAt || 0) > now) {
        perfDebugLitGetKey('neg_cache_hit');
        touchLru(negativeCache, key, neg);
        throw new Error(neg.errMsg || 'Lit getKey failed (cached).');
      }
      negativeCache.delete(key);
    }

    const inFlight = inflight.get(key);
    if (inFlight) {
      perfDebugLitGetKey('inflight_hit');
      return await inFlight;
    }

    // Some callers only pass requester via hook context; ensure the underlying getKey sees it.
    const callOpts =
      opts && typeof opts === 'object'
        ? opts.requesterAddress || opts.account
          ? opts
          : { ...opts, requesterAddress: requester }
        : { requesterAddress: requester };

    const run = (async () => await getKeyUncached(callOpts))();
    inflight.set(key, run);

    try {
      const value = await run;
      const settledAt = Date.now();
      cacheLruSet(
        successCache,
        key,
        { expiresAt: settledAt + LIT_GETKEY_SUCCESS_TTL_MS, value },
        LIT_GETKEY_SUCCESS_CACHE_MAX,
      );
      negativeCache.delete(key);
      return value;
    } catch (err) {
      perfDebugLitGetKey('error');

      const accFail = isAccFailure(err);
      const transient = isTransientLitError(err);
      const ttl = transient ? LIT_GETKEY_NEG_TTL_MS : accFail ? LIT_GETKEY_ACC_NEG_TTL_MS : 0;
      if (ttl > 0) {
        cacheLruSet(
          negativeCache,
          key,
          { expiresAt: Date.now() + ttl, errMsg: resolveLitErrorMessage(err) },
          LIT_GETKEY_NEG_CACHE_MAX,
        );
      }
      throw err;
    } finally {
      if (inflight.get(key) === run) inflight.delete(key);
    }
  };

  return { getKey, clearCache };
};

// Test-only export to validate caching and key scoping without initializing a real Lit client.
export const __test__wrapLitGetKeyWithCache = wrapLitGetKeyWithCache;
export const __test__extractSbtGateFromAccessControlConditions = extractSbtGateFromAccessControlConditions;

const resolveLitChainFallbackWarnings = new Set();

/**
 * Resolves a chain name for Lit access control conditions from chain id or explicit chain labels.
 *
 * @param {{ chainId?: number | string | null, litChain?: number | string | null, chain?: number | string | null }} [options={}]
 * @returns {string}
 */
export const resolveLitChain = ({
  chainId,
  litChain,
  chain,
}: {
  chainId?: ChainInput;
  litChain?: ChainInput;
  chain?: ChainInput;
} = {}) => {
  const rawLitChain = litChain || chain;
  if (rawLitChain) {
    const numericId = Number(rawLitChain);
    if (Number.isFinite(numericId) && LIT_CHAIN_BY_ID[numericId]) {
      return LIT_CHAIN_BY_ID[numericId];
    }
    return toStr(rawLitChain);
  }
  const id = Number(chainId);
  if (Number.isFinite(id) && LIT_CHAIN_BY_ID[id]) return LIT_CHAIN_BY_ID[id];
  const hasExplicitChainInfo = chainId !== undefined && chainId !== null && String(chainId).trim() !== '';
  if (!hasExplicitChainInfo && !toStr(litChain).trim() && !toStr(chain).trim()) {
    const warningKey = 'missing-chain-info';
    if (!resolveLitChainFallbackWarnings.has(warningKey)) {
      resolveLitChainFallbackWarnings.add(warningKey);
      log.warn('[lit] resolveLitChain falling back to default chain.', {
        defaultChain: DEFAULT_LIT_CHAIN,
        chainId: null,
        litChain: null,
        chain: null,
      });
    }
  }
  return DEFAULT_LIT_CHAIN;
};

export const resolveLitWalletAddressChain = ({
  chainId,
  litChain,
  chain,
}: {
  chainId?: ChainInput;
  litChain?: ChainInput;
  chain?: ChainInput;
} = {}) => {
  const resolvedChain = resolveLitChain({ chainId, litChain, chain });
  return LIT_WALLET_CHAIN_FALLBACKS[resolvedChain] || resolvedChain;
};

export const getUnsupportedLitContractAccessControlError = ({
  chainId,
  litChain,
  chain,
}: {
  chainId?: ChainInput;
  litChain?: ChainInput;
  chain?: ChainInput;
} = {}) => {
  const resolvedChain = resolveLitChain({ chainId, litChain, chain });
  return LIT_UNSUPPORTED_CONTRACT_GATE_ERRORS[resolvedChain] || '';
};

const ensureArray = (val: unknown): unknown[] => (Array.isArray(val) ? val : val ? [val] : []);

/**
 * Builds Lit access control conditions that require ownership of one or more SBT contracts.
 *
 * @param {{
 *   sbtAddress?: string | string[],
 *   sbtAddresses?: string | string[],
 *   chain?: string | number | null,
 *   litChain?: string | number | null,
 *   chainId?: number | string | null,
 *   mode?: string | number | null,
 *   requireAll?: boolean | number | string | null
 * }} [options={}]
 * @returns {LitAccessControlCondition[] | null}
 */
export const buildSbtAccessControlConditions = ({
  sbtAddress,
  sbtAddresses,
  chain,
  litChain,
  chainId,
  mode,
  requireAll,
}: {
  sbtAddress?: unknown;
  sbtAddresses?: unknown;
  chain?: ChainInput;
  litChain?: ChainInput;
  chainId?: ChainInput;
  mode?: unknown;
  requireAll?: unknown;
} = {}): LitAccessControlCondition[] | undefined => {
  const addresses = ensureArray(sbtAddresses || sbtAddress).filter(Boolean);
  const resolvedChain = resolveLitChain({ chainId, litChain, chain });
  const normalizedMode = mode == null ? '' : String(mode).trim().toLowerCase();
  // SessionRegistry / on-chain gates may store mode as an enum (0=Any, 1=All). Accept both.
  const requireAllFlag = requireAll === true || requireAll === 1 || String(requireAll || '').trim() === '1';
  const isAll = requireAllFlag || normalizedMode === 'all' || normalizedMode === 'and' || normalizedMode === '1';
  const operator = isAll ? 'and' : 'or';
  const conditions = addresses
    .filter((addr): addr is string => typeof addr === 'string' && ethers.utils.isAddress(addr))
    .map((addr) => ({
      contractAddress: addr,
      standardContractType: 'ERC721',
      chain: resolvedChain,
      method: 'balanceOf',
      parameters: [':userAddress'],
      returnValueTest: { comparator: '>', value: '0' },
    }));

  if (!conditions.length) return null as unknown as undefined;
  if (conditions.length === 1) return conditions;
  const out: LitAccessControlCondition[] = [];
  conditions.forEach((cond, idx) => {
    if (idx > 0) out.push({ operator });
    out.push(cond);
  });
  return out;
};

/**
 * Builds Lit access control conditions that match a specific wallet address.
 *
 * @param {{
 *   walletAddress?: string,
 *   chain?: string | number | null,
 *   litChain?: string | number | null,
 *   chainId?: number | string | null
 * }} [options={}]
 * @returns {LitAccessControlCondition[] | null}
 */
export const buildWalletAddressAccessControlConditions = ({
  walletAddress,
  chain,
  litChain,
  chainId,
}: {
  walletAddress?: unknown;
  chain?: ChainInput;
  litChain?: ChainInput;
  chainId?: ChainInput;
} = {}): LitAccessControlCondition[] | null => {
  const address = toStr(walletAddress).trim().toLowerCase();
  if (!ethers.utils.isAddress(address)) return null;
  const resolvedChain = resolveLitWalletAddressChain({ chainId, litChain, chain });
  return [
    {
      contractAddress: '',
      standardContractType: '',
      chain: resolvedChain,
      method: '',
      parameters: [':userAddress'],
      returnValueTest: { comparator: '=', value: address.toLowerCase() },
    },
  ];
};

/**
 * Builds Lit access control conditions that require a Hats Protocol wearer check to pass.
 *
 * @param {{
 *   hatsAddress?: string,
 *   hatId?: string | number | null,
 *   chain?: string | number | null,
 *   litChain?: string | number | null,
 *   chainId?: number | string | null
 * }} [options={}]
 * @returns {LitAccessControlCondition[] | null}
 */
export const buildHatAccessControlConditions = ({
  hatsAddress,
  hatId,
  chain,
  litChain,
  chainId,
}: {
  hatsAddress?: unknown;
  hatId?: unknown;
  chain?: ChainInput;
  litChain?: ChainInput;
  chainId?: ChainInput;
} = {}): LitAccessControlCondition[] | null => {
  const address = toStr(hatsAddress).trim();
  const id = toStr(hatId).trim();
  if (!address || !ethers.utils.isAddress(address) || !id) return null;
  const resolvedChain = resolveLitChain({ chainId, litChain, chain });
  return [
    {
      contractAddress: address,
      standardContractType: '',
      chain: resolvedChain,
      method: 'isWearerOfHat',
      parameters: [':userAddress', id],
      returnValueTest: { comparator: '=', value: 'true' },
    },
  ];
};

const normalizeUserMaxPrice = (value: unknown) => {
  if (typeof value === 'bigint') return value;
  const raw = toStr(value).trim();
  if (!raw) return undefined;
  const parseBigInt =
    typeof globalThis !== 'undefined' && typeof globalThis.BigInt === 'function' ? globalThis.BigInt : null;
  if (!parseBigInt) return undefined;
  try {
    const parsed = parseBigInt(raw);
    return parsed >= 0n ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const sanitizePublicLitHooks = (hooks: unknown = {}): LitHooksApi => {
  return hooks as LitHooksApi;
};

let e2eLitMockMasterKeyPromise: Promise<CryptoKey> | null = null;
const getE2eLitMockMasterKey = async () => {
  if (e2eLitMockMasterKeyPromise) return e2eLitMockMasterKeyPromise;
  e2eLitMockMasterKeyPromise = (async () => {
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      throw new Error('Lit mock requires WebCrypto support.');
    }
    const seed = new TextEncoder().encode('ce-e2e-lit-mock-master-key-v1');
    const digest = await window.crypto.subtle.digest('SHA-256', seed);
    return window.crypto.subtle.importKey('raw', digest, { name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
  })();
  return e2eLitMockMasterKeyPromise;
};

const e2eLitMockEncodePayload = async (keyBytes: BufferSource) => {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Lit mock requires WebCrypto support.');
  }
  const master = await getE2eLitMockMasterKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, master, keyBytes);
  const cipherBytes = new Uint8Array(cipherBuf);

  const payloadObj = {
    v: 1,
    alg: 'aes-gcm-256',
    iv: Buffer.from(iv).toString('base64'),
    ciphertext: Buffer.from(cipherBytes).toString('base64'),
  };
  const payloadJson = JSON.stringify(payloadObj);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const hashBuf = await window.crypto.subtle.digest('SHA-256', payloadBytes);

  return {
    ciphertext: Buffer.from(payloadBytes).toString('base64'),
    dataToEncryptHash: `0x${Buffer.from(new Uint8Array(hashBuf)).toString('hex')}`,
  };
};

const e2eLitMockDecodePayload = async (ciphertextB64: unknown) => {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Lit mock requires WebCrypto support.');
  }
  const rawBytes = new Uint8Array(Buffer.from(String(ciphertextB64 || ''), 'base64'));
  const payloadJson = new TextDecoder().decode(rawBytes);
  const payload = JSON.parse(payloadJson || '{}');
  const iv = new Uint8Array(Buffer.from(String(payload?.iv || ''), 'base64'));
  const ct = new Uint8Array(Buffer.from(String(payload?.ciphertext || ''), 'base64'));
  if (!iv.length || !ct.length) {
    throw new Error('Lit mock payload malformed.');
  }
  const master = await getE2eLitMockMasterKey();
  const plainBuf = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, master, ct);
  return new Uint8Array(plainBuf);
};

const e2eLitMockParseConditions = (conditions: unknown) => {
  const list = Array.isArray(conditions) ? conditions : [];
  let operator: 'and' | 'or' | null = null;
  const checks: Array<{ type: 'erc721-balance' | 'wallet-address'; address: string }> = [];

  for (const cond of list) {
    if (!cond || typeof cond !== 'object') continue;
    if (cond.operator) {
      const op = toStr(cond.operator).trim().toLowerCase();
      if (op === 'and' || op === 'or') operator = operator || op;
      continue;
    }
    const method = toStr(cond.method).trim().toLowerCase();
    const addr = toStr(cond.contractAddress).trim();
    const comparator = toStr(cond.returnValueTest?.comparator).trim();
    const value = toStr(cond.returnValueTest?.value).trim().toLowerCase();
    const parameters = Array.isArray(cond.parameters)
      ? cond.parameters.map((entry: unknown) => toStr(entry).trim())
      : [];
    if (method === 'balanceof' && ethers.utils.isAddress(addr)) {
      checks.push({ type: 'erc721-balance', address: addr.toLowerCase() });
      continue;
    }
    if (
      !addr &&
      !method &&
      parameters[0] === ':userAddress' &&
      (comparator === '=' || comparator === '==') &&
      ethers.utils.isAddress(value)
    ) {
      checks.push({ type: 'wallet-address', address: value });
    }
  }

  return {
    operator: operator || 'or',
    checks,
  };
};

const e2eLitMockCheckAccessControlConditions = async ({
  requesterAddress,
  conditions,
  providerLike,
}: {
  requesterAddress?: unknown;
  conditions?: unknown;
  providerLike?: LitProviderLike;
}) => {
  if (!Array.isArray(conditions) || !conditions.length) return false;
  const req = toStr(requesterAddress).trim();
  if (!ethers.utils.isAddress(req)) return false;

  const parsed = e2eLitMockParseConditions(conditions);
  if (!parsed.checks.length) {
    // Fail closed for unknown/unhandled conditions to avoid false-positive decrypts.
    return false;
  }

  const provider = cryptoUtils._getProvider(providerLike as Parameters<typeof cryptoUtils._getProvider>[0]);
  const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
  const abi = ['function balanceOf(address owner) view returns (uint256)'];

  const checks: boolean[] = [];
  for (const check of parsed.checks) {
    if (check?.type === 'wallet-address') {
      checks.push(check.address === req.toLowerCase());
      continue;
    }
    if (check?.type === 'erc721-balance' && ethers.utils.isAddress(check.address)) {
      const balance = await new ethers.Contract(check.address, abi, ethersProvider).balanceOf(req);
      checks.push(ethers.BigNumber.isBigNumber(balance) ? balance.gt(0) : Number(balance || 0) > 0);
    }
  }

  const requireAll = parsed.operator === 'and';
  return requireAll ? checks.every(Boolean) : checks.some(Boolean);
};

const createE2eLitMockHooks = ({
  providerLike,
  account,
  chainId,
  litChain,
  litNetwork,
  userMaxPrice,
  accessControlConditions,
  resourceAbilityRequests,
  connectTimeout,
  litConnectTimeout,
}: LitHookOptions = {}): LitHooksApi => {
  ensureLitBufferCompatibility();
  const resolvedChain = resolveLitChain({ chainId, litChain });
  const resolvedNetwork = resolveLitNetwork(litNetwork);
  const resolvedConnectTimeout = normalizeConnectTimeout(connectTimeout || litConnectTimeout);
  const baseConditions = Array.isArray(accessControlConditions) ? accessControlConditions : null;

  const saveKey = async (symmetricKey: unknown, opts: LitHookOptions = {}) => {
    ensureLitBufferCompatibility();
    const conditions = Array.isArray(opts.accessControlConditions) ? opts.accessControlConditions : baseConditions;
    if (!conditions || !conditions.length) {
      throw new Error('Lit mock saveKey requires access control conditions.');
    }
    const keyBytes = toBytes(symmetricKey);
    if (!keyBytes.length) throw new Error('Lit mock saveKey requires key bytes.');
    return e2eLitMockEncodePayload(keyBytes);
  };

  const getKeyUncached = async (opts: LitHookOptions = {}) => {
    ensureLitBufferCompatibility();
    const effectiveProviderLike = opts.providerLike || providerLike;
    const requester = toStr(opts.requesterAddress || opts.account || account || '').trim();
    const rawConditions = Array.isArray(opts.accessControlConditions) ? opts.accessControlConditions : baseConditions;
    if (!rawConditions || !rawConditions.length) {
      throw new Error('Lit mock getKey requires access control conditions.');
    }
    const conditions = normalizeAccessControlConditions(rawConditions, opts.chain || resolvedChain);

    const allowed = await e2eLitMockCheckAccessControlConditions({
      requesterAddress: requester,
      conditions,
      providerLike: effectiveProviderLike,
    });
    if (!allowed) {
      throw new Error('Lit mock: access control conditions not satisfied.');
    }

    const ciphertext = toStr(opts.ciphertext || '').trim();
    if (!ciphertext) {
      throw new Error('Lit mock getKey requires ciphertext.');
    }

    const cekBytes = await e2eLitMockDecodePayload(ciphertext);
    if (!(cekBytes instanceof Uint8Array) || cekBytes.length !== 32) {
      throw new Error('Lit mock unwrapped key has invalid length.');
    }
    return cekBytes;
  };

  const { getKey, clearCache } = wrapLitGetKeyWithCache(getKeyUncached, {
    account,
    litNetwork: resolvedNetwork,
    chain: resolvedChain,
    accessControlConditions: baseConditions,
  });

  return sanitizePublicLitHooks({
    saveKey,
    getKey,
    clearCache,
    accessControlConditions: baseConditions,
    litChain: resolvedChain,
    litNetwork: resolvedNetwork,
    chain: resolvedChain,
    providerLike,
    connectTimeout: resolvedConnectTimeout,
    resourceAbilityRequests,
    userMaxPrice: normalizeUserMaxPrice(userMaxPrice),
    __e2eMock: true,
  });
};

const createLitChipotleHooks = ({
  providerLike,
  account,
  chainId,
  accessControlConditions,
  connectTimeout,
  chipotle,
}: LitHookOptions = {}): LitHooksApi | null => {
  const chipotleConfig = asRecord(chipotle);
  const normalizedWorkerUrl = normalizeWorkerUrl(chipotleConfig.workerUrl);
  const sessionSlug = toStr(chipotleConfig.sessionSlug).trim();
  const sessionConfig =
    chipotleConfig.sessionConfig && typeof chipotleConfig.sessionConfig === 'object'
      ? chipotleConfig.sessionConfig
      : null;
  const litCredentials = asRecord(chipotleConfig.litCredentials);
  const baseConditions = Array.isArray(accessControlConditions) ? accessControlConditions : null;

  if (
    !isChipotleRuntimeConfigured({
      workerUrl: normalizedWorkerUrl,
      sessionSlug,
      litCredentials,
    })
  ) {
    return null;
  }

  const executeChipotleAction = async ({
    op,
    gate,
    message,
    ciphertext,
    chipotleMetadata,
  }: {
    op?: 'encrypt' | 'decrypt' | string;
    gate?: ChipotleGate;
    message?: unknown;
    ciphertext?: unknown;
    chipotleMetadata?: unknown;
  } = {}) => {
    if (!gate) throw new Error('Lit Chipotle gate is required.');
    const chipotleActionUrl = `${normalizedWorkerUrl.replace(/\/+$/, '')}/lit/chipotle-action`;
    const response = await fetchWorkerWithAuth(
      normalizedWorkerUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lit_chipotle_execute',
          actionCode: DEFAULT_CHIPOTLE_ACTION_CODE,
          op,
          sbtAddresses: gate.sbtAddresses,
          gateMode: gate.gateMode,
          chainId: gate.gateChainId,
          ...(chipotleMetadata ? { chipotle: chipotleMetadata } : {}),
          ...(message ? { message } : {}),
          ...(ciphertext ? { ciphertext } : {}),
        }),
      },
      {
        sessionSlug,
        sessionConfig,
        context: {
          account,
          providerLike,
          chainId,
        },
        workerUrl: normalizedWorkerUrl,
      },
    );
    const payload = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) {
      throw new Error(toStr(payload.error).trim() || `Lit Chipotle request failed (${response.status}).`);
    }
    const actionResponse = parseChipotleActionResponse(payload);
    if (actionResponse?.ok === false) {
      throw new Error(toStr(actionResponse.reason).trim() || 'Lit Chipotle gate check failed.');
    }
    return actionResponse;
  };

  const saveKey = async (symmetricKey: unknown, opts: LitHookOptions = {}) => {
    const gate = buildChipotleGateFromOptions({
      accessControlConditions: Array.isArray(opts.accessControlConditions)
        ? opts.accessControlConditions
        : baseConditions,
      chipotle: opts.chipotle || chipotle,
      chainId: opts.chainId || chainId || null,
    });
    const wrapped = await executeChipotleAction({
      op: 'encrypt',
      gate,
      message: encodeChipotleKeyMessage(symmetricKey),
    });
    const wrappedCiphertext = toStr(wrapped?.ciphertext).trim();
    if (!wrappedCiphertext) {
      throw new Error('Lit Chipotle encrypt did not return ciphertext.');
    }
    const responsePolicy = wrapped?.policy
      ? buildChipotlePolicy(asRecord(wrapped.policy))
      : buildChipotlePolicy({
          chainId: gate.gateChainId,
          gateMode: gate.gateMode,
          sbtAddresses: gate.sbtAddresses,
          litActionCid: litCredentials.litActionCid,
          litPkpId: litCredentials.litPkpId,
        });
    const policyFingerprint = toStr(wrapped?.policyFingerprint || fingerprintChipotlePolicy(responsePolicy)).trim();
    if (policyFingerprint.toLowerCase() !== fingerprintChipotlePolicy(responsePolicy).toLowerCase()) {
      throw new Error('Lit Chipotle encrypt returned mismatched policy metadata.');
    }
    return {
      ciphertext: wrappedCiphertext,
      dataToEncryptHash: buildChipotleDataHashSentinel({
        litActionCid: responsePolicy.litActionCid,
        chainId: responsePolicy.chainId,
        gateMode: responsePolicy.gateMode,
        sbtAddresses: responsePolicy.sbtAddresses,
        policyFingerprint,
      }),
      chipotle: {
        version: 2,
        litActionCid: responsePolicy.litActionCid,
        litPkpId: responsePolicy.litPkpId,
        sbtAddresses: responsePolicy.sbtAddresses,
        gateMode: responsePolicy.gateMode,
        chainId: responsePolicy.chainId,
        policyFingerprint,
        policy: responsePolicy,
      },
    };
  };

  const getKeyUncached = async (opts: LitHookOptions = {}) => {
    const ciphertext = toStr(opts.ciphertext || opts.encryptedSymmetricKey || opts.toDecrypt).trim();
    if (!ciphertext) {
      throw new Error('Lit Chipotle decrypt requires ciphertext.');
    }
    const metadataVersion = normalizeLitChipotleMetadataVersion(opts.chipotle || {});
    if (opts.chipotle && metadataVersion !== 2) {
      throw new Error('Lit Chipotle legacy wrapped keys are not supported.');
    }
    const gate = buildChipotleGateFromOptions({
      accessControlConditions: Array.isArray(opts.accessControlConditions)
        ? opts.accessControlConditions
        : baseConditions,
      chipotle: opts.chipotle || chipotle,
      chainId: opts.chainId || chainId || null,
    });
    const unwrapped = await executeChipotleAction({
      op: 'decrypt',
      gate,
      ciphertext,
      chipotleMetadata: opts.chipotle || null,
    });
    const plaintext = toStr(unwrapped?.plaintext).trim();
    if (!plaintext) {
      throw new Error('Lit Chipotle decrypt did not return plaintext.');
    }
    return decodeChipotleKeyMessage(plaintext);
  };

  const { getKey, clearCache } = wrapLitGetKeyWithCache(getKeyUncached, {
    account,
    litNetwork: 'chipotle',
    chain: '',
    accessControlConditions: baseConditions,
  });

  return sanitizePublicLitHooks({
    saveKey,
    getKey,
    clearCache,
    accessControlConditions: baseConditions,
    litChain: '',
    litNetwork: 'chipotle',
    chain: '',
    providerLike,
    connectTimeout,
    chipotle: {
      enabled: true,
      workerUrl: normalizedWorkerUrl,
      sessionSlug,
      litCredentials: {
        litApiBase: toStr(litCredentials.litApiBase).trim(),
        litActionCid: toStr(litCredentials.litActionCid).trim(),
        litGroupId: toStr(litCredentials.litGroupId).trim(),
        litPkpId: toStr(litCredentials.litPkpId).trim(),
      },
    },
  });
};

/**
 * Creates Lit helper hooks for saving and retrieving symmetric keys under access control conditions.
 *
 * @param {{
 *   providerLike?: LitProviderLike,
 *   account?: string,
 *   chainId?: number | string | null,
 *   litChain?: string | number | null,
 *   litNetwork?: string | null,
 *   userMaxPrice?: unknown,
 *   accessControlConditions?: LitAccessControlCondition[],
 *   resourceAbilityRequests?: unknown,
 *   connectTimeout?: number | string | null,
 *   litConnectTimeout?: number | string | null,
 *   chipotle?: Record<string, any>
 * }} [options={}]
 * @returns {LitHooksApi}
 */
export const createLitHooks = ({
  providerLike,
  account,
  chainId,
  litChain,
  litNetwork,
  userMaxPrice,
  accessControlConditions,
  resourceAbilityRequests,
  connectTimeout,
  litConnectTimeout,
  chipotle,
}: LitHookOptions = {}): LitHooksApi | null => {
  ensureLitBufferCompatibility();
  const resolvedChain = resolveLitChain({ chainId, litChain });
  const resolvedConnectTimeout = normalizeConnectTimeout(connectTimeout || litConnectTimeout);
  const resolvedUserMaxPrice = normalizeUserMaxPrice(userMaxPrice);
  const baseConditions = Array.isArray(accessControlConditions) ? accessControlConditions : null;

  if (isE2eLitMockEnabled()) {
    return createE2eLitMockHooks({
      providerLike,
      account,
      chainId,
      litChain: resolvedChain,
      litNetwork: resolveLitNetwork(litNetwork),
      userMaxPrice: resolvedUserMaxPrice,
      accessControlConditions: baseConditions || undefined,
      resourceAbilityRequests,
      connectTimeout: resolvedConnectTimeout,
    });
  }

  const chipotleHooks = createLitChipotleHooks({
    providerLike,
    account,
    chainId,
    accessControlConditions: baseConditions,
    connectTimeout: resolvedConnectTimeout,
    chipotle,
  });
  if (chipotleHooks) {
    return chipotleHooks;
  }

  logLit('info', '[lit] chipotle runtime unavailable; no hooks published', {
    chain: resolvedChain,
    conditionCount: baseConditions ? baseConditions.length : 0,
    connectTimeout: resolvedConnectTimeout,
  });
  return null;
};

/**
 * Publishes a sanitized Lit hook set on `window.__litHooks`.
 *
 * @param {LitHooksApi | Record<string, unknown> | null | undefined} hooks
 * @returns {LitHooksApi | null}
 */
export const setGlobalLitHooks = (hooks: LitHooksApi | UnknownRecord | null | undefined): LitHooksApi | null => {
  if (typeof window === 'undefined') return null;
  if (hooks && typeof hooks === 'object') {
    const publicHooks = sanitizePublicLitHooks(hooks) as LitHooksApi;
    window.__litHooks = publicHooks;
    return publicHooks;
  }
  delete window.__litHooks;
  return null;
};

/**
 * Reads the currently registered global Lit hooks from the browser runtime.
 *
 * @returns {LitHooksApi | null}
 */
export const getGlobalLitHooks = () => {
  if (typeof window === 'undefined') return null;
  return window.__litHooks || window.litHooks || null;
};

/**
 * Attaches lightweight Lit encryption helpers to `window.__litTools` for debugging flows in-browser.
 *
 * @param {{
 *   providerLike?: LitProviderLike,
 *   account?: string,
 *   chainId?: number | string | null,
 *   litChain?: string | number | null
 * }} [options={}]
 * @returns {LitDevToolsApi | null}
 */
export const attachLitDevTools = ({
  providerLike,
  account,
  chainId,
  litChain,
}: {
  providerLike?: LitProviderLike;
  account?: string;
  chainId?: ChainInput;
  litChain?: ChainInput;
} = {}): LitDevToolsApi | null => {
  if (typeof window === 'undefined') return null;
  const tools = {
    encryptForSbt: async ({ value, sbtAddresses, contextLabel, chain }: UnknownRecord = {}) => {
      const hooks = getGlobalLitHooks();
      if (!hooks || typeof hooks.saveKey !== 'function') {
        throw new Error('Lit hooks not initialized.');
      }
      const resolvedChain = resolveLitChain({ chainId, litChain, chain });
      const accessControlConditions = buildSbtAccessControlConditions({
        sbtAddresses,
        chainId,
        litChain: resolvedChain,
      });
      if (!accessControlConditions) {
        throw new Error('Invalid SBT access control conditions.');
      }
      return cryptoUtils.encryptEnvelopeValue(value, {
        providerLike,
        account,
        chainId,
        contextLabel: contextLabel || 'lit-secret',
        lit: {
          saveKey: hooks.saveKey,
          accessControlConditions,
          chain: resolvedChain,
        },
      });
    },
    decryptEnvelope: async (envelopeJson: unknown) => {
      const hooks = getGlobalLitHooks();
      if (!hooks || typeof hooks.getKey !== 'function') {
        throw new Error('Lit hooks not initialized.');
      }
      return cryptoUtils.decryptEnvelopeValue(envelopeJson, {
        account,
        chainId,
        providerLike,
        litOpts: { getKey: hooks.getKey },
      });
    },
  };
  window.__litTools = tools;
  return tools;
};

/* ----------------------------- Lit storage ------------------------------ */

const LIT_ARWEAVE_PREFIX = 'lit://arweave/';
const ALT_LIT_AR_PREFIX = 'lit+ar://';

/**
 * Builds the canonical `lit://arweave/` URL for a stored encrypted payload.
 *
 * @param {unknown} txId
 * @returns {string}
 */
export const buildLitArweaveUrl = (txId: unknown) => `${LIT_ARWEAVE_PREFIX}${toStr(txId).trim()}`;

/**
 * Extracts an Arweave transaction id from a Lit storage URL.
 *
 * @param {unknown} url
 * @returns {string | null}
 */
export const parseLitArweaveUrl = (url: unknown) => {
  const raw = toStr(url).trim();
  if (!raw) return null;
  if (raw.startsWith(LIT_ARWEAVE_PREFIX)) {
    return raw.slice(LIT_ARWEAVE_PREFIX.length).trim() || null;
  }
  if (raw.startsWith(ALT_LIT_AR_PREFIX)) {
    return raw.slice(ALT_LIT_AR_PREFIX.length).trim() || null;
  }
  return null;
};

/**
 * Indicates whether a string is one of the supported Lit Arweave URL forms.
 *
 * @param {unknown} url
 * @returns {boolean}
 */
export const isLitArweaveUrl = (url: unknown) => !!parseLitArweaveUrl(url);

const readBlobAsArrayBuffer = (blob: Blob) =>
  new Promise<ArrayBuffer | string | null>((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file data.'));
      reader.readAsArrayBuffer(blob);
    } catch (err) {
      reject(err);
    }
  });

const MIME_BY_EXT: Readonly<Record<string, string>> = Object.freeze({
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
});

const resolveExt = ({ name, format }: { name?: unknown; format?: unknown } = {}) => {
  const fmt = toStr(format).trim().toLowerCase();
  if (fmt) return fmt;
  const rawName = toStr(name).trim();
  const dot = rawName.lastIndexOf('.');
  if (dot > 0 && dot < rawName.length - 1) {
    return rawName.slice(dot + 1).toLowerCase();
  }
  return '';
};

const resolveMimeFromParts = ({
  mime,
  name,
  format,
  type,
}: {
  mime?: unknown;
  name?: unknown;
  format?: unknown;
  type?: unknown;
} = {}) => {
  const raw = toStr(mime || type).trim();
  const ext = resolveExt({ name, format });
  if (raw && raw !== 'application/octet-stream') return raw;
  if (ext && MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  return raw || 'application/octet-stream';
};

const resolveMimeFromPayload = (payload: unknown) => {
  const payloadRecord = asRecord(payload) as LitUploadPayload;
  return resolveMimeFromParts({
    mime: payloadRecord.mime,
    name: payloadRecord.name,
    format: payloadRecord.format,
  });
};

const isTextLikeMime = (mime: string) => {
  if (!mime) return false;
  if (mime.startsWith('text/')) return true;
  return [
    'application/json',
    'application/xml',
    'application/xhtml+xml',
    'application/javascript',
    'application/x-javascript',
    'image/svg+xml',
  ].includes(mime);
};

const encodeEncryptedPayload = async (
  data: unknown,
  opts: { name?: string; format?: string; mime?: string } = {},
): Promise<LitUploadPayload> => {
  const name = toStr(opts.name || '');
  const format = toStr(opts.format || '');
  const mime = toStr(opts.mime || '');

  if (typeof File !== 'undefined' && (data instanceof File || data instanceof Blob)) {
    const buf = await readBlobAsArrayBuffer(data);
    const b64 = Buffer.from(toBytes(buf)).toString('base64');
    const resolvedName = name || (data instanceof File ? data.name : '') || 'encrypted-file';
    const resolvedFormat = resolveExt({ name: resolvedName, format });
    const resolvedMime = resolveMimeFromParts({
      mime,
      name: resolvedName,
      format: resolvedFormat,
      type: data.type,
    });
    return {
      v: 1,
      kind: 'file',
      name: resolvedName,
      format: resolvedFormat,
      mime: resolvedMime,
      encoding: 'base64',
      data: b64,
    };
  }

  return {
    v: 1,
    kind: 'text',
    name: name || 'encrypted-text',
    format: format || '',
    mime: mime || 'text/plain',
    encoding: 'utf-8',
    data: toStr(data),
  };
};

/**
 * Encrypts a text or file payload with the active Lit hooks and uploads the resulting envelope to Arweave.
 *
 * @param {{
 *   data?: unknown,
 *   format?: string,
 *   name?: string,
 *   mime?: string,
 *   arweaveJwk?: ArweaveJwkLike,
 *   tags?: Array<Record<string, unknown>>,
 *   arweave?: Record<string, unknown>,
 *   providerLike?: LitProviderLike,
 *   account?: string,
 *   chainId?: number | string | null,
 *   contextLabel?: string,
 *   lit?: LitHooksApi & { accessControlConditions: LitAccessControlCondition[] }
 * }} [options={}]
 * @returns {Promise<LitUploadResult>}
 */
export const uploadEncryptedArweaveData = async ({
  data,
  format,
  name,
  mime,
  arweaveJwk,
  tags,
  arweave,
  providerLike,
  account,
  chainId,
  contextLabel,
  lit,
}: LitUploadOptions = {}) => {
  if (!lit || typeof lit.saveKey !== 'function') {
    throw new Error('Lit saveKey is required to encrypt Arweave data.');
  }
  if (!lit.accessControlConditions || !Array.isArray(lit.accessControlConditions)) {
    throw new Error('Lit accessControlConditions are required to encrypt Arweave data.');
  }

  const payload = await encodeEncryptedPayload(data, {
    format: toStr(format),
    name: toStr(name),
    mime: toStr(mime),
  });
  const envelope = await cryptoUtils.encryptEnvelopeValue(payload, {
    providerLike,
    account,
    chainId,
    contextLabel: contextLabel || 'lit-arweave',
    lit: {
      saveKey: lit.saveKey,
      accessControlConditions: lit.accessControlConditions,
      chain: lit.chain || lit.litChain,
    },
  });

  const txId = await arweaveClient.uploadDataToArweave(envelope, 'json', {
    arweaveJwk,
    tags,
    ...(arweave && typeof arweave === 'object' ? arweave : {}),
  });
  return {
    txId,
    url: buildLitArweaveUrl(txId),
    arweaveUrl: arweaveClient.buildArweaveGatewayUrl(txId),
    envelope,
  };
};

/**
 * Downloads an encrypted Arweave envelope payload and decrypts it with self-recipient wallet
 * signing, Lit hooks, or both when the envelope carries both recipient types.
 *
 * @param {{
 *   url?: string,
 *   txId?: string,
 *   providerLike?: LitProviderLike,
 *   account?: string,
 *   chainId?: number | string | null,
 *   lit?: LitHooksApi,
 *   arweave?: Record<string, unknown>
 * }} [options={}]
 * @returns {Promise<LitDecryptResult>}
 */
export const downloadEncryptedArweaveData = async ({
  url,
  txId,
  providerLike,
  account,
  chainId,
  lit,
  arweave,
}: LitDownloadOptions = {}): Promise<{ payload: LitUploadPayload; txId: string; url: string }> => {
  const resolvedTx = toStr(txId || '') || parseLitArweaveUrl(url);
  if (!resolvedTx) throw new Error('Missing Arweave transaction ID for Lit doc.');

  const arweaveOpts: UnknownRecord = isRecord(arweave) ? { ...arweave } : {};
  const existingDebugContext =
    arweaveOpts.debugContext && typeof arweaveOpts.debugContext === 'object' ? asRecord(arweaveOpts.debugContext) : {};
  arweaveOpts.debugContext = {
    ...existingDebugContext,
    category: toStr(existingDebugContext.category).trim() || 'doc_lit_payload',
    caller: toStr(existingDebugContext.caller).trim() || 'litProtocol.downloadEncryptedArweaveData',
  };

  const envelopeJson = await arweaveClient.downloadDataFromArweave(resolvedTx, arweaveOpts);
  const litOpts = lit && typeof lit.getKey === 'function' ? { getKey: lit.getKey } : undefined;
  const payload = await cryptoUtils.decryptEnvelopeValue(envelopeJson, {
    account,
    chainId,
    providerLike,
    ...(litOpts ? { litOpts } : {}),
  });
  return { payload: asRecord(payload) as LitUploadPayload, txId: resolvedTx, url: buildLitArweaveUrl(resolvedTx) };
};

/**
 * Decodes a Lit upload payload to text when the payload metadata indicates a text-like resource.
 *
 * @param {LitUploadPayload | null | undefined} payload
 * @returns {string}
 */
export const decodeLitPayloadToText = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return '';
  const payloadRecord = payload as LitUploadPayload;
  const mime = resolveMimeFromPayload(payloadRecord);
  const shouldDecode = payloadRecord.kind === 'text' || payloadRecord.encoding === 'utf-8' || isTextLikeMime(mime);
  if (!shouldDecode) return '';
  if (payloadRecord.encoding === 'utf-8' || payloadRecord.kind === 'text') {
    return toStr(payloadRecord.data || '');
  }
  if (payloadRecord.encoding === 'base64' && typeof payloadRecord.data === 'string') {
    try {
      return Buffer.from(payloadRecord.data, 'base64').toString('utf8');
    } catch (_) {
      return '';
    }
  }
  return '';
};

/**
 * Decodes a base64-backed Lit upload payload into a Blob for binary consumption.
 *
 * @param {LitUploadPayload | null | undefined} payload
 * @returns {Blob | null}
 */
export const decodeLitPayloadToBlob = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return null;
  const payloadRecord = payload as LitUploadPayload;
  if (payloadRecord.encoding !== 'base64' || typeof payloadRecord.data !== 'string') return null;
  try {
    const bytes = Uint8Array.from(Buffer.from(payloadRecord.data, 'base64'));
    return new Blob([bytes], { type: resolveMimeFromPayload(payloadRecord) });
  } catch (_) {
    return null;
  }
};

/** @type {LitStorageApi} */
export const litStorage = {
  buildLitArweaveUrl,
  parseLitArweaveUrl,
  isLitArweaveUrl,
  uploadEncryptedArweaveData,
  downloadEncryptedArweaveData,
  decodeLitPayloadToText,
  decodeLitPayloadToBlob,
};
