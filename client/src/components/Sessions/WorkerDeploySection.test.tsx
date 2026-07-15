import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
