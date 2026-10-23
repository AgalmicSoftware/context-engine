import { hasLegacyHostedAgentFlags, isSessionModeProfileAgentHttpEnabled } from './sessionModeProfile';
import { normalizeSessionSlugAlias as normalizeSessionSlug } from './sessionSlug';

export type SessionBackendKind = 'onchain' | 'agent';

export type AgentSessionMeta = {
  ok?: boolean;
  sessionSlug?: string;
  // Compatibility fields returned by older deployed Bridges.
  telegramOnly?: boolean;
  telegramBridgeEnabled?: boolean;
  authorityMode?: string;
  agentHttpEnabled?: boolean;
  clientSubmitReady?: boolean;
};

export type ResolveSessionBackendKindArgs = {
  sessionConfig?: unknown;
  probeResult?: AgentSessionMeta | null;
  sessionSlug?: unknown;
};

const hasExplicitProfile = (metadata: unknown): boolean =>
  !!metadata &&
  typeof metadata === 'object' &&
  (Object.prototype.hasOwnProperty.call(metadata, 'sessionModeProfile') ||
    Object.prototype.hasOwnProperty.call(metadata, 'authority'));

export const isHostedAgentSessionConfig = (metadata: unknown): boolean =>
  hasExplicitProfile(metadata) ? isSessionModeProfileAgentHttpEnabled(metadata) : hasLegacyHostedAgentFlags(metadata);

export const resolveSessionBackendKind = ({
  sessionConfig = null,
  probeResult = null,
  sessionSlug = '',
}: ResolveSessionBackendKindArgs = {}): SessionBackendKind => {
  // Explicit HTTP-off settings must not be overridden by stale legacy metadata.
  if (hasExplicitProfile(sessionConfig)) return isHostedAgentSessionConfig(sessionConfig) ? 'agent' : 'onchain';
  const probeEnabled =
    typeof probeResult?.agentHttpEnabled === 'boolean'
      ? probeResult.authorityMode === 'worker_canonical' && probeResult.agentHttpEnabled
      : probeResult?.telegramOnly === true;
  return isHostedAgentSessionConfig(sessionConfig) ||
    (probeEnabled &&
      (!normalizeSessionSlug(sessionSlug) ||
        normalizeSessionSlug(probeResult?.sessionSlug) === normalizeSessionSlug(sessionSlug)))
    ? 'agent'
    : 'onchain';
};
