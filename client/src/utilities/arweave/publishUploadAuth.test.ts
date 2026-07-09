import { isPublishUploadBootstrapReachabilityError, resolvePublishArweaveUploadOptions } from './publishUploadAuth.js';

describe('publishUploadAuth helpers', () => {
  it('goes direct first when a sponsored JWK is already available for wizard publish uploads', async () => {
    const buildAdminAuth = jest.fn(async () => ({
      address: '0xabc',
      signature: '0xsigned',
    }));

    await expect(
      resolvePublishArweaveUploadOptions({
        arweaveJwk: '{"kty":"RSA"}',
        workerUrl: 'https://worker.example/auth/nonce',
        preferDirectArweaveUpload: true,
        requireAdminAuthWithoutJwk: true,
        buildAdminAuth,
      }),
    ).resolves.toEqual({
      forceDirectArweaveUpload: true,
      arweaveJwk: '{"kty":"RSA"}',
      workerUrl: 'https://worker.example',
      skipAuth: true,
      adminAuth: null,
    });

    expect(buildAdminAuth).not.toHaveBeenCalled();
  });

  it('falls back to direct upload when deferred publish bootstrap auth hits a reachability failure and a JWK is present', async () => {
    const buildAdminAuth = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(
      resolvePublishArweaveUploadOptions({
        arweaveJwk: '{"kty":"RSA"}',
        workerUrl: 'https://worker.example',
        allowDirectFallbackOnBootstrapFailure: true,
        buildAdminAuth,
      }),
    ).resolves.toEqual({
      forceDirectArweaveUpload: true,
      arweaveJwk: '{"kty":"RSA"}',
      workerUrl: 'https://worker.example',
      skipAuth: true,
      adminAuth: null,
    });
  });

  it('does not fall back when no JWK is available and bootstrap auth fails', async () => {
    const buildAdminAuth = jest.fn(async () => {
      throw new Error('Failed to reach worker auth endpoint (https://worker.example/auth/nonce).');
    });

    await expect(
      resolvePublishArweaveUploadOptions({
        arweaveJwk: '',
        workerUrl: 'https://worker.example',
        requireAdminAuthWithoutJwk: true,
        buildAdminAuth,
      }),
    ).rejects.toThrow('Failed to reach worker auth endpoint');
  });

  it('uses worker admin auth when no direct JWK is available for hosted uploads', async () => {
    const adminAuth = {
      address: '0x00000000000000000000000000000000000000aa',
      message: 'admin upload',
      signature: '0xsigned',
      sessionSlug: 'hosted-session',
    };
    const buildAdminAuth = jest.fn(async () => adminAuth);

    await expect(
      resolvePublishArweaveUploadOptions({
        arweaveJwk: '',
        workerUrl: 'https://worker.example/auth/login',
        requireAdminAuthWithoutJwk: true,
        buildAdminAuth,
      }),
    ).resolves.toEqual({
      forceDirectArweaveUpload: false,
      arweaveJwk: '',
      workerUrl: 'https://worker.example',
      skipAuth: true,
      adminAuth,
    });

    expect(buildAdminAuth).toHaveBeenCalledWith({ workerUrl: 'https://worker.example' });
  });

  it('fails closed for hosted uploads when no worker URL or JWK is available', async () => {
    await expect(
      resolvePublishArweaveUploadOptions({
        arweaveJwk: '',
        workerUrl: '',
        requireAdminAuthWithoutJwk: true,
        buildAdminAuth: jest.fn(),
      }),
    ).rejects.toThrow('Worker URL is missing.');
  });

  it('does not fall back on logical auth errors even when a JWK is present', async () => {
    const buildAdminAuth = jest.fn(async () => {
      throw new Error('Typed data signature does not match signer address.');
    });

    await expect(
      resolvePublishArweaveUploadOptions({
        arweaveJwk: '{"kty":"RSA"}',
        workerUrl: 'https://worker.example',
        allowDirectFallbackOnBootstrapFailure: true,
        buildAdminAuth,
      }),
    ).rejects.toThrow('Typed data signature does not match signer address.');
  });

  it('classifies normalized reachability messages for deferred fallback decisions', () => {
    expect(
      isPublishUploadBootstrapReachabilityError(
        new Error(
          'Failed to reach worker auth endpoint (https://worker.example/auth/nonce). Check worker URL and allowOrigins includes http://localhost:3000.',
        ),
      ),
    ).toBe(true);
    expect(isPublishUploadBootstrapReachabilityError(new Error('Connect a wallet to sign admin requests.'))).toBe(
      false,
    );
  });
});
