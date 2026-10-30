import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AgentQuestionPile from './AgentQuestionPile';
import type { AgentQuestion } from '../../../utilities/session/agentSessionData';

jest.mock('../../SurveyTool/SurveyAudioFieldInput', () => ({
  __esModule: true,
  default: ({ value, updateFunction }: { value: string; updateFunction: (text: string) => void }) => (
    <textarea aria-label="Answer" value={value} onChange={(event) => updateFunction(event.target.value)} />
  ),
}));

const question: AgentQuestion = {
  id: 'budget',
  questionId: 'budget',
  type: 'quadratic',
  questionType: 'quadratic',
  questionText: 'Allocate the budget',
  prompt: 'Allocate the budget',
  voiceCredits: 99,
  options: ['Parks', 'Transit', 'Housing'],
  tags: [],
  answerable: true,
  answeredByUser: false,
};

it('keeps signed costs, budget clamps, reset, drafts, and submission in the retained agent pile', () => {
  const onSubmitAnswer = jest.fn();
  function Harness() {
    const [activeIndex, setActiveIndex] = useState(0);
    return (
      <AgentQuestionPile
        activeIndex={activeIndex}
        canSubmit
        questions={[
          question,
          {
            ...question,
            id: 'note',
            questionId: 'note',
            questionType: 'freeform',
            type: 'freeform',
            prompt: 'Add context',
          },
        ]}
        status="loaded"
        onActiveIndexChange={setActiveIndex}
        onSubmitAnswer={onSubmitAnswer}
      />
    );
  }
  render(<Harness />);
  const parks = screen.getByRole('slider', { name: 'Parks' });
  const transit = screen.getByRole('slider', { name: 'Transit' });
  fireEvent.change(parks, { target: { value: '7' } });
  fireEvent.change(transit, { target: { value: '-7' } });
  expect(parks).toHaveAttribute('aria-valuetext', '+7 votes, 49 credits, support');
  expect(transit).toHaveAttribute('aria-valuetext', '-7 votes, 49 credits, oppose');
  expect(screen.getByTestId('ce-quadratic-cost-0')).toHaveTextContent('49 credits');
  expect(screen.getByTestId('ce-quadratic-cost-1')).toHaveTextContent('49 credits');
  expect(screen.getByRole('status')).toHaveTextContent('1 credit left');
  fireEvent.change(parks, { target: { value: '9' } });
  expect(parks).toHaveValue('7');
  fireEvent.change(transit, { target: { value: '0' } });
  expect(screen.getByTestId('ce-quadratic-cost-1')).toBeEmptyDOMElement();
  fireEvent.change(parks, { target: { value: '-9' } });
  expect(screen.getByRole('status')).toHaveTextContent('18 credits left');
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  expect(onSubmitAnswer).toHaveBeenLastCalledWith(question, { value: [-9, 0, 0] });
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByRole('status')).toHaveTextContent('99 credits left');
  expect(parks).toHaveValue('0');
  fireEvent.change(parks, { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next agent question' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Answer' }), { target: { value: 'Local draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Previous agent question' }));
  expect(screen.getByRole('slider', { name: 'Parks' })).toHaveValue('4');
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  expect(onSubmitAnswer).toHaveBeenLastCalledWith(question, { value: [4, 0, 0] });
  fireEvent.click(screen.getByRole('button', { name: 'Next agent question' }));
  expect(screen.getByRole('textbox', { name: 'Answer' })).toHaveValue('Local draft');
});

it('keeps either pending answer disabled while navigating between concurrent submissions', () => {
  const questions = ['first', 'second'].map((id) => ({ ...question, id, questionId: id }));
  const props = {
    questions,
    status: 'loaded',
    canSubmit: true,
    onSubmitAnswer: jest.fn(),
    onActiveIndexChange: jest.fn(),
  };
  const { rerender } = render(
    <AgentQuestionPile {...props} activeIndex={0} submittingQuestionIds={new Set(['first', 'second'])} />,
  );
  expect(screen.getByRole('button', { name: 'Submitting' })).toBeDisabled();
  rerender(<AgentQuestionPile {...props} activeIndex={1} submittingQuestionIds={new Set(['first', 'second'])} />);
  expect(screen.getByRole('button', { name: 'Submitting' })).toBeDisabled();
  rerender(<AgentQuestionPile {...props} activeIndex={0} submittingQuestionIds={new Set(['second'])} />);
  expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
  rerender(<AgentQuestionPile {...props} activeIndex={1} submittingQuestionIds={new Set(['second'])} />);
  expect(screen.getByRole('button', { name: 'Submitting' })).toBeDisabled();
});
