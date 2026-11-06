import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerPanel, { WorkerPanelProps } from './WorkerPanel';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const renderWorkerPanel = (props: Partial<WorkerPanelProps> = {}) =>
  render(
    <WorkerPanel
      renderSessionWizardInfoTooltip={() => null}
      workerMode="default"
      draft={{ corsWorkerUrl: '', slug: 'demo-session' }}
      workerSecretsEnabled
      setWorkerSecretsEnabled={() => {}}
      clearWorkerSecretFields={() => {}}
      workerResourceKeys={[]}
      renderResourceCard={() => null}
      workerAllowOrigins="https://app.example"
      setWorkerAllowOrigins={() => {}}
      workerLimitPerWallet=""
      setWorkerLimitPerWallet={() => {}}
      workerLimitPerAnonymousIp="0"
      setWorkerLimitPerAnonymousIp={() => {}}
      defaultAllowedOrigins="https://app.example"
      shouldUseSponsoredAutoDeployFlow={false}
      deployForm={{}}
      deployHelperToggle={null}
      shouldShowDeployHelperUrlInput={false}
      deployHelperUrl=""
      setDeployHelperUrl={() => {}}
      normalModeBundleUrl=""
      normalModeBundleHelpText=""
      showNormalModeManualBundleControls={false}
      normalModeBundleUrlOverride=""
      setNormalModeBundleUrlOverride={() => {}}
      normalModeBundleUrlOverrideValidationError=""
      manualBundleUrlOverrideHelp=""
      normalModeRetryBundleFileInputRef={{ current: null }}
      setBundleFile={() => {}}
      clearSelectedBundleFile={() => {}}
      bundleFile={null}
      normalModeManualBundleHelpText=""
      localWorkerBundleFallbackFilePath="/dist/sessionCorsWorker.bundle.js"
      account=""
      resolvedActiveSessionSlug="demo-session"
      showWorkerUrlField={false}
      displayedWorkerUrl=""
      renderField={() => null}
      workerUrlAutoFilled={false}
      {...props}
    />,
  );

describe('WorkerPanel', () => {
  it('renders without crashing with a minimal prop set', () => {
    renderWorkerPanel();

    // Hosting's More shows it inline: no panel header to collapse.
    expect(document.getElementById('session-wizard-section-worker')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-wizard-worker-panel-toggle')).not.toBeInTheDocument();
  });

  it('labels independent authenticated wallet and anonymous IP request limits', () => {
    const setWorkerLimitPerWallet = jest.fn();
    const setWorkerLimitPerAnonymousIp = jest.fn();
    renderWorkerPanel({ setWorkerLimitPerWallet, setWorkerLimitPerAnonymousIp });

    const walletLimit = screen.getByLabelText('Authenticated requests per wallet per day');
    const anonymousLimit = screen.getByLabelText('Anonymous requests per IP per day');

    expect(walletLimit).toHaveValue(null);
    expect(anonymousLimit).toHaveValue(0);
    expect(screen.getByText(/shared Wi-Fi/i)).toBeInTheDocument();
    expect(screen.getByText(/provider limits and access policy/i)).toBeInTheDocument();

    fireEvent.change(walletLimit, { target: { value: '9' } });
    fireEvent.change(anonymousLimit, { target: { value: '12' } });

    expect(setWorkerLimitPerWallet).toHaveBeenCalledWith('9');
    expect(setWorkerLimitPerAnonymousIp).toHaveBeenCalledWith('12');
  });

  it('omits the planned shared hosted worker sentence from the custom-worker summary', () => {
    renderWorkerPanel();

    expect(screen.getByText('Deploy your own worker or paste a worker URL you control.')).toBeInTheDocument();
    expect(screen.queryByText(/Shared hosted worker support is planned separately/i)).not.toBeInTheDocument();
  });

  it('passes the template setup marker through to native Worker verification', async () => {
    const adminAddress = '0x0000000000000000000000000000000000000001';
    const onNativeTemplateSetupGenerated = jest.fn();
    const verifyNativeWorker = jest.fn().mockResolvedValue({
      config: { slug: 'demo-sh' },
      configRevision: '',
      sessionId: '0x11111111111111111111111111111111',
      sessionSlug: 'demo-sh',
      workerOrigin: 'https://demo-sh.example.workers.dev',
    });
    renderWorkerPanel({
      allowNativeWorkerVerification: true,
      workerMode: 'custom',
      account: adminAddress,
      draft: { corsWorkerUrl: '', slug: 'demo-sh' },
      displayedWorkerUrl: 'https://demo-sh.example.workers.dev',
      verifyNativeWorker,
      nativeTemplateSetupIdentity: `demo-sh\n${adminAddress}`,
      onNativeTemplateSetupGenerated,
    });

    fireEvent.click(screen.getByTestId('ce-wizard-cloudflare-native-verify'));
    await waitFor(() =>
      expect(verifyNativeWorker).toHaveBeenCalledWith(expect.objectContaining({ deployedFromTemplate: true })),
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE));
    expect(onNativeTemplateSetupGenerated).toHaveBeenCalledWith(`demo-sh\n${adminAddress}`);
  });
});
