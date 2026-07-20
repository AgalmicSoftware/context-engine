import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import SessionPublishAdvancedSettingsPanel from './SessionPublishAdvancedSettingsPanel';
import SessionPublishActionControls from './SessionPublishActionControls';
import SessionPublishBundleFallbackPanel from './SessionPublishBundleFallbackPanel';
import SessionPublishProgressPanel from './SessionPublishProgressPanel';
import SessionPublishResultLinks from './SessionPublishResultLinks';
import type { SessionWizardPublishUiPlan } from './sessionWizardPublishReadiness';
import type { PublishedPendingSbtLink } from './sessionWizardPublishLinks';
import type { SessionWizardModeRequirements } from './sessionWizardModeRequirements';

type PublishSummaryItem = {
  label: string;
  value: React.ReactNode;
};

type RegisterTxEntry = {
  hash: string;
  action: string;
};

export type SessionPublishSummaryProps = {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  normalModePublishSummary: PublishSummaryItem[];
  onPublish: () => void;
  onTogglePublishAdvanced: () => void;
  showSponsoredBundleFallbackInput: boolean;
  normalModeBundleUrlOverride: string;
  onNormalModeBundleUrlOverrideChange: (value: string) => void;
  normalModeBundleUrlOverrideValidationError: string;
  manualBundleUrlOverrideHelp: string;
  bundleFileInputRef: React.RefObject<HTMLInputElement>;
  onBundleFileChange: (file: File | null) => void;
  onClearBundleFile: () => void;
  bundleFile: File | null;
  localWorkerBundleFallbackFilePath: string;
  sponsoredManualBundleRetryMessage: string;
  publishUiPlan: SessionWizardPublishUiPlan;
  publishSettingsCapabilities: SessionWizardModeRequirements['publishSettings'];
  renderInfoTooltip: (options: Record<string, unknown>) => React.ReactNode;
  resolvedWorkerBaseUrl: string;
  workerUrlSource: string;
  manualMetadataUrl: string;
  onManualMetadataUrlChange: (value: string) => void;
  manualGasLimit: string;
  onManualGasLimitChange: (value: string) => void;
  manualGasPriceGwei: string;
  onManualGasPriceGweiChange: (value: string) => void;
  manualMaxFeePerGasGwei: string;
  onManualMaxFeePerGasGweiChange: (value: string) => void;
  manualMaxPriorityFeePerGasGwei: string;
  onManualMaxPriorityFeePerGasGweiChange: (value: string) => void;
  registerTxs: RegisterTxEntry[];
  registerExplorerBaseUrl: string;
  sessionUrl: string;
  adminUrl: string;
  publishedPendingSbtLinks: PublishedPendingSbtLink[];
  onCreateAnotherSession?: () => unknown;
  onCopyAdminUrl: () => void;
  adminUrlStatus: string;
  status: string;
  sessionModeProfilePublishControl?: React.ReactNode;
};

const SessionPublishSummary = ({
  isCollapsed,
  onToggleCollapsed,
  normalModePublishSummary,
  onPublish,
  onTogglePublishAdvanced,
  showSponsoredBundleFallbackInput,
  normalModeBundleUrlOverride,
  onNormalModeBundleUrlOverrideChange,
  normalModeBundleUrlOverrideValidationError,
  manualBundleUrlOverrideHelp,
  bundleFileInputRef,
  onBundleFileChange,
  onClearBundleFile,
  bundleFile,
  localWorkerBundleFallbackFilePath,
  sponsoredManualBundleRetryMessage,
  publishUiPlan,
  publishSettingsCapabilities,
  renderInfoTooltip,
  resolvedWorkerBaseUrl,
  workerUrlSource,
  manualMetadataUrl,
  onManualMetadataUrlChange,
  manualGasLimit,
  onManualGasLimitChange,
  manualGasPriceGwei,
  onManualGasPriceGweiChange,
  manualMaxFeePerGasGwei,
  onManualMaxFeePerGasGweiChange,
  manualMaxPriorityFeePerGasGwei,
  onManualMaxPriorityFeePerGasGweiChange,
  registerTxs,
  registerExplorerBaseUrl,
  sessionUrl,
  adminUrl,
  publishedPendingSbtLinks,
  onCreateAnotherSession,
  onCopyAdminUrl,
  adminUrlStatus,
  status,
  sessionModeProfilePublishControl = null,
}: SessionPublishSummaryProps) => {
  const { publishActionDisplayState, publishMetadataDisplayState, publishProgressDisplayState, publishReadiness } =
    publishUiPlan;
  const { displayMode, publishAdvancedOpen } = publishActionDisplayState;
  const isNormalDisplayMode = displayMode === 'normal';
  const { showUploadBlockedReason, uploadBlockedReason } = publishReadiness;

  return (
    <section id="session-wizard-section-publish" className={styles.panel}>
      {displayMode === 'advanced' ? (
        <button type="button" className={styles.panelHeader} onClick={onToggleCollapsed}>
          <span className={styles.panelTitle}>Publish</span>
          <FontAwesomeIcon icon={isCollapsed ? faCaretDown : faCaretUp} />
        </button>
      ) : null}
      {isNormalDisplayMode || !isCollapsed ? (
        <div className={styles.panelBody}>
          {sessionModeProfilePublishControl}
          {isNormalDisplayMode ? (
            <div className={styles.publishHero}>
              <div className={styles.publishSummaryGrid}>
                {normalModePublishSummary.map((item) => (
                  <div key={item.label} className={styles.publishSummaryCard}>
                    <span className={styles.publishSummaryLabel}>{item.label}</span>
                    <span className={styles.publishSummaryValue}>{item.value}</span>
                  </div>
                ))}
              </div>
              <SessionPublishActionControls
                displayState={publishActionDisplayState}
                onPublish={onPublish}
                onTogglePublishAdvanced={onTogglePublishAdvanced}
              />
            </div>
          ) : (
            <SessionPublishActionControls
              displayState={publishActionDisplayState}
              onPublish={onPublish}
              onTogglePublishAdvanced={onTogglePublishAdvanced}
              showSettingsButton={showPublishSettingsButton}
            />
          )}

          {showSponsoredBundleFallbackInput ? (
            <SessionPublishBundleFallbackPanel
              bundleFile={bundleFile}
              bundleFileInputRef={bundleFileInputRef}
              localWorkerBundleFallbackFilePath={localWorkerBundleFallbackFilePath}
              manualBundleUrlOverrideHelp={manualBundleUrlOverrideHelp}
              normalModeBundleUrlOverride={normalModeBundleUrlOverride}
              normalModeBundleUrlOverrideValidationError={normalModeBundleUrlOverrideValidationError}
              onBundleFileChange={onBundleFileChange}
              onClearBundleFile={onClearBundleFile}
              onNormalModeBundleUrlOverrideChange={onNormalModeBundleUrlOverrideChange}
              sponsoredManualBundleRetryMessage={sponsoredManualBundleRetryMessage}
            />
          ) : null}

          <SessionPublishProgressPanel progressDisplayState={publishProgressDisplayState} />

          {showUploadBlockedReason ? <div className={styles.statusNote}>{uploadBlockedReason}</div> : null}

          {publishAdvancedOpen ? (
            <SessionPublishAdvancedSettingsPanel
              manualGasLimit={manualGasLimit}
              manualGasPriceGwei={manualGasPriceGwei}
              manualMaxFeePerGasGwei={manualMaxFeePerGasGwei}
              manualMaxPriorityFeePerGasGwei={manualMaxPriorityFeePerGasGwei}
              manualMetadataUrl={manualMetadataUrl}
              onManualGasLimitChange={onManualGasLimitChange}
              onManualGasPriceGweiChange={onManualGasPriceGweiChange}
              onManualMaxFeePerGasGweiChange={onManualMaxFeePerGasGweiChange}
              onManualMaxPriorityFeePerGasGweiChange={onManualMaxPriorityFeePerGasGweiChange}
              onManualMetadataUrlChange={onManualMetadataUrlChange}
              renderInfoTooltip={renderInfoTooltip}
              resolvedWorkerBaseUrl={resolvedWorkerBaseUrl}
              workerUrlSource={workerUrlSource}
            />
          ) : null}

          <SessionPublishResultLinks
            adminUrl={adminUrl}
            adminUrlStatus={adminUrlStatus}
            onCopyAdminUrl={onCopyAdminUrl}
            publishMetadataDisplayState={publishMetadataDisplayState}
            publishedPendingSbtLinks={publishedPendingSbtLinks}
            registerExplorerBaseUrl={registerExplorerBaseUrl}
            registerTxs={registerTxs}
            sessionUrl={sessionUrl}
            status={status}
          />
        </div>
      ) : null}
    </section>
  );
};

export default SessionPublishSummary;
