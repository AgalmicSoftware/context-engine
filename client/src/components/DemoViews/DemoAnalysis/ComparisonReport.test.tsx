import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ComparisonReport from './ComparisonReport';

const originalResizeObserver = global.ResizeObserver;

class ResizeObserverMock {
  observe() {}

  disconnect() {}

  unobserve() {}
}

const comparisonGroups = [
  { segmentKey: 'Era:Modern', name: 'Era: Modern' },
  { segmentKey: 'Era:Industrial', name: 'Era: Industrial' },
];

const questions = [{ id: 'q1', text: 'Should advanced AI systems be openly audited?' }];

const flatResponses = [
  { questionId: 'q1', responseText: 'Agree', segmentKey: 'Era:Modern', rate: 0.9 },
  { questionId: 'q1', responseText: 'Agree', segmentKey: 'Era:Industrial', rate: 0.1 },
  { questionId: 'q1', responseText: 'Unsure', segmentKey: 'Era:Modern', rate: 0.05 },
  { questionId: 'q1', responseText: 'Unsure', segmentKey: 'Era:Industrial', rate: 0.3 },
  { questionId: 'q1', responseText: 'Disagree', segmentKey: 'Era:Modern', rate: 0.05 },
  { questionId: 'q1', responseText: 'Disagree', segmentKey: 'Era:Industrial', rate: 0.6 },
];

describe('ComparisonReport', () => {
  beforeAll(() => {
    global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
  });

  afterAll(() => {
    global.ResizeObserver = originalResizeObserver;
  });

  it('renders report cards with candlestick distributions instead of response labels', () => {
    render(
      <ComparisonReport flatResponses={flatResponses} questions={questions} comparisonGroups={comparisonGroups} />,
    );

    expect(screen.queryByText(/Consensus:\s*Minimum agreement of/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Response:/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Response: "Agree"')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-demo-analysis-response-pill-card-agree')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-demo-analysis-response-pill-card-unsure')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-demo-analysis-response-pill-card-disagree')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/ce-demo-analysis-card-candlestick-/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Agree 90%/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unsure 30%/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Disagree 60%/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /Should advanced AI systems be openly audited/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the beeswarm tooltip response as a styled pill', () => {
    const { container } = render(
      <ComparisonReport flatResponses={flatResponses} questions={questions} comparisonGroups={comparisonGroups} />,
    );

    const firstPoint = container.querySelector('circle');
    expect(firstPoint).not.toBeNull();

    fireEvent.mouseEnter(firstPoint as Element);

    const tooltip = screen.getByTestId('demo-analysis-beeswarm-tooltip');
    expect(tooltip.querySelector('[data-testid^="ce-demo-analysis-response-pill-tooltip-"]')).not.toBeNull();
    expect(tooltip).not.toHaveTextContent('Response: "Agree"');
  });

  it('supports externally controlled tag filters', () => {
    const onSelectedTagIDsChange = jest.fn();
    render(
      <ComparisonReport
        flatResponses={flatResponses}
        questions={questions}
        comparisonGroups={comparisonGroups}
        questionTagsData={{
          q1: [{ tagID: 'governance', tagName: 'Governance' }],
        }}
        selectedTagIDs={['governance']}
        onSelectedTagIDsChange={onSelectedTagIDsChange}
      />,
    );

    const governanceCheckbox = screen.getByLabelText(/Governance \(3\)/i);
    expect(governanceCheckbox).toBeChecked();

    fireEvent.click(governanceCheckbox);

    expect(onSelectedTagIDsChange).toHaveBeenCalledWith([]);
  });

  it('collapses the full comparison report body while keeping the report summary visible', () => {
    render(
      <ComparisonReport flatResponses={flatResponses} questions={questions} comparisonGroups={comparisonGroups} />,
    );

    const toggle = screen.getByTestId('demo-analysis-comparison-report-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('demo-analysis-report-summary')).toHaveTextContent('Era: Modern');
    expect(screen.getByTestId('demo-analysis-comparison-report-body')).toBeInTheDocument();
    expect(screen.getByText('Similarity & Difference Spectrum')).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('demo-analysis-report-summary')).toHaveTextContent('Era: Industrial');
    expect(screen.queryByTestId('demo-analysis-comparison-report-body')).not.toBeInTheDocument();
    expect(screen.queryByText('Similarity & Difference Spectrum')).not.toBeInTheDocument();
  });
});
