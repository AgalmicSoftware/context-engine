'use strict';

const {
  getFaucetFallbackRpcUrls,
  getPathRpcUrl,
  getPublicRpcUrls,
} = require('../../client/src/variables/rpcDefaults.js');
const { resolveChainDefaults } = require('./network-defaults');

const toBool = (value) => /^(1|true|yes|y)$/i.test(String(value || '').trim());

const normalizeRpcUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const dedupeRpcUrls = (...lists) => {
  const seen = new Set();
  const merged = [];
  lists.forEach((list) => {
    (Array.isArray(list) ? list : [list]).forEach((value) => {
      const normalized = normalizeRpcUrl(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      merged.push(normalized);
    });
  });
  return merged;
};

const parseRpcRewriteSources = (raw) => String(raw || '')
  .split(',')
  .map((value) => normalizeRpcUrl(value))
  .filter(Boolean);

const isBrowserUnsafeRpcTarget = (value) => {
  const normalized = normalizeRpcUrl(value);
  if (!normalized) return false;
  try {
    return new URL(normalized).hostname.toLowerCase().endsWith('base.org');
  } catch (_) {
    return false;
  }
};

const resolveRpcRewriteConfig = ({ env = process.env } = {}) => {
  const chainContext = resolveChainDefaults({ env });
  const chainId = Number(chainContext?.chainId || 0) || 0;
  const rpcUrlOverride = normalizeRpcUrl(env.RPC_URL || '');
  const preferPathRpc = toBool(env.E2E_PREFER_PATH_RPC);
  const forceUnsafeRpcRewrite = toBool(env.FORCE_BROWSER_RPC_REWRITE);
  const rewriteTargets = String(env.RPC_REWRITE_FROM || '').trim()
    ? parseRpcRewriteSources(env.RPC_REWRITE_FROM)
    : dedupeRpcUrls(
        getPublicRpcUrls(chainId),
        getPathRpcUrl(chainId),
        getFaucetFallbackRpcUrls(chainId),
      );
  const browserUnsafeRpcTargets = dedupeRpcUrls(rewriteTargets, rpcUrlOverride)
    .filter((url) => isBrowserUnsafeRpcTarget(url));
  const unsafeTargetSet = new Set(browserUnsafeRpcTargets.map((url) => url.toLowerCase()));
  const rpcRewriteTarget = (
    rpcUrlOverride &&
    !forceUnsafeRpcRewrite &&
    unsafeTargetSet.has(rpcUrlOverride.toLowerCase())
  )
    ? ''
    : rpcUrlOverride;

  return {
    chainId,
    preferPathRpc,
    forceUnsafeRpcRewrite,
    rpcUrlOverride,
    rpcRewriteTarget,
    rewriteTargets,
    browserUnsafeRpcTargets,
  };
};

module.exports = {
  dedupeRpcUrls,
  normalizeRpcUrl,
  resolveRpcRewriteConfig,
};
