import React from 'react';
import { render, screen } from '@testing-library/react';

import {
  SbtListSectionLoadingHint,
  SbtListSectionTitle,
} from './SbtListSectionChrome';

describe('SbtListSectionChrome', () => {
  it('renders section titles with optional corner spinners', () => {
    const { rerender } = render(
      <SbtListSectionTitle label="Live" showSpinner={false} spinnerId="spinner-live" />
    );

    expect(screen.getByRole('heading', { name: 'Live' })).toBeInTheDocument();
    expect(screen.queryByTestId('spinner-live')).not.toBeInTheDocument();

    rerender(<SbtListSectionTitle label="Live" showSpinner spinnerId="spinner-live" />);

    expect(screen.getByTestId('spinner-live')).toBeInTheDocument();
  });

  it('renders block progress only outside all-sessions mode', () => {
    const { rerender } = render(
      <SbtListSectionLoadingHint allSessionsMode={false} blocksLeft={42} />
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.getByText('Blocks left: 42')).toBeInTheDocument();

    rerender(<SbtListSectionLoadingHint allSessionsMode blocksLeft={42} />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Blocks left: 42')).not.toBeInTheDocument();
  });
});
