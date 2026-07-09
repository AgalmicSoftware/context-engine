import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsHtmlReportAnalysisControls from './SurveyResultsHtmlReportAnalysisControls';

const styleMap = {
  htmlReportGenerateButton: 'htmlReportGenerateButton',
  htmlReportInfo: 'htmlReportInfo',
  htmlReportOptionGroup: 'htmlReportOptionGroup',
  htmlReportWarning: 'htmlReportWarning',
};

const analysisPayload = {
  eligibility: {
    counts: {
      participants: 2,
      questions: 3,
      responses: 4,
    },
    reasons: ['Need one more question.'],
  },
};

describe('SurveyResultsHtmlReportAnalysisControls', () => {
  it('renders analysis readiness copy and routes enabled generation through the named callback', () => {
    const onGenerateAnalysis = jest.fn();

    render(
      <SurveyResultsHtmlReportAnalysisControls
        analysisPayload={analysisPayload}
        canGenerateAnalysis
        generateAnalysisLabel="Generate Analysis Views"
        htmlReportAnalysisError="Previous attempt failed."
        onGenerateAnalysis={onGenerateAnalysis}
        styleMap={styleMap}
      />,
    );

    expect(screen.getByText(/4\s+responses,\s+2\s+participants,\s+3\s+questions\./)).toBeInTheDocument();
    expect(screen.getByText('Need one more question.')).toBeInTheDocument();
    expect(screen.getByText('Previous attempt failed.')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-surveyresults-html-report-generate-analysis'));

    expect(onGenerateAnalysis).toHaveBeenCalledTimes(1);
  });

  it('keeps generation inert when the display plan marks analysis unavailable', () => {
    const onGenerateAnalysis = jest.fn();

    render(
      <SurveyResultsHtmlReportAnalysisControls
        analysisPayload={analysisPayload}
        canGenerateAnalysis={false}
        generateAnalysisLabel="Generating Analysis Views..."
        onGenerateAnalysis={onGenerateAnalysis}
        styleMap={styleMap}
      />,
    );

    const generateButton = screen.getByTestId('ce-surveyresults-html-report-generate-analysis');
    expect(generateButton).toBeDisabled();
    expect(generateButton).toHaveTextContent('Generating Analysis Views...');

    fireEvent.click(generateButton);

    expect(onGenerateAnalysis).not.toHaveBeenCalled();
  });

  it('renders partial analysis payloads with zeroed counts and no reasons alert', () => {
    render(
      <SurveyResultsHtmlReportAnalysisControls
        analysisPayload={{}}
        generateAnalysisLabel="Generate Analysis Views"
        onGenerateAnalysis={jest.fn()}
        styleMap={styleMap}
      />,
    );

    expect(screen.getByText(/0\s+responses,\s+0\s+participants,\s+0\s+questions\./)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
