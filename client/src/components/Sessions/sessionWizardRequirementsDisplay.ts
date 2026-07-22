import type { SessionModeProfile } from '../../utilities/session/sessionModeProfile';
import { resolveSessionWizardModeRequirements, type SessionWizardRequirementId } from './sessionWizardModeRequirements';
import { resolveSessionWizardResourceSecretFields } from './sessionWizardResourceConfig';

type SessionWizardRecord = Record<string, unknown>;

type ResolveSessionWizardNewSessionRequirementsDisplayStateArgs = {
  cloudflareWorkerSbtGateMode?: unknown;
  currentWorkerSecrets?: SessionWizardRecord | null;
  hasPendingSbtDrafts?: unknown;
  hasSponsoredBundleLink?: unknown;
  isNewSessionWizardRoute?: unknown;
  newSessionBannerDismissalContextKey?: unknown;
  newSessionBannerDismissedContext?: unknown;
  normalizedAppliedSponsoredBundle?: SessionWizardRecord | null;
  persistedNewSessionBannerDismissed?: unknown;
  sponsoredBundleStatus?: SessionWizardRecord | null;
  sessionAi?: unknown;
  sessionModeProfile?: unknown;
};

type SessionWizardNewSessionRequirementsDisplayState = {
  hasNewSessionAiRequirementCovered: boolean;
  hasNewSessionArweaveRequirementCovered: boolean;
  hasNewSessionDeployRequirementCovered: boolean;
  hasNewSessionFundingRequirementCovered: boolean;
  hasNewSessionLitRequirementCovered: boolean;
  isNewSessionBannerDismissedForCurrentContext: boolean;
  newSessionRequiresLitCredential: boolean;
  requiredRequirementIds: SessionWizardRequirementId[];
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
  hasPendingSbtDrafts = false,
  hasSponsoredBundleLink = false,
  isNewSessionWizardRoute = false,
  newSessionBannerDismissalContextKey = '',
  newSessionBannerDismissedContext = '',
  normalizedAppliedSponsoredBundle = null,
  persistedNewSessionBannerDismissed = false,
  sponsoredBundleStatus = null,
  sessionAi = null,
  sessionModeProfile = null,
}: ResolveSessionWizardNewSessionRequirementsDisplayStateArgs = {}): SessionWizardNewSessionRequirementsDisplayState => {
  const modeRequirements = resolveSessionWizardModeRequirements(
    sessionModeProfile && typeof sessionModeProfile === 'object' ? (sessionModeProfile as SessionModeProfile) : null,
    { hasPendingSbtDrafts: !!hasPendingSbtDrafts },
  );
  const sponsoredBundleStatusTone = toRequirementString(sponsoredBundleStatus?.tone).trim().toLowerCase();
  const hasNewSessionAiRequirementCovered = !!toRequirementString(currentWorkerSecrets?.openaiKey).trim();
  const hasNewSessionArweaveRequirementCovered = !!toRequirementString(currentWorkerSecrets?.arweaveJwk).trim();
  const newSessionRequiresLitCredential = !cloudflareWorkerSbtGateMode;
  const hasNewSessionLitRequirementCovered =
    !newSessionRequiresLitCredential || !!toRequirementString(currentWorkerSecrets?.litAccountApiKey).trim();
  const hasNewSessionFundingRequirementCovered =
    (modeRequirements.selected && !modeRequirements.requiresFunding) ||
    !!(
      toRequirementString(currentWorkerSecrets?.faucetPrivateKey).trim() ||
      toRequirementString(normalizedAppliedSponsoredBundle?.faucetGrantToken).trim()
    );
  const requiresCloudflareDeploy = modeRequirements.requiredRequirementIds.some(
    (requirementId) => requirementId === 'cloudflareAccount' || requirementId === 'cloudflareApiToken',
  );
  const hasNewSessionDeployRequirementCovered =
    (modeRequirements.selected && !requiresCloudflareDeploy) ||
    !!toRequirementString(normalizedAppliedSponsoredBundle?.deployGrantToken).trim();
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
    requiredRequirementIds: modeRequirements.requiredRequirementIds,
    shouldRespectPersistedNewSessionBannerDismissal,
    showNewSessionRequirementsBanner,
    sponsoredBundleCoversNewSessionRequirements,
    sponsoredBundleOwnsNewSessionEntryFlow,
    sponsoredBundleStatusTone,
  };
};
