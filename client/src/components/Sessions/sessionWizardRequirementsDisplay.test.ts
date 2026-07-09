import { resolveSessionWizardNewSessionRequirementsDisplayState } from './sessionWizardRequirementsDisplay';

describe('sessionWizardRequirementsDisplay', () => {
  it('shows manual new-session requirements when no sponsored bundle owns the entry flow', () => {
    expect(
      resolveSessionWizardNewSessionRequirementsDisplayState({
        isNewSessionWizardRoute: true,
      }),
    ).toMatchObject({
      newSessionRequiresLitCredential: true,
      shouldRespectPersistedNewSessionBannerDismissal: true,
      showNewSessionRequirementsBanner: true,
      sponsoredBundleOwnsNewSessionEntryFlow: false,
    });
  });

  it('suppresses requirements when a sponsored bundle covers all publish prerequisites', () => {
    expect(
      resolveSessionWizardNewSessionRequirementsDisplayState({
        currentWorkerSecrets: {
          arweaveJwk: 'arweave',
          litAccountApiKey: 'lit',
          openaiKey: 'openai',
        },
        hasSponsoredBundleLink: true,
        isNewSessionWizardRoute: true,
        normalizedAppliedSponsoredBundle: {
          deployGrantToken: 'deploy',
          faucetGrantToken: 'funding',
        },
        sponsoredBundleStatus: { tone: 'success' },
      }),
    ).toMatchObject({
      hasNewSessionDeployRequirementCovered: true,
      hasNewSessionFundingRequirementCovered: true,
      showNewSessionRequirementsBanner: false,
      sponsoredBundleCoversNewSessionRequirements: true,
      sponsoredBundleOwnsNewSessionEntryFlow: true,
      sponsoredBundleStatusTone: 'success',
    });
  });

  it('keeps partial sponsored bundles visible and ignores plain dismissal state', () => {
    expect(
      resolveSessionWizardNewSessionRequirementsDisplayState({
        currentWorkerSecrets: {
          arweaveJwk: 'arweave',
          openaiKey: 'openai',
        },
        hasSponsoredBundleLink: true,
        isNewSessionWizardRoute: true,
        normalizedAppliedSponsoredBundle: {
          faucetGrantToken: 'funding-only',
        },
        persistedNewSessionBannerDismissed: true,
        sponsoredBundleStatus: { tone: 'success' },
      }),
    ).toMatchObject({
      hasNewSessionDeployRequirementCovered: false,
      shouldRespectPersistedNewSessionBannerDismissal: false,
      showNewSessionRequirementsBanner: true,
      sponsoredBundleCoversNewSessionRequirements: false,
      sponsoredBundleOwnsNewSessionEntryFlow: false,
    });
  });

  it('treats worker-enforced SBT access as not requiring a Lit credential', () => {
    expect(
      resolveSessionWizardNewSessionRequirementsDisplayState({
        cloudflareWorkerSbtGateMode: true,
        isNewSessionWizardRoute: true,
      }),
    ).toMatchObject({
      hasNewSessionLitRequirementCovered: true,
      newSessionRequiresLitCredential: false,
    });
  });
});
