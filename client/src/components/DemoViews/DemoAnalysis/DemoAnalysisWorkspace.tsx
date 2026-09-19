import React, { useEffect, useMemo, useState } from 'react';
import demoAnalysisData from '../../../variables/demo/demo_analysis_data.json';
import historicalFigureDemographics from '../../../variables/demo/historical_figure_demographics.js';
import buildDemoAnalysisData from '../../../utilities/demo/demoAnalysisAdapter.js';
import type { DemoAnalysisMetadataByXid, DemoAnalysisSource } from '../../../utilities/demo/demoAnalysisAdapter';
import {
  buildComparisonGroup,
  findMostDivergentPairs,
  parseSegmentKey,
} from '../../../utilities/demo/demoAnalysisMath.js';
import ComparisonReport from './ComparisonReport';
import ComparisonSuggestions from './ComparisonSuggestions';
import DemographicSelector from './DemographicSelector';
import QuestionBreakdownChart from './QuestionBreakdownChart';
import WorldResultsMap from './WorldResultsMap';
import SingleQuestionResponse from '../../SurveyTool/SingleQuestionResponse';
import { buildTagHref } from '../../SurveyTool/QuestionTagDropdown';
import styles from './DemoAnalysisWorkspace.module.scss';

export type DemoAnalysisWorkspaceQuestion = {
  id: string;
  text: string;
  options: string[];
  category?: string;
  keyTension?: string;
  sourcePromptType?: string;
};

export type DemoAnalysisWorkspaceFlatResponse = {
  questionId: string;
  responseText: string;
  segmentKey: string;
  count?: number;
  participantCount?: number;
  totalVotes?: number;
  rate?: number;
};

export type DemoAnalysisWorkspaceDemographicOption = {
  value: string;
  count?: number;
};

export type DemoAnalysisWorkspaceDemographicsByCategory = Record<string, DemoAnalysisWorkspaceDemographicOption[]>;

export type DemoAnalysisWorkspaceSegmentCounts = Record<string, Record<string, number>>;

export type DemoAnalysisWorkspaceQuestionTag = {
  tagID: string;
  tagName: string;
};

type ComparisonGroup = {
  segmentKey: string;
  name: string;
};

export type DemoAnalysisWorkspaceQuestionTagsById = Record<string, DemoAnalysisWorkspaceQuestionTag[]>;

type Suggestion = {
  pair: string[];
  questionId: string;
  questionText: string;
};

export type DemoAnalysisWorkspaceData = {
  questions: DemoAnalysisWorkspaceQuestion[];
  flatResponses: DemoAnalysisWorkspaceFlatResponse[];
  demographics: DemoAnalysisWorkspaceDemographicsByCategory;
  segmentCounts: DemoAnalysisWorkspaceSegmentCounts;
  questionTagsData: DemoAnalysisWorkspaceQuestionTagsById;
};

type DemoAnalysisWorkspaceProps = {
  analysisData?: DemoAnalysisWorkspaceData | null;
  demoData?: unknown;
  emptyReason?: string;
  metadataByXid?: unknown;
  sessionSlug?: string;
};

const EMPTY_ANALYSIS_DATA: DemoAnalysisWorkspaceData = Object.freeze({
  questions: [],
  flatResponses: [],
  demographics: {},
  segmentCounts: {},
  questionTagsData: {},
});

const getDemoAnalysisData = (demoData?: unknown, metadataByXid?: unknown): DemoAnalysisWorkspaceData =>
  buildDemoAnalysisData(
    demoData as DemoAnalysisSource | undefined,
    metadataByXid as DemoAnalysisMetadataByXid | undefined,
  );
const getComparisonGroup = buildComparisonGroup as (segmentKey: string) => ComparisonGroup;
const getDivergentPairs = findMostDivergentPairs as (input: Record<string, unknown>) => Suggestion[];
const getParsedSegment = parseSegmentKey as (segmentKey: string) => { category: string; value: string };

const buildSuggestionSelectionKey = (questionId = '', segmentKeys: string[] = []) =>
  `${String(questionId || '').trim()}::${[...(Array.isArray(segmentKeys) ? segmentKeys : [])].sort().join('::')}`;

const DemoAnalysisWorkspace = ({
  analysisData: explicitAnalysisData,
  demoData = demoAnalysisData,
  emptyReason = '',
  metadataByXid = historicalFigureDemographics,
  sessionSlug = '',
}: DemoAnalysisWorkspaceProps) => {
  const analysisData = useMemo<DemoAnalysisWorkspaceData>(
    () => {
      if (explicitAnalysisData === null) return EMPTY_ANALYSIS_DATA;
      if (explicitAnalysisData !== undefined) return explicitAnalysisData;
      return getDemoAnalysisData(demoData, metadataByXid);
    },
    [demoData, explicitAnalysisData, metadataByXid],
  );

  const questionMap = useMemo(
    () => new Map(analysisData.questions.map((question) => [question.id, question])),
    [analysisData.questions],
  );

  const [selectedSegmentKeys, setSelectedSegmentKeys] = useState<string[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [selectedReportTagIDs, setSelectedReportTagIDs] = useState<string[]>([]);

  useEffect(() => {
    if (selectedQuestionId && !questionMap.has(selectedQuestionId)) {
      setSelectedQuestionId('');
    }
  }, [questionMap, selectedQuestionId]);

  const comparisonGroups = useMemo(
    () => selectedSegmentKeys.map((segmentKey) => getComparisonGroup(segmentKey)),
    [selectedSegmentKeys],
  );

  const selectedQuestion = questionMap.get(selectedQuestionId) || null;
  const selectedQuestionTags = selectedQuestionId ? analysisData.questionTagsData[selectedQuestionId] || [] : [];
  const activeSuggestionKey = useMemo(() => {
    if (!selectedQuestionId || selectedSegmentKeys.length < 2) return '';
    return buildSuggestionSelectionKey(selectedQuestionId, selectedSegmentKeys);
  }, [selectedQuestionId, selectedSegmentKeys]);

  const suggestions = useMemo(() => {
    const related = getDivergentPairs({
      demographics: analysisData.demographics,
      flatResponses: analysisData.flatResponses,
      segmentCounts: analysisData.segmentCounts,
      questions: analysisData.questions,
      topN: 6,
      allowedSegmentKeys: selectedSegmentKeys,
    });
    if (related.length > 0 || selectedSegmentKeys.length > 0) {
      return related;
    }
    return getDivergentPairs({
      demographics: analysisData.demographics,
      flatResponses: analysisData.flatResponses,
      segmentCounts: analysisData.segmentCounts,
      questions: analysisData.questions,
      topN: 6,
    });
  }, [
    analysisData.demographics,
    analysisData.flatResponses,
    analysisData.questions,
    analysisData.segmentCounts,
    selectedSegmentKeys,
  ]);

  const focusedCountries = useMemo(() => {
    const countries = selectedSegmentKeys
      .map((segmentKey) => getParsedSegment(segmentKey))
      .filter(({ category, value }) => category === 'Country' && value)
      .map(({ value }) => value);
    return Array.from(new Set(countries)).sort();
  }, [selectedSegmentKeys]);

  if (emptyReason) {
    return (
      <div className={styles.workspace} data-testid="demo-analysis-workspace">
        <section className={`${styles.panel} ${styles.chartPanel}`} data-testid="generated-breakdown-unavailable">
          <h3 className={styles.panelTitle}>Breakdown unavailable</h3>
          <p className={styles.emptyHint}>{emptyReason}</p>
        </section>
      </div>
    );
  }

  const toggleSegment = (segmentKey: string) => {
    setSelectedSegmentKeys((previous) =>
      previous.includes(segmentKey) ? previous.filter((value) => value !== segmentKey) : [...previous, segmentKey],
    );
  };

  const handleCategoryChange = (category: string, nextSegmentKeysForCategory: string[]) => {
    setSelectedSegmentKeys((previous) => {
      const categoryPrefix = `${category}:`;
      const preservedKeys = previous.filter((segmentKey) => !segmentKey.startsWith(categoryPrefix));
      return [...preservedKeys, ...nextSegmentKeysForCategory];
    });
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setSelectedSegmentKeys(suggestion.pair.slice());
    setSelectedQuestionId(suggestion.questionId);
  };

  const handleAutoSelectCorrelation = (sourceSegmentKey: string | null = null) => {
    const candidateSuggestions = sourceSegmentKey
      ? getDivergentPairs({
          demographics: analysisData.demographics,
          flatResponses: analysisData.flatResponses,
          segmentCounts: analysisData.segmentCounts,
          questions: analysisData.questions,
          topN: 1,
          allowedSegmentKeys: [sourceSegmentKey],
        })
      : suggestions;

    if (candidateSuggestions.length === 0) return;
    handleSuggestionClick(candidateSuggestions[0]);
  };

  return (
    <div className={styles.workspace} data-testid="demo-analysis-workspace">
      <DemographicSelector
        demographics={analysisData.demographics}
        selectedSegmentKeys={selectedSegmentKeys}
        onToggleSegment={toggleSegment}
        onCategoryChange={handleCategoryChange}
        onClearAll={() => setSelectedSegmentKeys([])}
        onAutoSelectCorrelation={() => handleAutoSelectCorrelation()}
        onSuggestFromSegment={handleAutoSelectCorrelation}
      />

      {selectedQuestion ? (
        <section className={styles.selectedQuestionBanner} data-testid="demo-analysis-question-banner">
          <div className={styles.selectedQuestionFrame}>
            <SingleQuestionResponse
              mode="fullscreen"
              questionOnly={true}
              question={{
                prompt: selectedQuestion.text,
                type: 'binary',
              }}
              response={null}
              containerClassName={styles.selectedQuestionCard}
              bodyClassName={styles.selectedQuestionCardBody}
              questionPromptClassName={styles.selectedQuestionCardPrompt}
              questionPromptTestId="demo-analysis-selected-question"
            />
            {selectedQuestionTags.length > 0 || selectedQuestion.keyTension ? (
              <div className={styles.selectedQuestionGrounding}>
                {selectedQuestion.keyTension ? (
                  <p className={styles.selectedQuestionTension} data-testid="demo-analysis-selected-question-tension">
                    <strong>Key tension:</strong> {selectedQuestion.keyTension}
                  </p>
                ) : null}
                {selectedQuestionTags.length > 0 ? (
                  <div
                    className={styles.selectedQuestionGroundingPills}
                    data-testid="demo-analysis-selected-question-tags"
                  >
                    {selectedQuestionTags.map((tag) => (
                      <a
                        key={tag.tagID}
                        className={styles.selectedQuestionTagButton}
                        href={buildTagHref(tag.tagName, '', sessionSlug)}
                        title={`Open ${tag.tagName} tag page for this session`}
                      >
                        {tag.tagName}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className={styles.primaryGrid}>
        <ComparisonSuggestions
          suggestions={suggestions}
          onSuggestionClick={handleSuggestionClick}
          activeSuggestionKey={activeSuggestionKey}
        />
        <WorldResultsMap
          question={selectedQuestion}
          responses={analysisData.flatResponses}
          focusedCountries={focusedCountries}
        />
      </div>

      <QuestionBreakdownChart
        question={selectedQuestion}
        flatResponses={analysisData.flatResponses}
        comparisonGroups={comparisonGroups}
      />

      <ComparisonReport
        flatResponses={analysisData.flatResponses}
        questions={analysisData.questions}
        comparisonGroups={comparisonGroups}
        questionTagsData={analysisData.questionTagsData}
        selectedTagIDs={selectedReportTagIDs}
        onSelectedTagIDsChange={setSelectedReportTagIDs}
      />
    </div>
  );
};

export default DemoAnalysisWorkspace;
