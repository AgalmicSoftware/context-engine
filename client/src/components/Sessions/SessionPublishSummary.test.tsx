import React, { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import SessionPublishSummary from './SessionPublishSummary';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';

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
