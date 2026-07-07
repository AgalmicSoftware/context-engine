import React from 'react';
import { render, screen } from '@testing-library/react';
import QuestionBreakdownChart from './QuestionBreakdownChart';

const question = {
  id: 'q1',
  text: 'Should advanced AI systems be openly audited?',
  options: ['Agree', 'Unsure', 'Disagree'],
};

const flatResponses = [
  { questionId: 'q1', responseText: 'Agree', segmentKey: 'All', rate: 0.5, totalVotes: 8, participantCount: 4 },
  { questionId: 'q1', responseText: 'Unsure', segmentKey: 'All', rate: 0.25, totalVotes: 8, participantCount: 4 },
  { questionId: 'q1', responseText: 'Disagree', segmentKey: 'All', rate: 0.25, totalVotes: 8, participantCount: 4 },
  { questionId: 'q1', responseText: 'Agree', segmentKey: 'Era:Modern', rate: 0.75, totalVotes: 4, participantCount: 2 },
  {
    questionId: 'q1',
    responseText: 'Unsure',
    segmentKey: 'Era:Modern',
    rate: 0.25,
    totalVotes: 4,
    participantCount: 2,
  },
  { questionId: 'q1', responseText: 'Disagree', segmentKey: 'Era:Modern', rate: 0, totalVotes: 4, participantCount: 2 },
];

describe('QuestionBreakdownChart', () => {
  it('renders compact Polis-style candlesticks while keeping response counts', () => {
    render(
      <QuestionBreakdownChart
        question={question}
        flatResponses={flatResponses}
        comparisonGroups={[{ segmentKey: 'Era:Modern', name: 'Era: Modern' }]}
      />,
    );

    expect(screen.getByText('8 modeled responses')).toBeInTheDocument();
    expect(screen.getByText('4 modeled responses')).toBeInTheDocument();
    expect(screen.queryByText(/personas\s*·/i)).not.toBeInTheDocument();

    const overallCandlestick = screen.getByTestId('demo-analysis-breakdown-candlestick-All');
    expect(overallCandlestick).toHaveAttribute(
      'aria-label',
      'Overall response distribution: Agree 50%, Unsure 25%, Disagree 25%.',
    );
    expect(screen.getByTestId('demo-analysis-breakdown-segment-All-Agree')).toHaveStyle({ width: '50%' });
    expect(screen.getByTestId('demo-analysis-breakdown-segment-All-Unsure')).toHaveStyle({ width: '25%' });
    expect(screen.getByTestId('demo-analysis-breakdown-segment-All-Disagree')).toHaveStyle({ width: '25%' });
  });

  it('does not expose the temporary drilldown details action', () => {
    render(<QuestionBreakdownChart question={question} flatResponses={flatResponses} comparisonGroups={[]} />);

    expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();
  });

  it('keeps the response count when the first ordered option has no row', () => {
    render(
      <QuestionBreakdownChart
        question={question}
        flatResponses={[
          {
            questionId: 'q1',
            responseText: 'Unsure',
            segmentKey: 'All',
            rate: 0.67,
            totalVotes: 3,
            participantCount: 3,
          },
          {
            questionId: 'q1',
            responseText: 'Disagree',
            segmentKey: 'All',
            rate: 0.33,
            totalVotes: 3,
            participantCount: 3,
          },
        ]}
        comparisonGroups={[]}
      />,
    );

    expect(screen.getByText('3 modeled responses')).toBeInTheDocument();
    expect(screen.getByTestId('demo-analysis-breakdown-segment-All-Agree')).toHaveStyle({ width: '0%' });
  });
});
