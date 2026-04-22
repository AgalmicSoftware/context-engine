/** @file WorkerPanel.jsx */
import React from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionWizard.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  normalizeWorkerUrl as normalizeWorkerAuthUrl,
} from '../../utilities/worker/workerAuth.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { buildCloudflareTokenTemplateUrl } from './cloudflareTokenTemplate.js';
import { PUBLIC_GITHUB_BRANCH, PUBLIC_REPO_URL } from '../../variables/publicRepoMetadata.js';

const SESSION_CORS_WORKER_SOURCE_URL = `${PUBLIC_REPO_URL}/tree/${PUBLIC_GITHUB_BRANCH}/workers/sessionCorsWorker`;
const DEPLOY_HELPER_SOURCE_URL = `${PUBLIC_REPO_URL}/tree/${PUBLIC_GITHUB_BRANCH}/workers/deploy-helper`;
const SESSION_CORS_WORKER_DOCS_URL = `${PUBLIC_REPO_URL}/blob/${PUBLIC_GITHUB_BRANCH}/docs/session-cors-worker.md`;

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
  renderEmbeddedDeployHelperToggle,
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
  deployInFlight,
  deployStatus,
  deployStatusIsError,
  showWorkerUrlField,
  displayedWorkerUrl,
  renderField,
  workerUrlAutoFilled,
}) => {
  const translate = typeof t === 'function' ? t : (key) => key;
  const renderInfoTooltip = typeof renderSessionWizardInfoTooltip === 'function'
    ? renderSessionWizardInfoTooltip
    : () => null;
  const renderResource = typeof renderResourceCard === 'function'
    ? renderResourceCard
    : () => null;
  const renderDeployHelperToggle = typeof renderEmbeddedDeployHelperToggle === 'function'
    ? renderEmbeddedDeployHelperToggle
    : () => null;

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
                  Deploy your own worker or paste a worker URL you control. Shared hosted worker
                  support is planned separately.
                </div>
              </div>
            ) : !isNormalMode && (
              <div className={styles.workerModeCopy}>
                <div className={styles.workerModeTitle}>How should this session run?</div>
                <div className={styles.workerModeSummary}>
                  {workerMode === 'default' ? 'Shared hosted worker' : 'Custom worker deployment'}
                </div>
              </div>
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
                  content: 'Toggle between the shared hosted worker and deploying your own. Using your own requires a free Cloudflare account (or Vercel Edge, AWS Lambda@Edge, Fly.io, Render, Deno Deploy). Deploy as a module worker with Node.js + npm deps.',
                  placement: 'right',
                  testId: 'ce-wizard-worker-tooltip-gw-worker-mode-tip',
                  ariaLabel: 'Worker mode info',
                })}
              </>
            )}
          </div>
          <div className={styles.workerSecretsPanel}>
            {!isNormalMode && (
              <div className={styles.workerSecretsHeader}>
                <div className={styles.workerSecretsTitle}>Worker secrets</div>
                <div className={styles.workerSecretsToggles}>
                  {devPersistWorkerSecrets && (
                    <Label className={styles.workerToggle}>
                      <Input
                        type="checkbox"
                        checked={persistWorkerSecrets}
                        onChange={(e) => setPersistWorkerSecrets(!!e.target.checked)}
                      />
                      <span>Dev: keep secrets on refresh</span>
                      {renderInfoTooltip({
                        id: 'gw-worker-persist-secrets-tip',
                        content: 'Stores worker secrets in localStorage so they survive refresh. Do not enable on shared machines.',
                        placement: 'right',
                        testId: 'ce-wizard-worker-tooltip-gw-worker-persist-secrets-tip',
                        ariaLabel: 'Persist worker secrets info',
                      })}
                    </Label>
                  )}
                  <Label className={styles.workerToggle}>
                    <Input
                      type="checkbox"
                      checked={!workerSecretsEnabled}
                      data-testid={E2E_TESTIDS.WIZARD_WORKER_SECRETS_REQUIRE_PAY}
                      onChange={(e) => {
                        const requirePay = !!e.target.checked;
                        setWorkerSecretsEnabled(!requirePay);
                        if (!requirePay) clearWorkerSecretFields();
                      }}
                    />
                    <span>Require users to pay for usage</span>
                    {renderInfoTooltip({
                      id: 'gw-worker-kv-tip',
                      content: 'When enabled, users must provide their own API keys and fund minimal transaction and storage fees. When off (default), the session admin provides keys via worker secrets.',
                      placement: 'right',
                      testId: 'ce-wizard-worker-tooltip-gw-worker-kv-tip',
                      ariaLabel: 'Worker secrets mode info',
                    })}
                  </Label>
                </div>
              </div>
            )}
            <div className={styles.resourceSection}>
              {!isNormalMode && (
                <>
                  <div className={styles.resourceHeader}>
                    <span className={styles.subSectionTitle}>{`Resource ${translate('gatesLower')} (on-chain)`}</span>
                    {renderInfoTooltip({
                      id: 'gw-tip-resource-gates',
                      content: `SessionRegistry ${translate('gatesLower')} are authoritative for login/resource access. Default ${translate('gateLower')} applies to all resources; click a lock icon to assign a different ${translate('gateLower')}.`,
                      placement: 'right',
                      testId: 'ce-wizard-worker-tooltip-gw-tip-resource-gates',
                      ariaLabel: 'Resource gates info',
                    })}
                  </div>
                  <div className={styles.helperText}>
                    {effectivePersistWorkerSecrets
                      ? 'Developer mode: secrets are cached locally and will survive refresh.'
                      : 'Secrets are not saved locally — re-enter them if you refresh the page.'}
                  </div>
                </>
              )}
              <div className={styles.gateGrid}>
                {workerResourceKeys.map(renderResource)}
              </div>
            </div>
            <div className={styles.workerConfigGrid}>
              <FormGroup>
                <Label className={styles.fieldLabelRow}>
                  <span>Allowed origins (comma or newline)</span>
                  {renderInfoTooltip({
                    id: 'gw-allowed-origins',
                    content: 'The URL(s) where your site will be accessible — e.g. a subdomain of contextengine.eth or a custom domain. Include localhost for development.',
                    placement: 'right',
                    testId: 'ce-wizard-worker-tooltip-gw-allowed-origins',
                    ariaLabel: 'Allowed origins info',
                  })}
                </Label>
                <Input
                  type="textarea"
                  rows="2"
                  value={workerAllowOrigins}
                  placeholder={defaultAllowedOrigins}
                  onChange={(e) => setWorkerAllowOrigins(e.target.value)}
                />
              </FormGroup>
            </div>
          </div>
          {workerMode !== 'default' && shouldUseSponsoredAutoDeployFlow ? (
            <div className={styles.statusNote}>
              Sponsored deploy bundle is ready. Normal mode will use the GitHub-hosted worker bundle automatically. If a retry needs a different source, keep that Git URL as the default and add a manual bundle URL or upload override after a fetch failure. In advanced mode you can still switch between Upload file and Use URL for manual testing.
            </div>
          ) : null}
          {workerMode !== 'default' && (!shouldUseSponsoredAutoDeployFlow || !isNormalMode) && (
            <div className={styles.workerDeployPanel}>
              <div className={styles.workerDeployHeader}>
                {deployForm.workerName ? (
                  <div className={styles.workerDeployName} data-testid={E2E_TESTIDS.WIZARD_WORKER_NAME}>
                    {deployForm.workerName}
                  </div>
                ) : <span />}
              </div>
              <div className={styles.workerDeployGrid}>
                {renderDeployHelperToggle()}
                {shouldShowDeployHelperUrlInput && (
                  <FormGroup>
                    <Label>Deploy-helper URL</Label>
                    <Input
                      value={deployHelperUrl}
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
                    <FormGroup>
                      <Label>Worker bundle URL (release asset)</Label>
                      <Input
                        value={normalModeBundleUrl}
                        readOnly
                        data-testid={E2E_TESTIDS.WIZARD_BUNDLE_URL}
                      />
                      <div className={styles.helperText}>
                        {normalModeBundleHelpText}
                      </div>
                    </FormGroup>
                    {showNormalModeManualBundleControls && (
                      <>
                        <FormGroup>
                          <Label>Manual bundle URL override (optional)</Label>
                          <Input
                            type="url"
                            value={normalModeBundleUrlOverride}
                            placeholder="https://github.com/<org>/<repo>/releases/download/<tag>/sessionCorsWorker.bundle.js"
                            data-testid={E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE}
                            invalid={!!normalModeBundleUrlOverrideValidationError}
                            onChange={(e) => setNormalModeBundleUrlOverride(e.target.value)}
                          />
                          <div className={styles.helperText}>
                            {manualBundleUrlOverrideHelp}
                          </div>
                          {normalModeBundleUrlOverrideValidationError && (
                            <div className={styles.errorText}>{normalModeBundleUrlOverrideValidationError}</div>
                          )}
                        </FormGroup>
                        <FormGroup>
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
                          <div className={styles.helperText}>
                            {normalModeManualBundleHelpText}
                          </div>
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
                  <FormGroup>
                    <Label className={styles.fieldLabelRow}>
                      <span>Worker bundle URL (release asset)</span>
                      {renderInfoTooltip({
                        id: 'gw-bundle-url-tip',
                        content: 'Optional. Leave blank to use the deploy-helper default bundle URL.',
                        placement: 'right',
                        testId: 'ce-wizard-worker-tooltip-gw-bundle-url-tip',
                        ariaLabel: 'Worker bundle URL info',
                      })}
                    </Label>
                    <Input
                      value={deployForm.bundleUrl}
                      placeholder="https://github.com/<org>/<repo>/releases/latest/download/sessionCorsWorker.bundle.js"
                      data-testid={E2E_TESTIDS.WIZARD_BUNDLE_URL}
                      onChange={(e) => setDeployForm((prev) => ({ ...prev, bundleUrl: e.target.value }))}
                    />
                  </FormGroup>
                ) : (
                  <FormGroup>
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
                    {renderInfoTooltip({
                      id: 'gw-cf-token-tip',
                      content: 'Use the prefilled template link below. It includes Workers/KV/Routes, Account Settings, Tail (read), R2, Pages, Builds, Agents, Observability, and Containers permissions.',
                      placement: 'right',
                      testId: 'ce-wizard-worker-tooltip-gw-cf-token-tip',
                      ariaLabel: 'Cloudflare API token info',
                    })}
                  </Label>
                  <Input
                    type="password"
                    value={deployForm.apiToken}
                    data-testid={E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN}
                    onChange={(e) => setDeployForm((prev) => ({ ...prev, apiToken: e.target.value }))}
                  />
                  {!isNormalMode && showSponsoredDeployAccessNotice && (
                    <div className={styles.helperText}>
                      Deploy access is currently provided by the sponsored bundle. Enter a Cloudflare API token here to override it.
                    </div>
                  )}
                  <div className={styles.helperText}>
                    <Button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => window.open(buildCloudflareTokenTemplateUrl({
                        slug: toStr(draft.slug || resolvedActiveSessionSlug).trim(),
                      }), '_blank')}
                    >
                      Create prefilled API token
                    </Button>
                  </div>
                  <div className={styles.helperText}>
                    You must be logged into Cloudflare before using the prefilled API token button.
                  </div>
                  <div className={styles.helperText}>
                    Account is inferred from the API token during deploy.
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
                  disabled={deployInFlight}
                >
                  Deploy worker
                </Button>
              </div>
              {deployStatus && (
                <div className={`${styles.copyStatus} ${deployStatusIsError ? styles.copyStatusError : ''}`} data-testid={E2E_TESTIDS.WIZARD_DEPLOY_STATUS}>
                  {deployStatus}
                </div>
              )}
            </div>
          )}

          {showWorkerUrlField ? (
            <div className={styles.corsFieldRow}>
              <div className={styles.corsFieldBlock}>
                {renderField('corsWorkerUrl', displayedWorkerUrl, [], { forceShow: true })}
                {workerUrlAutoFilled && (
                  <div className={styles.corsFieldBadgeRow}>
                    <div className={styles.corsFieldBadge}>
                      Auto-filled from deploy-helper
                    </div>
                    {renderInfoTooltip({
                      id: 'gw-worker-autofill-tip',
                      content: 'You can still edit this field manually if you want to point to a different worker.',
                      placement: 'right',
                      testId: 'ce-wizard-worker-tooltip-gw-worker-autofill-tip',
                      ariaLabel: 'Auto-filled worker URL info',
                    })}
                  </div>
                )}
              </div>
              {showSharedWorkerChoice && (
                <Button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setWorkerUrlAutoFilled(false);
                    updateDraftValue(['corsWorkerUrl'], getDefaultWorkerUrl());
                  }}
                >
                  Reset to default
                </Button>
              )}
            </div>
          ) : (
            <div className={styles.helperText}>
              Worker URL appears here after a successful custom worker deploy.
            </div>
          )}

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
