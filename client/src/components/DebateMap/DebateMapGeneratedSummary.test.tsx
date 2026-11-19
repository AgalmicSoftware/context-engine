import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import DebateMapGeneratedSummary, { SUMMARY_LEAD_CHARS, shortenSummary } from './DebateMapGeneratedSummary';

const first = 'Seven of eight participants support assessing some schoolwork without AI to check learning.';
const second = `Views on whether AI reliance weakens thinking are more divided: ${'three agree, four are unsure, '.repeat(9)}and one disagrees.`;

describe('shortenSummary', () => {
  it('keeps a summary that fits a tweet', () => {
    expect(shortenSummary(` ${first} `)).toBe(first);
  });

  it('keeps the first sentences that fit', () => {
    expect(`${first} ${second}`.length).toBeGreaterThan(SUMMARY_LEAD_CHARS);
    expect(shortenSummary(`${first} ${second}`)).toBe(first);
  });

  it('always leads with the start of the summary, across decimals, abbreviations, quotes and brackets', () => {
    // A sentence too long to join any lead, so each lead ends where its case does.
    const rest = ` Others want ${'more local trials before anything changes, '.repeat(7)}in the end.`;
    const whole = [
      'Support rose 2.5 times among the eight participants who answered the second question.',
      'Asked what should come first, one participant who answered every question said "pilot it first."',
      'Most participants want the gains from AI shared widely through a public dividend (as one put it.)',
    ];
    for (const first of whole) {
      expect((first + rest).length).toBeGreaterThan(SUMMARY_LEAD_CHARS);
      expect(shortenSummary(first + rest)).toBe(first);
    }
    // An abbreviation ends no sentence, so a sentence running past the limit is cut at a word.
    for (const start of [
      'The participants who answered both questions mostly wanted firm limits on devices, e.g.',
      'The participants who answered both questions mostly pointed to the U.S.',
    ]) {
      const text = `${start} phones and laptops,${rest.slice(1, 200)}${rest}`;
      const lead = shortenSummary(text);
      expect(lead.endsWith('…')).toBe(true);
      expect(text.startsWith(lead.slice(0, -1))).toBe(true);
      expect(lead.length).toBeGreaterThan(start.length);
    }
  });

  it('prefers the first words to a very short first sentence', () => {
    const lead = shortenSummary(`They split. ${second}`);
    expect(lead.startsWith('They split. Views on whether')).toBe(true);
    expect(lead.endsWith('…')).toBe(true);
  });

  it('cuts a first sentence that is too long at a word', () => {
    expect(second.length).toBeGreaterThan(SUMMARY_LEAD_CHARS);
    const lead = shortenSummary(second);
    expect(lead.length).toBeLessThanOrEqual(SUMMARY_LEAD_CHARS);
    expect(lead.endsWith(' …')).toBe(false);
    expect(lead.endsWith('…')).toBe(true);
    expect(second.startsWith(lead.slice(0, -1))).toBe(true);
  });
});

it('leads with the short summary and shows every position without asking', () => {
  render(
    <DebateMapGeneratedSummary
      entries={[
        { id: 's', comment: `${first} ${second}` },
        { id: 'p1', label: 'Check learning', comment: 'Unsure about harms.', participantCount: 4, participantTotal: 8 },
        { id: 'p2', label: 'Reject restrictions', comment: '', participantCount: 1 },
      ]}
    />,
  );
  const section = screen.getByRole('region', { name: 'AI-generated summary' });
  expect(within(section).getByText(first)).toBeInTheDocument();

  // The positions are there from the start, in their own section with their number.
  const positions = screen.getByRole('region', { name: 'Positions' });
  expect(positions).toHaveTextContent(/^Positions 2/);
  const [held, alone] = within(positions).getAllByRole('listitem');
  expect(within(held).getByText('Check learning').tagName).toBe('STRONG');
  expect(held).toHaveTextContent('4 of 8 participants');
  expect(held).toHaveTextContent('Unsure about harms.');
  expect(held.querySelector('[aria-hidden="true"] span')).toHaveStyle({ width: '50%' });
  // Without a total there is no share to draw, only the count.
  expect(alone).toHaveTextContent('Reject restrictions1 participant');
  expect(alone.querySelector('[aria-hidden="true"]')).toBeNull();

  // The toggle opens and closes the rest of the summary only.
  const toggle = within(section).getByRole('button', { name: 'See more' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById(String(toggle.getAttribute('aria-controls')))).toBeInTheDocument();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(toggle).toHaveTextContent('See less');
  expect(within(section).getByText(`${first} ${second}`)).toBeInTheDocument();
  fireEvent.click(toggle);
  expect(within(section).getByText(first)).toBeInTheDocument();
  expect(within(positions).getAllByRole('listitem')).toHaveLength(2);
});

it('offers no toggle for a short summary, and shows positions that come without one', () => {
  render(
    <DebateMapGeneratedSummary
      entries={[
        { id: 's', comment: first },
        { id: 'p1', label: 'Check learning', comment: '', participantCount: 2, participantTotal: 4 },
      ]}
    />,
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Positions' })).toHaveTextContent('2 of 4 participants');
});

it('offers no toggle when the summary is short and there are no positions', () => {
  render(<DebateMapGeneratedSummary entries={[{ id: 's', comment: first }]} />);
  expect(screen.getByText(first)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
