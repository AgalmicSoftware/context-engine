import React from 'react';
import { render, screen } from '@testing-library/react';

import {
  SurveyResultsFreeformAggregatorSummary,
  SurveyResultsMultichoiceAggregatorSummary,
} from './SurveyResultsAggregatorSummaries';

describe('SurveyResultsAggregatorSummaries', () => {
  it('renders freeform response totals and additional comments', () => {
    render(
      <SurveyResultsFreeformAggregatorSummary
        summary={{
          totalResponses: 3,
          encryptedCount: 1,
          blankCount: 1,
          displayedResponses: [
            {
              responder: '0xabc',
              value: 'Visible answer',
              additional: 'Visible comment',
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByText('3 total responses. 1 encrypted responses not shown. 1 blank not shown.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Visible answer')).toBeInTheDocument();
    expect(screen.getByText('Visible comment')).toBeInTheDocument();
  });

  it('renders multichoice option counts and percentages', () => {
    render(
      <SurveyResultsMultichoiceAggregatorSummary
        summary={{
          totalResponders: 4,
          options: [
            { key: 'yes', label: 'Yes', count: 3 },
            { key: 'no', label: 'No', count: 1 },
          ],
        }}
      />,
    );

    expect(screen.getByText('4 total responders to this multichoice question.')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('3 (75.00%)')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('1 (25.00%)')).toBeInTheDocument();
  });
});
