import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const readJsonFile = (relativePath) => JSON.parse(
  readFileSync(resolve(__dirname, relativePath), 'utf8')
);
const rpcDefaults = require('../../client/src/variables/rpcDefaults.js');

// ABIs imported directly from client/ — zero duplication, zero drift
export const SURVEYS_ABI = readJsonFile('../../client/src/contractsABI/SURVEYS_ABI.json');
export const REGISTRY_ABI = readJsonFile('../../client/src/contractsABI/SESSION_REGISTRY_ABI.json');

// Client defaults now live in appConfig.js. CE-CC keeps a broader default scope ("all")
// for terminal session discovery, but it still mirrors the client slug list default.
const CLIENT_DEFAULT_SESSION_SCAN_SLUGS = Object.freeze(['demo-1']);
const VALID_SCOPES = new Set(['all', 'active', 'general', 'list']);
// CE-CC defaults to 'all' even though the SPA default is "list" — the client's restrictive
// scan config is for browser performance, while the local server should show all registry sessions.
// Environment overrides still take precedence.
const envScope = String(process.env.CE_SESSION_SCAN_SCOPE || '').trim().toLowerCase();
export const CE_SESSION_SCAN_SCOPE = envScope ? (VALID_SCOPES.has(envScope) ? envScope : 'all') : 'all';
export const CE_SESSION_SCAN_SLUGS = Object.freeze([...CLIENT_DEFAULT_SESSION_SCAN_SLUGS]);

// Registry + contract addresses — single source of truth with client
const contractsConfig = readJsonFile('../../client/src/variables/contracts.json');
export const SESSION_REGISTRY_ADDRESSES = Object.fromEntries(
  Object.entries(contractsConfig.sessionRegistryAddresses || {}).map(([k, v]) => [Number(k), v])
);
export const SESSION_CONTRACTS_BY_CHAIN = Object.fromEntries(
  Object.entries(contractsConfig.sessionContractsByChain || {}).map(([k, v]) => [Number(k), v])
);

export const OPTIONAL_BASE_SEPOLIA_CHAIN_ID = 84532;
export const OP_SEPOLIA_CHAIN_ID = 11155420;
// Intentional for now: CE-CC is still operated as a one-chain runtime, so the
// explicit CE_RPC_URL override is global rather than chain-scoped. If/when we
// turn on real multi-chain runtime support, split this into per-chain overrides
// before relying on resolveRpcUrlsForChain() across networks.
const EXPLICIT_RPC_URL = String(process.env.CE_RPC_URL || '').trim();
const EXPLICIT_CHAIN_NAME = String(process.env.CE_CHAIN_NAME || '').trim();
const EXPLICIT_TX_EXPLORER_BASE_URL = String(process.env.CE_TX_EXPLORER_BASE_URL || '').trim();

const KNOWN_CHAIN_METADATA_BY_ID = Object.freeze({
  [OPTIONAL_BASE_SEPOLIA_CHAIN_ID]: Object.freeze({
    name: 'Base Sepolia',
    txExplorerTxBaseUrl: 'https://base-sepolia.blockscout.com/tx/',
  }),
  [OP_SEPOLIA_CHAIN_ID]: Object.freeze({
    name: 'OP Sepolia',
    txExplorerTxBaseUrl: 'https://optimism-sepolia.blockscout.com/tx/',
  }),
});

function parseChainId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeExplorerBaseUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  return url.endsWith('/') ? url : `${url}/`;
}

function hasConfiguredRuntimeSupport(chainId) {
  const registryAddress = String(SESSION_REGISTRY_ADDRESSES?.[chainId] || '').trim();
  const surveysAddress = String(SESSION_CONTRACTS_BY_CHAIN?.[chainId]?.surveys || '').trim();
  return !!registryAddress && !!surveysAddress;
}

function resolveFallbackRuntimeChainId() {
  const preferredChainIds = [
    OP_SEPOLIA_CHAIN_ID,
    ...Object.keys(SESSION_CONTRACTS_BY_CHAIN || {}).map((value) => Number(value)),
  ];
  const seen = new Set();
  for (const chainId of preferredChainIds) {
    const normalizedChainId = parseChainId(chainId);
    if (!normalizedChainId || seen.has(normalizedChainId)) continue;
    seen.add(normalizedChainId);
    if (hasConfiguredRuntimeSupport(normalizedChainId)) {
      return normalizedChainId;
    }
  }
  return OP_SEPOLIA_CHAIN_ID;
}

// Keep CE-CC isolated from ambient web3 shell vars like CHAIN_ID; only the
// namespaced CE_CHAIN_ID override can opt into another runtime-supported chain.
// By default, CE-CC runs on OP Sepolia when contracts are configured there.
// Additional chains remain opt-in so private/POA deployments can wire in their
// own chain id, RPC, label, and explorer metadata without disturbing the
// current OP Sepolia default.
const requestedChainId = parseChainId(process.env.CE_CHAIN_ID);
const FALLBACK_RUNTIME_CHAIN_ID = resolveFallbackRuntimeChainId();
export const DEFAULT_CHAIN_ID = (
  (requestedChainId && hasConfiguredRuntimeSupport(requestedChainId) ? requestedChainId : null)
  || FALLBACK_RUNTIME_CHAIN_ID
);

export function getChainMetadata(chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = parseChainId(chainId) || DEFAULT_CHAIN_ID;
  const known = KNOWN_CHAIN_METADATA_BY_ID[normalizedChainId] || null;
  return {
    chainId: normalizedChainId,
    name: EXPLICIT_CHAIN_NAME || known?.name || `Chain ${normalizedChainId}`,
    txExplorerTxBaseUrl: normalizeExplorerBaseUrl(
      EXPLICIT_TX_EXPLORER_BASE_URL || known?.txExplorerTxBaseUrl || ''
    ),
  };
}

export const DEFAULT_CHAIN_METADATA = Object.freeze(getChainMetadata(DEFAULT_CHAIN_ID));

const freezeUrlList = (urls = []) => Object.freeze(
  urls
    .map((url) => String(url || '').trim())
    .filter(Boolean)
);

const buildRpcDefaultsForChain = (chainId, { includePath = false } = {}) => {
  const pathRpcUrl = includePath ? String(rpcDefaults.getPathRpcUrl(chainId) || '').trim() : '';
  const publicRpcUrls = Array.isArray(rpcDefaults.getPublicRpcUrls(chainId))
    ? rpcDefaults.getPublicRpcUrls(chainId)
    : [];
  return freezeUrlList([
    ...(pathRpcUrl ? [pathRpcUrl] : []),
    ...publicRpcUrls.filter((url) => String(url || '').trim() !== pathRpcUrl),
  ]);
};

// Client public fallbacks now live in client/src/variables/rpcDefaults.js. Keep CE-CC aligned
// while preserving the historical CE-CC ordering for its supported chains.
export const DEFAULT_RPC_URLS_BY_CHAIN = Object.freeze({
  [OPTIONAL_BASE_SEPOLIA_CHAIN_ID]: buildRpcDefaultsForChain(OPTIONAL_BASE_SEPOLIA_CHAIN_ID),
  [OP_SEPOLIA_CHAIN_ID]: buildRpcDefaultsForChain(OP_SEPOLIA_CHAIN_ID, { includePath: true }),
});

export function getDefaultRpcUrlsForChain(chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = parseChainId(chainId);
  return [
    ...(
      DEFAULT_RPC_URLS_BY_CHAIN[normalizedChainId || DEFAULT_CHAIN_ID]
      || DEFAULT_RPC_URLS_BY_CHAIN[DEFAULT_CHAIN_ID]
      || DEFAULT_RPC_URLS_BY_CHAIN[OP_SEPOLIA_CHAIN_ID]
      || DEFAULT_RPC_URLS_BY_CHAIN[OPTIONAL_BASE_SEPOLIA_CHAIN_ID]
    ),
  ];
}

export function resolveRpcUrlsForChain(chainId = DEFAULT_CHAIN_ID) {
  const normalizedChainId = parseChainId(chainId);
  const defaults = getDefaultRpcUrlsForChain(chainId);
  if (!EXPLICIT_RPC_URL) return defaults;
  const scopedDefaults = normalizedChainId && DEFAULT_RPC_URLS_BY_CHAIN[normalizedChainId]
    ? defaults
    : [];
  return [EXPLICIT_RPC_URL, ...scopedDefaults.filter((url) => url !== EXPLICIT_RPC_URL)];
}

export const DEFAULT_RPC_URLS = Object.freeze(resolveRpcUrlsForChain(DEFAULT_CHAIN_ID));

export const ARWEAVE_GATEWAY = 'https://ar-io.dev';
