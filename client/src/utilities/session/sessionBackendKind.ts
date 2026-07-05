type UnknownRecord = Record<string, unknown>;

export type SessionBackendKind = 'onchain' | 'telegram';

export type TelegramSessionMeta = {
  ok?: boolean;
  sessionSlug?: string;
  telegramOnly?: boolean;
  telegramBridgeEnabled?: boolean;
  clientSubmitReady?: boolean;
};

export type ResolveSessionBackendKindArgs = {
  sessionConfig?: unknown;
  probeResult?: TelegramSessionMeta | null;
};

const toUnknownRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
);

const normalizeModeValue = (value: unknown): string => (
  String(value || '').trim().toLowerCase()
);

export const isTelegramFirstSessionConfig = (metadata: unknown): boolean => {
  const config = toUnknownRecord(metadata);
  const telegramConfig = toUnknownRecord(config.telegram);
  return (
    config.telegramOnly === true ||
    config.telegram_only === true ||
    normalizeModeValue(config.sessionMode) === 'telegram_only' ||
    normalizeModeValue(config.telegramMode) === 'telegram_only' ||
    telegramConfig.only === true ||
    normalizeModeValue(telegramConfig.mode) === 'telegram_only'
  );
};

export const resolveSessionBackendKind = ({
  sessionConfig = null,
  probeResult = null,
}: ResolveSessionBackendKindArgs = {}): SessionBackendKind => (
  isTelegramFirstSessionConfig(sessionConfig) || probeResult?.telegramOnly === true
    ? 'telegram'
    : 'onchain'
);

export const isTelegramSessionBackendKind = (kind: SessionBackendKind): boolean => (
  kind === 'telegram'
);
