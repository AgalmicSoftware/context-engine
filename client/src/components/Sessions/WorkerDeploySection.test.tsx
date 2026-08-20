import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerDeploySection, { type WorkerDeploySectionProps } from './WorkerDeploySection';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

type RenderInfoTooltipProps = Parameters<NonNullable<WorkerDeploySectionProps['renderInfoTooltip']>>[0];

const buildWorkerDeploySectionProps = (props: Partial<WorkerDeploySectionProps> = {}): WorkerDeploySectionProps => ({
  allowNativeWorkerVerification: true,
  isNormalMode: false,
  renderInfoTooltip: ({ testId }: RenderInfoTooltipProps) => <button type="button" data-testid={testId} />,
  workerMode: 'custom',
  shouldUseSponsoredAutoDeployFlow: false,
  deployForm: { workerName: 'demo-worker', bundleUrl: '', apiToken: '', adminAddress: '' },
  deployHelperToggle: <div>helper toggle</div>,
  shouldShowDeployHelperUrlInput: true,
  deployHelperUrl: '',
  setDeployHelperUrl: () => {},
  bundleMode: 'url',
  setBundleMode: () => {},
  normalModeBundleUrl: 'https://bundle.example/release.js',
  normalModeBundleHelpText: 'Release bundle',
  showNormalModeManualBundleControls: false,
  normalModeBundleUrlOverride: '',
  setNormalModeBundleUrlOverride: () => {},
  normalModeBundleUrlOverrideValidationError: '',
  manualBundleUrlOverrideHelp: '',
  normalModeRetryBundleFileInputRef: { current: null },
  setBundleFile: () => {},
  clearSelectedBundleFile: () => {},
  bundleFile: null,
  normalModeManualBundleHelpText: '',
  localWorkerBundleFallbackFilePath: '/dist/sessionCorsWorker.bundle.js',
  advancedBundleFileInputRef: { current: null },
  showSponsoredDeployAccessNotice: false,
  account: '0xabc',
  toggleLoginModal: jest.fn(),
  cloudflareTokenSlug: 'demo-worker',
  setDeployForm: () => {},
  handleDeployWorker: () => {},
  deployStatusDisplayState: {
    deployButtonDisabled: false,
    deployStatusText: '',
    isError: false,
  },
  ...props,
});

const renderWorkerDeploySection = (props: Partial<WorkerDeploySectionProps> = {}) =>
  render(<WorkerDeploySection {...buildWorkerDeploySectionProps(props)} />);

const rerenderWorkerDeploySection = (
  rerender: ReturnType<typeof render>['rerender'],
  props: Partial<WorkerDeploySectionProps> = {},
) => rerender(<WorkerDeploySection {...buildWorkerDeploySectionProps(props)} />);

describe('WorkerDeploySection', () => {
  it('offers the Cloudflare-owned full Worker path without a Cloudflare token or deploy helper', () => {
    const nativeDeployUrl =
      'https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2FAgalmicSoftware%2Fcontext-engine%2Ftree%2F0123456789abcdef0123456789abcdef01234567%2Fdeploy%2Fcloudflare%2Fsession-worker';
    renderWorkerDeploySection({
      cloudflareNativeDeployUrl: nativeDeployUrl,
      cloudflareTokenSlug: 'demo-sh',
      account: '0x0000000000000000000000000000000000000001',
    });

    expect(screen.getByText(/No Cloudflare API token, Context Engine deploy helper/i)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_DEPLOY)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_SESSION_SLUG)).toHaveValue('demo-sh');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_ADMIN_ADDRESS)).toHaveValue(
      '0x0000000000000000000000000000000000000001',
    );
    expect((screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_TOKEN_HMAC) as HTMLInputElement).value).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect((screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_STORAGE_KEK) as HTMLInputElement).value).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_DEPLOY)).toHaveAttribute('href', nativeDeployUrl);
    expect(screen.getByText('Legacy deploy-helper fallback')).toBeInTheDocument();
    expect(screen.getByText('Legacy deploy-helper fallback').closest('details')).not.toHaveAttribute('open');
  });

  it('does not open native deployment until the admin address is available', () => {
    renderWorkerDeploySection({
      cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
      cloudflareTokenSlug: 'demo-sh',
      account: '',
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));

    expect(screen.getByText(/Connect or sign in as the session admin/i)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_DEPLOY)).not.toBeInTheDocument();
  });

  it('opens login from the admin address control when no wallet is signed in', () => {
    const toggleLoginModal = jest.fn();
    renderWorkerDeploySection({
      account: '',
      toggleLoginModal,
      deployForm: { workerName: 'demo-worker', bundleUrl: '', apiToken: '', adminAddress: '' },
    });

    const loginControl = screen.getByTestId(E2E_TESTIDS.WIZARD_ADMIN_ADDRESS);
    expect(loginControl).toHaveAttribute('type', 'button');
    expect(loginControl).toHaveValue('Click to login');

    fireEvent.click(loginControl);

    expect(toggleLoginModal).toHaveBeenCalledWith(true);
  });

  it('shows the connected wallet in the admin address input while the form syncs', () => {
    renderWorkerDeploySection({
      account: '0x00000000000000000000000000000000000000aa',
      deployForm: { workerName: 'demo-worker', bundleUrl: '', apiToken: '', adminAddress: '' },
    });

    const adminAddress = screen.getByTestId(E2E_TESTIDS.WIZARD_ADMIN_ADDRESS);
    expect(adminAddress).toHaveAttribute('type', 'text');
    expect(adminAddress).toHaveValue('0x00000000000000000000000000000000000000aa');
  });

  it('keeps a restored admin address editable when the wallet disconnects', () => {
    renderWorkerDeploySection({
      account: '',
      deployForm: {
        workerName: 'demo-worker',
        bundleUrl: '',
        apiToken: '',
        adminAddress: '0x00000000000000000000000000000000000000bb',
      },
    });

    const adminAddress = screen.getByTestId(E2E_TESTIDS.WIZARD_ADMIN_ADDRESS);
    expect(adminAddress).toHaveAttribute('type', 'text');
    expect(adminAddress).toHaveValue('0x00000000000000000000000000000000000000bb');
  });

  it('does not report success until Worker reachability, CORS, and canonical config readback verify', async () => {
    const onNativeWorkerVerified = jest.fn();
    const verifyNativeWorker = jest.fn().mockResolvedValue({
      config: { slug: 'demo-sh' },
      configRevision: 'revision-7',
      sessionId: '0x11111111111111111111111111111111',
      sessionSlug: 'demo-sh',
      workerOrigin: 'https://demo-sh.example.workers.dev',
    });
    renderWorkerDeploySection({
      cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
      cloudflareTokenSlug: 'demo-sh',
      account: '0x0000000000000000000000000000000000000001',
      displayedWorkerUrl: 'https://demo-sh.example.workers.dev',
      verifyNativeWorker,
      onNativeWorkerVerified,
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));
    expect(screen.getByTestId('ce-wizard-cloudflare-native-checklist')).toHaveTextContent(
      /Return here and paste the resulting workers\.dev URL/i,
    );
    expect(screen.getByTestId('ce-wizard-cloudflare-native-status')).not.toHaveTextContent(/verified at revision/i);

    fireEvent.click(screen.getByTestId('ce-wizard-cloudflare-native-verify'));

    await waitFor(() =>
      expect(onNativeWorkerVerified).toHaveBeenCalledWith(
        expect.objectContaining({
          configRevision: 'revision-7',
          workerOrigin: 'https://demo-sh.example.workers.dev',
        }),
      ),
    );
    expect(verifyNativeWorker).toHaveBeenCalledWith({
      sessionSlug: 'demo-sh',
      workerQueryValue: 'https://demo-sh.example.workers.dev',
    });
    expect(screen.getByTestId('ce-wizard-cloudflare-native-status')).toHaveTextContent(
      /verified at revision revision-7/i,
    );
  });

  it('verifies an eligible existing Worker without generating replacement setup values', async () => {
    const verifyNativeWorker = jest.fn().mockResolvedValue({
      config: { slug: 'demo-worker' },
      configRevision: '',
      sessionId: '0x11111111111111111111111111111111',
      sessionSlug: 'demo-worker',
      workerOrigin: 'https://existing.example.workers.dev',
    });
    renderWorkerDeploySection({
      account: '0x0000000000000000000000000000000000000001',
      cloudflareNativeDeployUrl: '',
      cloudflareTokenSlug: 'demo-worker',
      displayedWorkerUrl: 'https://existing.example.workers.dev',
      verifyNativeWorker,
    });

    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_TOKEN_HMAC)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ce-wizard-cloudflare-native-verify'));

    await waitFor(() => {
      expect(verifyNativeWorker).toHaveBeenCalledWith({
        sessionSlug: 'demo-worker',
        workerQueryValue: 'https://existing.example.workers.dev',
      });
      expect(screen.getByTestId('ce-wizard-cloudflare-native-status')).toHaveTextContent(
        'Session Worker verified. You can deploy the session.',
      );
    });
    expect(screen.getByTestId('ce-wizard-cloudflare-native-status')).not.toHaveTextContent(/revision/i);
  });

  it('keeps the legacy deployment flow when native verification is not eligible', () => {
    renderWorkerDeploySection({
      allowNativeWorkerVerification: false,
      cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
      displayedWorkerUrl: 'https://existing.example.workers.dev',
    });

    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE)).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-wizard-cloudflare-native-verify')).not.toBeInTheDocument();
    expect(screen.getByText('Worker deployment').closest('details')).toHaveAttribute('open');
  });

  it('invalidates native verification when the exact Worker session identity changes', async () => {
    let resolveVerification:
      | ((value: {
          config: { slug: string };
          configRevision: string;
          sessionId: string;
          sessionSlug: string;
          workerOrigin: string;
        }) => void)
      | undefined;
    const verifyNativeWorker = jest.fn(
      () =>
        new Promise<{
          config: { slug: string };
          configRevision: string;
          sessionId: string;
          sessionSlug: string;
          workerOrigin: string;
        }>((resolve) => {
          resolveVerification = resolve;
        }),
    );
    const onNativeWorkerVerified = jest.fn();
    const { rerender } = renderWorkerDeploySection({
      cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
      cloudflareTokenSlug: 'session-a',
      account: '0x0000000000000000000000000000000000000001',
      displayedWorkerUrl: 'https://session-a.example.workers.dev',
      verifyNativeWorker,
      onNativeWorkerVerified,
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));
    fireEvent.click(screen.getByTestId('ce-wizard-cloudflare-native-verify'));
    rerenderWorkerDeploySection(rerender, {
      cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
      cloudflareTokenSlug: 'session-b',
      account: '0x0000000000000000000000000000000000000002',
      displayedWorkerUrl: 'https://session-b.example.workers.dev',
      verifyNativeWorker,
      onNativeWorkerVerified,
    });

    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_TOKEN_HMAC)).not.toBeInTheDocument();
    await act(async () => {
      resolveVerification?.({
        config: { slug: 'session-a' },
        configRevision: 'revision-a',
        sessionId: '0x11111111111111111111111111111111',
        sessionSlug: 'session-a',
        workerOrigin: 'https://session-a.example.workers.dev',
      });
      await Promise.resolve();
    });

    expect(onNativeWorkerVerified).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ce-wizard-cloudflare-native-status')).not.toBeInTheDocument();
  });

  it('invalidates a completed native verification when the Worker URL changes', async () => {
    const verifyNativeWorker = jest.fn().mockResolvedValue({
      config: { slug: 'demo-sh' },
      configRevision: 'revision-7',
      sessionId: '0x11111111111111111111111111111111',
      sessionSlug: 'demo-sh',
      workerOrigin: 'https://demo-sh.example.workers.dev',
    });
    const { rerender } = renderWorkerDeploySection({
      cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
      cloudflareTokenSlug: 'demo-sh',
      account: '0x0000000000000000000000000000000000000001',
      displayedWorkerUrl: 'https://demo-sh.example.workers.dev',
      verifyNativeWorker,
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));
    fireEvent.click(screen.getByTestId('ce-wizard-cloudflare-native-verify'));
    expect(await screen.findByText('Session Worker verified')).toBeInTheDocument();

    rerenderWorkerDeploySection(rerender, {
      cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
      cloudflareTokenSlug: 'demo-sh',
      account: '0x0000000000000000000000000000000000000001',
      displayedWorkerUrl: 'https://other.example.workers.dev',
      verifyNativeWorker,
    });

    expect(screen.getByTestId('ce-wizard-cloudflare-native-verify')).toHaveTextContent('Verify Session Worker');
    expect(screen.getByTestId('ce-wizard-cloudflare-native-status')).toHaveTextContent(
      /Worker URL changed.*Verify this exact Worker identity/i,
    );
  });

  it('invalidates completed native verification when its publish proof becomes stale', async () => {
    const verifyNativeWorker = jest.fn().mockResolvedValue({
      config: { slug: 'demo-sh' },
      configRevision: 'revision-7',
      sessionId: '0x11111111111111111111111111111111',
      sessionSlug: 'demo-sh',
      workerOrigin: 'https://demo-sh.example.workers.dev',
    });
    const stableProps = {
      cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
      cloudflareTokenSlug: 'demo-sh',
      account: '0x0000000000000000000000000000000000000001',
      displayedWorkerUrl: 'https://demo-sh.example.workers.dev',
      verifyNativeWorker,
    };
    const { rerender } = renderWorkerDeploySection({ ...stableProps, deployVerifiedInUi: false });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));
    fireEvent.click(screen.getByTestId('ce-wizard-cloudflare-native-verify'));
    expect(await screen.findByText('Session Worker verified')).toBeInTheDocument();

    rerenderWorkerDeploySection(rerender, { ...stableProps, deployVerifiedInUi: true });
    rerenderWorkerDeploySection(rerender, { ...stableProps, deployVerifiedInUi: false });

    expect(screen.getByTestId('ce-wizard-cloudflare-native-verify')).toHaveTextContent('Verify Session Worker');
    expect(screen.getByTestId('ce-wizard-cloudflare-native-status')).toHaveTextContent(
      /Session requirements changed.*Verify this exact Worker configuration/i,
    );
  });

  it('fails closed when the signed session verification callback is unavailable', () => {
    renderWorkerDeploySection({
      cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
      cloudflareTokenSlug: 'demo-sh',
      account: '0x0000000000000000000000000000000000000001',
      displayedWorkerUrl: 'https://demo-sh.example.workers.dev',
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));
    fireEvent.click(screen.getByTestId('ce-wizard-cloudflare-native-verify'));

    expect(screen.getByTestId('ce-wizard-cloudflare-native-status')).toHaveTextContent(
      /Session verification is unavailable/i,
    );
    expect(screen.getByTestId('ce-wizard-cloudflare-native-status')).not.toHaveTextContent(/verified at revision/i);
  });

  it('keeps reachability or CORS failures actionable and retryable', async () => {
    renderWorkerDeploySection({
      cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
      cloudflareTokenSlug: 'demo-sh',
      account: '0x0000000000000000000000000000000000000001',
      displayedWorkerUrl: 'https://demo-sh.example.workers.dev',
      verifyNativeWorker: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));
    fireEvent.click(screen.getByTestId('ce-wizard-cloudflare-native-verify'));

    expect(await screen.findByTestId('ce-wizard-cloudflare-native-status')).toHaveTextContent(
      /could not be reached, or its CORS policy rejected this browser origin/i,
    );
    expect(screen.getByTestId('ce-wizard-cloudflare-native-verify')).toHaveTextContent('Verify Session Worker');
  });

  it('shows the sponsored auto-deploy note without manual controls in normal mode', () => {
    renderWorkerDeploySection({
      isNormalMode: true,
      shouldUseSponsoredAutoDeployFlow: true,
    });

    expect(screen.getByText(/Sponsored deploy bundle is ready\./i)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER)).not.toBeInTheDocument();
  });

  it('renders deploy controls and forwards core callbacks', () => {
    const setDeployHelperUrl = jest.fn();
    const setBundleMode = jest.fn();
    const setDeployForm = jest.fn();
    const handleDeployWorker = jest.fn();

    renderWorkerDeploySection({
      setDeployHelperUrl,
      setBundleMode,
      setDeployForm,
      handleDeployWorker,
    });

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_NAME)).toHaveTextContent('demo-worker');
    expect(screen.getByText('helper toggle')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL), {
      target: { value: 'https://helper.example' },
    });
    expect(setDeployHelperUrl).toHaveBeenCalledWith('https://helper.example');

    fireEvent.click(screen.getByLabelText('Upload file'));
    expect(setBundleMode).toHaveBeenCalledWith('upload');

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL), {
      target: { value: 'https://bundle.example/custom.js' },
    });
    expect(setDeployForm).toHaveBeenCalledWith(expect.any(Function));

    const tokenLink = screen.getByRole('link', { name: 'Create prefilled API token' });
    expect(tokenLink).toHaveAttribute('target', '_blank');
    expect(tokenLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(tokenLink).toHaveAttribute('data-testid', E2E_TESTIDS.WIZARD_CLOUDFLARE_TOKEN_CREATE_LINK);
    const tokenUrl = new URL(String(tokenLink.getAttribute('href')));
    expect(tokenUrl.searchParams.get('name')).toContain('demo-worker');
    expect(tokenUrl.searchParams.get('accountId')).toBe('*');
    expect(JSON.parse(tokenUrl.searchParams.get('permissionGroupKeys') || '[]')).toEqual([
      { key: 'workers_scripts', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
    ]);
    expect(screen.queryByText(/Cloudflare may preselect All accounts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/only when the token can see exactly one account/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cloudflare API token setup and security guide' })).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/blob/main/docs/session-cors-worker.md#api-token-setup-and-handling',
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));
    expect(handleDeployWorker).toHaveBeenCalledTimes(1);
  });

  it('does not let hidden legacy account state scope the token template', () => {
    renderWorkerDeploySection({
      deployForm: {
        workerName: 'demo-worker',
        bundleUrl: '',
        apiToken: '',
        accountId: 'cf-account-1',
        adminAddress: '',
      },
    });

    const tokenUrl = new URL(
      String(screen.getByRole('link', { name: 'Create prefilled API token' }).getAttribute('href')),
    );
    expect(tokenUrl.searchParams.get('accountId')).toBe('*');
    expect(screen.queryByText(/Cloudflare may preselect All accounts/i)).not.toBeInTheDocument();
  });

  it('describes the least-privilege default Cloudflare token scopes', () => {
    renderWorkerDeploySection({
      renderInfoTooltip: ({ content, testId }: RenderInfoTooltipProps) => <div data-testid={testId}>{content}</div>,
    });

    expect(screen.getByTestId('ce-wizard-worker-tooltip-gw-cf-token-tip')).toHaveTextContent(
      'Workers Scripts: Edit and Workers KV Storage: Edit',
    );
    expect(screen.getByTestId('ce-wizard-worker-tooltip-gw-cf-token-tip')).not.toHaveTextContent(
      /R2|D1|Durable Objects|Account Settings/,
    );
  });

  it('links to token handling documentation instead of repeating operational guidance', () => {
    renderWorkerDeploySection({
      deployHelperUrl: 'https://deploy-helper.example.test',
    });

    expect(screen.queryByText(/browser sends this token only for this deployment attempt/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not saved to the session draft or browser storage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/earliest expiration Cloudflare permits/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/revoke the token as soon as deployment succeeds/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cloudflare API token setup and security guide' })).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/blob/main/docs/session-cors-worker.md#api-token-setup-and-handling',
    );
  });

  it('drops a stale cached Cloudflare account id whenever the API token is filled', () => {
    const setDeployForm = jest.fn();

    renderWorkerDeploySection({
      deployForm: {
        workerName: 'demo-worker',
        bundleUrl: '',
        apiToken: '',
        accountId: 'cf-account-1',
        adminAddress: '',
      },
      setDeployForm,
    });

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN), {
      target: { value: 'new-token' },
    });

    expect(setDeployForm).toHaveBeenCalledWith(expect.any(Function));
    const updater = setDeployForm.mock.calls[0][0];
    expect(
      updater({
        workerName: 'demo-worker',
        apiToken: '',
        accountId: 'cf-account-1',
        adminAddress: '',
      }),
    ).toEqual({
      workerName: 'demo-worker',
      apiToken: 'new-token',
      adminAddress: '',
    });
  });

  it('keeps the account id absent when replacing an API token', () => {
    const setDeployForm = jest.fn();

    renderWorkerDeploySection({
      deployForm: {
        workerName: 'demo-worker',
        bundleUrl: '',
        apiToken: 'old-token',
        accountId: 'cf-account-1',
        adminAddress: '',
      },
      setDeployForm,
    });

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN), {
      target: { value: 'new-token' },
    });

    expect(setDeployForm).toHaveBeenCalledWith(expect.any(Function));
    const updater = setDeployForm.mock.calls[0][0];
    expect(
      updater({
        workerName: 'demo-worker',
        apiToken: 'old-token',
        accountId: 'cf-account-1',
        adminAddress: '',
      }),
    ).toEqual({
      workerName: 'demo-worker',
      apiToken: 'new-token',
      adminAddress: '',
    });
    expect(
      updater({
        workerName: 'demo-worker',
        apiToken: 'new-token',
        accountId: 'cf-account-1',
        adminAddress: '',
      }),
    ).toEqual({
      workerName: 'demo-worker',
      apiToken: 'new-token',
      adminAddress: '',
    });
  });

  it('renders deploy status from the display descriptor', () => {
    renderWorkerDeploySection({
      deployStatusDisplayState: {
        deployButtonDisabled: false,
        deployStatusText: 'Missing API token.',
        isError: true,
      },
    });

    const status = screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS);
    expect(status).toHaveTextContent('Missing API token.');
    expect(status.className).toContain('copyStatusError');
  });

  it('disables deploy from the display descriptor', () => {
    renderWorkerDeploySection({
      deployStatusDisplayState: {
        deployButtonDisabled: true,
        deployStatusText: 'Deploying worker...',
        isError: false,
      },
    });

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER)).toBeDisabled();
  });

  it('keeps bundle and token inputs controlled when partial deployForm state hydrates later', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = renderWorkerDeploySection({
      deployForm: { workerName: 'demo-worker' },
    });

    rerenderWorkerDeploySection(rerender, {
      deployForm: {
        workerName: 'demo-worker',
        bundleUrl: 'https://bundle.example/custom.js',
        apiToken: 'secret-token',
        adminAddress: '0xabc',
      },
    });

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue('https://bundle.example/custom.js');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN)).toHaveValue('secret-token');
    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        String(message).includes('A component is changing an uncontrolled input to be controlled'),
      ),
    ).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it('remounts cleanly when advanced bundle mode switches from file upload to url input', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = renderWorkerDeploySection({
      bundleMode: 'upload',
    });

    rerenderWorkerDeploySection(rerender, {
      bundleMode: 'url',
      deployForm: {
        workerName: 'demo-worker',
        bundleUrl: 'https://bundle.example/from-url.js',
        apiToken: '',
        adminAddress: '',
      },
    });

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue('https://bundle.example/from-url.js');
    expect(
      consoleErrorSpy.mock.calls.some(([message]) =>
        String(message).includes('A component is changing an uncontrolled input to be controlled'),
      ),
    ).toBe(false);

    consoleErrorSpy.mockRestore();
  });
});
