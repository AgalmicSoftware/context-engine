import {
  buildSponsoredBundleAppliedStatusMessage,
  resolveSponsoredBundleAdvancedFieldNotices,
  resolveSponsoredBundleBootstrapWorkerUrl,
} from './sessionWizardSponsoredBundleSupport';

describe('sessionWizardSponsoredBundleSupport', () => {
  it('resolves the sponsored bootstrap worker url and applied resource status message', () => {
    expect(resolveSponsoredBundleBootstrapWorkerUrl({
      meta: { sourceWorkerUrl: ' https://worker.example/bootstrap ' },
    })).toBe('https://worker.example/bootstrap');

    expect(buildSponsoredBundleAppliedStatusMessage({
      openaiKey: 'sk-openai',
      arweaveJwk: '{"kty":"RSA"}',
      deployGrantToken: 'deploy-token',
    })).toBe('Sponsored resources applied: OpenAI key, Arweave wallet, deploy access.');
  });

  it('derives advanced-field notices from the sponsored bundle state', () => {
    expect(resolveSponsoredBundleAdvancedFieldNotices({
      sponsoredBundle: {
        faucetPrivateKey: '0xfaucet',
        deployGrantToken: 'deploy-token',
      },
      workerSecrets: {
        faucetPrivateKey: '0xfaucet',
      },
      deployForm: {},
    })).toEqual({
      showSponsoredFaucetNotice: true,
      showSponsoredDeployAccessNotice: true,
    });
  });
});
