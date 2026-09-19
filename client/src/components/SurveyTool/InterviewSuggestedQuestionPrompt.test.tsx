import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

it('shows the normalized type and multichoice options for review cards', () => {
  render(
    <InterviewSuggestedQuestionPrompt
      prompt="Which launch mode fits?"
      type="multichoice"
      options={['Pilot', 'Full launch', { unexpected: true } as never]}
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByText('Multichoice')).toBeInTheDocument();
  expect(screen.getByText('Options: Pilot · Full launch')).toBeInTheDocument();
  expect(screen.queryByText(/object Object/)).not.toBeInTheDocument();
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
