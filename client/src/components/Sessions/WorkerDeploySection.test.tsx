import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerDeploySection, { type WorkerDeploySectionProps } from './WorkerDeploySection';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

type RenderInfoTooltipProps = Parameters<NonNullable<WorkerDeploySectionProps['renderInfoTooltip']>>[0];

const buildWorkerDeploySectionProps = (props: Partial<WorkerDeploySectionProps> = {}): WorkerDeploySectionProps => ({
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

    expect(screen.getByText(/Log in with the session admin passkey/i)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_DEPLOY)).not.toBeInTheDocument();
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
    expect(screen.getByText(/Cloudflare may preselect All accounts/i)).toBeInTheDocument();
    expect(screen.getByText(/only when the token can see exactly one account/i)).toBeInTheDocument();

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
    expect(screen.getByText(/Cloudflare may preselect All accounts/i)).toBeInTheDocument();
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

  it('discloses the raw-token receiver, shortest lifetime, and revocation step', () => {
    renderWorkerDeploySection({
      deployHelperUrl: 'https://deploy-helper.example.test',
    });

    expect(screen.getByText('https://deploy-helper.example.test')).toBeInTheDocument();
    expect(
      screen.getByText(/browser sends this token only for this deployment attempt to the deploy helper/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/not saved to the session draft or browser storage/i)).toBeInTheDocument();
    expect(screen.getByText(/earliest expiration Cloudflare permits/i)).toBeInTheDocument();
    expect(
      screen.getByText(/revoke the token as soon as deployment succeeds or you abandon the attempt/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cloudflare API Tokens' })).toHaveAttribute(
      'href',
      'https://dash.cloudflare.com/profile/api-tokens',
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
