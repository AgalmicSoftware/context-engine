import {
  buildSponsoredBundlePlaintext,
  buildSponsoredSessionUrl,
  generateSponsoredBundleSecret,
  hasSponsoredBundleFields,
  normalizeSponsoredBundlePayload,
  readSponsoredBundleFromArweave,
  SPONSORED_BUNDLE_CIPHER,
  SPONSORED_BUNDLE_TYPE,
  SPONSORED_BUNDLE_VERSION,
  uploadSponsoredBundle,
} from './sponsoredBundles.js';

const mockEncryptWithPassword = jest.fn();
const mockDecryptWithPassword = jest.fn();
const mockUploadDataToArweave = jest.fn();
const mockDownloadDataFromArweave = jest.fn();
const env = process.env as Record<string, string | undefined>;

jest.mock('../crypto/cryptography.js', () => ({
  cryptoUtils: {
    encryptWithPassword: (...args: unknown[]) => mockEncryptWithPassword(...args),
    decryptWithPassword: (...args: unknown[]) => mockDecryptWithPassword(...args),
  },
}));

jest.mock('./arweaveScripts.js', () => ({
  arweaveScripts: {
    uploadDataToArweave: (...args: unknown[]) => mockUploadDataToArweave(...args),
    downloadDataFromArweave: (...args: unknown[]) => mockDownloadDataFromArweave(...args),
  },
}));

describe('sponsoredBundles', () => {
  const originalPublicUrl = env.PUBLIC_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    if (originalPublicUrl === undefined) delete env.PUBLIC_URL;
    else env.PUBLIC_URL = originalPublicUrl;
    mockEncryptWithPassword.mockResolvedValue('encrypted-base64');
    mockDecryptWithPassword.mockResolvedValue({
      openaiKey: 'sk-openai',
      anthropicKey: 'sk-anthropic',
      openrouterKey: 'sk-openrouter',
      arweaveJwk: '{"kty":"RSA"}',
      faucetPrivateKey: '0xfaucet',
      customRpcUrl: 'https://rpc.example',
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
      litAccountApiKey: 'lit-account-secret',
      litUsageApiKey: 'lit-secret',
      customRpcKey: 'should-be-ignored',
      meta: {
        label: 'Launch Week',
        createdAt: '2099-03-20T12:00:00.000Z',
        createdBy: '0xadmin',
        expiresAt: '2099-03-21T12:00:00.000Z',
        sourceSessionSlug: 'edge',
        sourceWorkerUrl: 'https://worker.example',
      },
    });
    mockUploadDataToArweave.mockResolvedValue('arweave_tx_id');
  });

  afterAll(() => {
    if (originalPublicUrl === undefined) delete env.PUBLIC_URL;
    else env.PUBLIC_URL = originalPublicUrl;
  });

  it('builds the expected sponsored URL shape', () => {
    expect(
      buildSponsoredSessionUrl({
        txId: 'arweave_tx_id',
        secret: 'secret value',
        origin: 'https://contextengine.example',
      }),
    ).toBe('https://contextengine.example/new?sponsored=arweave_tx_id#k=secret%20value');
  });

  it('prepends PUBLIC_URL when building the default sponsored route', () => {
    env.PUBLIC_URL = '/ce/';

    expect(
      buildSponsoredSessionUrl({
        txId: 'arweave_tx_id',
        secret: 'secret value',
        origin: 'https://contextengine.example',
      }),
    ).toBe('https://contextengine.example/ce/new?sponsored=arweave_tx_id#k=secret%20value');
  });

  it('normalizes supported bundle fields and ignores unsupported customRpcKey', () => {
    expect(
      normalizeSponsoredBundlePayload({
        openaiKey: ' sk-openai ',
        customRpcUrl: ' https://rpc.example ',
        litApiBase: ' https://api.chipotle.litprotocol.com ',
        customRpcKey: 'do-not-keep',
        meta: { label: ' Test label ' },
      }),
    ).toEqual({
      openaiKey: 'sk-openai',
      anthropicKey: '',
      openrouterKey: '',
      arweaveJwk: '',
      faucetPrivateKey: '',
      customRpcUrl: 'https://rpc.example',
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: '',
      litPkpId: '',
      litActionCid: '',
      litAccountApiKey: '',
      litUsageApiKey: '',
      bootstrapWorkerUrl: '',
      deployGrantToken: '',
      faucetGrantToken: '',
      meta: {
        label: 'Test label',
        createdAt: '',
        createdBy: '',
        expiresAt: '',
        sourceSessionSlug: '',
        sourceWorkerUrl: '',
      },
    });
  });

  it('builds sparse sponsored bundle payloads without empty credential fields', () => {
    expect(
      buildSponsoredBundlePlaintext({
        openaiKey: ' sk-openai ',
        litApiBase: ' https://api.chipotle.litprotocol.com ',
        litGroupId: ' group_123 ',
        litPkpId: ' pkp_123 ',
        litActionCid: ' bafy123 ',
        litAccountApiKey: ' lit-account-secret ',
        litUsageApiKey: ' lit-secret ',
        faucetPrivateKey: '   ',
        meta: { label: ' Launch Week ' },
      }),
    ).toEqual({
      openaiKey: 'sk-openai',
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
      litAccountApiKey: 'lit-account-secret',
      litUsageApiKey: 'lit-secret',
      meta: {
        label: 'Launch Week',
        createdAt: '',
        createdBy: '',
        expiresAt: '',
        sourceSessionSlug: '',
        sourceWorkerUrl: '',
      },
    });
    expect(
      hasSponsoredBundleFields(
        buildSponsoredBundlePlaintext({
          meta: { label: 'Metadata only' },
        }),
      ),
    ).toBe(false);
  });

  it('does not rely on a global Buffer runtime when generating sponsored secrets', () => {
    const originalBuffer = global.Buffer;
    const originalCrypto = globalThis.crypto;

    try {
      (global as any).Buffer = undefined;
      Object.defineProperty(globalThis, 'crypto', {
        value: {
          getRandomValues: (bytes: Uint8Array) => {
            bytes.fill(7);
            return bytes;
          },
        },
        configurable: true,
      });
      expect(generateSponsoredBundleSecret()).toMatch(/^[A-Za-z0-9_-]+$/);
    } finally {
      global.Buffer = originalBuffer;
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      });
    }
  });

  it('uploads an encrypted envelope instead of plaintext credentials', async () => {
    const result = await uploadSponsoredBundle({
      secret: 'bundle-secret',
      label: 'Launch Week',
      expiresAt: '2099-03-21T12:00:00.000Z',
      createdAt: '2099-03-20T12:00:00.000Z',
      createdBy: '0xadmin',
      arweaveJwk: '{"kty":"RSA"}',
      workerUrl: 'https://worker.example',
      sessionSlug: 'edge',
      context: { account: '0xadmin' },
      adminAuth: { address: '0xadmin', message: 'siwe', signature: '0xsig', sessionSlug: 'edge' },
      skipAuth: true,
      bundle: {
        openaiKey: 'sk-live-openai',
        anthropicKey: 'sk-live-anthropic',
        arweaveJwk: '{"kty":"RSA"}',
        customRpcUrl: 'https://rpc.example',
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: 'group_123',
        litPkpId: 'pkp_123',
        litActionCid: 'bafy123',
        litAccountApiKey: 'lit-account-secret',
        litUsageApiKey: 'lit-secret',
        meta: {
          sourceSessionSlug: 'edge',
          sourceWorkerUrl: 'https://worker.example',
        },
      },
    });

    expect(mockEncryptWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        openaiKey: 'sk-live-openai',
        anthropicKey: 'sk-live-anthropic',
        arweaveJwk: '{"kty":"RSA"}',
        customRpcUrl: 'https://rpc.example',
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: 'group_123',
        litPkpId: 'pkp_123',
        litActionCid: 'bafy123',
        litAccountApiKey: 'lit-account-secret',
        litUsageApiKey: 'lit-secret',
        meta: expect.objectContaining({
          label: 'Launch Week',
          createdBy: '0xadmin',
          sourceSessionSlug: 'edge',
          sourceWorkerUrl: 'https://worker.example',
        }),
      }),
      'bundle-secret',
    );
    expect(mockEncryptWithPassword.mock.calls[0][0]).not.toHaveProperty('openrouterKey');
    expect(mockEncryptWithPassword.mock.calls[0][0]).not.toHaveProperty('faucetPrivateKey');
    expect(mockUploadDataToArweave).toHaveBeenCalledTimes(1);

    const [envelope, format, options] = mockUploadDataToArweave.mock.calls[0];
    expect(format).toBe('json');
    expect(envelope).toEqual({
      type: SPONSORED_BUNDLE_TYPE,
      version: SPONSORED_BUNDLE_VERSION,
      cipher: SPONSORED_BUNDLE_CIPHER,
      encryptedData: 'encrypted-base64',
    });
    expect(JSON.stringify(envelope)).not.toContain('sk-live-openai');
    expect(JSON.stringify(envelope)).not.toContain('sk-live-anthropic');
    expect(JSON.stringify(envelope)).not.toContain('https://rpc.example');
    expect(options).toEqual(
      expect.objectContaining({
        arweaveJwk: '{"kty":"RSA"}',
        workerUrl: 'https://worker.example',
        sessionSlug: 'edge',
        skipAuth: true,
        adminAuth: expect.objectContaining({ address: '0xadmin' }),
      }),
    );
    expect(result).toEqual({
      txId: 'arweave_tx_id',
      envelope,
      url: 'http://localhost/new?sponsored=arweave_tx_id#k=bundle-secret',
    });
  });

  it('keeps sponsored bootstrap grant tokens and URLs in the encrypted payload without counting URL-only bundles as sponsored', () => {
    const payload = buildSponsoredBundlePlaintext({
      deployGrantToken: 'deploy-grant-token',
      faucetGrantToken: 'faucet-grant-token',
      bootstrapWorkerUrl: 'https://source-worker.example',
      meta: {
        sourceSessionSlug: 'edge',
        sourceWorkerUrl: 'https://worker.example',
      },
    });

    expect(payload).toEqual({
      deployGrantToken: 'deploy-grant-token',
      faucetGrantToken: 'faucet-grant-token',
      bootstrapWorkerUrl: 'https://source-worker.example',
      meta: {
        label: '',
        createdAt: '',
        createdBy: '',
        expiresAt: '',
        sourceSessionSlug: 'edge',
        sourceWorkerUrl: 'https://worker.example',
      },
    });
    expect(hasSponsoredBundleFields(payload)).toBe(true);
    expect(
      hasSponsoredBundleFields({
        bootstrapWorkerUrl: 'https://source-worker.example',
        meta: {},
      }),
    ).toBe(false);
  });

  it('rejects empty sponsored bundles before upload', async () => {
    await expect(
      uploadSponsoredBundle({
        secret: 'bundle-secret',
        label: 'Metadata only',
        createdBy: '0xadmin',
        workerUrl: 'https://worker.example',
        sessionSlug: 'edge',
        adminAuth: { address: '0xadmin', message: 'siwe', signature: '0xsig', sessionSlug: 'edge' },
        bundle: {},
      }),
    ).rejects.toThrow('Sponsored bundle must include at least one supported credential.');

    expect(mockEncryptWithPassword).not.toHaveBeenCalled();
    expect(mockUploadDataToArweave).not.toHaveBeenCalled();
  });

  it('reads, validates, and decrypts sponsored bundles from Arweave', async () => {
    mockDownloadDataFromArweave.mockResolvedValue(
      JSON.stringify({
        type: SPONSORED_BUNDLE_TYPE,
        version: SPONSORED_BUNDLE_VERSION,
        cipher: SPONSORED_BUNDLE_CIPHER,
        encryptedData: 'encrypted-base64',
      }),
    );

    const result = await readSponsoredBundleFromArweave({
      txId: 'arweave_tx_id',
      secret: 'bundle-secret',
    });

    expect(mockDownloadDataFromArweave).toHaveBeenCalledWith('arweave_tx_id', {});
    expect(mockDecryptWithPassword).toHaveBeenCalledWith('encrypted-base64', 'bundle-secret');
    expect(result).toEqual({
      txId: 'arweave_tx_id',
      envelope: {
        type: SPONSORED_BUNDLE_TYPE,
        version: SPONSORED_BUNDLE_VERSION,
        cipher: SPONSORED_BUNDLE_CIPHER,
        encryptedData: 'encrypted-base64',
      },
      bundle: buildSponsoredBundlePlaintext({
        openaiKey: 'sk-openai',
        anthropicKey: 'sk-anthropic',
        openrouterKey: 'sk-openrouter',
        arweaveJwk: '{"kty":"RSA"}',
        faucetPrivateKey: '0xfaucet',
        customRpcUrl: 'https://rpc.example',
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: 'group_123',
        litPkpId: 'pkp_123',
        litActionCid: 'bafy123',
        litAccountApiKey: 'lit-account-secret',
        litUsageApiKey: 'lit-secret',
        meta: {
          label: 'Launch Week',
          createdAt: '2099-03-20T12:00:00.000Z',
          createdBy: '0xadmin',
          expiresAt: '2099-03-21T12:00:00.000Z',
          sourceSessionSlug: 'edge',
          sourceWorkerUrl: 'https://worker.example',
        },
      }),
    });
  });

  it('rejects unexpected sponsored bundle versions', async () => {
    mockDownloadDataFromArweave.mockResolvedValue(
      JSON.stringify({
        type: SPONSORED_BUNDLE_TYPE,
        version: 2,
        cipher: SPONSORED_BUNDLE_CIPHER,
        encryptedData: 'encrypted-base64',
      }),
    );

    await expect(
      readSponsoredBundleFromArweave({
        txId: 'arweave_tx_id',
        secret: 'bundle-secret',
      }),
    ).rejects.toMatchObject({
      code: 'invalid_bundle',
      message: 'Sponsored bundle version is invalid.',
    });
  });

  it('rejects expired sponsored bundles', async () => {
    mockDownloadDataFromArweave.mockResolvedValue(
      JSON.stringify({
        type: SPONSORED_BUNDLE_TYPE,
        version: SPONSORED_BUNDLE_VERSION,
        cipher: SPONSORED_BUNDLE_CIPHER,
        encryptedData: 'encrypted-base64',
      }),
    );
    mockDecryptWithPassword.mockResolvedValue({
      openaiKey: 'sk-openai',
      meta: {
        label: 'Expired',
        createdAt: '2000-03-19T12:00:00.000Z',
        createdBy: '0xadmin',
        expiresAt: '2000-03-19T12:30:00.000Z',
      },
    });

    await expect(
      readSponsoredBundleFromArweave({
        txId: 'arweave_tx_id',
        secret: 'bundle-secret',
      }),
    ).rejects.toMatchObject({
      code: 'expired_bundle',
      message: 'Sponsored bundle has expired.',
    });
  });

  it('rejects decrypted bundles with no supported sponsored credentials', async () => {
    mockDownloadDataFromArweave.mockResolvedValue(
      JSON.stringify({
        type: SPONSORED_BUNDLE_TYPE,
        version: SPONSORED_BUNDLE_VERSION,
        cipher: SPONSORED_BUNDLE_CIPHER,
        encryptedData: 'encrypted-base64',
      }),
    );
    mockDecryptWithPassword.mockResolvedValue({
      meta: {
        label: 'Metadata only',
        createdAt: '2099-03-20T12:00:00.000Z',
        createdBy: '0xadmin',
      },
    });

    await expect(
      readSponsoredBundleFromArweave({
        txId: 'arweave_tx_id',
        secret: 'bundle-secret',
      }),
    ).rejects.toMatchObject({
      code: 'empty_bundle',
      message: 'Sponsored bundle has no supported credentials.',
    });
  });
});
