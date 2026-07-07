import {
  buildSbtPageClaimCountdownCompletePatch,
  buildSbtPageClaimCountdownTickPatch,
  resolveSbtPageActiveBlockTimeMs,
  resolveSbtPageCountdownDisplaySeconds,
  resolveSbtPageMiniActionFailureState,
  resolveSbtPageMiniMintFlowDisplayState,
  resolveSbtPageMiniMintState,
  resolveSbtPageMintEndDisplayState,
} from './sbtPageHelpers';

describe('sbtPageHelpers mint display helpers', () => {
  it('resolves mint end display states', () => {
    const futureUnix = 1900000000;
    const pastUnix = 1700000000;
    expect(
      resolveSbtPageMintEndDisplayState({
        nowMs: 1800000000000,
        sbtInfo: { mintingEndTime: futureUnix },
      }),
    ).toEqual({
      fullMintEndDate: new Date(futureUnix * 1000).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'active',
      unixTS: futureUnix,
    });
    expect(
      resolveSbtPageMintEndDisplayState({
        nowMs: 1800000000000,
        sbtInfo: { mintingEndTime: pastUnix },
      }),
    ).toEqual({
      fullMintEndDate: new Date(pastUnix * 1000).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'expired',
      unixTS: pastUnix,
    });
    expect(
      resolveSbtPageMintEndDisplayState({
        sbtInfo: { mintingEndTime: 0 },
      }),
    ).toEqual({
      fullMintEndDate: '',
      status: 'never',
      unixTS: 0,
    });
    expect(
      resolveSbtPageMintEndDisplayState({
        sbtInfo: { mintingEndTime: null },
      }),
    ).toBeNull();
    expect(
      resolveSbtPageMiniMintState({
        burningStatus: 'idle',
        mintingStatus: 'success',
        nowSec: 1800000000,
        sbtAddress: '0xABC',
        sbtInfo: { mintingEndTime: 1900000000 },
        userHasSBT: false,
      }),
    ).toEqual({
      hasTokenMini: true,
      isMintingActive: true,
      justJoined: true,
      mintStatusId: 'mintStatus-0xabc',
      shouldRenderEndedIndicator: false,
      shouldRenderLiveIndicator: true,
    });
    expect(
      resolveSbtPageMiniMintState({
        burningStatus: 'success',
        mintingStatus: 'success',
        nowSec: 1800000000,
        sbtAddress: '0xABC',
        sbtInfo: { mintingEndTime: 1700000000 },
        userHasSBT: false,
      }),
    ).toMatchObject({
      hasTokenMini: false,
      isMintingActive: false,
      justJoined: false,
      shouldRenderEndedIndicator: true,
      shouldRenderLiveIndicator: false,
    });
    expect(
      resolveSbtPageMiniMintState({
        nowSec: 1800000000,
        sbtInfo: { mintingEndTime: 0 },
        userHasSBT: true,
      }),
    ).toMatchObject({
      hasTokenMini: true,
      isMintingActive: true,
    });
    expect(
      resolveSbtPageMiniActionFailureState({
        hasTokenMini: false,
        mintingStatus: 'failure',
      }),
    ).toEqual({
      showBurnFailedStatus: false,
      showMintFailedStatus: true,
    });
    expect(
      resolveSbtPageMiniActionFailureState({
        burningStatus: 'failure',
        hasTokenMini: true,
        mintingStatus: 'success',
      }),
    ).toEqual({
      showBurnFailedStatus: true,
      showMintFailedStatus: false,
    });
    expect(
      resolveSbtPageMiniActionFailureState({
        burningStatus: 'failure',
        hasTokenMini: false,
        mintingStatus: 'failure',
      }),
    ).toEqual({
      showBurnFailedStatus: false,
      showMintFailedStatus: true,
    });
  });

  it('resolves mini-card mint flow display states', () => {
    expect(
      resolveSbtPageMiniMintFlowDisplayState({
        hasGroupPasswordMint: true,
        hasInviteMint: true,
        isMintingActive: true,
        miniMintable: true,
        showMiniPasswordInput: false,
      }),
    ).toMatchObject({
      shouldRenderGroupPasswordDisclosureButton: true,
      shouldRenderInviteDisclosureButton: false,
      shouldRenderOpenMintButton: false,
    });
    expect(
      resolveSbtPageMiniMintFlowDisplayState({
        hasGroupPasswordMint: true,
        isMintingActive: true,
        miniMintable: true,
        showMiniPasswordInput: true,
      }),
    ).toMatchObject({
      shouldRenderGroupPasswordDisclosureButton: false,
      shouldRenderGroupPasswordInput: true,
    });
    expect(
      resolveSbtPageMiniMintFlowDisplayState({
        hasInviteMint: true,
        isMintingActive: true,
        miniMintable: true,
        showMiniPasswordInput: true,
      }),
    ).toMatchObject({
      shouldRenderInviteDisclosureButton: false,
      shouldRenderInviteInput: true,
    });
    expect(
      resolveSbtPageMiniMintFlowDisplayState({
        hasPasswordMint: true,
        isMintingActive: true,
        miniMintable: true,
        mintStep: 0,
        showMiniPasswordInput: false,
      }),
    ).toMatchObject({
      shouldRenderManualPasswordDisclosureButton: true,
      shouldRenderManualPasswordStartInput: false,
    });
    expect(
      resolveSbtPageMiniMintFlowDisplayState({
        hasPasswordMint: true,
        isMintingActive: true,
        miniMintable: true,
        mintStep: 2,
        showMiniPasswordInput: false,
      }),
    ).toMatchObject({
      shouldRenderManualPasswordFinishInput: true,
      shouldRenderManualPasswordStartInput: false,
    });
    expect(
      resolveSbtPageMiniMintFlowDisplayState({
        hasPasswordMint: true,
        isMintingActive: true,
        miniMintable: true,
        mintStep: 4,
      }),
    ).toMatchObject({
      shouldRenderManualClaimSuccess: true,
      shouldRenderOpenMintButton: false,
    });
    expect(
      resolveSbtPageMiniMintFlowDisplayState({
        isMintingActive: true,
        miniMintable: true,
      }),
    ).toMatchObject({
      shouldRenderOpenMintButton: true,
    });
    expect(
      resolveSbtPageMiniMintFlowDisplayState({
        isMintingActive: false,
        miniMintable: true,
      }),
    ).toMatchObject({
      shouldRenderOpenMintButton: false,
    });
  });

  it('scales active block time with a safe multiplier', () => {
    const getChainBlockTimeMs = jest.fn(() => 2000);

    expect(
      resolveSbtPageActiveBlockTimeMs({
        activeChainId: 84532,
        getChainBlockTimeMs,
        multiplier: 2.5,
      }),
    ).toBe(5000);
    expect(
      resolveSbtPageActiveBlockTimeMs({
        activeChainId: 84532,
        getChainBlockTimeMs,
        multiplier: 'bad',
      }),
    ).toBe(2000);
    expect(getChainBlockTimeMs).toHaveBeenCalledWith(84532);
  });

  it('coerces claim countdown milliseconds to display seconds', () => {
    expect(resolveSbtPageCountdownDisplaySeconds(5000)).toBe(5);
    expect(resolveSbtPageCountdownDisplaySeconds(4999)).toBe(5);
    expect(resolveSbtPageCountdownDisplaySeconds(0)).toBe(0);
    expect(resolveSbtPageCountdownDisplaySeconds(-1)).toBe(0);
    expect(resolveSbtPageCountdownDisplaySeconds('bad')).toBeNaN();
    expect(
      buildSbtPageClaimCountdownTickPatch({
        remainingMs: 4001,
      }),
    ).toEqual({
      claimCountdown: 5,
    });
    expect(
      buildSbtPageClaimCountdownCompletePatch({
        waitMs: 5000,
      }),
    ).toEqual({
      mintStep: 2,
      claimCountdown: 5,
    });
  });
});
