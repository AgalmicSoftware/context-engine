import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsIndividualResponsesList, {
  buildSurveyResultsResponseRowId,
} from './SurveyResultsIndividualResponsesList';

const styleMap = {
  biggerIcon: 'biggerIcon',
  externalLink: 'externalLink',
  responderAddress: 'responderAddress',
  responderLink: 'responderLink',
  responseCard: 'responseCard',
  responseHeader: 'responseHeader',
  responseList: 'responseList',
  responseListLoadMoreButton: 'responseListLoadMoreButton',
  responseListWindowStatus: 'responseListWindowStatus',
  singleResponseCard: 'singleResponseCard',
  surveyResultsCollapse: 'surveyResultsCollapse',
};

describe('SurveyResultsIndividualResponsesList', () => {
  it('builds stable row ids from survey and responder identity', () => {
    expect(buildSurveyResultsResponseRowId({ responder: '0xABC123', surveyId: 'survey-1' }, 'fallback-survey', 4)).toBe(
      'survey-1:0xabc123',
    );
  });

  it('renders the empty individual-results state', () => {
    render(
      <SurveyResultsIndividualResponsesList
        filterLoading={false}
        onToggleResponse={jest.fn()}
        renderResponseBody={jest.fn()}
        responses={[]}
        styleMap={styleMap}
      />,
    );

    expect(screen.getByText('No results yet.')).toBeInTheDocument();
  });

  it('renders response links, body content, and toggle wiring', () => {
    const onToggleResponse = jest.fn();
    const renderResponseBody = jest.fn(() => <div data-testid="response-body">Response body</div>);
    render(
      <SurveyResultsIndividualResponsesList
        activeToggles={{ 'survey id/with spaces:0xabc123/def456': true }}
        currentSurveyId="survey id/with spaces"
        effectiveSlug="alpha"
        filterLoading={false}
        onToggleResponse={onToggleResponse}
        renderResponseBody={renderResponseBody}
        responses={[{ responder: '0xabc123/def456' }]}
        styleMap={styleMap}
      />,
    );

    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', `/u/${encodeURIComponent('0xabc123/def456')}`);
    expect(screen.getAllByRole('link')[1]).toHaveAttribute(
      'href',
      `/survey/${encodeURIComponent('survey id/with spaces')}/${encodeURIComponent('0xabc123/def456')}?session=alpha`,
    );
    expect(screen.getAllByRole('link')[1]).toHaveAttribute('target', '_blank');
    expect(screen.getAllByRole('link')[1]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByTestId('response-body')).toHaveTextContent('Response body');
    expect(renderResponseBody).toHaveBeenCalledWith({ responder: '0xabc123/def456' }, 0);

    fireEvent.click(screen.getAllByRole('link')[0]);
    expect(onToggleResponse).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('link')[0].closest('.responseHeader') as HTMLElement);
    expect(onToggleResponse).toHaveBeenCalledWith('survey id/with spaces:0xabc123/def456');
  });

  it('keeps the expanded responder open when filtering changes response indexes', () => {
    const renderResponseBody = jest.fn((response) => <div data-testid="response-body">{response.responder}</div>);
    const { rerender } = render(
      <SurveyResultsIndividualResponsesList
        activeToggles={{ 'survey-1:0xbbb': true }}
        currentSurveyId="survey-1"
        filterLoading={false}
        onToggleResponse={jest.fn()}
        renderResponseBody={renderResponseBody}
        responses={[{ responder: '0xAAA' }, { responder: '0xBBB' }]}
        styleMap={styleMap}
      />,
    );

    expect(screen.getByTestId('response-body')).toHaveTextContent('0xBBB');
    expect(renderResponseBody).toHaveBeenCalledWith({ responder: '0xBBB' }, 1);

    renderResponseBody.mockClear();
    rerender(
      <SurveyResultsIndividualResponsesList
        activeToggles={{ 'survey-1:0xbbb': true }}
        currentSurveyId="survey-1"
        filterLoading={false}
        onToggleResponse={jest.fn()}
        renderResponseBody={renderResponseBody}
        responses={[{ responder: '0xBBB' }]}
        styleMap={styleMap}
      />,
    );

    expect(screen.getByTestId('response-body')).toHaveTextContent('0xBBB');
    expect(renderResponseBody).toHaveBeenCalledWith({ responder: '0xBBB' }, 0);
  });

  it('keeps collapsed response bodies unmounted', () => {
    const renderResponseBody = jest.fn(() => <div data-testid="response-body">Response body</div>);
    render(
      <SurveyResultsIndividualResponsesList
        activeToggles={{}}
        currentSurveyId="survey-1"
        filterLoading={false}
        onToggleResponse={jest.fn()}
        renderResponseBody={renderResponseBody}
        responses={[{ responder: '0xabc123' }]}
        styleMap={styleMap}
      />,
    );

    expect(screen.queryByTestId('response-body')).not.toBeInTheDocument();
    expect(renderResponseBody).not.toHaveBeenCalled();
  });

  it('bounds large response lists and loads the next response window on demand', () => {
    const responses = Array.from({ length: 5 }, (_, index) => ({
      responder: `0x${String(index).padStart(4, '0')}`,
      surveyId: 'survey-1',
    }));
    render(
      <SurveyResultsIndividualResponsesList
        currentSurveyId="survey-1"
        filterLoading={false}
        initialVisibleCount={2}
        onToggleResponse={jest.fn()}
        renderResponseBody={jest.fn()}
        responses={responses}
        styleMap={styleMap}
        visibleIncrement={2}
      />,
    );

    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByTestId('ce-survey-results-response-window-status')).toHaveTextContent(
      '3 more responses are hidden.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more responses' }));
    expect(screen.getAllByRole('link')).toHaveLength(8);
    expect(screen.getByTestId('ce-survey-results-response-window-status')).toHaveTextContent(
      '1 more response is hidden.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show 1 more response' }));
    expect(screen.getAllByRole('link')).toHaveLength(10);
    expect(screen.queryByTestId('ce-survey-results-response-window-status')).not.toBeInTheDocument();
  });

  it('keeps an active responder visible when the open row lands past the initial window', () => {
    const renderResponseBody = jest.fn((response) => <div data-testid="response-body">{response.responder}</div>);
    const responses = Array.from({ length: 5 }, (_, index) => ({
      responder: `0x${String(index).padStart(4, '0')}`,
      surveyId: 'survey-1',
    }));

    render(
      <SurveyResultsIndividualResponsesList
        activeToggles={{ 'survey-1:0x0003': true }}
        currentSurveyId="survey-1"
        filterLoading={false}
        initialVisibleCount={2}
        onToggleResponse={jest.fn()}
        renderResponseBody={renderResponseBody}
        responses={responses}
        styleMap={styleMap}
      />,
    );

    expect(screen.getAllByRole('link')).toHaveLength(8);
    expect(screen.getByTestId('response-body')).toHaveTextContent('0x0003');
    expect(renderResponseBody).toHaveBeenCalledWith(responses[3], 3);
    expect(screen.getByTestId('ce-survey-results-response-window-status')).toHaveTextContent(
      '1 more response is hidden.',
    );
  });

  it('suppresses the empty copy while filters are loading', () => {
    render(
      <SurveyResultsIndividualResponsesList
        filterLoading={true}
        onToggleResponse={jest.fn()}
        renderResponseBody={jest.fn()}
        responses={[]}
        styleMap={styleMap}
      />,
    );

    expect(screen.queryByText('No results yet.')).not.toBeInTheDocument();
  });
});
