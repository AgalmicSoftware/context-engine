import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SurveyQuestionsTopStrip from './SurveyQuestionsTopStrip';

describe('SurveyQuestionsTopStrip', () => {
  const baseProps = {
    onDecryptEdit: jest.fn(),
    onExitEditing: jest.fn(),
    onStartFresh: jest.fn(),
    onToggleDisplayAnswerMode: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onDecryptEdit.mockClear();
    baseProps.onExitEditing.mockClear();
    baseProps.onStartFresh.mockClear();
    baseProps.onToggleDisplayAnswerMode.mockClear();
  });

  it('renders an empty top strip when route and response controls are hidden', () => {
    const { container } = render(
      <SurveyQuestionsTopStrip {...baseProps} layoutDisplayState={{ topSectionClassName: 'top-strip' }} />,
    );

    const strip = container.firstElementChild;
    expect(strip).toHaveClass('top-strip');
    expect(strip).toBeEmptyDOMElement();
  });

  it('forwards the top strip ref for route scroll behavior', () => {
    const ref = React.createRef<HTMLDivElement>();

    const { container } = render(
      <SurveyQuestionsTopStrip {...baseProps} ref={ref} layoutDisplayState={{ topSectionClassName: 'top-strip' }} />,
    );

    expect(ref.current).toBe(container.firstElementChild);
  });

  it('renders the answer-mode toggle label and preserves handler wiring', () => {
    render(
      <SurveyQuestionsTopStrip
        {...baseProps}
        routeViewDisplayState={{
          isOwnResponse: false,
          isSingleQuestionView: false,
          showViewAnswersButton: true,
          viewAnswersButtonText: ' View 0xabc answers',
        }}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'View 0xabc answers' });
    expect(toggle).toHaveAttribute('id', 'answerSurveyButton');

    fireEvent.click(toggle);

    expect(baseProps.onToggleDisplayAnswerMode).toHaveBeenCalledTimes(1);
  });

  it('renders existing-response notice actions and preserves response handlers', () => {
    render(
      <SurveyQuestionsTopStrip
        {...baseProps}
        isEditing
        responseUrl="https://example.com/submitted-response"
        showUserResponseNotice
        submittedStateActive
        userResponseEncrypted
      />,
    );

    expect(screen.getByTestId(E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_START_FRESH));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_EXIT_EDITING));

    expect(baseProps.onStartFresh).toHaveBeenCalledTimes(1);
    expect(baseProps.onDecryptEdit).toHaveBeenCalledTimes(1);
    expect(baseProps.onExitEditing).toHaveBeenCalledTimes(1);
    expect(screen.getByTitle('View submitted response')).toHaveAttribute(
      'href',
      'https://example.com/submitted-response',
    );
  });

  it('offers to edit an existing plaintext response on a standalone question route', () => {
    render(
      <SurveyQuestionsTopStrip
        {...baseProps}
        routeViewDisplayState={{
          isOwnResponse: true,
          isSingleQuestionView: true,
          showViewAnswersButton: false,
          viewAnswersButtonText: '',
        }}
        submitDisplayState={{ submittedStateActive: true }}
        userHasResponse
      />,
    );

    expect(screen.getByText('Existing response detected')).toBeInTheDocument();
    const editButton = screen.getByRole('button', { name: 'Edit Response' });
    expect(editButton).toBeEnabled();

    fireEvent.click(editButton);

    expect(baseProps.onDecryptEdit).toHaveBeenCalledTimes(1);
  });

  it('hides the standalone existing-response notice while the response is already being edited', () => {
    render(
      <SurveyQuestionsTopStrip
        {...baseProps}
        isEditing
        routeViewDisplayState={{
          isOwnResponse: true,
          isSingleQuestionView: true,
          showViewAnswersButton: false,
          viewAnswersButtonText: '',
        }}
        userHasResponse
      />,
    );

    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE)).not.toBeInTheDocument();
  });
});
