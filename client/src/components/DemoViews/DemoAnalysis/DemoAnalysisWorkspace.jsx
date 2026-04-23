import React, { useEffect, useMemo, useState } from 'react';
import demoAnalysisData from '../../../variables/demo/demo_analysis_data.json';
import historicalFigureDemographics from '../../../variables/demo/historical_figure_demographics.js';
import buildDemoAnalysisData from '../../../utilities/demo/demoAnalysisAdapter.js';
import {
  buildComparisonGroup,
  findMostDivergentPairs,
  parseSegmentKey,
} from '../../../utilities/demo/demoAnalysisMath.js';
import ComparisonReport from './ComparisonReport.jsx';
import ComparisonSuggestions from './ComparisonSuggestions';
import DemographicSelector from './DemographicSelector.jsx';
import QuestionBreakdownChart from './QuestionBreakdownChart';
import QuestionDrilldownModal from './QuestionDrilldownModal';
import WorldResultsMap from './WorldResultsMap.jsx';
import styles from './DemoAnalysisWorkspace.module.scss';

const buildSuggestionSelectionKey = (questionId = '', segmentKeys = []) => (
  `${String(questionId || '').trim()}::${[...(Array.isArray(segmentKeys) ? segmentKeys : [])].sort().join('::')}`
);

const DemoAnalysisWorkspace = ({
  demoData = demoAnalysisData,
  metadataByXid = historicalFigureDemographics,
}) => {
  const analysisData = useMemo(
    () => buildDemoAnalysisData(demoData, metadataByXid),
    [demoData, metadataByXid]
  );

  const questionMap = useMemo(
    () => new Map(analysisData.questions.map((question) => [question.id, question])),
    [analysisData.questions]
  );

  const [selectedSegmentKeys, setSelectedSegmentKeys] = useState([]);
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
    () => selectedSegmentKeys.map((segmentKey) => buildComparisonGroup(segmentKey)),
    [selectedSegmentKeys]
  );

  const selectedQuestion = questionMap.get(selectedQuestionId) || null;
  const drilldownQuestion = questionMap.get(drilldownQuestionId) || null;
  const activeSuggestionKey = useMemo(() => {
    if (!selectedQuestionId || selectedSegmentKeys.length < 2) return '';
    return buildSuggestionSelectionKey(selectedQuestionId, selectedSegmentKeys);
  }, [selectedQuestionId, selectedSegmentKeys]);

  const suggestions = useMemo(() => {
    const related = findMostDivergentPairs({
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
    return findMostDivergentPairs({
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
      .map((segmentKey) => parseSegmentKey(segmentKey))
      .filter(({ category, value }) => category === 'Country' && value)
      .map(({ value }) => value);
    return Array.from(new Set(countries)).sort();
  }, [selectedSegmentKeys]);

  const toggleSegment = (segmentKey) => {
    setSelectedSegmentKeys((previous) => (
      previous.includes(segmentKey)
        ? previous.filter((value) => value !== segmentKey)
        : [...previous, segmentKey]
    ));
  };

  const handleCategoryChange = (category, nextSegmentKeysForCategory) => {
    setSelectedSegmentKeys((previous) => {
      const categoryPrefix = `${category}:`;
      const preservedKeys = previous.filter((segmentKey) => !segmentKey.startsWith(categoryPrefix));
      return [...preservedKeys, ...nextSegmentKeysForCategory];
    });
  };

  const handleSuggestionClick = (suggestion) => {
    setSelectedSegmentKeys(suggestion.pair.slice());
    setSelectedQuestionId(suggestion.questionId);
  };

  const handleAutoSelectCorrelation = (sourceSegmentKey = null) => {
    const candidateSuggestions = sourceSegmentKey
      ? findMostDivergentPairs({
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

  const openDrilldown = (questionId) => {
    setSelectedQuestionId(questionId);
    setDrilldownQuestionId(questionId);
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
        <section className={`${styles.panel} ${styles.selectedQuestionBanner}`} data-testid="demo-analysis-question-banner">
          <div className={styles.selectedQuestionBannerHeader}>
            <span className={styles.selectedQuestionBannerLabel}>Current focus question</span>
            <span className={styles.selectedQuestionBannerMeta}>
              The suggestion card, map, and breakdown below are all keyed to this prompt.
            </span>
          </div>
          <p className={styles.selectedQuestionBannerText} data-testid="demo-analysis-selected-question">
            {selectedQuestion.text}
          </p>
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
        onOpenDrilldown={openDrilldown}
      />

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
