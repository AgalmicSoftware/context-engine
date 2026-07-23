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
    localStorage.clear();
    sessionStorage.clear();
    clearSponsoredBootstrapFundingContext();
  });

  it('normalizes compatibility fields into the in-memory funding context shape', () => {
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

  it('keeps funding context in memory, clears tokens, and never serializes auth material', () => {
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
    expect(sessionStorage.getItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY)).toBeNull();

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

  it('purges legacy browser-storage contexts without importing their auth material', () => {
    localStorage.setItem(
      SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY,
      JSON.stringify({
        sessionSlug: 'legacy-local-source',
        workerUrl: 'https://legacy-local-worker.example',
        faucetGrantToken: 'legacy-local-grant-token',
      }),
    );
    sessionStorage.setItem(
      SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY,
      JSON.stringify({
        sessionSlug: 'legacy-source',
        workerUrl: 'https://legacy-worker.example',
        faucetGrantToken: 'legacy-grant-token',
      }),
    );

    expect(readSponsoredBootstrapFundingContext()).toBeNull();
    expect(localStorage.getItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY)).toBeNull();
    expect(sessionStorage.getItem(SPONSORED_BOOTSTRAP_FUNDING_CONTEXT_KEY)).toBeNull();
  });
});
