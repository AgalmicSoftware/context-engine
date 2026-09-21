import React from 'react';
import { render, screen } from '@testing-library/react';
import QuadraticAllocationResponse from './QuadraticAllocationResponse';

it('shows named signed votes as diverging bars without credit details', () => {
  render(<QuadraticAllocationResponse value={[4, -5, 0]} question={{ options: ['Parks', 'Transit', 'Housing'] }} />);
  expect(screen.getByText('Parks')).toBeInTheDocument();
  expect(screen.getByText('+4')).toBeInTheDocument();
  expect(screen.getByText('−5')).toBeInTheDocument();
  expect(screen.queryByText(/credits/i)).not.toBeInTheDocument();
  const bars = screen
    .getAllByRole('definition')
    .map((row) => row.querySelector('[aria-hidden="true"] span') as HTMLElement);
  expect(bars[0].style.left).toBe('50%');
  expect(parseFloat(bars[0].style.width)).toBeCloseTo((4 / 9) * 50);
  expect(parseFloat(bars[1].style.left)).toBeCloseTo(50 - (5 / 9) * 50);
  expect(parseFloat(bars[1].style.width)).toBeCloseTo((5 / 9) * 50);
  expect(bars[2].style.width).toBe('0%');
});

it('uses a custom budget and renders all-neutral answers', () => {
  const { rerender } = render(
    <QuadraticAllocationResponse value={[0, 0]} question={{ options: ['Parks', 'Transit'], voiceCredits: 25 }} />,
  );
  expect(screen.getAllByText('0')).toHaveLength(2);
  rerender(
    <QuadraticAllocationResponse value={[3, -4]} question={{ options: ['Parks', 'Transit'], voiceCredits: 25 }} />,
  );
  const bars = screen
    .getAllByRole('definition')
    .map((row) => row.querySelector('[aria-hidden="true"] span') as HTMLElement);
  expect(bars[0]).toHaveStyle({ left: '50%', width: '30%' });
  expect(bars[1]).toHaveStyle({ left: '10%', width: '40%' });
});

it.each(['*', [4, -5], [1.5, 0]])('does not draw misleading bars for invalid or masked answers: %j', (value) => {
  render(<QuadraticAllocationResponse value={value} question={{ options: ['Parks', 'Transit'], voiceCredits: 25 }} />);
  expect(screen.getByText('Allocation unavailable.')).toBeInTheDocument();
  expect(screen.queryByTestId('ce-quadratic-response')).not.toBeInTheDocument();
});
