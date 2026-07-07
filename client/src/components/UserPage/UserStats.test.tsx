import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import UserStats from './UserStats';

describe('UserStats', () => {
  it('renders stats, expanded detail copy, and forwards collapse toggles', () => {
    const toggleCollapse = jest.fn();

    render(
      <UserStats
        userStats={{ mostUniqueIdea: 'Novel idea', surveysResponded: 3 }}
        collapseOpen="mostUniqueIdea"
        toggleCollapse={toggleCollapse}
      />,
    );

    expect(screen.getByText('Novel idea')).toBeInTheDocument();
    expect(screen.getByText('More details about the most unique idea...')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/MostUniqueIdea:/));

    expect(toggleCollapse).toHaveBeenCalledWith('mostUniqueIdea');
  });
});
