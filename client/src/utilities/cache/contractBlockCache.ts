import type { ethers } from 'ethers';

export type ContractBlockProvider = {
  getBlock: (blockNumber: number | string) => Promise<ethers.providers.Block>;
};

type ContractBlockCacheEntry = {
  block: ethers.providers.Block;
  timestamp: number;
};

type ResolveContractBlockInput = {
  provider: ContractBlockProvider;
  blockNumber: number | string;
  chainKey?: string;
  ttlMs: number;
  maxEntries: number;
  callWithRetry: <T>(operation: () => Promise<T>, operationName: string) => Promise<T>;
};

const CONTRACT_BLOCK_CACHE: Record<string, ContractBlockCacheEntry> = {};

const cacheKeyForBlock = (chainKey: string | undefined, blockNumber: number | string): string =>
  `${String(chainKey || 'default')}_${String(blockNumber)}`;

const pruneExpiredEntries = (now: number, ttlMs: number): void => {
  Object.keys(CONTRACT_BLOCK_CACHE).forEach((key) => {
    if (now - (CONTRACT_BLOCK_CACHE[key]?.timestamp || 0) >= ttlMs) {
      delete CONTRACT_BLOCK_CACHE[key];
    }
  });
};

const pruneBySize = (maxEntries: number): void => {
  const limit = Math.max(0, Math.floor(Number(maxEntries) || 0));
  if (limit <= 0) {
    Object.keys(CONTRACT_BLOCK_CACHE).forEach((key) => {
      delete CONTRACT_BLOCK_CACHE[key];
    });
    return;
  }

  const keys = Object.keys(CONTRACT_BLOCK_CACHE);
  if (keys.length <= limit) return;

  keys.sort((a, b) => (CONTRACT_BLOCK_CACHE[a]?.timestamp || 0) - (CONTRACT_BLOCK_CACHE[b]?.timestamp || 0));
  for (let i = 0; i < keys.length - limit; i += 1) {
    delete CONTRACT_BLOCK_CACHE[keys[i]];
  }
};

export const resolveContractBlockWithCache = async ({
  provider,
  blockNumber,
  chainKey = 'default',
  ttlMs,
  maxEntries,
  callWithRetry,
}: ResolveContractBlockInput): Promise<ethers.providers.Block> => {
  const key = cacheKeyForBlock(chainKey, blockNumber);
  const cached = CONTRACT_BLOCK_CACHE[key];
  const readTime = Date.now();
  if (cached && readTime - cached.timestamp < ttlMs) {
    return cached.block;
  }

  const block = await callWithRetry(() => provider.getBlock(blockNumber), `getBlock(${blockNumber})`);
  const now = Date.now();
  pruneExpiredEntries(now, ttlMs);
  CONTRACT_BLOCK_CACHE[key] = { block, timestamp: now };
  pruneBySize(maxEntries);
  return block;
};

export const __test__contractBlockCache = {
  clear: (): void => {
    Object.keys(CONTRACT_BLOCK_CACHE).forEach((key) => {
      delete CONTRACT_BLOCK_CACHE[key];
    });
  },
  keys: (): string[] => Object.keys(CONTRACT_BLOCK_CACHE),
};
