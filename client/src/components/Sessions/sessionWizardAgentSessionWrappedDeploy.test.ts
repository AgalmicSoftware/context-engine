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

  it('uses the single Session Worker deployment for agent access', () => {
    expect(
      resolveSessionWizardAgentSessionWrappedDeployment({
        draft: { sessionModeProfile: { surfaces: { agentHttp: true } } },
        registryChainId: 11155420,
        sessionIdHex: '0x07',
        slug: 'sample-session',
      }),
    ).toEqual({
      requested: true,
      payload: {},
    });
  });

  it('fails closed when a requested deploy omits a verified capability', () => {
    expect(() => requireSessionWizardAgentSessionWrappedCapability({ requested: true, value: null })).toThrow(
      'did not return a verified capability',
    );
    expect(requireSessionWizardAgentSessionWrappedCapability({ requested: false, value: null })).toBeNull();
  });
});

const capability = {
  version: 1,
  enabled: true,
  origin: 'https://session.example',
  protocolVersion: 'agent-session-wrapped-v1',
  revision: 'fixture',
  verifiedAt: '2026-10-27T00:00:00.000Z',
};
test('rejects a helper or sponsor capability from a foreign origin', () => {
  expect(() =>
    requireSessionWizardAgentSessionWrappedCapability({
      requested: true,
      value: capability,
      workerUrl: 'https://other.example',
    }),
  ).toThrow(/Session Worker origin/);
  expect(
    requireSessionWizardAgentSessionWrappedCapability({
      requested: true,
      value: capability,
      workerUrl: 'https://session.example/',
    }),
  ).toEqual(capability);
});
