import type { QuestionScanProgressLike } from '../../utilities/session/mainSiteProgressHelpers.ts';

export type MainSiteRecord = Record<string, unknown>;
export type MainSiteCallback = (...args: unknown[]) => void;
export type MainSiteNetworkLike = MainSiteRecord & {
  id?: number | null;
  chainId?: number | null;
};
export type MainSiteLitHooksLike = MainSiteRecord & {
  getKey?: unknown;
};

export type MainSiteProps = {
  fetchSessionState: MainSiteCallback;
  fetchAccount: MainSiteCallback;
  changeAccount: MainSiteCallback;
  changeFocusedTab: MainSiteCallback;
  toggleLoginModal: MainSiteCallback;
  updateLoginInfo: MainSiteCallback;
  toggleDemoMode: MainSiteCallback;
  changeActiveSessionSlug: MainSiteCallback;
  profile?: MainSiteRecord;
  account?: string;
  provider?: string;
  network?: MainSiteNetworkLike;
  sessionState?: MainSiteRecord;
  focusedTab?: number;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  demoMode?: MainSiteRecord;
  demoSurfaceMode?: boolean | null;
  activeSessionSlug?: string;
  wagmiChainOptions?: unknown[];
  wagmiBlocknumber?: number;
  urlExtension?: MainSiteRecord;
  path?: string;
  nftCode?: string;
  urlPath?: string;
  firstVisit?: boolean;
  socket?: unknown;
  matchesContractAddress?: string;
  viewAddress?: string;
  [key: string]: unknown;
};

export type MainSiteState = {
  isSBTCacheReady: boolean;
  isSurveyCacheReady: boolean;
  isQuestionCacheReady: boolean;
  isResponsesCacheReady: boolean;
  isAllCachesReady: boolean;
  surveyCacheInitializationError: boolean;
  questionCacheInitializationError: boolean;
  cacheHasLoaded: boolean;
  sbtCacheRevision: number;
  sbtScanTick: number;
  sbtScanProgressBySlug: MainSiteRecord;
  sbtRealtimeCoverageBySlug: MainSiteRecord;
  questionResponsesNonce: number;
  sessionRegistryRevision: number;
  questionScanProgress: QuestionScanProgressLike | null;
  isScanningForGroup: string | null;
  scanFailedFor: string | null;
  scanErrorFor: string | null;
  scanErrorMessage: string;
  sbtDetailGroupSlug: string | null;
  sbtDetailAddress: string | null;
  latestBlockNumber?: number;
  litHooks: MainSiteLitHooksLike | null;
  sessionInfoOverrides: MainSiteRecord;
  sessionNameOverrides: MainSiteRecord;
  sessionHeaderOverrides: MainSiteRecord;
  groupCredentials: MainSiteRecord;
  sessionPathResolutionNonce: number;
  isCacheManagerReady: boolean;
  [key: string]: unknown;
};
