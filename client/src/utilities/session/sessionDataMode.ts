import { isTelegramOnlySessionConfig, type TelegramSessionMeta } from './telegramSessionMeta';

export type SessionDataMode = 'onchain' | 'telegram';

export type ResolveSessionDataModeArgs = {
  sessionConfig?: unknown;
  probeResult?: TelegramSessionMeta | null;
  telegramAuth?: unknown;
};

export const resolveSessionDataMode = ({
  sessionConfig = null,
  probeResult = null,
}: ResolveSessionDataModeArgs = {}): SessionDataMode => {
  const telegramOnly = isTelegramOnlySessionConfig(sessionConfig) || probeResult?.telegramOnly === true;
  if (telegramOnly) return 'telegram';
  return 'onchain';
};

export const isTelegramSessionDataMode = (mode: SessionDataMode): boolean => mode === 'telegram';
