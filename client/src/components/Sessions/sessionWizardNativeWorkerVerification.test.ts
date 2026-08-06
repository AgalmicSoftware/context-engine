import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { verifyNativeSessionWorker } from './sessionWizardNativeWorkerVerification';
import type { SessionWizardWorkerDeployRuntime } from './hooks/useSessionWizardWorkerDeploy';

describe('verifyNativeSessionWorker', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([
    ['worker-canonical', SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE],
    ['decentralized', SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED],
  ])('rejects a %s Wrapped profile before any mutation or network effect', async (_label, presetId) => {
    const profile = cloneSessionModePreset(presetId);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.surfaces.agentHttp = true;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const getCurrentWorkerSecrets = jest.fn(() => ({ openaiKey: 'test-ai-key' }));
    const getMissingWorkerSecretsForDeploy = jest.fn(() => []);
    const parseAllowOriginsInput = jest.fn(() => ['https://contextengine.test']);
    const resolveConnectedAdminAddress = jest.fn(async () => '0x00000000000000000000000000000000000000aa');
    const resolveWorkerFaucetConfig = jest.fn(() => ({}));
    const signTypedAdminAction = jest.fn(async () => ({}));
    const updateDeploymentState = jest.fn();
    const updateDraftValue = jest.fn();

    await expect(
      verifyNativeSessionWorker({
        runtimeRef: {
          current: {
            draft: {
              slug: 'wrapped-session',
              sessionModeProfile: profile,
            },
            loginComplete: true,
            workerSecretsEnabled: true,
          } as SessionWizardWorkerDeployRuntime,
        },
        sessionSlug: 'wrapped-session',
        workerQueryValue: 'https://wrapped-session.example.test',
        getCurrentWorkerSecrets,
        getMissingWorkerSecretsForDeploy,
        parseAllowOriginsInput,
        resolveConnectedAdminAddress,
        resolveWorkerFaucetConfig,
        signTypedAdminAction,
        updateDeploymentState,
        updateDraftValue,
      }),
    ).rejects.toThrow(/Agent Session Wrapped.*legacy\/manual deploy-helper flow/i);

    expect(resolveConnectedAdminAddress).not.toHaveBeenCalled();
    expect(getCurrentWorkerSecrets).not.toHaveBeenCalled();
    expect(getMissingWorkerSecretsForDeploy).not.toHaveBeenCalled();
    expect(parseAllowOriginsInput).not.toHaveBeenCalled();
    expect(resolveWorkerFaucetConfig).not.toHaveBeenCalled();
    expect(signTypedAdminAction).not.toHaveBeenCalled();
    expect(updateDeploymentState).not.toHaveBeenCalled();
    expect(updateDraftValue).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
