/**
 * @file sponsoredAccess.js
 * @module sponsoredAccess
 * @description Sponsored resource access — resolves whether a resource is gated, open, or sponsored.
 *              Checks SBT gate conditions and faucet configuration for session resources.
 *
 * Key exports: checkSponsoredAccess, getDefaultSponsoredGate, getGateSbtAddresses, SPONSORED_GATE_STATES, normalizeGateMode
 */
import { ethers } from 'ethers';
import contractScripts from './contractScripts.js';
import { toStr } from '../shared/primitives.js';

export const SPONSORED_GATE_STATES = Object.freeze({
  RESTRICTED: 'restricted',
  OPEN: 'open',
  UNRESOLVED: 'unresolved',
  UNAVAILABLE: 'unavailable',
});

const normalizeGateMode = (gate = {}) => {
  if (!gate) return 'any';

  const requireAll = gate.requireAll;
  if (
    requireAll === true ||
    requireAll === 1 ||
    toStr(requireAll).trim() === '1'
  ) {
    return 'all';
  }

  const raw = toStr(gate.mode || gate.operator || gate.gateMode || gate.require || '')
    .trim()
    .toLowerCase();
  if (raw === 'all' || raw === 'and' || raw === '1') return 'all';
  return 'any';
};

const getGateSbtAddresses = (gate = {}) => {
  const out = [];
  const seen = new Set();
  const push = (addr) => {
    if (!ethers.utils.isAddress(addr)) return;
    const lower = addr.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    out.push(addr);
  };
  if (Array.isArray(gate?.sbtAddresses)) {
    gate.sbtAddresses.forEach(push);
  }
  if (gate?.sbtAddress) push(gate.sbtAddress);
  return out;
};

const resolveOnChainGateForResource = (cfg = {}, resourceKey = '') => {
  const registry = cfg?.__registry && typeof cfg.__registry === 'object' ? cfg.__registry : {};
  const gateAuthority = toStr(registry.gateAuthority).trim().toLowerCase();
  const gatesByResource = registry.gatesByResource && typeof registry.gatesByResource === 'object'
    ? registry.gatesByResource
    : null;
  const key = toStr(resourceKey).trim() || 'default';
  if (gateAuthority !== 'onchain') {
    return {
      handled: true,
      resourceKey: key,
      status: SPONSORED_GATE_STATES.UNAVAILABLE,
      gate: null,
    };
  }
  if (!gatesByResource) {
    return {
      handled: true,
      resourceKey: key,
      status: SPONSORED_GATE_STATES.UNAVAILABLE,
      gate: null,
    };
  }

  const gateSnapshot = gatesByResource[key] || null;
  const lookupStatus = toStr(gateSnapshot?.lookupStatus).trim().toLowerCase();
  if (lookupStatus !== 'ok') {
    return {
      handled: true,
      resourceKey: key,
      status: SPONSORED_GATE_STATES.UNRESOLVED,
      gate: null,
    };
  }
  const sbtAddresses = getGateSbtAddresses({
    sbtAddresses: gateSnapshot?.sbtAddresses,
    sbtAddress: gateSnapshot?.sbtAddress,
  });
  if (!sbtAddresses.length) {
    return {
      handled: true,
      resourceKey: key,
      status: SPONSORED_GATE_STATES.OPEN,
      gate: null,
    };
  }
  return {
    handled: true,
    resourceKey: key,
    status: SPONSORED_GATE_STATES.RESTRICTED,
    gate: {
      type: 'sbt',
      label: toStr(gateSnapshot?.label || gateSnapshot?.name || gateSnapshot?.title).trim() || `Registry ${key} gate`,
      gateId: toStr(gateSnapshot?.gateId || gateSnapshot?.id).trim() || null,
      sbtAddress: sbtAddresses[0],
      sbtAddresses,
      chainId: gateSnapshot?.chainId || cfg.networkChainId || null,
      litChain: gateSnapshot?.litChain || gateSnapshot?.chain || null,
      mode: gateSnapshot?.mode || 'any',
      perMemberLimit: gateSnapshot?.perMemberLimit || null,
    },
  };
};

export const getDefaultSponsoredGate = (cfg = {}) => {
  return resolveOnChainGateForResource(cfg, 'default').gate;
};

export const resolveSponsoredGateStateForResource = (cfg = {}, resourceKey = '') => {
  return resolveOnChainGateForResource(cfg, resourceKey || 'default');
};

export const resolveSponsoredGateForResource = (cfg = {}, resourceKey = '') => {
  return resolveSponsoredGateStateForResource(cfg, resourceKey || 'default').gate;
};

const accessCache = new Map();
const ACCESS_CACHE_HIT_TTL_MS = 30 * 1000;
const ACCESS_CACHE_STALE_TTL_MS = 15 * 60 * 1000;
const ACCESS_CACHE_MAX = 500;

const pruneAccessCache = (nowIn = Date.now()) => {
  const now = Number(nowIn || Date.now());
  const staleBefore = now - ACCESS_CACHE_STALE_TTL_MS;
  accessCache.forEach((entry, key) => {
    const ts = Number(entry?.ts || 0);
    if (!Number.isFinite(ts) || ts <= 0 || ts <= staleBefore) {
      accessCache.delete(key);
    }
  });
  while (accessCache.size > ACCESS_CACHE_MAX) {
    const oldest = accessCache.keys().next().value;
    if (!oldest) break;
    accessCache.delete(oldest);
  }
};

export const checkSponsoredAccess = async ({
  sessionConfig,
  sessionSlug,
  account,
  resourceKey,
} = {}) => {
  const cfg = sessionConfig || null;
  const gateState = resolveSponsoredGateStateForResource(cfg || {}, resourceKey);
  const gate = gateState?.gate || null;
  if (!gate || gate.type !== 'sbt') {
    if (gateState?.status === SPONSORED_GATE_STATES.OPEN) {
      return { status: 'no-gate', gate: null, resourceKey };
    }
    if (
      gateState?.status === SPONSORED_GATE_STATES.UNAVAILABLE ||
      gateState?.status === SPONSORED_GATE_STATES.UNRESOLVED
    ) {
      return { status: 'unknown', gate: null, resourceKey };
    }
    return { status: 'no-gate', gate: gate || null, resourceKey };
  }
  if (!account || !ethers.utils.isAddress(account)) {
    return { status: 'needs-wallet', gate, resourceKey };
  }
  const sbtAddresses = getGateSbtAddresses(gate);
  if (!sbtAddresses.length) {
    return { status: 'invalid-gate', gate, resourceKey };
  }

  const mode = normalizeGateMode(gate);
  const addressKey = sbtAddresses.map((addr) => addr.toLowerCase()).sort().join('|');
  const key = `${account.toLowerCase()}:${addressKey}:${gate.chainId || ''}:${mode}:${resourceKey}`;
  const now = Date.now();
  pruneAccessCache(now);
  const cached = accessCache.get(key);
  if (cached && (now - Number(cached.ts || 0)) < ACCESS_CACHE_HIT_TTL_MS) {
    return cached.value;
  }
  if (cached) accessCache.delete(key);

  try {
    const checks = await Promise.all(
      sbtAddresses.map((addr) =>
        contractScripts.userHasSBT(
          'none',
          addr,
          account,
          0,
          'latest',
          cfg || sessionSlug || ''
        )
      )
    );
    const has =
      mode === 'all'
        ? checks.every(Boolean)
        : checks.some(Boolean);
    const value = { status: has ? 'granted' : 'denied', gate, resourceKey };
    const writeTs = Date.now();
    accessCache.set(key, { ts: writeTs, value });
    pruneAccessCache(writeTs);
    return value;
  } catch (err) {
    return { status: 'error', error: err?.message || 'unknown', gate, resourceKey };
  }
};

export const sponsoredAccessUtils = {
  getDefaultSponsoredGate,
  resolveSponsoredGateStateForResource,
  resolveSponsoredGateForResource,
  checkSponsoredAccess,
  getGateSbtAddresses,
  normalizeGateMode,
  SPONSORED_GATE_STATES,
};

export { getGateSbtAddresses, normalizeGateMode };
