import { resolveRpcUrlListForGate as resolveRpcUrlListForGateBoundary } from './gateRpcResolution.js';
import {
  resolveFaucetRpcUrl as resolveFaucetRpcUrlBoundary,
  resolveFaucetRpcUrls as resolveFaucetRpcUrlsBoundary,
  resolveRegistryRpcUrls as resolveRegistryRpcUrlsBoundary,
} from './registryFaucetRpcResolution.js';

const toStr = (value, deps) => (
  typeof deps?.toStr === 'function'
    ? deps.toStr(value)
    : typeof value === 'string'
      ? value
      : value == null
        ? ''
        : String(value)
);

export const createRegistryFaucetRpcHelpersWithWorkerDeps = ({
  deps,
  defaults,
} = {}) => {
  const toRegistrySessionSlug = (slug) => (
    (typeof deps?.normalizeWorkerSessionSlug === 'function'
      ? deps.normalizeWorkerSessionSlug(slug)
      : toStr(slug, deps).trim()) || 'general'
  );

  const resolveRegistryRpcUrls = (config) => (
    resolveRegistryRpcUrlsBoundary({
      config,
      deps: {
        normalizeRpcUrlList: deps?.normalizeRpcUrlList,
        mergeRpcUrlLists: deps?.mergeRpcUrlLists,
        toChainId: deps?.toChainId,
      },
    })
  );

  const resolveRegistryRpcUrl = (config) => resolveRegistryRpcUrls(config)[0] || '';

  const resolveRpcUrlListForGate = (config, gateChainId) => (
    resolveRpcUrlListForGateBoundary({
      config,
      gateChainId,
      deps: {
        normalizeRpcUrlList: deps?.normalizeRpcUrlList,
        mergeRpcUrlLists: deps?.mergeRpcUrlLists,
        toChainId: deps?.toChainId,
      },
    })
  );

  const resolveRpcUrlForGate = (config, gateChainId) => (
    resolveRpcUrlListForGate(config, gateChainId)[0] || ''
  );

  const resolveFaucetRpcUrl = (config, faucetCfg) => (
    resolveFaucetRpcUrlBoundary({
      config,
      faucetCfg,
      deps: {
        toStr: deps?.toStr,
        normalizeRpcUrlList: deps?.normalizeRpcUrlList,
        toChainId: deps?.toChainId,
        resolveRpcUrlListForGate,
      },
    })
  );

  const resolveFaucetRpcUrls = (config, faucetCfg) => (
    resolveFaucetRpcUrlsBoundary({
      config,
      faucetCfg,
      defaultFaucetRpcUrl: defaults?.defaultFaucetRpcUrl,
      deps: {
        normalizeRpcUrlList: deps?.normalizeRpcUrlList,
        mergeRpcUrlLists: deps?.mergeRpcUrlLists,
        toChainId: deps?.toChainId,
        resolveRpcUrlListForGate,
      },
    })
  );

  const isBytes32Hex = (value) => /^0x[0-9a-fA-F]{64}$/.test(toStr(value, deps).trim());

  return {
    toRegistrySessionSlug,
    resolveRegistryRpcUrls,
    resolveRegistryRpcUrl,
    resolveRpcUrlListForGate,
    resolveRpcUrlForGate,
    resolveFaucetRpcUrl,
    resolveFaucetRpcUrls,
    isBytes32Hex,
  };
};
