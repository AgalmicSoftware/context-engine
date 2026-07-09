import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SessionChipSelector from './SessionChipSelector';

const buildOptions = (labels: string[] = []) =>
  labels.map((label) => ({
    key: label,
    slug: label.toLowerCase(),
    label,
  }));

describe('SessionChipSelector', () => {
  it('collapses long lists behind a see-more toggle and expands on demand', () => {
    render(
      <SessionChipSelector options={buildOptions(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'])} collapsedLimit={3} />,
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.queryByText('Delta')).not.toBeInTheDocument();
    expect(screen.queryByText('Epsilon')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'See more (2 more)' }));

    expect(screen.getByText('Delta')).toBeInTheDocument();
    expect(screen.getByText('Epsilon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });

  it('does not render the see-more toggle when the list fits within the limit', () => {
    render(<SessionChipSelector options={buildOptions(['Alpha', 'Beta', 'Gamma'])} collapsedLimit={3} />);

    expect(screen.queryByRole('button', { name: /See more/i })).not.toBeInTheDocument();
  });
});
