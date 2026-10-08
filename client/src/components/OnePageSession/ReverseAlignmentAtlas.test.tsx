import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ReverseAlignmentAtlas from './ReverseAlignmentAtlas';

it('browses all twelve source areas and follows editorial connections', () => {
  render(<ReverseAlignmentAtlas />);
  const map = screen.getByLabelText('Explore twelve focus areas');
  expect(map).toBe(screen.getByRole('group', { name: 'Explore twelve focus areas' }));
  expect(within(map).getAllByRole('button')).toHaveLength(12);
  expect(screen.queryByRole('article', { name: 'Selected focus area' })).not.toBeInTheDocument();
  fireEvent.click(within(map).getByRole('button', { name: 'Privacy' }));
  const reading = screen.getByRole('article', { name: 'Selected focus area' });
  expect(screen.queryByRole('group', { name: 'Explore twelve focus areas' })).not.toBeInTheDocument();
  expect(within(reading).getByRole('heading', { name: 'Privacy' })).toBeVisible();
  expect(within(reading).getByRole('heading', { name: 'Privacy' })).toHaveFocus();
  fireEvent.click(within(reading).getByRole('button', { name: /Agentic collaboration/ }));
  expect(within(reading).getByRole('heading', { name: 'Agentic collaboration' })).toBeVisible();
  fireEvent.click(within(reading).getByRole('button', { name: 'Sources' }));
  expect(within(reading).getByRole('link', { name: /Read Reverse Alignment/ })).toHaveAttribute(
    'href',
    'https://reversealignment.ai/',
  );
  expect(reading).toHaveTextContent('editorial guide');
  expect(screen.queryByText('0 assigned')).not.toBeInTheDocument();
});

it('shows every focus area directly without a search field or closing promotional section', () => {
  render(<ReverseAlignmentAtlas />);
  const map = screen.getByLabelText('Explore twelve focus areas');
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.queryByText('12 focus areas. Many possible futures.')).not.toBeInTheDocument();
  expect(within(map).getAllByRole('button')).toHaveLength(12);
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

it('returns to the last viewed topic and resets the reading tab when opening another topic', () => {
  render(<ReverseAlignmentAtlas />);
  fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
  fireEvent.click(screen.getByRole('button', { name: /Agentic collaboration/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Sources' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to focus areas' }));

  expect(screen.queryByRole('article', { name: 'Selected focus area' })).not.toBeInTheDocument();
  const map = screen.getByRole('group', { name: 'Explore twelve focus areas' });
  expect(within(map).getAllByRole('button')).toHaveLength(12);
  expect(within(map).getByRole('button', { name: 'Agentic collaboration' })).toHaveFocus();

  fireEvent.click(within(map).getByRole('button', { name: 'Education' }));
  expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { name: 'Education' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Back to focus areas' }));
  expect(screen.getByRole('button', { name: 'Education' })).toHaveFocus();
});

it('wraps the guided navigation at each end of the atlas', () => {
  render(<ReverseAlignmentAtlas />);
  fireEvent.click(
    within(screen.getByLabelText('Explore twelve focus areas')).getByRole('button', { name: 'Identity' }),
  );
  const previous = screen.getByRole('button', { name: 'Previous focus area' });
  const next = screen.getByRole('button', { name: 'Next focus area' });
  expect(previous).toHaveTextContent(/^←$/);
  expect(next).toHaveTextContent(/^→$/);
  fireEvent.click(screen.getByRole('button', { name: 'Sources' }));
  fireEvent.click(previous);
  expect(screen.getByRole('article')).toHaveTextContent('Labor transition');
  expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(next);
  expect(within(screen.getByRole('article')).getByRole('heading', { name: 'Identity' })).toBeVisible();
});
