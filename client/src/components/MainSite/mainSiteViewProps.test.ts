import {
  composeMainSiteAuthViewProps,
  composeMainSiteLoginViewProps,
  composeMainSiteQuestionCacheViewProps,
  composeMainSiteSessionCacheViewProps,
  composeMainSiteSurveyCacheViewProps,
  composeMainSiteWalletViewProps,
} from './mainSiteViewProps';

const props = {
  account: '0x00000000000000000000000000000000000000aa',
  provider: 'wagmi',
  toggleLoginModal: jest.fn(),
  loginComplete: true,
  loginInProgress: false,
} as any;

const state = {
  isSBTCacheReady: true,
  isSurveyCacheReady: false,
  isQuestionCacheReady: true,
  isResponsesCacheReady: false,
  isAllCachesReady: false,
  cacheHasLoaded: true,
  sbtCacheRevision: 7,
  questionResponsesNonce: 11,
  questionScanProgress: { phase: 'questions' },
} as any;

describe('mainSiteViewProps', () => {
  it('composes wallet, login, and auth view props without unrelated keys', () => {
    expect(composeMainSiteWalletViewProps(props)).toEqual({
      account: props.account,
      provider: props.provider,
    });
    expect(composeMainSiteLoginViewProps(props)).toEqual({
      toggleLoginModal: props.toggleLoginModal,
      loginComplete: props.loginComplete,
    });
    expect(composeMainSiteAuthViewProps(props)).toEqual({
      account: props.account,
      provider: props.provider,
      toggleLoginModal: props.toggleLoginModal,
      loginComplete: props.loginComplete,
      loginInProgress: props.loginInProgress,
    });
  });

  it('composes cache prop bundles for survey, question, and session views', () => {
    expect(composeMainSiteSurveyCacheViewProps(state)).toEqual({
      isSurveyCacheReady: false,
      isQuestionCacheReady: true,
      isResponsesCacheReady: false,
      isSBTCacheReady: true,
      cacheHasLoaded: true,
      sbtCacheRevision: 7,
      questionResponsesNonce: 11,
      questionScanProgress: { phase: 'questions' },
    });
    expect(composeMainSiteQuestionCacheViewProps(state)).toEqual({
      isQuestionCacheReady: true,
      isResponsesCacheReady: false,
      isSBTCacheReady: true,
      sbtCacheRevision: 7,
      questionResponsesNonce: 11,
      questionScanProgress: { phase: 'questions' },
    });
    expect(composeMainSiteSessionCacheViewProps(state)).toEqual({
      isSBTCacheReady: true,
      isSurveyCacheReady: false,
      isQuestionCacheReady: true,
      isResponsesCacheReady: false,
      sbtCacheRevision: 7,
      cacheHasLoaded: true,
      questionResponsesNonce: 11,
      questionScanProgress: { phase: 'questions' },
    });
  });
});
