import { toStr } from '../../utilities/shared/primitives.js';
import {
  CLOUDFLARE_MISSING_HANDLER_ERROR,
  DEPLOY_HELPER_BUNDLE_FETCH_ERROR,
} from './sessionWizardPublishFlow';
import type { AnyRecord } from '../shellTypes';

const resolveCurrentOrigin = (value: unknown = undefined): string => {
  const override = toStr(value).trim();
  if (override) return override;
  return (
    typeof window !== 'undefined' && window.location
      ? toStr(window.location.origin).trim()
      : ''
  );
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

export const buildSessionWizardDeployHelperWorkersDevStatusMessage = (
  deployResponse: AnyRecord = {}
): string => {
  const response: AnyRecord = deployResponse && typeof deployResponse === 'object' ? deployResponse : {};
  const subdomain = toStr(response?.subdomain).trim();
  const subdomainStatus = toStr(response?.subdomainStatus).trim();
  const subdomainError = toStr(response?.subdomainError).trim();
  const scriptSubdomainError = toStr(response?.scriptSubdomainError).trim();
  const hasAccountSignal = (
    subdomain ||
    subdomainStatus ||
    subdomainError ||
    Object.prototype.hasOwnProperty.call(response, 'subdomainEnabled')
  );
  const hasScriptSignal = (
    scriptSubdomainError ||
    Object.prototype.hasOwnProperty.call(response, 'scriptSubdomainEnabled')
  );
  if (!hasAccountSignal && !hasScriptSignal) return '';

  let accountSummary = '';
  if (subdomainError) {
    accountSummary = subdomain
      ? `account issue (${subdomain}): ${subdomainError}`
      : `account issue: ${subdomainError}`;
  } else if (subdomainStatus) {
    accountSummary = subdomain
      ? `account ${subdomainStatus} (${subdomain})`
      : `account ${subdomainStatus}`;
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

export const withSessionWizardDeployHelperWorkersDevStatus = (
  message = '',
  deployResponse: AnyRecord = {}
): string => {
  const base = toStr(message).trim();
  const workersDevStatus = buildSessionWizardDeployHelperWorkersDevStatusMessage(deployResponse);
  if (!workersDevStatus) return base;
  return base ? `${base} ${workersDevStatus}` : workersDevStatus;
};

export const formatSessionWizardDeployBundleDiagnostics = (bundleDiagnostics: AnyRecord = {}): string => {
  const sha256 = toStr(bundleDiagnostics?.sha256).trim();
  const parts = [
    `source=${toStr(bundleDiagnostics?.source).trim() || 'unknown'}`,
    `len=${Number(bundleDiagnostics?.length || 0) || 0}`,
    `sha256=${sha256 ? sha256.slice(0, 16) : 'n/a'}`,
    `export=${bundleDiagnostics?.hasAnyExport === true ? '1' : '0'}`,
    `default=${bundleDiagnostics?.hasExportDefault === true ? '1' : '0'}`,
    `namedDefault=${bundleDiagnostics?.hasNamedDefaultExport === true ? '1' : '0'}`,
    `fetch=${bundleDiagnostics?.hasFetchHandler === true ? '1' : '0'}`,
    `swFetch=${bundleDiagnostics?.hasServiceWorkerFetch === true ? '1' : '0'}`,
  ];
  return parts.join(' ');
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
  const error = (err && typeof err === 'object') ? err as AnyRecord : {};
  const raw = toStr(
    error?.message ||
    (typeof err === 'string' || typeof err === 'number' ? err : '')
  ).trim();
  const lowered = raw.toLowerCase();
  const statusCode = Number(error?.statusCode || 0);
  const responseError = toStr(error?.responseError).trim();
  const responseLower = responseError.toLowerCase();
  const bundleDiagnostics = error?.responseBundleDiagnostics;
  const diagnosticsSummary = bundleDiagnostics
    ? formatSessionWizardDeployBundleDiagnostics(bundleDiagnostics)
    : '';

  if ((statusCode === 403 && responseLower.includes('origin')) || responseLower.includes('origin not allowed')) {
    return buildSessionWizardDeployHelperCorsMessage({
      helperBase,
      detail: responseError || 'Origin not allowed',
      currentOrigin,
    });
  }
  if (lowered.includes('origin not allowed')) {
    return buildSessionWizardDeployHelperCorsMessage({
      helperBase,
      detail: raw,
      currentOrigin,
    });
  }
  if (lowered.includes(DEPLOY_HELPER_BUNDLE_FETCH_ERROR) || responseLower.includes(DEPLOY_HELPER_BUNDLE_FETCH_ERROR)) {
    return raw || responseError;
  }
  if (lowered.includes('failed to fetch') || lowered.includes('networkerror')) {
    const helper = toStr(helperBase).trim() || 'deploy-helper';
    const origin = resolveCurrentOrigin(currentOrigin) || '<current-origin>';
    return `Deploy request could not reach ${helper}. This is usually CORS or helper availability; ensure ${origin} is allowed and retry.`;
  }
  if ((lowered.includes(CLOUDFLARE_MISSING_HANDLER_ERROR) || responseLower.includes(CLOUDFLARE_MISSING_HANDLER_ERROR)) && diagnosticsSummary) {
    const base = raw || responseError || 'Worker deploy failed.';
    return `${base} Bundle diagnostics: ${diagnosticsSummary}`;
  }
  if (raw) return raw;
  if (statusCode > 0) return `Worker deploy failed (${statusCode}).`;
  return 'Worker deploy failed.';
};
