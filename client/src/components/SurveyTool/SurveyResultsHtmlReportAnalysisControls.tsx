import React from 'react';
import {
  Alert,
  Button,
} from 'reactstrap';

import type {
  SurveyResultsHtmlReportAnalysisPayload,
} from './surveyResultsHtmlReportModalDescriptor';

export type SurveyResultsHtmlReportAnalysisControlsProps = {
  analysisPayload: SurveyResultsHtmlReportAnalysisPayload;
  canGenerateAnalysis?: boolean;
  generateAnalysisLabel: string;
  htmlReportAnalysisError?: React.ReactNode;
  onGenerateAnalysis: () => void;
  styleMap: Record<string, string>;
};

const getAnalysisCount = (
  analysisPayload: SurveyResultsHtmlReportAnalysisPayload,
  key: 'participants' | 'questions' | 'responses'
): number => {
  const value = analysisPayload.eligibility?.counts?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
};

const getAnalysisReasons = (
  analysisPayload: SurveyResultsHtmlReportAnalysisPayload
): string[] => (
  Array.isArray(analysisPayload.eligibility?.reasons)
    ? analysisPayload.eligibility.reasons
    : []
);

const SurveyResultsHtmlReportAnalysisControls = ({
  analysisPayload,
  canGenerateAnalysis = false,
  generateAnalysisLabel,
  htmlReportAnalysisError = '',
  onGenerateAnalysis,
  styleMap,
}: SurveyResultsHtmlReportAnalysisControlsProps): React.ReactElement => {
  const responseCount = getAnalysisCount(analysisPayload, 'responses');
  const participantCount = getAnalysisCount(analysisPayload, 'participants');
  const questionCount = getAnalysisCount(analysisPayload, 'questions');
  const reasons = getAnalysisReasons(analysisPayload);

  return (
    <div className={styleMap.htmlReportOptionGroup}>
      <h6>Analysis views</h6>
      <p>
        {responseCount} responses,
        {' '}{participantCount} participants,
        {' '}{questionCount} questions.
        {' '}AI mode uses synthetic participant IDs.
      </p>
      {reasons.length > 0 && (
        <Alert color="info" fade={false} className={styleMap.htmlReportInfo}>
          {reasons.join(' ')}
        </Alert>
      )}
      {htmlReportAnalysisError && (
        <Alert color="warning" fade={false} className={styleMap.htmlReportWarning}>
          {htmlReportAnalysisError}
        </Alert>
      )}
      <Button
        type="button"
        color="secondary"
        onClick={onGenerateAnalysis}
        disabled={!canGenerateAnalysis}
        className={styleMap.htmlReportGenerateButton}
        data-testid="ce-surveyresults-html-report-generate-analysis"
      >
        {generateAnalysisLabel}
      </Button>
    </div>
  );
};

export default SurveyResultsHtmlReportAnalysisControls;
