import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ReverseAlignmentAtlas from './ReverseAlignmentAtlas';

it('browses all twelve source areas and follows editorial connections', () => {
  render(<ReverseAlignmentAtlas />);
  const map = screen.getByLabelText('Explore twelve focus areas');
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

it('filters topics without changing the reading selection and can recover from an empty search', () => {
  render(<ReverseAlignmentAtlas />);
  const search = screen.getByRole('searchbox', { name: 'Find a focus area' });
  const map = screen.getByLabelText('Explore twelve focus areas');
  fireEvent.change(search, { target: { value: 'privacy' } });
  expect(within(map).getAllByRole('button')).toHaveLength(1);
  expect(screen.getByRole('article')).toHaveTextContent('Communal sensemaking');
  fireEvent.change(search, { target: { value: 'unmatched' } });
  expect(within(map).queryAllByRole('button')).toHaveLength(0);
  expect(screen.getByRole('status')).toHaveTextContent('No matching focus areas');
  fireEvent.change(search, { target: { value: '' } });
  expect(within(map).getAllByRole('button')).toHaveLength(12);
});

it('wraps the guided navigation at each end of the atlas', () => {
  render(<ReverseAlignmentAtlas />);
  fireEvent.click(
    within(screen.getByLabelText('Explore twelve focus areas')).getByRole('button', { name: 'Identity' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Previous focus area' }));
  expect(screen.getByRole('article')).toHaveTextContent('Labor transition');
  fireEvent.click(screen.getByRole('button', { name: 'Next focus area' }));
  expect(within(screen.getByRole('article')).getByRole('heading', { name: 'Identity' })).toBeVisible();
});
