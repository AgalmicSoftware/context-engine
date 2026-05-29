import React, { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SessionPublishSummary from './SessionPublishSummary';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const buildProps = (
  overrides: Partial<React.ComponentProps<typeof SessionPublishSummary>> = {}
): React.ComponentProps<typeof SessionPublishSummary> => ({
  isNormalMode: false,
  wizardMode: 'advanced',
  isCollapsed: false,
  onToggleCollapsed: jest.fn(),
  normalModePublishSummary: [],
  onPublish: jest.fn(),
  publishBusy: false,
  canPublishNow: true,
  publishAdvancedOpen: false,
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
  showPublishProgress: false,
  activePublishProgressStepLabel: '',
  publishProgressPercent: 0,
  publishProgressPercentRounded: 0,
  publishStep: 0,
  publishProgressSteps: [],
  uploadBlockedReason: '',
  hasManualMetadata: false,
  hasUploadedMetadata: false,
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
  metadataUrl: '',
  effectiveMetadataTxId: '',
  effectiveMetadataGatewayUrl: '',
  registerTxs: [],
  registerExplorerBaseUrl: '',
  sessionUrl: '',
  adminUrl: '',
  publishedPendingSbtLinks: [],
  onCopyAdminUrl: jest.fn(),
  adminUrlStatus: '',
  status: '',
  normalizeArweaveUri: (value: string) => value,
  ...overrides,
});

describe('SessionPublishSummary', () => {
  it('keeps the normal-mode publish button wired while preserving loading and disabled states', () => {
    const onPublish = jest.fn();
    const { rerender } = render(
      <SessionPublishSummary
        {...buildProps({
          isNormalMode: true,
          wizardMode: 'normal',
          normalModePublishSummary: [{ label: 'Session', value: 'Ready' }],
          onPublish,
          canPublishNow: true,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Deploy Session/i }));
    expect(onPublish).toHaveBeenCalledTimes(1);

    rerender(
      <SessionPublishSummary
        {...buildProps({
          isNormalMode: true,
          wizardMode: 'normal',
          normalModePublishSummary: [{ label: 'Session', value: 'Ready' }],
          onPublish,
          publishBusy: true,
          canPublishNow: true,
        })}
      />
    );

    expect(screen.getByRole('button', { name: /Publishing/i })).toBeDisabled();
  });

  it('blocks advanced publish with the upload reason only when no metadata fallback exists', () => {
    const { rerender } = render(
      <SessionPublishSummary
        {...buildProps({
          canPublishNow: false,
          uploadBlockedReason: 'Set a worker URL before uploading metadata.',
        })}
      />
    );

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH)).toBeDisabled();
    expect(screen.getByText('Set a worker URL before uploading metadata.')).toBeInTheDocument();

    rerender(
      <SessionPublishSummary
        {...buildProps({
          canPublishNow: false,
          hasManualMetadata: true,
          uploadBlockedReason: 'Set a worker URL before uploading metadata.',
        })}
      />
    );

    expect(screen.queryByText('Set a worker URL before uploading metadata.')).not.toBeInTheDocument();
  });

  it('renders publish progress with the active step and progressbar contract', () => {
    render(
      <SessionPublishSummary
        {...buildProps({
          showPublishProgress: true,
          publishBusy: true,
          activePublishProgressStepLabel: 'Upload Arweave',
          publishProgressPercent: 42.4,
          publishProgressPercentRounded: 42,
          publishStep: 2,
          publishProgressSteps: [
            { key: 'deploy-worker', label: 'Deploy Worker' },
            { key: 'upload-metadata', label: 'Upload Arweave' },
            { key: 'register-session', label: 'Register On-chain' },
          ],
        })}
      />
    );

    const progressCard = screen.getByTestId('ce-wizard-publish-progress');

    expect(progressCard).toBeInTheDocument();
    expect(screen.getByText('Publishing Session')).toBeInTheDocument();
    expect(within(progressCard).getAllByText('Upload Arweave')).toHaveLength(2);
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '42% Upload Arweave');
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
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Advanced publish settings' }));

    expect(onTogglePublishAdvanced).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('renders published inline SBT links with human-readable labels', () => {
    const firstHref = buildSbtDetailPath(
      '0x00000000000000000000000000000000000000a1',
      'writers'
    );
    const secondHref = buildSbtDetailPath(
      '0x00000000000000000000000000000000000000a2',
      'writers'
    );
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
      />
    );

    expect(screen.getAllByTestId('ce-wizard-published-sbt-link')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Writers Group' })).toHaveAttribute('href', firstHref);
    expect(
      screen.getByRole('link', { name: '0x00000000000000000000000000000000000000a2' })
    ).toHaveAttribute('href', secondHref);
  });

  it('omits published inline SBT rows when no SBTs were created during publish', () => {
    render(<SessionPublishSummary {...buildProps()} />);

    expect(screen.queryByTestId('ce-wizard-published-sbt-link')).not.toBeInTheDocument();
  });
});
