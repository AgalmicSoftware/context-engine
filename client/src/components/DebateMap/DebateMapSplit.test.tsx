import React from 'react';
import { render, screen, within } from '@testing-library/react';

import DebateMapSplit from './DebateMapSplit';

it('sets the two ends of the axis side by side under their own names, with who holds each position', () => {
  render(
    <DebateMapSplit
      split={{
        axis: 'Pace',
        left: {
          label: 'Slow',
          positions: [{ id: 'l1', label: 'Wait', comment: 'Care first.', participantCount: 4, participantTotal: 10 }],
        },
        right: {
          label: 'Fast',
          positions: [
            { id: 'r1', label: 'Go', comment: 'Move now.', participantCount: 5, participantTotal: 10 },
            { id: 'r2', label: 'Go further', comment: '', participantCount: 1 },
          ],
        },
      }}
    />,
  );
  const section = screen.getByRole('region', { name: 'Where people split' });
  expect(within(section).getByText('Pace')).toBeInTheDocument();
  const [slow, fast] = within(section).getAllByRole('heading', { level: 4 });
  expect(slow).toHaveTextContent('Slow');
  expect(fast).toHaveTextContent('Fast');
  // The ends are the axis's own words, not a verdict for or against the node's title.
  expect(section).not.toHaveTextContent(/\bFor\b|\bAgainst\b/);
  const rows = within(section).getAllByRole('listitem');
  expect(rows.map((row) => row.textContent)).toEqual([
    // The reasoning stays in the Positions list above; here only who stands where.
    'Wait4 of 10 participants',
    'Go5 of 10 participants',
    'Go further1 participant',
  ]);
});
