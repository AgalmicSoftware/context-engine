import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyResultsQuestionSummariesList from './SurveyResultsQuestionSummariesList';

const styleMap = {
  questionSummaries: 'questionSummaries',
};

describe('SurveyResultsQuestionSummariesList', () => {
  it('renders question summaries through the supplied renderer', () => {
    const renderQuestionSummary = jest.fn((questionId: string) => (
      <div data-testid={`summary-${questionId}`}>{questionId}</div>
    ));

    render(
      <SurveyResultsQuestionSummariesList
        entries={[
          ['q1', [{ answer: 'yes' }]],
          ['q2', []],
        ]}
        filterLoading={false}
        renderQuestionSummary={renderQuestionSummary}
        styleMap={styleMap}
      />,
    );

    expect(screen.getByTestId('summary-q1')).toHaveTextContent('q1');
    expect(screen.getByTestId('summary-q2')).toHaveTextContent('q2');
    expect(renderQuestionSummary).toHaveBeenCalledWith('q1', [{ answer: 'yes' }]);
    expect(renderQuestionSummary).toHaveBeenCalledWith('q2', []);
  });

  it('renders the empty state only when not filtering', () => {
    const { rerender } = render(
      <SurveyResultsQuestionSummariesList
        entries={[]}
        filterLoading={false}
        renderQuestionSummary={jest.fn()}
        styleMap={styleMap}
      />,
    );

    expect(screen.getByText('No results yet.')).toBeInTheDocument();

    rerender(
      <SurveyResultsQuestionSummariesList
        entries={[]}
        filterLoading={true}
        renderQuestionSummary={jest.fn()}
        styleMap={styleMap}
      />,
    );

    expect(screen.queryByText('No results yet.')).not.toBeInTheDocument();
  });

  it('renders an error state instead of the empty state', () => {
    render(
      <SurveyResultsQuestionSummariesList
        entries={[]}
        errorMessage="Results could not be displayed."
        filterLoading={false}
        renderQuestionSummary={jest.fn()}
        styleMap={styleMap}
      />,
    );

    expect(screen.getByText('Results could not be displayed.')).toBeInTheDocument();
    expect(screen.queryByText('No results yet.')).not.toBeInTheDocument();
  });
});
