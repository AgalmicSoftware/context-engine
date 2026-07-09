import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyResultsFilterSummary from './SurveyResultsFilterSummary';

const normalizeSummaryText = (text = ''): string =>
  text
    .replace(/\u200e/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('SurveyResultsFilterSummary', () => {
  it('renders total and filtered question/response counts', () => {
    const { container } = render(
      <SurveyResultsFilterSummary
        displayedTotalQuestionsCount={12}
        displayedTotalResponsesCount={34}
        normalizedFilteredQuestionsCount={5}
        normalizedFilteredResponsesCount={8}
        showFilteredCountSpinner={false}
      />,
    );
    const summaryText = container.querySelector('p');
    const normalizedSummaryText = normalizeSummaryText(summaryText?.textContent || '');

    expect(normalizedSummaryText).toContain('Questions: 12 Filtered: 5');
    expect(normalizedSummaryText).toContain('Responses: 34 Filtered: 8');
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(document.querySelectorAll('svg[data-icon="spinner"]')).toHaveLength(0);
  });

  it('keeps filtered counts inert behind spinners while counts hydrate', () => {
    render(
      <SurveyResultsFilterSummary
        displayedTotalQuestionsCount={0}
        displayedTotalResponsesCount={0}
        normalizedFilteredQuestionsCount={null}
        normalizedFilteredResponsesCount={null}
        showFilteredCountSpinner={true}
      />,
    );

    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(document.querySelectorAll('svg[data-icon="spinner"]')).toHaveLength(2);
  });
});
