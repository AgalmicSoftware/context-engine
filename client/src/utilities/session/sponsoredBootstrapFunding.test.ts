import {
  SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY,
  clearSponsoredBootstrapFaucetGrantToken,
  clearSponsoredBootstrapFundingContext,
  normalizeSponsoredBootstrapFundingContext,
  readSponsoredBootstrapFundingContext,
  writeSponsoredBootstrapFundingContext,
} from './sponsoredBootstrapFunding.js';

describe('sponsoredBootstrapFunding helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('normalizes compatibility fields into the persisted funding context shape', () => {
    expect(
      normalizeSponsoredBootstrapFundingContext({
        sourceSessionSlug: ' General ',
        bootstrapWorkerUrl: 'https://worker.example/path///',
        requestedSessionSlug: ' Edge Session ',
        faucetGrantToken: ' grant-token ',
      }),
    ).toEqual({
      sessionSlug: '',
      workerUrl: 'https://worker.example/path',
      targetSessionSlug: 'Edge Session',
      faucetGrantToken: 'grant-token',
    });
  });

  it('persists, reads, clears tokens, and removes the session storage context', () => {
    expect(
      writeSponsoredBootstrapFundingContext({
        sessionSlug: 'source',
        workerUrl: 'https://worker.example',
        faucetGrantToken: 'grant-token',
      }),
    ).toEqual({
      sessionSlug: 'source',
      workerUrl: 'https://worker.example',
      targetSessionSlug: '',
      faucetGrantToken: 'grant-token',
    });

    expect(readSponsoredBootstrapFundingContext()).toEqual({
      sessionSlug: 'source',
      workerUrl: 'https://worker.example',
      targetSessionSlug: '',
      faucetGrantToken: 'grant-token',
    });

    expect(clearSponsoredBootstrapFaucetGrantToken()).toEqual({
      sessionSlug: 'source',
      workerUrl: 'https://worker.example',
      targetSessionSlug: '',
    });
    expect(readSponsoredBootstrapFundingContext()).toEqual({
      sessionSlug: 'source',
      workerUrl: 'https://worker.example',
      targetSessionSlug: '',
    });

    clearSponsoredBootstrapFundingContext();
    expect(sessionStorage.getItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY)).toBeNull();
    expect(readSponsoredBootstrapFundingContext()).toBeNull();
  });
});
