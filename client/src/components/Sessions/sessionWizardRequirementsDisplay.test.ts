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
      requiredRequirementIds: ['cloudflareAccount', 'aiProviderKey'],
      sponsoredBundleCoversNewSessionRequirements: true,
    });
  });

  it('shows SBT transaction requirements only while an undeployed draft is pending', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = 'custom';
    profile.authorization.mechanisms.push('sbt_onchain');
    profile.evm.registryChainId = 11155420;
    profile.encryption.accessConditions = {
      match: 'any',
      conditions: [
        { kind: 'worker_role', role: 'admin' },
        {
          kind: 'sbt_onchain',
          chainId: 11155420,
          contract: '0x00000000000000000000000000000000000000aa',
          anyOrAll: 'any',
        },
      ],
    };

    const settled = resolveSessionWizardNewSessionRequirementsDisplayState({
      sessionModeProfile: profile,
    });
    const pending = resolveSessionWizardNewSessionRequirementsDisplayState({
      hasPendingSbtDrafts: true,
      sessionModeProfile: profile,
    });

    expect(settled.requiredRequirementIds).toEqual(['cloudflareAccount', 'aiProviderKey', 'rpc']);
    expect(pending.requiredRequirementIds).toEqual(['cloudflareAccount', 'aiProviderKey', 'rpc', 'wallet', 'funding']);
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

  it('keeps decentralized mixed-provider requirements visible until every selected key is present', () => {
    expect(
      resolveSessionWizardNewSessionRequirementsDisplayState({
        currentWorkerSecrets: {
          openaiKey: 'transcription-secret',
          arweaveJwk: '{"kty":"RSA"}',
        },
        hasSponsoredBundleLink: true,
        isNewSessionWizardRoute: true,
        normalizedAppliedSponsoredBundle: { faucetGrantToken: 'funding-grant' },
        sessionAi: {
          models: {
            fast: { provider: 'anthropic' },
            thinking: { provider: 'openrouter' },
            transcription: { provider: 'openai' },
          },
        },
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
        sponsoredBundleStatus: { tone: 'success' },
      }),
    ).toMatchObject({
      hasNewSessionAiRequirementCovered: false,
      requiredAiProviderKeyLabels: ['Anthropic key', 'OpenRouter key', 'OpenAI key'],
      showNewSessionRequirementsBanner: true,
      sponsoredBundleCoversNewSessionRequirements: false,
      sponsoredBundleOwnsNewSessionEntryFlow: false,
    });
  });

  it('keeps the decentralized Worker requirement visible until a runtime is attached or deploy-ready', () => {
    const baseInput = {
      currentWorkerSecrets: {
        openaiKey: 'provider-secret',
        arweaveJwk: '{"kty":"RSA"}',
      },
      hasSponsoredBundleLink: true,
      isNewSessionWizardRoute: true,
      normalizedAppliedSponsoredBundle: {
        faucetGrantToken: 'funding-grant',
        deployGrantToken: 'raw-deploy-grant',
      },
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      sponsoredBundleStatus: { tone: 'success' },
    };

    expect(resolveSessionWizardNewSessionRequirementsDisplayState(baseInput)).toMatchObject({
      hasNewSessionDeployRequirementCovered: false,
      showNewSessionRequirementsBanner: true,
      sponsoredBundleCoversNewSessionRequirements: false,
      sponsoredBundleOwnsNewSessionEntryFlow: false,
    });

    expect(
      resolveSessionWizardNewSessionRequirementsDisplayState({
        ...baseInput,
        hasCompatibleWorkerRuntime: true,
      }),
    ).toMatchObject({
      hasNewSessionDeployRequirementCovered: true,
      showNewSessionRequirementsBanner: false,
      sponsoredBundleCoversNewSessionRequirements: true,
      sponsoredBundleOwnsNewSessionEntryFlow: true,
    });

    expect(
      resolveSessionWizardNewSessionRequirementsDisplayState({
        ...baseInput,
        canUseSponsoredAutoDeployNow: true,
      }),
    ).toMatchObject({
      hasNewSessionDeployRequirementCovered: true,
      showNewSessionRequirementsBanner: false,
      sponsoredBundleCoversNewSessionRequirements: true,
      sponsoredBundleOwnsNewSessionEntryFlow: true,
    });
  });
});
