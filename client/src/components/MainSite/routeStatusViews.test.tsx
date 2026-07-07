import React from 'react';
import { render, screen } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { NotFoundRoute, readHashQueryParam, SessionLoadingSkeleton } from './routeStatusViews';

describe('routeStatusViews', () => {
  it('reads query params from hash values', () => {
    expect(readHashQueryParam('#session=edge&key=abc', 'key')).toBe('abc');
    expect(readHashQueryParam('session=edge', 'missing')).toBe('');
    expect(readHashQueryParam('#session=edge', '')).toBe('');
  });

  it('renders the not-found route status page with the path', () => {
    render(<NotFoundRoute path="/missing" />);

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText('Path: /missing')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });

  it('renders the session loading skeleton status sections', () => {
    render(<SessionLoadingSkeleton statusTitle="Resolving" statusDetail="Checking chain" />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Resolving')).toBeInTheDocument();
    expect(screen.getByText('Checking chain')).toBeInTheDocument();
    expect(screen.getAllByTestId(`${E2E_TESTIDS.SESSION_LOADING_SKELETON}-section`)).toHaveLength(3);
  });
});
