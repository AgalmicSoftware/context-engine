import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
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

it('turns on group suggestions, off by default', () => {
  const onChange = jest.fn();
  render(<InterviewSettingsFields value={{}} onChange={onChange} />);
  const box = screen.getByLabelText('Suggest open groups that fit participants’ answers');
  expect(box).not.toBeChecked();
  fireEvent.click(box);
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ suggestGroups: true }));
});

it('turns on the private fidelity score, off by default', () => {
  const onChange = jest.fn();
  render(<InterviewSettingsFields value={{}} onChange={onChange} />);
  const box = screen.getByLabelText('Show participants how well their AI predicted them');
  expect(box).not.toBeChecked();
  fireEvent.click(box);
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ showFidelityScore: true }));
});

it('turns on every setting that measures how well AI represents people, and back to their defaults', () => {
  const onChange = jest.fn();
  const label = 'Measure how well AI represents participants';
  const latest = () => onChange.mock.calls.at(-1)?.[0];
  const { rerender } = render(
    <InterviewSettingsFields
      value={{ realtimeModel: 'gpt-live-1', researchDetail: 'full', suggestGroups: true, enabled: false }}
      onChange={onChange}
    />,
  );
  expect(screen.getByLabelText(label)).not.toBeChecked();
  expect(screen.getByLabelText(label)).toHaveAccessibleDescription(
    /hidden drafts for 1 in 5 of each person’s AI-prefill drafts/,
  );

  fireEvent.click(screen.getByLabelText(label));
  expect(latest()).toEqual(
    expect.objectContaining({
      shareDraftChangesByDefault: true,
      hiddenDraftShare: 0.2,
      showFidelityScore: true,
      enabled: true,
      researchDetail: 'full',
      suggestGroups: true,
      realtimeModel: 'gpt-live-1',
    }),
  );
  rerender(<InterviewSettingsFields value={latest()} onChange={onChange} />);
  expect(screen.getByLabelText(label)).toBeChecked();

  // Each setting can still change: another hidden share keeps it on, none turns it off.
  fireEvent.change(screen.getByLabelText('Hidden AI drafts'), { target: { value: String(1 / 4) } });
  rerender(<InterviewSettingsFields value={latest()} onChange={onChange} />);
  expect(screen.getByLabelText(label)).toBeChecked();
  fireEvent.change(screen.getByLabelText('Hidden AI drafts'), { target: { value: '0' } });
  rerender(<InterviewSettingsFields value={latest()} onChange={onChange} />);
  expect(screen.getByLabelText(label)).not.toBeChecked();

  fireEvent.click(screen.getByLabelText(label));
  rerender(<InterviewSettingsFields value={latest()} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText(label));
  expect(latest()).toEqual(
    expect.objectContaining({
      shareDraftChangesByDefault: false,
      hiddenDraftShare: 0,
      showFidelityScore: false,
      researchDetail: 'full',
      suggestGroups: true,
    }),
  );
});

describe('the switch that measures how well AI represents people', () => {
  const label = 'Measure how well AI represents participants';
  const help = 'About measuring how well AI represents participants';

  it('leaves interviews on when turned off, and turns them on through the page that can', () => {
    const onChange = jest.fn();
    const onTurnOnInterviews = jest.fn();
    const latest = () => onChange.mock.calls.at(-1)?.[0];
    const { rerender } = render(
      <InterviewSettingsFields value={{}} onChange={onChange} onTurnOnInterviews={onTurnOnInterviews} />,
    );
    fireEvent.click(screen.getByLabelText(label));
    expect(onTurnOnInterviews).toHaveBeenCalledTimes(1);
    rerender(<InterviewSettingsFields value={latest()} onChange={onChange} onTurnOnInterviews={onTurnOnInterviews} />);
    fireEvent.click(screen.getByLabelText(label));
    expect(onTurnOnInterviews).toHaveBeenCalledTimes(1);
    expect(latest()).toEqual(expect.objectContaining({ enabled: true, showFidelityScore: false }));
  });

  it('opens its help without changing the switch', () => {
    const onChange = jest.fn();
    render(<InterviewSettingsFields value={{}} onChange={onChange} />);
    const helpButton = screen.getByRole('button', { name: help });
    fireEvent.click(helpButton);
    fireEvent.keyDown(helpButton, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(label)).not.toBeChecked();
  });

  it('is disabled with the other settings, and hides its help when tooltips are off', () => {
    const store = createStore(() => ({ sessionState: { tooltipsEnabled: false } }));
    render(
      <Provider store={store}>
        <InterviewSettingsFields value={{}} onChange={jest.fn()} disabled />
      </Provider>,
    );
    expect(screen.getByLabelText(label)).toBeDisabled();
    expect(screen.queryByRole('button', { name: help })).not.toBeInTheDocument();
    // Screen readers still get the explanation with the switch.
    expect(screen.getByLabelText(label)).toHaveAccessibleDescription(/research sharing by default/);
  });
});
