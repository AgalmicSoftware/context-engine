import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import InterviewSettingsFields from './InterviewSettingsFields';
it('exposes conservative generation defaults and an editable owner opening', () => {
  const onChange = jest.fn();
  const { rerender } = render(<InterviewSettingsFields value={{}} onChange={onChange} />);
  expect(screen.getByLabelText('Opening question')).toHaveValue('auto');
  expect(screen.getByLabelText('Regenerate opening when the question bank grows')).not.toBeChecked();
  expect(screen.getByLabelText('Check for new session questions during interviews')).not.toBeChecked();
  expect(screen.getByLabelText('Allow admins to regenerate the opening')).toBeChecked();
  fireEvent.change(screen.getByLabelText('Opening question'), { target: { value: 'owner' } });
  rerender(<InterviewSettingsFields value={onChange.mock.calls[0][0]} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Owner opening question'), { target: { value: 'Your uncommon view on AI?' } });
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ openingMode: 'owner', openingPrompt: 'Your uncommon view on AI?' }),
  );
});
