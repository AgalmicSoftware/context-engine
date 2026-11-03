import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import InterviewSuggestedQuestionPrompt from './InterviewSuggestedQuestionPrompt';

it('shows a question heading and lets the owner edit it explicitly', () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <InterviewSuggestedQuestionPrompt prompt="Which AI impact matters?" onChange={onChange} />,
  );
  expect(screen.getByRole('heading', { name: 'Which AI impact matters?' })).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit suggested question' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Which policy matters?' } });
  expect(onChange).toHaveBeenCalledWith('Which policy matters?');
  rerender(<InterviewSuggestedQuestionPrompt prompt="Which policy matters?" onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Done editing' }));
  expect(screen.getByRole('heading', { name: 'Which policy matters?' })).toBeInTheDocument();
});

const preview = () => within(screen.getByRole('group', { name: 'Answer preview' }));

it('previews a multichoice answer with its options, as respondents see it', () => {
  render(
    <InterviewSuggestedQuestionPrompt
      prompt="Which launch mode fits?"
      type="multichoice"
      options={['Pilot', 'Full launch', { unexpected: true } as never]}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText('Multichoice')).toBeInTheDocument();
  expect(preview().getByRole('checkbox', { name: 'Pilot' })).toBeDisabled();
  expect(preview().getByRole('checkbox', { name: 'Full launch' })).toBeDisabled();
  expect(preview().getAllByRole('checkbox')).toHaveLength(2);
  expect(screen.queryByText(/^Options:/)).not.toBeInTheDocument();
  expect(screen.queryByText(/object Object/)).not.toBeInTheDocument();
});

it('previews binary and rating answers with the controls respondents use', () => {
  const { rerender } = render(
    <InterviewSuggestedQuestionPrompt prompt="Councils should publish prompts." type="binary" onChange={jest.fn()} />,
  );
  for (const choice of ['Agree', 'Unsure', 'Disagree'])
    expect(preview().getByRole('radio', { name: choice })).toBeDisabled();

  rerender(<InterviewSuggestedQuestionPrompt prompt="How concerned are you?" type="rating" onChange={jest.fn()} />);
  expect(preview().getByRole('slider')).toBeDisabled();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
});

it('shows no answer preview for a freeform question', () => {
  render(<InterviewSuggestedQuestionPrompt prompt="What would build trust?" onChange={jest.fn()} />);
  expect(screen.getByText('Freeform')).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Answer preview' })).not.toBeInTheDocument();
});

it('swaps the preview for the editors while the question is edited', () => {
  render(
    <InterviewSuggestedQuestionPrompt
      prompt="Which launch mode fits?"
      type="multichoice"
      options={['Pilot', 'Full launch']}
      onChange={jest.fn()}
      editor={<button type="button">Add Option</button>}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Add Option' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit suggested question' }));
  expect(screen.queryByRole('group', { name: 'Answer preview' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Option' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Done editing' }));
  expect(preview().getByRole('checkbox', { name: 'Pilot' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add Option' })).not.toBeInTheDocument();
});

it('keeps owner actions available while the suggested question is being edited', () => {
  const onRemove = jest.fn();
  render(
    <InterviewSuggestedQuestionPrompt
      prompt="Which AI impact matters?"
      onChange={jest.fn()}
      actions={
        <button type="button" aria-label="Remove question" onClick={onRemove}>
          Remove
        </button>
      }
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Edit suggested question' }));
  expect(screen.getByRole('textbox', { name: 'Edit suggested question' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove question' }));
  expect(onRemove).toHaveBeenCalledTimes(1);
});

it('labels quadratic suggestions correctly and previews their allocation', () => {
  render(
    <InterviewSuggestedQuestionPrompt
      prompt="Allocate support"
      type="quadratic"
      options={['Parks', 'Transit']}
      voiceCredits={9}
      onChange={jest.fn()}
    />,
  );
  expect(screen.getByText('Quadratic allocation', { selector: 'span' })).toBeInTheDocument();
  expect(screen.queryByText('Freeform')).not.toBeInTheDocument();
  expect(preview().getByText('Parks')).toBeInTheDocument();
  expect(preview().getByText('Transit')).toBeInTheDocument();
  expect(preview().getByRole('status')).toHaveTextContent('9 credits left');
  // Nothing in a preview takes focus or input, its help included.
  expect(preview().getByRole('button', { name: 'How voice credits work' })).toBeDisabled();
});
