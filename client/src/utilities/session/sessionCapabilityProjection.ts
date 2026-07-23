import {
  classifySessionModeProfileSupport,
  type SessionModeAccessConditionDocument,
  type SessionModeProfile,
  type SessionModeProfileSupportStatus,
} from './sessionModeProfile';

type UnknownRecord = Record<string, unknown>;

export type SessionCapabilityProjectionSource = 'profile' | 'legacy_registry' | 'invalid_profile' | 'missing';
export type SessionGateKind = 'sbt' | 'session';
export type SessionAdminSecretCardKey = 'ai' | 'rpc' | 'arweave' | 'faucet' | 'lit';
export type SessionAdminTestKey = 'health' | 'ai' | 'arweave' | 'faucet' | 'transcribe' | 'lit';

export type SessionCapabilityProjection = {
  source: SessionCapabilityProjectionSource;
  supportStatus: SessionModeProfileSupportStatus | 'legacy_registry' | 'missing';
  profileValid: boolean;
  authorityMode: string;
  isWorkerCanonical: boolean;
  isPureWorkerCanonical: boolean;
  isRegistryCanonical: boolean;
  usesWorkerAuthority: boolean;
  usesPasskeyIdentity: boolean;
  usesWalletIdentity: boolean;
  usesWorkerGroups: boolean;
  usesArweave: boolean;
  usesLit: boolean;
  usesOnChainSbt: boolean;
  usesRpc: boolean;
  usesFunding: boolean;
  usesChainMetadata: boolean;
  hasOnChainComponent: boolean;
  chainId: number | null;
  hasTranscription: boolean;
  gateKind: SessionGateKind;
  showNetworkControls: boolean;
  settingsResourceKeys: readonly string[];
  adminSecretCardKeys: readonly SessionAdminSecretCardKey[];
  adminTestKeys: readonly SessionAdminTestKey[];
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const hasKeys = (value: UnknownRecord): boolean => Object.keys(value).length > 0;

const getProfileCandidate = (value: unknown): { present: boolean; value: unknown } => {
  const input = asRecord(value);
  if (Object.prototype.hasOwnProperty.call(input, 'sessionModeProfile')) {
    return { present: true, value: input.sessionModeProfile };
  }
  return input.profileVersion === 1 ? { present: true, value: input } : { present: false, value: undefined };
};

const hasOnChainCondition = (document: unknown): boolean =>
  Array.isArray(asRecord(document).conditions) &&
  (asRecord(document).conditions as SessionModeAccessConditionDocument['conditions']).some(
    (condition) => asRecord(condition).kind === 'sbt_onchain',
  );

const hasExplicitTranscription = (config: UnknownRecord): boolean => {
  const ai = asRecord(config.ai);
  const models = asRecord(ai.models);
  const transcription = asRecord(models.transcription);
  return (
    hasKeys(transcription) ||
    hasKeys(asRecord(ai.transcription)) ||
    typeof ai.transcription === 'string' ||
    typeof config.transcription === 'string' ||
    hasKeys(asRecord(config.transcription))
  );
};

const hasLegacyRegistryAuthority = (config: UnknownRecord): boolean => {
  const registry = asRecord(config.__registry);
  const chainId =
    Number(registry.registryChainId || registry.chainId || config.networkChainId || config.chainId || 0) || 0;
  return (
    chainId > 0 &&
    !!String(
      registry.sessionId ||
        registry.sessionIdHex ||
        registry.registryAddress ||
        registry.adminAddress ||
        registry.metadataURI ||
        '',
    ).trim()
  );
};

const buildProjection = ({
  source,
  supportStatus,
  profileValid,
  authorityMode,
  usesPasskeyIdentity,
  usesWalletIdentity,
  usesWorkerGroups,
  usesArweave,
  usesLit,
  usesOnChainSbt,
  hasTranscription,
  explicitUsesRpc = false,
  explicitUsesFunding = false,
  chainId = null,
}: {
  source: SessionCapabilityProjectionSource;
  supportStatus: SessionCapabilityProjection['supportStatus'];
  profileValid: boolean;
  authorityMode: string;
  usesPasskeyIdentity: boolean;
  usesWalletIdentity: boolean;
  usesWorkerGroups: boolean;
  usesArweave: boolean;
  usesLit: boolean;
  usesOnChainSbt: boolean;
  hasTranscription: boolean;
  explicitUsesRpc?: boolean;
  explicitUsesFunding?: boolean;
  chainId?: number | null;
}): SessionCapabilityProjection => {
  const isWorkerCanonical = authorityMode === 'worker_canonical';
  const isRegistryCanonical = authorityMode === 'evm_registry_canonical';
  const usesRpc =
    explicitUsesRpc ||
    isRegistryCanonical ||
    authorityMode === 'worker_with_public_anchor' ||
    usesLit ||
    usesOnChainSbt;
  const usesFunding = explicitUsesFunding || isRegistryCanonical;
  const usesChainMetadata = isRegistryCanonical;
  const settingsResourceKeys = [
    'ai',
    ...(usesArweave ? ['arweave'] : []),
    ...(usesRpc ? ['rpc'] : []),
    ...(usesFunding ? ['txGas'] : []),
  ];
  const adminSecretCardKeys: SessionAdminSecretCardKey[] = [
    'ai',
    ...(usesRpc ? (['rpc'] as const) : []),
    ...(usesArweave ? (['arweave'] as const) : []),
    ...(usesFunding ? (['faucet'] as const) : []),
    ...(usesLit ? (['lit'] as const) : []),
  ];
  const adminTestKeys: SessionAdminTestKey[] = [
    'health',
    'ai',
    ...(usesArweave ? (['arweave'] as const) : []),
    ...(usesFunding ? (['faucet'] as const) : []),
    ...(hasTranscription ? (['transcribe'] as const) : []),
    ...(usesLit ? (['lit'] as const) : []),
  ];

  return {
    source,
    supportStatus,
    profileValid,
    authorityMode,
    isWorkerCanonical,
    isPureWorkerCanonical: isWorkerCanonical && !usesRpc,
    isRegistryCanonical,
    usesWorkerAuthority: isWorkerCanonical || authorityMode === 'worker_with_public_anchor',
    usesPasskeyIdentity,
    usesWalletIdentity,
    usesWorkerGroups,
    usesArweave,
    usesLit,
    usesOnChainSbt,
    usesRpc,
    usesFunding,
    usesChainMetadata,
    hasOnChainComponent: usesRpc,
    chainId: usesRpc && Number.isSafeInteger(chainId) && Number(chainId) > 0 ? Number(chainId) : null,
    hasTranscription,
    gateKind: isRegistryCanonical ? 'sbt' : 'session',
    showNetworkControls: usesRpc,
    settingsResourceKeys,
    adminSecretCardKeys,
    adminTestKeys,
  };
};

export const resolveSessionCapabilityProjection = (value: unknown): SessionCapabilityProjection => {
  const config = asRecord(value);
  const profileCandidate = getProfileCandidate(value);

  if (profileCandidate.present) {
    const support = classifySessionModeProfileSupport(profileCandidate.value);
    if (support.status !== 'reachable') {
      return buildProjection({
        source: 'invalid_profile',
        supportStatus: support.status,
        profileValid: false,
        authorityMode: '',
        usesPasskeyIdentity: false,
        usesWalletIdentity: false,
        usesWorkerGroups: false,
        usesArweave: false,
        usesLit: false,
        usesOnChainSbt: false,
        hasTranscription: false,
      });
    }

    const profile = profileCandidate.value as SessionModeProfile;
    const authorizationMechanisms = Array.isArray(profile.authorization?.mechanisms)
      ? profile.authorization.mechanisms
      : [];
    const usesOnChainSbt =
      authorizationMechanisms.includes('sbt_onchain') ||
      hasOnChainCondition(profile.encryption?.accessConditions) ||
      hasOnChainCondition(profile.storage?.payloadAccessControl?.accessConditions);

    return buildProjection({
      source: 'profile',
      supportStatus: support.status,
      profileValid: true,
      authorityMode: String(profile.authority?.mode || ''),
      usesPasskeyIdentity:
        profile.identity?.default === 'passkey' ||
        (Array.isArray(profile.identity?.enabled) && profile.identity.enabled.includes('passkey')),
      usesWalletIdentity:
        profile.identity?.default === 'wallet' ||
        (Array.isArray(profile.identity?.enabled) && profile.identity.enabled.includes('wallet')),
      usesWorkerGroups:
        profile.authority?.mode === 'worker_canonical' ||
        authorizationMechanisms.includes('worker_groups') ||
        authorizationMechanisms.includes('worker_roles'),
      usesArweave: profile.storage?.backend === 'arweave',
      usesLit: profile.encryption?.mode === 'lit',
      usesOnChainSbt,
      hasTranscription: hasExplicitTranscription(config),
      chainId: Number(profile.evm?.registryChainId || 0) || null,
    });
  }

  if (hasLegacyRegistryAuthority(config)) {
    const registry = asRecord(config.__registry);
    return buildProjection({
      source: 'legacy_registry',
      supportStatus: 'legacy_registry',
      profileValid: false,
      authorityMode: 'evm_registry_canonical',
      usesPasskeyIdentity: false,
      usesWalletIdentity: true,
      usesWorkerGroups: false,
      usesArweave: true,
      usesLit: false,
      usesOnChainSbt: true,
      hasTranscription: hasExplicitTranscription(config),
      chainId:
        Number(registry.registryChainId || registry.chainId || config.networkChainId || config.chainId || 0) || null,
    });
  }

  return buildProjection({
    source: 'missing',
    supportStatus: 'missing',
    profileValid: false,
    authorityMode: '',
    usesPasskeyIdentity: false,
    usesWalletIdentity: false,
    usesWorkerGroups: false,
    usesArweave: false,
    usesLit: false,
    usesOnChainSbt: false,
    hasTranscription: hasExplicitTranscription(config),
  });
};
