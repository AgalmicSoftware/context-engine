import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';

import InsiderCard from './InsiderCard';

describe('InsiderCard', () => {
  it('renders tag pills as buttons and forwards tag clicks', () => {
    const onTagClick = jest.fn();
    const entry = {
      author: 'Dario Amodei',
      id: 'amodei_dario_dwarkesh_2023_scaling',
      interviewer: 'Dwarkesh Patel',
      summary: 'A short test summary.',
      tags: ['alignment', 'scaling'],
      top_quotes: ['Powerful systems require careful safety work.'],
      url: 'https://example.com/interview',
    };

    render(
      <MemoryRouter>
        <InsiderCard entry={entry} onTagClick={onTagClick} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'alignment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'scaling' })).toBeInTheDocument();
    expect(screen.getByText('A short test summary.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View interview' })).toHaveAttribute(
      'href',
      'https://example.com/interview',
    );

    fireEvent.click(screen.getByRole('button', { name: 'scaling' }));
    expect(onTagClick).toHaveBeenCalledWith('scaling');
  });

  it('truncates long summaries to a preview until expanded', () => {
    const longSummary = `${'A'.repeat(300)} This sentence should only appear after expansion.`;

    render(
      <MemoryRouter>
        <InsiderCard
          entry={{
            author: 'Demis Hassabis',
            summary: longSummary,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();
    expect(screen.queryByText(/This sentence should only appear after expansion\./)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

    expect(screen.getByText(longSummary)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument();
  });
});
