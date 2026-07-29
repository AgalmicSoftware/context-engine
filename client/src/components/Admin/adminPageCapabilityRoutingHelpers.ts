import { normalizeAgentSessionWrappedCapability } from '../../utilities/session/agentSessionWrapped.js';
import {
  resolveSessionCapabilityProjection,
  type SessionCapabilityProjection,
} from '../../utilities/session/sessionCapabilityProjection';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';

type SessionConfigLike = Record<string, unknown> | null;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export type AdminCapabilityRoute = {
  sessionCapabilities: SessionCapabilityProjection;
  selectedWorkerSessionId: string;
  showAdminWorkerGroups: boolean;
  workerGroupsPanelTitle: string;
  workerGroupsPanelDescription: string;
};

export const resolveAdminCapabilityRoute = (sessionConfig: SessionConfigLike): AdminCapabilityRoute => {
  const sessionCapabilities = resolveSessionCapabilityProjection(sessionConfig);
  const profile = asRecord(asRecord(sessionConfig).sessionModeProfile);
  const profileSurfaces = asRecord(profile.surfaces);
  const agentSessionWrappedCapability = normalizeAgentSessionWrappedCapability(
    asRecord(sessionConfig).agentSessionWrapped,
  );
  const hasValidatedAgentWorkerGroupDomain =
    (sessionCapabilities.profileValid || sessionCapabilities.source === 'legacy_registry') &&
    (profileSurfaces.agentHttp === true || agentSessionWrappedCapability?.enabled === true);
  const showAdminWorkerGroups = sessionCapabilities.usesWorkerGroups || hasValidatedAgentWorkerGroupDomain;

  return {
    sessionCapabilities,
    selectedWorkerSessionId: resolveWorkerCanonicalSessionIdHex(sessionConfig),
    showAdminWorkerGroups,
    workerGroupsPanelTitle: sessionCapabilities.usesWorkerGroups
      ? 'Native Worker Groups'
      : 'Worker/agent access groups',
    workerGroupsPanelDescription: sessionCapabilities.usesWorkerGroups
      ? 'Manage this session’s Worker-owned participant groups.'
      : 'Manage the Worker authorization groups used by agent access. These are separate from registry SBT Groups.',
  };
};

export const resolveAdminSessionRecoveryMessage = ({
  sessionCapabilities,
  hasRegistryEntry,
}: {
  sessionCapabilities: SessionCapabilityProjection;
  hasRegistryEntry: boolean;
}): string => {
  if (sessionCapabilities.source === 'invalid_profile') {
    return 'This session capability profile is invalid or unsupported. Repair the canonical sessionModeProfile before using Admin actions.';
  }
  if (sessionCapabilities.source === 'missing') {
    return 'This session is missing a canonical capability profile. Republish or repair its canonical session config before using Admin actions.';
  }
  return sessionCapabilities.isRegistryCanonical && !hasRegistryEntry
    ? 'Session is not registered on-chain yet. Register in /new before using registry actions.'
    : '';
};
