/*
 * @module rpcSelection
 * @description RPC endpoint selection and failover — picks primary and fallback RPC URLs
 *              for a given chain based on configuration and latency ranking.
 *
 * Key exports: getPrimaryRpcUrlForChain, getFallbackRpcUrlForChain, normalizeRpcCandidateList
 */
import { getDefaultHttpRpc, getPreferredPathRpcUrl } from '../../variables/chains.js';

type RpcChainLike = {
  id?: number;
  rpcUrls?: {
    default?: { http?: ReadonlyArray<string> };
    public?: { http?: ReadonlyArray<string> };
  };
};

export const normalizeRpcCandidateList = (urls: ReadonlyArray<string | null | undefined> = []): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  urls.forEach((raw) => {
    const url = String(raw || '').trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  });
  return out;
};

export const getPrimaryRpcUrlForChain = (chain: RpcChainLike): string => {
  const chainId = Number(chain?.id || 0);
  return (
    getPreferredPathRpcUrl(chainId) ||
    getDefaultHttpRpc(chainId, { allowPath: false }) ||
    chain?.rpcUrls?.default?.http?.[0] ||
    chain?.rpcUrls?.public?.http?.[0] ||
    ''
  );
};

export const getFallbackRpcUrlForChain = (chain: RpcChainLike): string => {
  const chainId = Number(chain?.id || 0);
  const primary = getPrimaryRpcUrlForChain(chain);
  const candidates = normalizeRpcCandidateList([
    getDefaultHttpRpc(chainId, { allowPath: false }),
    ...(Array.isArray(chain?.rpcUrls?.default?.http) ? chain.rpcUrls.default.http : []),
    ...(Array.isArray(chain?.rpcUrls?.public?.http) ? chain.rpcUrls.public.http : []),
  ]);
  return candidates.find((url) => url !== primary) || '';
};
