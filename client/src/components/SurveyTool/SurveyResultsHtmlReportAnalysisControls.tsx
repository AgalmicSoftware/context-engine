import React from 'react';
import {
  Alert,
  Button,
} from 'reactstrap';

type SurveyResultsRecord = Record<string, any>;

export type SurveyResultsHtmlReportAnalysisControlsProps = {
  analysisPayload: SurveyResultsRecord;
  canGenerateAnalysis?: boolean;
  generateAnalysisLabel: string;
  htmlReportAnalysisError?: React.ReactNode;
  onGenerateAnalysis: () => void;
  styleMap: Record<string, string>;
};

const SurveyResultsHtmlReportAnalysisControls = ({
  analysisPayload,
  canGenerateAnalysis = false,
  generateAnalysisLabel,
  htmlReportAnalysisError = '',
  onGenerateAnalysis,
  styleMap,
}: SurveyResultsHtmlReportAnalysisControlsProps): React.ReactElement => (
  <div className={styleMap.htmlReportOptionGroup}>
    <h6>Analysis views</h6>
    <p>
      {analysisPayload?.eligibility?.counts?.responses} responses,
      {' '}{analysisPayload?.eligibility?.counts?.participants} participants,
      {' '}{analysisPayload?.eligibility?.counts?.questions} questions.
      {' '}AI mode uses synthetic participant IDs.
    </p>
    {analysisPayload?.eligibility?.reasons?.length > 0 && (
      <Alert color="info" fade={false} className={styleMap.htmlReportInfo}>
        {analysisPayload.eligibility.reasons.join(' ')}
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

export default SurveyResultsHtmlReportAnalysisControls;
