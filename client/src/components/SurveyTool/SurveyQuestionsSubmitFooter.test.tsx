import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SurveyQuestionsSubmitFooter from './SurveyQuestionsSubmitFooter';
import { UPLOAD_IN_PROGRESS_MESSAGE } from '../../utilities/storage/storageClient';
import { PARTIAL_UPLOAD_IN_PROGRESS_MESSAGE } from './surveyQuestionsRuntimeMethods';

describe('SurveyQuestionsSubmitFooter', () => {
  const baseProps = {
    onPrimarySubmitClick: jest.fn(),
    onRevertPendingChanges: jest.fn(),
    submitButtonText: 'Submit (2)',
  };

  beforeEach(() => {
    baseProps.onPrimarySubmitClick.mockClear();
    baseProps.onRevertPendingChanges.mockClear();
  });

  it('renders the submit button contract and forwards submit clicks', () => {
    render(<SurveyQuestionsSubmitFooter {...baseProps} />);

    // As on every Submit that sends answers: the count in the corner without its brackets, which the name keeps.
    const submitButton = screen.getByRole('button', { name: 'Submit (2)' });
    expect(submitButton).toHaveAttribute('data-testid', E2E_TESTIDS.SURVEY_SUBMIT);
    expect(submitButton.querySelector('.pileSubmitButtonCount')).toHaveTextContent(/^2$/);

    fireEvent.click(submitButton);

    expect(baseProps.onPrimarySubmitClick).toHaveBeenCalledTimes(1);
  });

  it('renders pending clear changes while preserving its handler', () => {
    render(<SurveyQuestionsSubmitFooter {...baseProps} displayState={{ showSubmitAux: true }} pendingEditCount={2} />);

    const submitButton = screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT);
    expect(submitButton).toHaveClass('submitGlow');

    fireEvent.click(screen.getByRole('button', { name: 'Clear pending changes' }));

    expect(baseProps.onRevertPendingChanges).toHaveBeenCalledTimes(1);
  });

  it('renders uploading, submitted, error, and single-question display states', () => {
    const { rerender } = render(
      <SurveyQuestionsSubmitFooter
        {...baseProps}
        displayState={{
          submitDisabled: true,
          uploadStatusText: 'Saving',
        }}
        isSubmitting
      />,
    );

    const submitButton = screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT);
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Saving')).toBeInTheDocument();
    // With the seconds since the Submit began, as every Submit shows them while it runs.
    expect(submitButton).toHaveTextContent('Saving · 0s');

    rerender(
      <SurveyQuestionsSubmitFooter
        {...baseProps}
        displayState={{
          showSubmitAux: true,
          submittedIndicatorActive: true,
        }}
        responseUrl="https://example.test/response"
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toHaveTextContent('Submitted');
    expect(screen.getByTitle('View submitted response')).toHaveAttribute('href', 'https://example.test/response');
    expect(screen.getByTitle('View submitted response')).toHaveAttribute('target', '_blank');
    expect(screen.getByTitle('View submitted response')).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('button', { name: 'Clear pending changes' })).toBeNull();

    rerender(
      <SurveyQuestionsSubmitFooter
        {...baseProps}
        submissionError="This failure message is intentionally long enough to require truncation in the footer"
      />,
    );

    expect(screen.getByText('This failure message is intentionally long enou...')).toBeInTheDocument();

    rerender(<SurveyQuestionsSubmitFooter {...baseProps} isSingleQuestionView submitButtonText="Submit (1)" />);

    // The one-question page's Submit looks like every other: its count in the corner, and no arrow.
    const singleSubmit = screen.getByRole('button', { name: 'Submit (1)' });
    expect(singleSubmit).toHaveClass('singleQuestionSubmitButton');
    expect(singleSubmit.querySelector('.pileSubmitButtonCount')).toHaveTextContent(/^1$/);
    expect(singleSubmit.querySelector('svg')).toBeNull();
  });

  // "Still saving" must read whole on the button, or it looks like a cut-off failure. A partial Submit names the
  // answers left after it, so only its first sentence, before the ellipsis, has to fit.
  it('shows the still-saving messages whole on the button', () => {
    const { rerender } = render(
      <SurveyQuestionsSubmitFooter {...baseProps} submissionError={UPLOAD_IN_PROGRESS_MESSAGE} />,
    );
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)).toHaveTextContent(UPLOAD_IN_PROGRESS_MESSAGE);
    rerender(
      <SurveyQuestionsSubmitFooter
        {...baseProps}
        submissionError={`${PARTIAL_UPLOAD_IN_PROGRESS_MESSAGE} “Binary question” wasn't saved yet; submit again to send it.`}
      />,
    );
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)).toHaveTextContent(PARTIAL_UPLOAD_IN_PROGRESS_MESSAGE);
  });

  it('keeps submit aux inert while uploading pending survey edits', () => {
    render(
      <SurveyQuestionsSubmitFooter
        {...baseProps}
        displayState={{
          showSubmitAux: true,
          uploadStatusText: 'Saving',
        }}
        isSubmitting
        pendingEditCount={3}
      />,
    );

    expect(screen.getByText('Saving')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)).toHaveClass('submitGlow');
    expect(screen.queryByRole('button', { name: 'Clear pending changes' })).toBeNull();
    expect(baseProps.onRevertPendingChanges).not.toHaveBeenCalled();
  });

  it('does not render submitted route affordances in single-question mode', () => {
    render(
      <SurveyQuestionsSubmitFooter
        {...baseProps}
        displayState={{
          showSubmitAux: true,
          submittedIndicatorActive: true,
        }}
        isSingleQuestionView
        pendingEditCount={1}
        responseUrl="https://example.test/question-response"
        submitButtonText="Submit (1)"
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Submit (1)' });
    expect(submitButton).toHaveClass('singleQuestionSubmitButton');
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBeNull();
    expect(screen.queryByTitle('View submitted response')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear pending changes' })).toBeInTheDocument();
  });
});
