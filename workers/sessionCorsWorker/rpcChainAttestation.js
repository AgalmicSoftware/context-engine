import {
  normalizeSafeRpcCode,
  normalizeSafeRpcStatus,
} from './rpcDiagnosticSafety.js';
import { toChainId as defaultToChainId } from './chainIdNormalization.js';

export const attestRpcEndpointChain = async ({
  rpcUrl,
  expectedChainId,
  rpcRequest,
  toChainId = defaultToChainId,
  cache,
} = {}) => {
  const expected = toChainId(expectedChainId);
  const target = typeof rpcUrl === 'string' ? rpcUrl.trim() : '';
  const cacheKey = `${expected}\u0000${target}`;
  const run = async () => {
    if (!expected || !target || typeof rpcRequest !== 'function') {
      return {
        ok: false,
        reason: 'rpc-chain-attestation-unavailable',
        expectedChainId: expected || null,
        actualChainId: null,
        status: null,
        code: null,
      };
    }
    try {
      const chainIdHex = await rpcRequest({
        rpcUrl: target,
        method: 'eth_chainId',
        params: [],
      });
      const actual = toChainId(chainIdHex);
      return {
        ok: actual === expected,
        reason: actual === expected ? '' : 'rpc-chain-mismatch',
        expectedChainId: expected,
        actualChainId: actual || null,
        status: null,
        code: null,
      };
    } catch (error) {
      return {
        ok: false,
        reason: 'rpc-chain-attestation-failed',
        expectedChainId: expected,
        actualChainId: null,
        status: normalizeSafeRpcStatus(error),
        code: normalizeSafeRpcCode(error),
      };
    }
  };

  if (!(cache instanceof Map)) return run();
  if (!cache.has(cacheKey)) cache.set(cacheKey, run());
  return cache.get(cacheKey);
};
