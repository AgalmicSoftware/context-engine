import { resolveSessionWizardNewSessionRequirementsDisplayState } from './sessionWizardRequirementsDisplay';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

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

  it('treats the default Cloudflare profile as a two-key sponsored setup', () => {
    expect(
      resolveSessionWizardNewSessionRequirementsDisplayState({
        currentWorkerSecrets: { openaiKey: 'openai' },
        hasSponsoredBundleLink: true,
        isNewSessionWizardRoute: true,
        normalizedAppliedSponsoredBundle: { deployGrantToken: 'cloudflare-deploy' },
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        sponsoredBundleStatus: { tone: 'success' },
      }),
    ).toMatchObject({
      hasNewSessionArweaveRequirementCovered: true,
      hasNewSessionFundingRequirementCovered: true,
      hasNewSessionLitRequirementCovered: true,
      newSessionRequiresLitCredential: false,
      requiredRequirementIds: ['cloudflareApiToken', 'aiProviderKey'],
      sponsoredBundleCoversNewSessionRequirements: true,
    });
  });

  it.each(['anthropicKey', 'openrouterKey'])('does not accept unselected %s for the default OpenAI models', (key) => {
    expect(
      resolveSessionWizardNewSessionRequirementsDisplayState({
        currentWorkerSecrets: { [key]: 'provider-secret' },
        hasSponsoredBundleLink: true,
        isNewSessionWizardRoute: true,
        normalizedAppliedSponsoredBundle: { deployGrantToken: 'cloudflare-deploy' },
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        sponsoredBundleStatus: { tone: 'success' },
      }),
    ).toMatchObject({
      hasNewSessionAiRequirementCovered: false,
      sponsoredBundleCoversNewSessionRequirements: false,
    });
  });

  it.each([
    ['anthropic', 'anthropicKey'],
    ['openrouter', 'openrouterKey'],
  ])('accepts the configured %s key when that provider is selected', (provider, key) => {
    expect(
      resolveSessionWizardNewSessionRequirementsDisplayState({
        currentWorkerSecrets: { [key]: 'provider-secret', openaiKey: 'transcription-secret' },
        hasSponsoredBundleLink: true,
        isNewSessionWizardRoute: true,
        normalizedAppliedSponsoredBundle: { deployGrantToken: 'cloudflare-deploy' },
        sessionAi: {
          models: {
            fast: { provider },
            thinking: { provider },
          },
        },
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        sponsoredBundleStatus: { tone: 'success' },
      }),
    ).toMatchObject({
      hasNewSessionAiRequirementCovered: true,
      sponsoredBundleCoversNewSessionRequirements: true,
    });
  });
});
