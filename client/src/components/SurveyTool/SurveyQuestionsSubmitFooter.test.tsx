import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SurveyQuestionsSubmitFooter from './SurveyQuestionsSubmitFooter';

describe('SurveyQuestionsSubmitFooter', () => {
  const baseProps = {
    onPrimarySubmitClick: jest.fn(),
    onRevertPendingChanges: jest.fn(),
    submitButtonText: 'Submit 2 Responses',
  };

  beforeEach(() => {
    baseProps.onPrimarySubmitClick.mockClear();
    baseProps.onRevertPendingChanges.mockClear();
  });

  it('renders the submit button contract and forwards submit clicks', () => {
    render(<SurveyQuestionsSubmitFooter {...baseProps} />);

    const submitButton = screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT);
    expect(submitButton).toHaveTextContent('Submit 2 Responses');

    fireEvent.click(submitButton);

    expect(baseProps.onPrimarySubmitClick).toHaveBeenCalledTimes(1);
  });

  it('renders pending clear changes while preserving its handler', () => {
    render(
      <SurveyQuestionsSubmitFooter
        {...baseProps}
        pendingEditCount={2}
        showSubmitAux
      />
    );

    const submitButton = screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT);
    expect(submitButton).toHaveClass('submitGlow');

    fireEvent.click(screen.getByRole('button', { name: 'Clear pending changes' }));

    expect(baseProps.onRevertPendingChanges).toHaveBeenCalledTimes(1);
  });

  it('renders uploading, submitted, error, and single-question display states', () => {
    const { rerender } = render(
      <SurveyQuestionsSubmitFooter
        {...baseProps}
        isSubmitting
        submitDisabled
        uploadStatusText="Encrypting..."
      />
    );

    const submitButton = screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT);
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Encrypting...')).toBeInTheDocument();

    rerender(
      <SurveyQuestionsSubmitFooter
        {...baseProps}
        responseUrl="https://example.test/response"
        showSubmitAux
        submittedIndicatorActive
      />
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
      />
    );

    expect(screen.getByText('This failure message is intentionally long enou...')).toBeInTheDocument();

    rerender(
      <SurveyQuestionsSubmitFooter
        {...baseProps}
        isSingleQuestionView
        submitButtonText="SUBMIT"
      />
    );

    expect(screen.getByText('SUBMIT')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)).toHaveClass('singleQuestionSubmitButton');
  });

  it('keeps submit aux inert while uploading pending survey edits', () => {
    render(
      <SurveyQuestionsSubmitFooter
        {...baseProps}
        isSubmitting
        pendingEditCount={3}
        showSubmitAux
        uploadStatusText="Uploading..."
      />
    );

    expect(screen.getByText('Uploading...')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)).toHaveClass('submitGlow');
    expect(screen.queryByRole('button', { name: 'Clear pending changes' })).toBeNull();
    expect(baseProps.onRevertPendingChanges).not.toHaveBeenCalled();
  });

  it('does not render submitted route affordances in single-question mode', () => {
    render(
      <SurveyQuestionsSubmitFooter
        {...baseProps}
        isSingleQuestionView
        pendingEditCount={1}
        responseUrl="https://example.test/question-response"
        showSubmitAux
        submitButtonText="SUBMIT"
        submittedIndicatorActive
      />
    );

    const submitButton = screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT);
    expect(submitButton).toHaveClass('singleQuestionSubmitButton');
    expect(submitButton).toHaveTextContent('SUBMIT');
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR)).toBeNull();
    expect(screen.queryByTitle('View submitted response')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear pending changes' })).toBeInTheDocument();
  });
});
