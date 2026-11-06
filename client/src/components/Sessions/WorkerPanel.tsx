/** @file WorkerPanel.tsx */
import React from 'react';
import styles from './SessionWizard.module.scss';
import WorkerConnectionSection from './WorkerConnectionSection';
import WorkerDeploySection, { type WorkerDeploySectionProps } from './WorkerDeploySection';
import WorkerSecretsSection from './WorkerSecretsSection';
import { toStr } from '../../utilities/shared/primitives.js';
import type { SessionWizardVerifiedWorkerConnection } from './sessionWizardNativeWorkerVerification';
import type { SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';
import type { SessionWizardRenderField } from './sessionWizardFieldDescriptors';

type DraftState = {
  corsWorkerUrl?: string;
  slug?: string;
};

type DeployForm = {
  workerName?: string;
  bundleUrl?: string;
  apiToken?: string;
  adminAddress?: string;
};

export type WorkerPanelProps = {
  allowNativeWorkerVerification?: boolean;
  agentHttpEnabled?: boolean;
  renderSessionWizardInfoTooltip?: (props: {
    id?: string;
    content?: React.ReactNode;
    placement?: SessionWizardTooltipRenderOptions['placement'];
    testId?: string;
    ariaLabel?: string;
  }) => React.ReactNode;
  workerMode: string;
  draft?: DraftState;
  deployVerifiedInUi?: boolean;
  showUserPaidUsage?: boolean;
  workerSecretsEnabled: boolean;
  setWorkerSecretsEnabled: (value: boolean) => void;
  clearWorkerSecretFields: () => void;
  workerResourceKeys?: string[];
  renderResourceCard?: (resourceKey: string, index: number) => React.ReactNode;
  workerAllowOrigins: string;
  setWorkerAllowOrigins: (value: string) => void;
  workerLimitPerWallet: string;
  setWorkerLimitPerWallet: (value: string) => void;
  workerLimitPerAnonymousIp: string;
  setWorkerLimitPerAnonymousIp: (value: string) => void;
  defaultAllowedOrigins: string;
  shouldUseSponsoredAutoDeployFlow: boolean;
  deployForm?: DeployForm;
  deployHelperToggle?: React.ReactNode;
  shouldShowDeployHelperUrlInput: boolean;
  deployHelperUrl: string;
  setDeployHelperUrl: (value: string) => void;
  normalModeBundleUrl: string;
  normalModeBundleHelpText: string;
  showNormalModeManualBundleControls: boolean;
  normalModeBundleUrlOverride: string;
  setNormalModeBundleUrlOverride: (value: string) => void;
  normalModeBundleUrlOverrideValidationError?: string;
  manualBundleUrlOverrideHelp: string;
  normalModeRetryBundleFileInputRef?: React.Ref<HTMLInputElement>;
  setBundleFile: (file: File | null) => void;
  clearSelectedBundleFile: () => void;
  bundleFile?: File | null;
  normalModeManualBundleHelpText: string;
  localWorkerBundleFallbackFilePath: string;
  account?: string;
  resolvedActiveSessionSlug?: string;
  operatorRecoveryKey?: WorkerDeploySectionProps['operatorRecoveryKey'];
  setOperatorRecoveryKey?: WorkerDeploySectionProps['setOperatorRecoveryKey'];
  showWorkerUrlField: boolean;
  displayedWorkerUrl: string;
  renderField: SessionWizardRenderField;
  workerUrlAutoFilled: boolean;
  sessionModeProfileWorkerControl?: React.ReactNode;
  onNativeWorkerVerified?: (bootstrap: SessionWizardVerifiedWorkerConnection) => void;
  verifyNativeWorker?: WorkerDeploySectionProps['verifyNativeWorker'];
  nativeTemplateSetupIdentity?: WorkerDeploySectionProps['nativeTemplateSetupIdentity'];
  onNativeTemplateSetupGenerated?: WorkerDeploySectionProps['onNativeTemplateSetupGenerated'];
};

const WorkerPanel = ({
  allowNativeWorkerVerification = false,
  agentHttpEnabled = false,
  renderSessionWizardInfoTooltip,
  workerMode,
  draft = {},
  deployVerifiedInUi,
  showUserPaidUsage = false,
  workerSecretsEnabled,
  setWorkerSecretsEnabled,
  clearWorkerSecretFields,
  workerResourceKeys = [],
  renderResourceCard,
  workerAllowOrigins,
  setWorkerAllowOrigins,
  workerLimitPerWallet,
  setWorkerLimitPerWallet,
  workerLimitPerAnonymousIp,
  setWorkerLimitPerAnonymousIp,
  defaultAllowedOrigins,
  shouldUseSponsoredAutoDeployFlow,
  deployForm = {},
  deployHelperToggle,
  shouldShowDeployHelperUrlInput,
  deployHelperUrl,
  setDeployHelperUrl,
  normalModeBundleUrl,
  normalModeBundleHelpText,
  showNormalModeManualBundleControls,
  normalModeBundleUrlOverride,
  setNormalModeBundleUrlOverride,
  normalModeBundleUrlOverrideValidationError,
  manualBundleUrlOverrideHelp,
  normalModeRetryBundleFileInputRef,
  setBundleFile,
  clearSelectedBundleFile,
  bundleFile,
  normalModeManualBundleHelpText,
  localWorkerBundleFallbackFilePath,
  account,
  resolvedActiveSessionSlug,
  operatorRecoveryKey,
  setOperatorRecoveryKey,
  showWorkerUrlField,
  displayedWorkerUrl,
  renderField,
  workerUrlAutoFilled,
  sessionModeProfileWorkerControl = null,
  onNativeWorkerVerified,
  verifyNativeWorker,
  nativeTemplateSetupIdentity,
  onNativeTemplateSetupGenerated,
}: WorkerPanelProps) => {
  const renderInfoTooltip =
    typeof renderSessionWizardInfoTooltip === 'function' ? renderSessionWizardInfoTooltip : () => null;
  const renderResource = typeof renderResourceCard === 'function' ? renderResourceCard : () => null;

  return (
    <section id="session-wizard-section-worker">
      <div className={styles.panelBody}>
        {sessionModeProfileWorkerControl}
        <div className={styles.workerModeRow}>
          <div className={styles.workerModeCopy}>
            <div className={styles.workerModeTitle}>Bring your own worker</div>
            <div className={styles.workerModeSummary}>Deploy your own worker or paste a worker URL you control.</div>
          </div>
        </div>
        <WorkerSecretsSection
          showUserPaidUsage={showUserPaidUsage}
          renderInfoTooltip={renderInfoTooltip}
          workerSecretsEnabled={workerSecretsEnabled}
          setWorkerSecretsEnabled={setWorkerSecretsEnabled}
          clearWorkerSecretFields={clearWorkerSecretFields}
          workerResourceKeys={workerResourceKeys}
          renderResource={renderResource}
          workerAllowOrigins={workerAllowOrigins}
          setWorkerAllowOrigins={setWorkerAllowOrigins}
          workerLimitPerWallet={workerLimitPerWallet}
          setWorkerLimitPerWallet={setWorkerLimitPerWallet}
          workerLimitPerAnonymousIp={workerLimitPerAnonymousIp}
          setWorkerLimitPerAnonymousIp={setWorkerLimitPerAnonymousIp}
          defaultAllowedOrigins={defaultAllowedOrigins}
        />
        <WorkerDeploySection
          agentHttpEnabled={agentHttpEnabled}
          allowNativeWorkerVerification={allowNativeWorkerVerification}
          workerMode={workerMode}
          shouldUseSponsoredAutoDeployFlow={shouldUseSponsoredAutoDeployFlow}
          deployForm={deployForm}
          deployHelperToggle={deployHelperToggle ?? null}
          shouldShowDeployHelperUrlInput={shouldShowDeployHelperUrlInput}
          deployHelperUrl={deployHelperUrl}
          setDeployHelperUrl={setDeployHelperUrl}
          normalModeBundleUrl={normalModeBundleUrl}
          normalModeBundleHelpText={normalModeBundleHelpText}
          showNormalModeManualBundleControls={showNormalModeManualBundleControls}
          normalModeBundleUrlOverride={normalModeBundleUrlOverride}
          setNormalModeBundleUrlOverride={setNormalModeBundleUrlOverride}
          normalModeBundleUrlOverrideValidationError={normalModeBundleUrlOverrideValidationError}
          manualBundleUrlOverrideHelp={manualBundleUrlOverrideHelp}
          normalModeRetryBundleFileInputRef={normalModeRetryBundleFileInputRef}
          setBundleFile={setBundleFile}
          clearSelectedBundleFile={clearSelectedBundleFile}
          bundleFile={bundleFile}
          normalModeManualBundleHelpText={normalModeManualBundleHelpText}
          localWorkerBundleFallbackFilePath={localWorkerBundleFallbackFilePath}
          account={account}
          cloudflareTokenSlug={toStr(draft.slug || resolvedActiveSessionSlug).trim()}
          operatorRecoveryKey={operatorRecoveryKey}
          setOperatorRecoveryKey={setOperatorRecoveryKey}
          deployVerifiedInUi={deployVerifiedInUi}
          displayedWorkerUrl={displayedWorkerUrl}
          onNativeWorkerVerified={onNativeWorkerVerified}
          verifyNativeWorker={verifyNativeWorker}
          nativeTemplateSetupIdentity={nativeTemplateSetupIdentity}
          onNativeTemplateSetupGenerated={onNativeTemplateSetupGenerated}
        />

        <WorkerConnectionSection
          showWorkerUrlField={showWorkerUrlField}
          displayedWorkerUrl={displayedWorkerUrl}
          renderField={renderField}
          workerUrlAutoFilled={workerUrlAutoFilled}
          renderInfoTooltip={renderInfoTooltip}
        />
      </div>
    </section>
  );
};

export default WorkerPanel;
