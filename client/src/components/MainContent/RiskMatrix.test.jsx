import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import RiskMatrix from './RiskMatrix.jsx';

describe('RiskMatrix', () => {
  it('adds the embedded wrapper modifier only when embedded mode is enabled', () => {
    const { container, rerender } = render(<RiskMatrix />);

    expect(container.firstChild).toHaveClass('container');
    expect(container.firstChild).not.toHaveClass('embedded');

    rerender(<RiskMatrix embedded={true} />);

    expect(container.firstChild).toHaveClass('container');
    expect(container.firstChild).toHaveClass('embedded');
  });

  it('renders populated seeded cells and opens aggregated top-level notes', () => {
    render(<RiskMatrix />);

    expect(screen.getByRole('heading', { name: 'Risk Matrix' })).toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-legend-opportunity')).toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-legend-risk')).toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-cell-capabilities-vs-labor')).toHaveTextContent('+2');

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-capabilities-vs-labor'));

    expect(screen.getByTestId('ce-risk-matrix-modal')).toBeInTheDocument();
    expect(screen.getByText('Interaction: Capabilities vs Labor')).toBeInTheDocument();
    expect(
      screen.getByText(
        'AI-driven productivity gains could reshape knowledge work within 2 years. Early adopters may compress reporting, research, and drafting cycles.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId('ce-risk-matrix-aggregate-note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-risk-matrix-comment-input')).not.toBeInTheDocument();
  });

  it('renders the crypto category and opens seeded crypto aggregate notes', () => {
    render(<RiskMatrix />);

    expect(screen.getByTestId('ce-risk-matrix-header-x-crypto')).toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-header-y-crypto')).toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-cell-crypto-vs-governance')).toHaveTextContent(/^\+\d+$/);

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-crypto-vs-governance'));

    expect(screen.getByText('Interaction: Crypto vs Governance')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Elinor Ostrom: Durable rules reduce friction when cooperation does not rely on a single referee. Trustless agreements reduce need for enforcement bureaucracy.'
      )
    ).toBeInTheDocument();
  });

  it('reveals the subgrid and rebalances a subcell after saving a new comment', () => {
    render(<RiskMatrix />);

    fireEvent.click(screen.getByTestId('ce-risk-matrix-header-x-capabilities'));
    fireEvent.click(screen.getByTestId('ce-risk-matrix-header-y-labor'));

    expect(screen.getByTestId('ce-risk-matrix-subgrid')).toBeInTheDocument();

    const subcellTestId = 'ce-risk-matrix-subcell-capabilities-reasoning-vs-labor-productivity';
    expect(screen.getByTestId(subcellTestId)).toHaveTextContent('+2');

    fireEvent.click(screen.getByTestId(subcellTestId));
    fireEvent.change(screen.getByTestId('ce-risk-matrix-comment-input'), {
      target: {
        value: 'Deskilling pressure can surface before firms or governments fund credible retraining pathways.',
      },
    });
    fireEvent.click(screen.getByLabelText('Risk'));
    fireEvent.change(screen.getByTestId('ce-risk-matrix-intensity-input'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByTestId('ce-risk-matrix-save-comment'));

    expect(
      screen.getByText('Deskilling pressure can surface before firms or governments fund credible retraining pathways.')
    ).toBeInTheDocument();
    expect(screen.getByTestId(subcellTestId)).toHaveTextContent('-1');
  });
});
