import { baseSepolia, optimismSepolia, getDefaultHttpRpc, getPreferredPathRpcUrl } from '../../variables/chains.js';
import { getFallbackRpcUrlForChain, getPrimaryRpcUrlForChain, normalizeRpcCandidateList } from './rpcSelection.js';

const probeChainRpcWithFallback = async (chain, request) => {
  const primary = getPrimaryRpcUrlForChain(chain);
  const fallback = getFallbackRpcUrlForChain(chain);
  const ordered = normalizeRpcCandidateList([primary, fallback]);
  const attempts = [];

  for (const url of ordered) {
    const res = await request(url);
    attempts.push({ url, ok: !!res?.ok, status: Number(res?.status || 0) });
    if (res?.ok) {
      return {
        selectedUrl: url,
        primary,
        fallback,
        usedFallback: url === fallback,
        attempts,
      };
    }
  }

  throw new Error(`All RPC candidates failed for chain ${Number(chain?.id || 0) || 'unknown'}`);
};

describe('App RPC selection + fallback smoke', () => {
  it('resolves primary RPC deterministically for Base Sepolia and OP Sepolia', () => {
    const basePrimary = getPrimaryRpcUrlForChain(baseSepolia);
    const opPrimary = getPrimaryRpcUrlForChain(optimismSepolia);

    const expectedBasePrimary =
      getPreferredPathRpcUrl(84532) ||
      getDefaultHttpRpc(84532, { allowPath: false }) ||
      baseSepolia?.rpcUrls?.default?.http?.[0] ||
      baseSepolia?.rpcUrls?.public?.http?.[0] ||
      '';
    const expectedOpPrimary =
      getPreferredPathRpcUrl(11155420) ||
      getDefaultHttpRpc(11155420, { allowPath: false }) ||
      optimismSepolia?.rpcUrls?.default?.http?.[0] ||
      optimismSepolia?.rpcUrls?.public?.http?.[0] ||
      '';

    expect(basePrimary).toBe(expectedBasePrimary);
    expect(opPrimary).toBe(expectedOpPrimary);
    expect(basePrimary).toBeTruthy();
    expect(opPrimary).toBeTruthy();
  });

  it('falls back to secondary RPC for Base Sepolia when primary is unavailable', async () => {
    const primary = getPrimaryRpcUrlForChain(baseSepolia);
    const fallback = getFallbackRpcUrlForChain(baseSepolia);
    expect(primary).toBeTruthy();
    expect(fallback).toBeTruthy();
    expect(fallback).not.toBe(primary);

    const request = jest.fn(async (url) => {
      if (url === primary) return { ok: false, status: 503 };
      if (url === fallback) return { ok: true, status: 200 };
      return { ok: false, status: 404 };
    });

    const result = await probeChainRpcWithFallback(baseSepolia, request);

    expect(result.usedFallback).toBe(true);
    expect(result.selectedUrl).toBe(fallback);
    expect(result.attempts.map((entry) => entry.url)).toEqual([primary, fallback]);
  });

  it('falls back to secondary RPC for OP Sepolia when primary is unavailable', async () => {
    const primary = getPrimaryRpcUrlForChain(optimismSepolia);
    const fallback = getFallbackRpcUrlForChain(optimismSepolia);
    expect(primary).toBeTruthy();
    expect(fallback).toBeTruthy();
    expect(fallback).not.toBe(primary);

    const request = jest.fn(async (url) => {
      if (url === primary) return { ok: false, status: 502 };
      if (url === fallback) return { ok: true, status: 200 };
      return { ok: false, status: 404 };
    });

    const result = await probeChainRpcWithFallback(optimismSepolia, request);

    expect(result.usedFallback).toBe(true);
    expect(result.selectedUrl).toBe(fallback);
    expect(result.attempts.map((entry) => entry.url)).toEqual([primary, fallback]);
  });
});
