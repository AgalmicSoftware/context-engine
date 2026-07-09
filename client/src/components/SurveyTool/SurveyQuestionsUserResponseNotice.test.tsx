import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SurveyQuestionsUserResponseNotice from './SurveyQuestionsUserResponseNotice';

describe('SurveyQuestionsUserResponseNotice', () => {
  const noop = jest.fn();

  it('does not render when hidden', () => {
    render(
      <SurveyQuestionsUserResponseNotice show={false} onStartFresh={noop} onDecryptEdit={noop} onExitEditing={noop} />,
    );

    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE)).toBeNull();
  });

  it('renders existing-response actions and preserves handler wiring', () => {
    const onStartFresh = jest.fn();
    const onDecryptEdit = jest.fn();
    const onExitEditing = jest.fn();

    render(
      <SurveyQuestionsUserResponseNotice
        show
        isEditing
        responseUrl="https://example.com/response"
        submittedStateActive
        userResponseEncrypted
        onStartFresh={onStartFresh}
        onDecryptEdit={onDecryptEdit}
        onExitEditing={onExitEditing}
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_START_FRESH));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_EXIT_EDITING));

    expect(onStartFresh).toHaveBeenCalledTimes(1);
    expect(onDecryptEdit).toHaveBeenCalledTimes(1);
    expect(onExitEditing).toHaveBeenCalledTimes(1);
    expect(screen.getByTitle('View submitted response')).toHaveAttribute('href', 'https://example.com/response');
  });

  it('preserves decrypting and disabled button states', () => {
    render(
      <SurveyQuestionsUserResponseNotice
        show
        isDecrypting
        isEditing
        isSubmitting
        onStartFresh={noop}
        onDecryptEdit={noop}
        onExitEditing={noop}
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_START_FRESH)).toBeDisabled();
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL)).toBeDisabled();
    expect(screen.getByText('Decrypting...')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_EXIT_EDITING)).toBeDisabled();
    expect(screen.queryByTitle('View submitted response')).toBeNull();
  });
});
