import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerDeploySection, { type WorkerDeploySectionProps } from './WorkerDeploySection';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const buildWorkerDeploySectionProps = (props: Partial<WorkerDeploySectionProps> = {}): WorkerDeploySectionProps => ({
  allowNativeWorkerVerification: true,
  workerMode: 'custom',
  shouldUseSponsoredAutoDeployFlow: false,
  deployForm: { workerName: 'demo-worker', apiToken: '', adminAddress: '' },
  deployHelperToggle: <div>helper toggle</div>,
  shouldShowDeployHelperUrlInput: true,
  deployHelperUrl: '',
  setDeployHelperUrl: () => {},
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
  account: '0xabc',
  cloudflareTokenSlug: 'demo-worker',
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
    expect(screen.getByText('Deploy helper (API token)')).toBeInTheDocument();
    expect(screen.getByText('Deploy helper (API token)').closest('details')).not.toHaveAttribute('open');
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
      deployedFromTemplate: true,
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
        deployedFromTemplate: false,
      });
      expect(screen.getByTestId('ce-wizard-cloudflare-native-status')).toHaveTextContent(
        'Session Worker verified. You can deploy the session.',
      );
    });
    expect(screen.getByTestId('ce-wizard-cloudflare-native-status')).not.toHaveTextContent(/revision/i);
  });

  it('remembers generated template setup values for this slug and admin after a remount', async () => {
    const adminAddress = '0x0000000000000000000000000000000000000001';
    const onNativeTemplateSetupGenerated = jest.fn();
    const verifyNativeWorker = jest.fn().mockResolvedValue({
      config: { slug: 'demo-sh' },
      configRevision: '',
      sessionId: '0x11111111111111111111111111111111',
      sessionSlug: 'demo-sh',
      workerOrigin: 'https://demo-sh.example.workers.dev',
    });
    const props = {
      cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
      cloudflareTokenSlug: 'demo-sh',
      account: adminAddress,
      displayedWorkerUrl: 'https://demo-sh.example.workers.dev',
      verifyNativeWorker,
      onNativeTemplateSetupGenerated,
    };
    const first = renderWorkerDeploySection(props);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));
    expect(onNativeTemplateSetupGenerated).toHaveBeenCalledWith(`demo-sh\n${adminAddress}`);
    const marker = onNativeTemplateSetupGenerated.mock.calls[0][0];
    // Leaving the Worker step unmounts the section and its setup values.
    first.unmount();

    const remounted = renderWorkerDeploySection({ ...props, nativeTemplateSetupIdentity: marker });
    fireEvent.click(screen.getByTestId('ce-wizard-cloudflare-native-verify'));
    await waitFor(() =>
      expect(verifyNativeWorker).toHaveBeenLastCalledWith(expect.objectContaining({ deployedFromTemplate: true })),
    );
    remounted.unmount();

    // A marker for another admin does not apply.
    renderWorkerDeploySection({
      ...props,
      nativeTemplateSetupIdentity: 'demo-sh\n0x00000000000000000000000000000000000000ff',
    });
    fireEvent.click(screen.getByTestId('ce-wizard-cloudflare-native-verify'));
    await waitFor(() =>
      expect(verifyNativeWorker).toHaveBeenLastCalledWith(expect.objectContaining({ deployedFromTemplate: false })),
    );
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

  it('shows why the Worker rejected verification', async () => {
    renderWorkerDeploySection({
      cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
      cloudflareTokenSlug: 'demo-sh',
      account: '0x0000000000000000000000000000000000000001',
      displayedWorkerUrl: 'https://demo-sh.example.workers.dev',
      verifyNativeWorker: jest
        .fn()
        .mockRejectedValue(
          new Error('Worker config write failed (409): Worker-canonical session identity cannot be changed.'),
        ),
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));
    fireEvent.click(screen.getByTestId('ce-wizard-cloudflare-native-verify'));

    expect(await screen.findByTestId('ce-wizard-cloudflare-native-status')).toHaveTextContent(
      'Worker verification failed: Worker config write failed (409): Worker-canonical session identity cannot be changed. Check the Worker URL and session identity, then retry.',
    );
  });

  it('shows the sponsored auto-deploy note without manual controls', () => {
    renderWorkerDeploySection({
      shouldUseSponsoredAutoDeployFlow: true,
    });

    expect(screen.getByText(/Sponsored deploy bundle is ready\./i)).toHaveTextContent(
      'The sponsor selects the Worker release for this deployment. Manual bundle URLs and uploads do not change that release.',
    );
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).not.toBeInTheDocument();
  });

  it('renders the deploy helper controls and the read-only release bundle URL', () => {
    const setDeployHelperUrl = jest.fn();

    renderWorkerDeploySection({ setDeployHelperUrl });

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_NAME)).toHaveTextContent('demo-worker');
    expect(screen.getByText('helper toggle')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL), {
      target: { value: 'https://helper.example' },
    });
    expect(setDeployHelperUrl).toHaveBeenCalledWith('https://helper.example');

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue('https://bundle.example/release.js');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveAttribute('readonly');
  });
});

test('manual setup refuses a cleared operator key until generated-key mode is explicitly chosen', () => {
  renderWorkerDeploySection({ cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/' });
  const input = screen.getByLabelText('Your recovery key');
  fireEvent.change(input, { target: { value: 'a'.repeat(64) } });
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));
  expect(screen.getByText(/Use exactly 64 hex characters for your recovery key/)).toBeVisible();
  expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_SESSION_SLUG)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Use a generated deployment key' }));
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));
  expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_SESSION_SLUG)).toHaveValue('demo-worker');
});

it('shows an independent agent signing secret in native setup without putting it in the deploy URL', () => {
  renderWorkerDeploySection({
    agentHttpEnabled: true,
    cloudflareNativeDeployUrl: 'https://deploy.workers.cloudflare.com/?url=immutable',
    cloudflareTokenSlug: 'agent-fixture',
    account: '0x0000000000000000000000000000000000000001',
  });
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));
  const root = screen.getByTestId('ce-wizard-cloudflare-native-agent-root') as HTMLInputElement;
  expect(root.value).toMatch(/^[a-f0-9]{64}$/);
  expect(root.value).not.toBe(
    (screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_TOKEN_HMAC) as HTMLInputElement).value,
  );
  expect(root.value).not.toBe(
    (screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_STORAGE_KEK) as HTMLInputElement).value,
  );
  expect(screen.getByTestId('ce-wizard-cloudflare-native-checklist')).toHaveTextContent('five setup values');
  expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_DEPLOY).getAttribute('href')).not.toContain(
    root.value,
  );
});
