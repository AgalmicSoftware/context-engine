import { toStr } from '../../utilities/shared/primitives.js';
import sha256 from 'crypto-js/sha256';
import { CLOUDFLARE_WORKER_BUNDLE_URL, CLOUDFLARE_WORKER_RELEASE_MANIFEST_URL } from '../../variables/appConfig.js';
import {
  hasSponsoredBundleFields,
  normalizeSparseSponsoredBundlePayload,
} from '../../utilities/arweave/sponsoredBundles.js';
import { normalizeWorkerUrl as normalizeWorkerAuthUrl } from '../../utilities/worker/workerAuth.js';
import type { AnyRecord } from '../shellTypes';
import type { SessionModeProfile } from '../../utilities/session/sessionModeProfile';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';

export const LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH = '/dist/sessionCorsWorker.bundle.js';
export const CLOUDFLARE_MISSING_HANDLER_ERROR = 'no registered event handlers';
export const DEPLOY_HELPER_BUNDLE_FETCH_ERROR = 'failed to fetch bundle';
export const NORMAL_MODE_HOSTED_BUNDLE_HELP_MESSAGE =
  'Guided deploys use the GitHub-hosted worker bundle automatically. If a retry needs a different source, keep this Git URL as the default and add a manual bundle URL or upload below after a fetch failure.';

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

const getValidSessionWizardNormalModeBundleUrlOverride = (value: unknown = ''): string =>
  getSessionWizardNormalModeBundleUrlOverrideValidationError(value) ? '' : toStr(value).trim();

const resolveSponsoredBundleBootstrapWorkerUrl = (bundle: AnyRecord = {}): string =>
  normalizeWorkerAuthUrl(toStr(bundle?.bootstrapWorkerUrl || bundle?.meta?.sourceWorkerUrl || '').trim());

export const resolveSessionWizardShouldAutoDeployWorker = ({
  workerMode = 'default',
  sponsoredAutoDeployReady = false,
  deployComplete = false,
}: {
  workerMode?: unknown;
  sponsoredAutoDeployReady?: boolean;
  deployComplete?: boolean;
} = {}) => toStr(workerMode).trim() !== 'default' && sponsoredAutoDeployReady && !deployComplete;

export const buildSessionWizardPublishPlan = ({
  shouldAutoDeployWorker = false,
  hasPendingDrafts = false,
  hasPendingWorkerGroupDrafts = false,
  hasManualMetadata = false,
  sessionModeProfile = null,
}: {
  shouldAutoDeployWorker?: boolean;
  hasPendingDrafts?: boolean;
  hasPendingWorkerGroupDrafts?: boolean;
  hasManualMetadata?: boolean;
  sessionModeProfile?: SessionModeProfile | null;
} = {}) => {
  const modeRequirements = resolveSessionWizardModeRequirements(sessionModeProfile);
  const shouldDeployPendingSbts =
    !!hasPendingDrafts && (!modeRequirements.selected || modeRequirements.publish.deployPendingSbts);
  const steps: string[] = [];
  if (shouldAutoDeployWorker) steps.push('deploy-worker');
  if (shouldDeployPendingSbts) steps.push('deploy-sbts');
  if (modeRequirements.selected && modeRequirements.publish.persistWorkerConfig) {
    steps.push('persist-worker-config');
  }
  if (modeRequirements.isWorkerCanonical && hasPendingWorkerGroupDrafts) {
    steps.push('create-worker-groups');
  }
  if ((!modeRequirements.selected || modeRequirements.publish.uploadMetadata) && !hasManualMetadata) {
    steps.push('upload-metadata');
  }
  if (!modeRequirements.selected || modeRequirements.publish.registerSession) {
    steps.push('register-session');
  }
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
  const normalizedNormalModeBundleUrlOverride =
    getValidSessionWizardNormalModeBundleUrlOverride(normalModeBundleUrlOverride);
  return normalizedNormalModeBundleUrlOverride || toStr(normalModeDefaultBundleUrl).trim();
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
  sponsoredBundle?: AnyRecord | null;
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

export const buildSessionWizardPublishStepNumbers = (options: AnyRecord = {}): Record<string, number> =>
  buildSessionWizardPublishPlan(options).reduce<Record<string, number>>((acc, stepKey, index) => {
    acc[stepKey] = index + 1;
    return acc;
  }, {});

export const buildSessionWizardPublishExecutionPlan = ({
  workerMode = 'default',
  sponsoredAutoDeployReady = false,
  deployComplete = false,
  hasPendingDrafts = false,
  hasPendingWorkerGroupDrafts = false,
  hasManualMetadata = false,
  canUploadMetadataNow = false,
  sessionModeProfile = null,
}: {
  workerMode?: unknown;
  sponsoredAutoDeployReady?: boolean;
  deployComplete?: boolean;
  hasPendingDrafts?: boolean;
  hasPendingWorkerGroupDrafts?: boolean;
  hasManualMetadata?: boolean;
  canUploadMetadataNow?: boolean;
  sessionModeProfile?: SessionModeProfile | null;
} = {}) => {
  const modeRequirements = resolveSessionWizardModeRequirements(sessionModeProfile);
  const shouldAutoDeployWorker = resolveSessionWizardShouldAutoDeployWorker({
    workerMode,
    sponsoredAutoDeployReady,
    deployComplete,
  });
  // Pending SBT drafts live outside the selected profile. Suppress them unless
  // the profile explicitly retains on-chain SBT authorization so switching to
  // worker-canonical mode cannot silently reintroduce wallet/gas work.
  const shouldDeployPendingSbts =
    !!hasPendingDrafts && (!modeRequirements.selected || modeRequirements.publish.deployPendingSbts);
  const shouldUploadMetadata =
    (!modeRequirements.selected || modeRequirements.publish.uploadMetadata) &&
    (!!canUploadMetadataNow || !!sponsoredAutoDeployReady) &&
    !hasManualMetadata;
  const shouldPersistWorkerConfig = modeRequirements.selected && modeRequirements.publish.persistWorkerConfig;
  const shouldCreateWorkerGroups = modeRequirements.isWorkerCanonical && !!hasPendingWorkerGroupDrafts;
  const shouldRegisterSession = !modeRequirements.selected || modeRequirements.publish.registerSession;
  const shouldRefreshRegistryCache = !modeRequirements.selected || modeRequirements.publish.refreshRegistryCache;
  const steps = buildSessionWizardPublishPlan({
    shouldAutoDeployWorker,
    hasPendingDrafts: shouldDeployPendingSbts,
    hasManualMetadata,
    sessionModeProfile,
    hasPendingWorkerGroupDrafts: shouldCreateWorkerGroups,
  });

  return {
    shouldAutoDeployWorker,
    shouldDeployPendingSbts,
    shouldUploadMetadata,
    shouldPersistWorkerConfig,
    shouldCreateWorkerGroups,
    shouldRegisterSession,
    shouldRefreshRegistryCache,
    steps,
    stepNumbers: steps.reduce<Record<string, number>>((acc, stepKey, index) => {
      acc[stepKey] = index + 1;
      return acc;
    }, {}),
  };
};

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
  sponsoredBundle?: AnyRecord | null;
  deployForm?: AnyRecord;
  workerSecretsEnabled?: boolean;
  currentWorkerSecrets?: AnyRecord;
  getMissingWorkerSecretsForDeploy?: ((secretsSnapshot?: AnyRecord) => string[]) | null;
  hasBundleFile?: boolean;
  normalModeBundleUrlOverride?: unknown;
  normalModeDefaultBundleUrl?: unknown;
} = {}) => {
  const resolveMissingWorkerSecrets =
    typeof getMissingWorkerSecretsForDeploy === 'function' ? getMissingWorkerSecretsForDeploy : () => [];
  return resolveSponsoredBundleDeployReadiness({
    wizardMode,
    sponsoredBundle,
    deployForm,
    workerSecretsEnabled,
    missingWorkerSecrets: workerSecretsEnabled ? resolveMissingWorkerSecrets(currentWorkerSecrets) : [],
    hasBundleFile,
    normalModeBundleUrlOverride,
    normalModeDefaultBundleUrl,
  });
};

const looksLikeHtmlDocument = (value: unknown = ''): boolean => {
  const preview = toStr(value).trim().slice(0, 256).toLowerCase();
  return (
    preview.startsWith('<!doctype html') ||
    preview.startsWith('<html') ||
    preview.includes('<head') ||
    preview.includes('<body')
  );
};

const looksLikeWorkerBundleText = (value: unknown = ''): boolean => {
  const normalized = toStr(value).trim();
  if (!normalized) return false;
  return (
    normalized.includes('fetch(') &&
    (normalized.includes('export default') || normalized.includes('export {') || normalized.includes(' as default'))
  );
};

const looksLikeWrappedWorkerBundleStringModule = (value: unknown = ''): boolean => {
  const normalized = toStr(value).trim();
  if (!normalized) return false;
  return /^export\s+default\s+["'`]/.test(normalized) || /^module\.exports\s*=\s*["'`]/.test(normalized);
};

export const readSessionWizardBundleFileText = async (
  bundleFile: File | null | undefined,
  emptyError = `Selected worker bundle file was empty. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`,
): Promise<string> => {
  const rawBundleText = toStr(bundleFile ? await bundleFile.text() : '');
  const normalizedBundleText = rawBundleText.trim();
  if (!normalizedBundleText) {
    throw new Error(emptyError);
  }
  if (looksLikeHtmlDocument(normalizedBundleText)) {
    throw new Error(
      `Selected worker bundle file resolved to HTML instead of a worker script. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`,
    );
  }
  if (looksLikeWrappedWorkerBundleStringModule(normalizedBundleText)) {
    throw new Error(
      `Selected worker bundle file resolved to a JavaScript string wrapper instead of raw worker bytes. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`,
    );
  }
  if (!looksLikeWorkerBundleText(normalizedBundleText)) {
    throw new Error(
      `Selected worker bundle file is missing the expected worker module export. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`,
    );
  }
  return rawBundleText;
};

export const resolveSessionWizardDeployBundleMode = ({
  wizardMode = 'normal',
  bundleMode = 'upload',
  bundleUrl = '',
  sponsoredAutoDeployReady = false,
  forceSponsoredAutoDeploy = false,
  forceManualBundleFile = false,
  hasBundleFile = false,
  normalModeBundleUrlOverride = '',
  normalModeDefaultBundleUrl = CLOUDFLARE_WORKER_BUNDLE_URL,
}: {
  wizardMode?: string;
  bundleMode?: string;
  bundleUrl?: unknown;
  sponsoredAutoDeployReady?: boolean;
  forceSponsoredAutoDeploy?: boolean;
  forceManualBundleFile?: boolean;
  hasBundleFile?: boolean;
  normalModeBundleUrlOverride?: unknown;
  normalModeDefaultBundleUrl?: unknown;
} = {}) => {
  const hasHostedNormalModeBundleUrl = !!toStr(normalModeDefaultBundleUrl).trim();
  const hasResolvedNormalModeBundleUrl = !!resolveSessionWizardBundleUrlForMode({
    wizardMode: 'normal',
    bundleUrl,
    normalModeBundleUrlOverride,
    normalModeDefaultBundleUrl,
  });
  return wizardMode === 'normal' && hasBundleFile && (forceManualBundleFile || !hasHostedNormalModeBundleUrl)
    ? 'upload'
    : wizardMode === 'normal' && forceSponsoredAutoDeploy
      ? 'url'
      : wizardMode === 'normal' && sponsoredAutoDeployReady
        ? 'url'
        : wizardMode === 'normal'
          ? hasResolvedNormalModeBundleUrl
            ? 'url'
            : 'upload'
          : bundleMode;
};

export type SessionWizardSponsoredAutoDeployStateLike = {
  active?: boolean;
  ready?: boolean;
  missing?: unknown[];
};

export type SessionWizardSponsoredPublishSurfaceState = {
  canUseSponsoredAutoDeployNow: boolean;
  hasNormalModeBundleUrlOverride: boolean;
  normalModeBundleHelpText: string;
  normalModeHostedBundleConfigured: boolean;
  normalModeManualBundleHelpText: string;
  shouldUseSponsoredAutoDeployFlow: boolean;
  showNormalModeManualBundleControls: boolean;
  showNormalModeWorkerStep: boolean;
  showSponsoredBundleFallbackInput: boolean;
  sponsoredAutoDeployBundleMode: string;
  sponsoredAutoDeployMissingBundleUrl: boolean;
  sponsoredLocalBundledAssetAvailable: boolean;
};

export const resolveSessionWizardSponsoredPublishSurfaceState = ({
  isNormalMode = false,
  wizardMode = 'advanced',
  workerMode = 'default',
  bundleMode = 'upload',
  deployForm = {},
  sponsoredAutoDeployState = {},
  forceManualBundleFile = false,
  hasBundleFile = false,
  normalModeBundleUrlOverride = '',
  normalModeDefaultBundleUrl = CLOUDFLARE_WORKER_BUNDLE_URL,
  hostedBundleHelpMessage = NORMAL_MODE_HOSTED_BUNDLE_HELP_MESSAGE,
  manualBundleRetryMessage = '',
  missingHostedBundleMessage = '',
}: {
  isNormalMode?: boolean;
  wizardMode?: string;
  workerMode?: unknown;
  bundleMode?: string;
  deployForm?: AnyRecord;
  sponsoredAutoDeployState?: SessionWizardSponsoredAutoDeployStateLike;
  forceManualBundleFile?: boolean;
  hasBundleFile?: boolean;
  normalModeBundleUrlOverride?: unknown;
  normalModeDefaultBundleUrl?: unknown;
  hostedBundleHelpMessage?: string;
  manualBundleRetryMessage?: string;
  missingHostedBundleMessage?: string;
} = {}): SessionWizardSponsoredPublishSurfaceState => {
  const normalizedWorkerMode = toStr(workerMode).trim();
  const shouldUseSponsoredAutoDeployFlow = normalizedWorkerMode !== 'default' && !!sponsoredAutoDeployState.ready;
  const hasManualBundleFallbackFile = !!hasBundleFile;
  const sponsoredAutoDeployBundleMode = resolveSessionWizardDeployBundleMode({
    wizardMode,
    bundleMode,
    bundleUrl: deployForm?.bundleUrl,
    sponsoredAutoDeployReady: shouldUseSponsoredAutoDeployFlow,
    forceManualBundleFile,
    hasBundleFile: hasManualBundleFallbackFile,
    normalModeBundleUrlOverride,
    normalModeDefaultBundleUrl,
  });
  const showNormalModeWorkerStep = !(!!sponsoredAutoDeployState.active && normalizedWorkerMode !== 'default');
  const sponsoredLocalBundledAssetAvailable = sponsoredAutoDeployBundleMode !== 'upload' || hasManualBundleFallbackFile;
  const canUseSponsoredAutoDeployNow = shouldUseSponsoredAutoDeployFlow && sponsoredLocalBundledAssetAvailable;
  const hasNormalModeBundleUrlOverride = !!toStr(normalModeBundleUrlOverride).trim();
  const missing = Array.isArray(sponsoredAutoDeployState.missing)
    ? sponsoredAutoDeployState.missing.map((entry) => toStr(entry).trim()).filter(Boolean)
    : [];
  const sponsoredAutoDeployMissingBundleUrl =
    !!sponsoredAutoDeployState.active && missing.includes('Worker bundle URL');
  const showSponsoredBundleFallbackInput =
    !!isNormalMode &&
    !showNormalModeWorkerStep &&
    (!!forceManualBundleFile ||
      hasManualBundleFallbackFile ||
      hasNormalModeBundleUrlOverride ||
      sponsoredAutoDeployMissingBundleUrl);
  const normalModeHostedBundleConfigured = !!toStr(normalModeDefaultBundleUrl).trim();
  const showNormalModeManualBundleControls =
    !!isNormalMode && (!!forceManualBundleFile || !normalModeHostedBundleConfigured);
  const normalModeBundleHelpText = normalModeHostedBundleConfigured
    ? hostedBundleHelpMessage
    : missingHostedBundleMessage;
  const normalModeManualBundleHelpText = normalModeHostedBundleConfigured
    ? manualBundleRetryMessage
    : missingHostedBundleMessage;

  return {
    canUseSponsoredAutoDeployNow,
    hasNormalModeBundleUrlOverride,
    normalModeBundleHelpText,
    normalModeHostedBundleConfigured,
    normalModeManualBundleHelpText,
    shouldUseSponsoredAutoDeployFlow,
    showNormalModeManualBundleControls,
    showNormalModeWorkerStep,
    showSponsoredBundleFallbackInput,
    sponsoredAutoDeployBundleMode,
    sponsoredAutoDeployMissingBundleUrl,
    sponsoredLocalBundledAssetAvailable,
  };
};

export const resolveSessionWizardDeployBundlePayload = async ({
  effectiveBundleMode = 'upload',
  bundleFile = null,
  bundleUrl = '',
  normalModeDefaultBundleUrl = CLOUDFLARE_WORKER_BUNDLE_URL,
  normalModeDefaultBundleManifestUrl = CLOUDFLARE_WORKER_RELEASE_MANIFEST_URL,
}: {
  effectiveBundleMode?: string;
  bundleFile?: File | null;
  bundleUrl?: unknown;
  normalModeDefaultBundleUrl?: unknown;
  normalModeDefaultBundleManifestUrl?: unknown;
} = {}) => {
  if (effectiveBundleMode === 'upload') {
    const bundleText = bundleFile
      ? await readSessionWizardBundleFileText(bundleFile, 'Selected worker bundle file was empty.')
      : '';
    return {
      bundleText,
      bundleUrl: undefined,
      bundleManifestUrl: undefined,
      bundleSha256: bundleText ? sha256(bundleText).toString() : undefined,
      bundleSource: bundleText ? 'upload' : 'upload-missing',
    };
  }

  const normalizedBundleUrl = toStr(bundleUrl).trim() || undefined;
  let bundleManifestUrl: string | undefined;
  if (normalizedBundleUrl) {
    try {
      const parsed = new URL(normalizedBundleUrl);
      if (parsed.protocol === 'https:') {
        if (normalizedBundleUrl === toStr(normalModeDefaultBundleUrl).trim()) {
          bundleManifestUrl = toStr(normalModeDefaultBundleManifestUrl).trim() || undefined;
        } else {
          parsed.pathname = `${parsed.pathname.slice(0, parsed.pathname.lastIndexOf('/') + 1)}worker-release-manifest.json`;
          parsed.search = '';
          parsed.hash = '';
          bundleManifestUrl = parsed.toString();
        }
      }
    } catch (_) {
      bundleManifestUrl = undefined;
    }
    if (!bundleManifestUrl) {
      throw new Error('Worker bundle URL must use HTTPS and provide a release manifest binding.');
    }
  }
  return {
    bundleText: '',
    bundleUrl: normalizedBundleUrl,
    bundleManifestUrl,
    bundleSha256: undefined,
    bundleSource: normalizedBundleUrl ? 'url' : 'url-missing',
  };
};

const hasSessionWizardBundleDiagnostics = (bundleDiagnostics: unknown = null): boolean =>
  !!bundleDiagnostics && typeof bundleDiagnostics === 'object' && Object.keys(bundleDiagnostics).length > 0;

const isSessionWizardRemoteBundleUrlFetchFailure = ({
  err,
  effectiveBundleMode = 'upload',
}: {
  err?: unknown;
  effectiveBundleMode?: string;
} = {}) => {
  if (effectiveBundleMode !== 'url') {
    return false;
  }
  const error = err && typeof err === 'object' ? (err as AnyRecord) : {};
  const combined = `${toStr(
    error?.message || (typeof err === 'string' || typeof err === 'number' ? err : ''),
  ).trim()} ${toStr(error?.responseError).trim()}`.toLowerCase();
  return combined.includes(DEPLOY_HELPER_BUNDLE_FETCH_ERROR);
};

const isSessionWizardRemoteBundleUrlMissingHandlerFailure = ({
  err,
  effectiveBundleMode = 'upload',
}: {
  err?: unknown;
  effectiveBundleMode?: string;
} = {}) => {
  if (effectiveBundleMode !== 'url') {
    return false;
  }
  const error = err && typeof err === 'object' ? (err as AnyRecord) : {};
  const combined = `${toStr(
    error?.message || (typeof err === 'string' || typeof err === 'number' ? err : ''),
  ).trim()} ${toStr(error?.responseError).trim()}`.toLowerCase();
  return (
    combined.includes(CLOUDFLARE_MISSING_HANDLER_ERROR) &&
    hasSessionWizardBundleDiagnostics(error?.responseBundleDiagnostics)
  );
};

export const shouldForceSessionWizardNormalModeManualBundleRetry = ({
  err,
  wizardMode = 'normal',
  effectiveBundleMode = 'upload',
  hasBundleFile = false,
}: {
  err?: unknown;
  wizardMode?: string;
  effectiveBundleMode?: string;
  hasBundleFile?: boolean;
} = {}) =>
  wizardMode === 'normal' &&
  !hasBundleFile &&
  (isSessionWizardRemoteBundleUrlFetchFailure({
    err,
    effectiveBundleMode,
  }) ||
    isSessionWizardRemoteBundleUrlMissingHandlerFailure({
      err,
      effectiveBundleMode,
    }));

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
  const cap = clampedStep >= steps ? 100 : base + stepSize * 0.82;
  const durationMs = 2600;
  const ratio = Math.max(0, Math.min(1, Number(elapsedMs || 0) / durationMs));
  const eased = 1 - Math.pow(1 - ratio, 2);
  return Math.min(99, Math.max(base + stepSize * 0.18, base + (cap - base) * eased));
};

export type SessionWizardPublishProgressStep = {
  key: string;
  label: string;
  state: 'active' | 'complete' | 'pending';
};

export type SessionWizardPublishProgressDisplayState = {
  activePublishProgressStepLabel: string;
  publishProgressAriaValueText: string;
  publishProgressEyebrow: 'Publish Complete' | 'Publishing Session';
  publishStep: number;
  publishProgressPercent: number;
  publishProgressPercentRounded: number;
  publishProgressSteps: SessionWizardPublishProgressStep[];
  showPublishProgress: boolean;
};

export const buildSessionWizardPublishProgressSteps = ({
  publishBusy = false,
  publishStep = 0,
  publishSteps = [],
  sbtsLabel = 'SBTs',
}: {
  publishBusy?: boolean;
  publishStep?: number;
  publishSteps?: unknown[];
  sbtsLabel?: unknown;
} = {}): SessionWizardPublishProgressStep[] => {
  const normalizedSbtLabel = toStr(sbtsLabel).trim() || 'SBTs';
  const currentPublishStep = Math.max(0, Number(publishStep || 0));
  return (Array.isArray(publishSteps) ? publishSteps : []).map((keyRaw, index) => {
    const key = toStr(keyRaw).trim();
    const stepNumber = index + 1;
    const isActive = currentPublishStep === stepNumber && (publishBusy || key !== 'done');
    const isComplete = currentPublishStep > stepNumber || (key === 'done' && currentPublishStep >= stepNumber);
    return {
      key,
      label:
        key === 'deploy-worker'
          ? 'Deploy Worker'
          : key === 'deploy-sbts'
            ? `Deploy ${normalizedSbtLabel}`
            : key === 'upload-metadata'
              ? 'Upload Arweave'
              : key === 'persist-worker-config'
                ? 'Verify Worker Config'
                : key === 'create-worker-groups'
                  ? 'Create Groups'
                : key === 'register-session'
                  ? 'Register On-chain'
                  : 'Done',
      state: isActive ? 'active' : isComplete ? 'complete' : 'pending',
    };
  });
};

export const resolveSessionWizardPublishProgressDisplayState = ({
  elapsedMs = 0,
  publishBusy = false,
  publishStep = 0,
  publishSteps = [],
  sbtsLabel = 'SBTs',
}: {
  elapsedMs?: number;
  publishBusy?: boolean;
  publishStep?: number;
  publishSteps?: unknown[];
  sbtsLabel?: unknown;
} = {}): SessionWizardPublishProgressDisplayState => {
  const currentPublishStep = Math.max(0, Number(publishStep || 0));
  const publishProgressSteps = buildSessionWizardPublishProgressSteps({
    publishBusy,
    publishStep: currentPublishStep,
    publishSteps,
    sbtsLabel,
  });
  const activePublishProgressStep =
    publishProgressSteps[
      Math.max(0, Math.min((currentPublishStep || 1) - 1, Math.max(0, publishProgressSteps.length - 1)))
    ] ||
    publishProgressSteps[0] ||
    null;
  const publishProgressPercent = getSessionWizardPublishProgressPercent({
    publishStep: currentPublishStep,
    publishBusy,
    totalSteps: publishProgressSteps.length,
    elapsedMs,
  });
  const publishProgressPercentRounded = Math.round(publishProgressPercent);
  const activePublishProgressStepLabel = activePublishProgressStep?.label || 'Preparing';

  return {
    activePublishProgressStepLabel,
    publishProgressAriaValueText: `${publishProgressPercentRounded}% ${activePublishProgressStepLabel}`,
    publishProgressEyebrow: publishBusy ? 'Publishing Session' : 'Publish Complete',
    publishStep: currentPublishStep,
    publishProgressPercent,
    publishProgressPercentRounded,
    publishProgressSteps,
    showPublishProgress: !!publishBusy || currentPublishStep > 0,
  };
};
