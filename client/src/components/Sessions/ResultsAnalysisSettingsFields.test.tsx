import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ResultsAnalysisSettingsFields from './ResultsAnalysisSettingsFields';

it('keeps automatic modes unavailable when background generation is unsupported', () => {
  const onChange = jest.fn();
  render(
    <ResultsAnalysisSettingsFields
      value={{ generationMode: 'manual' }}
      onChange={onChange}
      backgroundAutoSupported={false}
      unsupportedReason="Background automatic runs are not available."
    />,
  );

  expect(screen.getByLabelText('Generation mode')).toHaveValue('manual');
  expect(screen.getByRole('option', { name: 'Automatic after threshold' })).toBeDisabled();
  expect(screen.getByRole('option', { name: 'Manual and automatic' })).toBeDisabled();
  expect(screen.getByText('Background automatic runs are not available.')).toBeInTheDocument();
});

it('preserves invalid threshold draft state until write validation rejects it', () => {
  const onChange = jest.fn();
  render(
    <ResultsAnalysisSettingsFields
      value={{
        generationMode: 'both',
        autoAfter: { threshold: '', unit: 'distinctParticipants' },
      }}
      onChange={onChange}
      backgroundAutoSupported={true}
    />,
  );

  const threshold = screen.getByLabelText('Distinct participant threshold');
  expect(threshold).toHaveValue(null);
  expect(threshold).toBeInvalid();
  expect(screen.getByText('Results analysis settings need a valid threshold and known options.')).toBeInTheDocument();

  fireEvent.change(threshold, { target: { value: '25' } });
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      autoAfter: { threshold: 25, unit: 'distinctParticipants' },
    }),
  );
});

it('explains the mode, the views and the threshold behind their own "?"', () => {
  render(
    <ResultsAnalysisSettingsFields
      value={{ generationMode: 'automatic' }}
      onChange={jest.fn()}
      backgroundAutoSupported
    />,
  );
  expect(screen.getByLabelText('Generation mode')).toHaveAccessibleDescription(/Manual: an admin presses Generate/);
  expect(screen.getByRole('group', { name: 'AI Views' })).toHaveAccessibleDescription(
    /Circles: a map of the arguments.*Breakdown.*Risk Matrix/,
  );
  expect(screen.getByLabelText('Distinct participant threshold')).toHaveAccessibleDescription(
    /Someone answering again doesn’t count/,
  );
  for (const label of ['Generation mode', 'AI Views', 'Distinct participant threshold']) {
    expect(screen.getByRole('button', { name: `About ${label}` })).toBeInTheDocument();
  }
  expect(screen.queryByText(/^Runs after this many newly seen/)).not.toBeInTheDocument();
});
