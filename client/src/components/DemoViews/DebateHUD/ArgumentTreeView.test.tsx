import React from 'react';
import { render, screen } from '@testing-library/react';

import ArgumentTreeView from './ArgumentTreeView';

describe('ArgumentTreeView', () => {
  it('renders the selected debate point and counterpoint columns', () => {
    render(<ArgumentTreeView selectedDebateId={1} />);

    expect(screen.getByText('Condorcet')).toBeInTheDocument();
    expect(screen.getByText('David Hume')).toBeInTheDocument();
    expect(screen.getByText('Position')).toBeInTheDocument();
    expect(screen.getByText('Counter-Position')).toBeInTheDocument();
    expect(screen.getByText(/Click to expand point \/ counterpoint/i)).toBeInTheDocument();
  });
});
