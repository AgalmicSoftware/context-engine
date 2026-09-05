import * as sponsoredBundles from '../../utilities/arweave/sponsoredBundles.js';
import { sponsoredBundlePort } from './sponsoredBundlePorts';

describe('sponsored bundle port', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes bundle helpers and upload through call-time module property lookup', async () => {
    const buildSponsoredBundlePlaintext = jest
      .spyOn(sponsoredBundles, 'buildSponsoredBundlePlaintext')
      .mockReturnValue({ openaiKey: 'first' });
    const generateSponsoredBundleSecret = jest
      .spyOn(sponsoredBundles, 'generateSponsoredBundleSecret')
      .mockReturnValue('first-secret');
    const hasSponsoredBundleFields = jest.spyOn(sponsoredBundles, 'hasSponsoredBundleFields').mockReturnValue(false);
    const uploadSponsoredBundle = jest.spyOn(sponsoredBundles, 'uploadSponsoredBundle').mockResolvedValue({
      txId: 'second-tx',
      envelope: {
        type: 'ce_sponsored_bundle',
        version: 1,
        cipher: 'AES-GCM',
        encryptedData: 'ciphertext',
      },
      url: 'https://arweave.example/second-tx',
    });

    expect(sponsoredBundlePort.buildSponsoredBundlePlaintext({ openaiKey: 'alpha' })).toEqual({ openaiKey: 'first' });
    expect(sponsoredBundlePort.generateSponsoredBundleSecret()).toBe('first-secret');
    expect(sponsoredBundlePort.hasSponsoredBundleFields({ openaiKey: '' })).toBe(false);
    await expect(
      sponsoredBundlePort.uploadSponsoredBundle({
        secret: 'secret',
        bundle: { openaiKey: 'beta' },
        sessionSlug: 'edge',
      }),
    ).resolves.toEqual({
      txId: 'second-tx',
      envelope: {
        type: 'ce_sponsored_bundle',
        version: 1,
        cipher: 'AES-GCM',
        encryptedData: 'ciphertext',
      },
      url: 'https://arweave.example/second-tx',
    });

    expect(buildSponsoredBundlePlaintext).toHaveBeenCalledWith({ openaiKey: 'alpha' });
    expect(generateSponsoredBundleSecret).toHaveBeenCalledWith();
    expect(hasSponsoredBundleFields).toHaveBeenCalledWith({ openaiKey: '' });
    expect(uploadSponsoredBundle).toHaveBeenCalledWith({
      secret: 'secret',
      bundle: { openaiKey: 'beta' },
      sessionSlug: 'edge',
    });
  });
});
