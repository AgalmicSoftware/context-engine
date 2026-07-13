import React, { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SessionPublishSummary from './SessionPublishSummary';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  cloneSessionModePreset,
  SESSION_MODE_PRESET_IDS,
  type SessionModePresetId,
} from '../../utilities/session/sessionModeProfile';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';

const resolvePresetPublishSettings = (presetId: Exclude<SessionModePresetId, 'custom'>) =>
  resolveSessionWizardModeRequirements(cloneSessionModePreset(presetId)).publishSettings;

const buildPublishUiPlan = (overrides: Record<string, any> = {}) => {
  const publishReadiness = {
    canPublishNow: true,
    canUploadMetadataNow: true,
    hasManualMetadata: false,
    hasUploadedMetadata: false,
    readinessKind: 'worker-upload',
    showUploadBlockedReason: false,
    uploadBlockedReason: '',
    ...(overrides.publishReadiness || {}),
  };
  const actionDisplayOverrides = overrides.publishActionDisplayState || {};
  const displayMode = actionDisplayOverrides.displayMode || 'advanced';
  const publishBusy = actionDisplayOverrides.publishBusy || false;
  const canPublishNow = actionDisplayOverrides.canPublishNow ?? publishReadiness.canPublishNow;
  const publishAdvancedOpen = actionDisplayOverrides.publishAdvancedOpen || false;
  return {
    publishActionDisplayState: {
      canPublishNow,
      displayMode,
      publishAdvancedOpen,
      publishBusy,
      publishButtonDisabled: publishBusy || !canPublishNow,
      publishButtonLabel: displayMode === 'normal' ? 'Deploy Session' : 'Publish',
      settingsButtonActive: publishAdvancedOpen,
      ...actionDisplayOverrides,
    },
    publishExecutionPlan: {
      shouldAutoDeployWorker: false,
      shouldDeployPendingSbts: false,
      shouldRegisterSession: true,
      shouldUploadMetadata: false,
      stepNumbers: {},
      steps: [],
      ...(overrides.publishExecutionPlan || {}),
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
      ...(overrides.publishMetadataDisplayState || {}),
    },
    publishProgressDisplayState: {
      activePublishProgressStepLabel: '',
      publishProgressAriaValueText: '0% Preparing',
      publishProgressEyebrow: 'Publish Complete',
      publishStep: 0,
      publishProgressPercent: 0,
      publishProgressPercentRounded: 0,
      publishProgressSteps: [],
      showPublishProgress: false,
      ...(overrides.publishProgressDisplayState || {}),
    },
    publishReadiness,
  };
};

const buildProps = (
  overrides: Partial<React.ComponentProps<typeof SessionPublishSummary>> = {},
): React.ComponentProps<typeof SessionPublishSummary> => ({
  isCollapsed: false,
  onToggleCollapsed: jest.fn(),
  normalModePublishSummary: [],
  onPublish: jest.fn(),
  onTogglePublishAdvanced: jest.fn(),
  showSponsoredBundleFallbackInput: false,
  normalModeBundleUrlOverride: '',
  onNormalModeBundleUrlOverrideChange: jest.fn(),
  normalModeBundleUrlOverrideValidationError: '',
  manualBundleUrlOverrideHelp: '',
  bundleFileInputRef: createRef<HTMLInputElement>(),
  onBundleFileChange: jest.fn(),
  onClearBundleFile: jest.fn(),
  bundleFile: null,
  localWorkerBundleFallbackFilePath: '',
  sponsoredManualBundleRetryMessage: '',
  publishUiPlan: buildPublishUiPlan(),
  publishSettingsCapabilities: resolvePresetPublishSettings(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
  renderInfoTooltip: () => null,
  resolvedWorkerBaseUrl: '',
  workerUrlSource: 'manual',
  manualMetadataUrl: '',
  onManualMetadataUrlChange: jest.fn(),
  manualGasLimit: '',
  onManualGasLimitChange: jest.fn(),
  manualGasPriceGwei: '',
  onManualGasPriceGweiChange: jest.fn(),
  manualMaxFeePerGasGwei: '',
  onManualMaxFeePerGasGweiChange: jest.fn(),
  manualMaxPriorityFeePerGasGwei: '',
  onManualMaxPriorityFeePerGasGweiChange: jest.fn(),
  registerTxs: [],
  registerExplorerBaseUrl: '',
  sessionUrl: '',
  adminUrl: '',
  publishedPendingSbtLinks: [],
  onCopyAdminUrl: jest.fn(),
  adminUrlStatus: '',
  status: '',
  ...overrides,
});

describe('SessionPublishSummary', () => {
  it('keeps the normal-mode publish button wired while preserving loading and disabled states', () => {
    const onPublish = jest.fn();
    const { rerender } = render(
      <SessionPublishSummary
        {...buildProps({
          normalModePublishSummary: [{ label: 'Session', value: 'Ready' }],
          onPublish,
          publishUiPlan: buildPublishUiPlan({
            publishActionDisplayState: {
              displayMode: 'normal',
              publishButtonLabel: 'Deploy Session',
            },
          }),
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Deploy Session/i }));
    expect(onPublish).toHaveBeenCalledTimes(1);

    rerender(
      <SessionPublishSummary
        {...buildProps({
          normalModePublishSummary: [{ label: 'Session', value: 'Ready' }],
          onPublish,
          publishUiPlan: buildPublishUiPlan({
            publishActionDisplayState: {
              displayMode: 'normal',
              publishBusy: true,
              publishButtonDisabled: true,
              publishButtonLabel: 'Deploy Session',
            },
          }),
        })}
      />,
    );

    expect(screen.getByRole('button', { name: /Publishing/i })).toBeDisabled();
  });

  it('blocks advanced publish with the upload reason only when no metadata fallback exists', () => {
    const { rerender } = render(
      <SessionPublishSummary
        {...buildProps({
          publishUiPlan: buildPublishUiPlan({
            publishReadiness: {
              canPublishNow: false,
              readinessKind: 'blocked',
              showUploadBlockedReason: true,
              uploadBlockedReason: 'Set a worker URL before uploading metadata.',
            },
          }),
        })}
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH)).toBeDisabled();
    expect(screen.getByText('Set a worker URL before uploading metadata.')).toBeInTheDocument();

    rerender(
      <SessionPublishSummary
        {...buildProps({
          publishUiPlan: buildPublishUiPlan({
            publishReadiness: {
              canPublishNow: false,
              readinessKind: 'blocked',
              showUploadBlockedReason: false,
              uploadBlockedReason: 'Set a worker URL before uploading metadata.',
            },
          }),
        })}
      />,
    );

    expect(screen.queryByText('Set a worker URL before uploading metadata.')).not.toBeInTheDocument();
  });

  it('renders publish progress with the active step and progressbar contract', () => {
    render(
      <SessionPublishSummary
        {...buildProps({
          publishUiPlan: buildPublishUiPlan({
            publishProgressDisplayState: {
              activePublishProgressStepLabel: 'Upload Arweave',
              publishProgressAriaValueText: '42% Upload Arweave',
              publishProgressEyebrow: 'Publishing Session',
              publishStep: 2,
              publishProgressPercent: 42.4,
              publishProgressPercentRounded: 42,
              publishProgressSteps: [
                { key: 'deploy-worker', label: 'Deploy Worker', state: 'complete' },
                { key: 'upload-metadata', label: 'Upload Arweave', state: 'active' },
                { key: 'register-session', label: 'Register On-chain', state: 'pending' },
              ],
              showPublishProgress: true,
            },
          }),
        })}
      />,
    );

    const progressCard = screen.getByTestId('ce-wizard-publish-progress');

    expect(progressCard).toBeInTheDocument();
    expect(screen.getByText('Publishing Session')).toBeInTheDocument();
    expect(within(progressCard).getAllByText('Upload Arweave')).toHaveLength(2);
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '42% Upload Arweave');
  });

  it('renders completed publish status, uploaded metadata fallback, and result links without publishing', () => {
    const onCopyAdminUrl = jest.fn();
    const onPublish = jest.fn();

    render(
      <SessionPublishSummary
        {...buildProps({
          adminUrl: 'https://context.example.test/admin/readiness-session',
          adminUrlStatus: 'Admin URL copied.',
          onCopyAdminUrl,
          onPublish,
          publishUiPlan: buildPublishUiPlan({
            publishMetadataDisplayState: {
              effectiveMetadataGatewayUrl: 'https://arweave.example.test/metadata-tx',
              effectiveMetadataTxId: 'metadata-tx',
              manualMetadataDisplayUri: '',
              metadataUri: 'ar://metadata-tx',
              metadataUriLabel: 'Metadata URI',
              showArweaveTx: true,
              showManualMetadataUri: false,
              showMetadataUri: true,
            },
            publishProgressDisplayState: {
              activePublishProgressStepLabel: 'Done',
              publishProgressAriaValueText: '100% Done',
              publishProgressEyebrow: 'Publish Complete',
              publishStep: 3,
              publishProgressPercent: 100,
              publishProgressPercentRounded: 100,
              publishProgressSteps: [
                { key: 'upload-metadata', label: 'Upload Arweave', state: 'complete' },
                { key: 'register-session', label: 'Register On-chain', state: 'complete' },
                { key: 'done', label: 'Done', state: 'complete' },
              ],
              showPublishProgress: true,
            },
          }),
          registerExplorerBaseUrl: 'https://optimism-sepolia.blockscout.com',
          registerTxs: [
            { action: 'createSession', hash: '0xregister1' },
            { action: 'setSessionFields', hash: '0xregister2' },
          ],
          sessionUrl: 'https://context.example.test/session/readiness-session',
          status: 'Published session readiness-session.',
        })}
      />,
    );

    const progressCard = screen.getByTestId('ce-wizard-publish-progress');
    expect(progressCard).toHaveTextContent('Publish Complete');
    expect(progressCard).toHaveTextContent('Done');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Metadata URI:')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_URI)).toHaveTextContent('ar://metadata-tx');
    expect(screen.queryByText('Uploaded metadata URI:')).not.toBeInTheDocument();
    expect(screen.getByText('Arweave tx:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://arweave.example.test/metadata-tx' })).toHaveAttribute(
      'href',
      'https://arweave.example.test/metadata-tx',
    );
    expect(screen.getByText('Register txs:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('createSession:')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'https://optimism-sepolia.blockscout.com/tx/0xregister1',
      }),
    ).toHaveAttribute('href', 'https://optimism-sepolia.blockscout.com/tx/0xregister1');
    expect(screen.getByText('setSessionFields:')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'https://optimism-sepolia.blockscout.com/tx/0xregister2',
      }),
    ).toHaveAttribute('href', 'https://optimism-sepolia.blockscout.com/tx/0xregister2');
    expect(
      screen.getByRole('link', {
        name: 'https://context.example.test/session/readiness-session',
      }),
    ).toHaveAttribute('href', 'https://context.example.test/session/readiness-session');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_ADMIN_URL)).toHaveAttribute(
      'href',
      'https://context.example.test/admin/readiness-session',
    );
    expect(screen.getByText('Admin URL copied.')).toBeInTheDocument();
    expect(screen.getByText('Published session readiness-session.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Copy/i }));

    expect(onCopyAdminUrl).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('keeps the advanced settings toggle inert from publish execution', () => {
    const onPublish = jest.fn();
    const onTogglePublishAdvanced = jest.fn();
    render(
      <SessionPublishSummary
        {...buildProps({
          onPublish,
          onTogglePublishAdvanced,
        })}
      />,
    );

    const settingsButton = screen.getByRole('button', { name: 'Advanced publish settings' });
    expect(settingsButton).toBeInTheDocument();
    fireEvent.click(settingsButton);

    expect(onTogglePublishAdvanced).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('keeps decentralized Arweave and gas controls visible without publishing', () => {
    const onManualMetadataUrlChange = jest.fn();
    const onPublish = jest.fn();

    render(
      <SessionPublishSummary
        {...buildProps({
          onManualMetadataUrlChange,
          onPublish,
          resolvedWorkerBaseUrl: 'https://worker.example.test',
          publishUiPlan: buildPublishUiPlan({
            publishActionDisplayState: {
              publishAdvancedOpen: true,
              settingsButtonActive: true,
            },
          }),
          workerUrlSource: 'custom worker URL',
        })}
      />,
    );

    expect(
      screen.getByText('Arweave upload worker: https://worker.example.test (custom worker URL)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Gas limit override')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('ar://<txId> or https://arweave.net/<txId>'), {
      target: { value: 'ar://metadata-tx' },
    });

    expect(onManualMetadataUrlChange).toHaveBeenCalledWith('ar://metadata-tx');
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('keeps worker-canonical publish settings free of Arweave and gas controls', () => {
    render(
      <SessionPublishSummary
        {...buildProps({
          publishSettingsCapabilities: resolvePresetPublishSettings(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          publishUiPlan: buildPublishUiPlan({
            publishActionDisplayState: {
              publishAdvancedOpen: true,
              settingsButtonActive: true,
            },
          }),
        })}
      />,
    );

    expect(screen.queryByText(/Arweave upload worker:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Manual metadata URI (optional)')).not.toBeInTheDocument();
    expect(screen.queryByText('Gas limit override')).not.toBeInTheDocument();
    expect(screen.queryByText('Gas price override (gwei, legacy)')).not.toBeInTheDocument();
    expect(screen.queryByText('Max fee per gas (gwei)')).not.toBeInTheDocument();
    expect(screen.queryByText('Max priority fee per gas (gwei)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Advanced publish settings' })).not.toBeInTheDocument();
  });

  it('keeps manual metadata and gas controls callback-only while showing active metadata sources', () => {
    const onManualGasLimitChange = jest.fn();
    const onManualGasPriceGweiChange = jest.fn();
    const onManualMaxFeePerGasGweiChange = jest.fn();
    const onManualMaxPriorityFeePerGasGweiChange = jest.fn();
    const onPublish = jest.fn();

    render(
      <SessionPublishSummary
        {...buildProps({
          manualGasLimit: '900000',
          manualGasPriceGwei: '',
          manualMaxFeePerGasGwei: '',
          manualMaxPriorityFeePerGasGwei: '',
          manualMetadataUrl: 'ar://manual-tx',
          onManualGasLimitChange,
          onManualGasPriceGweiChange,
          onManualMaxFeePerGasGweiChange,
          onManualMaxPriorityFeePerGasGweiChange,
          onPublish,
          publishUiPlan: buildPublishUiPlan({
            publishActionDisplayState: {
              publishAdvancedOpen: true,
              settingsButtonActive: true,
            },
            publishMetadataDisplayState: {
              effectiveMetadataGatewayUrl: '',
              effectiveMetadataTxId: '',
              manualMetadataDisplayUri: 'normalized:ar://manual-tx',
              metadataUri: 'ar://uploaded-tx',
              metadataUriLabel: 'Uploaded metadata URI',
              showArweaveTx: false,
              showManualMetadataUri: true,
              showMetadataUri: true,
            },
          }),
        })}
      />,
    );

    expect(screen.getByText('Uploaded metadata URI:')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_URI)).toHaveTextContent('ar://uploaded-tx');
    expect(screen.getByText('Manual metadata URI:')).toBeInTheDocument();
    expect(screen.getByText('normalized:ar://manual-tx')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('1000000'), {
      target: { value: '1200000' },
    });
    const blankGasInputs = screen.getAllByPlaceholderText('(leave blank)');
    fireEvent.change(blankGasInputs[0], { target: { value: '1.5' } });
    fireEvent.change(blankGasInputs[1], { target: { value: '2.5' } });
    fireEvent.change(blankGasInputs[2], { target: { value: '0.5' } });

    expect(onManualGasLimitChange).toHaveBeenCalledWith('1200000');
    expect(onManualGasPriceGweiChange).toHaveBeenCalledWith('1.5');
    expect(onManualMaxFeePerGasGweiChange).toHaveBeenCalledWith('2.5');
    expect(onManualMaxPriorityFeePerGasGweiChange).toHaveBeenCalledWith('0.5');
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('renders published inline SBT links with human-readable labels', () => {
    const firstHref = buildSbtDetailPath('0x00000000000000000000000000000000000000a1', 'writers');
    const secondHref = buildSbtDetailPath('0x00000000000000000000000000000000000000a2', 'writers');
    render(
      <SessionPublishSummary
        {...buildProps({
          publishedPendingSbtLinks: [
            {
              address: '0x00000000000000000000000000000000000000a1',
              label: 'Writers Group',
              href: firstHref,
            },
            {
              address: '0x00000000000000000000000000000000000000a2',
              label: '0x00000000000000000000000000000000000000a2',
              href: secondHref,
            },
          ],
        })}
      />,
    );

    expect(screen.getAllByTestId('ce-wizard-published-sbt-link')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Writers Group' })).toHaveAttribute('href', firstHref);
    expect(screen.getByRole('link', { name: '0x00000000000000000000000000000000000000a2' })).toHaveAttribute(
      'href',
      secondHref,
    );
  });

  it('omits published inline SBT rows when no SBTs were created during publish', () => {
    render(<SessionPublishSummary {...buildProps()} />);

    expect(screen.queryByTestId('ce-wizard-published-sbt-link')).not.toBeInTheDocument();
  });
});
