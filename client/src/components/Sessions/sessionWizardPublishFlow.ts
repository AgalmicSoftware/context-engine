import { toStr } from '../../utilities/shared/primitives.js';
import { CLOUDFLARE_WORKER_BUNDLE_URL } from '../../variables/appConfig.js';
import {
  hasSponsoredBundleFields,
  normalizeSparseSponsoredBundlePayload,
} from '../../utilities/arweave/sponsoredBundles.js';
import { normalizeWorkerUrl as normalizeWorkerAuthUrl } from '../../utilities/worker/workerAuth.js';
import type { AnyRecord } from '../shellTypes';

export const getSessionWizardNormalModeBundleUrlOverrideValidationError = (value: unknown = ''): string => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') {
      return 'Manual bundle URL override must use an https:// URL.';
    }
  } catch (_) {
    return 'Manual bundle URL override must use an https:// URL.';
  }
  return '';
};

const getValidSessionWizardNormalModeBundleUrlOverride = (value: unknown = ''): string => (
  getSessionWizardNormalModeBundleUrlOverrideValidationError(value)
    ? ''
    : toStr(value).trim()
);

const resolveSponsoredBundleBootstrapWorkerUrl = (bundle: AnyRecord = {}): string => normalizeWorkerAuthUrl(toStr(
  bundle?.bootstrapWorkerUrl ||
  bundle?.meta?.sourceWorkerUrl ||
  ''
).trim());

export const resolveSessionWizardShouldAutoDeployWorker = ({
  workerMode = 'default',
  sponsoredAutoDeployReady = false,
  deployComplete = false,
}: {
  workerMode?: unknown;
  sponsoredAutoDeployReady?: boolean;
  deployComplete?: boolean;
} = {}) => (
  toStr(workerMode).trim() !== 'default' &&
  sponsoredAutoDeployReady &&
  !deployComplete
);

export const buildSessionWizardPublishPlan = ({
  shouldAutoDeployWorker = false,
  hasPendingDrafts = false,
  hasManualMetadata = false,
}: {
  shouldAutoDeployWorker?: boolean;
  hasPendingDrafts?: boolean;
  hasManualMetadata?: boolean;
} = {}) => {
  const steps: string[] = [];
  if (shouldAutoDeployWorker) steps.push('deploy-worker');
  if (hasPendingDrafts) steps.push('deploy-sbts');
  if (!hasManualMetadata) steps.push('upload-metadata');
  steps.push('register-session');
  steps.push('done');
  return steps;
};

export const resolveSessionWizardBundleUrlForMode = ({
  wizardMode = 'advanced',
  bundleUrl = '',
  normalModeBundleUrlOverride = '',
  normalModeDefaultBundleUrl = CLOUDFLARE_WORKER_BUNDLE_URL,
}: {
  wizardMode?: string;
  bundleUrl?: unknown;
  normalModeBundleUrlOverride?: unknown;
  normalModeDefaultBundleUrl?: unknown;
} = {}) => {
  const normalizedBundleUrl = toStr(bundleUrl).trim();
  if (wizardMode !== 'normal') return normalizedBundleUrl;
  const normalizedNormalModeBundleUrlOverride = getValidSessionWizardNormalModeBundleUrlOverride(
    normalModeBundleUrlOverride
  );
  return normalizedNormalModeBundleUrlOverride ||
    toStr(normalModeDefaultBundleUrl).trim();
};

export const resolveSponsoredBundleDeployReadiness = ({
  wizardMode = 'advanced',
  sponsoredBundle = {},
  deployForm = {},
  workerSecretsEnabled = true,
  missingWorkerSecrets = [],
  hasBundleFile = false,
  normalModeBundleUrlOverride = '',
  normalModeDefaultBundleUrl = CLOUDFLARE_WORKER_BUNDLE_URL,
}: {
  wizardMode?: string;
  sponsoredBundle?: AnyRecord;
  deployForm?: AnyRecord;
  workerSecretsEnabled?: boolean;
  missingWorkerSecrets?: unknown[];
  hasBundleFile?: boolean;
  normalModeBundleUrlOverride?: unknown;
  normalModeDefaultBundleUrl?: unknown;
} = {}) => {
  const normalizedBundle = normalizeSparseSponsoredBundlePayload(sponsoredBundle) as AnyRecord;
  const hasAppliedSponsoredBundle = hasSponsoredBundleFields(normalizedBundle);
  const workerName = toStr(deployForm?.workerName || '').trim();
  const bundleUrl = resolveSessionWizardBundleUrlForMode({
    wizardMode,
    bundleUrl: deployForm?.bundleUrl,
    normalModeBundleUrlOverride,
    normalModeDefaultBundleUrl,
  });
  const hasWorkerBundleSource = !!bundleUrl || !!hasBundleFile;
  const bootstrapWorkerUrl = resolveSponsoredBundleBootstrapWorkerUrl(normalizedBundle);
  const deployGrantToken = toStr(normalizedBundle?.deployGrantToken || '').trim();
  const normalizedMissingWorkerSecrets = Array.isArray(missingWorkerSecrets)
    ? missingWorkerSecrets.map((value) => toStr(value).trim()).filter(Boolean)
    : [];
  const missing: string[] = [];
  if (!hasAppliedSponsoredBundle) missing.push('Sponsored bundle');
  if (!workerSecretsEnabled) missing.push('Worker secrets mode');
  if (!workerName) missing.push('Worker name');
  if (!bootstrapWorkerUrl) missing.push('Bootstrap worker URL');
  if (!deployGrantToken) missing.push('Deploy grant token');
  if (!hasWorkerBundleSource) missing.push('Worker bundle URL');
  missing.push(...normalizedMissingWorkerSecrets);
  return {
    active: hasAppliedSponsoredBundle,
    ready: hasAppliedSponsoredBundle && missing.length === 0,
    missing,
  };
};

export const buildSessionWizardPublishStepNumbers = (options: AnyRecord = {}): Record<string, number> => (
  buildSessionWizardPublishPlan(options).reduce<Record<string, number>>((acc, stepKey, index) => {
    acc[stepKey] = index + 1;
    return acc;
  }, {})
);

export const resolveSessionWizardSponsoredAutoDeployReadiness = ({
  wizardMode = 'advanced',
  sponsoredBundle = {},
  deployForm = {},
  workerSecretsEnabled = true,
  currentWorkerSecrets = {},
  getMissingWorkerSecretsForDeploy = () => [],
  hasBundleFile = false,
  normalModeBundleUrlOverride = '',
  normalModeDefaultBundleUrl = CLOUDFLARE_WORKER_BUNDLE_URL,
}: {
  wizardMode?: string;
  sponsoredBundle?: AnyRecord;
  deployForm?: AnyRecord;
  workerSecretsEnabled?: boolean;
  currentWorkerSecrets?: AnyRecord;
  getMissingWorkerSecretsForDeploy?: ((secretsSnapshot?: AnyRecord) => string[]) | null;
  hasBundleFile?: boolean;
  normalModeBundleUrlOverride?: unknown;
  normalModeDefaultBundleUrl?: unknown;
} = {}) => {
  const resolveMissingWorkerSecrets = (
    typeof getMissingWorkerSecretsForDeploy === 'function'
      ? getMissingWorkerSecretsForDeploy
      : () => []
  );
  return resolveSponsoredBundleDeployReadiness({
    wizardMode,
    sponsoredBundle,
    deployForm,
    workerSecretsEnabled,
    missingWorkerSecrets: workerSecretsEnabled
      ? resolveMissingWorkerSecrets(currentWorkerSecrets)
      : [],
    hasBundleFile,
    normalModeBundleUrlOverride,
    normalModeDefaultBundleUrl,
  });
};

export const getSessionWizardPublishProgressPercent = ({
  publishStep = 0,
  publishBusy = false,
  totalSteps = 0,
  elapsedMs = 0,
}: {
  publishStep?: number;
  publishBusy?: boolean;
  totalSteps?: number;
  elapsedMs?: number;
} = {}) => {
  const steps = Math.max(0, Number(totalSteps || 0));
  const currentStep = Math.max(0, Number(publishStep || 0));
  if (!steps || currentStep <= 0) return 0;
  const clampedStep = Math.min(currentStep, steps);
  const stepSize = 100 / steps;
  if (!publishBusy) {
    return Math.min(100, Math.max(0, clampedStep * stepSize));
  }
  const base = Math.max(0, (clampedStep - 1) * stepSize);
  const cap = clampedStep >= steps ? 100 : base + (stepSize * 0.82);
  const durationMs = 2600;
  const ratio = Math.max(0, Math.min(1, Number(elapsedMs || 0) / durationMs));
  const eased = 1 - Math.pow(1 - ratio, 2);
  return Math.min(99, Math.max(base + (stepSize * 0.18), base + ((cap - base) * eased)));
};
