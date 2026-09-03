import { arweaveClient } from '../../../utilities/arweave/arweaveClient.js';
import * as publishUploadAuth from '../../../utilities/arweave/publishUploadAuth.js';
import * as sponsoredBundles from '../../../utilities/arweave/sponsoredBundles.js';
import * as sbtFactoryReceipt from '../../../utilities/web3/sbtFactoryReceipt.js';
import * as sessionRegistry from '../../../utilities/web3/sessionRegistry.js';
import { sbtMetadataReadsPort } from '../../sbts/sbtMetadataReadsPort.js';
import {
  bindWorkerAuthPublishAdapter,
  arweavePublishAdapter,
  sbtFactoryReceiptPublishAdapter,
  sessionRegistryPublishAdapter,
  sessionPublishSbtMetadataAdapter,
  sponsoredBundlePublishAdapter,
  type WorkerAuthPublishModule,
} from './sessionPublishAdapters';

describe('session publish adapters', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes Arweave upload calls with argument fidelity and late property lookup', async () => {
    const uploadDataToArweave = jest.spyOn(arweaveClient, 'uploadDataToArweave').mockResolvedValue('first-tx');
    const buildArweaveGatewayUrl = jest
      .spyOn(arweaveClient, 'buildArweaveGatewayUrl')
      .mockReturnValue('https://gateway.example/second');
    const resolveUploadOptions = jest.spyOn(publishUploadAuth, 'resolvePublishArweaveUploadOptions').mockResolvedValue({
      forceDirectArweaveUpload: true,
      arweaveJwk: '{"kty":"RSA"}',
      workerUrl: '',
      skipAuth: true,
      adminAuth: null,
    });
    const payload = { slug: 'alpha' };
    const options = { requestId: 'arw_meta_test' };

    await expect(
      arweavePublishAdapter.uploadDataToArweave({
        data: payload,
        format: 'json',
        options,
      }),
    ).resolves.toBe('first-tx');

    await expect(arweavePublishAdapter.buildArweaveGatewayUrl({ txId: 'second-tx' })).toBe(
      'https://gateway.example/second',
    );
    await expect(
      arweavePublishAdapter.resolveUploadOptions({
        arweaveJwk: '{"kty":"RSA"}',
        workerUrl: 'https://worker.example.test',
        preferDirectArweaveUpload: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        forceDirectArweaveUpload: true,
      }),
    );

    expect(uploadDataToArweave).toHaveBeenCalledWith(payload, 'json', options);
    expect(buildArweaveGatewayUrl).toHaveBeenCalledWith('second-tx');
    expect(resolveUploadOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        workerUrl: 'https://worker.example.test',
      }),
    );
  });

  it('propagates Arweave upload errors', async () => {
    const failure = new Error('upload failed');
    jest.spyOn(arweaveClient, 'uploadDataToArweave').mockRejectedValue(failure);

    await expect(
      arweavePublishAdapter.uploadDataToArweave({
        data: { slug: 'broken' },
        format: 'json',
        options: {},
      }),
    ).rejects.toBe(failure);
  });

  it('routes registry calls with call-time module property lookup', async () => {
    const registerSessionOnChain = jest
      .spyOn(sessionRegistry, 'registerSessionOnChain')
      .mockResolvedValue({ txs: [{ action: 'register-session', hash: '0xfirst' }] });
    const getRegistryContract = jest
      .spyOn(sessionRegistry.sessionRegistryUtils, 'getRegistryContract')
      .mockReturnValue({ name: 'second-contract' } as never);
    jest.spyOn(sessionRegistry.sessionRegistryUtils, 'fetchSessionFromRegistry').mockResolvedValue({ slug: 'second' });
    const upsertSessionRegistryCache = jest
      .spyOn(sessionRegistry.sessionRegistryUtils, 'upsertSessionRegistryCache')
      .mockReturnValue(null);
    const registerArgs = { slug: 'alpha', metadataURI: 'ar://metadata' };

    await expect(sessionRegistryPublishAdapter.registerSession(registerArgs)).resolves.toEqual({
      txs: [{ action: 'register-session', hash: '0xfirst' }],
    });

    await expect(
      sessionRegistryPublishAdapter.getRegistryContract({
        chainId: 11155420,
        providerLike: null,
        options: { bootstrapRpc: true },
      }),
    ).toEqual({ name: 'second-contract' });
    await expect(
      sessionRegistryPublishAdapter.refreshRegistryCache({
        fetchArgs: { chainId: 11155420, slug: 'second' },
      }),
    ).resolves.toEqual({ slug: 'second' });

    expect(registerSessionOnChain).toHaveBeenCalledWith(registerArgs);
    expect(getRegistryContract).toHaveBeenCalledWith(11155420, null, {
      bootstrapRpc: true,
    });
    expect(upsertSessionRegistryCache).toHaveBeenCalledWith({
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

  it('routes sponsored bundle and receipt helpers without changing their call shape', () => {
    const normalizeSparseSponsoredBundlePayload = jest
      .spyOn(sponsoredBundles, 'normalizeSparseSponsoredBundlePayload')
      .mockReturnValue({ openaiKey: 'key' });
    const hasSponsoredBundleFields = jest.spyOn(sponsoredBundles, 'hasSponsoredBundleFields').mockReturnValue(true);
    const resolveSbtAddressFromFactoryReceipt = jest
      .spyOn(sbtFactoryReceipt, 'resolveSbtAddressFromFactoryReceipt')
      .mockReturnValue('0x0000000000000000000000000000000000000001');
    const rawBundle = { openaiKey: 'key' };
    const receipt = { logs: [] };

    expect(sponsoredBundlePublishAdapter.normalizeSparseSponsoredBundlePayload(rawBundle)).toEqual({
      openaiKey: 'key',
    });
    expect(sponsoredBundlePublishAdapter.hasSponsoredBundleFields({ openaiKey: 'key' })).toBe(true);
    expect(sbtFactoryReceiptPublishAdapter.resolveSbtAddressFromFactoryReceipt({ receipt })).toBe(
      '0x0000000000000000000000000000000000000001',
    );

    expect(normalizeSparseSponsoredBundlePayload).toHaveBeenCalledWith(rawBundle);
    expect(hasSponsoredBundleFields).toHaveBeenCalledWith({ openaiKey: 'key' });
    expect(resolveSbtAddressFromFactoryReceipt).toHaveBeenCalledWith(receipt);
  });

  it('reuses the SBT metadata port through call-time property lookup', async () => {
    const getSbtMetadata = jest
      .spyOn(sbtMetadataReadsPort, 'getSbtMetadata')
      .mockResolvedValueOnce({ name: 'first' })
      .mockResolvedValueOnce({ name: 'second' });

    await expect(
      sessionPublishSbtMetadataAdapter.getSbtMetadata({
        providerName: 'none',
        sbtAddress: '0x0000000000000000000000000000000000000001',
        groupKeyOrCfg: 'alpha',
      }),
    ).resolves.toEqual({ name: 'first' });

    await expect(
      sessionPublishSbtMetadataAdapter.getSbtMetadata({
        providerName: { selectedAddress: '0x0000000000000000000000000000000000000002' },
        sbtAddress: '0x0000000000000000000000000000000000000003',
        groupKeyOrCfg: { slug: 'beta' },
      }),
    ).resolves.toEqual({ name: 'second' });

    expect(getSbtMetadata).toHaveBeenNthCalledWith(1, 'none', '0x0000000000000000000000000000000000000001', 'alpha');
    expect(getSbtMetadata).toHaveBeenNthCalledWith(
      2,
      { selectedAddress: '0x0000000000000000000000000000000000000002' },
      '0x0000000000000000000000000000000000000003',
      { slug: 'beta' },
    );
  });
});
