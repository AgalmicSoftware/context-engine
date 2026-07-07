import {
  bindArweavePublishAdapter,
  bindSbtFactoryReceiptPublishAdapter,
  bindSessionPublishSbtMetadataAdapter,
  bindSessionRegistryPublishAdapter,
  bindSponsoredBundlePublishAdapter,
  bindWorkerAuthPublishAdapter,
  type ArweavePublishScripts,
  type SessionRegistryPublishModule,
  type SponsoredBundlePublishModule,
  type WorkerAuthPublishModule,
} from './sessionPublishAdapters';
import type { SbtMetadataReadsPort } from '../../sbts/sbtPorts';

describe('session publish adapters', () => {
  it('binds Arweave upload calls with argument fidelity and late script lookup', async () => {
    const firstScripts: ArweavePublishScripts = {
      uploadDataToArweave: jest.fn(async () => 'first-tx'),
      buildArweaveGatewayUrl: jest.fn(() => 'https://gateway.example/first'),
    };
    const secondScripts: ArweavePublishScripts = {
      uploadDataToArweave: jest.fn(async () => 'second-tx'),
      buildArweaveGatewayUrl: jest.fn(() => 'https://gateway.example/second'),
    };
    let currentScripts = firstScripts;
    const resolveUploadOptions = jest.fn(async () => ({
      forceDirectArweaveUpload: true,
      arweaveJwk: '{"kty":"RSA"}',
      workerUrl: '',
      skipAuth: true,
      adminAuth: null,
    }));
    const adapter = bindArweavePublishAdapter({
      arweaveScripts: () => currentScripts,
      resolveUploadOptions,
    });
    const payload = { slug: 'alpha' };
    const options = { requestId: 'arw_meta_test' };

    await expect(
      adapter.uploadDataToArweave({
        data: payload,
        format: 'json',
        options,
      }),
    ).resolves.toBe('first-tx');

    currentScripts = secondScripts;

    await expect(adapter.buildArweaveGatewayUrl({ txId: 'second-tx' })).toBe('https://gateway.example/second');
    await expect(
      adapter.resolveUploadOptions({
        arweaveJwk: '{"kty":"RSA"}',
        workerUrl: 'https://worker.example.test',
        preferDirectArweaveUpload: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        forceDirectArweaveUpload: true,
      }),
    );

    expect(firstScripts.uploadDataToArweave).toHaveBeenCalledWith(payload, 'json', options);
    expect(secondScripts.buildArweaveGatewayUrl).toHaveBeenCalledWith('second-tx');
    expect(resolveUploadOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        workerUrl: 'https://worker.example.test',
      }),
    );
  });

  it('propagates Arweave upload errors', async () => {
    const failure = new Error('upload failed');
    const adapter = bindArweavePublishAdapter({
      arweaveScripts: () => ({
        uploadDataToArweave: jest.fn(async () => {
          throw failure;
        }),
        buildArweaveGatewayUrl: jest.fn(() => ''),
      }),
    });

    await expect(
      adapter.uploadDataToArweave({
        data: { slug: 'broken' },
        format: 'json',
        options: {},
      }),
    ).rejects.toBe(failure);
  });

  it('binds registry calls with call-time module lookup', async () => {
    const firstRegistry: SessionRegistryPublishModule = {
      registerSessionOnChain: jest.fn(async () => ({ txs: [{ hash: '0xfirst' }] })),
      sessionRegistryUtils: {
        getRegistryContract: jest.fn(() => ({ name: 'first-contract' })),
        fetchSessionFromRegistry: jest.fn(async () => ({ slug: 'first' })),
        upsertSessionRegistryCache: jest.fn(),
        normalizeSlug: jest.fn(() => 'first'),
        formatSessionId: jest.fn(() => 'first-id'),
        normalizeSessionIdHex: jest.fn(() => '0xfirst'),
        toRegistrySlug: jest.fn(() => 'first'),
      },
    };
    const secondRegistry: SessionRegistryPublishModule = {
      registerSessionOnChain: jest.fn(async () => ({ txs: [{ hash: '0xsecond' }] })),
      sessionRegistryUtils: {
        getRegistryContract: jest.fn(() => ({ name: 'second-contract' })),
        fetchSessionFromRegistry: jest.fn(async () => ({ slug: 'second' })),
        upsertSessionRegistryCache: jest.fn(),
        normalizeSlug: jest.fn(() => 'second'),
        formatSessionId: jest.fn(() => 'second-id'),
        normalizeSessionIdHex: jest.fn(() => '0xsecond'),
        toRegistrySlug: jest.fn(() => 'second'),
      },
    };
    let currentRegistry = firstRegistry;
    const adapter = bindSessionRegistryPublishAdapter({
      sessionRegistry: () => currentRegistry,
    });
    const registerArgs = { slug: 'alpha', metadataURI: 'ar://metadata' };

    await expect(adapter.registerSession(registerArgs)).resolves.toEqual({
      txs: [{ hash: '0xfirst' }],
    });

    currentRegistry = secondRegistry;

    await expect(
      adapter.getRegistryContract({
        chainId: 11155420,
        providerLike: null,
        options: { bootstrapRpc: true },
      }),
    ).toEqual({ name: 'second-contract' });
    await expect(
      adapter.refreshRegistryCache({
        fetchArgs: { chainId: 11155420, slug: 'second' },
      }),
    ).resolves.toEqual({ slug: 'second' });

    expect(firstRegistry.registerSessionOnChain).toHaveBeenCalledWith(registerArgs);
    expect(secondRegistry.sessionRegistryUtils.getRegistryContract).toHaveBeenCalledWith(11155420, null, {
      bootstrapRpc: true,
    });
    expect(secondRegistry.sessionRegistryUtils.upsertSessionRegistryCache).toHaveBeenCalledWith({
      config: { slug: 'second' },
    });
  });

  it('binds worker auth signatures and normalization', async () => {
    const workerAuth: WorkerAuthPublishModule = {
      normalizeWorkerUrl: jest.fn(() => 'https://worker.example.test'),
      buildSignedBootstrapAdminAuth: jest.fn(async () => ({ signature: '0xbootstrap' })),
      buildSignedAdminActionAuth: jest.fn(async () => ({ signature: '0xaction' })),
    };
    const adapter = bindWorkerAuthPublishAdapter({
      workerAuth: () => workerAuth,
    });
    const bootstrapInput = { slug: 'alpha', workerUrl: 'https://worker.example.test' };
    const actionInput = { action: 'set-config', slug: 'alpha', body: {} };

    expect(adapter.normalizeWorkerUrl(' https://worker.example.test ')).toBe('https://worker.example.test');
    await expect(adapter.buildSignedBootstrapAdminAuth(bootstrapInput)).resolves.toEqual({ signature: '0xbootstrap' });
    await expect(adapter.buildSignedAdminActionAuth(actionInput)).resolves.toEqual({ signature: '0xaction' });

    expect(workerAuth.normalizeWorkerUrl).toHaveBeenCalledWith(' https://worker.example.test ');
    expect(workerAuth.buildSignedBootstrapAdminAuth).toHaveBeenCalledWith(bootstrapInput);
    expect(workerAuth.buildSignedAdminActionAuth).toHaveBeenCalledWith(actionInput);
  });

  it('binds sponsored bundle and receipt helpers without changing their call shape', () => {
    const sponsoredBundles: SponsoredBundlePublishModule = {
      normalizeSparseSponsoredBundlePayload: jest.fn(() => ({ openaiKey: 'key' })),
      hasSponsoredBundleFields: jest.fn(() => true),
    };
    const receiptModule = {
      resolveSbtAddressFromFactoryReceipt: jest.fn(() => '0x0000000000000000000000000000000000000001'),
    };
    const sponsoredAdapter = bindSponsoredBundlePublishAdapter({
      sponsoredBundles: () => sponsoredBundles,
    });
    const receiptAdapter = bindSbtFactoryReceiptPublishAdapter({
      sbtFactoryReceipt: () => receiptModule,
    });
    const rawBundle = { openaiKey: 'key' };
    const receipt = { logs: [] };

    expect(sponsoredAdapter.normalizeSparseSponsoredBundlePayload(rawBundle)).toEqual({ openaiKey: 'key' });
    expect(sponsoredAdapter.hasSponsoredBundleFields({ openaiKey: 'key' })).toBe(true);
    expect(receiptAdapter.resolveSbtAddressFromFactoryReceipt({ receipt })).toBe(
      '0x0000000000000000000000000000000000000001',
    );

    expect(sponsoredBundles.normalizeSparseSponsoredBundlePayload).toHaveBeenCalledWith(rawBundle);
    expect(sponsoredBundles.hasSponsoredBundleFields).toHaveBeenCalledWith({ openaiKey: 'key' });
    expect(receiptModule.resolveSbtAddressFromFactoryReceipt).toHaveBeenCalledWith(receipt);
  });

  it('reuses the SBT metadata port through call-time lookup', async () => {
    const firstPort: SbtMetadataReadsPort = {
      getSbtMetadata: jest.fn(async () => ({ name: 'first' })),
      getMintedTokens: jest.fn(async () => []),
      getGroupPasswordHash: jest.fn(async () => null),
      getSbtOnChainConfig: jest.fn(async () => ({
        maxTokens: null,
        collectionBurnAuth: null,
        mintingEndTime: null,
        hasPasswordMint: null,
        admin: null,
        owner: null,
      })),
    };
    const secondPort: SbtMetadataReadsPort = {
      getSbtMetadata: jest.fn(async () => ({ name: 'second' })),
      getMintedTokens: jest.fn(async () => []),
      getGroupPasswordHash: jest.fn(async () => null),
      getSbtOnChainConfig: jest.fn(async () => ({
        maxTokens: null,
        collectionBurnAuth: null,
        mintingEndTime: null,
        hasPasswordMint: null,
        admin: null,
        owner: null,
      })),
    };
    let currentPort = firstPort;
    const adapter = bindSessionPublishSbtMetadataAdapter({
      metadataReadsPort: () => currentPort,
    });

    await expect(
      adapter.getSbtMetadata({
        providerName: 'none',
        sbtAddress: '0x0000000000000000000000000000000000000001',
        groupKeyOrCfg: 'alpha',
      }),
    ).resolves.toEqual({ name: 'first' });

    currentPort = secondPort;

    await expect(
      adapter.getSbtMetadata({
        providerName: { selectedAddress: '0x0000000000000000000000000000000000000002' },
        sbtAddress: '0x0000000000000000000000000000000000000003',
        groupKeyOrCfg: { slug: 'beta' },
      }),
    ).resolves.toEqual({ name: 'second' });

    expect(firstPort.getSbtMetadata).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000001',
      'alpha',
    );
    expect(secondPort.getSbtMetadata).toHaveBeenCalledWith(
      { selectedAddress: '0x0000000000000000000000000000000000000002' },
      '0x0000000000000000000000000000000000000003',
      { slug: 'beta' },
    );
  });
});
