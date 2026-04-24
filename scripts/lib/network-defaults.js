'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { ROOT, toInt, toStr } = require('./common');

const APP_CONFIG_PATH = path.join(ROOT, 'client', 'src', 'variables', 'appConfig.js');
const CHAINS_PATH = path.join(ROOT, 'client', 'src', 'variables', 'chains.js');
const CONTRACTS_CONFIG_PATH = path.join(ROOT, 'client', 'src', 'variables', 'contracts.json');
const LOCAL_CONTRACTS_PATH = path.join(ROOT, 'client', 'src', 'variables', 'local-contracts.json');
const RPC_DEFAULTS_PATH = path.join(ROOT, 'client', 'src', 'variables', 'rpcDefaults.js');

const { getPublicRpcUrls } = require(RPC_DEFAULTS_PATH);
const getFirstPublicRpcUrl = (chainId) => toStr(getPublicRpcUrls(chainId)?.[0]).trim();
const readTextFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return '';
  }
};
const parseDefaultChainIdFromAppConfig = (source) => {
  const src = toStr(source);
  if (!src) return 0;

  const envFallbackMatch = src.match(
    /export\s+const\s+DEFAULT_CHAIN_ID\s*=\s*(?:\d+\s*&&\s*)?readPublicIntEnv\(\s*["'`][^"'`]+["'`]\s*,\s*(\d+)/m,
  );
  if (envFallbackMatch) {
    return Number.parseInt(envFallbackMatch[1], 10);
  }

  const directMatch = src.match(/export\s+const\s+DEFAULT_CHAIN_ID\s*=\s*(\d+)/m);
  return directMatch ? Number.parseInt(directMatch[1], 10) : 0;
};
const APP_CONFIG_SOURCE = readTextFile(APP_CONFIG_PATH);
const CONFIGURED_DEFAULT_CHAIN_ID = (
  toInt(process.env.REACT_APP_DEFAULT_CHAIN_ID, 0) ||
  parseDefaultChainIdFromAppConfig(APP_CONFIG_SOURCE)
);

const FALLBACKS = Object.freeze({
  defaultChainId: CONFIGURED_DEFAULT_CHAIN_ID,
  rpcByChain: Object.freeze({
    31337: 'http://127.0.0.1:8545',
    10: getFirstPublicRpcUrl(10),
    8453: getFirstPublicRpcUrl(8453),
    // Keep OP Sepolia and Base Sepolia sourced from the shared public-RPC manifest.
    // Override with RPC_URL for E2E/seed reliability; longer runs often need a paid endpoint to avoid rate limits/timeouts.
    11155420: getFirstPublicRpcUrl(11155420),
    84532: getFirstPublicRpcUrl(84532),
  }),
  registryByChain: {
    11155420: '0xDcB1731984E9F75c6a061c38dD8b67d18De4C0c1',
  },
  sbtFactoryByChain: {
    11155420: '0x8CBeE1EE46603b446b499cb32F63fa9860a50478',
  },
});

const LIT_CHAIN_BY_ID = Object.freeze({
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

const CHAIN_ALIASES = Object.freeze({
  mainnet: 1,
  ethereum: 1,
  eth: 1,
  optimism: 10,
  'op-mainnet': 10,
  opmainnet: 10,
  op: 10,
  'optimism-sepolia': 11155420,
  optimismsepolia: 11155420,
  'op-sepolia': 11155420,
  opsepolia: 11155420,
  arbitrum: 42161,
  arb: 42161,
  'arbitrum-one': 42161,
  arbitrumone: 42161,
  'arbitrum-sepolia': 421614,
  arbitrumsepolia: 421614,
  'arb-sepolia': 421614,
  arbsepolia: 421614,
  bsc: 56,
  bnb: 56,
  polygon: 137,
  matic: 137,
  celo: 42220,
  base: 8453,
  'base-mainnet': 8453,
  basemainnet: 8453,
  'base-sepolia': 84532,
  basesepolia: 84532,
  local: 31337,
  localhost: 31337,
  anvil: 31337,
  hardhat: 31337,
  katana: 747474,
});

let cache = null;

const readJsonFile = (filePath, fallback = {}) => {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
};

const normalizeNumericKeyedObject = (value) => Object.fromEntries(
  Object.entries(value || {})
    .map(([key, entry]) => [Number.parseInt(String(key), 10), entry])
    .filter(([key]) => Number.isFinite(key))
);

const normalizeChainAliasKey = (value) => (
  toStr(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
);

const resolveChainAlias = (value) => {
  const raw = toStr(value).trim();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) {
    return Number.parseInt(raw, 10);
  }
  const normalized = normalizeChainAliasKey(raw);
  if (!normalized) return 0;
  const compact = normalized.replace(/-/g, '');
  return Number(CHAIN_ALIASES[normalized] || CHAIN_ALIASES[compact] || 0);
};

const normalizeAddress = (value) => toStr(value).trim().toLowerCase();
const normalizeHost = (value) => toStr(value).trim().toLowerCase().replace(/^\[(.*)\]$/, '$1');
const isLoopbackHost = (value) => {
  const host = normalizeHost(value);
  return host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0' || host === '::1';
};

const canUseLocalDevFunder = ({ chainMode, rpcChainId } = {}) => (
  toStr(chainMode).trim().toLowerCase() === 'local' &&
  Number(rpcChainId || 0) === 31337
);

const isLoopbackBaseUrl = (value) => {
  const raw = toStr(value).trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return isLoopbackHost(parsed.hostname);
  } catch (_) {
    return false;
  }
};

const parseExportedString = (source, name) => {
  const src = toStr(source);
  const directRe = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*["'\`]([^"'\`]*)["'\`]`, 'm');
  const directMatch = src.match(directRe);
  if (directMatch) return toStr(directMatch[1]).trim();

  const envFallbackRe = new RegExp(
    `export\\s+const\\s+${name}\\s*=\\s*readPublicEnv\\(\\s*["'\`][^"'\`]+["'\`]\\s*,\\s*["'\`]([^"'\`]*)["'\`]`,
    'm',
  );
  const envFallbackMatch = src.match(envFallbackRe);
  return envFallbackMatch ? toStr(envFallbackMatch[1]).trim() : '';
};

const parseExportedObject = (source, name) => {
  const src = toStr(source);
  if (!src) return null;

  const exportRe = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*`, 'm');
  const exportMatch = exportRe.exec(src);
  if (!exportMatch) return null;

  const startIdx = src.indexOf('{', exportMatch.index + exportMatch[0].length);
  if (startIdx < 0) return null;

  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  let endIdx = -1;

  for (let i = startIdx; i < src.length; i += 1) {
    const ch = src[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (!inDouble && !inTemplate && ch === '\'') {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;

    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx < 0) return null;
  const objectLiteral = src.slice(startIdx, endIdx + 1).trim();
  if (!objectLiteral) return null;

  try {
    return vm.runInNewContext(`(${objectLiteral})`, Object.create(null), { timeout: 200 });
  } catch (_) {
    return null;
  }
};

const loadClientDefaults = () => {
  if (cache) return cache;

  let appConfigText = APP_CONFIG_SOURCE;
  let chainsText = '';
  const contractsConfig = readJsonFile(CONTRACTS_CONFIG_PATH, {});
  try {
    chainsText = fs.readFileSync(CHAINS_PATH, 'utf8');
  } catch (_) {
    chainsText = '';
  }

  if (!appConfigText) {
    appConfigText = readTextFile(APP_CONFIG_PATH);
  }

  const defaultChainId = parseDefaultChainIdFromAppConfig(appConfigText) || FALLBACKS.defaultChainId;
  const defaultWorkerUrl = parseExportedString(appConfigText, 'CLOUDFLARE_CORS_WORKER_URL');
  const parsedRegistryByChain = parseExportedObject(chainsText, 'SESSION_REGISTRY_ADDRESSES');
  const localContracts = readJsonFile(LOCAL_CONTRACTS_PATH, {});
  const localChainId = toInt(localContracts.chainId, 0);
  const localRegistryAddress = toStr(localContracts.SessionRegistry).trim();
  const registryByChain = (
    parsedRegistryByChain && Object.keys(parsedRegistryByChain).length > 0
      ? parsedRegistryByChain
      : {
          ...FALLBACKS.registryByChain,
          ...normalizeNumericKeyedObject(contractsConfig.sessionRegistryAddresses),
          ...(localChainId && localRegistryAddress ? { [localChainId]: localRegistryAddress } : {}),
        }
  );
  const parsedContractsByChain = parseExportedObject(chainsText, 'SESSION_CONTRACTS_BY_CHAIN');
  const localContractsByChain = (
    localChainId
      ? {
          [localChainId]: {
            ...(toStr(localContracts.Surveys).trim()
              ? { surveys: toStr(localContracts.Surveys).trim() }
              : {}),
            ...(toStr(localContracts.SBTFactory).trim()
              ? { sbtFactory: toStr(localContracts.SBTFactory).trim() }
              : {}),
          },
        }
      : {}
  );
  const contractsByChain = (
    parsedContractsByChain && Object.keys(parsedContractsByChain).length > 0
      ? parsedContractsByChain
      : {
          ...normalizeNumericKeyedObject(contractsConfig.sessionContractsByChain),
          ...localContractsByChain,
        }
  );

  const sbtFactoryByChain = { ...FALLBACKS.sbtFactoryByChain };
  Object.keys(contractsByChain || {}).forEach((key) => {
    const chainId = Number.parseInt(String(key), 10);
    if (!Number.isFinite(chainId)) return;
    const chainContracts = contractsByChain[key] || {};
    const candidate = toStr(chainContracts.sbtFactory).trim();
    if (candidate) sbtFactoryByChain[chainId] = candidate;
  });

  cache = {
    defaultChainId,
    defaultWorkerUrl,
    registryByChain,
    contractsByChain,
    sbtFactoryByChain,
  };
  return cache;
};

const resolveRpcDefault = (chainId) => {
  return toStr(FALLBACKS.rpcByChain[Number(chainId)] || FALLBACKS.rpcByChain[FALLBACKS.defaultChainId]).trim();
};

const resolveLitChainForChainId = (chainId, fallback = 'ethereum') => {
  const id = Number(chainId || 0);
  return toStr(LIT_CHAIN_BY_ID[id] || fallback).trim() || 'ethereum';
};

const resolveChainDefaults = ({ args = {}, env = process.env } = {}) => {
  const defaults = loadClientDefaults();
  const chainMode = toStr(args['chain-mode'] || env.E2E_CHAIN_MODE).trim().toLowerCase() || 'onchain';

  const chainArgRaw = toStr(args.chain || env.CHAIN).trim();
  const chainFromAlias = resolveChainAlias(chainArgRaw);
  const explicitChain = toInt(args['chain-id'] || env.CHAIN_ID, 0);

  if (chainArgRaw && !chainFromAlias) {
    throw new Error(`Unknown chain selector: ${chainArgRaw}`);
  }

  if (explicitChain && chainFromAlias && Number(explicitChain) !== Number(chainFromAlias)) {
    throw new Error(
      `Conflicting chain selectors: chain-id=${explicitChain} vs chain=${chainArgRaw} (${chainFromAlias})`,
    );
  }

  let chainId = explicitChain || chainFromAlias || Number(defaults.defaultChainId || FALLBACKS.defaultChainId);

  if (!explicitChain && !chainFromAlias && chainMode === 'local') {
    chainId = 31337;
  }

  const rpcUrl = toStr(args['rpc-url'] || env.RPC_URL).trim() || resolveRpcDefault(chainId);
  const explicitSessionRegistry = toStr(args['session-registry'] || env.SESSION_REGISTRY).trim();
  const sessionRegistry = explicitSessionRegistry
    || toStr(defaults.registryByChain?.[chainId]).trim()
    || toStr(FALLBACKS.registryByChain[chainId]).trim();

  const sbtFactory = toStr(args['sbt-factory'] || env.SBT_FACTORY).trim()
    || toStr(defaults.sbtFactoryByChain?.[chainId]).trim()
    || toStr(FALLBACKS.sbtFactoryByChain[chainId]).trim();

  const baseUrl = toStr(args['base-url'] || env.BASE_URL).trim();
  const allowRegistryMismatch = /^(1|true|yes|y)$/i.test(
    toStr(args['allow-registry-mismatch'] || env.ALLOW_SESSION_REGISTRY_MISMATCH).trim()
  );
  const clientRegistry = toStr(defaults.registryByChain?.[chainId]).trim();
  if (
    explicitSessionRegistry &&
    clientRegistry &&
    isLoopbackBaseUrl(baseUrl) &&
    !allowRegistryMismatch &&
    normalizeAddress(explicitSessionRegistry) !== normalizeAddress(clientRegistry)
  ) {
    throw new Error(
      `SESSION_REGISTRY override ${explicitSessionRegistry} does not match ` +
      `client registry ${clientRegistry} for chain ${chainId} while BASE_URL=${baseUrl}. ` +
      `Update your env or set ALLOW_SESSION_REGISTRY_MISMATCH=1 if intentional.`
    );
  }

  return {
    chainId: Number(chainId),
    chainMode: chainMode === 'local' || Number(chainId) === 31337 ? 'local' : 'onchain',
    rpcUrl,
    sessionRegistry,
    sbtFactory,
    parsedDefaults: defaults,
  };
};

module.exports = {
  CHAINS_PATH,
  FALLBACKS,
  APP_CONFIG_PATH,
  canUseLocalDevFunder,
  loadClientDefaults,
  resolveChainDefaults,
  resolveLitChainForChainId,
  resolveRpcDefault,
};
