import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import QuadraticAllocationInput from './QuadraticAllocationInput';
import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';

const openHelp = async () => {
  fireEvent.focus(screen.getByRole('button', { name: 'How voice credits work' }));
  return screen.findByRole('tooltip');
};

it.each([
  { budget: 25, max: '5' },
  { budget: 1, max: '1' },
])('P1 help example stays within a $budget-credit budget', async ({ budget, max }) => {
  render(
    <QuadraticAllocationInput questionId="q" options={['Parks', 'Transit']} voiceCredits={budget} value={[0, 0]} />,
  );
  expect(screen.getByRole('slider', { name: 'Parks' })).toHaveAttribute('max', max);
  const tip = await openHelp();
  expect(tip).not.toHaveTextContent('+7 or −7 uses 49 credits');
});

it('shows the squared-cost explanation only in the hovered help tooltip', async () => {
  render(<QuadraticAllocationInput questionId="q" options={['Parks', 'Transit']} value={[0, 0]} />);
  expect(screen.queryByText(/Votes cost their square/)).not.toBeInTheDocument();
  expect(screen.getByRole('slider', { name: 'Parks' })).toHaveAttribute('max', '9');
  fireEvent.mouseOver(screen.getByRole('button', { name: 'How voice credits work' }));
  const tip = await screen.findByRole('tooltip');
  expect(tip).toHaveTextContent('Votes cost their square: +7 or −7 uses 49 credits');
});

it('P2 (batch-1 check) full-view Reset on an untouched saved answer stays disabled', () => {
  render(
    <SurveyQuestionsFullQuestionResponseInput
      question={{ id: '0xq', type: 'quadratic', options: ['Parks', 'Transit'], voiceCredits: 99 } as any}
      answer={{ value: [3, -4] } as any}
      answerResetValue={[3, -4]}
      isSubmitting={false}
      singleQuestionMode={false}
      onAnswerChange={jest.fn()}
      {...({} as any)}
    />,
  );
  expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
});

it('uses singular credit for a one-credit budget and example', async () => {
  render(<QuadraticAllocationInput questionId="q" options={['Parks', 'Transit']} voiceCredits={1} value={[0, 0]} />);
  expect(await openHelp()).toHaveTextContent('+1 or −1 uses 1 credit. Share your 1 credit across the options.');
});
