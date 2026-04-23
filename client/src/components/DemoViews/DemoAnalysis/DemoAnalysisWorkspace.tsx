import React, { useEffect, useMemo, useState } from 'react';
import demoAnalysisData from '../../../variables/demo/demo_analysis_data.json';
import historicalFigureDemographics from '../../../variables/demo/historical_figure_demographics.js';
import buildDemoAnalysisData from '../../../utilities/demo/demoAnalysisAdapter.js';
import {
  buildComparisonGroup,
  buildIndicatorHeatmapData,
  findMostDivergentPairs,
  parseSegmentKey,
} from '../../../utilities/demo/demoAnalysisMath.js';
import ComparisonReport from './ComparisonReport.jsx';
import ComparisonSuggestions from './ComparisonSuggestions.jsx';
import DemographicSelector from './DemographicSelector.jsx';
import IndicatorHeatmap from './IndicatorHeatmap.jsx';
import QuestionBreakdownChart from './QuestionBreakdownChart.jsx';
import QuestionDrilldownModal from './QuestionDrilldownModal.jsx';
import WorldResultsMap from './WorldResultsMap.jsx';
import styles from './DemoAnalysisWorkspace.module.scss';

type Question = {
  id: string;
  text: string;
  options: string[];
};

type FlatResponse = {
  questionId: string;
  responseText: string;
  segmentKey: string;
  count?: number;
  participantCount?: number;
  totalVotes?: number;
  rate?: number;
};

type DemographicOption = {
  value: string;
  count?: number;
};

type DemographicsByCategory = Record<string, DemographicOption[]>;

type SegmentCounts = Record<string, Record<string, number>>;

type QuestionTag = {
  tagID: string;
  tagName: string;
};

type ComparisonGroup = {
  segmentKey: string;
  name: string;
};

type QuestionTagsById = Record<string, QuestionTag[]>;

type Suggestion = {
  pair: string[];
  questionId: string;
  questionText: string;
};

type AnalysisData = {
  questions: Question[];
  flatResponses: FlatResponse[];
  demographics: DemographicsByCategory;
  segmentCounts: SegmentCounts;
  questionTagsData: QuestionTagsById;
};

type DemoAnalysisWorkspaceProps = {
  demoData?: unknown;
  metadataByXid?: unknown;
};

const getDemoAnalysisData = buildDemoAnalysisData as unknown as (demoData?: unknown, metadataByXid?: unknown) => AnalysisData;
const getComparisonGroup = buildComparisonGroup as (segmentKey: string) => ComparisonGroup;
const getDivergentPairs = findMostDivergentPairs as (input: Record<string, unknown>) => Suggestion[];
const getParsedSegment = parseSegmentKey as (segmentKey: string) => { category: string; value: string };

const buildSuggestionSelectionKey = (questionId = '', segmentKeys: string[] = []) => (
  `${String(questionId || '').trim()}::${[...(Array.isArray(segmentKeys) ? segmentKeys : [])].sort().join('::')}`
);

const DemoAnalysisWorkspace = ({
  demoData = demoAnalysisData,
  metadataByXid = historicalFigureDemographics,
}: DemoAnalysisWorkspaceProps) => {
  const analysisData = useMemo<AnalysisData>(
    () => getDemoAnalysisData(demoData, metadataByXid),
    [demoData, metadataByXid]
  );

  const questionMap = useMemo(
    () => new Map(analysisData.questions.map((question) => [question.id, question])),
    [analysisData.questions]
  );

  const [selectedSegmentKeys, setSelectedSegmentKeys] = useState<string[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [drilldownQuestionId, setDrilldownQuestionId] = useState('');

  useEffect(() => {
    if (selectedQuestionId && !questionMap.has(selectedQuestionId)) {
      setSelectedQuestionId('');
    }
  }, [questionMap, selectedQuestionId]);

  useEffect(() => {
    if (drilldownQuestionId && !questionMap.has(drilldownQuestionId)) {
      setDrilldownQuestionId('');
    }
  }, [drilldownQuestionId, questionMap]);

  const comparisonGroups = useMemo(
    () => selectedSegmentKeys.map((segmentKey) => getComparisonGroup(segmentKey)),
    [selectedSegmentKeys]
  );

  const selectedQuestion = questionMap.get(selectedQuestionId) || null;
  const drilldownQuestion = questionMap.get(drilldownQuestionId) || null;

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

  const heatmapData = useMemo(
    () => buildIndicatorHeatmapData({
      questions: analysisData.questions,
      flatResponses: analysisData.flatResponses,
      selectedSegmentKey: comparisonGroups[0]?.segmentKey || 'All',
    }),
    [analysisData.flatResponses, analysisData.questions, comparisonGroups]
  );

  const focusedCountries = useMemo(() => {
    const countries = selectedSegmentKeys
      .map((segmentKey) => getParsedSegment(segmentKey))
      .filter(({ category, value }) => category === 'Country' && value)
      .map(({ value }) => value);
    return Array.from(new Set(countries)).sort();
  }, [selectedSegmentKeys]);

  const toggleSegment = (segmentKey: string) => {
    setSelectedSegmentKeys((previous) => (
      previous.includes(segmentKey)
        ? previous.filter((value) => value !== segmentKey)
        : [...previous, segmentKey]
    ));
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

  const openDrilldown = (questionId: string | number) => {
    const normalizedQuestionId = String(questionId || '');
    setSelectedQuestionId(normalizedQuestionId);
    setDrilldownQuestionId(normalizedQuestionId);
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

      <div className={styles.primaryGrid}>
        <ComparisonSuggestions suggestions={suggestions} onSuggestionClick={handleSuggestionClick} />
        <WorldResultsMap
          question={selectedQuestion}
          responses={analysisData.flatResponses}
          focusedCountries={focusedCountries}
        />
      </div>

      <div className={styles.secondaryGrid}>
        <QuestionBreakdownChart
          question={selectedQuestion}
          flatResponses={analysisData.flatResponses}
          comparisonGroups={comparisonGroups}
          onOpenDrilldown={openDrilldown}
        />
        <IndicatorHeatmap data={heatmapData} />
      </div>

      <ComparisonReport
        flatResponses={analysisData.flatResponses}
        questions={analysisData.questions}
        comparisonGroups={comparisonGroups}
        questionTagsData={analysisData.questionTagsData}
        onInspectQuestion={openDrilldown}
      />

      <QuestionDrilldownModal
        isOpen={Boolean(drilldownQuestion)}
        question={drilldownQuestion}
        comparisonGroups={comparisonGroups}
        flatResponses={analysisData.flatResponses}
        questionTags={analysisData.questionTagsData[drilldownQuestionId] || []}
        onClose={() => setDrilldownQuestionId('')}
      />
    </div>
  );
};

export default DemoAnalysisWorkspace;
