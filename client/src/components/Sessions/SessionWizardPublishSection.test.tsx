import React, { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionWizardPublishSection, { type SessionWizardPublishSectionProps } from './SessionWizardPublishSection';

jest.mock('./SessionPublishSummary', () => ({
  __esModule: true,
  default: (props: any) => (
    <section
      data-testid="publish-summary"
      data-collapsed={String(props.isCollapsed)}
      data-mode={props.publishUiPlan?.publishActionDisplayState?.displayMode || ''}
      data-worker-source={props.workerUrlSource || ''}
    >
      <button type="button" onClick={props.onToggleCollapsed}>
        toggle publish
      </button>
      <button type="button" onClick={props.onTogglePublishAdvanced}>
        toggle advanced
      </button>
      <button type="button" onClick={props.onCopyAdminUrl}>
        copy admin
      </button>
      <button
        type="button"
        data-testid="ce-wizard-publish"
        disabled={!!props.publishUiPlan?.publishActionDisplayState?.publishButtonDisabled}
        onClick={props.onPublish}
      >
        publish
      </button>
    </section>
  ),
}));

const buildPublishUiPlan = (overrides: Record<string, any> = {}) => ({
  publishActionDisplayState: {
    canPublishNow: true,
    displayMode: 'advanced',
    publishAdvancedOpen: false,
    publishBusy: false,
    publishButtonDisabled: false,
    publishButtonLabel: 'Publish',
    settingsButtonActive: false,
    ...(overrides.publishActionDisplayState || {}),
  },
  publishExecutionPlan: {
    shouldAutoDeployWorker: false,
    shouldDeployPendingSbts: false,
    shouldRegisterSession: true,
    shouldUploadMetadata: false,
    stepNumbers: {},
    steps: [],
  },
  publishMetadataDisplayState: {
    effectiveMetadataGatewayUrl: '',
    effectiveMetadataTxId: '',
    manualMetadataDisplayUri: '',
    metadataUri: '',
    metadataUriLabel: '',
    showArweaveTx: false,
    showManualMetadataUri: false,
    showMetadataUri: false,
  },
  publishProgressDisplayState: {
    activePublishProgressStepLabel: '',
    publishProgressAriaValueText: '0% Preparing',
    publishProgressEyebrow: 'Publish Complete',
    publishProgressPercent: 0,
    publishProgressPercentRounded: 0,
    publishProgressSteps: [],
    publishStep: 0,
    showPublishProgress: false,
  },
  publishReadiness: {
    canPublishNow: true,
    canUploadMetadataNow: true,
    hasManualMetadata: false,
    hasUploadedMetadata: false,
    readinessKind: 'worker-upload',
    showUploadBlockedReason: false,
    uploadBlockedReason: '',
  },
});

const buildProps = (overrides: Partial<SessionWizardPublishSectionProps> = {}): SessionWizardPublishSectionProps => ({
  adminUrl: '',
  adminUrlStatus: '',
  bundleFile: null,
  bundleFileInputRef: createRef<HTMLInputElement>(),
  isCollapsed: false,
  isNormalMode: false,
  localWorkerBundleFallbackFilePath: '',
  manualBundleUrlOverrideHelp: '',
  manualGasLimit: '',
  manualGasPriceGwei: '',
  manualMaxFeePerGasGwei: '',
  manualMaxPriorityFeePerGasGwei: '',
  manualMetadataUrl: '',
  normalModeBundleUrlOverride: '',
  normalModeBundleUrlOverrideValidationError: '',
  normalModePublishSummary: [],
  onBundleFileChange: jest.fn(),
  onClearBundleFile: jest.fn(),
  onCopyAdminUrl: jest.fn(),
  onManualGasLimitChange: jest.fn(),
  onManualGasPriceGweiChange: jest.fn(),
  onManualMaxFeePerGasGweiChange: jest.fn(),
  onManualMaxPriorityFeePerGasGweiChange: jest.fn(),
  onManualMetadataUrlChange: jest.fn(),
  onNormalModeBundleUrlOverrideChange: jest.fn(),
  onPublish: jest.fn(),
  onToggleCollapsed: jest.fn(),
  onTogglePublishAdvanced: jest.fn(),
  publishUiPlan: buildPublishUiPlan(),
  publishedPendingSbtLinks: [],
  registerExplorerBaseUrl: '',
  registerTxs: [],
  renderInfoTooltip: jest.fn(() => null),
  resolvedWorkerBaseUrl: '',
  sessionUrl: '',
  showSponsoredBundleFallbackInput: false,
  sponsoredManualBundleRetryMessage: '',
  status: '',
  workerUrlSource: 'custom worker URL',
  ...overrides,
});

describe('SessionWizardPublishSection', () => {
  it('hides a collapsed normal-mode publish section without invoking callbacks', () => {
    const onPublish = jest.fn();
    const onToggleCollapsed = jest.fn();

    render(
      <SessionWizardPublishSection
        {...buildProps({
          isCollapsed: true,
          isNormalMode: true,
          onPublish,
          onToggleCollapsed,
        })}
      />,
    );

    expect(screen.queryByTestId('publish-summary')).not.toBeInTheDocument();
    expect(onPublish).not.toHaveBeenCalled();
    expect(onToggleCollapsed).not.toHaveBeenCalled();
  });

  it('keeps advanced collapsed publish visible and wires explicit execution props', () => {
    const onCopyAdminUrl = jest.fn();
    const onPublish = jest.fn();
    const onToggleCollapsed = jest.fn();
    const onTogglePublishAdvanced = jest.fn();

    render(
      <SessionWizardPublishSection
        {...buildProps({
          isCollapsed: true,
          isNormalMode: false,
          onCopyAdminUrl,
          onPublish,
          onToggleCollapsed,
          onTogglePublishAdvanced,
        })}
      />,
    );

    expect(screen.getByTestId('publish-summary')).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByTestId('publish-summary')).toHaveAttribute('data-mode', 'advanced');
    expect(screen.getByTestId('publish-summary')).toHaveAttribute('data-worker-source', 'custom worker URL');

    fireEvent.click(screen.getByText('toggle publish'));
    fireEvent.click(screen.getByText('toggle advanced'));
    fireEvent.click(screen.getByText('copy admin'));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
    expect(onTogglePublishAdvanced).toHaveBeenCalledTimes(1);
    expect(onCopyAdminUrl).toHaveBeenCalledTimes(1);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('preserves the disabled publish state from the display plan', () => {
    const onPublish = jest.fn();

    render(
      <SessionWizardPublishSection
        {...buildProps({
          onPublish,
          publishUiPlan: buildPublishUiPlan({
            publishActionDisplayState: {
              canPublishNow: false,
              publishButtonDisabled: true,
            },
          }),
        })}
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH)).toBeDisabled();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH));
    expect(onPublish).not.toHaveBeenCalled();
  });
});
