/** @file WorkerDeploySection.tsx */
import React from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import styles from './SessionWizard.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildCloudflareTokenTemplateUrl } from './cloudflareTokenTemplate.js';
import type { SessionWizardDeployStatusDisplayState } from './sessionWizardDeployErrors';
import type { SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';

type RenderInfoTooltip = (props: {
  id?: string;
  content?: React.ReactNode;
  placement?: SessionWizardTooltipRenderOptions['placement'];
  testId?: string;
  ariaLabel?: string;
}) => React.ReactNode;

type DeployForm = {
  workerName?: string;
  bundleUrl?: string;
  apiToken?: string;
  accountId?: string;
  adminAddress?: string;
};

export type WorkerDeploySectionProps = {
  isNormalMode: boolean;
  renderInfoTooltip?: RenderInfoTooltip;
  workerMode: string;
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
  cloudflareTokenSlug?: string;
  setDeployForm: React.Dispatch<React.SetStateAction<DeployForm>>;
  handleDeployWorker: () => void;
  deployStatusDisplayState: SessionWizardDeployStatusDisplayState;
};

const WorkerDeploySection = ({
  isNormalMode,
  renderInfoTooltip,
  workerMode,
  shouldUseSponsoredAutoDeployFlow,
  deployForm = {},
  deployHelperToggle = null,
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
  cloudflareTokenSlug = '',
  setDeployForm,
  handleDeployWorker,
  deployStatusDisplayState,
}: WorkerDeploySectionProps) => {
  const renderTooltip = typeof renderInfoTooltip === 'function' ? renderInfoTooltip : () => null;
  const {
    deployButtonDisabled,
    deployStatusText,
    isError: deployStatusIsError,
  } = deployStatusDisplayState || {
    deployButtonDisabled: false,
    deployStatusText: '',
    isError: false,
  };
  const updateApiToken = (nextApiToken: string) => {
    setDeployForm((prev) => {
      const previousToken = String(prev?.apiToken ?? '');
      const shouldClearAccountId = !!previousToken && previousToken !== nextApiToken;
      return {
        ...prev,
        apiToken: nextApiToken,
        ...(shouldClearAccountId ? { accountId: '' } : {}),
      };
    });
  };

  if (workerMode === 'default') {
    return null;
  }

  return (
    <>
      {shouldUseSponsoredAutoDeployFlow && (
        <div className={styles.statusNote}>
          Sponsored deploy bundle is ready. Normal mode will use the GitHub-hosted worker bundle automatically. If a
          retry needs a different source, keep that Git URL as the default and add a manual bundle URL or upload
          override after a fetch failure. In advanced mode you can still switch between Upload file and Use URL for
          manual testing.
        </div>
      )}
      {(!shouldUseSponsoredAutoDeployFlow || !isNormalMode) && (
        <div className={styles.workerDeployPanel}>
          <div className={styles.workerDeployHeader}>
            {deployForm.workerName ? (
              <div className={styles.workerDeployName} data-testid={E2E_TESTIDS.WIZARD_WORKER_NAME}>
                {deployForm.workerName}
              </div>
            ) : (
              <span />
            )}
          </div>
          <div className={styles.workerDeployGrid}>
            {deployHelperToggle}
            {shouldShowDeployHelperUrlInput && (
              <FormGroup>
                <Label>Deploy-helper URL</Label>
                <Input
                  value={deployHelperUrl ?? ''}
                  placeholder="https://<deploy-helper-name>.<account-subdomain>.workers.dev/"
                  data-testid={E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL}
                  onChange={(e) => setDeployHelperUrl(e.target.value)}
                />
              </FormGroup>
            )}
            {!isNormalMode && (
              <FormGroup className={styles.bundleToggleGroup}>
                <Label>Worker bundle source</Label>
                <div className={styles.inlineToggleRow}>
                  <Label className={styles.workerRadio}>
                    <Input
                      type="radio"
                      name="bundleMode"
                      checked={bundleMode === 'upload'}
                      data-testid={E2E_TESTIDS.WIZARD_BUNDLE_MODE_UPLOAD}
                      onChange={() => setBundleMode('upload')}
                    />
                    Upload file
                  </Label>
                  <Label className={styles.workerRadio}>
                    <Input
                      type="radio"
                      name="bundleMode"
                      checked={bundleMode === 'url'}
                      data-testid={E2E_TESTIDS.WIZARD_BUNDLE_MODE_URL}
                      onChange={() => setBundleMode('url')}
                    />
                    Use URL
                  </Label>
                </div>
              </FormGroup>
            )}
            {isNormalMode ? (
              <>
                <FormGroup key="normal-mode-bundle-url">
                  <Label>Worker bundle URL (release asset)</Label>
                  <Input value={normalModeBundleUrl ?? ''} readOnly data-testid={E2E_TESTIDS.WIZARD_BUNDLE_URL} />
                  <div className={styles.helperText}>{normalModeBundleHelpText}</div>
                </FormGroup>
                {showNormalModeManualBundleControls && (
                  <>
                    <FormGroup key="normal-mode-bundle-url-override">
                      <Label>Manual bundle URL override (optional)</Label>
                      <Input
                        type="url"
                        value={normalModeBundleUrlOverride ?? ''}
                        placeholder="https://github.com/<org>/<repo>/releases/download/<tag>/sessionCorsWorker.bundle.js"
                        data-testid={E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE}
                        invalid={!!normalModeBundleUrlOverrideValidationError}
                        onChange={(e) => setNormalModeBundleUrlOverride(e.target.value)}
                      />
                      <div className={styles.helperText}>{manualBundleUrlOverrideHelp}</div>
                      {normalModeBundleUrlOverrideValidationError && (
                        <div className={styles.errorText}>{normalModeBundleUrlOverrideValidationError}</div>
                      )}
                    </FormGroup>
                    <FormGroup key="normal-mode-bundle-file">
                      <Label>Upload bundle file (optional)</Label>
                      <div className={styles.bundleFileInputRow}>
                        <Input
                          type="file"
                          accept=".js,.mjs"
                          innerRef={normalModeRetryBundleFileInputRef}
                          data-testid={E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT}
                          onChange={(e) => {
                            const file = e.target.files && e.target.files[0];
                            setBundleFile(file || null);
                          }}
                        />
                        <Button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={clearSelectedBundleFile}
                          data-testid={E2E_TESTIDS.WIZARD_CLEAR_BUNDLE_FILE_DEPLOY}
                          disabled={!bundleFile}
                        >
                          Clear bundle file
                        </Button>
                      </div>
                      <div className={styles.helperText}>{normalModeManualBundleHelpText}</div>
                      {bundleFile && (
                        <div className={styles.helperText}>
                          Using {bundleFile.name || localWorkerBundleFallbackFilePath} for this deploy.
                        </div>
                      )}
                    </FormGroup>
                  </>
                )}
              </>
            ) : bundleMode === 'url' ? (
              <FormGroup key="advanced-mode-bundle-url">
                <Label className={styles.fieldLabelRow}>
                  <span>Worker bundle URL (release asset)</span>
                  {renderTooltip({
                    id: 'gw-bundle-url-tip',
                    content: 'Optional. Leave blank to use the deploy-helper default bundle URL.',
                    placement: 'right',
                    testId: 'ce-wizard-worker-tooltip-gw-bundle-url-tip',
                    ariaLabel: 'Worker bundle URL info',
                  })}
                </Label>
                <Input
                  value={deployForm.bundleUrl ?? ''}
                  placeholder="https://github.com/<org>/<repo>/releases/latest/download/sessionCorsWorker.bundle.js"
                  data-testid={E2E_TESTIDS.WIZARD_BUNDLE_URL}
                  onChange={(e) => setDeployForm((prev) => ({ ...prev, bundleUrl: e.target.value }))}
                />
              </FormGroup>
            ) : (
              <FormGroup key="advanced-mode-bundle-file">
                <Label>Upload bundle file</Label>
                <Input
                  type="file"
                  accept=".js,.mjs"
                  innerRef={advancedBundleFileInputRef}
                  data-testid={E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT}
                  onChange={(e) => {
                    const file = e.target.files && e.target.files[0];
                    setBundleFile(file || null);
                  }}
                />
              </FormGroup>
            )}
            <FormGroup>
              <Label className={styles.fieldLabelRow}>
                <span>Cloudflare API token</span>
                {renderTooltip({
                  id: 'gw-cf-token-tip',
                  content:
                    'The default template requests only Workers Scripts: Edit and Workers KV Storage: Edit. KV stores canonical config, encrypted payload envelopes and indexes, groups, audit rows, and deploy state.',
                  placement: 'right',
                  testId: 'ce-wizard-worker-tooltip-gw-cf-token-tip',
                  ariaLabel: 'Cloudflare API token info',
                })}
              </Label>
              <Input
                type="password"
                value={deployForm.apiToken ?? ''}
                data-testid={E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN}
                onChange={(e) => updateApiToken(e.target.value)}
              />
              {!isNormalMode && showSponsoredDeployAccessNotice && (
                <div className={styles.helperText}>
                  Deploy access is currently provided by the sponsored bundle. Enter a Cloudflare API token here to
                  override it.
                </div>
              )}
              <div className={styles.helperText}>
                <Button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() =>
                    window.open(
                      buildCloudflareTokenTemplateUrl({
                        accountId: deployForm.accountId,
                        slug: cloudflareTokenSlug,
                      }),
                      '_blank',
                    )
                  }
                >
                  Create prefilled API token
                </Button>
              </div>
              <div className={styles.helperText}>
                You must be logged into Cloudflare before using the prefilled API token button.
              </div>
              {!deployForm.accountId && (
                <div className={styles.helperText}>
                  Cloudflare may preselect All accounts. Before creating the token, restrict Account Resources to the
                  one account where this worker will run.
                </div>
              )}
              <div className={styles.helperText}>
                Account is inferred during deploy only when the token can see exactly one account.
              </div>
            </FormGroup>
            <FormGroup>
              <Label>Admin address</Label>
              <Input
                value={deployForm.adminAddress ?? ''}
                placeholder={account || '0x...'}
                onChange={(e) => setDeployForm((prev) => ({ ...prev, adminAddress: e.target.value }))}
              />
            </FormGroup>
          </div>
          <div className={styles.workerDeployActions}>
            <Button
              type="button"
              className={styles.actionButton}
              data-testid={E2E_TESTIDS.WIZARD_DEPLOY_WORKER}
              onClick={handleDeployWorker}
              disabled={deployButtonDisabled}
            >
              Deploy worker
            </Button>
          </div>
          {deployStatusText && (
            <div
              className={`${styles.copyStatus} ${deployStatusIsError ? styles.copyStatusError : ''}`}
              data-testid={E2E_TESTIDS.WIZARD_DEPLOY_STATUS}
            >
              {deployStatusText}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default WorkerDeploySection;
