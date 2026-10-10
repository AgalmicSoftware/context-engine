import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ReverseAlignmentAtlas from './ReverseAlignmentAtlas';

const openArea = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

it('starts with three compact areas and zooms into only the selected group', () => {
  render(<ReverseAlignmentAtlas />);
  const areas = screen.getByRole('group', { name: 'Explore topic groups' });
  expect(within(areas).getAllByRole('button')).toHaveLength(3);
  expect(screen.queryByRole('heading', { name: 'Reverse Alignment Atlas' })).not.toBeInTheDocument();
  expect(screen.queryByText('RxC · A field guide')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Privacy' })).not.toBeInTheDocument();
  openArea('Trust and agency');
  const topics = screen.getByRole('group', { name: 'Trust and agency topics' });
  expect(within(topics).getAllByRole('button')).toHaveLength(4);
  expect(screen.queryByRole('group', { name: 'Explore topic groups' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Trust and agency' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Back to all areas' }));
  expect(screen.getByRole('button', { name: 'Trust and agency' })).toHaveFocus();
});

it('follows connections across groups and returns to the correct group and topic', () => {
  render(<ReverseAlignmentAtlas />);
  openArea('Trust and agency');
  openArea('Privacy');
  const reading = screen.getByRole('article', { name: 'Selected focus area' });
  expect(screen.queryByRole('group', { name: 'Trust and agency topics' })).not.toBeInTheDocument();
  expect(within(reading).getByRole('heading', { name: 'Privacy' })).toHaveFocus();
  expect(within(reading).queryByRole('heading', { name: 'Connected focus areas' })).not.toBeInTheDocument();
  fireEvent.click(within(reading).getByRole('button', { name: /Agentic collaboration/ }));
  expect(within(reading).getByRole('heading', { name: 'Agentic collaboration' })).toHaveFocus();
  fireEvent.click(within(reading).getByRole('button', { name: 'Sources' }));
  expect(within(reading).getByRole('link', { name: /Read Reverse Alignment/ })).toHaveAttribute(
    'href',
    'https://reversealignment.ai/',
  );
  expect(reading).toHaveTextContent('editorial guide');
  fireEvent.click(screen.getByRole('button', { name: 'Back to focus areas' }));
  expect(screen.getByRole('group', { name: 'Collective decisions topics' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Agentic collaboration' })).toHaveFocus();
  openArea('Democracy');
  expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Back to focus areas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to all areas' }));
  expect(screen.getByRole('button', { name: 'Collective decisions' })).toHaveFocus();
});

it('wraps both area navigation and the twelve-topic tour', () => {
  render(<ReverseAlignmentAtlas />);
  openArea('Trust and agency');
  fireEvent.click(screen.getByRole('button', { name: 'Previous topic group' }));
  expect(screen.getByRole('heading', { name: 'Learning and work' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Next topic group' }));
  openArea('Identity');
  fireEvent.click(screen.getByRole('button', { name: 'Sources' }));
  fireEvent.click(screen.getByRole('button', { name: 'Previous focus area' }));
  expect(screen.getByRole('heading', { name: 'Labor transition' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Back to focus areas' }));
  expect(screen.getByRole('group', { name: 'Learning and work topics' })).toBeVisible();
  openArea('Labor transition');
  fireEvent.click(screen.getByRole('button', { name: 'Next focus area' }));
  expect(screen.getByRole('heading', { name: 'Identity' })).toHaveFocus();
});

it('shows only the opening context paragraph and source links inside the explorer', () => {
  render(
    <ReverseAlignmentAtlas
      context={{
        paragraphs: ['A short session introduction.', 'Additional background.'],
        links: [{ label: 'Official source', url: 'https://example.org/' }],
      }}
    />,
  );
  const context = screen.getByTestId('ce-session-context');
  expect(screen.getByTestId('ce-rxc-context-atlas')).toContainElement(context);
  expect(context).toHaveTextContent('A short session introduction.');
  expect(screen.getByRole('link', { name: /Official source/ })).toHaveAttribute('href', 'https://example.org/');
  expect(screen.queryByText('More context')).not.toBeInTheDocument();
  expect(screen.queryByText('Additional background.')).not.toBeInTheDocument();
  openArea('Collective decisions');
  expect(screen.queryByTestId('ce-session-context')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to all areas' }));
  expect(screen.getByTestId('ce-session-context')).toHaveTextContent('A short session introduction.');
});
