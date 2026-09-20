import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PolisAnswerSections from './PolisAnswerSections';
import { buildReportAnswerQuestions } from './polisReportAnswers';

const questions = buildReportAnswerQuestions({
  q1: [{ responder: 'a', response: { type: 'rating', prompt: 'Less answered', answer: { value: 0 } } }],
  q2: ['a', 'b'].map((responder) => ({
    responder,
    response: { type: 'rating', prompt: 'Most answered', answer: { value: 7 } },
  })),
  q3: [
    {
      responder: 'a',
      response: { type: 'quadratic', prompt: 'Projects', options: ['Garden', 'Bus'], answer: { value: [4, -5] } },
    },
  ],
});

it('starts collapsed, previews the top question, and uses one control for the remaining questions', () => {
  render(<PolisAnswerSections questions={questions} />);
  const ratings = screen.getByRole('region', { name: 'Ratings' });
  const toggle = within(ratings).getByRole('button', { name: 'Ratings' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Most answered')).not.toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(within(ratings).getByText('Most answered')).toBeInTheDocument();
  expect(screen.queryByText('Less answered')).not.toBeInTheDocument();
  fireEvent.click(within(ratings).getByRole('button', { name: 'View more (1)' }));
  expect(within(ratings).getByText('Less answered')).toBeInTheDocument();
  fireEvent.click(within(ratings).getByRole('button', { name: 'View less' }));
  expect(screen.queryByText('Less answered')).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(screen.queryByText('Most answered')).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Freeform' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Quadratic allocation' }));
  expect(screen.queryByText(/credits/)).not.toBeInTheDocument();
  expect(screen.getAllByText('−5')).toHaveLength(2);
});

const written = buildReportAnswerQuestions({
  text1: ['First response', 'Second response', 'Third response', 'Fourth response', 'Fifth response'].map(
    (value, index) => ({
      responder: `person-${index}`,
      response: { type: 'freeform', prompt: 'Most written answers', answer: { value } },
    }),
  ),
  text2: [
    {
      responder: 'a',
      response: { type: 'freeform', prompt: 'Another written question', answer: { value: 'Last response' } },
    },
  ],
});

it('reveals hidden written answers and questions together with one View more control', () => {
  const { rerender } = render(<PolisAnswerSections questions={written} />);
  fireEvent.click(screen.getByRole('button', { name: 'Freeform' }));
  expect(screen.getByText('Third response')).toBeInTheDocument();
  expect(screen.queryByText('Fourth response')).not.toBeInTheDocument();
  expect(screen.queryByText('Another written question')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View more (3)' }));
  expect(screen.getByText('Fourth response')).toBeInTheDocument();
  expect(screen.getByText('Last response')).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(2); // Section header and one expansion control.
  fireEvent.click(screen.getByRole('button', { name: 'View less' }));
  expect(screen.queryByText('Fourth response')).not.toBeInTheDocument();
  rerender(<PolisAnswerSections questions={[written[0]]} />);
  expect(screen.getByRole('button', { name: 'View more (2)' })).toBeInTheDocument();
  rerender(<PolisAnswerSections questions={[written[1]]} />);
  expect(screen.getByText('Last response')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /View more/ })).not.toBeInTheDocument();
});

it('includes all content in PDF and restores collapsed and expanded web states afterwards', () => {
  const all = [...questions, ...written];
  const { rerender } = render(<PolisAnswerSections questions={all} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ratings' }));
  fireEvent.click(screen.getByRole('button', { name: 'View more (1)' }));
  rerender(<PolisAnswerSections questions={all} pdfMode />);
  expect(screen.getByText('Less answered')).toBeInTheDocument();
  expect(screen.getByText('Last response')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByText('Most answered').closest('article')).toContainElement(screen.getByText('Ratings'));
  expect(screen.getByText('Most answered').closest('article')).toHaveAttribute('data-pdf-keep-together');
  rerender(<PolisAnswerSections questions={all} />);
  expect(screen.getByText('Less answered')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'View less' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Freeform' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Last response')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Quadratic allocation' })).toHaveAttribute('aria-expanded', 'false');
});

it('renders proportional multiple-choice bars with explicit geometry for PDF capture', () => {
  const multipleChoice = buildReportAnswerQuestions({
    poll: ['Garden', 'Garden', 'Bus'].map((value, index) => ({
      responder: `participant-${index}`,
      response: { type: 'multichoice', options: ['Garden', 'Bus', 'Paths'], answer: { value } },
    })),
  });
  render(<PolisAnswerSections questions={multipleChoice} pdfMode />);
  const rows = within(screen.getByRole('list', { name: 'Multiple choice results' })).getAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual(['Garden67% (2)', 'Bus33% (1)', 'Paths0% (0)']);
  const widths = rows.map((row) => Number(row.querySelector('svg rect:last-child')?.getAttribute('width')));
  expect(widths[0]).toBeCloseTo(200 / 3);
  expect(widths[1]).toBeCloseTo(100 / 3);
  expect(widths[2]).toBe(0);
  rows.forEach((row) => expect(row.querySelector('svg')).toHaveAttribute('viewBox', '0 0 100 16'));
});

it('keeps binary independent, includes it in PDF, and restores its collapsed state', () => {
  const binary = (heading: React.ReactNode) => (
    <article data-pdf-keep-together>
      {heading}
      <p>Binary vote totals</p>
    </article>
  );
  const { rerender } = render(<PolisAnswerSections questions={questions} renderBinaryQuestions={binary} />);
  expect(screen.queryByText('Binary vote totals')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Binary' }));
  expect(screen.getByText('Binary vote totals')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ratings' })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Binary' }));
  rerender(<PolisAnswerSections questions={questions} renderBinaryQuestions={binary} pdfMode />);
  expect(screen.getByText('Binary vote totals').closest('article')).toContainElement(screen.getByText('Binary'));
  expect(screen.getByText('Less answered')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(<PolisAnswerSections questions={questions} renderBinaryQuestions={binary} />);
  expect(screen.queryByText('Binary vote totals')).not.toBeInTheDocument();
});

it('limits the binary preview to five and includes every binary question in PDF', () => {
  const binary = (heading: React.ReactNode, limit?: number) => (
    <>
      {heading}
      {Array.from({ length: 7 }, (_, i) => i)
        .slice(0, limit)
        .map((i) => (
          <p key={i}>Binary {i}</p>
        ))}
    </>
  );
  const props = { questions: [], renderBinaryQuestions: binary, binaryQuestionCount: 7 };
  const { rerender } = render(<PolisAnswerSections {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Binary' }));
  expect(screen.queryByText('Binary 5')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View more (2)' }));
  expect(screen.getByText('Binary 6')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View less' }));
  rerender(<PolisAnswerSections {...props} pdfMode />);
  expect(screen.getByText('Binary 6')).toBeInTheDocument();
  rerender(<PolisAnswerSections {...props} />);
  expect(screen.queryByText('Binary 5')).not.toBeInTheDocument();
  rerender(<PolisAnswerSections {...props} binaryQuestionCount={5} />);
  expect(screen.queryByRole('button', { name: /View more/ })).not.toBeInTheDocument();
});
