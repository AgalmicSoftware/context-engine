import {
  validateSessionModeProfile,
  type SessionModeAccessConditionDocument,
  type SessionModeProfile,
} from './sessionModeProfile';

type UnknownRecord = Record<string, unknown>;

export type SessionCapabilityProjectionSource = 'profile' | 'legacy_registry' | 'invalid_profile' | 'missing';
export type SessionGateKind = 'sbt' | 'session';
export type SessionAdminSecretCardKey = 'ai' | 'rpc' | 'arweave' | 'faucet' | 'lit';
export type SessionAdminTestKey = 'health' | 'ai' | 'arweave' | 'faucet' | 'transcribe' | 'lit';

export type SessionCapabilityProjection = {
  source: SessionCapabilityProjectionSource;
  profileValid: boolean;
  authorityMode: string;
  isWorkerCanonical: boolean;
  isRegistryCanonical: boolean;
  usesWorkerAuthority: boolean;
  usesPasskeyIdentity: boolean;
  usesWorkerGroups: boolean;
  usesArweave: boolean;
  usesLit: boolean;
  usesOnChainSbt: boolean;
  usesRpc: boolean;
  usesFunding: boolean;
  usesChainMetadata: boolean;
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

const getProfileCandidate = (value: unknown): UnknownRecord => {
  const input = asRecord(value);
  const nested = asRecord(input.sessionModeProfile);
  if (hasKeys(nested)) return nested;
  return input.profileVersion === 1 ? input : {};
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
  const chainId = Number(registry.registryChainId || registry.chainId || 0) || 0;
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
  profileValid,
  authorityMode,
  usesPasskeyIdentity,
  usesWorkerGroups,
  usesArweave,
  usesLit,
  usesOnChainSbt,
  hasTranscription,
  explicitUsesRpc = false,
  explicitUsesFunding = false,
}: {
  source: SessionCapabilityProjectionSource;
  profileValid: boolean;
  authorityMode: string;
  usesPasskeyIdentity: boolean;
  usesWorkerGroups: boolean;
  usesArweave: boolean;
  usesLit: boolean;
  usesOnChainSbt: boolean;
  hasTranscription: boolean;
  explicitUsesRpc?: boolean;
  explicitUsesFunding?: boolean;
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
    profileValid,
    authorityMode,
    isWorkerCanonical,
    isRegistryCanonical,
    usesWorkerAuthority: isWorkerCanonical || authorityMode === 'worker_with_public_anchor',
    usesPasskeyIdentity,
    usesWorkerGroups,
    usesArweave,
    usesLit,
    usesOnChainSbt,
    usesRpc,
    usesFunding,
    usesChainMetadata,
    hasTranscription,
    gateKind: usesOnChainSbt ? 'sbt' : 'session',
    showNetworkControls: usesRpc,
    settingsResourceKeys,
    adminSecretCardKeys,
    adminTestKeys,
  };
};

export const resolveSessionCapabilityProjection = (value: unknown): SessionCapabilityProjection => {
  const config = asRecord(value);
  const profileCandidate = getProfileCandidate(value);
  const hasProfile = hasKeys(profileCandidate);

  if (hasProfile) {
    const profile = profileCandidate as SessionModeProfile;
    const validation = validateSessionModeProfile(profile);
    if (!validation.valid) {
      return buildProjection({
        source: 'invalid_profile',
        profileValid: false,
        authorityMode: '',
        usesPasskeyIdentity: false,
        usesWorkerGroups: false,
        usesArweave: false,
        usesLit: false,
        usesOnChainSbt: false,
        hasTranscription: false,
      });
    }

    const authorizationMechanisms = Array.isArray(profile.authorization?.mechanisms)
      ? profile.authorization.mechanisms
      : [];
    const usesOnChainSbt =
      authorizationMechanisms.includes('sbt_onchain') ||
      hasOnChainCondition(profile.encryption?.accessConditions) ||
      hasOnChainCondition(profile.storage?.payloadAccessControl?.accessConditions);

    return buildProjection({
      source: 'profile',
      profileValid: true,
      authorityMode: String(profile.authority?.mode || ''),
      usesPasskeyIdentity:
        profile.identity?.default === 'passkey' ||
        (Array.isArray(profile.identity?.enabled) && profile.identity.enabled.includes('passkey')),
      usesWorkerGroups:
        profile.authority?.mode === 'worker_canonical' ||
        authorizationMechanisms.includes('worker_groups') ||
        authorizationMechanisms.includes('worker_roles'),
      usesArweave: profile.storage?.backend === 'arweave',
      usesLit: profile.encryption?.mode === 'lit',
      usesOnChainSbt,
      hasTranscription: hasExplicitTranscription(config),
    });
  }

  if (hasLegacyRegistryAuthority(config)) {
    return buildProjection({
      source: 'legacy_registry',
      profileValid: false,
      authorityMode: 'evm_registry_canonical',
      usesPasskeyIdentity: false,
      usesWorkerGroups: false,
      usesArweave: true,
      usesLit: false,
      usesOnChainSbt: true,
      hasTranscription: hasExplicitTranscription(config),
    });
  }

  const sponsoredKeys = asRecord(config.sponsoredKeys);
  return buildProjection({
    source: 'missing',
    profileValid: false,
    authorityMode: '',
    usesPasskeyIdentity: false,
    usesWorkerGroups: false,
    usesArweave: !!sponsoredKeys.arweave,
    usesLit: false,
    usesOnChainSbt: false,
    hasTranscription: hasExplicitTranscription(config),
    explicitUsesRpc: !!sponsoredKeys.rpc,
    explicitUsesFunding: !!(sponsoredKeys.faucet || sponsoredKeys.txGas),
  });
};
