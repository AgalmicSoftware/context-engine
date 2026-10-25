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
  fireEvent.change(screen.getByLabelText('Interview steering prompt'), {
    target: { value: 'Follow the responder first.' },
  });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ steeringPrompt: 'Follow the responder first.' }));
});

it('explains a blank owner opening before publication', () => {
  const { rerender } = render(
    <InterviewSettingsFields value={{ openingMode: 'owner', openingPrompt: '   ' }} onChange={jest.fn()} />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(/enter an owner opening question/i);
  expect(screen.getByLabelText('Owner opening question')).toHaveAttribute('aria-invalid', 'true');
  rerender(
    <InterviewSettingsFields
      value={{ openingMode: 'owner', openingPrompt: 'What should change?' }}
      onChange={jest.fn()}
    />,
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('edits the research-sharing default while retaining other interview settings', () => {
  const onChange = jest.fn();
  const label = 'Share AI draft changes for research by default';
  const { rerender } = render(
    <InterviewSettingsFields value={{ steeringPrompt: 'Listen first.' }} onChange={onChange} />,
  );
  expect(screen.getByLabelText(label)).toHaveValue('false');
  fireEvent.change(screen.getByLabelText(label), { target: { value: 'true' } });
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ shareDraftChangesByDefault: true, steeringPrompt: 'Listen first.' }),
  );
  rerender(<InterviewSettingsFields value={onChange.mock.calls[0][0]} onChange={onChange} />);
  expect(screen.getByLabelText(label)).toHaveValue('true');
  fireEvent.change(screen.getByLabelText(label), { target: { value: 'false' } });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ shareDraftChangesByDefault: false }));
  rerender(<InterviewSettingsFields value={{ shareDraftChangesByDefault: true }} onChange={onChange} disabled />);
  expect(screen.getByLabelText(label)).toBeDisabled();
});

it('edits the research detail, defaulting to minimal', () => {
  const onChange = jest.fn();
  const label = 'AI draft research detail';
  const { rerender } = render(
    <InterviewSettingsFields value={{ steeringPrompt: 'Listen first.' }} onChange={onChange} />,
  );
  expect(screen.getByLabelText(label)).toHaveValue('minimal');
  fireEvent.change(screen.getByLabelText(label), { target: { value: 'full' } });
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ researchDetail: 'full', steeringPrompt: 'Listen first.' }),
  );
  rerender(<InterviewSettingsFields value={onChange.mock.calls[0][0]} onChange={onChange} />);
  expect(screen.getByLabelText(label)).toHaveValue('full');
});

it('edits the share of hidden AI drafts, defaulting to off', () => {
  const onChange = jest.fn();
  const label = 'Hidden AI drafts';
  const { rerender } = render(
    <InterviewSettingsFields value={{ steeringPrompt: 'Listen first.' }} onChange={onChange} />,
  );
  expect(screen.getByLabelText(label)).toHaveDisplayValue('Off');
  fireEvent.change(screen.getByLabelText(label), { target: { value: '0.2' } });
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ hiddenDraftShare: 0.2, steeringPrompt: 'Listen first.' }),
  );
  rerender(<InterviewSettingsFields value={onChange.mock.calls[0][0]} onChange={onChange} />);
  expect(screen.getByLabelText(label)).toHaveDisplayValue('1 in 5');
  // A share set elsewhere still shows as what it is.
  rerender(<InterviewSettingsFields value={{ hiddenDraftShare: 0.3 }} onChange={onChange} />);
  expect(screen.getByLabelText(label)).toHaveDisplayValue('30%');
});
