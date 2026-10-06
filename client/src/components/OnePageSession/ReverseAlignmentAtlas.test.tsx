import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ReverseAlignmentAtlas from './ReverseAlignmentAtlas';

it('browses all twelve source areas and follows editorial connections', () => {
  render(<ReverseAlignmentAtlas />);
  const map = screen.getByLabelText('Explore twelve focus areas');
  expect(map).toBe(screen.getByRole('group', { name: 'Explore twelve focus areas' }));
  const reading = screen.getByRole('article', { name: 'Selected focus area' });
  expect(within(map).getAllByRole('button')).toHaveLength(12);
  fireEvent.click(within(map).getByRole('button', { name: 'Privacy' }));
  expect(within(map).getByRole('button', { name: 'Privacy' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(reading).getByRole('heading', { name: 'Privacy' })).toBeVisible();
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
  expect(screen.getByRole('article')).toHaveTextContent('Communal sensemaking');
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
  fireEvent.click(previous);
  expect(screen.getByRole('article')).toHaveTextContent('Labor transition');
  fireEvent.click(next);
  expect(within(screen.getByRole('article')).getByRole('heading', { name: 'Identity' })).toBeVisible();
});
