import {
  requireSessionWizardAgentSessionWrappedCapability,
  resolveSessionWizardAgentSessionWrappedDeployment,
} from './sessionWizardAgentSessionWrappedDeploy';

describe('sessionWizardAgentSessionWrappedDeploy', () => {
  it('keeps Wrapped absent when the sole Agent API surface bit is disabled', () => {
    expect(
      resolveSessionWizardAgentSessionWrappedDeployment({
        draft: { sessionModeProfile: { surfaces: { agentHttp: false } } },
        registryChainId: 11155420,
        sessionId: '7',
        slug: 'sample-session',
      }),
    ).toEqual({ requested: false, payload: {} });
  });

  it('derives stable dedicated deployment input from session identity', () => {
    expect(
      resolveSessionWizardAgentSessionWrappedDeployment({
        draft: { sessionModeProfile: { surfaces: { agentHttp: true } } },
        registryChainId: 11155420,
        sessionIdHex: '0x07',
        slug: 'sample-session',
      }),
    ).toEqual({
      requested: true,
      payload: {
        agentBridgeBundleUrl: expect.stringContaining('agentBridgeWorker.bundle.js'),
        agentSessionWrappedDeploymentIdentity: 'session:11155420:0x07:sample-session',
      },
    });
  });

  it('fails closed when a requested deploy omits a verified capability', () => {
    expect(() => requireSessionWizardAgentSessionWrappedCapability({ requested: true, value: null })).toThrow(
      'did not return a verified capability',
    );
    expect(requireSessionWizardAgentSessionWrappedCapability({ requested: false, value: null })).toBeNull();
  });
});
