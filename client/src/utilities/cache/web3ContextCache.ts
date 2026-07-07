const WEB3_CONTEXT_CACHE = new Map<string, unknown>();
let web3ContextCacheClearQueued = false;

const scheduleWeb3ContextCacheClear = (): void => {
  if (web3ContextCacheClearQueued) return;
  web3ContextCacheClearQueued = true;

  const clearCache = (): void => {
    WEB3_CONTEXT_CACHE.clear();
    web3ContextCacheClearQueued = false;
  };

  try {
    Promise.resolve().then(clearCache);
  } catch {
    setTimeout(clearCache, 100);
  }
};

const normalizeWeb3ContextCacheValue = (value: unknown, seen: WeakSet<object> = new WeakSet()): unknown => {
  if (value === undefined) return '__undefined__';
  if (value === null) return null;
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return `__fn:${value.name || 'anonymous'}__`;
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '__circular__';

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => normalizeWeb3ContextCacheValue(item, seen));
  }

  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  Object.keys(source)
    .sort()
    .forEach((key) => {
      out[key] = normalizeWeb3ContextCacheValue(source[key], seen);
    });
  return out;
};

export const serializeWeb3ContextCacheKey = (groupKeyOrCfg: unknown): string => {
  try {
    return JSON.stringify(normalizeWeb3ContextCacheValue(groupKeyOrCfg));
  } catch {
    try {
      return String(groupKeyOrCfg);
    } catch {
      return '__unserializable__';
    }
  }
};

export const resolveWeb3ContextCacheEntry = <T>(groupKeyOrCfg: unknown, createEntry: () => T): T => {
  scheduleWeb3ContextCacheClear();
  const cacheKey = serializeWeb3ContextCacheKey(groupKeyOrCfg);
  const cached = WEB3_CONTEXT_CACHE.get(cacheKey) as T | undefined;
  if (cached) return cached;

  const entry = createEntry();
  WEB3_CONTEXT_CACHE.set(cacheKey, entry);
  return entry;
};

export const __test__web3ContextCache = {
  clear: (): void => {
    WEB3_CONTEXT_CACHE.clear();
    web3ContextCacheClearQueued = false;
  },
  serialize: serializeWeb3ContextCacheKey,
};
