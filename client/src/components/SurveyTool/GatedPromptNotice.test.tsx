import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GatedPromptNotice, {
  buildGatedPromptTooltipIconClassName,
  resolveGatedPromptLockIconStyle,
} from './GatedPromptNotice';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

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

  it('renders an explicit decrypt action when provided', () => {
    const onAction = jest.fn();
    render(
      <GatedPromptNotice
        questionId="Q1"
        tooltipId="ce-gated-tip-q1"
        tooltipText="Required SBT gate: Governance"
        onAction={onAction}
      />
    );

    const button = screen.getByTestId(E2E_TESTIDS.SURVEY_DECRYPT_PROMPT_NOTICE);
    expect(button).toHaveTextContent('Decrypt Prompt');

    fireEvent.click(button);

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('builds gated prompt notice display helpers', () => {
    expect(resolveGatedPromptLockIconStyle()).toEqual({ marginRight: 8 });
    expect(buildGatedPromptTooltipIconClassName({
      baseClassName: 'tooltip',
      tooltipClassName: 'gated',
    })).toBe('tooltip gated');
  });
});
