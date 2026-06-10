import { isTelegramOnlySessionConfig, type TelegramSessionMeta } from './telegramSessionMeta';

type UnknownRecord = Record<string, unknown>;

export type SessionDataMode = 'onchain' | 'telegram';

export type ResolveSessionDataModeArgs = {
  sessionConfig?: unknown;
  probeResult?: TelegramSessionMeta | null;
  telegramAuth?: unknown;
};

const toRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
);

const telegramAuthReady = (value: unknown): boolean => {
  const auth = toRecord(value);
  return auth.loggedIn === true || auth.ok === true || Boolean(auth.tokenPresent);
};

export const resolveSessionDataMode = ({
  sessionConfig = null,
  probeResult = null,
  telegramAuth = null,
}: ResolveSessionDataModeArgs = {}): SessionDataMode => {
  const telegramOnly = isTelegramOnlySessionConfig(sessionConfig) || probeResult?.telegramOnly === true;
  if (telegramOnly && telegramAuthReady(telegramAuth)) return 'telegram';
  return 'onchain';
};

export const isTelegramSessionDataMode = (mode: SessionDataMode): boolean => mode === 'telegram';
