/** One refresh policy for payload caches and in-flight request reuse. */
export interface ArweaveFetchPolicy {
  cacheBypass?: boolean;
}

export type ArweaveFetchOptions = ArweaveFetchPolicy & Record<string, unknown>;
