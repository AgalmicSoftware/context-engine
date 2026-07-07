import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsQuestionTableRow from './SurveyResultsQuestionTableRow';

const styleMap = {
  clickableQuestionId: 'clickableQuestionId',
  promptColumn: 'promptColumn',
  tableActionButton: 'tableActionButton',
};

describe('SurveyResultsQuestionTableRow', () => {
  it('renders question row display with scoped links and bookmark state', () => {
    const onToggleQuestionBookmark = jest.fn();
    const onViewQuestion = jest.fn();
    const { container } = render(
      <table>
        <tbody>
          <SurveyResultsQuestionTableRow
            bookmarked={true}
            entry={{
              questionId: 'q1',
              prompt: 'First prompt',
              responsesCount: 3,
              sessionSlug: 'alpha',
              type: 'freeform',
            }}
            fallbackSessionSlug="fallback"
            onToggleQuestionBookmark={onToggleQuestionBookmark}
            onViewQuestion={onViewQuestion}
            styleMap={styleMap}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText('First prompt')).toHaveClass('promptColumn');
    expect(screen.getByText('freeform')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/question/q1?session=alpha');
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
    expect(container.querySelector('svg')).toHaveAttribute('color', 'gold');
  });

  it('uses fallback prompt/session display and preserves row action wiring', () => {
    const onToggleQuestionBookmark = jest.fn();
    const onViewQuestion = jest.fn();
    const { container } = render(
      <table>
        <tbody>
          <SurveyResultsQuestionTableRow
            entry={{
              questionId: 'q2',
              prompt: '',
              responsesCount: 0,
              type: 'binary',
            }}
            fallbackSessionSlug="fallback"
            onToggleQuestionBookmark={onToggleQuestionBookmark}
            onViewQuestion={onViewQuestion}
            styleMap={styleMap}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText('(No prompt)')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/question/q2?session=fallback');
    expect(container.querySelector('svg')).toHaveAttribute('color', 'white');

    fireEvent.click(container.querySelector('svg') as SVGSVGElement);
    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    expect(onToggleQuestionBookmark).toHaveBeenCalledWith('q2');
    expect(onViewQuestion).toHaveBeenCalledWith('q2');
  });
});
