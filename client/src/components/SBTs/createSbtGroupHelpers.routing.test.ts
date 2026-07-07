import {
  buildCreateSbtAutoCreate2SaltSource,
  buildCreateSbtAutoJoinUrl,
  buildCreateSbtDeterministicSymbol,
  buildCreateSbtPredictableDeploySignature,
  buildSessionRoutePath,
  getErrorMessage,
  resolveCreateSbtEffectiveSessionSlug,
  resolveCreateSbtErrorBannerState,
  resolveCreateSbtMetadataSessionSlug,
  resolveCreateSbtOpenMintAutoJoinUrl,
  resolveCreateSbtPredictedAddressCacheHit,
  resolveCreateSbtPredictableAddressActive,
  resolveCreateSbtPredictableDeployBaseState,
  resolveCreateSbtPredictedAddressDisplayText,
  shouldFallbackCreateSbtDeferredDraftUpload,
  shouldHideCreateSbtNetworkSelector,
} from './createSbtGroupHelpers';

describe('createSbtGroupHelpers routing and prediction helpers', () => {
  it('normalizes errors and route paths', () => {
    const errorBannerStyle = {
      margin: '10px 0 16px',
      padding: '10px 12px',
      border: '1px solid #dc3545',
      background: '#ffecec',
      color: '#a4000f',
      borderRadius: '6px',
      fontWeight: 600,
    };
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getErrorMessage({ message: 'plain' }, 'fallback')).toBe('plain');
    expect(getErrorMessage('', 'fallback')).toBe('fallback');
    expect(resolveCreateSbtErrorBannerState({ error: ' Failure ' })).toEqual({
      errorMessage: ' Failure ',
      shouldRenderErrorBanner: true,
      style: errorBannerStyle,
    });
    expect(resolveCreateSbtErrorBannerState({ error: '   ' })).toEqual({
      errorMessage: '   ',
      shouldRenderErrorBanner: false,
      style: errorBannerStyle,
    });
    expect(resolveCreateSbtErrorBannerState({ error: 0 })).toEqual({
      errorMessage: '0',
      shouldRenderErrorBanner: false,
      style: errorBannerStyle,
    });
    expect(shouldFallbackCreateSbtDeferredDraftUpload(new Error('Worker URL is missing'))).toBe(true);
    expect(shouldFallbackCreateSbtDeferredDraftUpload(new Error('invalid address.'))).toBe(true);
    expect(shouldFallbackCreateSbtDeferredDraftUpload(new Error('hard failure'))).toBe(false);
    expect(shouldFallbackCreateSbtDeferredDraftUpload('')).toBe(false);
    expect(shouldHideCreateSbtNetworkSelector({ hideNetworkSelector: true })).toBe(true);
    expect(shouldHideCreateSbtNetworkSelector({ deferredDeploy: true })).toBe(true);
    expect(shouldHideCreateSbtNetworkSelector({ hideNetworkSelector: 0, deferredDeploy: '' })).toBe(false);
    expect(buildSessionRoutePath(' Edge Session ', '/base/')).toBe('/base/session/Edge%20Session');
    expect(buildSessionRoutePath('', '/base/')).toBe('/base/session');
    expect(
      buildCreateSbtAutoJoinUrl({
        origin: 'https://context.example/',
        basePath: '/app/',
        sessionSlug: ' Edge Session ',
        sbtAddress: '0x000000000000000000000000000000000000000A',
      }),
    ).toBe('https://context.example/app/session/Edge%20Session?sbt=0x000000000000000000000000000000000000000A&auto=1');
    expect(
      buildCreateSbtAutoJoinUrl({
        origin: 'https://context.example',
        sessionSlug: '',
        sbtAddress: '0xA B',
      }),
    ).toBe('https://context.example/session?sbt=0xA%20B&auto=1');
    expect(
      buildCreateSbtAutoJoinUrl({
        origin: '',
        sbtAddress: '0xA',
      }),
    ).toBe('');
    const buildSessionAutoJoinUrl = jest.fn(() => 'built-url');
    expect(
      resolveCreateSbtOpenMintAutoJoinUrl({
        autoJoinUrl: 'cached-url',
        buildSessionAutoJoinUrl,
        distributionOption: 'anyoneCanMint',
        sbtAddress: '0xA',
      }),
    ).toBe('cached-url');
    expect(buildSessionAutoJoinUrl).not.toHaveBeenCalled();
    expect(
      resolveCreateSbtOpenMintAutoJoinUrl({
        buildSessionAutoJoinUrl,
        distributionOption: 'anyoneCanMint',
        sbtAddress: '0xA',
      }),
    ).toBe('built-url');
    expect(buildSessionAutoJoinUrl).toHaveBeenCalledWith('0xA');
    expect(
      resolveCreateSbtOpenMintAutoJoinUrl({
        buildSessionAutoJoinUrl,
        distributionOption: 'groupPassword',
        sbtAddress: '0xA',
      }),
    ).toBe('');
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
      buildCreateSbtAutoCreate2SaltSource({
        sessionSlug: 'General',
        sbtName: '',
        groupHash: '',
      }),
    ).toBe('general/group-draft');
    expect(
      buildCreateSbtDeterministicSymbol({
        saltSource: 'edge/group',
        digest: (value) => `0xabcdef123456-${value}`,
      }),
    ).toBe('CE-SBT-ABCDEF');
    expect(
      buildCreateSbtDeterministicSymbol({
        saltSource: '',
        digest: (value) => (value === 'context-engine-sbt' ? '0x123456' : ''),
      }),
    ).toBe('CE-SBT-123456');
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
      resolveCreateSbtPredictedAddressDisplayText({
        unavailableReason: 'Other reason',
      }),
    ).toBe('Pending…');
    expect(
      resolveCreateSbtPredictableAddressActive({
        deferredDeployMode: true,
      }),
    ).toBe(true);
    expect(
      resolveCreateSbtPredictableAddressActive({
        predictableAddressEnabled: true,
      }),
    ).toBe(true);
    expect(
      resolveCreateSbtPredictableAddressActive({
        create2Salt: ' salt ',
      }),
    ).toBe(true);
    expect(
      resolveCreateSbtPredictableAddressActive({
        create2Salt: ' ',
        deferredDeployMode: false,
        predictableAddressEnabled: false,
      }),
    ).toBe(false);
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
        sbtName: '',
      }).unavailableReason,
    ).toBe('Enter a group name to preview the address.');
    expect(
      resolveCreateSbtPredictableDeployBaseState({
        sbtName: 'Alpha',
        walletLowerLabel: 'wallet',
      }).unavailableReason,
    ).toBe('Connect a wallet to preview the address.');
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
        allowCached: false,
        cachedShapeSignature: 'shape-a',
        predictedAddress: '0xCached',
        predictionSignature: 'shape-a',
      }),
    ).toBeNull();
    expect(
      resolveCreateSbtPredictedAddressCacheHit({
        allowCached: true,
        cachedShapeSignature: 'shape-b',
        predictedAddress: '0xCached',
        predictionSignature: 'shape-a',
      }),
    ).toBeNull();
    expect(
      resolveCreateSbtPredictedAddressCacheHit({
        allowCached: true,
        cachedShapeSignature: 'shape-a',
        predictedAddress: ' ',
        predictionSignature: 'shape-a',
      }),
    ).toBeNull();
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
      JSON.parse(
        buildCreateSbtPredictableDeploySignature({
          predictionShape: { groupCfg: {}, hashedPasswords: 'bad' },
          network: { chainId: 84532 },
          selectedAuthoringChainId: '',
        }),
      ),
    ).toMatchObject({
      hashedPasswords: [],
      networkChainId: 84532,
    });
    expect(
      buildCreateSbtPredictableDeploySignature({
        predictionShape: null,
      }),
    ).toBe('');
    expect(resolveCreateSbtEffectiveSessionSlug({ props: { sessionSlug: 'prop-slug' } })).toBe('prop-slug');
    expect(resolveCreateSbtEffectiveSessionSlug({ props: { slug: 'legacy-prop' } })).toBe('legacy-prop');
    expect(resolveCreateSbtEffectiveSessionSlug({ pathname: '/demo/demo-slug/new' })).toBe('demo-slug');
    expect(resolveCreateSbtEffectiveSessionSlug({ pathname: '/sbts/session-slug/new' })).toBe('session-slug');
    expect(resolveCreateSbtEffectiveSessionSlug({ pathname: '/sbts/new' })).toBe('');
    expect(
      resolveCreateSbtMetadataSessionSlug({
        effectiveSessionSlug: ' Effective ',
        sessionConfigSlug: 'fallback',
      }),
    ).toBe('Effective');
    expect(
      resolveCreateSbtMetadataSessionSlug({
        sessionConfigSlug: ' fallback ',
      }),
    ).toBe('fallback');
    expect(
      resolveCreateSbtMetadataSessionSlug({
        deferredDeployMode: false,
      }),
    ).toBe('');
    expect(() =>
      resolveCreateSbtMetadataSessionSlug({
        deferredDeployMode: true,
        sbtLabel: 'Group',
      }),
    ).toThrow('Set the session URL before adding this Group to the session.');
  });
});
