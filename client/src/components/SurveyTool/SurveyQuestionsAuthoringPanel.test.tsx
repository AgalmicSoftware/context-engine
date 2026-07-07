import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyQuestionsAuthoringPanel from './SurveyQuestionsAuthoringPanel';

describe('SurveyQuestionsAuthoringPanel', () => {
  const baseProps = {
    onScrollToTop: jest.fn(),
    onShowJsonAtBottom: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onScrollToTop.mockClear();
    baseProps.onShowJsonAtBottom.mockClear();
  });

  it('renders editable questions between the top and bottom submit controls', () => {
    render(
      <SurveyQuestionsAuthoringPanel
        {...baseProps}
        renderedEditableQuestions={<div data-testid="editable-question">Question card</div>}
        submitDisplayState={{
          showInlineSubmit: true,
          showTopInlineSubmit: true,
        }}
        submitResponseButton={<button type="button">Submit responses</button>}
      />,
    );

    const submitButtons = screen.getAllByRole('button', { name: 'Submit responses' });
    expect(submitButtons).toHaveLength(2);
    expect(screen.getByTestId('editable-question')).toBeInTheDocument();
  });

  it('renders JSON and back-to-top controls with preserved handlers', () => {
    render(
      <SurveyQuestionsAuthoringPanel
        {...baseProps}
        displayState={{
          showBackToTopControl: true,
          showJsonControl: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));

    expect(baseProps.onShowJsonAtBottom).toHaveBeenCalledTimes(1);
    expect(baseProps.onScrollToTop).toHaveBeenCalledTimes(1);
  });

  it('renders locked-question and submitted-response content only when visible', () => {
    const { rerender } = render(
      <SurveyQuestionsAuthoringPanel
        {...baseProps}
        lockedQuestionsBanner={<div data-testid="locked-banner">Locked prompts</div>}
        submittedResponseView={<div data-testid="submitted-response">Submitted response</div>}
      />,
    );

    expect(screen.queryByTestId('locked-banner')).toBeNull();
    expect(screen.getByTestId('submitted-response')).toBeInTheDocument();

    rerender(
      <SurveyQuestionsAuthoringPanel
        {...baseProps}
        displayState={{
          showLockedQuestionsBanner: true,
        }}
        lockedQuestionsBanner={<div data-testid="locked-banner">Locked prompts</div>}
        submittedResponseView={null}
      />,
    );

    expect(screen.getByTestId('locked-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('submitted-response')).toBeNull();
  });
});
