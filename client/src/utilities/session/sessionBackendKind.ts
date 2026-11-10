import { isSessionModeProfileAgentHttpEnabled } from './sessionModeProfile';
import { normalizeSessionSlugAlias as normalizeSessionSlug } from './sessionSlug';

export type SessionBackendKind = 'onchain' | 'agent';

export type AgentSessionMeta = {
  ok?: boolean;
  sessionSlug?: string;
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
  isSessionModeProfileAgentHttpEnabled(metadata);

export const resolveSessionBackendKind = ({
  sessionConfig = null,
  probeResult = null,
  sessionSlug = '',
}: ResolveSessionBackendKindArgs = {}): SessionBackendKind => {
  // An explicit profile is authoritative; the probe only speaks for sessions without one.
  if (hasExplicitProfile(sessionConfig)) return isHostedAgentSessionConfig(sessionConfig) ? 'agent' : 'onchain';
  const probeEnabled = probeResult?.authorityMode === 'worker_canonical' && probeResult?.agentHttpEnabled === true;
  return probeEnabled &&
    (!normalizeSessionSlug(sessionSlug) ||
      normalizeSessionSlug(probeResult?.sessionSlug) === normalizeSessionSlug(sessionSlug))
    ? 'agent'
    : 'onchain';
};
