import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkerDeploySection from './WorkerDeploySection';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const renderWorkerDeploySection = (props = {}) => render(
  <WorkerDeploySection
    isNormalMode={false}
    renderInfoTooltip={({ testId }) => <button type="button" data-testid={testId} />}
    workerMode="custom"
    shouldUseSponsoredAutoDeployFlow={false}
    deployForm={{ workerName: 'demo-worker', bundleUrl: '', apiToken: '', adminAddress: '' }}
    deployHelperToggle={<div>helper toggle</div>}
    shouldShowDeployHelperUrlInput
    deployHelperUrl=""
    setDeployHelperUrl={() => {}}
    bundleMode="url"
    setBundleMode={() => {}}
    normalModeBundleUrl="https://bundle.example/release.js"
    normalModeBundleHelpText="Release bundle"
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
    account="0xabc"
    cloudflareTokenSlug="demo-worker"
    setDeployForm={() => {}}
    handleDeployWorker={() => {}}
    deployInFlight={false}
    deployStatus=""
    deployStatusIsError={false}
    {...props}
  />
);

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
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

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

    fireEvent.click(screen.getByRole('button', { name: 'Create prefilled API token' }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('demo-worker'), '_blank');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));
    expect(handleDeployWorker).toHaveBeenCalledTimes(1);

    openSpy.mockRestore();
  });
});
