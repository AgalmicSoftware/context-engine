import type { MainSiteProps, MainSiteState } from './MainSiteTypes';

export type MainSiteWalletViewProps = Pick<MainSiteProps, 'account' | 'provider'>;

export type MainSiteLoginViewProps = Pick<MainSiteProps, 'toggleLoginModal' | 'loginComplete'>;

export type MainSiteAuthViewProps = MainSiteWalletViewProps &
  MainSiteLoginViewProps &
  Pick<MainSiteProps, 'loginInProgress'>;

export type MainSiteSurveyCacheViewProps = Pick<
  MainSiteState,
  | 'isSurveyCacheReady'
  | 'isQuestionCacheReady'
  | 'isResponsesCacheReady'
  | 'isSBTCacheReady'
  | 'cacheHasLoaded'
  | 'sbtCacheRevision'
  | 'questionResponsesNonce'
  | 'questionScanProgress'
>;

export type MainSiteQuestionCacheViewProps = Pick<
  MainSiteState,
  | 'isQuestionCacheReady'
  | 'isResponsesCacheReady'
  | 'isSBTCacheReady'
  | 'sbtCacheRevision'
  | 'questionResponsesNonce'
  | 'questionScanProgress'
>;

export type MainSiteSessionCacheViewProps = Pick<
  MainSiteState,
  | 'isSBTCacheReady'
  | 'isSurveyCacheReady'
  | 'isQuestionCacheReady'
  | 'isResponsesCacheReady'
  | 'sbtCacheRevision'
  | 'cacheHasLoaded'
  | 'questionResponsesNonce'
  | 'questionScanProgress'
>;

export const composeMainSiteWalletViewProps = (props: MainSiteProps): MainSiteWalletViewProps => ({
  account: props.account,
  provider: props.provider,
});

export const composeMainSiteLoginViewProps = (props: MainSiteProps): MainSiteLoginViewProps => ({
  toggleLoginModal: props.toggleLoginModal,
  loginComplete: props.loginComplete,
});

export const composeMainSiteAuthViewProps = (props: MainSiteProps): MainSiteAuthViewProps => ({
  ...composeMainSiteWalletViewProps(props),
  ...composeMainSiteLoginViewProps(props),
  loginInProgress: props.loginInProgress,
});

export const composeMainSiteSurveyCacheViewProps = (state: MainSiteState): MainSiteSurveyCacheViewProps => ({
  isSurveyCacheReady: state.isSurveyCacheReady,
  isQuestionCacheReady: state.isQuestionCacheReady,
  isResponsesCacheReady: state.isResponsesCacheReady,
  isSBTCacheReady: state.isSBTCacheReady,
  cacheHasLoaded: state.cacheHasLoaded,
  sbtCacheRevision: state.sbtCacheRevision,
  questionResponsesNonce: state.questionResponsesNonce,
  questionScanProgress: state.questionScanProgress,
});

export const composeMainSiteQuestionCacheViewProps = (state: MainSiteState): MainSiteQuestionCacheViewProps => ({
  isQuestionCacheReady: state.isQuestionCacheReady,
  isResponsesCacheReady: state.isResponsesCacheReady,
  isSBTCacheReady: state.isSBTCacheReady,
  sbtCacheRevision: state.sbtCacheRevision,
  questionResponsesNonce: state.questionResponsesNonce,
  questionScanProgress: state.questionScanProgress,
});

export const composeMainSiteSessionCacheViewProps = (state: MainSiteState): MainSiteSessionCacheViewProps => ({
  isSBTCacheReady: state.isSBTCacheReady,
  isSurveyCacheReady: state.isSurveyCacheReady,
  isQuestionCacheReady: state.isQuestionCacheReady,
  isResponsesCacheReady: state.isResponsesCacheReady,
  sbtCacheRevision: state.sbtCacheRevision,
  cacheHasLoaded: state.cacheHasLoaded,
  questionResponsesNonce: state.questionResponsesNonce,
  questionScanProgress: state.questionScanProgress,
});
