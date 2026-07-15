/** @file WorkerPanel.tsx */
import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionWizard.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import WorkerConnectionSection from './WorkerConnectionSection';
import WorkerDeploySection from './WorkerDeploySection';
import WorkerSecretsSection from './WorkerSecretsSection';
import { normalizeWorkerUrl as normalizeWorkerAuthUrl } from '../../utilities/worker/workerAuth.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { PUBLIC_GITHUB_BRANCH, PUBLIC_REPO_URL } from '../../variables/publicRepoMetadata.js';
import type { SessionWizardDeployStatusDisplayState } from './sessionWizardDeployErrors';
import type { SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';
import type { SessionWizardRenderField } from './sessionWizardFieldDescriptors';

const SESSION_CORS_WORKER_SOURCE_URL = `${PUBLIC_REPO_URL}/tree/${PUBLIC_GITHUB_BRANCH}/workers/sessionCorsWorker`;
const DEPLOY_HELPER_SOURCE_URL = `${PUBLIC_REPO_URL}/tree/${PUBLIC_GITHUB_BRANCH}/workers/deploy-helper`;
const SESSION_CORS_WORKER_DOCS_URL = `${PUBLIC_REPO_URL}/blob/${PUBLIC_GITHUB_BRANCH}/docs/session-cors-worker.md`;

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
  isNormalMode: boolean;
  t?: (key: string) => string;
  renderSessionWizardInfoTooltip?: (props: {
    id?: string;
    content?: React.ReactNode;
    placement?: SessionWizardTooltipRenderOptions['placement'];
    testId?: string;
    ariaLabel?: string;
  }) => React.ReactNode;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  showSharedWorkerChoice: boolean;
  workerMode: string;
  onWorkerModeChange: (mode: string) => void;
  setWorkerUrlAutoFilled: (value: boolean) => void;
  updateDraftValue: (path: string[], value: string) => void;
  getDefaultWorkerUrl: () => string;
  draft?: DraftState;
  deployWorkerUrl?: string;
  deployComplete: boolean;
  devPersistWorkerSecrets: boolean;
  persistWorkerSecrets: boolean;
  setPersistWorkerSecrets: (value: boolean) => void;
  workerSecretsEnabled: boolean;
  setWorkerSecretsEnabled: (value: boolean) => void;
  clearWorkerSecretFields: () => void;
  effectivePersistWorkerSecrets: boolean;
  workerResourceKeys?: string[];
  renderResourceCard?: (resourceKey: string, index: number) => React.ReactNode;
  workerAllowOrigins: string;
  setWorkerAllowOrigins: (value: string) => void;
  defaultAllowedOrigins: string;
  shouldUseSponsoredAutoDeployFlow: boolean;
  deployForm?: DeployForm;
  deployHelperToggle?: React.ReactNode;
  shouldShowDeployHelperUrlInput: boolean;
  deployHelperUrl: string;
  setDeployHelperUrl: (value: string) => void;
  bundleMode: string;
  setBundleMode: (mode: string) => void;
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
  advancedBundleFileInputRef?: React.Ref<HTMLInputElement>;
  showSponsoredDeployAccessNotice: boolean;
  account?: string;
  resolvedActiveSessionSlug?: string;
  setDeployForm: React.Dispatch<React.SetStateAction<DeployForm>>;
  handleDeployWorker: () => void;
  deployStatusDisplayState: SessionWizardDeployStatusDisplayState;
  showWorkerUrlField: boolean;
  displayedWorkerUrl: string;
  renderField: SessionWizardRenderField;
  workerUrlAutoFilled: boolean;
};

const WorkerPanel = ({
  isNormalMode,
  t,
  renderSessionWizardInfoTooltip,
  isCollapsed,
  onToggleCollapsed,
  showSharedWorkerChoice,
  workerMode,
  onWorkerModeChange,
  setWorkerUrlAutoFilled,
  updateDraftValue,
  getDefaultWorkerUrl,
  draft = {},
  deployWorkerUrl,
  deployComplete,
  devPersistWorkerSecrets,
  persistWorkerSecrets,
  setPersistWorkerSecrets,
  workerSecretsEnabled,
  setWorkerSecretsEnabled,
  clearWorkerSecretFields,
  effectivePersistWorkerSecrets,
  workerResourceKeys = [],
  renderResourceCard,
  workerAllowOrigins,
  setWorkerAllowOrigins,
  defaultAllowedOrigins,
  shouldUseSponsoredAutoDeployFlow,
  deployForm = {},
  deployHelperToggle,
  shouldShowDeployHelperUrlInput,
  deployHelperUrl,
  setDeployHelperUrl,
  bundleMode,
  setBundleMode,
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
  advancedBundleFileInputRef,
  showSponsoredDeployAccessNotice,
  account,
  resolvedActiveSessionSlug,
  setDeployForm,
  handleDeployWorker,
  deployStatusDisplayState,
  showWorkerUrlField,
  displayedWorkerUrl,
  renderField,
  workerUrlAutoFilled,
}: WorkerPanelProps) => {
  const translate = typeof t === 'function' ? t : (key: string) => key;
  const renderInfoTooltip =
    typeof renderSessionWizardInfoTooltip === 'function' ? renderSessionWizardInfoTooltip : () => null;
  const renderResource = typeof renderResourceCard === 'function' ? renderResourceCard : () => null;

  const handleDefaultWorkerModeClick = () => {
    onWorkerModeChange('default');
    setWorkerUrlAutoFilled(false);
    updateDraftValue(['corsWorkerUrl'], getDefaultWorkerUrl());
  };

  const handleCustomWorkerModeClick = () => {
    onWorkerModeChange('custom');
    setWorkerUrlAutoFilled(false);
    const normalizedConfigured = normalizeWorkerAuthUrl(toStr(draft.corsWorkerUrl).trim());
    const normalizedDefault = normalizeWorkerAuthUrl(getDefaultWorkerUrl());
    const normalizedDeployed = normalizeWorkerAuthUrl(toStr(deployWorkerUrl).trim());
    if (!deployComplete) {
      if (normalizedConfigured) updateDraftValue(['corsWorkerUrl'], '');
      return;
    }
    if ((!normalizedConfigured || normalizedConfigured === normalizedDefault) && normalizedDeployed) {
      updateDraftValue(['corsWorkerUrl'], normalizedDeployed);
    }
  };

  return (
    <section id="session-wizard-section-worker" className={styles.panel}>
      <button
        type="button"
        className={styles.panelHeader}
        onClick={onToggleCollapsed}
        data-testid={E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE}
      >
        <span className={styles.panelTitle}>{isNormalMode ? 'Worker Setup' : 'Worker deployment & secrets'}</span>
        <FontAwesomeIcon icon={isCollapsed ? faCaretDown : faCaretUp} />
      </button>
      {!isCollapsed && (
        <div className={styles.panelBody}>
          <div className={styles.workerModeRow}>
            {!showSharedWorkerChoice ? (
              <div className={styles.workerModeCopy}>
                <div className={styles.workerModeTitle}>Bring your own worker</div>
                <div className={styles.workerModeSummary}>
                  Deploy your own worker or paste a worker URL you control. Shared hosted worker support is planned
                  separately.
                </div>
              </div>
            ) : (
              !isNormalMode && (
                <div className={styles.workerModeCopy}>
                  <div className={styles.workerModeTitle}>How should this session run?</div>
                  <div className={styles.workerModeSummary}>
                    {workerMode === 'default' ? 'Shared hosted worker' : 'Custom worker deployment'}
                  </div>
                </div>
              )
            )}
            {showSharedWorkerChoice && (
              <>
                <div className={styles.workerModePills} data-testid={E2E_TESTIDS.WIZARD_WORKER_MODE_TOGGLE}>
                  <button
                    type="button"
                    className={`${styles.workerModePill} ${workerMode === 'default' ? styles.workerModePillActive : ''}`}
                    data-testid={E2E_TESTIDS.WIZARD_WORKER_MODE_BUTTON}
                    data-ce-worker-mode="default"
                    onClick={handleDefaultWorkerModeClick}
                  >
                    Using Default Worker
                  </button>
                  <button
                    type="button"
                    className={`${styles.workerModePill} ${workerMode !== 'default' ? styles.workerModePillActive : ''}`}
                    data-testid={E2E_TESTIDS.WIZARD_WORKER_MODE_BUTTON}
                    data-ce-worker-mode="custom"
                    onClick={handleCustomWorkerModeClick}
                  >
                    Use My Own
                  </button>
                </div>
                {renderInfoTooltip({
                  id: 'gw-worker-mode-tip',
                  content:
                    'Toggle between the shared hosted worker and deploying your own. Using your own requires a free Cloudflare account (or Vercel Edge, AWS Lambda@Edge, Fly.io, Render, Deno Deploy). Deploy as a module worker with Node.js + npm deps.',
                  placement: 'right',
                  testId: 'ce-wizard-worker-tooltip-gw-worker-mode-tip',
                  ariaLabel: 'Worker mode info',
                })}
              </>
            )}
          </div>
          <WorkerSecretsSection
            isNormalMode={isNormalMode}
            translate={translate}
            renderInfoTooltip={renderInfoTooltip}
            devPersistWorkerSecrets={devPersistWorkerSecrets}
            persistWorkerSecrets={persistWorkerSecrets}
            setPersistWorkerSecrets={setPersistWorkerSecrets}
            workerSecretsEnabled={workerSecretsEnabled}
            setWorkerSecretsEnabled={setWorkerSecretsEnabled}
            clearWorkerSecretFields={clearWorkerSecretFields}
            effectivePersistWorkerSecrets={effectivePersistWorkerSecrets}
            workerResourceKeys={workerResourceKeys}
            renderResource={renderResource}
            workerAllowOrigins={workerAllowOrigins}
            setWorkerAllowOrigins={setWorkerAllowOrigins}
            defaultAllowedOrigins={defaultAllowedOrigins}
          />
          <WorkerDeploySection
            isNormalMode={isNormalMode}
            renderInfoTooltip={renderInfoTooltip}
            workerMode={workerMode}
            shouldUseSponsoredAutoDeployFlow={shouldUseSponsoredAutoDeployFlow}
            deployForm={deployForm}
            deployHelperToggle={deployHelperToggle ?? null}
            shouldShowDeployHelperUrlInput={shouldShowDeployHelperUrlInput}
            deployHelperUrl={deployHelperUrl}
            setDeployHelperUrl={setDeployHelperUrl}
            bundleMode={bundleMode}
            setBundleMode={setBundleMode}
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
            advancedBundleFileInputRef={advancedBundleFileInputRef}
            showSponsoredDeployAccessNotice={showSponsoredDeployAccessNotice}
            account={account}
            cloudflareTokenSlug={toStr(draft.slug || resolvedActiveSessionSlug).trim()}
            setDeployForm={setDeployForm}
            handleDeployWorker={handleDeployWorker}
            deployStatusDisplayState={deployStatusDisplayState}
          />

          <WorkerConnectionSection
            showWorkerUrlField={showWorkerUrlField}
            displayedWorkerUrl={displayedWorkerUrl}
            renderField={renderField}
            workerUrlAutoFilled={workerUrlAutoFilled}
            renderInfoTooltip={renderInfoTooltip}
            showSharedWorkerChoice={showSharedWorkerChoice}
            onResetToDefault={() => {
              setWorkerUrlAutoFilled(false);
              updateDraftValue(['corsWorkerUrl'], getDefaultWorkerUrl());
            }}
          />

          {!isNormalMode && (
            <div className={styles.workerIntro}>
              <div className={styles.workerIntroTitle}>Worker Deployment</div>
              <p className={styles.workerIntroCopy}>
                Sessions use a Cloudflare Worker for CORS proxy, AI, and faucet services.
              </p>
              <p className={styles.workerIntroCopy}>
                The default hosted worker is used automatically unless a custom worker URL is configured.
              </p>
              <div className={styles.workerLinks}>
                <a
                  href={SESSION_CORS_WORKER_SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.workerDocLink}
                >
                  Worker source
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
                <a
                  href={DEPLOY_HELPER_SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.workerDocLink}
                >
                  Deploy helper
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
                <a
                  href={SESSION_CORS_WORKER_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.workerDocLink}
                >
                  Worker docs
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default WorkerPanel;
