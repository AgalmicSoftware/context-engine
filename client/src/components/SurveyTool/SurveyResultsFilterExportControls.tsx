import React from 'react';
import { Button, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faTimes } from '@fortawesome/free-solid-svg-icons';

import SBTFilter from '../SBTs/SBTFilter';
import QuestionFilter from './QuestionFilter';
import type { QuestionFilterHandle } from './QuestionFilter';
import SurveyResultsExportControls from './SurveyResultsExportControls';
import type {
  SurveyResultsCacheFilterInput,
  SurveyResultsCacheFilterState,
} from './surveyResultsCacheControllerSnapshot';

type SurveyResultsQuestionFilterCallback = (
  filteredQuestionsOrCombined: unknown,
  filterState: SurveyResultsCacheFilterState
) => void;
type SurveyResultsSbtFilterCallback = (
  filteredResponses: unknown,
  sbtFilterState?: unknown
) => void;

type SurveyResultsFilterExportControlsCacheProps = Pick<
  SurveyResultsCacheFilterInput,
  | 'activeSessionSlug'
  | 'currentSurveyIdForUrl'
  | 'currentViewModeForUrl'
  | 'filterState'
  | 'isQuestionCacheReady'
  | 'isSBTCacheReady'
  | 'questionResponsesNonce'
  | 'questionsCacheNonce'
  | 'sbtCacheRevision'
  | 'showQuestionFilter'
  | 'storageKeyPrefix'
>;

type SurveyResultsFilterExportControlsProps = SurveyResultsFilterExportControlsCacheProps & {
  aggregateQuestionResponses: unknown;
  defaultTags?: unknown;
  ensureLightSbtUniverse?: unknown;
  exportControlsDisplay: {
    exportAreaOpen?: boolean;
    exportOptions: readonly { label: string; value: string }[];
    exportTypeLabel?: string;
  };
  isFilterActive: boolean;
  network?: unknown;
  onClearFilters: React.MouseEventHandler<HTMLElement>;
  onDownload: () => void;
  onExportHtmlReport: () => void;
  onExportTypeChange: (value: string) => void;
  onFilterActivityChange: (active: unknown) => void;
  onQuestionFilter: SurveyResultsQuestionFilterCallback;
  onQuestionFilterCountUpdate: (count: unknown) => void;
  onSbtFilter: SurveyResultsSbtFilterCallback;
  onSetFilterLoading: (loading: unknown) => void;
  onToggleExportArea: () => void;
  onToggleQuestionFilter: () => void;
  provider?: unknown;
  questionFilterQuestions: unknown;
  questionFilterRef: React.Ref<QuestionFilterHandle>;
  questionResponses: unknown;
  responses: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  styleMap: Record<string, string>;
  surveyViewMode: unknown;
  viewMode: unknown;
};

export const renderSurveyResultsFilterExportControls = ({
  activeSessionSlug,
  aggregateQuestionResponses,
  currentSurveyIdForUrl,
  currentViewModeForUrl,
  defaultTags,
  ensureLightSbtUniverse,
  exportControlsDisplay,
  filterState,
  isFilterActive,
  isQuestionCacheReady,
  isSBTCacheReady,
  network,
  onClearFilters,
  onDownload,
  onExportHtmlReport,
  onExportTypeChange,
  onFilterActivityChange,
  onQuestionFilter,
  onQuestionFilterCountUpdate,
  onSbtFilter,
  onSetFilterLoading,
  onToggleExportArea,
  onToggleQuestionFilter,
  provider,
  questionFilterQuestions,
  questionFilterRef,
  questionResponses,
  questionResponsesNonce,
  questionsCacheNonce,
  responses,
  sbtCacheRevision,
  sessionConfig,
  sessionSlug,
  showQuestionFilter,
  storageKeyPrefix,
  styleMap,
  surveyViewMode,
  viewMode,
}: SurveyResultsFilterExportControlsProps): React.ReactElement => (
  <>
    <div className={styleMap.exportAndFilterContainer}>
      <div className={styleMap.filterBox}>
        {viewMode === 'survey' && surveyViewMode === 'individuals' && (
          <Label className={styleMap.filterBoxLabel}>
            {/* Filter (Survey Individuals): */}
          </Label>
        )}
        {viewMode === 'survey' && surveyViewMode === 'aggregate' && (
          <Label className={styleMap.filterBoxLabel}>
            {/* Filter (Survey Aggregate): */}
          </Label>
        )}
        {viewMode === 'questions' && (
          <Label className={styleMap.filterBoxLabel}>
            {/* Filter Questions & Responses: */}
          </Label>
        )}

        {viewMode === 'survey' && surveyViewMode === 'aggregate' && (
          <SBTFilter
            items={aggregateQuestionResponses}
            mode="responder"
            provider={provider}
            network={network}
            onFilter={onSbtFilter}
            setFilterLoading={onSetFilterLoading}
            autoExpand={false}
            buttonSurface="light"
            hideLoadingOverlay={true}
            externalSBTFilterState={filterState.sbtFilter}
            isQuestionCacheReady={isQuestionCacheReady}
            isSBTCacheReady={isSBTCacheReady}
            sbtCacheRevision={sbtCacheRevision}
            sessionSlug={sessionSlug ?? activeSessionSlug}
            activeSessionSlug={activeSessionSlug}
            sessionConfig={sessionConfig}
            ensureLightSbtUniverse={ensureLightSbtUniverse}
          />
        )}
        {viewMode === 'survey' && surveyViewMode === 'individuals' && (
          <SBTFilter
            items={responses}
            mode="responder"
            provider={provider}
            network={network}
            onFilter={onSbtFilter}
            setFilterLoading={onSetFilterLoading}
            autoExpand={false}
            buttonSurface="light"
            hideLoadingOverlay={true}
            externalSBTFilterState={filterState.sbtFilter}
            isQuestionCacheReady={isQuestionCacheReady}
            isSBTCacheReady={isSBTCacheReady}
            sbtCacheRevision={sbtCacheRevision}
            sessionSlug={sessionSlug ?? activeSessionSlug}
            activeSessionSlug={activeSessionSlug}
            sessionConfig={sessionConfig}
            ensureLightSbtUniverse={ensureLightSbtUniverse}
          />
        )}
        {viewMode === 'questions' && (
          <>
            <Button className={styleMap.questionFilterButton} onClick={onToggleQuestionFilter}>
              Filter
              <FontAwesomeIcon icon={faFilter} className={styleMap.questionFilterIcon} />
              {isFilterActive && (
                <span className={styleMap.clearFilterIcon} onClick={onClearFilters}>
                  <FontAwesomeIcon icon={faTimes} />
                </span>
              )}
            </Button>

            <QuestionFilter
              ref={questionFilterRef}
              onFilterActivityChange={onFilterActivityChange}
              resultsMode={true}
              filterModalOpen={showQuestionFilter}
              toggleFilterModal={onToggleQuestionFilter}
              questions={questionFilterQuestions}
              questionResponses={questionResponses}
              provider={provider}
              network={network}
              onFilter={onQuestionFilter}
              onCountUpdate={onQuestionFilterCountUpdate}
              filterState={filterState}
              setFilterLoading={onSetFilterLoading}
              creatorAndResponderMode={true}
              currentViewModeForUrl={currentViewModeForUrl}
              currentSurveyIdForUrl={currentSurveyIdForUrl}
              questionResponsesNonce={questionResponsesNonce}
              questionsCacheNonce={questionsCacheNonce}
              isQuestionCacheReady={isQuestionCacheReady}
              isSBTCacheReady={isSBTCacheReady}
              sbtCacheRevision={sbtCacheRevision}
              defaultTags={defaultTags}
              activeSessionSlug={activeSessionSlug}
              sessionSlug={sessionSlug ?? activeSessionSlug}
              sessionConfig={sessionConfig}
              ensureLightSbtUniverse={ensureLightSbtUniverse}
              storageKeyPrefix={storageKeyPrefix}
            />
          </>
        )}
      </div>

      <SurveyResultsExportControls
        exportAreaOpen={exportControlsDisplay.exportAreaOpen}
        exportOptions={exportControlsDisplay.exportOptions}
        exportTypeLabel={exportControlsDisplay.exportTypeLabel}
        onDownload={onDownload}
        onExportHtmlReport={onExportHtmlReport}
        onExportTypeChange={onExportTypeChange}
        onToggleExportArea={onToggleExportArea}
        styleMap={styleMap}
      />
    </div>
  </>
);
