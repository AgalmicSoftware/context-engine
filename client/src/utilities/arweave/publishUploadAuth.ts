import { toStr } from '../shared/primitives.js';
import { normalizeWorkerUrl } from '../worker/workerUrl.js';

const BOOTSTRAP_REACHABILITY_PATTERNS = Object.freeze([
  'worker url is missing',
  'failed to reach worker auth endpoint',
  'worker auth nonce route not supported',
  'worker auth login route not supported',
  'failed to fetch',
  'network request failed',
  'networkerror',
  'load failed',
  'fetch failed',
]);

export const isPublishUploadBootstrapReachabilityError = (error: unknown): boolean => {
  const message = toStr(error && typeof error === 'object' && 'message' in error ? error.message : error)
    .trim()
    .toLowerCase();
  if (!message) return false;
  return BOOTSTRAP_REACHABILITY_PATTERNS.some((pattern) => message.includes(pattern));
};

export const resolvePublishArweaveUploadOptions = async ({
  arweaveJwk = '',
  workerUrl = '',
  buildAdminAuth = null,
  preferDirectArweaveUpload = false,
  allowDirectFallbackOnBootstrapFailure = false,
  requireAdminAuthWithoutJwk = false,
  missingAdminAuthMessage = 'Arweave bootstrap signing is unavailable for this upload.',
}: {
  arweaveJwk?: unknown;
  workerUrl?: unknown;
  buildAdminAuth?: ((args: { workerUrl: string }) => Promise<Record<string, unknown> | null>) | null;
  preferDirectArweaveUpload?: boolean;
  allowDirectFallbackOnBootstrapFailure?: boolean;
  requireAdminAuthWithoutJwk?: boolean;
  missingAdminAuthMessage?: unknown;
} = {}) => {
  const resolvedArweaveJwk = toStr(arweaveJwk).trim();
  const resolvedWorkerUrl = normalizeWorkerUrl(toStr(workerUrl).trim());
  const baseOptions = {
    forceDirectArweaveUpload: false,
    arweaveJwk: resolvedArweaveJwk,
    workerUrl: resolvedWorkerUrl,
    skipAuth: !!resolvedArweaveJwk,
    adminAuth: null,
  };

  if (resolvedArweaveJwk && preferDirectArweaveUpload) {
    return {
      ...baseOptions,
      forceDirectArweaveUpload: true,
    };
  }

  if (!resolvedWorkerUrl) {
    if (!resolvedArweaveJwk && requireAdminAuthWithoutJwk) {
      throw new Error('Worker URL is missing.');
    }
    return baseOptions;
  }

  if (!resolvedArweaveJwk && !requireAdminAuthWithoutJwk) {
    return baseOptions;
  }

  if (typeof buildAdminAuth !== 'function') {
    throw new Error(
      toStr(missingAdminAuthMessage).trim() || 'Arweave bootstrap signing is unavailable for this upload.',
    );
  }

  try {
    // Regression guard: Session Wizard metadata goes direct when a sponsored
    // JWK is already loaded, but deferred SBT uploads still prefer the worker
    // until bootstrap auth is unreachable right after deploy.
    const adminAuth = await buildAdminAuth({ workerUrl: resolvedWorkerUrl });
    if (!adminAuth || typeof adminAuth !== 'object') {
      throw new Error('Arweave bootstrap signing did not return admin auth.');
    }
    return {
      ...baseOptions,
      skipAuth: true,
      adminAuth,
    };
  } catch (error) {
    if (
      resolvedArweaveJwk &&
      allowDirectFallbackOnBootstrapFailure &&
      isPublishUploadBootstrapReachabilityError(error)
    ) {
      return {
        ...baseOptions,
        forceDirectArweaveUpload: true,
      };
    }
    throw error;
  }
};
