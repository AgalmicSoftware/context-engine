/**
 * @module sessionAddressHelpers
 * @description Session contract address resolution and block window helpers.
 *              Stateless — no module-level mutable state.
 *
 * Key exports: getSessionAddresses, getSessionBlockWindow, parsePositiveBlockNumber
 */
import { resolveDemoSessionBySlug } from './sessionConfigResolvers.js';
import { resolveSessionContractRef } from '../session/sessionNaming.js';
import { getSessionContractsForChain } from '../../variables/chains.js';

type AnyRecord = Record<string, any>;
type ContractRef = {
  address: string;
  chainId?: number;
};

function getSessionAddresses(cfg: AnyRecord | null | undefined): Record<string, ContractRef> {
  if (cfg && cfg.__unresolved) {
    return {};
  }
  const normalizeContractRef = (value: unknown): Partial<ContractRef> => {
    if (!value) return {};
    if (typeof value === 'string') {
      const address = value.trim();
      return address ? { address } : {};
    }
    if (typeof value !== 'object') return {};
    const source = value as AnyRecord;
    const address = String(source.address ?? source.contractAddress ?? source.addr ?? source.target ?? '').trim();
    const chainId = Number(source.chainId || source.chainID || source.networkChainId || source.chain || 0) || undefined;
    return {
      ...(address ? { address } : {}),
      ...(chainId ? { chainId } : {}),
    };
  };
  const out: Record<string, ContractRef> = {};
  // Temporary migration guard: registry cache can contain partial metadata before contracts are hydrated.
  // Do not implicitly fall back to "general" when cfg is missing/unknown.
  const hasExplicitSlug = typeof cfg?.slug === 'string';
  const fallbackCfg = hasExplicitSlug ? resolveDemoSessionBySlug(cfg.slug) : null;
  const declared = (cfg && cfg.contracts) || {};
  const fallbackContracts = (fallbackCfg && fallbackCfg.contracts) || {};
  const fallbackChainId = Number(cfg?.networkChainId || fallbackCfg?.networkChainId || 0) || undefined;
  const chainDefaultContracts: AnyRecord = fallbackChainId
    ? ((getSessionContractsForChain(fallbackChainId) || {}) as AnyRecord)
    : {};

  // 1) Copy all contract keys with per-field fallback to demo session config.
  const keys = new Set([
    ...Object.keys(chainDefaultContracts || {}),
    ...Object.keys(fallbackContracts),
    ...Object.keys(declared),
  ]);
  keys.forEach((key) => {
    const primary = normalizeContractRef(declared[key]);
    const secondary = normalizeContractRef(fallbackContracts[key]);
    const tertiary = normalizeContractRef((chainDefaultContracts || {})[key]);
    const address = primary.address || secondary.address || tertiary.address || '';
    if (address) {
      out[key] = {
        address,
        chainId: Number(primary.chainId || secondary.chainId || tertiary.chainId || fallbackChainId || 0) || undefined,
      };
    }
  });

  // 1b) Canonical contract keys with legacy fallback paths.
  const canonicalKeys = ['surveys', 'sbtFactory'];
  canonicalKeys.forEach((contractKey) => {
    if (out[contractKey]?.address) return;
    const fromCfg = resolveSessionContractRef({ sessionConfig: cfg, contractKey });
    const fromFallback = resolveSessionContractRef({ sessionConfig: fallbackCfg, contractKey });
    const fromChainDefault = normalizeContractRef((chainDefaultContracts || {})[contractKey]);
    const address = String(fromCfg.address || fromFallback.address || fromChainDefault.address || '').trim();
    if (!address) return;
    out[contractKey] = {
      address,
      chainId:
        Number(fromCfg.chainId || fromFallback.chainId || fromChainDefault.chainId || fallbackChainId || 0) ||
        undefined,
    };
  });

  return out;
}

function getSessionBlockWindow(
  cfg: AnyRecord | null,
  fromBlock: unknown,
  toBlock: unknown,
): { fromBlock: number; toBlock: number } {
  let f = Number(fromBlock || 0);
  let t = Number(toBlock || 0);
  const lim = cfg && cfg.blockLimits;
  if (lim && lim.start != null) f = Math.max(f, Number(lim.start));
  if (lim && lim.end != null) t = Math.min(t, Number(lim.end));
  return { fromBlock: f, toBlock: t };
}

const parsePositiveBlockNumber = (value: unknown): number | null => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.floor(n));
};

export { getSessionAddresses, getSessionBlockWindow, parsePositiveBlockNumber };
