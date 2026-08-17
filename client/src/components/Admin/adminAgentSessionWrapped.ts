import {
  normalizeAgentSessionWrappedCapability,
  type AgentSessionWrappedCapability,
} from '../../utilities/session/agentSessionWrapped.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { toStr } from '../../utilities/shared/primitives.js';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability.js';
import { AGENT_BRIDGE_WORKER_BUNDLE_URL, WORKER_RELEASE_MANIFEST_URL } from '../../variables/publicDeploymentConfig.js';

type AdminRecord = Record<string, unknown>;
type PostSignedRequest = (args: {
  action: string;
  body: AdminRecord;
  path: string;
  workerUrl: string;
}) => Promise<unknown>;

export type AdminAgentSessionWrappedAvailabilityCode =
  'ready' | 'read_only' | 'worker_required' | 'locked_workerless' | 'encrypted_worker_pointer' | 'incompatible';

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

const normalizeSessionSlug = (value: unknown): string => {
  const slug = toStr(value).trim().toLowerCase() || 'general';
  return /^[a-z0-9_-]{1,128}$/.test(slug) ? slug : '';
};

const authorityModeFrom = (sessionConfig: unknown): string =>
  resolveSessionCapabilityProjection(sessionConfig).authorityMode;

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
        ? 'This permanently locked session has no usable paired Worker, so Wrapped cannot be attached.'
        : 'Attach a compatible session Worker before enabling Agent Session Wrapped.',
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
    return {
      agentSessionWrapped: capability,
    };
  }
  const surfaces = asRecord(profile.surfaces);
  return {
    agentSessionWrapped: capability,
    sessionModeProfile: {
      ...profile,
      preset: 'custom',
      surfaces: {
        ...surfaces,
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

const deploymentIdentityFrom = ({
  sessionConfig,
  sessionSlug,
}: {
  sessionConfig: unknown;
  sessionSlug: string;
}): string => {
  const config = asRecord(sessionConfig);
  const registry = registryFrom(config);
  const chainIdentity = Number(registry.registryChainId || registry.chainId || config.networkChainId || 0) || 'worker';
  const sessionIdentity = toStr(registry.sessionIdHex || registry.sessionId || config.sessionId).trim() || 'pending';
  return ['session', chainIdentity, sessionIdentity, sessionSlug].join(':');
};

const redactToken = (message: unknown, token: string): string => {
  const text = toStr(message).trim();
  return token ? text.split(token).join('[redacted]') : text;
};

export const applyAdminAgentSessionWrappedChange = async ({
  accessEnabled,
  apiToken,
  deployHelperUrl,
  deploymentRequestId,
  sessionConfig,
  sessionSlug,
  sessionWorkerUrl,
  fetchImpl = fetch,
  ensureSessionWorkerAttached,
  postSignedRequest,
}: {
  accessEnabled: boolean;
  apiToken: string;
  deployHelperUrl: string;
  deploymentRequestId: string;
  sessionConfig: unknown;
  sessionSlug: string;
  sessionWorkerUrl: string;
  fetchImpl?: typeof fetch;
  ensureSessionWorkerAttached?: (input: { sessionWorkerUrl: string }) => Promise<unknown>;
  postSignedRequest: PostSignedRequest;
}) => {
  const token = toStr(apiToken).trim();
  const helperOrigin = normalizeHttpsOrigin(deployHelperUrl);
  const workerOrigin = normalizeHttpsOrigin(sessionWorkerUrl);
  const slug = normalizeSessionSlug(sessionSlug || asRecord(sessionConfig).slug);
  const requestId = toStr(deploymentRequestId).trim();
  const authorityMode = authorityModeFrom(sessionConfig);
  if (!token) throw new Error('Enter a request-only Cloudflare API token.');
  if (!helperOrigin) throw new Error('The deploy-helper URL is unavailable.');
  if (!workerOrigin) throw new Error('A compatible paired session Worker is required.');
  if (!slug || !requestId || !hasCompatibleAuthority(sessionConfig)) {
    throw new Error('Wrapped deployment identity or session authority is invalid.');
  }

  let response: Response;
  try {
    response = await fetchImpl(`${helperOrigin}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deploymentKind: 'agent_session_wrapped',
        deploymentRequestId: requestId,
        apiToken: token,
        sessionSlug: slug,
        sessionWorkerOrigin: workerOrigin,
        sessionDeploymentIdentity: deploymentIdentityFrom({ sessionConfig, sessionSlug: slug }),
        authorityMode,
        agentHttpEnabled: accessEnabled,
        bundleUrl: AGENT_BRIDGE_WORKER_BUNDLE_URL,
        bundleManifestUrl: WORKER_RELEASE_MANIFEST_URL,
      }),
    });
  } catch (error) {
    throw new Error(redactToken(error instanceof Error ? error.message : error, token) || 'Wrapped deploy failed.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok !== true) {
    throw new Error(redactToken(data?.error, token) || `Wrapped deploy failed (${response.status}).`);
  }
  const capability = normalizeAgentSessionWrappedCapability(data?.agentSessionWrapped);
  if (
    !capability ||
    capability.enabled !== accessEnabled ||
    normalizeHttpsOrigin(data?.workerUrl) !== capability.origin ||
    normalizeSessionSlug(data?.sessionSlug) !== slug ||
    normalizeHttpsOrigin(data?.sessionWorkerOrigin) !== workerOrigin
  ) {
    throw new Error('Wrapped deploy did not return a verified session-bound capability.');
  }
  const configPatch = buildAdminAgentSessionWrappedConfigPatch({ sessionConfig, capability });
  const config = asRecord(sessionConfig);
  const registry = registryFrom(config);
  const adminAddress = toStr(registry.adminAddress || config.adminAddress).trim();
  if (ensureSessionWorkerAttached) {
    await ensureSessionWorkerAttached({ sessionWorkerUrl: workerOrigin });
  }
  await postSignedRequest({
    action: 'set-config',
    path: '/admin/set-config',
    workerUrl: workerOrigin,
    body: {
      sessionSlug: slug,
      adminAddress,
      config: configPatch,
    },
  });
  return { capability, configPatch };
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
  if (!capability || !slug || !workerOrigin) throw new Error('Wrapped health configuration is incomplete.');
  let response: Response;
  try {
    response = await fetchImpl(`${capability.origin}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new Error('Wrapped Worker is unavailable.');
  }
  const data = await response.json().catch(() => ({}));
  const exactAuthority =
    response.ok &&
    data?.ok === true &&
    data?.worker === 'agentBridgeWorker' &&
    data?.protocolVersion === capability.protocolVersion &&
    data?.agentSessionWrappedConfigured === true &&
    data?.agentSessionWrappedReady === capability.enabled &&
    data?.dedicatedSession?.accessEnabled === capability.enabled &&
    normalizeSessionSlug(data?.dedicatedSession?.sessionSlug) === slug &&
    normalizeHttpsOrigin(data?.dedicatedSession?.sessionWorkerOrigin) === workerOrigin;
  if (!exactAuthority) throw new Error('Wrapped health did not prove the expected pinned authority and access state.');
  return { ok: true as const, accessEnabled: capability.enabled, protocolVersion: capability.protocolVersion };
};
