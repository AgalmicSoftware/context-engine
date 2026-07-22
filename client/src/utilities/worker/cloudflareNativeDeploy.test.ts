import {
  buildCloudflareNativeDeployUrl,
  createCloudflareNativeSetupSecrets,
  normalizeCloudflareNativeDeployCommit,
} from './cloudflareNativeDeploy';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';

describe('cloudflareNativeDeploy', () => {
  it('builds only immutable public-replay deploy URLs', () => {
    const url = new URL(buildCloudflareNativeDeployUrl({ commit: COMMIT }));
    expect(url.origin).toBe('https://deploy.workers.cloudflare.com');
    expect(url.searchParams.get('url')).toBe(
      `https://github.com/AgalmicSoftware/context-engine/tree/${COMMIT}/deploy/cloudflare/session-worker`,
    );
    expect(buildCloudflareNativeDeployUrl({ commit: 'main' })).toBe('');
    expect(buildCloudflareNativeDeployUrl({ commit: `${COMMIT}0` })).toBe('');
    expect(buildCloudflareNativeDeployUrl({ commit: COMMIT, repositoryUrl: 'https://example.test/repo' })).toBe('');
  });

  it('normalizes a full commit and rejects branch or abbreviated references', () => {
    expect(normalizeCloudflareNativeDeployCommit(COMMIT.toUpperCase())).toBe(COMMIT);
    expect(normalizeCloudflareNativeDeployCommit('main')).toBe('');
    expect(normalizeCloudflareNativeDeployCommit(COMMIT.slice(0, 12))).toBe('');
  });

  it('generates two independent 32-byte setup secrets', () => {
    let fill = 0;
    const secrets = createCloudflareNativeSetupSecrets((bytes) => {
      fill += 1;
      bytes.fill(fill);
      return bytes;
    });

    expect(secrets.tokenHmacSecret).toBe('01'.repeat(32));
    expect(secrets.storageEnvelopeKek).toBe('02'.repeat(32));
  });

  it('fails closed if setup secrets are not independent', () => {
    expect(() => createCloudflareNativeSetupSecrets((bytes) => bytes.fill(7))).toThrow(/failed/i);
  });
});
