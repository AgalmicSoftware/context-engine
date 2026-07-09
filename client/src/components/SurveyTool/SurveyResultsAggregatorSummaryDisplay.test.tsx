import React from 'react';
import { render, screen } from '@testing-library/react';

import {
  buildSurveyResultsFreeformSummaryLabel,
  SurveyResultsAggregatorEmptyState,
  SurveyResultsFreeformSummaryDisplay,
  SurveyResultsMultichoiceDistributionDisplay,
} from './SurveyResultsAggregatorSummaryDisplay';

describe('SurveyResultsAggregatorSummaryDisplay', () => {
  it('builds freeform summary labels without requiring card renderers', () => {
    expect(
      buildSurveyResultsFreeformSummaryLabel({
        blankCount: 2,
        encryptedCount: 1,
        totalResponses: 5,
      }),
    ).toBe('5 total responses. 1 encrypted responses not shown. 2 blank not shown.');
  });

  it('renders freeform answer rows and additional comments', () => {
    render(
      <SurveyResultsFreeformSummaryDisplay
        summary={{
          blankCount: 0,
          encryptedCount: 0,
          totalResponses: 1,
          displayedResponses: [
            {
              additional: 'Follow-up note',
              responder: '0xabc',
              value: 'Visible response',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('1 total responses.')).toBeInTheDocument();
    expect(screen.getByText('Visible response')).toBeInTheDocument();
    expect(screen.getByText('Follow-up note')).toBeInTheDocument();
  });

  it('renders multichoice option distributions from a descriptor', () => {
    render(
      <SurveyResultsMultichoiceDistributionDisplay
        summary={{
          totalResponders: 4,
          options: [
            { count: 3, key: 'yes', label: 'Yes' },
            { count: 1, key: 'no', label: 'No' },
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

  it('renders summary empty-state copy as passive display', () => {
    render(<SurveyResultsAggregatorEmptyState>No display rows.</SurveyResultsAggregatorEmptyState>);

    expect(screen.getByText('No display rows.')).toBeInTheDocument();
  });
});
