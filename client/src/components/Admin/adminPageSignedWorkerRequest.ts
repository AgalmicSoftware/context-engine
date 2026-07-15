import { normalizeWorkerUrl } from './adminPageHelpers';
import {
  ADMIN_ACTION_NONCE_RETRY_ATTEMPTS,
  isRetryableAdminNonceFailure,
  normalizeAdminWorkerFetchError,
  sleep,
} from './adminPageWorkerErrorHelpers';

export type AdminSignedWorkerRequestArgs = {
  action?: string;
  body?: Record<string, unknown>;
  path?: string;
  chainId?: unknown;
  workerUrl?: unknown;
  retryAttempts?: number;
};

type AdminActionSigner = (args: {
  action: string;
  body: Record<string, unknown>;
  chainId: unknown;
  workerUrl: string;
}) => Promise<Record<string, unknown>>;

type AdminSignedWorkerRequestRuntime = AdminSignedWorkerRequestArgs & {
  signAdminAction: AdminActionSigner;
  fetchImpl?: typeof fetch;
  sleepImpl?: typeof sleep;
};

export const postSignedAdminWorkerRequest = async ({
  action = 'set-config',
  body = {},
  path = '',
  chainId = null,
  workerUrl,
  retryAttempts = ADMIN_ACTION_NONCE_RETRY_ATTEMPTS,
  signAdminAction,
  fetchImpl = fetch,
  sleepImpl = sleep,
}: AdminSignedWorkerRequestRuntime) => {
  const baseUrl = normalizeWorkerUrl(workerUrl);
  if (!baseUrl) throw new Error('Worker URL is missing.');

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    const auth = await signAdminAction({ action, body, chainId, workerUrl: baseUrl });
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, ...auth }),
      });
    } catch (error) {
      throw new Error(normalizeAdminWorkerFetchError({ error, workerBase: baseUrl }));
    }

    const data = await response.json().catch(() => ({}));
    if (response.ok) return { baseUrl, response, data };

    const responseError = data?.error || '';
    if (attempt < retryAttempts && isRetryableAdminNonceFailure({ responseStatus: response.status, responseError })) {
      // A concurrent admin action may have consumed the nonce. Re-sign rather
      // than surfacing a transient failure to the admin.
      // eslint-disable-next-line no-await-in-loop
      await sleepImpl(250 * attempt);
      continue;
    }

    lastError = new Error(
      normalizeAdminWorkerFetchError({
        error: responseError || `Request failed (${response.status}).`,
        workerBase: baseUrl,
        responseStatus: response.status,
        responseError,
      }),
    );
    throw lastError;
  }

  throw lastError || new Error(`Failed admin action: ${action}`);
};
