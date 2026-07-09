import {
  buildCreateSbtAutoCreate2SaltSource,
  buildCreateSbtDeterministicSymbol,
  buildCreateSbtPredictableDeploySignature,
  resolveCreateSbtPredictedAddressCacheHit,
  resolveCreateSbtPredictedAddressDisplayText,
  resolveCreateSbtPredictableAddressActive,
  resolveCreateSbtPredictableDeployBaseState,
} from './createSbtGroupPredictableDeployHelpers';

describe('createSbtGroupPredictableDeployHelpers', () => {
  it('builds deterministic salt sources and symbols', () => {
    expect(
      buildCreateSbtAutoCreate2SaltSource({
        sessionSlug: ' Edge ',
        sbtName: ' Deferred Group! ',
        groupHash: '0xabcdef',
      }),
    ).toBe('Edge/deferred-group');
    expect(
      buildCreateSbtAutoCreate2SaltSource({
        sessionSlug: '',
        sbtName: '',
        groupHash: '0xabcdef1234567890',
      }),
    ).toBe('general/group-abcdef1234');
    expect(
      buildCreateSbtDeterministicSymbol({
        saltSource: 'edge/group',
        digest: (value) => `0xabcdef123456-${value}`,
      }),
    ).toBe('CE-SBT-ABCDEF');
  });

  it('resolves predicted address display text and active state', () => {
    expect(
      resolveCreateSbtPredictedAddressDisplayText({
        predictedAddress: ' 0xabc ',
      }),
    ).toBe('0xabc');
    expect(
      resolveCreateSbtPredictedAddressDisplayText({
        predictedAddressBusy: true,
      }),
    ).toBe('Pending…');
    expect(
      resolveCreateSbtPredictedAddressDisplayText({
        unavailableReason: 'Enter a group name to preview the address.',
      }),
    ).toBe('Pending group name…');
    expect(
      resolveCreateSbtPredictedAddressDisplayText({
        unavailableReason: 'Connect a wallet to preview the address.',
        walletLowerLabel: 'wallet',
      }),
    ).toBe('Pending admin account…');
    expect(
      resolveCreateSbtPredictableAddressActive({
        create2Salt: ' ',
        deferredDeployMode: false,
        predictableAddressEnabled: false,
      }),
    ).toBe(false);
    expect(
      resolveCreateSbtPredictableAddressActive({
        create2Salt: ' salt ',
      }),
    ).toBe(true);
  });

  it('builds predictable deploy base state and cache hits', () => {
    expect(
      resolveCreateSbtPredictableDeployBaseState({
        sbtName: ' Alpha Group ',
        burnAdmin: ' 0xAdmin ',
        isLimited: true,
        limitedNumber: '3.8',
      }),
    ).toEqual({
      adminAddress: '0xAdmin',
      limitedCount: 3,
      sbtNameTrimmed: 'Alpha Group',
      unavailableReason: '',
    });
    expect(
      resolveCreateSbtPredictableDeployBaseState({
        account: '0xAccount',
        isLimited: true,
        limitedNumber: 'bad',
        sbtName: 'Alpha',
      }).unavailableReason,
    ).toBe('Set a positive mint limit to preview the address.');
    expect(
      resolveCreateSbtPredictedAddressCacheHit({
        allowCached: true,
        cachedShapeSignature: 'shape-a',
        predictedAddress: ' 0xCached ',
        predictionSignature: 'shape-a',
      }),
    ).toEqual({
      predictedAddress: '0xCached',
      predictionSignature: 'shape-a',
    });
    expect(
      resolveCreateSbtPredictedAddressCacheHit({
        allowCached: true,
        cachedShapeSignature: 'shape-b',
        predictedAddress: '0xCached',
        predictionSignature: 'shape-a',
      }),
    ).toBeNull();
  });

  it('builds predictable deploy signatures with normalized contract shape', () => {
    expect(
      JSON.parse(
        buildCreateSbtPredictableDeploySignature({
          predictionShape: {
            contractName: ' Alpha ',
            symbol: ' ALP ',
            limitedNumber: '3',
            adminAddress: ' 0xADMIN ',
            mintingEndTimeUnix: '1700000000',
            mintModeOnChain: 2,
            hasPasswordMintOnChain: true,
            burnAuthEnum: '1',
            hashedPasswords: ['0xhash'],
            create2Salt: ' salt ',
            initializeGroupPasswordHash: true,
            groupCfg: {
              contracts: {
                sbtFactory: {
                  address: ' 0xF00 ',
                  chainId: '84532',
                },
              },
            },
          },
          network: { id: 10 },
          selectedAuthoringChainId: 11155420,
        }),
      ),
    ).toEqual({
      contractName: 'Alpha',
      symbol: 'ALP',
      limitedNumber: 3,
      adminAddress: '0xadmin',
      mintingEndTimeUnix: 1700000000,
      mintModeOnChain: 2,
      hasPasswordMintOnChain: true,
      burnAuthEnum: 1,
      hashedPasswords: ['0xhash'],
      create2Salt: 'salt',
      initializeGroupPasswordHash: true,
      sbtFactoryAddress: '0xf00',
      networkChainId: 84532,
    });
    expect(
      buildCreateSbtPredictableDeploySignature({
        predictionShape: null,
      }),
    ).toBe('');
  });
});
