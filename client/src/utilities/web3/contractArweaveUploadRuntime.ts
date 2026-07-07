/**
 * @module contractArweaveUploadRuntime
 * @description Shared Arweave upload runtime helpers extracted from contractScripts.
 *              Handles worker bootstrap auth, retry classification, and retry-wrapped uploads.
 *
 * Key exports: buildArweaveUploadBootstrapAuth, isRetryableArweaveUploadError, uploadDataToArweaveWithRetry
 */

import { ethers } from 'ethers';
import { arweaveScripts } from '../arweave/arweaveScripts.js';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { buildSiweMessage } from '../worker/workerAuth.js';
import { normalizeSessionSlug } from './sessionConfigResolvers.js';

type SignerLike = {
  getAddress: () => Promise<string> | string;
  signMessage: (message: string) => Promise<string> | string;
};
type SessionConfigFields = {
  networkChainId?: unknown;
  slug?: unknown;
};
type ErrorMessageSource = {
  message?: unknown;
};
type NonceResponseBody = {
  error?: unknown;
  nonce?: unknown;
};
type BuildArweaveUploadBootstrapAuthOptions = {
  signer?: unknown;
  providerLike?: unknown;
  sessionSlug?: unknown;
  sessionConfig?: unknown;
};
type BuildArweaveUploadBootstrapAuthResult = {
  address: string;
  message: string;
  signature: string;
  sessionSlug: string;
};
type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
};

const asSignerLike = (value: unknown): SignerLike | null =>
  value &&
  typeof value === 'object' &&
  typeof (value as Partial<SignerLike>).signMessage === 'function' &&
  typeof (value as Partial<SignerLike>).getAddress === 'function'
    ? (value as SignerLike)
    : null;

const asSessionConfigFields = (value: unknown): SessionConfigFields =>
  value && typeof value === 'object' ? (value as SessionConfigFields) : {};

const asErrorMessageSource = (value: unknown): ErrorMessageSource =>
  value && typeof value === 'object' ? (value as ErrorMessageSource) : {};

export const buildArweaveUploadBootstrapAuth = async ({
  signer = null,
  providerLike = null,
  sessionSlug = '',
  sessionConfig = null,
}: BuildArweaveUploadBootstrapAuthOptions = {}): Promise<BuildArweaveUploadBootstrapAuthResult | null> => {
  const signerLike = asSignerLike(signer);
  if (!signerLike) return null;
  const sessionConfigFields = asSessionConfigFields(sessionConfig);
  const slug = normalizeSessionSlug(sessionSlug || sessionConfigFields.slug || '');
  let signerAddress = '';
  try {
    signerAddress = await signerLike.getAddress();
  } catch (_) {
    signerAddress = '';
  }
  if (!signerAddress) return null;

  const chainId = Number(sessionConfigFields.networkChainId || 0) || 1;
  const workerUrl = await getCorsProxyUrlOrThrow({
    sessionSlug: slug,
    sessionConfig,
    context: {
      account: signerAddress,
      providerLike,
      chainId,
    },
  });

  const nonceResp = await fetch(`${workerUrl}/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: signerAddress,
      sessionSlug: slug,
    }),
  });
  const nonceData = (await nonceResp.json().catch(() => ({}))) as NonceResponseBody;
  if (!nonceResp.ok) {
    throw new Error(String(nonceData?.error || 'Failed to request Arweave bootstrap nonce.'));
  }

  const message = buildSiweMessage({
    address: signerAddress,
    nonce: nonceData?.nonce,
    chainId,
    statement: 'Admin request: bootstrap arweave upload',
  });
  const signature = await signerLike.signMessage(message);
  const recovered = ethers.utils.verifyMessage(message, signature);
  if (!recovered || recovered.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error('Arweave bootstrap signature does not match signer address.');
  }

  return {
    address: signerAddress,
    message,
    signature,
    sessionSlug: slug,
  };
};

export const isRetryableArweaveUploadError = (error: unknown): boolean => {
  const source = asErrorMessageSource(error);
  const msg = String(source.message || error || '').toLowerCase();
  if (!msg) return false;

  // Worker errors can bubble up as e.g. "Arweave post failed (504)" where the
  // gateway status is embedded in the message rather than the HTTP status.
  const statusMatch = msg.match(/arweave (?:post|upload) failed \((\d{3})\)/);
  if (statusMatch) {
    const status = Number.parseInt(statusMatch[1], 10);
    if ([400, 404, 425, 429, 500, 502, 503, 504].includes(status)) return true;
  }
  return (
    msg.includes('arweave post failed (400)') ||
    msg.includes('arweave upload failed (500)') ||
    msg.includes('arweave upload network error') ||
    msg.includes('rate limit') ||
    msg.includes('timeout') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('bad gateway') ||
    msg.includes('service unavailable')
  );
};

export const uploadDataToArweaveWithRetry = async (
  data: unknown,
  format: unknown,
  opts: unknown,
  { attempts = 3, baseDelayMs = 350 }: RetryOptions = {},
): Promise<unknown> => {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await arweaveScripts.uploadDataToArweave(data, format, opts as Record<string, unknown> | undefined);
    } catch (err) {
      lastErr = err;
      if (i >= attempts - 1 || !isRetryableArweaveUploadError(err)) {
        throw err;
      }
      const delay = Math.round(baseDelayMs * Math.pow(1.7, i));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr || new Error('Arweave upload failed.');
};
