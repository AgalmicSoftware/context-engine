import React from 'react';
import { render, screen } from '@testing-library/react';
import QuadraticAllocationResults from './QuadraticAllocationResults';
import { summarizeQuadraticAllocations } from '@ce-shared/questions/quadraticAllocation.mjs';

const question = { options: ['Option A', 'Option B'], voiceCredits: 9 };
it('does not count a comment-only response as encrypted or invalid', () => {
  const responses = [{ answer: { value: '' }, additional: { value: 'A comment' } }];
  expect(summarizeQuadraticAllocations(responses, question)).toMatchObject({
    totalResponders: 0,
    excludedResponses: 0,
  });
  render(<QuadraticAllocationResults question={question} responses={responses} />);
  expect(screen.queryByText(/encrypted or invalid/)).not.toBeInTheDocument();
});
it('still counts zero allocations and excludes encrypted or malformed allocations', () => {
  expect(
    summarizeQuadraticAllocations(
      [{ answer: { value: [0, 0] } }, { answer: { encrypted: true } }, { answer: { value: [10, 0] } }],
      question,
    ),
  ).toMatchObject({ totalResponders: 1, excludedResponses: 2 });
});
it('includes decrypted allocations that retain their encrypted flag', () => {
  expect(summarizeQuadraticAllocations([{ answer: { value: [1, -2], encrypted: true } }], question)).toMatchObject({
    totalResponders: 1,
    excludedResponses: 0,
  });
});

it('draws each option as oppose and support bars around zero, with its net', () => {
  const responses = [{ answer: { value: [2, -1] } }, { answer: { value: [-1, -2] } }, { answer: { value: [2, 0] } }];
  render(<QuadraticAllocationResults question={question} responses={responses} />);
  const rows = screen.getAllByRole('listitem');
  expect(rows).toHaveLength(2);
  // What a screen reader hears for a row, and what the eye reads at its end.
  expect(rows[0]).toHaveTextContent('Option A: support 4, oppose 1, net +3');
  expect(rows[1]).toHaveTextContent('Option B: support 0, oppose 3, net −3');
  // The eye's copy of the name and numbers is hidden from screen readers, which get the sentence.
  expect(rows[0].querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  // Bars share one scale: the largest side of any option is the full width.
  const widths = rows.map((row) => [...row.querySelectorAll('i')].map((bar) => bar.style.width));
  expect(widths).toEqual([
    ['25%', '100%'],
    ['75%', '0%'],
  ]);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
