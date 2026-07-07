import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';

import TweetCard from './TweetCard';

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
      </MemoryRouter>,
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
    expect(screen.queryByText('No linked atlas issues yet.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Risk' }));
    expect(onTagClick).toHaveBeenCalledWith('Risk');
  });

  it('truncates long tweet text until expanded', () => {
    const longText = `${'A'.repeat(280)} This trailing sentence only appears after expansion.`;

    render(
      <MemoryRouter>
        <TweetCard
          entry={{
            author: 'longform',
            text: longText,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
    expect(screen.queryByText(/This trailing sentence only appears after expansion\./)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));

    expect(screen.getByText(longText)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });
});
