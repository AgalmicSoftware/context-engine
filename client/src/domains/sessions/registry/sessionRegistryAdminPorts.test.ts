import * as sessionRegistry from '../../../utilities/web3/sessionRegistry.js';
import { sessionRegistryReadsPort } from './sessionRegistryReadPorts.js';
import { adminSessionRegistryPorts } from './sessionRegistryAdminPorts';

describe('admin session registry ports', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes admin writes through call-time property lookup and shared field normalization', async () => {
    const setSessionFieldsOnChain = jest
      .spyOn(sessionRegistry, 'setSessionFieldsOnChain')
      .mockResolvedValue({ ok: true });
    const setResourceGatesOnChain = jest
      .spyOn(sessionRegistry, 'setResourceGatesOnChain')
      .mockResolvedValue({ ok: true, txs: [] });
    jest.spyOn(sessionRegistry, 'uploadSessionMetadata').mockResolvedValue({
      txId: undefined,
      arweaveUrl: '',
      metadataUri: 'ar://second',
    });
    jest.spyOn(sessionRegistry, 'updateSessionMetadataOnChain').mockResolvedValue({ ok: true, txHash: '0xsecond' });

    expect(adminSessionRegistryPorts.reads).toBe(sessionRegistryReadsPort);

    expect(
      adminSessionRegistryPorts.writes.buildRegistrySessionFields({
        onChainFields: {
          corsWorkerUrl: ' https://worker.example ',
          unexpected: 'skip',
        },
        sponsoredFields: {
          sponsored_ai: '1',
          sponsored_rpc: '',
        },
      }),
    ).toEqual({
      corsWorkerUrl: 'https://worker.example',
      sponsored_ai: '1',
    });

    await expect(
      adminSessionRegistryPorts.writes.setSessionFieldsOnChain({
        providerLike: 'provider',
        chainId: 84532,
        slug: 'edge',
        fields: { sponsored_ai: '1' },
      }),
    ).resolves.toEqual({ ok: true });

    await expect(
      adminSessionRegistryPorts.writes.setResourceGatesOnChain({ slug: 'edge', gates: [] }),
    ).resolves.toEqual({
      ok: true,
      txs: [],
    });
    await expect(
      adminSessionRegistryPorts.writes.uploadSessionMetadata({ slug: 'edge' }, { workerUrl: 'https://worker.test' }),
    ).resolves.toEqual({ txId: undefined, arweaveUrl: '', metadataUri: 'ar://second' });
    await expect(adminSessionRegistryPorts.writes.updateSessionMetadataOnChain({ slug: 'edge' })).resolves.toEqual({
      ok: true,
      txHash: '0xsecond',
    });

    expect(setSessionFieldsOnChain).toHaveBeenCalledWith({
      providerLike: 'provider',
      chainId: 84532,
      slug: 'edge',
      fields: { sponsored_ai: '1' },
    });
    expect(setResourceGatesOnChain).toHaveBeenCalledWith({
      slug: 'edge',
      gates: [],
    });
  });
});
