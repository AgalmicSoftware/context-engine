/**
 * @module sessionNaming
 * @description Session slug normalization, resolution, and display formatting.
 *              Provides canonical slug resolution, config alias mapping, and contract reference helpers.
 *
 * Key exports: normalizeSessionSlug, resolveActiveSessionSlug, resolveSessionConfigAliases, resolveSessionContractRef, mergeSessionContractMaps
 */
import { toStr } from '../shared/primitives.js';
import { readPublicUrlBasePath } from '../ui/publicUrl.js';
import { canonicalizeSessionSlug, resolveCanonicalSessionConfig } from './canonicalSessionContext.js';

const isObj = (val) => !!val && typeof val === 'object' && !Array.isArray(val);

const toPositiveNumber = (val) => {
  const num = Number(val || 0);
  return Number.isFinite(num) && num > 0 ? num : undefined;
};

const CONTRACT_KEY_ALIASES = Object.freeze({
  surveys: ['surveys', 'survey', 'surveysContract', 'surveyContract'],
  sbtFactory: ['sbtFactory', 'sbt_factory', 'sbtfactory', 'sbtFactoryContract', 'factory'],
});

const CONTRACT_ADDRESS_ALIASES = Object.freeze({
  surveys: ['surveysAddress', 'surveyAddress', 'surveysContractAddress', 'surveyContractAddress'],
  sbtFactory: ['sbtFactoryAddress', 'factoryAddress', 'sbtFactoryContractAddress'],
});

const CONTRACT_CHAINID_ALIASES = Object.freeze({
  surveys: ['surveysChainId', 'surveyChainId'],
  sbtFactory: ['sbtFactoryChainId', 'factoryChainId'],
});

export const normalizeSessionSlug = (rawSlug) => {
  return canonicalizeSessionSlug(rawSlug);
};

const stripConfiguredPublicBasePath = (pathname = '') => {
  const path = toStr(pathname).trim();
  const basePath = readPublicUrlBasePath();
  if (!path || !basePath || basePath === '/') return path;
  if (path === basePath || path === `${basePath}/`) return '/';
  if (path.startsWith(`${basePath}/`)) {
    return path.slice(basePath.length) || '/';
  }
  return path;
};

export const resolveSessionSlugFromPathname = (pathname = '') => {
  const path = stripConfiguredPublicBasePath(pathname);
  if (!path) return null;
  const match = path.match(/^\/session(?:\/([^/?#]+))?(?:[/?#]|$)/i);
  if (!match) return null;
  try {
    return normalizeSessionSlug(decodeURIComponent(toStr(match[1] || '')));
  } catch {
    return normalizeSessionSlug(match[1] || '');
  }
};

export const resolveActiveSessionSlug = (input = {}) => normalizeSessionSlug(
  input.activeSessionSlug ??
  input.sessionSlug ??
  input.slug
);

export const resolveSessionSlug = (input = {}) => normalizeSessionSlug(
  input.sessionSlug ??
  input.activeSessionSlug ??
  input.slug
);

export const resolveSessionSlugPinned = (input = {}) => (
  !!(input.sessionSlugPinned)
);

export const resolveSessionName = (input = {}) => (
  toStr(input.sessionName ?? '').trim()
);

export const resolveSessionAliases = (input = {}) => {
  const activeSessionSlug = resolveActiveSessionSlug(input);
  const sessionSlug = normalizeSessionSlug(input.sessionSlug ?? activeSessionSlug);
  const sessionSlugPinned = resolveSessionSlugPinned(input);
  const sessionName = resolveSessionName(input);
  return {
    activeSessionSlug,
    sessionSlug,
    sessionSlugPinned,
    sessionName,
  };
};

const normalizeContractRef = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const address = toStr(value).trim();
    return address ? { address } : null;
  }
  if (!isObj(value)) return null;
  const address = toStr(
    value.address ??
    value.contractAddress ??
    value.addr ??
    value.target ??
    value.value ??
    ''
  ).trim();
  const chainId = toPositiveNumber(
    value.chainId ??
    value.chainID ??
    value.networkChainId ??
    value.chain
  );
  if (!address && !chainId) return null;
  return {
    ...(address ? { address } : {}),
    ...(chainId ? { chainId } : {}),
  };
};

const pickContractRefFromMap = (contracts, keys = []) => {
  if (!isObj(contracts)) return null;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(contracts, key)) continue;
    const ref = normalizeContractRef(contracts[key]);
    if (ref && (ref.address || ref.chainId)) return ref;
  }
  return null;
};

const pickFirstStringFromConfig = (cfg, keys = []) => {
  if (!isObj(cfg)) return '';
  for (const key of keys) {
    const value = toStr(cfg[key]).trim();
    if (value) return value;
  }
  return '';
};

const pickFirstChainIdFromConfig = (cfg, keys = []) => {
  if (!isObj(cfg)) return undefined;
  for (const key of keys) {
    const value = toPositiveNumber(cfg[key]);
    if (value) return value;
  }
  return undefined;
};

export const mergeSessionContractMaps = (...maps) => {
  const out = {};
  maps.forEach((map) => {
    if (!isObj(map)) return;
    Object.entries(map).forEach(([key, value]) => {
      const next = normalizeContractRef(value);
      if (!next) return;
      out[key] = {
        ...(isObj(out[key]) ? out[key] : {}),
        ...(next.address ? { address: next.address } : {}),
        ...(next.chainId ? { chainId: next.chainId } : {}),
      };
    });
  });
  return out;
};

export const resolveSessionConfigAliases = (input = {}, opts = {}) => {
  const source = isObj(input) ? input : {};
  const defaults = isObj(opts.defaults) ? opts.defaults : {};
  const resolveBySlug = typeof opts.resolveBySlug === 'function' ? opts.resolveBySlug : null;
  const resolved = resolveCanonicalSessionConfig({
    source,
    defaults,
    resolveBySlug,
    fallbackConfig: opts.fallbackConfig,
  });

  return {
    hasExplicitSessionSlug: resolved.hasExplicitSessionSlug,
    sessionSlug: resolved.sessionSlug,
    sessionConfig: resolved.sessionConfig,
    sessionConfigSource: resolved.sessionConfigSource,
    warnings: resolved.warnings,
    provenance: resolved.provenance,
  };
};

export const resolveSessionContractRef = (input = {}) => {
  const aliases = resolveSessionConfigAliases(input, {
    defaults: input.defaults,
    resolveBySlug: input.resolveBySlug,
    fallbackConfig: input.fallbackConfig,
  });
  const cfg = aliases.sessionConfig;
  const contracts = mergeSessionContractMaps(
    isObj(cfg?.contracts) ? cfg.contracts : null,
    isObj(input.contracts) ? input.contracts : null
  );
  const contractKey = toStr(input.contractKey || '').trim();
  if (!contractKey) {
    return {
      ...aliases,
      contractKey: '',
      address: '',
      chainId: undefined,
    };
  }
  const keyAliases = CONTRACT_KEY_ALIASES[contractKey];
  if (!keyAliases) {
    return {
      ...aliases,
      contractKey,
      address: '',
      chainId: undefined,
    };
  }
  const refFromMap = pickContractRefFromMap(contracts, keyAliases) || {};

  const addressFallbackAliases = CONTRACT_ADDRESS_ALIASES[contractKey] || [];
  const chainIdFallbackAliases = CONTRACT_CHAINID_ALIASES[contractKey] || [];

  const address = (
    toStr(refFromMap.address).trim() ||
    pickFirstStringFromConfig(cfg, addressFallbackAliases)
  );
  const chainId = (
    toPositiveNumber(refFromMap.chainId) ||
    pickFirstChainIdFromConfig(cfg, chainIdFallbackAliases) ||
    toPositiveNumber(cfg?.networkChainId)
  );

  return {
    ...aliases,
    contractKey,
    address,
    chainId,
  };
};
