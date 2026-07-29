import {
  MAX_WORKER_GROUP_IMAGE_BYTES,
  resolveWorkerGroupImageUrl,
  uploadWorkerGroupImage,
  validateWorkerGroupImageFile,
} from './workerGroupImageUpload';

const cloudflareSessionConfig = {
  storageProfile: {
    backend: 'cloudflare',
    payloadAccessControl: {
      gate: 'none',
      encryption: 'none',
    },
  },
};

describe('workerGroupImageUpload', () => {
  it('uploads a Worker-native image through session storage and returns its public Worker URL', async () => {
    const uploadData = jest.fn(async () => ({
      storage: 'cloudflare',
      storageRef: {
        backend: 'cloudflare',
        id: 'cf_01j7safeopaqueid',
        uri: '/storage/read?id=cf_01j7safeopaqueid',
        contentType: 'image/png',
        resource: 'images',
      },
    }));
    const file = new File(['image-bytes'], 'group.png', { type: 'image/png' });

    const result = await uploadWorkerGroupImage({
      file,
      sessionSlug: 'demo-sh',
      sessionConfig: cloudflareSessionConfig,
      workerUrl: 'https://demo-sh-worker.example/',
      credentialToken: 'participant-token',
      uploadData: uploadData as never,
    });

    expect(result).toBe('https://demo-sh-worker.example/storage/read?id=cf_01j7safeopaqueid');
    expect(uploadData).toHaveBeenCalledWith(
      file,
      'png',
      expect.objectContaining({
        sessionSlug: 'demo-sh',
        sessionConfig: cloudflareSessionConfig,
        workerUrl: 'https://demo-sh-worker.example',
        credentialToken: 'participant-token',
        resource: 'images',
        contentType: 'image/png',
      }),
    );
  });

  it('normalizes Arweave image storage references to an HTTPS gateway URL', () => {
    const txId = 'abc123abc123abc123abc123abc123abc123abc1230';
    expect(
      resolveWorkerGroupImageUrl({
        result: {
          storageRef: {
            backend: 'arweave',
            id: txId,
            uri: `ar://${txId}`,
          },
        },
        workerUrl: 'https://worker.example',
      }),
    ).toBe(`https://arweave.net/${txId}`);
  });

  it('rejects unsupported, oversized, and encrypted image uploads before storage mutation', async () => {
    const unsupported = new File(['svg'], 'group.svg', { type: 'image/svg+xml' });
    expect(validateWorkerGroupImageFile(unsupported)).toMatch(/PNG, JPEG, GIF, or WebP/i);

    const oversized = new File(['large'], 'group.png', { type: 'image/png' });
    Object.defineProperty(oversized, 'size', { value: MAX_WORKER_GROUP_IMAGE_BYTES + 1 });
    expect(validateWorkerGroupImageFile(oversized)).toMatch(/too large/i);

    const uploadData = jest.fn();
    await expect(
      uploadWorkerGroupImage({
        file: new File(['image'], 'group.png', { type: 'image/png' }),
        sessionSlug: 'private-session',
        sessionConfig: {
          storageProfile: {
            backend: 'cloudflare',
            payloadAccessControl: {
              gate: 'none',
              encryption: 'lit',
            },
          },
        },
        workerUrl: 'https://private-worker.example',
        uploadData: uploadData as never,
      }),
    ).rejects.toThrow(/encrypted image storage/i);
    expect(uploadData).not.toHaveBeenCalled();
  });
});
