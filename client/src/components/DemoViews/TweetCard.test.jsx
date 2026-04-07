import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import TweetCard from './TweetCard.jsx';

describe('TweetCard', () => {
  it('renders parsed author metadata and engagement metrics', () => {
    const onTagClick = jest.fn();
    const entry = {
      author: '@Gregory_C_Allen',
      created_at: '2025-03-07T15:57:45.000Z',
      engagement: {
        likes: 814,
        reposts: 223,
        views: 227787,
      },
      sentiment: 'analytical',
      tags: ['Open Source', 'Risk'],
      text: 'Please read the report and help spread the word!',
      url: 'https://example.com/post',
    };

    render(
      <MemoryRouter>
        <TweetCard entry={entry} onTagClick={onTagClick} />
      </MemoryRouter>
    );

    expect(screen.getByText('Gregory C Allen')).toBeInTheDocument();
    expect(screen.getByText('@Gregory_C_Allen')).toBeInTheDocument();
    expect(screen.getByText('Please read the report and help spread the word!')).toBeInTheDocument();
    expect(screen.getByText('814')).toBeInTheDocument();
    expect(screen.getByText('223')).toBeInTheDocument();
    expect(screen.getByText('227,787')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Source' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Risk' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View post' })).toHaveAttribute('href', 'https://example.com/post');

    fireEvent.click(screen.getByRole('button', { name: 'Risk' }));
    expect(onTagClick).toHaveBeenCalledWith('Risk');
  });
});
