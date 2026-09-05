import { arweaveClient } from '../../utilities/arweave/arweaveClient.js';
import * as arweaveUrls from '../../utilities/arweave/arweaveUrls.js';
import { adminArweavePort } from './adminArweavePorts';

describe('admin Arweave ports', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes balance and upload calls through call-time Arweave property lookup', async () => {
    const readArweaveWalletBalance = jest.spyOn(arweaveClient, 'readArweaveWalletBalance').mockResolvedValue({
      address: 'first-address',
      balanceUrl: 'https://arweave.net/wallet/first-address/balance',
      gatewayBase: 'https://arweave.net',
      winston: '1000000000000',
    });
    const formatWinstonToAr = jest.spyOn(arweaveClient, 'formatWinstonToAr').mockReturnValue('2.000000');
    const uploadDataToArweave = jest.spyOn(arweaveClient, 'uploadDataToArweave').mockResolvedValue('second-tx');
    const buildArweaveGatewayUrl = jest
      .spyOn(arweaveClient, 'buildArweaveGatewayUrl')
      .mockReturnValue('https://arweave.net/second-tx');
    const jwk = { kty: 'RSA', n: 'example' };

    await expect(adminArweavePort.readArweaveWalletBalance(jwk)).resolves.toMatchObject({ address: 'first-address' });

    await expect(
      adminArweavePort.uploadDataToArweave({ type: 'admin-test' }, 'json', { sessionSlug: 'edge' }),
    ).resolves.toBe('second-tx');
    expect(adminArweavePort.formatWinstonToAr('2000000000000', 4)).toBe('2.000000');
    expect(adminArweavePort.buildArweaveGatewayUrl('second-tx')).toBe('https://arweave.net/second-tx');

    expect(readArweaveWalletBalance).toHaveBeenCalledWith(jwk);
    expect(uploadDataToArweave).toHaveBeenCalledWith({ type: 'admin-test' }, 'json', {
      sessionSlug: 'edge',
    });
    expect(formatWinstonToAr).toHaveBeenCalledWith('2000000000000', 4);
    expect(buildArweaveGatewayUrl).toHaveBeenCalledWith('second-tx');
  });

  it('normalizes display URLs through call-time URL helper property lookup', () => {
    const normalizeArweaveUrl = jest
      .spyOn(arweaveUrls, 'normalizeArweaveUrl')
      .mockReturnValueOnce('https://first.gateway/tx')
      .mockReturnValueOnce('https://second.gateway/tx');

    expect(adminArweavePort.normalizeArweaveUrl('ar://abc', { contextLabel: 'session_header_image' })).toBe(
      'https://first.gateway/tx',
    );
    expect(adminArweavePort.normalizeArweaveUrl('ar://def', { gateway: 'https://ar.example' })).toBe(
      'https://second.gateway/tx',
    );
    expect(normalizeArweaveUrl).toHaveBeenNthCalledWith(1, 'ar://abc', { contextLabel: 'session_header_image' });
    expect(normalizeArweaveUrl).toHaveBeenNthCalledWith(2, 'ar://def', { gateway: 'https://ar.example' });
  });

  it('propagates Arweave upload failures unchanged', async () => {
    const failure = new Error('upload failed');
    jest.spyOn(arweaveClient, 'uploadDataToArweave').mockRejectedValue(failure);

    await expect(adminArweavePort.uploadDataToArweave({ type: 'admin-test' }, 'json')).rejects.toBe(failure);
  });
});
