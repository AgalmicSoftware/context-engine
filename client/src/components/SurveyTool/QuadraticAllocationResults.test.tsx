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
