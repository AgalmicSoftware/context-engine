import React, { Suspense } from 'react';

import PolisReport from '../PolisReport/PolisReport';
import LazyFallback from '../Shared/LazyFallback';
import styles from './SurveyResults.module.scss';

const DemoAnalysisWorkspace = React.lazy(() => import('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace'));
const DebateMap = React.lazy(() => import('../DebateMap/DebateMap'));
const RiskMatrix = React.lazy(() => import('../MainContent/RiskMatrix'));

type SurveyResultsRecord = Record<string, unknown>;
const DebateMapForSurveyResults = DebateMap as React.ComponentType<SurveyResultsRecord>;
type PolisReportProps = React.ComponentProps<typeof PolisReport>;

export type SurveyResultsDemoSurfaceProps = {
  activeSlug: string;
  atlasNodeId?: unknown;
  defaultTags?: PolisReportProps['defaultTags'];
  filterState?: PolisReportProps['filterState'];
  isQuestionCacheReady?: PolisReportProps['isQuestionCacheReady'];
  isResponsesCacheReady?: PolisReportProps['isResponsesCacheReady'];
  network?: PolisReportProps['network'];
  networkChainId?: PolisReportProps['networkChainId'];
  onAtlasModalClose: () => void;
  onAtlasNodeOpen: (nodeId: unknown) => void;
  questionResponses: PolisReportProps['questionResponses'];
  questionResponsesNonce?: unknown;
  questionScanProgress?: unknown;
  viewKey?: unknown;
};

const SurveyResultsDemoSurface = ({
  activeSlug,
  atlasNodeId,
  defaultTags,
  filterState,
  isQuestionCacheReady,
  isResponsesCacheReady,
  network,
  networkChainId,
  onAtlasModalClose,
  onAtlasNodeOpen,
  questionResponses,
  questionResponsesNonce,
  questionScanProgress,
  viewKey = 'report',
}: SurveyResultsDemoSurfaceProps): React.ReactNode => {
  if (viewKey === 'report') {
    return (
      <div id="polisReportSection">
        <PolisReport
          questionResponses={questionResponses}
          network={network}
          networkChainId={networkChainId}
          disclaimersActive={true}
          filterState={filterState}
          defaultTags={defaultTags}
          isQuestionCacheReady={isQuestionCacheReady}
          isResponsesCacheReady={isResponsesCacheReady}
          questionScanProgress={questionScanProgress as PolisReportProps['questionScanProgress']}
          questionResponsesNonce={questionResponsesNonce as PolisReportProps['questionResponsesNonce']}
          slug={activeSlug}
        />
      </div>
    );
  }

  if (viewKey === 'breakdown') {
    return (
      <Suspense fallback={<LazyFallback label="Loading Breakdown..." minHeight="30vh" />}>
        <DemoAnalysisWorkspace sessionSlug={activeSlug} />
      </Suspense>
    );
  }

  if (viewKey === 'atlas') {
    return (
      <Suspense fallback={<LazyFallback label="Loading Atlas..." minHeight="30vh" />}>
        <div className={styles.demoResultsAtlasSurface}>
          <DebateMapForSurveyResults
            activeSessionSlug={activeSlug}
            demoMode={true}
            embedded={true}
            requestedModalNodeId={atlasNodeId}
            onModalClose={atlasNodeId ? onAtlasModalClose : null}
          />
        </div>
      </Suspense>
    );
  }

  if (viewKey === 'riskMatrix') {
    return (
      <Suspense fallback={<LazyFallback label="Loading Risk Matrix..." minHeight="30vh" />}>
        <div className={styles.demoResultsRiskMatrixSurface}>
          <RiskMatrix embedded={true} onOpenAtlasNode={onAtlasNodeOpen} />
        </div>
      </Suspense>
    );
  }

  return null;
};

export default SurveyResultsDemoSurface;
