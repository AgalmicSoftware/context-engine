import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyQuestionsResponseRouteSection from './SurveyQuestionsResponseRouteSection';

describe('SurveyQuestionsResponseRouteSection', () => {
  it('renders survey answers through parent-provided answer renderers', () => {
    const renderSurveyAnswers = jest.fn(() => <div data-testid="survey-answers">Survey answers</div>);

    render(
      <SurveyQuestionsResponseRouteSection
        layoutDisplayState={{ responseViewClassName: 'response-view' }}
        responseViewProps={{
          questionPoolReady: true,
          renderSurveyAnswers,
          userAnswers: { responses: [{ questionID: 'q1', answer: 'Yes' }] },
        }}
        routeViewDisplayState={{ isOwnResponse: true }}
      />,
    );

    expect(screen.getByTestId('survey-answers')).toBeInTheDocument();
    expect(screen.getByTestId('survey-answers').parentElement).toHaveClass('response-view');
    expect(renderSurveyAnswers).toHaveBeenCalledWith([{ questionID: 'q1', answer: 'Yes' }], true);
  });

  it('renders viewed-address response metadata from route display state', () => {
    render(
      <SurveyQuestionsResponseRouteSection
        responseViewProps={{
          parsedViewAddressAnswers: { responses: [{ questionID: 'q1', answer: 'No' }] },
          questionPoolReady: true,
          renderSurveyAnswers: () => <div>Other answers</div>,
        }}
        routeViewDisplayState={{
          isOwnResponse: false,
          shortenedViewAddress: '0xabc...def',
          viewedAddressLower: '0xabcdef',
          viewedAddressRaw: '0xABCDEF',
        }}
      />,
    );

    expect(screen.getByRole('link', { name: '0xabc...def' })).toHaveAttribute('href', '/u/0xabcdef');
  });
});
