import {
  normalizeAgentSessionWrappedCapability,
  type AgentSessionWrappedCapability,
} from '../../utilities/session/agentSessionWrapped.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { normalizeBoundedSessionStorageSlug as normalizeSessionSlug } from '../../utilities/session/sessionSlug';
import { toStr } from '../../utilities/shared/primitives.js';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability.js';

type AdminRecord = Record<string, unknown>;
type PostSignedRequest = (args: {
  action: string;
  body: AdminRecord;
  path: string;
  workerUrl: string;
}) => Promise<unknown>;

export type AdminAgentSessionWrappedAvailabilityCode =
  | 'ready'
  | 'profile_required'
  | 'read_only'
  | 'worker_required'
  | 'locked_workerless'
  | 'encrypted_worker_pointer'
  | 'incompatible';

export type AdminAgentSessionWrappedAvailability = {
  code: AdminAgentSessionWrappedAvailabilityCode;
  compatible: boolean;
  manageable: boolean;
  message: string;
  capability: AgentSessionWrappedCapability | null;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const asRecord = (value: unknown): AdminRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as AdminRecord) : {};

const normalizeHttpsOrigin = (value: unknown): string => {
  try {
    const parsed = new URL(toStr(value).trim());
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return '';
    return parsed.origin;
  } catch {
    return '';
  }
};

const hasCompatibleAuthority = (sessionConfig: unknown): boolean => {
  const capabilities = resolveSessionCapabilityProjection(sessionConfig);
  return capabilities.usesWorkerAuthority || capabilities.isRegistryCanonical;
};

const registryFrom = (sessionConfig: unknown): AdminRecord => asRecord(asRecord(sessionConfig).__registry);

const isPermanentlyLockedRegistrySession = (sessionConfig: unknown): boolean => {
  const registry = registryFrom(sessionConfig);
  const hasRegistryIdentity = Number(registry.registryChainId || registry.chainId || 0) > 0;
  return hasRegistryIdentity && toStr(registry.adminAddress).trim().toLowerCase() === ZERO_ADDRESS;
};

export const resolveAdminAgentSessionWrappedWorkerOrigin = ({
  editedWorkerUrl = '',
  sessionConfig = null,
  sessionSlug = '',
  workerUrlEditable = false,
}: {
  editedWorkerUrl?: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  workerUrlEditable?: boolean;
} = {}): string => {
  if (workerUrlEditable) return normalizeHttpsOrigin(editedWorkerUrl);
  return normalizeHttpsOrigin(
    getUsableSessionWorkerUrl({
      slug: sessionSlug,
      sessionConfig,
      allowSharedFallback: false,
    }),
  );
};

export const resolveAdminAgentSessionWrappedAvailability = ({
  canAdminWorker = false,
  sessionConfig = null,
  sessionWorkerUrl = '',
}: {
  canAdminWorker?: boolean;
  sessionConfig?: unknown;
  sessionWorkerUrl?: unknown;
} = {}): AdminAgentSessionWrappedAvailability => {
  const config = asRecord(sessionConfig);
  const capability = normalizeAgentSessionWrappedCapability(config.agentSessionWrapped);
  const sessionCapabilities = resolveSessionCapabilityProjection(config);
  if (!sessionCapabilities.usesWorkerAuthority && !sessionCapabilities.isRegistryCanonical) {
    return {
      code: 'incompatible',
      compatible: false,
      manageable: false,
      message: 'Agent Session Wrapped requires a worker-canonical or registry-canonical session.',
      capability,
    };
  }
  if (sessionCapabilities.isRegistryCanonical && config.corsWorkerUrl && typeof config.corsWorkerUrl === 'object') {
    return {
      code: 'encrypted_worker_pointer',
      compatible: true,
      manageable: false,
      message: 'This encrypted Worker pointer must be updated through its existing encrypted registry flow first.',
      capability,
    };
  }
  const workerOrigin = normalizeHttpsOrigin(sessionWorkerUrl);
  if (!workerOrigin) {
    const locked = isPermanentlyLockedRegistrySession(config);
    return {
      code: locked ? 'locked_workerless' : 'worker_required',
      compatible: true,
      manageable: false,
      message: locked
        ? 'This permanently locked session has no usable Session Worker, so Wrapped cannot be attached.'
        : 'Attach a compatible Session Worker before enabling Agent Session Wrapped.',
      capability,
    };
  }
  if (sessionCapabilities.source === 'legacy_registry') {
    return {
      code: 'profile_required',
      compatible: true,
      manageable: false,
      message: 'Configure a complete session mode profile before enabling Agent Session Wrapped.',
      capability,
    };
  }
  if (!canAdminWorker) {
    return {
      code: 'read_only',
      compatible: true,
      manageable: false,
      message: capability
        ? 'Wrapped status is read-only for this wallet.'
        : 'Connect the configured session admin wallet to manage Wrapped.',
      capability,
    };
  }
  return {
    code: 'ready',
    compatible: true,
    manageable: true,
    message: capability?.enabled ? 'Wrapped access is enabled.' : 'Wrapped access is disabled.',
    capability,
  };
};

export const buildAdminAgentSessionWrappedConfigPatch = ({
  sessionConfig,
  capability,
}: {
  sessionConfig: unknown;
  capability: AgentSessionWrappedCapability;
}) => {
  const config = asRecord(sessionConfig);
  const profile = asRecord(config.sessionModeProfile);
  const sessionCapabilities = resolveSessionCapabilityProjection(config);
  if (sessionCapabilities.source === 'legacy_registry' && Object.keys(profile).length === 0) {
    throw new Error('Configure a complete session mode profile before enabling Agent Session Wrapped.');
  }
  const surfaces = asRecord(profile.surfaces);
  return {
    agentSessionWrapped: capability,
    sessionModeProfile: {
      ...profile,
      preset: 'custom',
      surfaces: {
        ...surfaces,
        // Preserve legacy reads, but never publish removed adapter access.
        telegram: false,
        miniApp: false,
        agentHttp: capability.enabled,
      },
    },
  };
};

export const ensureAdminAgentSessionWrappedWorkerAttached = async ({
  buildRegistrySessionFields = ({ onChainFields = {} }: { onChainFields?: AdminRecord } = {}) => onChainFields,
  providerLike,
  sessionConfig,
  sessionSlug,
  sessionWorkerUrl,
  setSessionFieldsOnChain,
}: {
  buildRegistrySessionFields?: (input: { onChainFields?: AdminRecord }) => AdminRecord;
  providerLike?: unknown;
  sessionConfig: unknown;
  sessionSlug: string;
  sessionWorkerUrl: string;
  setSessionFieldsOnChain: (input: AdminRecord) => Promise<unknown>;
}): Promise<{ attached: boolean }> => {
  const config = asRecord(sessionConfig);
  const sessionCapabilities = resolveSessionCapabilityProjection(config);
  if (sessionCapabilities.usesWorkerAuthority) return { attached: false };
  if (!sessionCapabilities.isRegistryCanonical) {
    throw new Error('Registry Worker attachment requires a validated registry-canonical session.');
  }
  const workerOrigin = normalizeHttpsOrigin(sessionWorkerUrl);
  const slug = normalizeSessionSlug(sessionSlug || config.slug);
  const registry = registryFrom(config);
  const chainId = Number(registry.registryChainId || registry.chainId || 0) || 0;
  if (!workerOrigin || !slug || !chainId) throw new Error('Registry Worker attachment identity is incomplete.');
  if (toStr(registry.adminAddress).trim().toLowerCase() === ZERO_ADDRESS) {
    throw new Error('A permanently locked registry session cannot attach a new Worker.');
  }
  const currentValue = config.corsWorkerUrl;
  if (currentValue && typeof currentValue === 'object') {
    throw new Error('The encrypted Worker pointer must be updated through its existing encrypted registry flow.');
  }
  const currentOrigin = normalizeHttpsOrigin(currentValue);
  if (currentOrigin === workerOrigin) return { attached: false };
  if (toStr(currentValue).trim() && !currentOrigin) {
    throw new Error('The existing registry Worker pointer is invalid and was not overwritten.');
  }
  const fields = buildRegistrySessionFields({ onChainFields: { corsWorkerUrl: workerOrigin } });
  await setSessionFieldsOnChain({ providerLike, chainId, slug, fields });
  return { attached: true };
};

const readAgentCapabilities = async (workerOrigin: string, slug: string, fetchImpl: typeof fetch) => {
  const response = await fetchImpl(`${workerOrigin}/capabilities?slug=${encodeURIComponent(slug)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const data = asRecord(await response.json().catch(() => ({})));
  const capability = normalizeAgentSessionWrappedCapability(data.agentSessionWrapped);
  if (
    !response.ok ||
    !Array.isArray(data.features) ||
    !data.features.includes('agent_http_v1') ||
    !capability ||
    capability.origin !== workerOrigin ||
    capability.protocolVersion !== 'agent-session-wrapped-v1'
  ) {
    throw new Error('The Session Worker did not verify its agent capabilities.');
  }
  return {
    capability,
    configured: asRecord(data.agentHttp).configured === true,
    enabled: asRecord(data.agentHttp).enabled === true,
    ready: asRecord(data.agentHttp).ready === true,
  };
};

export const applyAdminAgentSessionWrappedChange = async ({
  accessEnabled,
  sessionConfig,
  sessionSlug,
  sessionWorkerUrl,
  fetchImpl = fetch,
  ensureSessionWorkerAttached,
  postSignedRequest,
}: {
  accessEnabled: boolean;
  sessionConfig: unknown;
  sessionSlug: string;
  sessionWorkerUrl: string;
  fetchImpl?: typeof fetch;
  ensureSessionWorkerAttached?: (input: { sessionWorkerUrl: string }) => Promise<unknown>;
  postSignedRequest: PostSignedRequest;
}) => {
  const workerOrigin = normalizeHttpsOrigin(sessionWorkerUrl);
  const slug = normalizeSessionSlug(sessionSlug || asRecord(sessionConfig).slug);
  if (!workerOrigin || !slug || !hasCompatibleAuthority(sessionConfig))
    throw new Error('A compatible Session Worker is required.');
  const before = await readAgentCapabilities(workerOrigin, slug, fetchImpl);
  if (accessEnabled && !before.configured)
    throw new Error('Agent resources are not configured on this Session Worker.');
  const proposed = { ...before.capability, enabled: accessEnabled };
  const configPatch = buildAdminAgentSessionWrappedConfigPatch({ sessionConfig, capability: proposed });
  const config = asRecord(sessionConfig);
  const registry = registryFrom(config);
  if (ensureSessionWorkerAttached) await ensureSessionWorkerAttached({ sessionWorkerUrl: workerOrigin });
  await postSignedRequest({
    action: 'set-config',
    path: '/admin/set-config',
    workerUrl: workerOrigin,
    body: {
      sessionSlug: slug,
      adminAddress: toStr(registry.adminAddress || config.adminAddress).trim(),
      config: configPatch,
    },
  });
  const after = await readAgentCapabilities(workerOrigin, slug, fetchImpl);
  if (after.enabled !== accessEnabled || (accessEnabled && !after.ready))
    throw new Error('The saved agent access state could not be verified.');
  return { capability: after.capability, configPatch: { ...configPatch, agentSessionWrapped: after.capability } };
};

export const verifyAdminAgentSessionWrappedHealth = async ({
  capability: capabilityInput,
  sessionSlug,
  sessionWorkerUrl,
  fetchImpl = fetch,
}: {
  capability: unknown;
  sessionSlug: string;
  sessionWorkerUrl: string;
  fetchImpl?: typeof fetch;
}) => {
  const capability = normalizeAgentSessionWrappedCapability(capabilityInput);
  const slug = normalizeSessionSlug(sessionSlug);
  const workerOrigin = normalizeHttpsOrigin(sessionWorkerUrl);
  if (!slug || !workerOrigin || (capability && capability.origin !== workerOrigin))
    throw new Error('Wrapped capability origin does not match the Session Worker.');
  const current = await readAgentCapabilities(workerOrigin, slug, fetchImpl);
  if ((current.enabled && !current.ready) || (capability && current.enabled !== capability.enabled))
    throw new Error('The Session Worker agent access state did not verify.');
  return {
    ok: true as const,
    accessEnabled: current.enabled,
    protocolVersion: current.capability.protocolVersion,
    capability: current.capability,
  };
};
