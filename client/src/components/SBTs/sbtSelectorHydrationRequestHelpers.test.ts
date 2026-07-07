import {
  buildSelectedSbtHydrationAddresses,
  buildSelectedSbtHydrationSignature,
  resolveSbtSelectorLoadOptionsRequestDecision,
  resolveSbtSelectorTargetedHydrationDecision,
} from './sbtSelectorHydrationRequestHelpers';

describe('sbtSelectorHydrationRequestHelpers', () => {
  it('normalizes selected SBT hydration addresses and signatures', () => {
    expect(
      buildSelectedSbtHydrationAddresses([
        { address: '0x000000000000000000000000000000000000000a' },
        { address: '0x000000000000000000000000000000000000000A' },
        { address: 'bad' },
      ]),
    ).toEqual(['0x000000000000000000000000000000000000000A']);
    expect(buildSelectedSbtHydrationAddresses('bad')).toEqual([]);
    expect(
      buildSelectedSbtHydrationSignature({
        addresses: ['0xA', '0xB'],
        networkID: '84532',
        slug: 'alpha',
      }),
    ).toBe('alpha|84532|0xA,0xB');
  });

  it('decides targeted hydration retry behavior from hits and unresolved addresses', () => {
    expect(
      resolveSbtSelectorTargetedHydrationDecision({
        addresses: ['0xA', '0xB'],
        hits: [],
        targetedLookupEnabled: true,
      }),
    ).toEqual({
      hasHits: false,
      hasUnresolvedAddresses: true,
      shouldClearRetry: false,
      shouldReloadOptions: false,
      shouldRetry: true,
    });
    expect(
      resolveSbtSelectorTargetedHydrationDecision({
        addresses: ['0xA', '0xB'],
        hits: [{ address: '0xa' }],
        targetedLookupEnabled: true,
      }),
    ).toEqual({
      hasHits: true,
      hasUnresolvedAddresses: true,
      shouldClearRetry: false,
      shouldReloadOptions: true,
      shouldRetry: true,
    });
    expect(
      resolveSbtSelectorTargetedHydrationDecision({
        addresses: ['0xA'],
        hits: [{ address: '0xa' }],
        targetedLookupEnabled: true,
      }),
    ).toEqual({
      hasHits: true,
      hasUnresolvedAddresses: false,
      shouldClearRetry: true,
      shouldReloadOptions: true,
      shouldRetry: false,
    });
  });

  it('decides when load-options requests should reuse, queue, or skip', () => {
    expect(
      resolveSbtSelectorLoadOptionsRequestDecision({
        forceReload: false,
        inflightRequest: Promise.resolve(),
        inflightSig: 'old',
        requestSig: 'new',
      }),
    ).toEqual({
      shouldQueueRerun: true,
      shouldReturnInflight: true,
      shouldSkipUnchanged: false,
    });
    expect(
      resolveSbtSelectorLoadOptionsRequestDecision({
        forceReload: false,
        inflightRequest: null,
        lastRequestSig: 'same',
        requestSig: 'same',
      }),
    ).toEqual({
      shouldQueueRerun: false,
      shouldReturnInflight: false,
      shouldSkipUnchanged: true,
    });
    expect(
      resolveSbtSelectorLoadOptionsRequestDecision({
        forceReload: true,
        inflightRequest: null,
        lastRequestSig: 'same',
        requestSig: 'same',
      }),
    ).toEqual({
      shouldQueueRerun: false,
      shouldReturnInflight: false,
      shouldSkipUnchanged: false,
    });
  });
});
