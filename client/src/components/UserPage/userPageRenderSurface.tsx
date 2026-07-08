import React from 'react';

import { getShortenedAddress } from 'utilities/ui/displayHelpers.js';
import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { t } from '../../utilities/ui/terminology.js';
import { createLogger } from 'utilities/logging.js';
import UserPageAnalysisModal from './UserPageAnalysisModal';
import UserPageComparePanel from './UserPageComparePanel';
import UserPageFullProfileModal from './UserPageFullProfileModal';
import UserPageHeader from './UserPageHeader';
import UserPageQuestionSection from './UserPageQuestionSection';
import UserPageSbtSection from './UserPageSbtSection';
import UserPageSimulatedActions from './UserPageSimulatedActions';
import UserPageSurveySection from './UserPageSurveySection';
import {
  buildUserPageCacheRefreshDisplayState,
  buildUserPageCreatedQuestionWrapperClassName,
  buildUserPageDeepScanTooltipDisplayState,
  buildUserPageHeaderBookmarkClassName,
  buildUserPageRootClassName,
  buildUserPageTooltipTargetIds,
  resolveUserPageAddressDisplayState,
  resolveUserPageAnalysisCacheStatusState,
  resolveUserPageAnalysisModalDisplayState,
  resolveUserPageAvatarDisplayState,
  resolveUserPageBlockieSeed,
  resolveUserPageBookmarkButtonDisplayState,
  resolveUserPageBookmarkNickname,
  resolveUserPageBookmarksLinkDisplayState,
  resolveUserPageCopyIconDisplayState,
  resolveUserPageFullProfileModalDisplayState,
  resolveUserPageHeaderPassiveDisplayState,
  resolveUserPageInlineEnteredIndicatorDisplayState,
  resolveUserPageQuestionSectionDisplayState,
  resolveUserPageSbtDisplayState,
  resolveUserPageSectionToggleDisplayState,
  resolveUserPageSurveySectionDisplayState,
  resolveUserPageUsernameErrorDisplayState,
} from './userPageHelpers';
import { runUserPageAnalyzeActionController, runUserPageBookmarkActionController } from './userPageActionController';
import styles from './UserPage.module.scss';
import type { UserPageBookmarksCache } from './userPageHelpers';
import type {
  DeepScanProgressRow,
  DerivedSbtListItem,
  NormalizedQuestionResponsePayload,
  SurveyQuestionResponseDetail,
  UnknownRecord,
  UserPageRenderQuestionEntry,
  UserPageRenderSurveyEntry,
} from './userPageRuntimeTypes';

const CompareAddressSection = React.lazy(() => import('./CompareAddresses'));
const accountLog = createLogger('account');

type UserPageRenderState = UnknownRecord & {
  aiAnalysis?: React.ReactNode;
  aiAvailable?: unknown;
  analysisCachedAt?: unknown;
  analysisDetails?: React.ReactNode;
  analysisElapsedMs?: number;
  analysisError?: React.ReactNode;
  analysisHistoricalFigure?: React.ReactNode;
  analysisHistoricalReasoning?: React.ReactNode;
  analysisName?: React.ReactNode;
  analysisServedFromCache?: unknown;
  analyzing?: boolean;
  bookmarked?: boolean;
  collapseOpen?: boolean;
  copied?: boolean;
  detailedQuestionResponses?: unknown;
  detailedSurveyResponses?: unknown;
  expandedSurveyResponses?: unknown;
  expandedSurveysCreated?: unknown;
  hasUncertainGateAccess?: unknown;
  hasUncertainSbtData?: unknown;
  hasUncertainUserData?: unknown;
  isDeepScanning?: boolean;
  isEditingNickname?: boolean;
  isEditingUsername?: boolean;
  isSimulated?: boolean;
  loadingQuestions?: boolean;
  loadingSBTs?: boolean;
  loadingSurveys?: boolean;
  nicknameInput?: string;
  questionCreationInfo?: UserPageRenderQuestionEntry[];
  questionResponseInfo?: UserPageRenderQuestionEntry[];
  sbtList?: DerivedSbtListItem[];
  selectedTab?: string;
  showAnalysisModal?: boolean;
  showFullProfileModal?: boolean;
  showSectionQuestionResponsesOpen?: boolean;
  showSectionQuestionsCreatedOpen?: boolean;
  showSectionSurveyResponsesOpen?: boolean;
  showSectionSurveysCreatedOpen?: boolean;
  surveyCreationInfo?: UserPageRenderSurveyEntry[];
  surveyResponseInfo?: UserPageRenderSurveyEntry[];
  username?: string;
  usernameError?: string;
  userStats?: unknown;
  viewAddress?: unknown;
};

type UserPageRenderProps = UnknownRecord & {
  account?: string;
  activeSessionSlug?: unknown;
  isQuestionCacheReady?: unknown;
  isResponsesCacheReady?: unknown;
  isSBTCacheReady?: unknown;
  isSurveyCacheReady?: unknown;
  loginComplete?: unknown;
  minimized?: boolean;
  network?: Record<string, unknown> | null;
  provider?: unknown;
  questionResponsesNonce?: unknown;
  sbtCacheRevision?: unknown;
  scanSpecificUserProfile?: (address: string) => Promise<unknown> | unknown;
  viewAddress?: string;
};

type UserPageQuestionSectionProps = React.ComponentProps<typeof UserPageQuestionSection>;
type UserPageSurveySectionProps = React.ComponentProps<typeof UserPageSurveySection>;
type UserPageSbtSectionProps = React.ComponentProps<typeof UserPageSbtSection>;

type RenderDeepScanIndicator = (
  targetId: string,
  tooltipLines: string[] | null | undefined,
  progressRows: DeepScanProgressRow[] | null | undefined,
  titleText: string,
) => React.ReactNode;

export type RenderUserPageSurfaceArgs = {
  analyzeUser: (forceRefresh?: unknown) => unknown;
  buildDeepScanProgressRows: () => DeepScanProgressRow[] | null;
  buildDeepScanProgressTooltip: () => string[] | null;
  copyToClipboard: React.MouseEventHandler<HTMLButtonElement>;
  dispatchSbtDataRefresh: UserPageSbtSectionProps['onRefreshSbtData'];
  getBookmarksCache: () => UserPageBookmarksCache;
  getExplorerUrl: () => string | null;
  handleDecryptQuestionAnswer: UserPageQuestionSectionProps['onDecryptQuestion'];
  handleNicknameChange: React.ChangeEventHandler<HTMLInputElement>;
  handleNicknameKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  handleUsernameChange: React.ChangeEventHandler<HTMLInputElement>;
  handleUsernameKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  isDeepScanLoadingEnabledForSection: (section?: unknown) => boolean;
  onPenClick: React.MouseEventHandler<HTMLButtonElement>;
  onUsernamePenClick: React.MouseEventHandler<HTMLButtonElement>;
  openFullProfileModal: () => void;
  props: UserPageRenderProps;
  renderDeepScanStatusIndicator: RenderDeepScanIndicator;
  saveNickname: React.FocusEventHandler<HTMLInputElement>;
  setUsername: React.FocusEventHandler<HTMLInputElement>;
  showQuestionsTab: () => void;
  showSurveysTab: () => void;
  state: UserPageRenderState;
  toggleAnalysisModal: () => void;
  toggleBookmark: React.MouseEventHandler<HTMLButtonElement>;
  toggleCollapse: React.MouseEventHandler<HTMLButtonElement> & ((statType: string) => unknown);
  toggleFullProfileModal: () => void;
  toggleQuestionResponsesSection: UserPageQuestionSectionProps['onQuestionResponsesSectionToggle'];
  toggleQuestionsCreatedSection: UserPageQuestionSectionProps['onQuestionsCreatedSectionToggle'];
  toggleSurveyCreated: UserPageSurveySectionProps['onSurveyCreatedToggle'];
  toggleSurveyResponses: UserPageSurveySectionProps['onSurveyResponseToggle'];
  toggleSurveyResponsesSection: UserPageSurveySectionProps['onSurveyResponsesSectionToggle'];
  toggleSurveysCreatedSection: UserPageSurveySectionProps['onSurveysCreatedSectionToggle'];
};

export const renderUserPageSurface = ({
  analyzeUser,
  buildDeepScanProgressRows,
  buildDeepScanProgressTooltip,
  copyToClipboard,
  dispatchSbtDataRefresh,
  getBookmarksCache,
  getExplorerUrl,
  handleDecryptQuestionAnswer,
  handleNicknameChange,
  handleNicknameKeyDown,
  handleUsernameChange,
  handleUsernameKeyDown,
  isDeepScanLoadingEnabledForSection,
  onPenClick,
  onUsernamePenClick,
  openFullProfileModal,
  props,
  renderDeepScanStatusIndicator,
  saveNickname,
  setUsername,
  showQuestionsTab,
  showSurveysTab,
  state,
  toggleAnalysisModal,
  toggleBookmark,
  toggleCollapse,
  toggleFullProfileModal,
  toggleQuestionResponsesSection,
  toggleQuestionsCreatedSection,
  toggleSurveyCreated,
  toggleSurveyResponses,
  toggleSurveyResponsesSection,
  toggleSurveysCreatedSection,
}: RenderUserPageSurfaceArgs): React.ReactElement => {
  const {
    surveyResponseInfo,
    surveyCreationInfo,
    questionCreationInfo,
    questionResponseInfo,
    userStats,
    copied,
    collapseOpen,
    username,
    usernameError,
    bookmarked,
    sbtList,
    loadingSBTs,
    loadingSurveys,
    loadingQuestions,
    showAnalysisModal,
    aiAnalysis,
    analysisDetails,
    analysisName,
    analysisError,
    analyzing,
    analysisElapsedMs,
    analysisHistoricalFigure,
    analysisHistoricalReasoning,
    analysisServedFromCache,
    analysisCachedAt,
    showFullProfileModal,
    isSimulated,
    selectedTab,
    expandedSurveyResponses,
    expandedSurveysCreated,
    detailedSurveyResponses,
    detailedQuestionResponses,

    // NEW: section toggles
    showSectionSurveyResponsesOpen,
    showSectionSurveysCreatedOpen,
    showSectionQuestionResponsesOpen,
    showSectionQuestionsCreatedOpen,

    // NEW: Deep scan flag
    isDeepScanning,
  } = state;

  const { minimized, account, viewAddress: propViewAddress, provider, network, loginComplete } = props;
  const surveyResponseEntries = surveyResponseInfo as UserPageRenderSurveyEntry[];
  const surveyCreationEntries = surveyCreationInfo as UserPageRenderSurveyEntry[];
  const questionResponseEntries = questionResponseInfo as UserPageRenderQuestionEntry[];
  const questionCreationEntries = questionCreationInfo as UserPageRenderQuestionEntry[];
  const sbtEntries = sbtList as DerivedSbtListItem[];
  const expandedSurveyResponseMap = expandedSurveyResponses as Record<string, boolean | undefined>;
  const expandedSurveyCreatedMap = expandedSurveysCreated as Record<string, boolean | undefined>;
  const detailedSurveyResponseMap = detailedSurveyResponses as Record<
    string,
    SurveyQuestionResponseDetail[] | undefined
  >;
  const detailedQuestionResponseMap = detailedQuestionResponses as Record<
    string,
    NormalizedQuestionResponsePayload | null | undefined
  >;

  // === Compute display label with nickname priority (scoped strictly to current viewAddress) ===
  let cachedNicknameForThis = '';
  try {
    const parsed = getBookmarksCache();
    cachedNicknameForThis = resolveUserPageBookmarkNickname({
      address: propViewAddress,
      trim: true,
      users: parsed?.users,
    });
  } catch (e) {
    accountLog.warn('UserPage: fallback', e);
  }

  const explorerUrl = getExplorerUrl();
  const {
    addressHref,
    addressLabel,
    pendingNicknameForThis: pendingForThis,
    shouldLinkAddressLabel,
  } = resolveUserPageAddressDisplayState({
    bookmarked,
    cachedNickname: cachedNicknameForThis,
    explorerUrl,
    getShortenedAddress,
    isEditingNickname: state.isEditingNickname,
    isSimulated,
    minimized,
    nicknameInput: state.nicknameInput,
    propViewAddress,
    stateViewAddress: state.viewAddress,
    username,
  });
  const renderedAddressHref = String(addressHref || '').startsWith('/')
    ? buildPublicRoute(String(addressHref || ''))
    : addressHref;
  const addressDisplay = shouldLinkAddressLabel ? (
    <a
      href={renderedAddressHref}
      {...(!minimized
        ? {
            target: '_blank',
            rel: 'noopener noreferrer',
          }
        : {})}
      className={styles.addressLink}
    >
      {addressLabel}
    </a>
  ) : (
    addressLabel
  );

  // === Blockie seed & URL (deterministic across minimized/maximized) ===
  const blockieSeed = resolveUserPageBlockieSeed({ propViewAddress, username });
  const blockieUrl = generateBlockieDataUrl(blockieSeed, 8, 4);

  // --------- NEW: Readiness & spinner glue (defensive) ----------
  const cacheRefreshDisplayState = buildUserPageCacheRefreshDisplayState({
    aiAvailable: state.aiAvailable,
    analyzing,
    collapseOpen,
    hasUncertainGateAccess: state.hasUncertainGateAccess,
    hasUncertainSbtData: state.hasUncertainSbtData,
    hasUncertainUserData: state.hasUncertainUserData,
    isDeepScanLoadingEnabledForSection: isDeepScanLoadingEnabledForSection,
    isDeepScanning,
    isQuestionCacheReady: props.isQuestionCacheReady,
    isResponsesCacheReady: props.isResponsesCacheReady,
    isSBTCacheReady: props.isSBTCacheReady,
    isSurveyCacheReady: props.isSurveyCacheReady,
    loadingQuestions,
    loadingSBTs,
    loadingSurveys,
    questionCreationInfo,
    questionResponseInfo,
    sbtLabel: t('sbt'),
    sbtList,
    sbtsLowerLabel: t('sbtsLower'),
    surveyCreationInfo,
    surveyResponseInfo,
    walletLabel: t('walletLower'),
  });
  const { isQuestionLoadingAny, isSbtLoadingAny, isSurveyLoadingAny } = cacheRefreshDisplayState.loadingState;
  const aiActionPlan = cacheRefreshDisplayState.aiActionPlan;
  const { analyzeButtonDisplayState, compareButtonDisplayState } = aiActionPlan;
  const analyzeActionPlan = {
    blockedReason: 'none',
    disabled: analyzeButtonDisplayState.disabled,
    shouldRenderAnalyzeAction: !minimized,
  };
  const analysisCacheStatusState = resolveUserPageAnalysisCacheStatusState({
    analysisCachedAt,
    analysisServedFromCache,
  });
  const analysisModalDisplayState = resolveUserPageAnalysisModalDisplayState({
    analysisDetails,
    analysisError,
    analysisHistoricalFigure,
    analysisHistoricalReasoning,
    analyzing,
  });

  // --- Loading States Logic ---
  // 2. "Empty" flags: Used to determine if we show the "No items" message.
  // NOTE: We suppress the large white body spinner in favor of the green corner spinner.
  const {
    sbtSectionLoadingEmpty,
    surveyResponsesLoadingEmpty,
    surveysCreatedLoadingEmpty,
    questionResponsesLoadingEmpty,
    questionsCreatedLoadingEmpty,
  } = cacheRefreshDisplayState.sectionLoadingEmptyState;
  const { questionResponsesEmptyText, sbtEmptyText } = cacheRefreshDisplayState.uncertainEmptyText;
  const questionSectionDisplayState = resolveUserPageQuestionSectionDisplayState({
    questionCreationInfo,
    questionResponseInfo,
    questionResponsesLoadingEmpty,
    questionsCreatedLoadingEmpty,
  });
  const surveySectionDisplayState = resolveUserPageSurveySectionDisplayState({
    isDeepScanning: state.isDeepScanning,
    surveyCreationInfo,
    surveyResponseInfo,
    surveyResponsesLoadingEmpty,
    surveysCreatedLoadingEmpty,
  });
  const sbtDisplayState = resolveUserPageSbtDisplayState({
    isSBTCacheReady: props.isSBTCacheReady,
    loadingSBTs,
    sbtList,
    sbtSectionLoadingEmpty,
  });

  // Unique tooltip targets (wrapping spans) for disabled buttons.
  // Sanitize route-derived values to avoid invalid selector chars (e.g. "/")
  // in reactstrap tooltip `target` selectors.
  const {
    analyzeBtnWrapId,
    compareBtnWrapId,
    questionSpinnerId,
    questionsCreatedSpinnerId,
    sbtSpinnerId,
    surveySpinnerId,
    surveysCreatedSpinnerId,
  } = buildUserPageTooltipTargetIds(propViewAddress);
  const deepScanTooltipLines = buildDeepScanProgressTooltip();
  const deepScanProgressRows = buildDeepScanProgressRows();
  const { deepScanTooltipContent, deepScanTooltipTitle } = buildUserPageDeepScanTooltipDisplayState({
    deepScanProgressRows,
    deepScanTooltipLines,
    isDeepScanning,
  });
  const renderDeepScanIndicator = (isLoading: boolean, spinnerId: string) =>
    isLoading
      ? renderDeepScanStatusIndicator(spinnerId, deepScanTooltipContent, deepScanProgressRows, deepScanTooltipTitle)
      : null;

  const headerPassiveDisplayState = resolveUserPageHeaderPassiveDisplayState({
    account,
    cachedNickname: cachedNicknameForThis,
    explorerUrl,
    isEditingNickname: state.isEditingNickname,
    isEditingUsername: state.isEditingUsername,
    isSimulated,
    minimized,
    pendingNickname: pendingForThis,
    propViewAddress,
    viewAddress: propViewAddress,
  });
  const { isOwner, showPen, showUsernamePen } = headerPassiveDisplayState.profileEditVisibility;
  const headerActionVisibility = headerPassiveDisplayState.headerActionVisibility;
  const bookmarkActionPlan = {
    blockedReason: 'none',
    disabled: false,
    shouldRenderBookmarkAction: headerActionVisibility.showBookmarkButton,
  };
  const copyIconDisplayState = resolveUserPageCopyIconDisplayState({ copied });
  const bookmarkButtonDisplayState = resolveUserPageBookmarkButtonDisplayState({ bookmarked });
  const nicknameEnteredIndicatorDisplayState = resolveUserPageInlineEnteredIndicatorDisplayState({
    value: state.nicknameInput,
  });
  const usernameEnteredIndicatorDisplayState = resolveUserPageInlineEnteredIndicatorDisplayState({
    value: state.username,
  });
  const usernameErrorDisplayState = resolveUserPageUsernameErrorDisplayState({
    usernameError,
  });
  const surveyResponsesSectionToggleState = resolveUserPageSectionToggleDisplayState({
    open: showSectionSurveyResponsesOpen,
  });
  const surveysCreatedSectionToggleState = resolveUserPageSectionToggleDisplayState({
    open: showSectionSurveysCreatedOpen,
  });
  const questionResponsesSectionToggleState = resolveUserPageSectionToggleDisplayState({
    open: showSectionQuestionResponsesOpen,
  });
  const questionsCreatedSectionToggleState = resolveUserPageSectionToggleDisplayState({
    open: showSectionQuestionsCreatedOpen,
  });
  const fullProfileModalDisplayState = resolveUserPageFullProfileModalDisplayState({
    account,
    explorerUrl,
    minimized,
    propViewAddress,
    surveyResponseInfo,
    surveyResponsesLoadingEmpty,
  });
  const rootClassName = buildUserPageRootClassName({
    baseClassName: styles.userPage,
    minimized,
    minimizedClassName: styles.minimized,
  });
  const headerBookmarkClassName = buildUserPageHeaderBookmarkClassName({
    baseClassName: styles.bookmarkButton,
    headerClassName: styles.headerBookmark,
  });
  const avatarDisplayState = resolveUserPageAvatarDisplayState({
    blockieUrl,
  });
  const bookmarksLinkDisplayState = resolveUserPageBookmarksLinkDisplayState({
    baseClassName: styles.bookmarksLink,
    inlineClassName: styles.bookmarksLinkInline,
  });
  const createdQuestionWrapperClassName = buildUserPageCreatedQuestionWrapperClassName({
    baseClassName: styles.createdQuestionWrapper,
    bolderClassName: styles.createdQuestionBolder,
  });

  return (
    <div className={rootClassName}>
      <UserPageHeader
        addressDisplay={addressDisplay}
        analyzeButtonDisplayState={analyzeButtonDisplayState}
        avatarDisplayState={avatarDisplayState}
        bookmarkButtonDisplayState={bookmarkButtonDisplayState}
        bookmarksHref={buildPublicRoute('/bookmarks')}
        bookmarksLinkDisplayState={bookmarksLinkDisplayState}
        compareButtonDisplayState={compareButtonDisplayState}
        copyIconDisplayState={copyIconDisplayState}
        explorerUrl={explorerUrl}
        headerActionVisibility={headerActionVisibility}
        headerBookmarkClassName={headerBookmarkClassName}
        isEditingUsername={state.isEditingUsername}
        isOwner={isOwner}
        minimized={minimized}
        nicknameEnteredIndicatorDisplayState={nicknameEnteredIndicatorDisplayState}
        nicknameInput={state.nicknameInput || ''}
        onAnalyzeUser={(event) =>
          runUserPageAnalyzeActionController({
            analyzeArgs: [event],
            event,
            plan: analyzeActionPlan,
            ports: { dispatchAnalyze: analyzeUser },
          })
        }
        onBookmark={(event) =>
          runUserPageBookmarkActionController({
            bookmarkArgs: [event],
            event,
            plan: bookmarkActionPlan,
            ports: { dispatchBookmark: toggleBookmark },
          })
        }
        onCollapseToggle={toggleCollapse}
        onCopyAddress={copyToClipboard}
        onNicknameBlur={saveNickname}
        onNicknameChange={handleNicknameChange}
        onNicknameEdit={onPenClick}
        onNicknameKeyDown={handleNicknameKeyDown}
        onUsernameBlur={setUsername}
        onUsernameChange={handleUsernameChange}
        onUsernameEdit={onUsernamePenClick}
        onUsernameKeyDown={handleUsernameKeyDown}
        showPen={showPen}
        showUsernamePen={showUsernamePen}
        username={state.username}
        usernameEnteredIndicatorDisplayState={usernameEnteredIndicatorDisplayState}
        usernameErrorDisplayState={usernameErrorDisplayState}
      />

      <UserPageComparePanel collapseOpen={collapseOpen} minimized={minimized}>
        <CompareAddressSection
          firstAddress={propViewAddress}
          account={account}
          scanSpecificUserProfile={props.scanSpecificUserProfile}
        />
      </UserPageComparePanel>

      {!minimized && (
        <div className={styles.content}>
          {selectedTab === 'surveys' && (
            <UserPageSurveySection
              detailedSurveyResponseMap={detailedSurveyResponseMap}
              expandedSurveyCreatedMap={expandedSurveyCreatedMap}
              expandedSurveyResponseMap={expandedSurveyResponseMap}
              getSurveyCreatedHref={(survey, surveyLinkSlug) =>
                buildPublicRoute(
                  `/survey/${encodeURIComponent(String(survey.id))}${surveyLinkSlug ? `?session=${encodeURIComponent(String(surveyLinkSlug))}` : ''}`,
                )
              }
              isSurveyLoadingAny={isSurveyLoadingAny}
              onDecryptQuestion={handleDecryptQuestionAnswer}
              onOpenSurveyResponse={(survey, e: React.MouseEvent<HTMLElement>) => {
                e.stopPropagation();
                const surveyUrlParams = new URLSearchParams();
                if (survey.slug) {
                  surveyUrlParams.set('session', survey.slug);
                }
                surveyUrlParams.set('responder', String(propViewAddress));
                window.open(
                  buildPublicRoute(
                    `/survey/${encodeURIComponent(String(survey.id))}${surveyUrlParams.toString() ? `?${surveyUrlParams.toString()}` : ''}`,
                  ),
                  '_blank',
                  'noopener,noreferrer',
                );
              }}
              onShowQuestionsTab={(e: React.MouseEvent<HTMLElement>) => {
                e.stopPropagation();
                showQuestionsTab();
              }}
              onSurveyCreatedToggle={toggleSurveyCreated}
              onSurveyResponsesSectionToggle={toggleSurveyResponsesSection}
              onSurveyResponseToggle={toggleSurveyResponses}
              onSurveysCreatedSectionToggle={toggleSurveysCreatedSection}
              questionResponsesNonce={props.questionResponsesNonce}
              responderAddress={propViewAddress}
              sbtCacheRevision={props.sbtCacheRevision}
              surveyCreationEntries={surveyCreationEntries}
              surveyResponseEntries={surveyResponseEntries}
              surveyResponsesLoadingIndicator={renderDeepScanIndicator(isSurveyLoadingAny, surveySpinnerId)}
              surveyResponsesSectionToggleState={surveyResponsesSectionToggleState}
              surveySectionDisplayState={surveySectionDisplayState}
              surveysCreatedLoadingIndicator={renderDeepScanIndicator(isSurveyLoadingAny, surveysCreatedSpinnerId)}
              surveysCreatedSectionToggleState={surveysCreatedSectionToggleState}
            />
          )}

          {selectedTab === 'questions' && (
            <UserPageQuestionSection
              activeSessionSlug={props.activeSessionSlug}
              createdQuestionWrapperClassName={createdQuestionWrapperClassName}
              detailedQuestionResponseMap={detailedQuestionResponseMap}
              isQuestionLoadingAny={isQuestionLoadingAny}
              network={network}
              onDecryptQuestion={handleDecryptQuestionAnswer}
              onQuestionResponsesSectionToggle={toggleQuestionResponsesSection}
              onQuestionsCreatedSectionToggle={toggleQuestionsCreatedSection}
              onShowSurveysTab={(e: React.MouseEvent<HTMLElement>) => {
                e.stopPropagation();
                showSurveysTab();
              }}
              questionCreationEntries={questionCreationEntries}
              questionResponsesEmptyText={questionResponsesEmptyText}
              questionResponsesLoadingIndicator={renderDeepScanIndicator(isQuestionLoadingAny, questionSpinnerId)}
              questionResponsesNonce={props.questionResponsesNonce}
              questionResponseEntries={questionResponseEntries}
              questionResponsesSectionToggleState={questionResponsesSectionToggleState}
              questionSectionDisplayState={questionSectionDisplayState}
              questionsCreatedLoadingIndicator={renderDeepScanIndicator(
                isQuestionLoadingAny,
                questionsCreatedSpinnerId,
              )}
              questionsCreatedSectionToggleState={questionsCreatedSectionToggleState}
              responderAddress={propViewAddress}
              sbtCacheRevision={props.sbtCacheRevision}
            />
          )}

          <UserPageSbtSection
            account={account}
            heading={`${t('minted')} ${t('sbts')}:`}
            isLoading={isSbtLoadingAny}
            isSBTCacheReady={props.isSBTCacheReady}
            loadingIndicator={renderDeepScanIndicator(isSbtLoadingAny, sbtSpinnerId)}
            loginComplete={loginComplete}
            network={network}
            onRefreshSbtData={dispatchSbtDataRefresh}
            provider={provider}
            sbtDisplayState={sbtDisplayState}
            sbtEmptyText={sbtEmptyText}
            sbtEntries={sbtEntries}
          />
        </div>
      )}

      <UserPageSimulatedActions
        isSimulated={isSimulated}
        onViewResponses={() => {
          openFullProfileModal();
        }}
      />

      <UserPageAnalysisModal
        aiAnalysis={aiAnalysis}
        analysisCacheStatusState={analysisCacheStatusState}
        analysisDetails={analysisDetails}
        analysisElapsedMs={analysisElapsedMs}
        analysisError={analysisError}
        analysisHistoricalFigure={analysisHistoricalFigure}
        analysisHistoricalReasoning={analysisHistoricalReasoning}
        analysisModalDisplayState={analysisModalDisplayState}
        analysisName={analysisName}
        analyzing={analyzing}
        isOpen={Boolean(showAnalysisModal)}
        onRefreshAnalysis={() => analyzeUser(true)}
        onToggle={() => {
          toggleAnalysisModal();
        }}
      />

      <UserPageFullProfileModal
        aiAnalysis={aiAnalysis}
        bookmarksHref={buildPublicRoute('/bookmarks')}
        collapseOpen={String(collapseOpen || '')}
        explorerUrl={explorerUrl}
        fullProfileModalDisplayState={fullProfileModalDisplayState}
        isOpen={Boolean(showFullProfileModal)}
        isSBTCacheReady={props.isSBTCacheReady}
        loginComplete={loginComplete}
        mintedSbtsHeading={`${t('minted')} ${t('sbts')}`}
        network={network}
        onRefreshSbtData={dispatchSbtDataRefresh}
        onStatsCollapseToggle={toggleCollapse}
        onToggle={() => {
          toggleFullProfileModal();
        }}
        provider={provider}
        sbtDisplayState={sbtDisplayState}
        sbtEmptyText={sbtEmptyText}
        sbtEntries={sbtEntries}
        surveyResponseEntries={surveyResponseEntries}
        userStats={userStats as Record<string, React.ReactNode>}
      />
    </div>
  );
};
