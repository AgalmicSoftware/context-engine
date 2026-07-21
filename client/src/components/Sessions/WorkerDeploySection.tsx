/** @file WorkerDeploySection.tsx */
import React from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import styles from './SessionWizard.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildCloudflareTokenTemplateUrl, CLOUDFLARE_API_TOKENS_URL } from './cloudflareTokenTemplate.js';
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

const normalizeNativeWorkerOrigin = (value: unknown) => {
  const candidate = String(value || '').trim();
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return candidate.toLowerCase();
    return parsed.origin.toLowerCase();
  } catch {
    return candidate.toLowerCase();
  }
};

const buildNativeSetupIdentity = ({ sessionSlug, adminAddress }: { sessionSlug: string; adminAddress: string }) =>
  `${sessionSlug.trim().toLowerCase()}\n${adminAddress.trim().toLowerCase()}`;

const buildNativeVerificationIdentity = ({
  workerUrl,
  sessionSlug,
  adminAddress,
}: {
  workerUrl: unknown;
  sessionSlug: string;
  adminAddress: string;
}) =>
  `${normalizeNativeWorkerOrigin(workerUrl)}\n${buildNativeSetupIdentity({
    sessionSlug,
    adminAddress,
  })}`;

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
  cloudflareNativeDeployUrl?: string;
  setDeployForm: React.Dispatch<React.SetStateAction<DeployForm>>;
  handleDeployWorker: () => void;
  deployStatusDisplayState: SessionWizardDeployStatusDisplayState;
  displayedWorkerUrl?: string;
  onNativeWorkerVerified?: (bootstrap: WorkerCanonicalSessionBootstrap) => void;
  verifyNativeWorker?: typeof fetchWorkerCanonicalSessionBootstrap;
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
  cloudflareNativeDeployUrl = CLOUDFLARE_NATIVE_DEPLOY_URL,
  setDeployForm,
  handleDeployWorker,
  deployStatusDisplayState,
  displayedWorkerUrl = '',
  onNativeWorkerVerified,
  verifyNativeWorker,
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
  const cloudflareTokenTemplateHref = buildCloudflareTokenTemplateUrl({
    accountId: deployForm.accountId,
    slug: cloudflareTokenSlug,
  });
  const cloudflareTokenReceiver = String(deployHelperUrl || '').trim();
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
      {nativeDeployUrl && (
        <section className={styles.cloudflareNativeDeployCard} aria-labelledby="ce-cloudflare-native-deploy-title">
          <div>
            <h3 id="ce-cloudflare-native-deploy-title" className={styles.cloudflareNativeDeployTitle}>
              Deploy the full Session Worker in your Cloudflare account
            </h3>
            <p className={styles.helperText}>
              This is the default self-hosted path. Cloudflare creates and owns the Worker, KV namespace, and Durable
              Object. No Cloudflare API token, Context Engine deploy helper, OAuth grant, or installed agent is used.
            </p>
          </div>
          <Button
            type="button"
            className={styles.secondaryButton}
            data-testid={E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE}
            onClick={generateNativeSetupSecrets}
          >
            {currentNativeSetupSecrets ? 'Replace setup values' : 'Generate setup values'}
          </Button>
          {currentNativeSetupSecrets && (
            <>
              <ol data-testid="ce-wizard-cloudflare-native-checklist">
                <li>Copy the four setup values below.</li>
                <li>Open Cloudflare and complete the dashboard deployment in the new tab.</li>
                <li>Return here and paste the resulting workers.dev URL into the Worker URL field.</li>
                <li>
                  Sign the initial config and AI-secret write, then verify canonical readback and browser-origin access.
                </li>
              </ol>
              <div className={styles.cloudflareNativeDeployGrid}>
                {renderCopyField(
                  'DEFAULT_SESSION_SLUG',
                  nativeSessionSlug,
                  E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_SESSION_SLUG,
                )}
                {renderCopyField(
                  'BOOTSTRAP_ADMIN_ADDRESS',
                  nativeAdminAddress,
                  E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_ADMIN_ADDRESS,
                )}
                {renderCopyField(
                  'TOKEN_HMAC_SECRET',
                  currentNativeSetupSecrets.tokenHmacSecret,
                  E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_TOKEN_HMAC,
                )}
                {renderCopyField(
                  'CE_STORAGE_ENVELOPE_KEK',
                  currentNativeSetupSecrets.storageEnvelopeKek,
                  E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_STORAGE_KEK,
                )}
              </div>
            </>
          )}
          {nativeSetupError && <div className={styles.errorText}>{nativeSetupError}</div>}
          {currentNativeSetupSecrets && !nativeSessionSlug && (
            <div className={styles.errorText}>Enter the session slug before opening Cloudflare.</div>
          )}
          {currentNativeSetupSecrets && !nativeAdminAddress && (
            <div className={styles.errorText}>Log in with the session admin passkey before opening Cloudflare.</div>
          )}
          {nativeDeployReady && (
            <a
              href={nativeDeployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.secondaryButton} btn btn-secondary`}
              data-testid={E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_DEPLOY}
              onClick={() => {
                setNativeProgress('opened');
                setNativeStatus('Cloudflare opened in a new tab. Finish deployment there, then return to verify.');
              }}
            >
              Open Cloudflare deployment
            </a>
          )}
          <div className={styles.helperText}>
            Paste the four values above into Cloudflare. The two 64-character values are independent Session Worker
            runtime secrets, not Cloudflare credentials; they stay only in this tab and Cloudflare&apos;s encrypted
            Worker-secret store. After deployment, paste the resulting workers.dev URL into the Worker URL field.
          </div>
          {currentNativeSetupSecrets ? (
            <Button
              type="button"
              className={styles.secondaryButton}
              data-testid="ce-wizard-cloudflare-native-verify"
              disabled={nativeProgress === 'verifying'}
              onClick={() => void verifyNativeDeployment()}
            >
              {nativeProgress === 'verifying'
                ? 'Verifying Session Worker…'
                : nativeVerificationIsCurrent
                  ? 'Session Worker verified'
                  : 'Verify Session Worker'}
            </Button>
          ) : null}
          {nativeStatus ? (
            <div
              className={nativeVerificationIsCurrent ? styles.statusNote : styles.helperText}
              role="status"
              data-testid="ce-wizard-cloudflare-native-status"
            >
              {nativeStatus}
            </div>
          ) : null}
        </section>
      )}
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
                          type="url"
                          value={normalModeBundleUrlOverride ?? ''}
                          placeholder="https://github.com/<org>/<repo>/releases/download/<tag>/sessionCorsWorker.bundle.js"
                          data-testid={E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE}
                          invalid={!!normalModeBundleUrlOverrideValidationError}
                          onChange={(e) => setNormalModeBundleUrlOverride(e.target.value)}
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
                    'Use the prefilled template link below. It includes Workers, R2 objects, D1 or KV metadata indexes, and Durable Objects for signer coordination only. Add Account Settings: Edit only when creating or changing the workers.dev subdomain.',
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
                <a
                  href={cloudflareTokenTemplateHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.secondaryButton} btn btn-secondary`}
                  data-testid={E2E_TESTIDS.WIZARD_CLOUDFLARE_TOKEN_CREATE_LINK}
                >
                  Create prefilled API token
                </a>
              </div>
              <div className={styles.helperText}>
                You must be logged into Cloudflare before using the prefilled API token link. Create the token, copy its
                generated value, then paste it into the field above.
              </div>
              <div className={styles.helperText}>
                Cloudflare may preselect All accounts. Before creating the token, restrict Account Resources to the one
                account where this worker will run.
              </div>
              <div className={styles.helperText}>
                Account is inferred during deploy only when the token can see exactly one account.
              </div>
              <div className={styles.helperText}>
                This browser sends this token only for this deployment attempt to the deploy helper
                {cloudflareTokenReceiver ? (
                  <>
                    {' '}at <code>{cloudflareTokenReceiver}</code>
                  </>
                ) : (
                  ' at the deploy-helper URL shown above'
                )}
                . The helper uses it to call Cloudflare; it is not saved to the session draft or browser storage and
                is not installed in the deployed Session Worker.
              </div>
              <div className={styles.helperText}>
                Set the earliest expiration Cloudflare permits that still covers setup and an immediate retry. Revoke
                the token as soon as deployment succeeds or you abandon the attempt from{' '}
                <a href={CLOUDFLARE_API_TOKENS_URL} target="_blank" rel="noopener noreferrer">
                  Cloudflare API Tokens
                </a>
                .
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
        </details>
      )}
    </>
  );
};

export default WorkerDeploySection;
