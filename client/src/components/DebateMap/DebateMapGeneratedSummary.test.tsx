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

it('leads with the short summary and lists the positions on request', () => {
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
  expect(within(section).queryByText('Check learning')).not.toBeInTheDocument();

  const toggle = within(section).getByRole('button', { name: 'Show more' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById(String(toggle.getAttribute('aria-controls')))).toBeInTheDocument();
  fireEvent.click(toggle);

  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(toggle).toHaveTextContent('Show less');
  expect(within(section).getByText(`${first} ${second}`)).toBeInTheDocument();
  const [held, alone] = within(section).getAllByRole('listitem');
  expect(within(held).getByText('Check learning').tagName).toBe('STRONG');
  expect(held).toHaveTextContent('4 of 8 participants');
  expect(held).toHaveTextContent('Unsure about harms.');
  expect(held.querySelector('[aria-hidden="true"] span')).toHaveStyle({ width: '50%' });
  // Without a total there is no share to draw, only the count.
  expect(alone).toHaveTextContent('Reject restrictions1 participant');
  expect(alone.querySelector('[aria-hidden="true"]')).toBeNull();

  fireEvent.click(toggle);
  expect(within(section).getByText(first)).toBeInTheDocument();
  expect(within(section).queryAllByRole('listitem')).toHaveLength(0);
});

it('offers no toggle when the summary is short and there are no positions', () => {
  render(<DebateMapGeneratedSummary entries={[{ id: 's', comment: first }]} />);
  expect(screen.getByText(first)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
