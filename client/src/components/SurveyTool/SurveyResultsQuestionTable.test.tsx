import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SurveyResultsQuestionTable from './SurveyResultsQuestionTable';

const styleMap = {
  clickableQuestionId: 'clickableQuestionId',
  promptColumn: 'promptColumn',
  questionIdTable: 'questionIdTable',
  questionIdTableWrapper: 'questionIdTableWrapper',
  tableActionButton: 'tableActionButton',
};

describe('SurveyResultsQuestionTable', () => {
  it('renders question rows, fallback prompt text, links, and bookmark state', () => {
    const onSort = jest.fn();
    const onToggleQuestionBookmark = jest.fn();
    const onViewQuestion = jest.fn();
    const { container } = render(
      <SurveyResultsQuestionTable
        bookmarkedQuestionIDs={['q1']}
        entries={[
          {
            questionId: 'q1',
            prompt: 'First prompt',
            responsesCount: 3,
            sessionSlug: 'alpha',
            type: 'freeform',
          },
          {
            questionId: 'q2',
            prompt: '',
            responsesCount: 0,
            type: 'binary',
          },
        ]}
        fallbackSessionSlug="fallback"
        onSort={onSort}
        onToggleQuestionBookmark={onToggleQuestionBookmark}
        onViewQuestion={onViewQuestion}
        sortAsc={false}
        sortBy="responses"
        styleMap={styleMap}
      />,
    );

    expect(screen.getByText('First prompt')).toBeInTheDocument();
    expect(screen.getByText('(No prompt)')).toBeInTheDocument();
    expect(screen.getByText('freeform')).toBeInTheDocument();
    expect(screen.getByText('binary')).toBeInTheDocument();
    expect(screen.getByText('Responses ▼')).toBeInTheDocument();
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/question/q1?session=alpha');
    expect(screen.getAllByRole('link')[1]).toHaveAttribute('href', '/question/q2?session=fallback');
    expect(container.querySelector('svg')).toHaveAttribute('color', 'gold');
  });

  it('preserves sort, bookmark, and view handler wiring', () => {
    const onSort = jest.fn();
    const onToggleQuestionBookmark = jest.fn();
    const onViewQuestion = jest.fn();
    const { container } = render(
      <SurveyResultsQuestionTable
        entries={[
          {
            questionId: 'q1',
            prompt: 'First prompt',
            responsesCount: 3,
            type: 'freeform',
          },
        ]}
        onSort={onSort}
        onToggleQuestionBookmark={onToggleQuestionBookmark}
        onViewQuestion={onViewQuestion}
        styleMap={styleMap}
      />,
    );

    fireEvent.click(screen.getByText('Prompt ▲▼'));
    fireEvent.click(screen.getByText('Type ▲▼'));
    fireEvent.click(screen.getByText('Responses ▲▼'));
    fireEvent.click(container.querySelector('svg') as SVGSVGElement);
    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    expect(onSort).toHaveBeenCalledWith('prompt');
    expect(onSort).toHaveBeenCalledWith('type');
    expect(onSort).toHaveBeenCalledWith('responses');
    expect(onToggleQuestionBookmark).toHaveBeenCalledWith('q1');
    expect(onViewQuestion).toHaveBeenCalledWith('q1');
  });
});
