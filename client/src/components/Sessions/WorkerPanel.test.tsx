import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerPanel, { WorkerPanelProps } from './WorkerPanel';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const t = (key: string) => key;

const renderWorkerPanel = (props: Partial<WorkerPanelProps> = {}) =>
  render(
    <WorkerPanel
      isNormalMode
      t={t}
      renderSessionWizardInfoTooltip={() => null}
      isCollapsed={false}
      onToggleCollapsed={() => {}}
      showSharedWorkerChoice
      workerMode="default"
      onWorkerModeChange={() => {}}
      setWorkerUrlAutoFilled={() => {}}
      updateDraftValue={() => {}}
      getDefaultWorkerUrl={() => 'https://default-worker.example'}
      draft={{ corsWorkerUrl: '', slug: 'demo-session' }}
      deployWorkerUrl=""
      deployComplete={false}
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
      bundleMode="upload"
      setBundleMode={() => {}}
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
      advancedBundleFileInputRef={{ current: null }}
      showSponsoredDeployAccessNotice={false}
      account=""
      resolvedActiveSessionSlug="demo-session"
      setDeployForm={() => {}}
      handleDeployWorker={() => {}}
      deployStatusDisplayState={{
        deployButtonDisabled: false,
        deployStatusText: '',
        isError: false,
      }}
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

    expect(screen.getByText('Worker Setup')).toBeInTheDocument();
  });

  it('renders the Worker Setup header as a frameless toggle', () => {
    renderWorkerPanel();

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE)).toHaveAttribute(
      'data-ce-control-appearance',
      'frameless',
    );
  });

  it('fires the collapse toggle handler when the header button is clicked', () => {
    const onToggleCollapsed = jest.fn();
    renderWorkerPanel({ onToggleCollapsed });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('preserves the worker mode toggle test id', () => {
    renderWorkerPanel();

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_MODE_TOGGLE)).toBeInTheDocument();
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
    renderWorkerPanel({ showSharedWorkerChoice: false });

    expect(screen.getByText('Deploy your own worker or paste a worker URL you control.')).toBeInTheDocument();
    expect(screen.queryByText(/Shared hosted worker support is planned separately/i)).not.toBeInTheDocument();
  });

  it('renders worker mode pills and fires the mode-change handler', () => {
    const onWorkerModeChange = jest.fn();
    const setWorkerUrlAutoFilled = jest.fn();
    renderWorkerPanel({ onWorkerModeChange, setWorkerUrlAutoFilled });

    expect(screen.getByText('Using Default Worker')).toBeInTheDocument();
    expect(screen.getByText('Use My Own')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Use My Own'));

    expect(onWorkerModeChange).toHaveBeenCalledWith('custom');
    expect(setWorkerUrlAutoFilled).toHaveBeenCalledWith(false);
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
      isNormalMode: false,
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
