import React from 'react';
import { render, screen } from '@testing-library/react';
import AppErrorBoundary from './AppErrorBoundary.jsx';
import RouteErrorBoundary from './RouteErrorBoundary.jsx';

const Thrower = () => {
  throw new Error('Kaboom');
};

describe('Error boundaries', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('renders the GitHub issue link in the app-wide fallback', () => {
    render(
      <AppErrorBoundary>
        <Thrower />
      </AppErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByTestId('ce-error-report-github')).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/issues/new'
    );
  });

  it('renders the GitHub issue link in the route-level fallback', () => {
    render(
      <RouteErrorBoundary>
        <Thrower />
      </RouteErrorBoundary>
    );

    expect(screen.getByText(/this section encountered an error/i)).toBeInTheDocument();
    expect(screen.getByTestId('ce-error-report-github')).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/issues/new'
    );
  });
});
