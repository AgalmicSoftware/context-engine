import React from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretUp,
  faCog,
  faSpinner,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
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
            <div className={styles.publishActionCluster}>
              <Button
                onClick={onPublish}
                className={styles.publishPrimaryButton}
                data-testid={E2E_TESTIDS.WIZARD_PUBLISH}
                disabled={publishBusy || !canPublishNow}
              >
                {publishBusy ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin /> Publishing…
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faUpload} /> Deploy Session
                  </>
                )}
              </Button>
              <button
                type="button"
                className={`${styles.publishSettingsButton} ${publishAdvancedOpen ? styles.publishSettingsButtonActive : ''}`}
                onClick={onTogglePublishAdvanced}
                title="Advanced publish settings"
                aria-label="Advanced publish settings"
              >
                <FontAwesomeIcon icon={faCog} />
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.publishRow}>
            <Button
              onClick={onPublish}
              className={styles.primaryButton}
              data-testid={E2E_TESTIDS.WIZARD_PUBLISH}
              disabled={publishBusy || !canPublishNow}
            >
              {publishBusy ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Publishing…
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faUpload} /> Publish
                </>
              )}
            </Button>
            <button
              type="button"
              className={`${styles.iconButton} ${publishAdvancedOpen ? styles.iconButtonActive : ''}`}
              onClick={onTogglePublishAdvanced}
              title="Advanced publish settings"
              aria-label="Advanced publish settings"
            >
              <FontAwesomeIcon icon={faCog} />
            </button>
          </div>
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
          <>
            <div className={styles.statusNote}>
              Arweave upload worker: {resolvedWorkerBaseUrl || 'Not set'} ({workerUrlSource})
            </div>
            <FormGroup className={styles.fieldGroup}>
              <Label>Manual metadata URI (optional)</Label>
              <Input
                type="text"
                value={manualMetadataUrl}
                placeholder="ar://<txId> or https://arweave.net/<txId>"
                onChange={(e) => onManualMetadataUrlChange(e.target.value)}
              />
            </FormGroup>
            <FormGroup className={styles.fieldGroup}>
              <Label className={styles.fieldLabelRow}>
                <span>Gas limit override</span>
                {renderInfoTooltip({
                  id: 'gw-tip-gas-limit',
                  content: 'Optional. Observed gas: createSession ~350k, setSessionFields ~275k (gates vary with count).',
                  placement: 'right',
                  testId: 'ce-wizard-worker-tooltip-gw-tip-gas-limit',
                  ariaLabel: 'Gas limit override info',
                })}
              </Label>
              <Input
                type="number"
                value={manualGasLimit}
                placeholder="1000000"
                onChange={(e) => onManualGasLimitChange(e.target.value)}
              />
            </FormGroup>
            <FormGroup className={styles.fieldGroup}>
              <Label className={styles.fieldLabelRow}>
                <span>Gas price override (gwei, legacy)</span>
                {renderInfoTooltip({
                  id: 'gw-tip-gas-price',
                  content: 'Optional. Forces a legacy gas price (type 0). Some wallets may ignore this on EIP-1559 networks.',
                  placement: 'right',
                  testId: 'ce-wizard-worker-tooltip-gw-tip-gas-price',
                  ariaLabel: 'Gas price override info',
                })}
              </Label>
              <Input
                type="number"
                step="any"
                value={manualGasPriceGwei}
                placeholder="(leave blank)"
                onChange={(e) => onManualGasPriceGweiChange(e.target.value)}
              />
            </FormGroup>
            <FormGroup className={styles.fieldGroup}>
              <Label className={styles.fieldLabelRow}>
                <span>Max fee per gas (gwei)</span>
                {renderInfoTooltip({
                  id: 'gw-tip-max-fee',
                  content: 'Optional. EIP-1559 maxFeePerGas override. Use this (and priority fee) to bump a stuck/pending tx when you hit "replacement fee too low". Leave blank to use wallet defaults.',
                  placement: 'right',
                  testId: 'ce-wizard-worker-tooltip-gw-tip-max-fee',
                  ariaLabel: 'Max fee per gas info',
                })}
              </Label>
              <Input
                type="number"
                step="any"
                value={manualMaxFeePerGasGwei}
                placeholder="(leave blank)"
                onChange={(e) => onManualMaxFeePerGasGweiChange(e.target.value)}
              />
            </FormGroup>
            <FormGroup className={styles.fieldGroup}>
              <Label className={styles.fieldLabelRow}>
                <span>Max priority fee per gas (gwei)</span>
                {renderInfoTooltip({
                  id: 'gw-tip-max-priority',
                  content: 'Optional. EIP-1559 maxPriorityFeePerGas override (tip). Leave blank to use wallet defaults.',
                  placement: 'right',
                  testId: 'ce-wizard-worker-tooltip-gw-tip-max-priority',
                  ariaLabel: 'Max priority fee per gas info',
                })}
              </Label>
              <Input
                type="number"
                step="any"
                value={manualMaxPriorityFeePerGasGwei}
                placeholder="(leave blank)"
                onChange={(e) => onManualMaxPriorityFeePerGasGweiChange(e.target.value)}
              />
            </FormGroup>
          </>
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
