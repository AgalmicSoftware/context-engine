import { ethers } from 'ethers';
import {
  REGISTRY_ABI,
  SESSION_REGISTRY_ADDRESSES,
  SESSION_CONTRACTS_BY_CHAIN,
  CE_SESSION_SCAN_SCOPE,
  CE_SESSION_SCAN_SLUGS,
  DEFAULT_CHAIN_ID,
  resolveRpcUrlsForChain,
  ARWEAVE_GATEWAY,
} from './constants.mjs';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const WORKER_FIELD_KEYS = Object.freeze(['corsWorkerUrl']);
const WORKER_URL_METADATA_KEYS = Object.freeze([
  'corsWorkerUrl',
  'workerUrl',
  'sessionCorsWorkerUrl',
  'corsWorkerUrlLegacy',
  'corsWorkerURL',
  'CorsWorkerURL',
]);

const providerCache = new Map(); // chainId -> JsonRpcProvider
const providerUrlIndexByChain = new Map(); // chainId -> rpc index

function activeChainId() {
  return DEFAULT_CHAIN_ID;
}

function activeRegistryChainId(preferredChainId = activeChainId()) {
  const preferred = Number(preferredChainId) || DEFAULT_CHAIN_ID;
  if (String(SESSION_REGISTRY_ADDRESSES[preferred] || '').trim()) {
    return preferred;
  }

  const fallbackEntry = Object.entries(SESSION_REGISTRY_ADDRESSES).find(([, address]) => (
    String(address || '').trim()
  ));
  return fallbackEntry ? Number(fallbackEntry[0]) : preferred;
}

function getProvider(chainId = activeChainId()) {
  const cid = Number(chainId) || DEFAULT_CHAIN_ID;
  if (providerCache.has(cid)) return providerCache.get(cid);
  const rpcUrls = resolveRpcUrlsForChain(cid);
  const idx = providerUrlIndexByChain.get(cid) || 0;
  const rpcUrl = rpcUrls[idx] || rpcUrls[0];
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, cid);
  providerCache.set(cid, provider);
  providerUrlIndexByChain.set(cid, idx);
  return provider;
}

function rotateProvider(chainId = activeChainId()) {
  const cid = Number(chainId) || DEFAULT_CHAIN_ID;
  const rpcUrls = resolveRpcUrlsForChain(cid);
  const current = providerUrlIndexByChain.get(cid) || 0;
  const next = (current + 1) % rpcUrls.length;
  providerUrlIndexByChain.set(cid, next);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrls[next], cid);
  providerCache.set(cid, provider);
  return provider;
}

function getRegistryContract(provider, chainId = activeChainId()) {
  const cid = activeRegistryChainId(chainId);
  const address = SESSION_REGISTRY_ADDRESSES[cid];
  if (!address) throw new Error(`No SessionRegistry address for chain ${cid}`);
  return new ethers.Contract(address, REGISTRY_ABI, provider || getProvider(cid));
}

// --- Cache ---

const sessionCache = new Map(); // slug → { config, ts }

function getCached(slug) {
  const entry = sessionCache.get(slug);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.config;
  return null;
}

function readFirstConfiguredString(values) {
  const list = Array.isArray(values) ? values : [values];
  for (const value of list) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return null;
}

function resolveWorkerUrlFromMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  return readFirstConfiguredString(WORKER_URL_METADATA_KEYS.map((key) => metadata[key]));
}

// --- Session tuple decode ---
// Matches client/src/utilities/web3/sessionRegistry.ts:decodeSessionTuple

function decodeSessionTuple(tuple) {
  if (!tuple) return null;
  const sessionIdHex = tuple[7]
    ? '0x' + Buffer.from(ethers.utils.arrayify(tuple[7])).toString('hex')
    : null;
  return {
    slug: tuple[0],
    chainId: Number(tuple[1] || 0) || null,
    metadataURI: tuple[2] || '',
    encryptedMetadataURI: tuple[3] || '',
    adminAddress: tuple[4] || '',
    createdAt: tuple[5] ? Number(tuple[5]) : null,
    updatedAt: tuple[6] ? Number(tuple[6]) : null,
    sessionIdHex,
  };
}

// --- Public API ---

export async function listSessions(deps = {}) {
  const chainId = activeRegistryChainId();
  const getRegistry = typeof deps.getRegistryContract === 'function'
    ? deps.getRegistryContract
    : getRegistryContract;
  const rotate = typeof deps.rotateProvider === 'function'
    ? deps.rotateProvider
    : rotateProvider;
  let registry = getRegistry(undefined, chainId);
  let count;
  try {
    count = await registry.getSessionCount();
  } catch (err) {
    // Retry with different RPC
    const provider = rotate(chainId);
    registry = getRegistry(provider, chainId);
    count = await registry.getSessionCount();
  }

  const n = Number(count);
  const slugs = [];
  for (let i = 0; i < n; i++) {
    try {
      const slug = await registry.getSessionSlugByIndex(i);
      if (slug === undefined || slug === null) continue;
      // Decode tuple to ensure the registry tuple schema is still compatible.
      try {
        const tuple = await registry.getSessionBySlug(slug);
        const decoded = decodeSessionTuple(tuple);
        if (decoded?.slug) slugs.push(decoded.slug);
        else slugs.push(slug);
      } catch {
        slugs.push(slug);
      }
    } catch {
      // skip
    }
  }
  return slugs;
}

const normalizeSlug = (s) => {
  const v = String(s || '').trim().toLowerCase();
  return v === 'general' ? '' : v;
};

const MISSING_SESSION_ERROR_RE = /\bsession (?:not found|does not exist)\b/i;

function isMissingSessionError(err) {
  const candidates = [
    err?.reason,
    err?.shortMessage,
    err?.message,
    err?.error?.reason,
    err?.error?.message,
  ];
  return candidates.some((value) => MISSING_SESSION_ERROR_RE.test(String(value || '')));
}

export async function listScopedSessions(deps = {}) {
  const allSlugs = await listSessions(deps);
  if (CE_SESSION_SCAN_SCOPE === 'all') return { scoped: allSlugs, all: allSlugs };
  let scoped;
  if (CE_SESSION_SCAN_SCOPE === 'list') {
    const allowed = new Set(
      (Array.isArray(CE_SESSION_SCAN_SLUGS) ? CE_SESSION_SCAN_SLUGS : [])
        .map(normalizeSlug)
    );
    scoped = allSlugs.filter((s) => allowed.has(normalizeSlug(s)));
  } else if (CE_SESSION_SCAN_SCOPE === 'active') {
    scoped = allSlugs;
  } else if (CE_SESSION_SCAN_SCOPE === 'general') {
    const n = normalizeSlug;
    scoped = allSlugs.filter((s) => n(s) === '');
  } else {
    scoped = allSlugs;
  }
  return { scoped, all: allSlugs };
}

export async function getSessionConfig(slug, deps = {}) {
  const cached = getCached(slug);
  if (cached) return cached;

  const chainId = activeRegistryChainId();
  const getRegistry = typeof deps.getRegistryContract === 'function'
    ? deps.getRegistryContract
    : getRegistryContract;
  const rotate = typeof deps.rotateProvider === 'function'
    ? deps.rotateProvider
    : rotateProvider;
  const fetchMetadataImpl = typeof deps.fetchMetadata === 'function'
    ? deps.fetchMetadata
    : fetchMetadata;

  let registry = getRegistry(undefined, chainId);
  let tuple;
  try {
    tuple = await registry.getSessionBySlug(slug);
  } catch (err) {
    if (isMissingSessionError(err)) return null;
    const provider = rotate(chainId);
    registry = getRegistry(provider, chainId);
    try {
      tuple = await registry.getSessionBySlug(slug);
    } catch (retryErr) {
      if (isMissingSessionError(retryErr)) return null;
      throw retryErr;
    }
  }

  const session = decodeSessionTuple(tuple);
  if (!session) return null;

  const resolvedChainId = session.chainId || DEFAULT_CHAIN_ID;
  const chainContracts = SESSION_CONTRACTS_BY_CHAIN[resolvedChainId] || {};

  // Pull metadata from metadataURI so config includes gate and response audience settings.
  let metadata = null;
  try {
    metadata = session.metadataURI ? await fetchMetadataImpl(session.metadataURI) : null;
  } catch {
    metadata = null;
  }

  const config = {
    slug: session.slug,
    chainId: resolvedChainId,
    metadataURI: session.metadataURI,
    adminAddress: session.adminAddress,
    sessionIdHex: session.sessionIdHex,
    metadata,
    contracts: Object.entries(chainContracts).reduce((acc, [key, address]) => {
      if (address) acc[key] = { address, chainId: resolvedChainId };
      return acc;
    }, {}),
  };

  if (metadata) {
    metadataCache.set(slug, { metadata, ts: Date.now() });
  }
  sessionCache.set(slug, { config, ts: Date.now() });
  return config;
}

export function getSurveysAddress(sessionConfig) {
  return sessionConfig?.contracts?.surveys?.address
    || SESSION_CONTRACTS_BY_CHAIN[DEFAULT_CHAIN_ID]?.surveys
    || null;
}

// --- Metadata resolution ---
// Matches client/src/utilities/web3/sessionRegistry.ts parseSessionRegistryMetadataUri + fetchMetadataFromArweave

const metadataCache = new Map(); // slug → { metadata, ts }

function parseMetadataUri(uri) {
  if (!uri) return null;
  // Inline data URI: data:application/json;base64,<encoded>
  if (uri.startsWith('data:')) {
    const match = uri.match(/;base64,(.+)$/);
    if (match) {
      try { return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')); }
      catch { return null; }
    }
    return null;
  }
  // Arweave URI: ar://<txId> or full gateway URL
  if (uri.startsWith('ar://')) return uri.slice(5);
  const gatewayMarker = ['ar-io.dev/', 'arweave.net/'].find((marker) => uri.includes(marker));
  if (gatewayMarker) {
    const parts = uri.split(gatewayMarker);
    return parts[1] || null;
  }
  // Bare transaction ID (43 chars base64url)
  if (/^[a-zA-Z0-9_-]{43}$/.test(uri)) return uri;
  return null;
}

async function fetchMetadata(metadataURI) {
  const parsed = parseMetadataUri(metadataURI);
  if (!parsed) return null;
  // If parsed is an object, it was an inline data URI
  if (typeof parsed === 'object') return parsed;
  // Otherwise it's an Arweave txId
  try {
    const res = await fetch(`${ARWEAVE_GATEWAY}/${parsed}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getSessionFieldValues(slug, fieldKeys, deps = {}) {
  const chainId = activeRegistryChainId();
  const getRegistry = typeof deps.getRegistryContract === 'function'
    ? deps.getRegistryContract
    : getRegistryContract;
  const rotate = typeof deps.rotateProvider === 'function'
    ? deps.rotateProvider
    : rotateProvider;

  let registry = getRegistry(undefined, chainId);
  try {
    return await registry.getSessionFields(slug, fieldKeys);
  } catch (err) {
    if (isMissingSessionError(err)) return null;
    const provider = rotate(chainId);
    registry = getRegistry(provider, chainId);
    try {
      return await registry.getSessionFields(slug, fieldKeys);
    } catch (retryErr) {
      if (isMissingSessionError(retryErr)) return null;
      throw retryErr;
    }
  }
}

export async function getSessionMetadata(slug, deps = {}) {
  const cached = metadataCache.get(slug);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.metadata;

  const config = await getSessionConfig(slug, deps);
  if (!config) return null;
  if (config.metadata) {
    metadataCache.set(slug, { metadata: config.metadata, ts: Date.now() });
    return config.metadata;
  }
  if (!config.metadataURI) return null;

  const metadata = await fetchMetadata(config.metadataURI);
  if (metadata) {
    metadataCache.set(slug, { metadata, ts: Date.now() });
  }
  return metadata;
}

export async function getCorsWorkerUrl(slug, deps = {}) {
  try {
    const fieldValues = await getSessionFieldValues(slug, WORKER_FIELD_KEYS, deps);
    if (fieldValues === null) return null;
    const registryWorkerUrl = readFirstConfiguredString(fieldValues);
    if (registryWorkerUrl) return registryWorkerUrl;
  } catch {
    // SessionRegistry fields are the canonical source, but metadata remains a compatibility fallback.
  }

  const metadata = await getSessionMetadata(slug, deps);
  return resolveWorkerUrlFromMetadata(metadata);
}

export const __test__sessions = {
  activeRegistryChainId,
  decodeSessionTuple,
  isMissingSessionError,
  parseMetadataUri,
  getProvider,
  resolveWorkerUrlFromMetadata,
};
