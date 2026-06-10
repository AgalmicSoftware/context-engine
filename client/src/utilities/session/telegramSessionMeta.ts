type UnknownRecord = Record<string, unknown>;

export type TelegramSessionMeta = {
  telegramOnly: boolean;
  telegramBridgeEnabled: boolean;
};

type FetchTelegramSessionMetaArgs = {
  sessionSlug?: unknown;
  agentBridgeUrl?: unknown;
  fetchImpl?: typeof fetch;
};

type CachedTelegramSessionMeta = {
  expiresAtMs: number;
  value: TelegramSessionMeta;
};

const TELEGRAM_SESSION_META_TTL_MS = 60 * 1000;
const telegramSessionMetaCache = new Map<string, CachedTelegramSessionMeta>();
const telegramSessionMetaInflight = new Map<string, Promise<TelegramSessionMeta | null>>();

const toUnknownRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
);

const normalizeTelegramMode = (value: unknown): string => (
  String(value || '').trim().toLowerCase()
);

export const isTelegramOnlySessionConfig = (metadata: unknown): boolean => {
  const config = toUnknownRecord(metadata);
  const telegramConfig = toUnknownRecord(config.telegram);
  return (
    config.telegramOnly === true ||
    config.telegram_only === true ||
    normalizeTelegramMode(config.sessionMode) === 'telegram_only' ||
    normalizeTelegramMode(config.telegramMode) === 'telegram_only' ||
    telegramConfig.only === true ||
    normalizeTelegramMode(telegramConfig.mode) === 'telegram_only'
  );
};

const buildTelegramSessionMetaUrl = ({
  sessionSlug,
  agentBridgeUrl,
}: Required<Pick<FetchTelegramSessionMetaArgs, 'sessionSlug' | 'agentBridgeUrl'>>): string => {
  const base = String(agentBridgeUrl || '').trim().replace(/\/+$/g, '');
  const slug = String(sessionSlug || '').trim();
  const url = new URL(`${base}/telegram/agent/api/session-meta`);
  url.searchParams.set('sessionSlug', slug);
  return url.toString();
};

// Future auto-poll/SSE live-results belongs with result hydration, not this detection-only helper.
export const fetchTelegramSessionMeta = async ({
  sessionSlug,
  agentBridgeUrl,
  fetchImpl = fetch,
}: FetchTelegramSessionMetaArgs): Promise<TelegramSessionMeta | null> => {
  const slug = String(sessionSlug || '').trim();
  const bridgeUrl = String(agentBridgeUrl || '').trim();
  if (!slug || !bridgeUrl || typeof fetchImpl !== 'function') return null;

  const cacheKey = `${bridgeUrl.replace(/\/+$/g, '')}|${slug}`;
  const cached = telegramSessionMetaCache.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now()) {
    return cached.value;
  }
  if (cached) {
    telegramSessionMetaCache.delete(cacheKey);
  }

  const existing = telegramSessionMetaInflight.get(cacheKey);
  if (existing) return existing;

  const request = (async () => {
    try {
      const url = buildTelegramSessionMetaUrl({ sessionSlug: slug, agentBridgeUrl: bridgeUrl });
      const response = await fetchImpl(url);
      if (!response || !response.ok) return null;
      const body = await response.json();
      if (!body || typeof body !== 'object' || (body as UnknownRecord).ok !== true) return null;
      const value = {
        telegramOnly: (body as UnknownRecord).telegramOnly === true,
        telegramBridgeEnabled: (body as UnknownRecord).telegramBridgeEnabled === true,
      };
      telegramSessionMetaCache.set(cacheKey, {
        expiresAtMs: Date.now() + TELEGRAM_SESSION_META_TTL_MS,
        value,
      });
      return value;
    } catch (_) {
      return null;
    } finally {
      telegramSessionMetaInflight.delete(cacheKey);
    }
  })();

  telegramSessionMetaInflight.set(cacheKey, request);
  return request;
};

export const __test__resetTelegramSessionMetaCache = (): void => {
  telegramSessionMetaCache.clear();
  telegramSessionMetaInflight.clear();
};
