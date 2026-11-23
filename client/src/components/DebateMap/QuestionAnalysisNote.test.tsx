import React from 'react';
import { render, screen, within } from '@testing-library/react';

import { QuestionAnalysisNote } from './QuestionAnalysisNote';

describe("the AI's saved reading of a topic's only question", () => {
  it('shows the summary, labelled as the AI’s, and each category with its share', () => {
    render(
      <QuestionAnalysisNote
        analysis={{
          summary: 'Most want contracts published.',
          answered: 9,
          categories: [
            { label: 'Publish everything', summary: 'They favor full disclosure.', participantCount: 6 },
            { label: 'Too costly', summary: 'They worry about the expense.', participantCount: 2 },
          ],
        }}
      />,
    );
    const whole = screen.getByTestId('ce-atlas-question-analysis');
    // A region named by its label, as the topic's own summary is.
    const note = within(whole).getByRole('region', { name: 'AI summary of 9 participants’ answers' });
    expect(note).toHaveTextContent('Most want contracts published.');
    const categories = within(whole).getByRole('region', { name: 'Categories' });
    expect(categories).toHaveTextContent(/^Categories 2/);
    expect(
      within(categories)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Publish everything6 of 9 participantsThey favor full disclosure.',
      'Too costly2 of 9 participantsThey worry about the expense.',
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
    const whole = screen.getByTestId('ce-atlas-question-analysis');
    expect(within(whole).getByRole('region', { name: 'AI summary' })).toHaveTextContent('AI summarySplit.');
    expect(within(whole).getByRole('listitem')).toHaveTextContent(/^Yes3 participants$/);
    unmount();
    render(<QuestionAnalysisNote analysis={{ summary: 'Alone.', answered: 1, categories: [] }} />);
    expect(screen.getByRole('region', { name: 'AI summary of 1 participant’s answer' })).toHaveTextContent(
      'AI summary of 1 participant’s answer',
    );
  });
});
