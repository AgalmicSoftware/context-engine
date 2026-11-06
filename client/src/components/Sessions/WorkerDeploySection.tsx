import { recoveryKeyFingerprint } from '../../../../shared/crypto/recoveryKeyFingerprint.mjs';
/** @file WorkerDeploySection.tsx */
import React from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import styles from './SessionWizard.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { CLOUDFLARE_NATIVE_DEPLOY_URL } from '../../variables/publicDeploymentConfig.js';
import { createCloudflareNativeSetupSecrets } from '../../utilities/worker/cloudflareNativeDeploy.js';
import type { SessionWizardVerifiedWorkerConnection } from './sessionWizardNativeWorkerVerification';

type DeployForm = {
  workerName?: string;
  apiToken?: string;
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
  allowNativeWorkerVerification?: boolean;
  agentHttpEnabled?: boolean;
  workerMode: string;
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
  cloudflareTokenSlug?: string;
  cloudflareNativeDeployUrl?: string;
  operatorRecoveryKey?: string | null;
  setOperatorRecoveryKey?: (value: string | null) => void;
  deployVerifiedInUi?: boolean;
  displayedWorkerUrl?: string;
  onNativeWorkerVerified?: (bootstrap: SessionWizardVerifiedWorkerConnection) => void;
  verifyNativeWorker?: (input: {
    sessionSlug: string;
    workerQueryValue: unknown;
    deployedFromTemplate?: boolean;
  }) => Promise<SessionWizardVerifiedWorkerConnection>;
  nativeTemplateSetupIdentity?: string;
  onNativeTemplateSetupGenerated?: (identity: string) => void;
};

const WorkerDeploySection = ({
  allowNativeWorkerVerification = false,
  agentHttpEnabled = false,
  workerMode,
  shouldUseSponsoredAutoDeployFlow,
  deployForm = {},
  deployHelperToggle = null,
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
  cloudflareTokenSlug = '',
  cloudflareNativeDeployUrl = CLOUDFLARE_NATIVE_DEPLOY_URL,
  operatorRecoveryKey,
  setOperatorRecoveryKey,
  deployVerifiedInUi,
  displayedWorkerUrl = '',
  onNativeWorkerVerified,
  verifyNativeWorker,
  nativeTemplateSetupIdentity = '',
  onNativeTemplateSetupGenerated,
}: WorkerDeploySectionProps) => {
  const [localOperatorKey, setLocalOperatorKey] = React.useState<string | null>(null);
  const [revealOperatorKey, setRevealOperatorKey] = React.useState(false);
  const chosenRecoveryKey = operatorRecoveryKey === undefined ? localOperatorKey : operatorRecoveryKey;
  const recoveryKeyInput = chosenRecoveryKey || '';
  const changeRecoveryKey = setOperatorRecoveryKey || setLocalOperatorKey;
  const [fingerprint, setFingerprint] = React.useState('');
  const [nativeSetupSecrets, setNativeSetupSecrets] = React.useState<{
    tokenHmacSecret: string;
    storageEnvelopeKek: string;
    agentManagedRootSecret?: string;
  } | null>(null);
  const [nativeSetupSecretsIdentity, setNativeSetupSecretsIdentity] = React.useState('');
  const [nativeSetupError, setNativeSetupError] = React.useState('');
  const [nativeProgress, setNativeProgress] = React.useState<'generated' | 'opened' | 'verifying' | 'verified' | ''>(
    '',
  );
  const [nativeStatus, setNativeStatus] = React.useState('');
  const [copiedNativeField, setCopiedNativeField] = React.useState('');
  const [verifiedNativeIdentity, setVerifiedNativeIdentity] = React.useState('');
  const nativeVerificationEnabled = allowNativeWorkerVerification === true;
  const nativeDeployUrl = nativeVerificationEnabled ? String(cloudflareNativeDeployUrl || '').trim() : '';
  const nativeSessionSlug = String(cloudflareTokenSlug || '').trim();
  const connectedAccount = String(account || '').trim();
  const nativeAdminAddress = String(deployForm.adminAddress || connectedAccount).trim();
  const nativeSetupIdentity = buildNativeSetupIdentity({
    sessionSlug: nativeSessionSlug,
    adminAddress: nativeAdminAddress,
  });
  const nativeVerificationIdentity = buildNativeVerificationIdentity({
    workerUrl: displayedWorkerUrl,
    sessionSlug: nativeSessionSlug,
    adminAddress: nativeAdminAddress,
  });
  const previousNativeSetupIdentityRef = React.useRef(nativeSetupIdentity);
  const previousNativeVerificationIdentityRef = React.useRef(nativeVerificationIdentity);
  const previousDeployVerifiedInUiRef = React.useRef(deployVerifiedInUi);
  const currentNativeVerificationIdentityRef = React.useRef(nativeVerificationIdentity);
  currentNativeVerificationIdentityRef.current = nativeVerificationIdentity;
  const currentNativeSetupSecrets = nativeSetupSecretsIdentity === nativeSetupIdentity ? nativeSetupSecrets : null;
  const fingerprintKey = currentNativeSetupSecrets?.storageEnvelopeKek || recoveryKeyInput;
  React.useEffect(() => {
    let active = true;
    setFingerprint('');
    if (/^[0-9a-f]{64}$/i.test(fingerprintKey)) {
      void recoveryKeyFingerprint(fingerprintKey)
        .then((value: string) => {
          if (active) setFingerprint(value);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [fingerprintKey]);
  const nativeDeployReady = !!(nativeDeployUrl && currentNativeSetupSecrets && nativeSessionSlug && nativeAdminAddress);
  const nativeAttachmentReady = !!(
    nativeVerificationEnabled &&
    nativeSessionSlug &&
    nativeAdminAddress &&
    normalizeNativeWorkerOrigin(displayedWorkerUrl)
  );
  const nativeVerificationIsCurrent =
    nativeProgress === 'verified' && verifiedNativeIdentity === nativeVerificationIdentity;

  React.useEffect(() => {
    const setupIdentityChanged = previousNativeSetupIdentityRef.current !== nativeSetupIdentity;
    const verificationIdentityChanged = previousNativeVerificationIdentityRef.current !== nativeVerificationIdentity;
    previousNativeSetupIdentityRef.current = nativeSetupIdentity;
    previousNativeVerificationIdentityRef.current = nativeVerificationIdentity;
    if (!verificationIdentityChanged) return;

    setVerifiedNativeIdentity('');
    setCopiedNativeField('');
    if (setupIdentityChanged) {
      setNativeSetupSecrets(null);
      setNativeSetupSecretsIdentity('');
      setNativeSetupError('');
      setNativeProgress('');
      setNativeStatus('');
      return;
    }
    setNativeProgress((progress) => (progress ? 'generated' : ''));
    setNativeStatus((status) =>
      status && currentNativeSetupSecrets
        ? 'The Session Worker URL changed. Verify this exact Worker identity before deploying the session.'
        : '',
    );
  }, [currentNativeSetupSecrets, nativeSetupIdentity, nativeVerificationIdentity]);

  React.useEffect(() => {
    const wasVerifiedInUi = previousDeployVerifiedInUiRef.current;
    previousDeployVerifiedInUiRef.current = deployVerifiedInUi;
    if (wasVerifiedInUi !== true || deployVerifiedInUi !== false) return;

    setVerifiedNativeIdentity('');
    setCopiedNativeField('');
    setNativeProgress(currentNativeSetupSecrets ? 'generated' : '');
    setNativeStatus(
      'Session requirements changed. Verify this exact Worker configuration before deploying the session.',
    );
  }, [currentNativeSetupSecrets, deployVerifiedInUi]);

  const generateNativeSetupSecrets = () => {
    try {
      setNativeSetupSecrets(createCloudflareNativeSetupSecrets(undefined, chosenRecoveryKey, agentHttpEnabled));
      setNativeSetupSecretsIdentity(nativeSetupIdentity);
      onNativeTemplateSetupGenerated?.(nativeSetupIdentity);
      setNativeSetupError('');
      setNativeProgress('generated');
      setNativeStatus('Setup values generated in this tab. Copy each value into Cloudflare.');
      setCopiedNativeField('');
      setVerifiedNativeIdentity('');
    } catch (error) {
      setNativeSetupSecrets(null);
      setNativeSetupSecretsIdentity('');
      setNativeSetupError(error instanceof Error ? error.message : 'Secure setup-secret generation failed.');
    }
  };
  const copyNativeValue = async (label: string, value: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable.');
      await navigator.clipboard.writeText(value);
      setCopiedNativeField(label);
      setNativeStatus(`${label} copied. The value is not shown in this status message.`);
    } catch {
      setNativeStatus(`Could not copy ${label}. Select the field and copy it manually.`);
    }
  };
  const verifyNativeDeployment = async () => {
    const candidate = String(displayedWorkerUrl || '').trim();
    if (!candidate) {
      setNativeStatus('Paste the deployed Worker URL into the Worker URL field before verification.');
      return;
    }
    if (!verifyNativeWorker) {
      setNativeProgress('opened');
      setNativeStatus('Session verification is unavailable. Keep this setup open and retry from the session wizard.');
      return;
    }
    setNativeProgress('verifying');
    setVerifiedNativeIdentity('');
    setNativeStatus(
      'Writing required session config and AI secrets, then verifying signed config acceptance, Worker reachability, and browser-origin access…',
    );
    const requestedIdentity = nativeVerificationIdentity;
    try {
      const bootstrap = await verifyNativeWorker({
        sessionSlug: nativeSessionSlug,
        workerQueryValue: candidate,
        // Setup values generated for this slug and admin, now or before the
        // Worker step remounted, mean the Worker comes from the template.
        deployedFromTemplate:
          !!currentNativeSetupSecrets ||
          (!!nativeTemplateSetupIdentity && nativeTemplateSetupIdentity === nativeSetupIdentity),
      });
      if (currentNativeVerificationIdentityRef.current !== requestedIdentity) return;
      const returnedOrigin = normalizeNativeWorkerOrigin(bootstrap.workerOrigin);
      if (
        returnedOrigin !== normalizeNativeWorkerOrigin(candidate) ||
        String(bootstrap.sessionSlug || '')
          .trim()
          .toLowerCase() !== nativeSessionSlug.toLowerCase()
      ) {
        setNativeProgress('generated');
        setNativeStatus('Worker verification returned a different session identity. Check the Worker URL and retry.');
        return;
      }
      setVerifiedNativeIdentity(requestedIdentity);
      setNativeProgress('verified');
      setNativeStatus(
        bootstrap.configRevision
          ? `Session Worker verified at revision ${bootstrap.configRevision}. You can deploy the session.`
          : 'Session Worker verified. You can deploy the session.',
      );
      onNativeWorkerVerified?.(bootstrap);
    } catch (error) {
      if (currentNativeVerificationIdentityRef.current !== requestedIdentity) return;
      setVerifiedNativeIdentity('');
      setNativeProgress('opened');
      // Show the Worker's reason (a rejected write, a readback mismatch) so
      // the user can tell what to fix.
      const detail = error instanceof Error ? error.message.trim().replace(/\.$/, '') : '';
      setNativeStatus(
        error instanceof TypeError
          ? 'The Worker could not be reached, or its CORS policy rejected this browser origin. Check Cloudflare and retry.'
          : `Worker verification failed${detail ? `: ${detail}` : ''}. Check the Worker URL and session identity, then retry.`,
      );
    }
  };
  const renderCopyField = (label: string, value: string, testId: string) => (
    <FormGroup>
      <Label>{label}</Label>
      <div className={styles.bundleFileInputRow}>
        <Input value={value} readOnly autoComplete="off" data-testid={testId} />
        <Button
          type="button"
          className={styles.secondaryButton}
          data-testid={`ce-wizard-cloudflare-native-copy-${label.toLowerCase().replace(/_/g, '-')}`}
          onClick={() => void copyNativeValue(label, value)}
        >
          {copiedNativeField === label ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </FormGroup>
  );

  if (workerMode === 'default') {
    return null;
  }

  return (
    <>
      <details
        className={styles.cloudflareNativeDeployCard}
        onToggle={(event) => {
          if (event.currentTarget.open && chosenRecoveryKey === null) changeRecoveryKey('');
        }}
      >
        <summary>Advanced: use my own recovery key</summary>
        <p className={styles.helperText}>
          Optional. Enter 64 hex characters or generate a key in this tab. Keep a private copy before deploying. This
          value is never saved in a wizard draft.
        </p>
        <Label for="ce-wizard-recovery-key-input">Your recovery key</Label>
        <Input
          id="ce-wizard-recovery-key-input"
          data-testid="ce-wizard-recovery-key-input"
          type={revealOperatorKey ? 'text' : 'password'}
          autoComplete="off"
          value={recoveryKeyInput}
          onChange={(event) => changeRecoveryKey(event.target.value.trim().toLowerCase())}
        />
        <Button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setRevealOperatorKey(!revealOperatorKey)}
        >
          {revealOperatorKey ? 'Hide supplied key' : 'Reveal supplied key'}
        </Button>
        <Button
          type="button"
          className={styles.secondaryButton}
          data-testid="ce-wizard-recovery-key-generate"
          onClick={() => {
            try {
              changeRecoveryKey(createCloudflareNativeSetupSecrets().storageEnvelopeKek);
              setNativeSetupError('');
            } catch {
              setNativeSetupError('Secure key generation is unavailable.');
            }
          }}
        >
          Generate locally
        </Button>
        <Button type="button" className={styles.secondaryButton} onClick={() => changeRecoveryKey(null)}>
          Use a generated deployment key
        </Button>
        {chosenRecoveryKey !== null && !/^[0-9a-f]{64}$/i.test(recoveryKeyInput) && (
          <p className={styles.errorText}>Use exactly 64 hex characters.</p>
        )}
        {currentNativeSetupSecrets &&
          recoveryKeyInput !== currentNativeSetupSecrets.storageEnvelopeKek &&
          recoveryKeyInput && (
            <p className={styles.helperText}>
              Select Replace setup values to use this key in the manual Cloudflare deployment.
            </p>
          )}
      </details>
      {fingerprint && (
        <p className={styles.helperText} style={{ overflowWrap: 'anywhere' }}>
          Recovery key fingerprint: {fingerprint}
        </p>
      )}
      {nativeVerificationEnabled && (
        <section className={styles.cloudflareNativeDeployCard} aria-labelledby="ce-cloudflare-native-deploy-title">
          <div>
            <h3 id="ce-cloudflare-native-deploy-title" className={styles.cloudflareNativeDeployTitle}>
              Deploy or attach a Session Worker
            </h3>
            <p className={styles.helperText}>
              Deploy the full Worker into your Cloudflare account, or paste an existing compatible Worker URL and verify
              it. No Cloudflare API token, Context Engine deploy helper, OAuth grant, or installed agent is used by this
              path.
            </p>
          </div>
          {agentHttpEnabled && (
            <p className={styles.helperText}>
              Agent HTTP uses this same Worker. Set its fresh AGENT_MANAGED_ROOT_SECRET in Cloudflare’s encrypted secret
              fields before verification. Keep it separate from the login and storage secrets.
            </p>
          )}
          {nativeDeployUrl ? (
            <Button
              type="button"
              className={styles.secondaryButton}
              data-testid={E2E_TESTIDS.WIZARD_CLOUDFLARE_NATIVE_GENERATE}
              onClick={generateNativeSetupSecrets}
            >
              {currentNativeSetupSecrets ? 'Replace setup values' : 'Generate setup values'}
            </Button>
          ) : null}
          {currentNativeSetupSecrets && (
            <>
              <ol data-testid="ce-wizard-cloudflare-native-checklist">
                <li>Copy the {agentHttpEnabled ? 'five' : 'four'} setup values below.</li>
                <li>Open Cloudflare and complete the dashboard deployment in the new tab.</li>
                <li>Return here and paste the resulting workers.dev URL into the Worker URL field.</li>
                <li>
                  Sign the initial config and AI-secret write, then verify the exact Worker and browser-origin access.
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
                {agentHttpEnabled &&
                  currentNativeSetupSecrets.agentManagedRootSecret &&
                  renderCopyField(
                    'AGENT_MANAGED_ROOT_SECRET',
                    currentNativeSetupSecrets.agentManagedRootSecret,
                    'ce-wizard-cloudflare-native-agent-root',
                  )}
              </div>
              {agentHttpEnabled && !currentNativeSetupSecrets.agentManagedRootSecret && (
                <p className={styles.helperText}>Replace setup values to generate the agent signing secret.</p>
              )}
            </>
          )}
          {nativeSetupError && <div className={styles.errorText}>{nativeSetupError}</div>}
          {currentNativeSetupSecrets && !nativeSessionSlug && (
            <div className={styles.errorText}>Enter the session slug before opening Cloudflare.</div>
          )}
          {currentNativeSetupSecrets && !nativeAdminAddress && (
            <div className={styles.errorText}>Connect or sign in as the session admin before opening Cloudflare.</div>
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
            {currentNativeSetupSecrets
              ? "Paste the displayed values into Cloudflare. The 64-character secrets stay only in this tab and Cloudflare's encrypted Worker-secret store. After deployment, paste the resulting workers.dev URL into the Worker URL field."
              : 'Already have a compatible Session Worker? Paste its URL into the Worker URL field and verify it without generating replacement setup values.'}
          </div>
          {currentNativeSetupSecrets || nativeAttachmentReady ? (
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
          Sponsored deploy bundle is ready. The sponsor selects the Worker release for this deployment. Manual bundle
          URLs and uploads do not change that release. Contact the sponsor if you need a different version.
        </div>
      )}
      {!shouldUseSponsoredAutoDeployFlow && (
        <details className={styles.workerDeployDetails} open={!nativeDeployUrl}>
          <summary>{nativeDeployUrl ? 'Deploy helper (API token)' : 'Worker deployment'}</summary>
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
            </div>
          </div>
        </details>
      )}
    </>
  );
};

export default WorkerDeploySection;
