import type { SessionWizardModeRequirements } from './sessionWizardModeRequirements';

export type SessionWizardContractFieldKey = 'surveys' | 'sbtFactory' | 'sessionRegistry';

export type SessionWizardModeFieldPolicy = {
  showBlockLimits: boolean;
  showFaucet: boolean;
  showSessionEndsAt: boolean;
  showWorkerGroupDefaults: boolean;
  showSbtDefaults: boolean;
  visibleContractKeys: SessionWizardContractFieldKey[];
};

const LEGACY_FIELD_POLICY: SessionWizardModeFieldPolicy = {
  showBlockLimits: true,
  showFaucet: true,
  showSessionEndsAt: false,
  showWorkerGroupDefaults: false,
  showSbtDefaults: true,
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
      visibleContractKeys: usesOnChainSbt ? ['sbtFactory'] : [],
    };
  }

  return {
    ...LEGACY_FIELD_POLICY,
    showSessionEndsAt: false,
  };
};

export const isSessionWizardModeHiddenTopLevelField = (
  key: string,
  policy?: SessionWizardModeFieldPolicy,
): boolean => {
  if (!policy) return false;
  if (key === 'blockLimits') return !policy.showBlockLimits;
  if (key === 'faucet') return !policy.showFaucet;
  if (key === 'sessionEndsAt') return !policy.showSessionEndsAt;
  if (key === 'contracts') return policy.visibleContractKeys.length === 0;
  if (key === 'defaultGroupTags') return !policy.showWorkerGroupDefaults;
  if (key === 'defaultSbtTags' || key === 'defaultFeaturedSBTs' || key === 'autoFeatureSBTsBySessionSlug') {
    return !policy.showSbtDefaults;
  }
  return false;
};
