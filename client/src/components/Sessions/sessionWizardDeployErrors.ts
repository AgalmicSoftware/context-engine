import { toStr } from '../../utilities/shared/primitives.js';
import { CLOUDFLARE_MISSING_HANDLER_ERROR, DEPLOY_HELPER_BUNDLE_FETCH_ERROR } from './sessionWizardPublishFlow';

type SessionWizardDeployRecord = Record<string, unknown>;
type ResolveSessionWizardDeployStatusDisplayStateArgs = {
  deployInFlight?: unknown;
  deployStatus?: unknown;
  deployVerifiedInUi?: unknown;
  workerCanonicalPublishCompleted?: unknown;
};
export type SessionWizardDeployStatusDisplayState = {
  deployButtonDisabled: boolean;
  deployStatusText: string;
  isError: boolean;
};

const asDeployRecord = (value: unknown): SessionWizardDeployRecord =>
  value !== null && typeof value === 'object' ? (value as SessionWizardDeployRecord) : {};

const resolveCurrentOrigin = (value: unknown = undefined): string => {
  const override = toStr(value).trim();
  if (override) return override;
  return typeof window !== 'undefined' && window.location ? toStr(window.location.origin).trim() : '';
};

export const buildSessionWizardDeployHelperCorsMessage = ({
  helperBase,
  detail = '',
  currentOrigin,
}: {
  helperBase?: unknown;
  detail?: unknown;
  currentOrigin?: unknown;
} = {}): string => {
  const origin = resolveCurrentOrigin(currentOrigin) || '<current-origin>';
  const helper = toStr(helperBase).trim() || 'deploy-helper';
  const suffix = detail ? ` (${toStr(detail).trim()})` : '';
  return `Deploy-helper rejected browser origin ${origin}${suffix}. Add this origin to the deploy-helper allowlist at ${helper} and retry.`;
};

export const buildSessionWizardDeployHelperWorkersDevStatusMessage = (deployResponse: unknown = {}): string => {
  const response = asDeployRecord(deployResponse);
  const subdomain = toStr(response?.subdomain).trim();
  const subdomainStatus = toStr(response?.subdomainStatus).trim();
  const subdomainError = toStr(response?.subdomainError).trim();
  const scriptSubdomainError = toStr(response?.scriptSubdomainError).trim();
  const hasAccountSignal =
    subdomain ||
    subdomainStatus ||
    subdomainError ||
    Object.prototype.hasOwnProperty.call(response, 'subdomainEnabled');
  const hasScriptSignal =
    scriptSubdomainError || Object.prototype.hasOwnProperty.call(response, 'scriptSubdomainEnabled');
  if (!hasAccountSignal && !hasScriptSignal) return '';

  let accountSummary = '';
  if (subdomainError) {
    accountSummary = subdomain ? `account issue (${subdomain}): ${subdomainError}` : `account issue: ${subdomainError}`;
  } else if (subdomainStatus) {
    accountSummary = subdomain ? `account ${subdomainStatus} (${subdomain})` : `account ${subdomainStatus}`;
  } else if (subdomain) {
    accountSummary = `account ready (${subdomain})`;
  }

  let scriptSummary = '';
  if (scriptSubdomainError) {
    scriptSummary = `script issue: ${scriptSubdomainError}`;
  } else if (response?.scriptSubdomainEnabled === true) {
    scriptSummary = 'script enabled';
  } else if (
    Object.prototype.hasOwnProperty.call(response, 'scriptSubdomainEnabled') &&
    (subdomain || toStr(response?.workerUrl).trim())
  ) {
    scriptSummary = 'script not confirmed';
  }

  const summary = [accountSummary, scriptSummary].filter(Boolean).join('; ');
  return summary ? `workers.dev status: ${summary}.` : '';
};

export const withSessionWizardDeployHelperWorkersDevStatus = (message = '', deployResponse: unknown = {}): string => {
  const base = toStr(message).trim();
  const workersDevStatus = buildSessionWizardDeployHelperWorkersDevStatusMessage(deployResponse);
  if (!workersDevStatus) return base;
  return base ? `${base} ${workersDevStatus}` : workersDevStatus;
};

export const resolveSessionWizardDeployStatusDisplayState = ({
  deployInFlight = false,
  deployStatus = '',
  deployVerifiedInUi = false,
  workerCanonicalPublishCompleted = false,
}: ResolveSessionWizardDeployStatusDisplayStateArgs = {}): SessionWizardDeployStatusDisplayState => {
  const deployStatusText = toStr(deployStatus);
  const deployStatusLower = deployStatusText.toLowerCase();
  return {
    deployButtonDisabled: !!deployInFlight || !!workerCanonicalPublishCompleted,
    deployStatusText,
    isError:
      !!deployStatusText && !deployInFlight && !deployVerifiedInUi && !deployStatusLower.includes('worker deployed'),
  };
};

export const formatSessionWizardDeployBundleDiagnostics = (bundleDiagnostics: unknown = {}): string => {
  const diagnostics = asDeployRecord(bundleDiagnostics);
  const sha256 = toStr(diagnostics?.sha256).trim();
  const parts = [
    `source=${toStr(diagnostics?.source).trim() || 'unknown'}`,
    `len=${Number(diagnostics?.length || 0) || 0}`,
    `sha256=${sha256 ? sha256.slice(0, 16) : 'n/a'}`,
    `export=${diagnostics?.hasAnyExport === true ? '1' : '0'}`,
    `default=${diagnostics?.hasExportDefault === true ? '1' : '0'}`,
    `namedDefault=${diagnostics?.hasNamedDefaultExport === true ? '1' : '0'}`,
    `fetch=${diagnostics?.hasFetchHandler === true ? '1' : '0'}`,
    `swFetch=${diagnostics?.hasServiceWorkerFetch === true ? '1' : '0'}`,
  ];
  return parts.join(' ');
};

const RETAINED_KV_CLEANUP_STATUSES = new Set([
  'retained-live-worker',
  'retained-upload-pending',
  'retained-pre-existing',
  'retained-config-propagation-pending',
]);

const WORKER_MAY_STILL_OWN_KV_STATUSES = new Set([
  'preserved-existing',
  'retained-pre-existing',
  'retained-config-propagation-pending',
  'ownership-changed',
  'ownership-unverified',
]);

const buildRetainedKvGuidance = ({
  kvNamespaceId,
  kvCleanupStatus,
}: {
  kvNamespaceId: string;
  kvCleanupStatus: string;
}): string => {
  if (kvCleanupStatus === 'retained-upload-pending') {
    return ` KV namespace ${kvNamespaceId} was retained for safe deployment retry. Retry normally so Context Engine can recover the same deployment. Do not delete the namespace while recovery is pending.`;
  }
  if (kvCleanupStatus === 'retained-pre-existing') {
    return ` KV namespace ${kvNamespaceId} belongs to the existing deployment and was retained. Retry normally or inspect its Worker binding in Cloudflare. Do not delete the namespace before ownership is verified.`;
  }
  if (kvCleanupStatus === 'retained-config-propagation-pending') {
    return ` KV namespace ${kvNamespaceId} remains bound while worker config propagation completes. Retry normally so Context Engine can finish verification. Do not delete the namespace.`;
  }
  return ` KV namespace ${kvNamespaceId} was retained because it remains or may remain bound to the live worker. Do not delete it before recovery or ownership verification.`;
};

export const formatSessionWizardDeployOrphanResources = (value: unknown = {}): string => {
  const resources = asDeployRecord(value);
  const workerName = toStr(resources?.workerName).trim();
  const kvNamespaceId = toStr(resources?.kvNamespaceId).trim();
  const kvCleanupStatus = toStr(resources?.kvCleanupStatus).trim();
  const workerCleanupStatus = toStr(resources?.workerCleanupStatus).trim();
  const workerMayStillOwnKv = WORKER_MAY_STILL_OWN_KV_STATUSES.has(workerCleanupStatus);
  const retainedKv =
    !!kvNamespaceId && (RETAINED_KV_CLEANUP_STATUSES.has(kvCleanupStatus) || (!kvCleanupStatus && workerMayStillOwnKv));
  const labels = [
    workerName && workerCleanupStatus === 'owned-delete-failed' ? `worker ${workerName}` : '',
    kvNamespaceId && !retainedKv ? `KV namespace ${kvNamespaceId}` : '',
  ].filter(Boolean);
  const cleanupInstruction = labels.length
    ? ` Cleanup incomplete: remove ${labels.join(' and ')} in Cloudflare before retrying.`
    : '';
  const ownershipNote =
    workerCleanupStatus === 'preserved-existing'
      ? ' The pre-existing worker was preserved.'
      : workerCleanupStatus === 'retained-pre-existing'
        ? ' The existing worker and deployment state were preserved.'
        : workerCleanupStatus === 'retained-config-propagation-pending'
          ? ' Worker config propagation is still pending; the deployment was preserved for recovery.'
          : workerCleanupStatus === 'ownership-changed'
            ? ' A newer or foreign worker deployment was detected and preserved.'
            : workerCleanupStatus === 'ownership-unverified'
              ? ' Worker ownership could not be verified, so no worker deletion was attempted.'
              : '';
  const retainedKvNote = retainedKv ? buildRetainedKvGuidance({ kvNamespaceId, kvCleanupStatus }) : '';
  return `${cleanupInstruction}${ownershipNote}${retainedKvNote}`;
};

export const normalizeSessionWizardDeployErrorMessage = ({
  err,
  helperBase,
  currentOrigin,
}: {
  err?: unknown;
  helperBase?: unknown;
  currentOrigin?: unknown;
} = {}): string => {
  const error = asDeployRecord(err);
  const raw = toStr(error?.message || (typeof err === 'string' || typeof err === 'number' ? err : '')).trim();
  const lowered = raw.toLowerCase();
  const statusCode = Number(error?.statusCode || 0);
  const responseError = toStr(error?.responseError).trim();
  const responseLower = responseError.toLowerCase();
  const isTerminalDeploymentConflict =
    error?.responseDeploymentRequestConflict === true && error?.responseDeploymentRequestTerminal === true;
  const bundleDiagnostics = error?.responseBundleDiagnostics;
  const diagnosticsSummary = bundleDiagnostics ? formatSessionWizardDeployBundleDiagnostics(bundleDiagnostics) : '';
  const orphanResourcesSummary = formatSessionWizardDeployOrphanResources(error?.responseOrphanResources);
  const withOrphanResources = (message: string): string => `${message}${orphanResourcesSummary}`;

  if ((statusCode === 403 && responseLower.includes('origin')) || responseLower.includes('origin not allowed')) {
    return withOrphanResources(
      buildSessionWizardDeployHelperCorsMessage({
        helperBase,
        detail: responseError || 'Origin not allowed',
        currentOrigin,
      }),
    );
  }
  if (lowered.includes('origin not allowed')) {
    return withOrphanResources(
      buildSessionWizardDeployHelperCorsMessage({
        helperBase,
        detail: raw,
        currentOrigin,
      }),
    );
  }
  if (lowered.includes(DEPLOY_HELPER_BUNDLE_FETCH_ERROR) || responseLower.includes(DEPLOY_HELPER_BUNDLE_FETCH_ERROR)) {
    return withOrphanResources(raw || responseError);
  }
  if (lowered.includes('failed to fetch') || lowered.includes('networkerror')) {
    const helper = toStr(helperBase).trim() || 'deploy-helper';
    const origin = resolveCurrentOrigin(currentOrigin) || '<current-origin>';
    return withOrphanResources(
      `Deploy request could not reach ${helper}. This is usually CORS or helper availability; ensure ${origin} is allowed and retry.`,
    );
  }
  if (
    (lowered.includes(CLOUDFLARE_MISSING_HANDLER_ERROR) || responseLower.includes(CLOUDFLARE_MISSING_HANDLER_ERROR)) &&
    diagnosticsSummary
  ) {
    const base = raw || responseError || 'Worker deploy failed.';
    return withOrphanResources(`${base} Bundle diagnostics: ${diagnosticsSummary}`);
  }
  if (isTerminalDeploymentConflict) {
    const base = raw || responseError || 'This deployment attempt cannot be reused.';
    return withOrphanResources(
      `${base} Review the account and session details, then click Deploy worker again to start a fresh deployment attempt.`,
    );
  }
  if (raw) return withOrphanResources(raw);
  if (statusCode > 0) return withOrphanResources(`Worker deploy failed (${statusCode}).`);
  return withOrphanResources('Worker deploy failed.');
};
