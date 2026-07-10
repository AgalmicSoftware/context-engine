export const SBT_CACHE_STORAGE_KEY = 'sbtCache' as const;

export interface SessionSbtCacheWriteEnvelope {
  cacheName: typeof SBT_CACHE_STORAGE_KEY;
  sessionSlug: string;
  value: unknown;
}

export const buildSessionSbtCacheWriteEnvelope = ({
  sessionSlug,
  value,
}: {
  sessionSlug: string;
  value: unknown;
}): SessionSbtCacheWriteEnvelope => ({
  cacheName: SBT_CACHE_STORAGE_KEY,
  sessionSlug,
  value,
});
