import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
});
