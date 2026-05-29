import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsIndividualResponsesList from './SurveyResultsIndividualResponsesList';

const styleMap = {
  biggerIcon: 'biggerIcon',
  externalLink: 'externalLink',
  responderAddress: 'responderAddress',
  responderLink: 'responderLink',
  responseCard: 'responseCard',
  responseHeader: 'responseHeader',
  responseList: 'responseList',
  singleResponseCard: 'singleResponseCard',
  surveyResultsCollapse: 'surveyResultsCollapse',
};

describe('SurveyResultsIndividualResponsesList', () => {
  it('renders the empty individual-results state', () => {
    render(
      <SurveyResultsIndividualResponsesList
        filterLoading={false}
        onToggleResponse={jest.fn()}
        renderResponseBody={jest.fn()}
        responses={[]}
        styleMap={styleMap}
      />
    );

    expect(screen.getByText('No results yet.')).toBeInTheDocument();
  });

  it('renders response links, body content, and toggle wiring', () => {
    const onToggleResponse = jest.fn();
    const renderResponseBody = jest.fn(() => <div data-testid="response-body">Response body</div>);
    render(
      <SurveyResultsIndividualResponsesList
        activeToggles={{ 0: true }}
        currentSurveyId="survey id/with spaces"
        effectiveSlug="alpha"
        filterLoading={false}
        onToggleResponse={onToggleResponse}
        renderResponseBody={renderResponseBody}
        responses={[{ responder: '0xabc123/def456' }]}
        styleMap={styleMap}
      />
    );

    expect(screen.getAllByRole('link')[0]).toHaveAttribute(
      'href',
      `/u/${encodeURIComponent('0xabc123/def456')}`
    );
    expect(screen.getAllByRole('link')[1]).toHaveAttribute(
      'href',
      `/survey/${encodeURIComponent('survey id/with spaces')}/${encodeURIComponent('0xabc123/def456')}?session=alpha`
    );
    expect(screen.getAllByRole('link')[1]).toHaveAttribute('target', '_blank');
    expect(screen.getAllByRole('link')[1]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByTestId('response-body')).toHaveTextContent('Response body');
    expect(renderResponseBody).toHaveBeenCalledWith({ responder: '0xabc123/def456' }, 0);

    fireEvent.click(screen.getAllByRole('link')[0]);
    expect(onToggleResponse).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('link')[0].closest('.responseHeader') as HTMLElement);
    expect(onToggleResponse).toHaveBeenCalledWith(0);
  });

  it('renders responder addresses without links in anonymized mode', () => {
    const onToggleResponse = jest.fn();
    render(
      <SurveyResultsIndividualResponsesList
        anonymizedResultsMode
        currentSurveyId="survey-id"
        effectiveSlug="alpha"
        filterLoading={false}
        onToggleResponse={onToggleResponse}
        renderResponseBody={jest.fn()}
        responses={[{ responder: '0xabc123/def456' }]}
        styleMap={styleMap}
      />
    );

    expect(screen.getByText('0xabc...')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('0xabc...').closest('.responseHeader') as HTMLElement);
    expect(onToggleResponse).toHaveBeenCalledWith(0);
  });

  it('suppresses the empty copy while filters are loading', () => {
    render(
      <SurveyResultsIndividualResponsesList
        filterLoading={true}
        onToggleResponse={jest.fn()}
        renderResponseBody={jest.fn()}
        responses={[]}
        styleMap={styleMap}
      />
    );

    expect(screen.queryByText('No results yet.')).not.toBeInTheDocument();
  });
});
