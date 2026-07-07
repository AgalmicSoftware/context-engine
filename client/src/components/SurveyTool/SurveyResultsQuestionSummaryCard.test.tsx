import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsQuestionSummaryCard from './SurveyResultsQuestionSummaryCard';

const styleMap = {
  aggregatorDarkCardBody: 'aggregatorDarkCardBody',
  aggregatorSummaryCard: 'aggregatorSummaryCard',
  biggerIcon: 'biggerIcon',
  headerLeft: 'headerLeft',
  questionBookmarkButton: 'questionBookmarkButton',
  questionBookmarkIcon: 'questionBookmarkIcon',
  questionExpandIcon: 'questionExpandIcon',
  questionSummaryHeader: 'questionSummaryHeader',
  questionSummaryHeaderIcons: 'questionSummaryHeaderIcons',
  questionTitle: 'questionTitle',
  responseCountContainer: 'responseCountContainer',
  responseCountIcon: 'responseCountIcon',
  responseCountNumber: 'responseCountNumber',
  surveyResultsCollapse: 'surveyResultsCollapse',
  surveyResultsOverride: 'surveyResultsOverride',
};

describe('SurveyResultsQuestionSummaryCard', () => {
  it('renders freeform summaries, missing metadata, counts, and bookmark state', () => {
    const onToggleBookmark = jest.fn();
    const onToggleSummary = jest.fn();
    const renderDefaultSummary = jest.fn(() => <div>Default summary</div>);
    const renderFreeformSummary = jest.fn(() => <div>Freeform summary</div>);
    const renderMultichoiceSummary = jest.fn(() => <div>Multichoice summary</div>);
    const { container } = render(
      <SurveyResultsQuestionSummaryCard
        bookmarked={true}
        bookmarkIconStyle={{ cursor: 'pointer' }}
        domId="question-card-q1"
        isActive={true}
        metadataMissing={true}
        metadataMissingStyle={{ fontStyle: 'italic' }}
        onToggleBookmark={onToggleBookmark}
        onToggleSummary={onToggleSummary}
        questionPrompt="Question prompt"
        renderDefaultSummary={renderDefaultSummary}
        renderFreeformSummary={renderFreeformSummary}
        renderMultichoiceSummary={renderMultichoiceSummary}
        resolvedQuestionType="freeform"
        styleMap={styleMap}
        viewableResponsesCount={3}
      />,
    );

    expect(screen.getByText('Question prompt')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('No metadata found for this question in local cache.')).toHaveStyle({
      fontStyle: 'italic',
    });
    expect(screen.getByText('Freeform summary')).toBeInTheDocument();
    expect(renderFreeformSummary).toHaveBeenCalledTimes(1);
    expect(renderMultichoiceSummary).not.toHaveBeenCalled();
    expect(renderDefaultSummary).not.toHaveBeenCalled();

    const bookmark = container.querySelector('svg[data-icon="bookmark"]') as SVGSVGElement;
    expect(bookmark).toHaveAttribute('color', 'gold');
    const bookmarkButton = screen.getByRole('button', { name: 'Remove bookmark' });
    expect(bookmarkButton).toHaveClass('questionBookmarkButton');
    fireEvent.click(bookmarkButton);
    expect(onToggleBookmark).toHaveBeenCalledTimes(1);
    expect(onToggleSummary).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Question prompt').closest('.questionSummaryHeader') as HTMLElement);
    expect(onToggleSummary).toHaveBeenCalledTimes(1);
  });

  it('selects multichoice and default summary renderers by resolved type', () => {
    const renderDefaultSummary = jest.fn(() => <div>Default summary</div>);
    const renderFreeformSummary = jest.fn(() => <div>Freeform summary</div>);
    const renderMultichoiceSummary = jest.fn(() => <div>Multichoice summary</div>);
    const { rerender } = render(
      <SurveyResultsQuestionSummaryCard
        domId="question-card-q2"
        isActive={true}
        onToggleBookmark={jest.fn()}
        onToggleSummary={jest.fn()}
        questionPrompt="Question prompt"
        renderDefaultSummary={renderDefaultSummary}
        renderFreeformSummary={renderFreeformSummary}
        renderMultichoiceSummary={renderMultichoiceSummary}
        resolvedQuestionType="multichoice"
        styleMap={styleMap}
      />,
    );

    expect(screen.getByText('Multichoice summary')).toBeInTheDocument();
    expect(renderMultichoiceSummary).toHaveBeenCalledTimes(1);
    expect(renderDefaultSummary).not.toHaveBeenCalled();

    rerender(
      <SurveyResultsQuestionSummaryCard
        domId="question-card-q2"
        isActive={true}
        onToggleBookmark={jest.fn()}
        onToggleSummary={jest.fn()}
        questionPrompt="Question prompt"
        renderDefaultSummary={renderDefaultSummary}
        renderFreeformSummary={renderFreeformSummary}
        renderMultichoiceSummary={renderMultichoiceSummary}
        resolvedQuestionType="binary"
        styleMap={styleMap}
      />,
    );

    expect(screen.getByText('Default summary')).toBeInTheDocument();
    expect(renderDefaultSummary).toHaveBeenCalledTimes(1);
  });
});
