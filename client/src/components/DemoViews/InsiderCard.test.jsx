import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import InsiderCard from './InsiderCard.jsx';

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
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'alignment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'scaling' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'scaling' }));
    expect(onTagClick).toHaveBeenCalledWith('scaling');
  });
});
