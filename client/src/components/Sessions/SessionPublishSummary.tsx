import React from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretUp,
  faCheck,
  faCog,
  faCopy,
  faExclamationCircle,
  faSpinner,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
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
  publishStep: number;
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
  publishStep,
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
  const {
    activePublishProgressStepLabel,
    publishProgressPercent,
    publishProgressPercentRounded,
    publishProgressSteps,
    showPublishProgress,
  } = publishProgressDisplayState;

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

        {showPublishProgress ? (
          <div className={styles.publishProgressCard} data-testid="ce-wizard-publish-progress">
            <div className={styles.publishProgressHeader}>
              <div className={styles.publishProgressCopy}>
                <span className={styles.publishProgressEyebrow}>
                  {publishBusy ? 'Publishing Session' : 'Publish Complete'}
                </span>
                <strong className={styles.publishProgressStage}>
                  {activePublishProgressStepLabel || 'Preparing'}
                </strong>
              </div>
              <span className={styles.publishProgressPercent}>{publishProgressPercentRounded}%</span>
            </div>
            <div
              className={styles.publishProgressBar}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={publishProgressPercentRounded}
              aria-valuetext={`${publishProgressPercentRounded}% ${activePublishProgressStepLabel || 'Preparing'}`}
            >
              <div
                className={styles.publishProgressFill}
                style={{ width: `${publishProgressPercent}%` }}
              />
            </div>
            <div className={styles.progressIndicator}>
              {publishProgressSteps.map((step, index) => {
                const stepNumber = index + 1;
                const isActive = publishStep === stepNumber && (publishBusy || step.key !== 'done');
                const isComplete = publishStep > stepNumber || (step.key === 'done' && publishStep >= stepNumber);
                return (
                  <div
                    key={step.key}
                    className={`${publishStep >= stepNumber ? styles.stepCompleted : styles.step} ${isActive ? styles.stepActive : ''}`}
                  >
                    <FontAwesomeIcon
                      icon={isActive ? faSpinner : isComplete ? faCheck : faExclamationCircle}
                      spin={isActive}
                    />
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

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

        {publishMetadataDisplayState.showMetadataUri ? (
          <div className={styles.linkRow}>
            <span className={styles.linkLabel}>{publishMetadataDisplayState.metadataUriLabel}:</span>
            <span data-testid={E2E_TESTIDS.WIZARD_METADATA_URI}>{publishMetadataDisplayState.metadataUri}</span>
          </div>
        ) : null}
        {publishMetadataDisplayState.showManualMetadataUri ? (
          <div className={styles.linkRow}>
            <span className={styles.linkLabel}>Manual metadata URI:</span>
            <span>{publishMetadataDisplayState.manualMetadataDisplayUri}</span>
          </div>
        ) : null}
        {publishMetadataDisplayState.showArweaveTx ? (
          <div className={styles.linkRow}>
            <span className={styles.linkLabel}>Arweave tx:</span>
            <a href={publishMetadataDisplayState.effectiveMetadataGatewayUrl} target="_blank" rel="noopener noreferrer">
              {publishMetadataDisplayState.effectiveMetadataGatewayUrl}
            </a>
          </div>
        ) : null}
        {registerTxs.length > 0 ? (
          <div>
            <div className={styles.linkRow}>
              <span className={styles.linkLabel}>Register txs:</span>
              <span>{registerTxs.length}</span>
            </div>
            {registerTxs.map((entry) => {
              const txUrl = registerExplorerBaseUrl
                ? `${registerExplorerBaseUrl}/tx/${entry.hash}`
                : '';
              return (
                <div
                  key={entry.hash}
                  className={styles.linkRow}
                  data-testid={E2E_TESTIDS.WIZARD_REGISTER_TX}
                  data-ce-tx-hash={entry.hash}
                  data-ce-tx-action={entry.action}
                >
                  <span className={styles.linkLabel}>{entry.action}:</span>
                  {txUrl ? (
                    <a href={txUrl} target="_blank" rel="noopener noreferrer">{txUrl}</a>
                  ) : (
                    <span>{entry.hash}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
        {sessionUrl ? (
          <div className={styles.linkRow}>
            <span className={styles.linkLabel}>Session URL:</span>
            <a href={sessionUrl} target="_blank" rel="noopener noreferrer">{sessionUrl}</a>
          </div>
        ) : null}
        {adminUrl ? (
          <div className={styles.linkRow}>
            <span className={styles.linkLabel}>Admin URL:</span>
            <a href={adminUrl} target="_blank" rel="noopener noreferrer" data-testid={E2E_TESTIDS.WIZARD_ADMIN_URL}>{adminUrl}</a>
            <Button type="button" size="sm" className={styles.actionButton} onClick={onCopyAdminUrl}>
              <FontAwesomeIcon icon={faCopy} /> Copy
            </Button>
          </div>
        ) : null}
        {publishedPendingSbtLinks.map((entry) => (
          <div
            key={entry.address}
            className={styles.linkRow}
            data-testid="ce-wizard-published-sbt-link"
            data-ce-sbt-address={entry.address}
          >
            <span className={styles.linkLabel}>SBT:</span>
            <a href={entry.href} target="_blank" rel="noopener noreferrer">{entry.label}</a>
          </div>
        ))}
        {adminUrlStatus ? <div className={styles.copyStatus}>{adminUrlStatus}</div> : null}
        {status ? <div className={styles.statusNote}>{status}</div> : null}
      </div>
    ) : null}
  </section>
  );
};

export default SessionPublishSummary;
