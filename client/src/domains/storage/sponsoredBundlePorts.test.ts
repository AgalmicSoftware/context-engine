import { bindSponsoredBundlePort, type SponsoredBundleModule } from './sponsoredBundlePorts';

describe('sponsored bundle port', () => {
  it('routes bundle helpers and upload through call-time module lookup', async () => {
    const firstModule: SponsoredBundleModule = {
      buildSponsoredBundlePlaintext: jest.fn(() => ({ openaiKey: 'first' })),
      generateSponsoredBundleSecret: jest.fn(() => 'first-secret'),
      hasSponsoredBundleFields: jest.fn(() => true),
      uploadSponsoredBundle: jest.fn(async () => ({ txId: 'first-tx' })),
    };
    const secondModule: SponsoredBundleModule = {
      buildSponsoredBundlePlaintext: jest.fn(() => ({ openaiKey: 'second' })),
      generateSponsoredBundleSecret: jest.fn(() => 'second-secret'),
      hasSponsoredBundleFields: jest.fn(() => false),
      uploadSponsoredBundle: jest.fn(async () => ({ txId: 'second-tx' })),
    };
    let currentModule = firstModule;
    const port = bindSponsoredBundlePort({
      sponsoredBundles: () => currentModule,
    });

    expect(port.buildSponsoredBundlePlaintext({ openaiKey: 'alpha' })).toEqual({ openaiKey: 'first' });
    expect(port.generateSponsoredBundleSecret()).toBe('first-secret');

    currentModule = secondModule;

    expect(port.hasSponsoredBundleFields({ openaiKey: '' })).toBe(false);
    await expect(
      port.uploadSponsoredBundle({
        secret: 'secret',
        bundle: { openaiKey: 'beta' },
        sessionSlug: 'edge',
      }),
    ).resolves.toEqual({ txId: 'second-tx' });

    expect(firstModule.buildSponsoredBundlePlaintext).toHaveBeenCalledWith({ openaiKey: 'alpha' });
    expect(firstModule.generateSponsoredBundleSecret).toHaveBeenCalledWith();
    expect(secondModule.hasSponsoredBundleFields).toHaveBeenCalledWith({ openaiKey: '' });
    expect(secondModule.uploadSponsoredBundle).toHaveBeenCalledWith({
      secret: 'secret',
      bundle: { openaiKey: 'beta' },
      sessionSlug: 'edge',
    });
  });
});
