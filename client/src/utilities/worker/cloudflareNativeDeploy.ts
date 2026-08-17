import { PUBLIC_REPO_URL } from '../../variables/publicRepoMetadata.js';

const CLOUDFLARE_NATIVE_DEPLOY_PACKAGE_PATH = 'deploy/cloudflare/session-worker';
export const CLOUDFLARE_NATIVE_DEPLOY_ORIGIN = 'https://deploy.workers.cloudflare.com/';

const FULL_GIT_COMMIT_RE = /^[a-f0-9]{40}$/i;

export const normalizeCloudflareNativeDeployCommit = (value: unknown): string => {
  const commit = String(value ?? '')
    .trim()
    .toLowerCase();
  return FULL_GIT_COMMIT_RE.test(commit) ? commit : '';
};

export const buildCloudflareNativeDeployUrl = ({
  commit,
  repositoryUrl = PUBLIC_REPO_URL,
}: {
  commit?: unknown;
  repositoryUrl?: string;
} = {}): string => {
  const immutableCommit = normalizeCloudflareNativeDeployCommit(commit);
  const normalizedRepositoryUrl = String(repositoryUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (!immutableCommit || !/^https:\/\/github\.com\//i.test(normalizedRepositoryUrl)) return '';

  const sourceUrl = `${normalizedRepositoryUrl}/tree/${immutableCommit}/${CLOUDFLARE_NATIVE_DEPLOY_PACKAGE_PATH}`;
  const deployUrl = new URL(CLOUDFLARE_NATIVE_DEPLOY_ORIGIN);
  deployUrl.searchParams.set('url', sourceUrl);
  return deployUrl.toString();
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');

type FillRandomBytes = (bytes: Uint8Array) => Uint8Array;

const fillWithWebCrypto: FillRandomBytes = (bytes) => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Secure browser randomness is unavailable. Do not continue this deployment.');
  }
  return cryptoApi.getRandomValues(bytes);
};

export const createCloudflareNativeSetupSecrets = (
  fillRandomBytes: FillRandomBytes = fillWithWebCrypto,
): { tokenHmacSecret: string; storageEnvelopeKek: string } => {
  const first = bytesToHex(fillRandomBytes(new Uint8Array(32)));
  const second = bytesToHex(fillRandomBytes(new Uint8Array(32)));
  if (!/^[a-f0-9]{64}$/.test(first) || !/^[a-f0-9]{64}$/.test(second) || first === second) {
    throw new Error('Secure setup-secret generation failed. Do not continue this deployment.');
  }
  return {
    tokenHmacSecret: first,
    storageEnvelopeKek: second,
  };
};
