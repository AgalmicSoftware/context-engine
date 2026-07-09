/**
 * @module chainIdResolution
 * @description Shared chain-id extraction helpers for session and contract config objects.
 */

import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';

export { DEFAULT_CHAIN_ID };

type ChainEntry = {
  chainId?: unknown;
};
type ChainConfig = {
  contracts?: {
    sbtFactory?: ChainEntry;
    surveys?: ChainEntry;
  };
  networkChainId?: unknown;
  __registry?: ChainEntry;
};
type ExtractChainIdOptions = {
  contractKey?: unknown;
  strict?: boolean;
};

export function extractChainId(cfg: unknown, options: ExtractChainIdOptions | null = null): number {
  const config = cfg && typeof cfg === 'object' ? (cfg as ChainConfig) : {};
  const contractKey = String(options?.contractKey || '').trim();
  const strict = options?.strict === true;
  const preferredCandidates =
    contractKey === 'sbtFactory'
      ? [config.contracts?.sbtFactory?.chainId, config.networkChainId, config.contracts?.surveys?.chainId]
      : contractKey === 'surveys'
        ? [config.contracts?.surveys?.chainId, config.networkChainId, config.contracts?.sbtFactory?.chainId]
        : [config.networkChainId, config.contracts?.surveys?.chainId, config.contracts?.sbtFactory?.chainId];

  const orderedCandidates = strict
    ? preferredCandidates.concat([0])
    : preferredCandidates.concat([config.__registry?.chainId, DEFAULT_CHAIN_ID, 0]);
  for (const candidate of orderedCandidates) {
    const id = Number(candidate || 0);
    if (Number.isFinite(id) && id > 0) return Math.floor(id);
  }
  return 0;
}

export function extractChainIdOrUndefined(
  cfg: unknown,
  options: ExtractChainIdOptions | null = null,
): number | undefined {
  const config = cfg && typeof cfg === 'object' ? (cfg as ChainConfig) : {};
  const contractKey = String(options?.contractKey || '').trim();
  const preferredCandidates =
    contractKey === 'sbtFactory'
      ? [config.contracts?.sbtFactory?.chainId, config.networkChainId, config.contracts?.surveys?.chainId]
      : contractKey === 'surveys'
        ? [config.contracts?.surveys?.chainId, config.networkChainId, config.contracts?.sbtFactory?.chainId]
        : [config.networkChainId, config.contracts?.surveys?.chainId, config.contracts?.sbtFactory?.chainId];

  const orderedCandidates = preferredCandidates.concat([config.__registry?.chainId]);
  for (const candidate of orderedCandidates) {
    const id = Number(candidate || 0);
    if (Number.isFinite(id) && id > 0) return Math.floor(id);
  }
  return undefined;
}
