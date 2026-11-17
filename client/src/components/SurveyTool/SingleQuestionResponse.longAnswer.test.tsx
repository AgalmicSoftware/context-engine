import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SingleQuestionResponse from './SingleQuestionResponse';

const START = 'A city-run citizens assembly chosen by lottery should advise on one concrete decision each year,';
const TAIL = 'and publish what the council did with its advice so residents can judge the result for themselves.';
const LONG_ANSWER = `${START} ${TAIL}`;

const renderRow = (props: Record<string, unknown> = {}) =>
  render(
    <SingleQuestionResponse
      network={{ id: 84532 }}
      questionsCacheNonce={1}
      questionResponsesNonce={1}
      sessionSlug="edge"
      mode="mini"
      shortenAnswerAt={100}
      question={{ prompt: 'What should your community try first?', type: 'freeform' }}
      response={{
        answer: { value: LONG_ANSWER, encrypted: false },
        additional: { value: 'A comment kept with the answer.', encrypted: false },
      }}
      {...props}
    />,
  );

describe('a long free-text answer in a mini row', () => {
  it('shows its start, and all of it in place once Show more is pressed', () => {
    const { container } = renderRow();

    const toggle = screen.getByRole('button', { name: 'Show more' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const answer = container.querySelector(`#${toggle.getAttribute('aria-controls')}`);
    expect(answer?.textContent).toMatch(/…$/);
    expect(answer?.textContent?.length).toBeLessThanOrEqual(101);
    expect(LONG_ANSWER.startsWith(String(answer?.textContent).slice(0, -1))).toBe(true);
    // Closed, the rest of the answer is not in the page at all.
    expect(container.textContent).not.toContain(TAIL);

    toggle.focus();
    fireEvent.click(toggle);

    const opened = screen.getByRole('button', { name: 'Show less' });
    expect(opened).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector(`#${opened.getAttribute('aria-controls')}`)?.textContent).toBe(LONG_ANSWER);
    expect(screen.getByText('A comment kept with the answer.')).toBeInTheDocument();
    // The keyboard stays on the button though it has moved to the opened row.
    expect(opened).toHaveFocus();

    fireEvent.click(opened);

    const closed = screen.getByRole('button', { name: 'Show more' });
    expect(closed).toHaveFocus();
    expect(container.textContent).not.toContain(TAIL);

    // Only its own press moves the keyboard: the chevron, pressed later, leaves focus where it is.
    closed.blur();
    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));
    expect(screen.getByRole('button', { name: 'Show less' })).not.toHaveFocus();
  });

  it('opens with the row’s own expand control too, which says what it does', () => {
    const { container } = renderRow();

    const chevron = screen.getByRole('button', { name: 'Open details' });
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chevron);

    expect(screen.getByRole('button', { name: 'Close details' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
    expect(container.textContent).toContain(TAIL);
    // The chevron did not ask for the keyboard to move.
    expect(screen.getByRole('button', { name: 'Show less' })).not.toHaveFocus();
  });

  it('gives each row its own answer id', () => {
    renderRow();
    renderRow();
    const ids = screen
      .getAllByRole('button', { name: 'Show more' })
      .map((button) => button.getAttribute('aria-controls'));
    expect(new Set(ids).size).toBe(2);
  });

  it.each([
    [
      'a short answer',
      { response: { answer: { value: 'Start small and local.', encrypted: false } } },
      'Start small and local.',
    ],
    ['a row not asked to shorten', { shortenAnswerAt: undefined }, LONG_ANSWER],
    ['a full-page answer', { mode: 'fullscreen' }, LONG_ANSWER],
  ])('leaves %s whole, with no Show more', (_label, props, shown) => {
    const { container } = renderRow(props);

    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    expect(container.textContent).toContain(shown);
  });

  it('sits at the end of the answer, inside its box', () => {
    renderRow();

    const toggle = screen.getByRole('button', { name: 'Show more' });
    const answer = document.getElementById(String(toggle.getAttribute('aria-controls')));
    expect(answer).toHaveAttribute('dir', 'auto');
    expect(answer?.parentElement).toBe(toggle.parentElement);
    expect(answer?.nextElementSibling).toBe(toggle);
  });

  it.each([[undefined], ['text'], ['Freeform']])(
    'treats a question of type %p as free text, as the row does',
    (type) => {
      renderRow({ question: { prompt: 'An older question', type } });

      expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
    },
  );

  it('draws a free-text value that is not text as it did, whole', () => {
    const { container } = renderRow({ response: { answer: { value: { note: LONG_ANSWER }, encrypted: false } } });

    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    expect(container.textContent).toContain(JSON.stringify({ note: LONG_ANSWER }));
  });

  it('shortens only free text', () => {
    const { container } = renderRow({
      question: { prompt: 'Pick one', type: 'multichoice', options: [LONG_ANSWER, 'Another option'] },
      response: { answer: { value: LONG_ANSWER, encrypted: false } },
    });

    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    expect(container.textContent).toContain(TAIL);
  });

  it.each([
    ['an answer it cannot read', {}, { answer: { value: '*', encrypted: true } }],
    [
      'an answer shown masked with its hidden prompt',
      { prompt: '[encrypted]' },
      { answer: { value: LONG_ANSWER, encrypted: false } },
    ],
  ])('offers nothing to open on %s', (_label, question, response) => {
    const { container } = renderRow({ question: { prompt: 'Hidden?', type: 'freeform', ...question }, response });

    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    expect(container.textContent).not.toContain(START);
  });
});
