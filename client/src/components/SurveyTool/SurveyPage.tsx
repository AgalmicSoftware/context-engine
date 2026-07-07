/** @file SurveyPage.tsx */

import React, { Component } from 'react';

import SurveyTool from 'components/SurveyTool/SurveyTool';

import styles from './SurveyPage.module.scss';

type SurveyPageCallback = (...args: unknown[]) => unknown;

type SurveyPageProps = {
  activeSessionSlug?: string;
  sessionSlug?: string;
  sessionSlugPinned?: boolean;
  sessionConfig?: unknown;
  minifiedMode?: string;
  surveyID?: string;
  displayAnswerMode?: boolean;
  viewAddress?: string;
  autoOpenResults?: boolean;
  filterState?: unknown;
  singleQuestionMode?: boolean;
  toggleLoginModal?: () => void;
  account?: string;
  provider?: unknown;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  network?: { id?: number; chainId?: number; name?: string };
  isSBTCacheReady?: boolean;
  isSurveyCacheReady?: boolean;
  isQuestionCacheReady?: boolean;
  isResponsesCacheReady?: boolean;
  cacheHasLoaded?: boolean;
  scanForSurveyGroup?: unknown;
  questionResponsesNonce?: number;
  questionScanProgress?: unknown;
  questionPool?: unknown[];
  refreshSurveyResponsesByID?: SurveyPageCallback;
  refreshQuestionMetadata?: SurveyPageCallback;
  refreshQuestionResponses?: SurveyPageCallback;
  defaultTags?: unknown[];
  defaultFilterState?: unknown;
  sessionInfo?: unknown;
  sessionName?: string;
  defaultFeaturedSBTs?: unknown[];
  onViewAllClick?: SurveyPageCallback;
  hideEmbeddedDebugUi?: boolean;
  onResultsModalClose?: () => void;
  onFilterChange?: SurveyPageCallback;
  contracts?: unknown;
  blockLimits?: unknown;
  networkChainId?: number;
  litHooks?: unknown;
  [key: string]: unknown;
};

class SurveyComponent extends Component<SurveyPageProps> {
  render() {
    const effectiveActiveSessionSlug = this.props.activeSessionSlug || this.props.sessionSlug || '';
    const effectiveSessionSlug = this.props.sessionSlug || effectiveActiveSessionSlug;
    // Regression guard: this flag is about initial results scope, not just route parsing.
    // SurveyResults uses it to stay session-local by default on pinned session pages.
    const effectiveSessionSlugPinned = !!this.props.sessionSlugPinned;
    const effectiveSessionConfig = this.props.sessionConfig || null;
    const sharedSurveyToolProps = {
      ...this.props,
      activeSessionSlug: effectiveActiveSessionSlug,
      sessionSlug: effectiveSessionSlug,
      sessionSlugPinned: effectiveSessionSlugPinned,
      sessionConfig: effectiveSessionConfig,
    };

    // If minifiedMode is passed, render only SurveyTool with all props
    if (this.props.minifiedMode) {
      return <SurveyTool {...sharedSurveyToolProps} />;
    } else
      return (
        <div>
          <SurveyTool
            {...sharedSurveyToolProps}
            /* ---- routing / mode props ---- */
            surveyID={this.props.surveyID}
            displayAnswerMode={this.props.displayAnswerMode}
            viewAddress={this.props.viewAddress}
            autoOpenResults={this.props.autoOpenResults}
            filterState={this.props.filterState}
            singleQuestionMode={this.props.singleQuestionMode}

            /* ---- login / account props ---- */
            toggleLoginModal={this.props.toggleLoginModal}
            account={this.props.account}
            provider={this.props.provider}
            loginComplete={this.props.loginComplete}
            loginInProgress={this.props.loginInProgress}
            network={this.props.network}

            /* ---- cache-status flags ---- */
            isSBTCacheReady={this.props.isSBTCacheReady}
            isSurveyCacheReady={this.props.isSurveyCacheReady}
            isQuestionCacheReady={this.props.isQuestionCacheReady}
            isResponsesCacheReady={this.props.isResponsesCacheReady}
            cacheHasLoaded={this.props.cacheHasLoaded}

            scanForSurveyGroup={this.props.scanForSurveyGroup}

            /* ---- reactivity nonce ---- */
            questionResponsesNonce={this.props.questionResponsesNonce}
            questionScanProgress={this.props.questionScanProgress}
            questionPool={this.props.questionPool}

            /* ---- refresh callbacks ---- */
            refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
            refreshQuestionMetadata={this.props.refreshQuestionMetadata}
            refreshQuestionResponses={this.props.refreshQuestionResponses}

            /* ---- org/session customisation ---- */
            defaultTags={this.props.defaultTags}
            defaultFilterState={this.props.defaultFilterState}
            sessionInfo={this.props.sessionInfo}
            sessionName={this.props.sessionName}
            defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
            onViewAllClick={this.props.onViewAllClick}

            hideEmbeddedDebugUi={this.props.hideEmbeddedDebugUi}
            onResultsModalClose={this.props.onResultsModalClose}

            /* ---- lifted filter handler ---- */
            onFilterChange={this.props.onFilterChange}

            /* ---- Session props ---- */
            activeSessionSlug={effectiveActiveSessionSlug}
            sessionSlug={effectiveSessionSlug}
            sessionSlugPinned={effectiveSessionSlugPinned}
            sessionConfig={effectiveSessionConfig}
            contracts={this.props.contracts}
            blockLimits={this.props.blockLimits}
            networkChainId={this.props.networkChainId}

            preventUrlChange={true}

            litHooks={this.props.litHooks}
          />
        </div>
      );
  }
}

export default SurveyComponent;
