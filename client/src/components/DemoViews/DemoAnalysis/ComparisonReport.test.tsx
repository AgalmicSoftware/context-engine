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

const questions = [
  { id: 'q1', text: 'Should advanced AI systems be openly audited?' },
];

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

  it('removes the redundant consensus line and renders styled binary response pills in report cards', () => {
    render(
      <ComparisonReport
        flatResponses={flatResponses}
        questions={questions}
        comparisonGroups={comparisonGroups}
        onInspectQuestion={jest.fn()}
      />
    );

    expect(screen.queryByText(/Consensus:\s*Minimum agreement of/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Response: "Agree"')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('ce-demo-analysis-response-pill-card-agree').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('ce-demo-analysis-response-pill-card-unsure').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('ce-demo-analysis-response-pill-card-disagree').length).toBeGreaterThan(0);
  });

  it('renders the beeswarm tooltip response as a styled pill', () => {
    const { container } = render(
      <ComparisonReport
        flatResponses={flatResponses}
        questions={questions}
        comparisonGroups={comparisonGroups}
        onInspectQuestion={jest.fn()}
      />
    );

    const firstPoint = container.querySelector('circle');
    expect(firstPoint).not.toBeNull();

    fireEvent.mouseEnter(firstPoint as Element);

    const tooltip = screen.getByTestId('demo-analysis-beeswarm-tooltip');
    expect(tooltip.querySelector('[data-testid^="ce-demo-analysis-response-pill-tooltip-"]')).not.toBeNull();
    expect(tooltip).not.toHaveTextContent('Response: "Agree"');
  });
});
