import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminAgentSessionWrappedPanel from './AdminAgentSessionWrappedPanel';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

const capability = {
  version: 1 as const,
  enabled: true,
  origin: 'https://session-worker.example.workers.dev',
  protocolVersion: 'agent-session-wrapped-v1',
  revision: 'wrapped-0123456789abcdef',
  verifiedAt: '2026-07-20T18:00:00.000Z',
};

const registryModeProfile = (agentHttp = false) => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
  profile.surfaces.agentHttp = agentHttp;
  if (agentHttp) profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  return profile;
};

const sessionConfig = (overrides: Record<string, unknown> = {}) => ({
  slug: 'alpha',
  sessionId: '0x01',
  networkChainId: 11155420,
  corsWorkerUrl: 'https://session-worker.example.workers.dev',
  sessionModeProfile: registryModeProfile(),
  __registry: {
    registryChainId: 11155420,
    adminAddress: '0x1111111111111111111111111111111111111111',
  },
  ...overrides,
});

const baseProps = {
  canAdminWorker: true,
  deployHelperUrl: 'https://deploy-helper.example.workers.dev',
  requestIdFactory: () => 'wrapped-admin-panel-request',
  sessionConfig: sessionConfig(),
  sessionSlug: 'alpha',
  sessionWorkerUrl: 'https://session-worker.example.workers.dev',
  postSignedRequest: jest.fn(async () => ({ data: { ok: true } })),
  onConfigUpdated: jest.fn(),
};

describe('AdminAgentSessionWrappedPanel', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('explains the permanent locked-workerless stop without offering a partial deploy', () => {
    render(
      <AdminAgentSessionWrappedPanel
        {...baseProps}
        canAdminWorker={false}
        sessionWorkerUrl=""
        sessionConfig={sessionConfig({
          corsWorkerUrl: '',
          __registry: {
            registryChainId: 11155420,
            adminAddress: '0x0000000000000000000000000000000000000000',
          },
        })}
      />,
    );

    expect(screen.getByText(/permanently locked session has no usable Session Worker/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable Wrapped' })).not.toBeInTheDocument();
  });

  it('enables with a signed session configuration write and verifies capabilities', async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            features: ['agent_http_v1'],
            agentHttp: { enabled: true, configured: true, ready: true },
            sessionSlug: 'alpha',
            sessionWorkerOrigin: 'https://session-worker.example.workers.dev',
            workerUrl: capability.origin,
            agentSessionWrapped: capability,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    render(<AdminAgentSessionWrappedPanel {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Enable Wrapped' }));

    await waitFor(() => expect(baseProps.onConfigUpdated).toHaveBeenCalled());
    expect(baseProps.postSignedRequest).toHaveBeenCalled();
    expect(screen.queryByLabelText('Cloudflare API token')).not.toBeInTheDocument();
    expect(screen.getByText(/Wrapped access enabled and published/i)).toBeInTheDocument();
  });

  it('shows health and disable access for the same Session Worker', () => {
    render(
      <AdminAgentSessionWrappedPanel
        {...baseProps}
        sessionConfig={sessionConfig({
          agentSessionWrapped: capability,
          sessionModeProfile: registryModeProfile(true),
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Check health' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable access' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Redeploy' })).not.toBeInTheDocument();
  });

  it('keeps health observable when a locked or non-admin session is read-only', () => {
    render(
      <AdminAgentSessionWrappedPanel
        {...baseProps}
        canAdminWorker={false}
        sessionConfig={sessionConfig({ agentSessionWrapped: capability })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Check health' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Cloudflare API token')).not.toBeInTheDocument();
  });
});
