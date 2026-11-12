import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import InterviewSettingsFields from './InterviewSettingsFields';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
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
  // On unless the session turns it off.
  expect(screen.getByLabelText(label)).toHaveValue('true');
  fireEvent.change(screen.getByLabelText(label), { target: { value: 'false' } });
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ shareDraftChangesByDefault: false, steeringPrompt: 'Listen first.' }),
  );
  rerender(<InterviewSettingsFields value={onChange.mock.calls[0][0]} onChange={onChange} />);
  expect(screen.getByLabelText(label)).toHaveValue('false');
  fireEvent.change(screen.getByLabelText(label), { target: { value: 'true' } });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ shareDraftChangesByDefault: true }));
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

it('no longer offers the retired group suggestions box, and keeps a stored value as it is', () => {
  const onChange = jest.fn();
  const { rerender } = render(<InterviewSettingsFields value={{}} onChange={onChange} />);
  expect(screen.queryByLabelText('Suggest open groups that fit participants’ answers')).not.toBeInTheDocument();
  // No box turns it on, whatever its label.
  for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
  expect(onChange.mock.calls.some(([value]) => value.suggestGroups === true)).toBe(false);
  rerender(<InterviewSettingsFields value={{ suggestGroups: true }} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText('Show participants how well their AI predicted them'));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ suggestGroups: true, showFidelityScore: true }));
});

it('turns on suggesting groups to join, off by default, with its explanation behind its help', () => {
  const onChange = jest.fn();
  const label = 'Suggest groups to join';
  const { rerender } = render(<InterviewSettingsFields value={{}} onChange={onChange} />);
  const box = screen.getByLabelText(label);
  expect(box).not.toBeChecked();
  expect(box).toHaveAccessibleDescription(
    /They tick any they want, and submitting joins them.*Off, no groups are matched/,
  );
  const helpButton = screen.getByRole('button', { name: 'About suggesting groups to join' });
  fireEvent.click(helpButton);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(box);
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ joinMatchingGroups: true }));
  rerender(<InterviewSettingsFields value={onChange.mock.calls.at(-1)?.[0]} onChange={onChange} />);
  expect(screen.getByLabelText(label)).toBeChecked();
  fireEvent.click(screen.getByLabelText(label));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ joinMatchingGroups: false }));
});

it('asks what the AI may use to suggest groups only while suggesting them', () => {
  const onChange = jest.fn();
  const latest = () => onChange.mock.calls.at(-1)?.[0];
  const { rerender } = render(<InterviewSettingsFields value={{}} onChange={onChange} />);
  expect(screen.queryByRole('group', { name: 'The AI may use' })).not.toBeInTheDocument();
  rerender(<InterviewSettingsFields value={{ joinMatchingGroups: true }} onChange={onChange} />);
  const group = screen.getByRole('group', { name: 'The AI may use' });
  expect(group).toHaveAccessibleDescription(
    /with none ticked, neither suggests any.*Town or city means anywhere smaller than a country.*Every AI is instructed never to go on health.*suggested either way/,
  );
  fireEvent.click(within(group).getByRole('button', { name: 'About what the AI may use' }));
  expect(onChange).not.toHaveBeenCalled();
  // Country, work and interests by default; where in a country only when ticked, and nothing more personal.
  expect(
    within(group)
      .getAllByRole('checkbox')
      .map((box) => [box.closest('label')?.textContent?.trim(), (box as HTMLInputElement).checked]),
  ).toEqual([
    ['Country', true],
    ['Town or city', false],
    ['Work', true],
    ['Interests and causes', true],
  ]);
  fireEvent.click(within(group).getByLabelText('Town or city'));
  expect(latest()).toEqual(
    expect.objectContaining({
      joinMatchingGroups: true,
      groupSuggestionData: ['country', 'town', 'work', 'interests'],
    }),
  );
  rerender(<InterviewSettingsFields value={latest()} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText('Country'));
  expect(latest().groupSuggestionData).toEqual(['town', 'work', 'interests']);
  rerender(<InterviewSettingsFields value={latest()} onChange={onChange} />);
  // Off, the choice is hidden but kept in the draft; saves leave it out while it's off.
  fireEvent.click(screen.getByLabelText('Suggest groups to join'));
  expect(latest()).toEqual(
    expect.objectContaining({ joinMatchingGroups: false, groupSuggestionData: ['town', 'work', 'interests'] }),
  );
  rerender(<InterviewSettingsFields value={latest()} onChange={onChange} />);
  expect(screen.queryByRole('group', { name: 'The AI may use' })).not.toBeInTheDocument();
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
  // Research sharing's own default is on, so turning measuring off leaves it on.
  expect(latest()).toEqual(
    expect.objectContaining({
      shareDraftChangesByDefault: true,
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

describe('the Results section on how well AIs predicted people', () => {
  const results = 'Show “How well AIs predicted people” in Results';
  const label = 'Smallest group shown in “How well AIs predicted people”';
  const help = 'About the smallest group shown';
  const optionsOf = (select: HTMLElement) =>
    within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);

  it('is off by default, and shows its smallest group directly under it while on', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <InterviewSettingsFields value={{ steeringPrompt: 'Listen first.' }} onChange={onChange} />,
    );
    const box = screen.getByLabelText(results);
    expect(box).not.toBeChecked();
    expect(box).toHaveAttribute('data-testid', E2E_TESTIDS.WIZARD_INTERVIEW_FIDELITY_RESULTS);
    expect(screen.queryByLabelText(label)).not.toBeInTheDocument();

    fireEvent.click(box);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ showFidelityResults: true, steeringPrompt: 'Listen first.' }),
    );
    rerender(<InterviewSettingsFields value={onChange.mock.calls[0][0]} onChange={onChange} />);
    expect(screen.getByLabelText(results)).toBeChecked();
    // The switch's row, with its "?", then the smallest group directly under it.
    expect(screen.getByLabelText(results).closest('label')?.parentElement?.nextElementSibling).toContainElement(
      screen.getByText(label),
    );
  });

  it('defaults to 5 people, can be turned off, and shows a minimum set elsewhere in order', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <InterviewSettingsFields
        value={{ showFidelityResults: true, steeringPrompt: 'Listen first.' }}
        onChange={onChange}
      />,
    );
    const select = screen.getByLabelText(label);
    expect(select).toHaveAttribute('data-testid', E2E_TESTIDS.WIZARD_INTERVIEW_FIDELITY_MINIMUM);
    expect(select).toHaveDisplayValue('5 people');
    expect(optionsOf(select)).toEqual(['Off: show every result', '3 people', '5 people', '10 people']);

    fireEvent.change(select, { target: { value: '1' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ fidelityMinimumPeople: 1, showFidelityResults: true, steeringPrompt: 'Listen first.' }),
    );
    rerender(<InterviewSettingsFields value={onChange.mock.calls[0][0]} onChange={onChange} />);
    expect(screen.getByLabelText(label)).toHaveDisplayValue('Off: show every result');

    rerender(
      <InterviewSettingsFields value={{ showFidelityResults: true, fidelityMinimumPeople: 7 }} onChange={onChange} />,
    );
    expect(screen.getByLabelText(label)).toHaveDisplayValue('7 people');
    expect(optionsOf(screen.getByLabelText(label))).toEqual([
      'Off: show every result',
      '3 people',
      '5 people',
      '7 people',
      '10 people',
    ]);
  });

  it('resets the smallest group when the section is turned off, so no hidden setting is saved', () => {
    const onChange = jest.fn();
    render(
      <InterviewSettingsFields value={{ showFidelityResults: true, fidelityMinimumPeople: 1 }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByLabelText(results));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ showFidelityResults: false, fidelityMinimumPeople: 5 }),
    );
  });

  it('is left alone by the switch that measures how well AI represents people', () => {
    const onChange = jest.fn();
    const latest = () => onChange.mock.calls.at(-1)?.[0];
    const measure = 'Measure how well AI represents participants';
    const { rerender } = render(<InterviewSettingsFields value={{}} onChange={onChange} />);
    // The switch shows people their own score; the Results section stays off.
    fireEvent.click(screen.getByLabelText(measure));
    expect(latest()).toEqual(expect.objectContaining({ showFidelityScore: true, showFidelityResults: false }));

    const kept = { showFidelityResults: true, fidelityMinimumPeople: 1 };
    rerender(<InterviewSettingsFields value={kept} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(measure));
    expect(latest()).toEqual(expect.objectContaining({ showFidelityScore: true, ...kept }));
    rerender(<InterviewSettingsFields value={latest()} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(measure));
    expect(latest()).toEqual(expect.objectContaining({ showFidelityScore: false, ...kept }));
  });

  it('explains the smallest group behind a question mark, and to screen readers when tooltips are off', () => {
    const { unmount } = render(<InterviewSettingsFields value={{ showFidelityResults: true }} onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: help })).toBeInTheDocument();
    expect(screen.getByLabelText(label)).toHaveAccessibleDescription(/no one’s AI score can be singled out/);
    unmount();

    const store = createStore(() => ({ sessionState: { tooltipsEnabled: false } }));
    render(
      <Provider store={store}>
        <InterviewSettingsFields value={{ showFidelityResults: true }} onChange={jest.fn()} disabled />
      </Provider>,
    );
    expect(screen.getByLabelText(results)).toBeDisabled();
    expect(screen.getByLabelText(label)).toBeDisabled();
    expect(screen.queryByRole('button', { name: help })).not.toBeInTheDocument();
    expect(screen.getByLabelText(label)).toHaveAccessibleDescription(/Turn it off only where everyone knows/);
  });
});

it('explains each setting behind its own "?", not in text under it', () => {
  render(
    <InterviewSettingsFields
      value={{ openingMode: 'owner', openingPrompt: 'What should change?', followNewQuestions: true }}
      onChange={jest.fn()}
    />,
  );
  const explained = {
    'Share AI draft changes for research by default': /choices already saved stay as they are/,
    'AI draft research detail': /Minimal keeps none of the AI’s notes/,
    'Hidden AI drafts': /how much seeing a draft sways answers/,
    'Interview voice model': /OpenAI live model/,
    'Opening question': /Owner-written: every interview opens with your question/,
    'Owner opening question': /up to 1,200 characters/,
    'Interview steering prompt': /public settings, so anyone can read them/,
    'Regenerate opening when the question bank grows': /Off while the opening is owner-written/,
    'Check for new session questions during interviews': /every 30 seconds/,
    'Suggest new question drafts from interview evidence': /up to three new questions/,
    'Allow admins to regenerate the opening': /Regenerate interview opening/,
    'Show participants how well their AI predicted them': /see privately/,
    'Show “How well AIs predicted people” in Results': /at least the smallest group/,
    'Question growth threshold (%)': /at 20%, 42 questions need nine more/,
  };
  for (const [label, help] of Object.entries(explained)) {
    expect(screen.getByLabelText(label)).toHaveAccessibleDescription(help);
    expect(screen.getByRole('button', { name: `About ${label}` })).toBeInTheDocument();
  }
  expect(screen.queryByText(/^Sets the initial research-sharing checkbox/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Additions accumulate since/)).not.toBeInTheDocument();
});
