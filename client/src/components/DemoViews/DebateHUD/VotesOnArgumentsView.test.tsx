import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import VotesOnArgumentsView from './VotesOnArgumentsView';

describe('VotesOnArgumentsView', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets the viewer vote and shows comparison details', () => {
    render(<VotesOnArgumentsView selectedDebateId={1} />);

    expect(screen.getByText('Cast Your Vote')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Condorcet/ }));

    expect(screen.getByText('How You Compare')).toBeInTheDocument();
    expect(screen.getByText('Your Voting Record')).toBeInTheDocument();
    expect(screen.getByText(/You voted for/)).toBeInTheDocument();
    expect(screen.getByText('Condorcet', { selector: 'strong' })).toBeInTheDocument();
  });
});
