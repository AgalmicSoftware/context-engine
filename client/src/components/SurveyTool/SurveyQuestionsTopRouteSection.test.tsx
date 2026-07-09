import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyQuestionsTopRouteSection from './SurveyQuestionsTopRouteSection';

describe('SurveyQuestionsTopRouteSection', () => {
  it('renders answer-mode route controls from display descriptors', () => {
    const onToggleDisplayAnswerMode = jest.fn();

    render(
      <SurveyQuestionsTopRouteSection
        layoutDisplayState={{ topSectionClassName: 'top-section' }}
        routeViewDisplayState={{
          isOwnResponse: true,
          isSingleQuestionView: false,
          showViewAnswersButton: true,
          viewAnswersButtonText: 'Back to survey',
        }}
        topStripProps={{
          displayAnswerMode: true,
          onToggleDisplayAnswerMode,
          userHasResponse: true,
        }}
      />,
    );

    const button = screen.getByRole('button', { name: /Back to survey/i });
    expect(button.parentElement).toHaveClass('top-section');
    fireEvent.click(button);

    expect(onToggleDisplayAnswerMode).toHaveBeenCalledTimes(1);
  });

  it('forwards existing-response notice callbacks without owning their execution', () => {
    const onDecryptEdit = jest.fn();
    const onStartFresh = jest.fn();

    render(
      <SurveyQuestionsTopRouteSection
        routeViewDisplayState={{
          isOwnResponse: true,
          isSingleQuestionView: false,
        }}
        submitDisplayState={{ submittedStateActive: true }}
        topStripProps={{
          displayAnswerMode: true,
          onDecryptEdit,
          onStartFresh,
          responseUrl: '/response/1',
          userHasResponse: true,
          userResponseEncrypted: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Decrypt \/ Edit All/i }));
    fireEvent.click(screen.getByRole('button', { name: /Start Fresh/i }));

    expect(onDecryptEdit).toHaveBeenCalledTimes(1);
    expect(onStartFresh).toHaveBeenCalledTimes(1);
  });
});
