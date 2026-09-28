import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ReverseAlignmentTopicMap, { hasReverseAlignmentTopicPreview } from './ReverseAlignmentTopicMap';

it('limits the preview to Reverse Alignment sessions', () => {
  expect(hasReverseAlignmentTopicPreview('rxc-test')).toBe(true);
  expect(hasReverseAlignmentTopicPreview('rxc-ra-test')).toBe(true);
  expect(hasReverseAlignmentTopicPreview('eddy26')).toBe(false);
  expect(hasReverseAlignmentTopicPreview('demo')).toBe(false);
});

it('shows twelve empty topics and lets participants inspect them without assigning responses', () => {
  render(<ReverseAlignmentTopicMap />);
  expect(screen.getAllByRole('button')).toHaveLength(12);
  expect(screen.getAllByText('0 assigned')).toHaveLength(12);
  expect(screen.getByText('Preview')).toBeVisible();
  expect(screen.getByText('Waiting for more data')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Law and liberties 0 assigned' }));
  expect(screen.getByRole('button', { name: 'Law and liberties 0 assigned' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(screen.getByRole('status')).getByText('Law and liberties')).toBeVisible();
  expect(within(screen.getByRole('status')).getByText('No questions or responses assigned yet.')).toBeVisible();
  expect(screen.queryByRole('button', { name: /generate|process/i })).not.toBeInTheDocument();
});
