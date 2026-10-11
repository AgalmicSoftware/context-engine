import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import SessionPublishAdvancedSettingsPanel from './SessionPublishAdvancedSettingsPanel';
import SessionPublishActionControls from './SessionPublishActionControls';
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
  const showPublishSettingsButton =
    publishSettingsCapabilities.showArweaveMetadataControls || publishSettingsCapabilities.showGasOverrideControls;

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
              <dl className={styles.publishSummaryGrid}>
                {normalModePublishSummary.map((item) => (
                  <div key={item.label} className={styles.publishSummaryCard}>
                    <dt className={styles.publishSummaryLabel}>{item.label}</dt>
                    <dd className={styles.publishSummaryValue}>{item.value}</dd>
                  </div>
                ))}
              </dl>
              <SessionPublishActionControls
                displayState={publishActionDisplayState}
                onPublish={onPublish}
                onTogglePublishAdvanced={onTogglePublishAdvanced}
                showSettingsButton={showPublishSettingsButton}
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
              publishSettingsCapabilities={publishSettingsCapabilities}
              renderInfoTooltip={renderInfoTooltip}
              resolvedWorkerBaseUrl={resolvedWorkerBaseUrl}
              workerUrlSource={workerUrlSource}
            />
          ) : null}

          <SessionPublishResultLinks
            adminUrl={adminUrl}
            adminUrlStatus={adminUrlStatus}
            onCreateAnotherSession={onCreateAnotherSession}
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
