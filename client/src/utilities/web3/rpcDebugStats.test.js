import { rpcDebugRecord, rpcDebugReset, rpcDebugScanSummary } from './rpcDebugStats.js';

describe('rpcDebugStats filtering', () => {
  beforeEach(() => {
    globalThis.ENABLE_RPC_DEBUG_STATS = true;
    rpcDebugReset({ recentMax: 100, keysMax: 100 });
  });

  afterEach(() => {
    try { delete globalThis.ENABLE_RPC_DEBUG_STATS; } catch (_) {
      globalThis.ENABLE_RPC_DEBUG_STATS = undefined;
    }
  });

  it('filters scan summaries by scopeTag and method', () => {
    rpcDebugRecord({
      chainId: 84532,
      method: 'eth_getLogs',
      params: [{ fromBlock: '0x1', toBlock: '0x1', topics: [] }],
      outcome: 'network',
      fnTag: 'initialize-question-cache',
      scopeTag: 'question-discovery',
    });
    rpcDebugRecord({
      chainId: 84532,
      method: 'eth_getLogs',
      params: [{ fromBlock: '0x2', toBlock: '0x2', topics: [] }],
      outcome: 'network',
      fnTag: 'other-flow',
      scopeTag: 'other-scope',
    });
    rpcDebugRecord({
      chainId: 84532,
      method: 'eth_call',
      params: [{ to: '0x0000000000000000000000000000000000000001', data: '0x' }, 'latest'],
      outcome: 'network',
      fnTag: 'initialize-question-cache',
      scopeTag: 'question-discovery',
    });

    const filtered = rpcDebugScanSummary({
      filter: { method: 'eth_getLogs', scopeTag: 'question-discovery' },
    });

    expect(filtered.totals.network).toBe(1);
    expect(filtered.methods.eth_getLogs.network).toBe(1);
    expect(filtered.methods.eth_call.network).toBe(0);
    expect(filtered.filter).toEqual({
      methods: ['eth_getlogs'],
      scopeTags: ['question-discovery'],
    });
  });

  it('uses full counters for chain filters even when recent is truncated', () => {
    rpcDebugReset({ recentMax: 2, keysMax: 100 });

    rpcDebugRecord({
      chainId: 84532,
      method: 'eth_getLogs',
      params: [{ fromBlock: '0x1', toBlock: '0x1', topics: [] }],
      outcome: 'network',
      fnTag: 'initialize-question-cache',
      scopeTag: 'question-discovery',
    });
    rpcDebugRecord({
      chainId: 84532,
      method: 'eth_getLogs',
      params: [{ fromBlock: '0x2', toBlock: '0x2', topics: [] }],
      outcome: 'network',
      fnTag: 'initialize-question-cache',
      scopeTag: 'question-discovery',
    });
    rpcDebugRecord({
      chainId: 11155111,
      method: 'eth_getLogs',
      params: [{ fromBlock: '0x3', toBlock: '0x3', topics: [] }],
      outcome: 'network',
      fnTag: 'initialize-question-cache',
      scopeTag: 'question-discovery',
    });
    rpcDebugRecord({
      chainId: 84532,
      method: 'eth_getLogs',
      params: [{ fromBlock: '0x4', toBlock: '0x4', topics: [] }],
      outcome: 'network',
      fnTag: 'initialize-question-cache',
      scopeTag: 'question-discovery',
    });
    rpcDebugRecord({
      chainId: 11155111,
      method: 'eth_getLogs',
      params: [{ fromBlock: '0x5', toBlock: '0x5', topics: [] }],
      outcome: 'network',
      fnTag: 'initialize-question-cache',
      scopeTag: 'question-discovery',
    });

    const filtered = rpcDebugScanSummary({
      filter: { chainId: '84532', method: 'eth_getLogs' },
    });

    expect(filtered.totals.network).toBe(3);
    expect(filtered.methods.eth_getLogs.network).toBe(3);
    expect(filtered.filter).toEqual({
      methods: ['eth_getlogs'],
      chainIds: ['84532'],
    });
  });
});
