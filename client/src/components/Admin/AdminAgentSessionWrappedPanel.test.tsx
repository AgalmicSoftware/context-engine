import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminAgentSessionWrappedPanel from './AdminAgentSessionWrappedPanel';

const capability = {
  version: 1 as const,
  enabled: true,
  origin: 'https://wrapped-alpha.example.workers.dev',
  protocolVersion: 'agent-session-wrapped-v1',
  revision: 'wrapped-0123456789abcdef',
  verifiedAt: '2026-07-20T18:00:00.000Z',
};

const sessionConfig = (overrides: Record<string, unknown> = {}) => ({
  slug: 'alpha',
  sessionId: '0x01',
  networkChainId: 11155420,
  corsWorkerUrl: 'https://session-worker.example.workers.dev',
  sessionModeProfile: {
    surfaces: { web: true, telegram: false, agentHttp: false },
    authority: { mode: 'evm_registry_canonical' },
  },
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

    expect(screen.getByText(/permanently locked session has no usable paired Worker/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable Wrapped' })).not.toBeInTheDocument();
  });

  it('enables through one request-only token and clears it after durable publication', async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionSlug: 'alpha',
            sessionWorkerOrigin: 'https://session-worker.example.workers.dev',
            workerUrl: capability.origin,
            agentSessionWrapped: capability,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    render(<AdminAgentSessionWrappedPanel {...baseProps} />);

    const tokenInput = screen.getByLabelText('Cloudflare API token');
    fireEvent.change(tokenInput, { target: { value: 'cf-request-only-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enable Wrapped' }));

    await waitFor(() => expect(baseProps.onConfigUpdated).toHaveBeenCalled());
    expect(baseProps.postSignedRequest).toHaveBeenCalled();
    expect(tokenInput).toHaveValue('');
    expect(screen.getByText(/Wrapped access enabled and published/i)).toBeInTheDocument();
  });

  it('shows health, disable-access, and redeploy controls without any Telegram requirement', () => {
    render(
      <AdminAgentSessionWrappedPanel
        {...baseProps}
        sessionConfig={sessionConfig({
          agentSessionWrapped: capability,
          sessionModeProfile: {
            surfaces: { web: true, telegram: false, agentHttp: true },
            authority: { mode: 'evm_registry_canonical' },
          },
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Check health' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable access' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Redeploy' })).toBeInTheDocument();
    expect(screen.getByText(/Telegram is optional and remains disabled/i)).toBeInTheDocument();
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
