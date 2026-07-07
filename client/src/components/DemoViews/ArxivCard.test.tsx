import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';

import ArxivCard from './ArxivCard';

describe('ArxivCard', () => {
  it('renders arxiv-specific metadata, tags, and source link', () => {
    const onTagClick = jest.fn();
    const entry = {
      authors: ['Dario Amodei', 'Chris Olah', 'Tom Brown'],
      category: 'cs.AI',
      date: '2024-03-15',
      summary: 'A compact test summary for the arXiv listing card.',
      tags: ['alignment', 'mechanistic interpretability'],
      title: 'Toward Interpretable Safety Cases',
      url: 'https://arxiv.org/abs/2403.12345',
    };

    render(
      <MemoryRouter>
        <ArxivCard entry={entry} onTagClick={onTagClick} />
      </MemoryRouter>,
    );

    expect(screen.getByText('arXiv:2403.12345')).toBeInTheDocument();
    expect(screen.getByText('cs.AI')).toBeInTheDocument();
    expect(screen.getByText('Toward Interpretable Safety Cases')).toBeInTheDocument();
    expect(screen.getByText('Authors:')).toBeInTheDocument();
    expect(screen.getByText('Dario Amodei, Chris Olah, Tom Brown')).toBeInTheDocument();
    expect(screen.getByText('Submitted 15 Mar 2024')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'alignment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'mechanistic interpretability' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View paper' })).toHaveAttribute(
      'href',
      'https://arxiv.org/abs/2403.12345',
    );

    fireEvent.click(screen.getByRole('button', { name: 'alignment' }));
    expect(onTagClick).toHaveBeenCalledWith('alignment');
  });
});
