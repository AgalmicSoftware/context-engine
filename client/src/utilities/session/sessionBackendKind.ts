import { hasLegacyTelegramFirstSessionFlags, isSessionModeProfileTelegramFirst } from './sessionModeProfile';
import { normalizeSessionSlugAlias as normalizeSessionSlug } from './sessionSlug';

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
  sessionSlug?: unknown;
};

export const isTelegramFirstSessionConfig = (metadata: unknown): boolean => {
  return isSessionModeProfileTelegramFirst(metadata) || hasLegacyTelegramFirstSessionFlags(metadata);
};

export const resolveSessionBackendKind = ({
  sessionConfig = null,
  probeResult = null,
  sessionSlug = '',
}: ResolveSessionBackendKindArgs = {}): SessionBackendKind =>
  isTelegramFirstSessionConfig(sessionConfig) ||
  (probeResult?.telegramOnly === true &&
    (!normalizeSessionSlug(sessionSlug) ||
      normalizeSessionSlug(probeResult.sessionSlug) === normalizeSessionSlug(sessionSlug)))
    ? 'telegram'
    : 'onchain';
