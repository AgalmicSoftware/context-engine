import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PolisAnswerSections, { writtenAnswerPreview } from './PolisAnswerSections';
import { buildReportAnswerQuestions } from './polisReportAnswers';
import { choiceKindLabel } from '../SurveyTool/MultichoiceQuestionInput';

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
  expect(rows.map((row) => row.textContent)).toEqual(['Garden2/3', 'Bus1/3', 'Paths0/3']);
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

const longAnswer = `${'A sentence of ordinary length about the street outside. '.repeat(12)}The end.`;
const longWritten = buildReportAnswerQuestions({
  text1: [longAnswer, 'A short answer'].map((value, index) => ({
    responder: `person-${index}`,
    response: { type: 'freeform', prompt: 'One long answer beside a short one', answer: { value } },
  })),
});

it('shows the start of a long written answer, cut at a word, with a See more that opens and closes it', () => {
  render(<PolisAnswerSections questions={longWritten} />);
  fireEvent.click(screen.getByRole('button', { name: 'Freeform' }));
  const preview = writtenAnswerPreview(longAnswer) as string;
  expect(preview.length).toBeLessThanOrEqual(301);
  expect(preview.endsWith('…')).toBe(true);
  // Cut at a word: what is shown is whole words of the answer.
  expect(longAnswer.startsWith(preview.slice(0, -1))).toBe(true);
  expect(/\s/.test(longAnswer[preview.length - 1])).toBe(true);
  expect(screen.getByText(preview)).toBeInTheDocument();
  expect(screen.queryByText(longAnswer)).not.toBeInTheDocument();
  // The short answer has no control, and each answer sits in its own block.
  const more = screen.getByRole('button', { name: 'See more' });
  expect(screen.getAllByRole('button', { name: /See (more|less)/ })).toHaveLength(1);
  expect(screen.getByText('A short answer').parentElement).not.toBe(screen.getByText(preview).parentElement);
  expect(more).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById(more.getAttribute('aria-controls') as string)).toHaveTextContent(preview);
  fireEvent.click(more);
  expect(screen.getByText(longAnswer.trim(), { normalizer: (text) => text.trim() })).toBeInTheDocument();
  const less = screen.getByRole('button', { name: 'See less' });
  expect(less).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(less);
  expect(screen.getByText(preview)).toBeInTheDocument();
});

it('shows every written answer whole in the export', () => {
  render(<PolisAnswerSections questions={longWritten} pdfMode />);
  expect(screen.getByText(longAnswer.trim(), { normalizer: (text) => text.trim() })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /See (more|less)/ })).not.toBeInTheDocument();
});

it('leaves an answer of 300 characters whole and cuts a long run without spaces at the limit', () => {
  expect(writtenAnswerPreview('x'.repeat(300))).toBeNull();
  expect(writtenAnswerPreview('x'.repeat(400))).toBe(`${'x'.repeat(300)}…`);
  // A little over the limit is shown whole; an emoji at the cut is not split in two.
  expect(writtenAnswerPreview(`${'word '.repeat(60)}and a few more words.`)).toBeNull();
  expect(writtenAnswerPreview(`${'x'.repeat(299)}😀${'x'.repeat(200)}`)).toBe(`${'x'.repeat(299)}…`);
});

it('marks a multiple choice question Pick one or Pick any, in the pile\u2019s words, and ranks quadratic options by net', () => {
  const kinds = buildReportAnswerQuestions(
    {
      one: [{ responder: 'a', response: { type: 'multichoice', prompt: 'One only', answer: { value: 'Garden' } } }],
      any: [{ responder: 'a', response: { type: 'multichoice', prompt: 'Several', answer: { value: ['Bus'] } } }],
      votes: [{ responder: 'a', response: { type: 'quadratic', prompt: 'Votes', answer: { value: [-2, 1, 3] } } }],
    },
    {
      one: { type: 'multichoice', options: ['Garden', 'Bus'], singleSelect: true },
      any: { type: 'multichoice', options: ['Garden', 'Bus'] },
      votes: { type: 'quadratic', options: ['Low', 'Mid', 'High'], voiceCredits: 99 },
    },
  );
  expect(Object.fromEntries(kinds.map((question) => [question.prompt, question.choiceKind]))).toEqual({
    'One only': choiceKindLabel(true),
    Several: choiceKindLabel(false),
    Votes: '',
  });
  render(<PolisAnswerSections questions={kinds} pdfMode />);
  expect(screen.getByRole('heading', { name: 'One only Pick one' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Several Pick any' })).toBeInTheDocument();
  const rows = within(screen.getByRole('list', { name: 'Quadratic allocation results' })).getAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual(['High0+3+3', 'Mid0+1+1', 'Low−20−2']);
});
