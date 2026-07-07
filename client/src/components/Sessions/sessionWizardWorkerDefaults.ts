import { CLOUDFLARE_CORS_WORKER_URL } from '../../variables/appConfig.js';
import { buildWorkerAllowOrigins, DEFAULT_WORKER_ALLOWED_ORIGINS } from '../../utilities/worker/workerCorsOrigins.js';
import { normalizeWorkerUrl as normalizeWorkerAuthUrl } from '../../utilities/worker/workerAuth.js';
import { toStr } from '../../utilities/shared/primitives.js';

const getCurrentOrigin = () =>
  typeof window !== 'undefined' && window.location ? toStr(window.location.origin).trim() : '';

export const getSessionWizardDefaultWorkerUrl = (): string => toStr(CLOUDFLARE_CORS_WORKER_URL).trim();

export const isSessionWizardDefaultWorkerPlaceholderUrl = (
  workerUrl: unknown,
  fallbackWorkerUrl = getSessionWizardDefaultWorkerUrl(),
): boolean => {
  const normalizedWorkerUrl = normalizeWorkerAuthUrl(toStr(workerUrl).trim());
  const normalizedFallbackUrl = normalizeWorkerAuthUrl(toStr(fallbackWorkerUrl).trim());
  return !!normalizedWorkerUrl && !!normalizedFallbackUrl && normalizedWorkerUrl === normalizedFallbackUrl;
};

export const buildSessionWizardDefaultAllowedOrigins = (currentOrigin = getCurrentOrigin()): string[] =>
  buildWorkerAllowOrigins({
    currentOrigin,
    extraOrigins: DEFAULT_WORKER_ALLOWED_ORIGINS,
  });
