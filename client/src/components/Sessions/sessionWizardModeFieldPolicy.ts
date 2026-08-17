import type { SessionWizardModeRequirements } from './sessionWizardModeRequirements';

export type SessionWizardContractFieldKey = 'surveys' | 'sbtFactory' | 'sessionRegistry';

export type SessionWizardModeFieldPolicy = {
  showBlockLimits: boolean;
  showFaucet: boolean;
  showSessionEndsAt: boolean;
  showWorkerGroupDefaults: boolean;
  showSbtDefaults: boolean;
  showAgentSessionWrapped: boolean;
  visibleContractKeys: SessionWizardContractFieldKey[];
};

export const SESSION_WIZARD_MODE_POLICY_FIELD_KEYS = Object.freeze([
  'blockLimits',
  'faucet',
  'sessionEndsAt',
  'contracts',
  'defaultGroupTags',
  'defaultSbtTags',
  'defaultFeaturedSBTs',
  'autoFeatureSBTsBySessionSlug',
  'agentSessionWrapped',
] as const);

type SessionWizardModePolicyPayload = Record<string, unknown>;

const LEGACY_FIELD_POLICY: SessionWizardModeFieldPolicy = {
  showBlockLimits: true,
  showFaucet: true,
  showSessionEndsAt: false,
  showWorkerGroupDefaults: false,
  showSbtDefaults: true,
  showAgentSessionWrapped: true,
  visibleContractKeys: ['surveys', 'sbtFactory', 'sessionRegistry'],
};

export const resolveSessionWizardModeFieldPolicy = (
  requirements: SessionWizardModeRequirements,
): SessionWizardModeFieldPolicy => {
  if (!requirements.selected) return LEGACY_FIELD_POLICY;

  if (requirements.isWorkerCanonical) {
    const usesOnChainSbt = requirements.publish.deployPendingSbts;
    return {
      showBlockLimits: false,
      showFaucet: false,
      showSessionEndsAt: true,
      showWorkerGroupDefaults: true,
      showSbtDefaults: usesOnChainSbt,
      showAgentSessionWrapped: requirements.usesAgentSessionWrapped,
      visibleContractKeys: usesOnChainSbt ? ['sbtFactory'] : [],
    };
  }

  return {
    ...LEGACY_FIELD_POLICY,
    showSessionEndsAt: false,
    showAgentSessionWrapped: requirements.usesAgentSessionWrapped,
  };
};

export const isSessionWizardModeHiddenTopLevelField = (key: string, policy?: SessionWizardModeFieldPolicy): boolean => {
  if (!policy) return false;
  if (key === 'blockLimits') return !policy.showBlockLimits;
  if (key === 'faucet') return !policy.showFaucet;
  if (key === 'sessionEndsAt') return !policy.showSessionEndsAt;
  if (key === 'contracts') return policy.visibleContractKeys.length === 0;
  if (key === 'defaultGroupTags') return !policy.showWorkerGroupDefaults;
  if (key === 'agentSessionWrapped') return !policy.showAgentSessionWrapped;
  if (key === 'defaultSbtTags' || key === 'defaultFeaturedSBTs' || key === 'autoFeatureSBTsBySessionSlug') {
    return !policy.showSbtDefaults;
  }
  return false;
};

export const applySessionWizardModeFieldPolicyToPayload = <T extends SessionWizardModePolicyPayload>(
  payload: T,
  policy: SessionWizardModeFieldPolicy,
): T => {
  const mutablePayload = payload as SessionWizardModePolicyPayload;
  SESSION_WIZARD_MODE_POLICY_FIELD_KEYS.forEach((key) => {
    if (isSessionWizardModeHiddenTopLevelField(key, policy)) delete mutablePayload[key];
  });

  if (policy.visibleContractKeys.length && mutablePayload.contracts && typeof mutablePayload.contracts === 'object') {
    const contracts = mutablePayload.contracts as SessionWizardModePolicyPayload;
    mutablePayload.contracts = policy.visibleContractKeys.reduce<SessionWizardModePolicyPayload>((allowed, key) => {
      if (Object.prototype.hasOwnProperty.call(contracts, key)) allowed[key] = contracts[key];
      return allowed;
    }, {});
    if (!Object.keys(mutablePayload.contracts as SessionWizardModePolicyPayload).length) {
      delete mutablePayload.contracts;
    }
  }

  (['encryptedFields', 'encryptedFieldGates'] as const).forEach((sidecarKey) => {
    const sidecar = mutablePayload[sidecarKey];
    if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) return;
    Object.keys(sidecar).forEach((fieldPath) => {
      const [rootKey, contractKey] = fieldPath.split('.');
      const hidden =
        rootKey === 'contracts'
          ? !contractKey || !policy.visibleContractKeys.includes(contractKey as SessionWizardContractFieldKey)
          : isSessionWizardModeHiddenTopLevelField(rootKey, policy);
      if (hidden) delete (sidecar as SessionWizardModePolicyPayload)[fieldPath];
    });
  });

  return payload;
};
