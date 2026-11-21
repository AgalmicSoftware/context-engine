import React from 'react';
import { render, screen } from '@testing-library/react';

import { QuestionAnalysisNote } from './QuestionAnalysisNote';

describe("the AI's saved reading on a question's atlas card", () => {
  it('shows the summary, labelled as the AI\u2019s, and each category with its share', () => {
    render(
      <QuestionAnalysisNote
        analysis={{
          summary: 'Most want contracts published.',
          answered: 9,
          categories: [
            { label: 'Publish everything', summary: '', participantCount: 6 },
            { label: 'Too costly', summary: '', participantCount: 2 },
          ],
        }}
      />,
    );
    const note = screen.getByTestId('ce-atlas-question-analysis');
    expect(note).toHaveTextContent('AI summary of 9 participants\u2019 answers');
    expect(note).toHaveTextContent('Most want contracts published.');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Publish everything6 of 9',
      'Too costly2 of 9',
    ]);
  });

  it('shows nothing for a question without one, as in every older build', () => {
    const { container } = render(
      <>
        <QuestionAnalysisNote />
        <QuestionAnalysisNote analysis={{ summary: '', answered: 3, categories: [] }} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('gives bare counts when the build does not say how many answered, and counts one as one', () => {
    const categories = [{ label: 'Yes', summary: '', participantCount: 3 }];
    const { unmount } = render(<QuestionAnalysisNote analysis={{ summary: 'Split.', answered: 0, categories }} />);
    expect(screen.getByTestId('ce-atlas-question-analysis')).toHaveTextContent(/^AI summarySplit\.Yes3$/);
    unmount();
    render(<QuestionAnalysisNote id="note-1" analysis={{ summary: 'Alone.', answered: 1, categories: [] }} />);
    expect(screen.getByTestId('ce-atlas-question-analysis')).toHaveTextContent(
      'AI summary of 1 participant\u2019s answer',
    );
    expect(screen.getByTestId('ce-atlas-question-analysis')).toHaveAttribute('id', 'note-1');
  });
});
