type SessionWizardRecord = Record<string, unknown>;

type ResolveSessionWizardNewSessionRequirementsDisplayStateArgs = {
  cloudflareWorkerSbtGateMode?: unknown;
  currentWorkerSecrets?: SessionWizardRecord | null;
  hasSponsoredBundleLink?: unknown;
  isNewSessionWizardRoute?: unknown;
  newSessionBannerDismissalContextKey?: unknown;
  newSessionBannerDismissedContext?: unknown;
  normalizedAppliedSponsoredBundle?: SessionWizardRecord | null;
  persistedNewSessionBannerDismissed?: unknown;
  sponsoredBundleStatus?: SessionWizardRecord | null;
};

type SessionWizardNewSessionRequirementsDisplayState = {
  hasNewSessionAiRequirementCovered: boolean;
  hasNewSessionArweaveRequirementCovered: boolean;
  hasNewSessionDeployRequirementCovered: boolean;
  hasNewSessionFundingRequirementCovered: boolean;
  hasNewSessionLitRequirementCovered: boolean;
  isNewSessionBannerDismissedForCurrentContext: boolean;
  newSessionRequiresLitCredential: boolean;
  shouldRespectPersistedNewSessionBannerDismissal: boolean;
  showNewSessionRequirementsBanner: boolean;
  sponsoredBundleCoversNewSessionRequirements: boolean;
  sponsoredBundleOwnsNewSessionEntryFlow: boolean;
  sponsoredBundleStatusTone: string;
};

const toRequirementString = (value: unknown): string => String(value ?? '');

export const resolveSessionWizardNewSessionRequirementsDisplayState = ({
  cloudflareWorkerSbtGateMode = false,
  currentWorkerSecrets = null,
  hasSponsoredBundleLink = false,
  isNewSessionWizardRoute = false,
  newSessionBannerDismissalContextKey = '',
  newSessionBannerDismissedContext = '',
  normalizedAppliedSponsoredBundle = null,
  persistedNewSessionBannerDismissed = false,
  sponsoredBundleStatus = null,
}: ResolveSessionWizardNewSessionRequirementsDisplayStateArgs = {}): SessionWizardNewSessionRequirementsDisplayState => {
  const sponsoredBundleStatusTone = toRequirementString(sponsoredBundleStatus?.tone).trim().toLowerCase();
  const hasNewSessionAiRequirementCovered = !!toRequirementString(currentWorkerSecrets?.openaiKey).trim();
  const hasNewSessionArweaveRequirementCovered = !!toRequirementString(currentWorkerSecrets?.arweaveJwk).trim();
  const newSessionRequiresLitCredential = !cloudflareWorkerSbtGateMode;
  const hasNewSessionLitRequirementCovered =
    !newSessionRequiresLitCredential || !!toRequirementString(currentWorkerSecrets?.litAccountApiKey).trim();
  const hasNewSessionFundingRequirementCovered = !!(
    toRequirementString(currentWorkerSecrets?.faucetPrivateKey).trim() ||
    toRequirementString(normalizedAppliedSponsoredBundle?.faucetGrantToken).trim()
  );
  const hasNewSessionDeployRequirementCovered = !!toRequirementString(
    normalizedAppliedSponsoredBundle?.deployGrantToken,
  ).trim();
  const sponsoredBundleCoversNewSessionRequirements =
    sponsoredBundleStatusTone === 'success' &&
    hasNewSessionAiRequirementCovered &&
    hasNewSessionArweaveRequirementCovered &&
    hasNewSessionLitRequirementCovered &&
    hasNewSessionFundingRequirementCovered &&
    hasNewSessionDeployRequirementCovered;
  const sponsoredBundleOwnsNewSessionEntryFlow =
    !!hasSponsoredBundleLink &&
    (!sponsoredBundleStatus || sponsoredBundleStatusTone === 'info' || sponsoredBundleCoversNewSessionRequirements);
  const isNewSessionBannerDismissedForCurrentContext =
    !!newSessionBannerDismissalContextKey && newSessionBannerDismissedContext === newSessionBannerDismissalContextKey;
  const shouldRespectPersistedNewSessionBannerDismissal = !hasSponsoredBundleLink;
  const showNewSessionRequirementsBanner =
    !!isNewSessionWizardRoute &&
    !isNewSessionBannerDismissedForCurrentContext &&
    !(shouldRespectPersistedNewSessionBannerDismissal && !!persistedNewSessionBannerDismissed) &&
    !sponsoredBundleOwnsNewSessionEntryFlow;

  return {
    hasNewSessionAiRequirementCovered,
    hasNewSessionArweaveRequirementCovered,
    hasNewSessionDeployRequirementCovered,
    hasNewSessionFundingRequirementCovered,
    hasNewSessionLitRequirementCovered,
    isNewSessionBannerDismissedForCurrentContext,
    newSessionRequiresLitCredential,
    shouldRespectPersistedNewSessionBannerDismissal,
    showNewSessionRequirementsBanner,
    sponsoredBundleCoversNewSessionRequirements,
    sponsoredBundleOwnsNewSessionEntryFlow,
    sponsoredBundleStatusTone,
  };
};
