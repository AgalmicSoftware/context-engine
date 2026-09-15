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
