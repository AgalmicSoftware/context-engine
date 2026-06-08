import React from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretUp,
} from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import SessionPublishAdvancedSettingsPanel from './SessionPublishAdvancedSettingsPanel';
import SessionPublishActionControls from './SessionPublishActionControls';
import SessionPublishProgressPanel from './SessionPublishProgressPanel';
import SessionPublishResultLinks from './SessionPublishResultLinks';
import type { SessionWizardPublishUiPlan } from './sessionWizardPublishReadiness';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

type PublishSummaryItem = {
  label: string;
  value: React.ReactNode;
};

type RegisterTxEntry = {
  hash: string;
  action: string;
};

type PublishedPendingSbtLink = {
  address: string;
  label: string;
  href: string;
};

type SessionPublishSummaryProps = {
  isNormalMode: boolean;
  wizardMode: string;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  normalModePublishSummary: PublishSummaryItem[];
  onPublish: () => void;
  publishBusy: boolean;
  publishAdvancedOpen: boolean;
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
  onCopyAdminUrl: () => void;
  adminUrlStatus: string;
  status: string;
};

const SessionPublishSummary = ({
  isNormalMode,
  wizardMode,
  isCollapsed,
  onToggleCollapsed,
  normalModePublishSummary,
  onPublish,
  publishBusy,
  publishAdvancedOpen,
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
  onCopyAdminUrl,
  adminUrlStatus,
  status,
}: SessionPublishSummaryProps) => {
  const {
    publishMetadataDisplayState,
    publishProgressDisplayState,
    publishReadiness,
  } = publishUiPlan;
  const {
    canPublishNow,
    showUploadBlockedReason,
    uploadBlockedReason,
  } = publishReadiness;

  return (
  <section id="session-wizard-section-publish" className={styles.panel}>
    {wizardMode === 'advanced' ? (
      <button type="button" className={styles.panelHeader} onClick={onToggleCollapsed}>
        <span className={styles.panelTitle}>Publish</span>
        <FontAwesomeIcon icon={isCollapsed ? faCaretDown : faCaretUp} />
      </button>
    ) : null}
    {(isNormalMode || !isCollapsed) ? (
      <div className={styles.panelBody}>
        {isNormalMode ? (
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
              canPublishNow={canPublishNow}
              isNormalMode
              onPublish={onPublish}
              onTogglePublishAdvanced={onTogglePublishAdvanced}
              publishAdvancedOpen={publishAdvancedOpen}
              publishBusy={publishBusy}
            />
          </div>
        ) : (
          <SessionPublishActionControls
            canPublishNow={canPublishNow}
            isNormalMode={false}
            onPublish={onPublish}
            onTogglePublishAdvanced={onTogglePublishAdvanced}
            publishAdvancedOpen={publishAdvancedOpen}
            publishBusy={publishBusy}
          />
        )}

        {showSponsoredBundleFallbackInput ? (
          <>
            <FormGroup className={styles.fieldGroup}>
              <Label>Manual bundle URL override (optional)</Label>
              <Input
                type="url"
                value={normalModeBundleUrlOverride}
                placeholder="https://github.com/<org>/<repo>/releases/download/<tag>/sessionCorsWorker.bundle.js"
                data-testid={E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE}
                invalid={!!normalModeBundleUrlOverrideValidationError}
                onChange={(e) => onNormalModeBundleUrlOverrideChange(e.target.value)}
              />
              <div className={styles.helperText}>
                {manualBundleUrlOverrideHelp}
              </div>
              {normalModeBundleUrlOverrideValidationError ? (
                <div className={styles.errorText}>{normalModeBundleUrlOverrideValidationError}</div>
              ) : null}
            </FormGroup>
            <FormGroup className={styles.fieldGroup}>
              <Label>Worker bundle fallback (optional)</Label>
              <div className={styles.bundleFileInputRow}>
                <Input
                  type="file"
                  accept=".js,.mjs,.txt"
                  innerRef={bundleFileInputRef}
                  data-testid={E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT}
                  onChange={(e) => {
                    const file = e.target.files && e.target.files[0];
                    onBundleFileChange(file || null);
                  }}
                />
                <Button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={onClearBundleFile}
                  data-testid={E2E_TESTIDS.WIZARD_CLEAR_BUNDLE_FILE_PUBLISH}
                  disabled={!bundleFile}
                >
                  Clear bundle file
                </Button>
              </div>
              <div className={styles.helperText}>
                {sponsoredManualBundleRetryMessage}
              </div>
              {bundleFile ? (
                <div className={styles.helperText}>
                  Using {bundleFile.name || localWorkerBundleFallbackFilePath} for this publish.
                </div>
              ) : null}
            </FormGroup>
          </>
        ) : null}

        <SessionPublishProgressPanel
          progressDisplayState={publishProgressDisplayState}
          publishBusy={publishBusy}
        />

        {showUploadBlockedReason ? (
          <div className={styles.statusNote}>
            {uploadBlockedReason}
          </div>
        ) : null}

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
