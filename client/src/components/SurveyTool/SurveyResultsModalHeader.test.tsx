import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsModalHeader from './SurveyResultsModalHeader';

const styleMap = {
  biggerIcon: 'biggerIcon',
  demoResultsViewButton: 'demoResultsViewButton',
  demoResultsViewButtonActive: 'demoResultsViewButtonActive',
  demoResultsViewNav: 'demoResultsViewNav',
  modalHeader: 'modalHeader',
  modalHeaderContent: 'modalHeaderContent',
  modalHeaderControls: 'modalHeaderControls',
  modalHeaderTitleBlock: 'modalHeaderTitleBlock',
  modalSubtitle: 'modalSubtitle',
  modalTitle: 'modalTitle',
  surveyDocUrlLink: 'surveyDocUrlLink',
  surveyDocUrls: 'surveyDocUrls',
  surveyIdLink: 'surveyIdLink',
  surveyIdMeta: 'surveyIdMeta',
};

describe('SurveyResultsModalHeader', () => {
  it('renders survey title metadata, document links, status nodes, and bookmark state', () => {
    const onToggleSurveyBookmark = jest.fn();
    const surveyId = '0x1111111111111111111111111111111111111111111111111111111111111111';
    const docUrl = 'https://example.test/documents/this-is-a-long-survey-document-url-for-results.pdf';
    const { container } = render(
      <SurveyResultsModalHeader
        bookmarkedSurveyIDs={[surveyId]}
        currentSurveyId={surveyId}
        documentLinkIconStyle={{ marginRight: 4 }}
        effectiveSlug="alpha"
        lockedResponsesToggleNode={<button type="button">Locked</button>}
        onClose={jest.fn()}
        onDemoResultsViewSelect={jest.fn()}
        onToggleSurveyBookmark={onToggleSurveyBookmark}
        styleMap={styleMap}
        surveyBookmarkStyle={{ marginLeft: '8px', cursor: 'pointer' }}
        surveyDocumentURLs={[docUrl]}
        surveyIdAbbreviation="0x1111...1111"
        surveyTitle="Demo Survey"
        syncStatusNode={<div data-testid="sync-status">In Sync</div>}
        viewMode="survey"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Demo Survey' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0x1111...1111' })).toHaveAttribute(
      'href',
      `/survey/${encodeURIComponent(surveyId)}?session=alpha`,
    );
    expect(screen.getByRole('link', { name: /https:\/\/example\.test\/documents\// })).toHaveAttribute('href', docUrl);
    expect(screen.getByRole('link', { name: /https:\/\/example\.test\/documents\// })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(screen.getByRole('button', { name: 'Locked' })).toBeInTheDocument();
    expect(screen.getByTestId('sync-status')).toHaveTextContent('In Sync');

    const bookmark = container.querySelector('svg') as SVGSVGElement;
    expect(bookmark).toHaveAttribute('color', 'gold');
    fireEvent.click(bookmark);
    expect(onToggleSurveyBookmark).toHaveBeenCalledWith(surveyId);
  });

  it('renders question mode demo view navigation without survey metadata', () => {
    const onDemoResultsViewSelect = jest.fn();
    render(
      <SurveyResultsModalHeader
        demoResultsViewMode="atlas"
        demoResultsViewOptions={[
          { key: 'report', label: 'Report' },
          { key: 'atlas', label: 'Atlas' },
        ]}
        isDemoQuestionResults={true}
        onClose={jest.fn()}
        onDemoResultsViewSelect={onDemoResultsViewSelect}
        onToggleSurveyBookmark={jest.fn()}
        styleMap={styleMap}
        viewMode="questions"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Question Results' })).toBeInTheDocument();
    expect(screen.queryByText('Survey ID:')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-surveyresults-demo-view-nav')).toBeInTheDocument();
    expect(screen.getByTestId('ce-surveyresults-demo-view-atlas')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-report'));
    expect(onDemoResultsViewSelect).toHaveBeenCalledWith('report');
  });
});
