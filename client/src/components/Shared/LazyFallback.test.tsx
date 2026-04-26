import React from 'react';
import { render, screen } from '@testing-library/react';

import LazyFallback from './LazyFallback';

describe('LazyFallback', () => {
  it('renders the loading label and optional subtext', () => {
    render(<LazyFallback label="Loading Atlas..." subtext="Preparing map data" />);

    expect(screen.getByText('Loading Atlas...')).toBeInTheDocument();
    expect(screen.getByText('Preparing map data')).toBeInTheDocument();
  });

  it('omits label and subtext when empty', () => {
    const { container } = render(<LazyFallback label="" subtext="" />);

    expect(container).not.toHaveTextContent('Loading...');
  });
});
