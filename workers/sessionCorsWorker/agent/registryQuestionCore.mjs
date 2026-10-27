import { safeString, lower } from './runtimePrimitives.mjs';

export const DEFAULT_CHAIN_ID = '11155420';

export const ARWEAVE_GATEWAY = 'https://ar-io.dev';

export const ARWEAVE_GATEWAYS = Object.freeze([ARWEAVE_GATEWAY, 'https://arweave.net']);

export const DEFAULT_CACHE_TTL_SECONDS = 5 * 60;

export const DEFAULT_SCAN_BLOCKS = 130_000;

export const DEFAULT_LOG_CHUNK_SIZE = 250_000;

export const DEFAULT_PAYLOAD_CONCURRENCY = 4;

export const DEFAULT_FOREGROUND_CHUNKS = 1;

export const DEFAULT_RPC_TIMEOUT_MS = 5_000;

export const DEFAULT_PAYLOAD_FETCH_TIMEOUT_MS = 2_500;

export const QUESTION_CACHE_PREFIX = 'telegram:questions:v7:';

export const questionMemoryCache = new Map();

export const QUESTION_PAYLOAD_SKIP = '__telegramQuestionPayloadSkip';

export const STORAGE_BACKENDS = Object.freeze({
  ARWEAVE: 'arweave',
  CLOUDFLARE: 'cloudflare',
});

export const SELECTORS = Object.freeze({
  getSessionBySlug: '0x42052f23',
  getQuestionHash: '0x24b9f713',
});

export const QUESTIONS_ADDED_TOPIC0 = '0x3b584fb360a325f39352e75bd13458807d8e31735ef4dadaeff99fc3e59b517a';

export const SESSION_CREATED_TOPIC0 = '0xda4a316a58925980f9d609158916dd8a071a29c9118777e57a5daed4ba17744f';

export const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;

export const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

export function normalizeChainId(value = '') {
  return safeString(value || DEFAULT_CHAIN_ID) || DEFAULT_CHAIN_ID;
}

export function normalizeBlock(value) {
  if (value == null || safeString(value) === '') return null;
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw < 0) return null;
  return Math.floor(raw);
}

export function normalizeStorageBackend(value = '') {
  const backend = lower(value);
  if (backend === 'cloudflare' || backend === 'cf' || backend === 'r2') return STORAGE_BACKENDS.CLOUDFLARE;
  return STORAGE_BACKENDS.ARWEAVE;
}

export function resolveQuestionStorageBackend(session = {}, env = {}) {
  const metadata = session.metadata && typeof session.metadata === 'object' && !Array.isArray(session.metadata)
    ? session.metadata
    : {};
  const profile = metadata.storageProfile && typeof metadata.storageProfile === 'object' && !Array.isArray(metadata.storageProfile)
    ? metadata.storageProfile
    : {};
  return normalizeStorageBackend(
    profile.questionsBackend ||
    profile.questionBackend ||
    profile.backend ||
    metadata.questionStorageBackend ||
      metadata.storageBackend,
  );
}

export function storageRefForPointer(pointerId = '', resource = 'questions', backend = STORAGE_BACKENDS.ARWEAVE) {
  const id = safeString(pointerId);
  if (!id) return null;
  if (backend === STORAGE_BACKENDS.CLOUDFLARE) {
    return {
      backend: STORAGE_BACKENDS.CLOUDFLARE,
      id,
      resource,
      uri: `/storage/read?id=${encodeURIComponent(id)}`,
    };
  }
  return {
    backend: STORAGE_BACKENDS.ARWEAVE,
    id,
    resource,
    uri: `ar://${id}`,
  };
}

export function rpcTimeoutMs(env = {}) {
  return DEFAULT_RPC_TIMEOUT_MS;
}

export function questionPayloadTimeoutMs(env = {}) {
  return DEFAULT_PAYLOAD_FETCH_TIMEOUT_MS;
}

export function normalizeHexAddress(value = '') {
  const text = safeString(value);
  return /^0x[0-9a-fA-F]{40}$/.test(text) ? text : '';
}

export function normalizeBytes32(value = '') {
  const text = safeString(value);
  return BYTES32_RE.test(text) ? text.toLowerCase() : '';
}

export function strip0x(value = '') {
  return safeString(value).replace(/^0x/i, '');
}

export function hexWord(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

export function utf8ToHex(value = '') {
  return [...new TextEncoder().encode(String(value))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function encodeAbiStringArg(value = '') {
  const hex = utf8ToHex(value);
  const paddedLength = Math.ceil(hex.length / 64) * 64;
  return `${hexWord(32)}${hexWord(hex.length / 2)}${hex.padEnd(paddedLength, '0')}`;
}

export function decodeUint256Word(word = '') {
  const hex = strip0x(word).slice(0, 64);
  return hex ? BigInt(`0x${hex}`) : 0n;
}

export function wordAt(hex = '', index = 0) {
  const clean = strip0x(hex);
  return clean.slice(index * 64, index * 64 + 64);
}

export function decodeAbiString(result = '', slotIndex = 0) {
  const hex = strip0x(result);
  if (hex.length < 64) return '';
  const offset = Number(decodeUint256Word(wordAt(hex, slotIndex)));
  const lengthOffset = offset * 2;
  const length = Number(decodeUint256Word(hex.slice(lengthOffset, lengthOffset + 64)));
  const bytesHex = hex.slice(lengthOffset + 64, lengthOffset + 64 + length * 2);
  if (!bytesHex) return '';
  const bytes = bytesHex.match(/.{1,2}/g)?.map((part) => Number.parseInt(part, 16)) || [];
  return new TextDecoder().decode(new Uint8Array(bytes)).trim();
}

export function decodeSessionTuple(result = '') {
  const hex = strip0x(result);
  if (hex.length < 64 * 8) return null;
  return {
    slug: decodeAbiString(hex, 0),
    chainId: Number(decodeUint256Word(wordAt(hex, 1))) || null,
    metadataURI: decodeAbiString(hex, 2),
    encryptedMetadataURI: decodeAbiString(hex, 3),
    adminAddress: `0x${wordAt(hex, 4).slice(24)}`.toLowerCase(),
    createdAt: Number(decodeUint256Word(wordAt(hex, 5))) || null,
    updatedAt: Number(decodeUint256Word(wordAt(hex, 6))) || null,
  };
}

export function decodeBytes32ArrayFromData(data = '', headSlotIndex = 0) {
  const hex = strip0x(data);
  if (hex.length < 64) return [];
  const offset = Number(decodeUint256Word(wordAt(hex, headSlotIndex)));
  const lengthOffset = offset * 2;
  const length = Number(decodeUint256Word(hex.slice(lengthOffset, lengthOffset + 64)));
  const out = [];
  for (let index = 0; index < length; index += 1) {
    const word = hex.slice(lengthOffset + 64 + index * 64, lengthOffset + 128 + index * 64);
    const bytes32 = normalizeBytes32(`0x${word}`);
    if (bytes32 && bytes32 !== ZERO_BYTES32) out.push(bytes32);
  }
  return out;
}

export function bytesFromHex(hex = '') {
  const clean = strip0x(hex);
  if (!clean || clean.length % 2 !== 0) return new Uint8Array();
  return new Uint8Array(clean.match(/.{1,2}/g).map((part) => Number.parseInt(part, 16)));
}

export function base64urlFromBytes(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000));
  }
  const encoded = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function hexToBase64url(hex = '') {
  const bytes = bytesFromHex(hex);
  return bytes.length ? base64urlFromBytes(bytes) : '';
}
