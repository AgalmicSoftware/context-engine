import {
  validateSessionModeProfile,
  type SessionModeProfile,
  type SessionModeResourceKey,
} from '../../utilities/session/sessionModeProfile';

const SESSION_WIZARD_REQUIREMENT_IDS = Object.freeze({
  CLOUDFLARE_ACCOUNT: 'cloudflareAccount',
  CLOUDFLARE_API_TOKEN: 'cloudflareApiToken',
  SESSION_WORKER: 'sessionWorker',
  AI_PROVIDER_KEY: 'aiProviderKey',
  ARWEAVE_JWK: 'arweaveJwk',
  RPC: 'rpc',
  WALLET: 'wallet',
  FUNDING: 'funding',
  LIT: 'lit',
} as const);

export type SessionWizardRequirementId =
  (typeof SESSION_WIZARD_REQUIREMENT_IDS)[keyof typeof SESSION_WIZARD_REQUIREMENT_IDS];

export type SessionWizardModeRequirements = {
  selected: boolean;
  authorityMode: string;
  isWorkerCanonical: boolean;
  usesWorkerRuntime: boolean;
  usesAgentSessionWrapped: boolean;
  presetKeyChips: string[];
  requiredRequirementIds: SessionWizardRequirementId[];
  requiredWorkerSecretFields: string[];
  visibleWorkerResourceKeys: string[];
  requiresArweave: boolean;
  requiresRpc: boolean;
  requiresLit: boolean;
  requiresFunding: boolean;
  requiresWallet: boolean;
  publish: {
    deployPendingSbts: boolean;
    persistWorkerConfig: boolean;
    uploadMetadata: boolean;
    registerSession: boolean;
    refreshRegistryCache: boolean;
  };
  publishSettings: {
    showArweaveMetadataControls: boolean;
    showGasOverrideControls: boolean;
  };
};

type ResolveSessionWizardModeRequirementsOptions = {
  hasPendingSbtDrafts?: boolean;
};

const emptyRequirements = (): SessionWizardModeRequirements => ({
  selected: false,
  authorityMode: '',
  isWorkerCanonical: false,
  usesWorkerRuntime: false,
  usesAgentSessionWrapped: false,
  presetKeyChips: [],
  requiredRequirementIds: [],
  requiredWorkerSecretFields: [],
  visibleWorkerResourceKeys: [],
  requiresArweave: false,
  requiresRpc: false,
  requiresLit: false,
  requiresFunding: false,
  requiresWallet: false,
  publish: {
    deployPendingSbts: false,
    persistWorkerConfig: false,
    uploadMetadata: false,
    registerSession: false,
    refreshRegistryCache: false,
  },
  publishSettings: {
    showArweaveMetadataControls: false,
    showGasOverrideControls: false,
  },
});

const hasOnChainCondition = (profile: SessionModeProfile): boolean => {
  const documents = [profile.encryption?.accessConditions, profile.storage?.payloadAccessControl?.accessConditions];
  return documents.some(
    (document) =>
      Array.isArray(document?.conditions) && document.conditions.some((condition) => condition?.kind === 'sbt_onchain'),
  );
};

const hasActiveResource = (profile: SessionModeProfile, resource: SessionModeResourceKey): boolean => {
  const stage = profile.storage?.resources?.[resource]?.stage;
  return !stage || stage === 'active';
};

export const resolveSessionWizardModeRequirements = (
  profile: SessionModeProfile | null | undefined,
  { hasPendingSbtDrafts = false }: ResolveSessionWizardModeRequirementsOptions = {},
): SessionWizardModeRequirements => {
  if (!profile || typeof profile !== 'object' || !validateSessionModeProfile(profile).valid) return emptyRequirements();

  const authorityMode = String(profile.authority?.mode || '');
  const isWorkerCanonical = authorityMode === 'worker_canonical';
  const usesWorkerRuntime = Object.values(profile.surfaces || {}).some((enabled) => enabled === true);
  const usesCloudflare = profile.storage?.backend === 'cloudflare';
  const usesAgentSessionWrapped = profile.surfaces?.agentHttp === true;
  const requiresArweave = profile.storage?.backend === 'arweave';
  const requiresLit = profile.encryption?.mode === 'lit';
  const requiresRegistry = authorityMode === 'evm_registry_canonical';
  const deployPendingSbts = profile.authorization?.mechanisms?.includes('sbt_onchain') || hasOnChainCondition(profile);
  const willDeployPendingSbts = deployPendingSbts && hasPendingSbtDrafts;
  const requiresRpc =
    requiresRegistry ||
    authorityMode === 'worker_with_public_anchor' ||
    requiresLit ||
    profile.authorization?.mechanisms?.includes('sbt_onchain') ||
    hasOnChainCondition(profile);
  // Publishing a pending SBT is itself an EVM transaction even when the
  // session authority and canonical config remain worker-owned. Existing
  // on-chain SBT conditions still need RPC reads, but not transaction inputs.
  const requiresFunding = requiresRegistry || willDeployPendingSbts;
  const requiresWallet = requiresRegistry || willDeployPendingSbts;

  const requiredRequirementIds: SessionWizardRequirementId[] = [];
  if (usesCloudflare) {
    requiredRequirementIds.push(SESSION_WIZARD_REQUIREMENT_IDS.CLOUDFLARE_ACCOUNT);
  } else if (usesWorkerRuntime) {
    requiredRequirementIds.push(SESSION_WIZARD_REQUIREMENT_IDS.SESSION_WORKER);
  }
  if (usesAgentSessionWrapped) {
    requiredRequirementIds.push(SESSION_WIZARD_REQUIREMENT_IDS.CLOUDFLARE_API_TOKEN);
  }
  requiredRequirementIds.push(SESSION_WIZARD_REQUIREMENT_IDS.AI_PROVIDER_KEY);
  if (requiresArweave) requiredRequirementIds.push(SESSION_WIZARD_REQUIREMENT_IDS.ARWEAVE_JWK);
  if (requiresRpc) requiredRequirementIds.push(SESSION_WIZARD_REQUIREMENT_IDS.RPC);
  if (requiresWallet) requiredRequirementIds.push(SESSION_WIZARD_REQUIREMENT_IDS.WALLET);
  if (requiresFunding) requiredRequirementIds.push(SESSION_WIZARD_REQUIREMENT_IDS.FUNDING);
  if (requiresLit) requiredRequirementIds.push(SESSION_WIZARD_REQUIREMENT_IDS.LIT);

  const requiredWorkerSecretFields = ['openaiKey'];
  if (requiresArweave) requiredWorkerSecretFields.push('arweaveJwk');
  if (requiresLit) requiredWorkerSecretFields.push('litAccountApiKey');

  const visibleWorkerResourceKeys = ['ai'];
  if (requiresArweave && hasActiveResource(profile, 'docsContext')) visibleWorkerResourceKeys.push('arweave');
  if (requiresRpc) visibleWorkerResourceKeys.push('rpc');
  if (requiresFunding) visibleWorkerResourceKeys.push('txGas');
  if (requiresLit) visibleWorkerResourceKeys.push('lit');

  const presetKeyChips = usesCloudflare
    ? [
        'Cloudflare account',
        ...(usesAgentSessionWrapped ? ['Request-only Cloudflare API token'] : []),
        'OpenAI API Key',
        ...(requiresRpc ? ['RPC URL/key'] : []),
        ...(requiresLit ? ['Lit API key'] : []),
      ]
    : [
        ...(usesWorkerRuntime ? ['Compatible Session Worker'] : []),
        ...(usesAgentSessionWrapped ? ['Request-only Cloudflare API token'] : []),
        'OpenAI API Key',
        'Arweave wallet/JWK',
        'RPC URL/key',
        'Lit API key if encryption is enabled',
      ];

  return {
    selected: true,
    authorityMode,
    isWorkerCanonical,
    usesWorkerRuntime,
    usesAgentSessionWrapped,
    presetKeyChips,
    requiredRequirementIds,
    requiredWorkerSecretFields,
    visibleWorkerResourceKeys,
    requiresArweave,
    requiresRpc,
    requiresLit,
    requiresFunding,
    requiresWallet,
    publish: {
      deployPendingSbts,
      persistWorkerConfig: isWorkerCanonical,
      uploadMetadata: requiresArweave,
      registerSession: requiresRegistry,
      refreshRegistryCache: requiresRegistry,
    },
    publishSettings: {
      showArweaveMetadataControls: requiresArweave,
      showGasOverrideControls: requiresRegistry || willDeployPendingSbts,
    },
  };
};
