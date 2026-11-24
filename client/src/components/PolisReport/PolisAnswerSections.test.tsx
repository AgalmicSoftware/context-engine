import React from 'react';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import PolisAnswerSections, { foldedLine, mostChosenLine, writtenAnswerPreview } from './PolisAnswerSections';
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
  // Section header, Open all for the questions now showing, and one expansion control.
  expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
    '▾Freeform',
    'Open all',
    'View less',
  ]);
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

// Options in the question's order made the most chosen hard to find in a long list.
it('lists multiple choice options most chosen first, for Pick one and Pick any, ties in the question\u2019s order', () => {
  const picks = (values: unknown[]) =>
    values.map((value, index) => ({ responder: `p${index}`, response: { type: 'multichoice', answer: { value } } }));
  const options = ['Garden', 'Bus', 'Paths', 'Library'];
  const ranked = buildReportAnswerQuestions(
    {
      one: picks(['Paths', 'Library', 'Paths', 'Bus', 'Library', 'Paths', 'Garden']),
      any: picks([['Library'], ['Library', 'Garden'], ['Paths', 'Library'], ['Garden', 'Bus']]),
    },
    {
      one: { type: 'multichoice', prompt: 'One only', options, singleSelect: true },
      any: { type: 'multichoice', prompt: 'Several', options },
    },
  );
  render(<PolisAnswerSections questions={ranked} pdfMode />);
  const [one, any] = screen.getAllByRole('list', { name: 'Multiple choice results' }).map((list) =>
    within(list)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  );
  // Ties keep the question's order: Garden before Bus, then Bus before Paths.
  expect(one).toEqual(['Paths3/7', 'Library2/7', 'Garden1/7', 'Bus1/7']);
  expect(any).toEqual(['Library3/4', 'Garden2/4', 'Bus1/4', 'Paths1/4']);
  // Only the display is sorted: the summaries keep the question's order.
  ranked.forEach((question) => expect(question.options.map((option) => option.label)).toEqual(options));
});

// A long list of questions took a lot of scrolling: each kind now folds to one line, in one shared way.
it('folds every kind of question to its prompt and a line of its answer, and opens it on request', () => {
  const picks = (values: unknown[]) =>
    values.map((value, index) => ({ responder: `p${index}`, response: { type: 'multichoice', answer: { value } } }));
  const folded = buildReportAnswerQuestions(
    {
      poll: picks(['Bus', 'Garden', 'Bus']),
      rated: [{ responder: 'a', response: { type: 'rating', answer: { value: 3 } } }],
      wrote: [{ responder: 'a', response: { type: 'freeform', answer: { value: 'More benches by the river' } } }],
      split: [{ responder: 'a', response: { type: 'quadratic', answer: { value: [4, -1] } } }],
    },
    {
      poll: { type: 'multichoice', prompt: 'How do you travel?', options: ['Garden', 'Bus'], singleSelect: true },
      rated: { type: 'rating', prompt: 'How was it?' },
      wrote: { type: 'freeform', prompt: 'What would help?' },
      split: { type: 'quadratic', prompt: 'Projects', options: ['Garden', 'Bus'] },
    },
  );
  render(
    <PolisAnswerSections
      questions={folded}
      openSections={{ multichoice: true, rating: true, freeform: true, quadratic: true }}
    />,
  );
  const summaries = Object.fromEntries(
    ['multichoice', 'rating', 'freeform', 'quadratic'].map((type) => {
      const details = screen.getByTestId(`ce-polis-answers-${type}`).querySelector('details') as HTMLDetailsElement;
      expect(details.open).toBe(false);
      return [type, details.querySelector('summary')?.textContent];
    }),
  );
  expect(summaries).toEqual({
    multichoice: 'How do you travel?Pick one3 responsesMost chosen: Bus · 2/3',
    rating: 'How was it?1 responseAverage 3.0 / 10',
    freeform: 'What would help?1 response“More benches by the river”',
    quadratic: 'Projects1 responseHighest net: Garden · +4',
  });
  const details = screen.getByTestId('ce-polis-answers-multichoice').querySelector('details') as HTMLDetailsElement;
  fireEvent.click(details.querySelector('summary') as HTMLElement);
  expect(details.open).toBe(true);
  expect(
    within(details)
      .getAllByRole('listitem')
      .map((row) => row.textContent),
  ).toEqual(['Bus2/3', 'Garden1/3']);
});

it('opens and folds every question showing in a section at once', async () => {
  const many = buildReportAnswerQuestions(
    Object.fromEntries(
      ['One', 'Two', 'Three'].map((prompt) => [
        prompt,
        [{ responder: 'a', response: { type: 'rating', prompt, answer: { value: 5 } } }],
      ]),
    ),
  );
  render(<PolisAnswerSections questions={many} openSections={{ rating: true }} />);
  const section = screen.getByTestId('ce-polis-answers-rating');
  // One question in the preview needs no such control.
  expect(within(section).queryByRole('button', { name: 'Open all' })).not.toBeInTheDocument();
  fireEvent.click(within(section).getByRole('button', { name: 'View more (2)' }));
  const folds = () => [...section.querySelectorAll('details')].map((details) => details.open);
  expect(folds()).toEqual([false, false, false]);
  fireEvent.click(within(section).getByRole('button', { name: 'Open all' }));
  expect(folds()).toEqual([true, true, true]);
  fireEvent.click(within(section).getByRole('button', { name: 'Fold all' }));
  expect(folds()).toEqual([false, false, false]);
  // Questions opened from their own lines count too: with all three open, the control folds them.
  for (const summary of section.querySelectorAll('summary')) {
    fireEvent.click(summary);
    // The browser says a details element opened on a later task.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
  expect(folds()).toEqual([true, true, true]);
  fireEvent.click(within(section).getByRole('button', { name: 'Fold all' }));
  expect(folds()).toEqual([false, false, false]);
});

it('shortens a long first written answer on its folded line at a word', () => {
  const [long] = buildReportAnswerQuestions({
    wrote: [
      {
        responder: 'a',
        response: { type: 'freeform', prompt: 'Long', answer: { value: `${'word '.repeat(30)}end` } },
      },
    ],
  });
  const line = foldedLine(long);
  expect(line).toMatch(/^“(word )+word…”$/);
  expect(line.length).toBeLessThanOrEqual(93);
  expect(foldedLine({ ...long, texts: [] })).toBe('No written answers');
});

it('names every option tied for most chosen, and says when none was', () => {
  const [tied] = buildReportAnswerQuestions(
    {
      tied: ['a', 'b'].map((responder) => ({
        responder,
        response: { type: 'multichoice', answer: { value: ['Bus', 'Garden'] } },
      })),
    },
    { tied: { type: 'multichoice', prompt: 'Tied', options: ['Garden', 'Bus', 'Paths'] } },
  );
  expect(mostChosenLine(tied)).toBe('Most chosen: Garden, Bus · 2/2 each');
  const none = { ...tied, options: tied.options.map((option) => ({ ...option, count: 0 })) };
  expect(mostChosenLine(none)).toBe('No option chosen');
});

it('shows every question open in the export', () => {
  render(<PolisAnswerSections questions={questions} pdfMode />);
  const folds = [...screen.getByTestId('ce-polis-answer-sections').querySelectorAll('details')];
  expect(folds).toHaveLength(3);
  folds.forEach((details) => expect(details.open).toBe(true));
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
      capped: [{ responder: 'a', response: { type: 'multichoice', prompt: 'Capped', answer: { value: 'Bus' } } }],
      votes: [{ responder: 'a', response: { type: 'quadratic', prompt: 'Votes', answer: { value: [-2, 1, 3] } } }],
    },
    {
      one: { type: 'multichoice', options: ['Garden', 'Bus'], singleSelect: true },
      any: { type: 'multichoice', options: ['Garden', 'Bus'] },
      // A limit of one is one pick too, flag or no flag, and whether stored as a number or as text.
      capped: { type: 'multichoice', options: ['Garden', 'Bus'], maxSelections: '1' },
      votes: { type: 'quadratic', options: ['Low', 'Mid', 'High'], voiceCredits: 99 },
    },
  );
  expect(Object.fromEntries(kinds.map((question) => [question.prompt, question.choiceKind]))).toEqual({
    'One only': choiceKindLabel(true),
    Several: choiceKindLabel(false),
    Capped: choiceKindLabel(true),
    Votes: '',
  });
  render(<PolisAnswerSections questions={kinds} pdfMode />);
  expect(screen.getByRole('heading', { name: 'One only Pick one' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Several Pick any' })).toBeInTheDocument();
  const rows = within(screen.getByRole('list', { name: 'Quadratic allocation results' })).getAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual(['High0+3+3', 'Mid0+1+1', 'Low−20−2']);
});
