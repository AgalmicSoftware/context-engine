import React from 'react';
import { render, screen } from '@testing-library/react';
import GatedPromptNotice from './GatedPromptNotice';

jest.mock('../Shared/CETooltip', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="mock-ce-tooltip">{children}</div>,
}));

describe('GatedPromptNotice', () => {
  it('renders the gated notice and tooltip text for the current question', () => {
    render(
      <GatedPromptNotice
        questionId="Q1"
        tooltipId="ce-gated-tip-q1"
        tooltipText="Required SBT gate: Governance"
      />
    );

    expect(screen.getByTestId('ce-survey-gated-prompt-notice')).toHaveAttribute('data-ce-question-id', 'q1');
    expect(screen.getByTestId('ce-gated-prompt-tooltip-Q1')).toBeInTheDocument();
    expect(screen.getByTestId('mock-ce-tooltip')).toHaveTextContent('Required SBT gate: Governance');
    expect(screen.getByText(/Decrypt the prompt to answer/i)).toBeInTheDocument();
  });
});
