import { boundedAgentFetch } from './transport.mjs';
import { safeString, lower } from './runtimePrimitives.mjs';
import { resolveSessionRegistryAddress } from './registrySessions.mjs';
import { ARWEAVE_GATEWAYS, DEFAULT_SCAN_BLOCKS, DEFAULT_LOG_CHUNK_SIZE, DEFAULT_RPC_TIMEOUT_MS, QUESTIONS_ADDED_TOPIC0, SESSION_CREATED_TOPIC0, normalizeBlock, rpcTimeoutMs, normalizeHexAddress, decodeAbiString, decodeBytes32ArrayFromData } from './registryQuestionCore.mjs';

export async function rpcRequest({
  rpcUrl = '',
  method = '',
  params = [],
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
  const response = await boundedAgentFetch(fetchImpl, { timeoutMs, maxBytes: 2 * 1024 * 1024 })(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) throw new Error('registry_rpc_request_failed');
  return body?.result;
}

export async function rpcWithFallback({
  rpcUrls = [],
  method = '',
  params = [],
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  let lastError = null;
  for (const rpcUrl of rpcUrls) {
    try {
      return {
        ok: true,
        result: await rpcRequest({ rpcUrl, method, params, fetchImpl, timeoutMs }),
        rpcUrl,
      };
    } catch (error) {
      lastError = error;
    }
  }
  return {
    ok: false,
    error: safeString(lastError?.message || lastError) || `No RPC URL succeeded for ${method}`,
  };
}

export async function ethCall({
  rpcUrls = [],
  to = '',
  data = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  const result = await rpcWithFallback({
    rpcUrls,
    method: 'eth_call',
    params: [{ to, data }, 'latest'],
    fetchImpl,
    timeoutMs,
  });
  if (!result.ok) return result;
  const text = safeString(result.result);
  if (!/^0x[0-9a-fA-F]*$/.test(text)) {
    return { ok: false, error: 'RPC result was not hex' };
  }
  return { ...result, result: text };
}

export function resolveSurveysAddress(env = {}) { return resolveConfiguredSurveysAddress(env); }

export function resolveConfiguredSurveysAddress(env = {}) { return normalizeHexAddress(env.AGENT_CONTEXT?.config?.contracts?.surveys?.address); }

export async function fetchArweaveJson(pointerId = '', {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  const id = safeString(pointerId);
  if (!/^[a-zA-Z0-9_-]{43}$/.test(id)) return null;
  for (const gateway of ARWEAVE_GATEWAYS) {
    for (const pathPrefix of ['', 'raw/']) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error('Arweave fetch timed out')), timeoutMs);
      try {
        const response = await fetchImpl(`${gateway}/${pathPrefix}${id}`, {
          method: 'GET',
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response?.ok) continue;
        const payload = await response.json().catch(() => null);
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          return payload;
        }
      } catch {
        // Try the next path/gateway. The bot must not depend on one gateway being up.
      } finally {
        clearTimeout(timeout);
      }
    }
  }
  return null;
}

export async function buildCloudflareQuestionStorageAuth({ env } = {}) {
  await env.AGENT_SERVICES.current();
  return { ok: true };
}

export async function fetchCloudflareStorageJson(pointerId = '', { env = {} } = {}) {
  if (!pointerId) return null;
  const response = await env.AGENT_SERVICES.storage(`/storage/read?id=${encodeURIComponent(pointerId)}`);
  return response.ok ? response.json() : null;
}

export async function fetchSessionConfigForQuestions({ env, sessionSlug, rpcUrls = [], fetchImpl = globalThis.fetch } = {}) {
  await env.AGENT_SERVICES.current();
  const ctx = env.AGENT_CONTEXT;
  if (sessionSlug !== ctx.slug) throw new Error('agent_session_mismatch');
  const config = ctx.config;
  const start = normalizeBlock(config.blockLimits?.start) ?? await fetchSessionCreatedBlock({
    rpcUrls, registryAddress: resolveSessionRegistryAddress(env), sessionSlug,
    fetchImpl, timeoutMs: rpcTimeoutMs(env),
  }).catch(() => null);
  return { slug: ctx.slug, sessionSlug: ctx.slug, chainId: config.networkChainId,
    metadata: config, metadataURI: '', sessionWorkerUrl: ctx.origin,
    surveysAddress: config.contracts?.surveys?.address || '',
    blockLimits: { start, end: normalizeBlock(config.blockLimits?.end) } };
}

export async function fetchSessionCreatedBlock({
  rpcUrls = [],
  registryAddress = '',
  sessionSlug = '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
} = {}) {
  const slug = lower(sessionSlug);
  if (!slug || !registryAddress || !rpcUrls.length) return null;
  const result = await rpcWithFallback({
    rpcUrls,
    method: 'eth_getLogs',
    params: [{
      address: registryAddress,
      fromBlock: '0x0',
      toBlock: 'latest',
      topics: [SESSION_CREATED_TOPIC0],
    }],
    fetchImpl,
    timeoutMs,
  });
  if (!result.ok) return null;
  const logs = Array.isArray(result.result) ? result.result : [];
  for (const log of logs.slice().reverse()) {
    const eventSlug = lower(decodeAbiString(log?.data || '', 0));
    if (eventSlug !== slug) continue;
    const block = Number(BigInt(safeString(log?.blockNumber || '0x0')));
    return Number.isFinite(block) && block >= 0 ? block : null;
  }
  return null;
}

export async function currentBlockNumber({ rpcUrls = [], fetchImpl = globalThis.fetch } = {}) {
  const result = await rpcWithFallback({
    rpcUrls,
    method: 'eth_blockNumber',
    params: [],
    fetchImpl,
  });
  if (!result.ok) throw new Error(result.error);
  return Number(BigInt(safeString(result.result || '0x0')));
}

export function resolveScanWindow({
  currentBlock = 0,
  session = {},
  env = {},
} = {}) {
  const fallbackBlocks = DEFAULT_SCAN_BLOCKS;
  const explicitStart = normalizeBlock(session.blockLimits?.start);
  const explicitEnd = normalizeBlock(session.blockLimits?.end);
  const latest = Math.max(0, Math.floor(Number(currentBlock) || 0));
  const toBlock = explicitEnd == null ? latest : Math.min(latest, explicitEnd);
  const fromBlock = explicitStart == null ? Math.max(0, toBlock - fallbackBlocks) : explicitStart;
  return {
    fromBlock,
    toBlock,
    source: explicitStart == null ? 'fallback_recent_blocks' : 'session_block_limits',
    sessionScoped: explicitStart != null,
    recentBlockCap: explicitStart == null ? fallbackBlocks : null,
  };
}

export async function scanQuestionIds({
  rpcUrls = [],
  surveysAddress = '',
  fromBlock = 0,
  toBlock = 0,
  env = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const summary = {
    ids: [],
    chunksAttempted: 0,
    chunksSucceeded: 0,
    chunksFailed: 0,
    errors: [],
    order: 'newest_first',
  };
  if (!surveysAddress) return summary;
  if (toBlock < fromBlock) return summary;
  const chunkSize = DEFAULT_LOG_CHUNK_SIZE;
  const seen = new Set();
  for (let to = toBlock; to >= fromBlock;) {
    const from = Math.max(fromBlock, to - chunkSize + 1);
    summary.chunksAttempted += 1;
    const result = await rpcWithFallback({
      rpcUrls,
      method: 'eth_getLogs',
      params: [{
        address: surveysAddress,
        fromBlock: `0x${from.toString(16)}`,
        toBlock: `0x${to.toString(16)}`,
        topics: [QUESTIONS_ADDED_TOPIC0],
      }],
      fetchImpl,
      timeoutMs: rpcTimeoutMs(env),
    });
    if (!result.ok) {
      summary.chunksFailed += 1;
      if (summary.errors.length < 3) summary.errors.push(result.error || 'eth_getLogs failed');
      continue;
    }
    summary.chunksSucceeded += 1;
    const logs = Array.isArray(result.result) ? result.result : [];
    for (const log of logs.slice().reverse()) {
      for (const questionId of decodeBytes32ArrayFromData(log?.data || '', 0).reverse()) {
        if (seen.has(questionId)) continue;
        seen.add(questionId);
        summary.ids.push(questionId);
      }
    }
    to = from - 1;
  }
  return summary;
}
