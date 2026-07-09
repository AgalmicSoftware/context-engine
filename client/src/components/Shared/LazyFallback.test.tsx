import React from 'react';
import { render, screen } from '@testing-library/react';

import LazyFallback from './LazyFallback';

describe('LazyFallback', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the loading label and optional subtext', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<LazyFallback label="Loading Atlas..." subtext="Preparing map data" />);

    expect(screen.getByText('Loading Atlas...')).toBeInTheDocument();
    expect(screen.getByText('Preparing map data')).toBeInTheDocument();
    expect(
      consoleError.mock.calls.some((args) =>
        args.some((arg) => String(arg).includes('FontAwesomeIcon: Support for defaultProps will be removed')),
      ),
    ).toBe(false);
  });

  it('omits label and subtext when empty', () => {
    const { container } = render(<LazyFallback label="" subtext="" />);

    expect(container).not.toHaveTextContent('Loading...');
  });
});
