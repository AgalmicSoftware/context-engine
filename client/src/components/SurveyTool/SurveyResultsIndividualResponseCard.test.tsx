import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsIndividualResponseCard from './SurveyResultsIndividualResponseCard';

const styleMap = {
  biggerIcon: 'biggerIcon',
  externalLink: 'externalLink',
  responderAddress: 'responderAddress',
  responderLink: 'responderLink',
  responseCard: 'responseCard',
  responseHeader: 'responseHeader',
  singleResponseCard: 'singleResponseCard',
  surveyResultsCollapse: 'surveyResultsCollapse',
};

describe('SurveyResultsIndividualResponseCard', () => {
  it('renders encoded response links and expanded body content', () => {
    const renderResponseBody = jest.fn(() => <div data-testid="response-body">Response body</div>);

    render(
      <SurveyResultsIndividualResponseCard
        currentSurveyId="survey id/with spaces"
        effectiveSlug="alpha session"
        index={2}
        isOpen={true}
        onToggleResponse={jest.fn()}
        renderResponseBody={renderResponseBody}
        response={{ responder: '0xabc123/def456' }}
        responseId="survey id/with spaces:0xabc123/def456"
        styleMap={styleMap}
      />
    );

    expect(screen.getAllByRole('link')[0]).toHaveAttribute(
      'href',
      `/u/${encodeURIComponent('0xabc123/def456')}`
    );
    expect(screen.getAllByRole('link')[1]).toHaveAttribute(
      'href',
      `/survey/${encodeURIComponent('survey id/with spaces')}/${encodeURIComponent('0xabc123/def456')}?session=${encodeURIComponent('alpha session')}`
    );
    expect(screen.getAllByRole('link')[1]).toHaveAttribute('target', '_blank');
    expect(screen.getAllByRole('link')[1]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByTestId('response-body')).toHaveTextContent('Response body');
    expect(renderResponseBody).toHaveBeenCalledWith({ responder: '0xabc123/def456' }, 2);
  });

  it('preserves header toggle wiring without toggling from the profile link', () => {
    const onToggleResponse = jest.fn();
    render(
      <SurveyResultsIndividualResponseCard
        index={4}
        onToggleResponse={onToggleResponse}
        renderResponseBody={jest.fn(() => <div>Response body</div>)}
        response={{ responder: '0xabc123/def456' }}
        responseId="survey-1:0xabc123/def456"
        styleMap={styleMap}
      />
    );

    fireEvent.click(screen.getAllByRole('link')[0]);
    expect(onToggleResponse).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('link')[0].closest('.responseHeader') as HTMLElement);
    expect(onToggleResponse).toHaveBeenCalledWith('survey-1:0xabc123/def456');
  });
});
