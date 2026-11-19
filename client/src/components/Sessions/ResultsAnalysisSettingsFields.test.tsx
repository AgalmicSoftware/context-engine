import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ResultsAnalysisSettingsFields from './ResultsAnalysisSettingsFields';

// The Session Agent is updated by hand from Results, so a session on manual updates has no settings for it.
it('shows nothing for a session on manual updates, whatever else is stored', () => {
  const onChange = jest.fn();
  const { container, rerender } = render(<ResultsAnalysisSettingsFields value={undefined} onChange={onChange} />);
  expect(container).toBeEmptyDOMElement();
  rerender(
    <ResultsAnalysisSettingsFields
      value={{ generationMode: 'manual', views: { circles: true, breakdown: false, riskMatrix: true } }}
      onChange={onChange}
      backgroundAutoSupported
    />,
  );
  expect(container).toBeEmptyDOMElement();
  expect(onChange).not.toHaveBeenCalled();
});

// A session already updating automatically keeps doing so in its Worker, so its admin sees it and can stop it.
it.each(['automatic', 'both'])('shows a session on %s updates its settings and lets it go back to manual', (mode) => {
  const onChange = jest.fn();
  const stored = {
    version: 1,
    generationMode: mode,
    autoAfter: { threshold: 25, unit: 'distinctParticipants' },
    views: { circles: true, breakdown: false, riskMatrix: true },
    stray: 'left by an older build',
  };
  const view = render(<ResultsAnalysisSettingsFields value={stored} onChange={onChange} />);
  expect(screen.getByTestId('ce-session-agent-updates')).not.toHaveTextContent(/AI Views|Circles|Breakdown/);
  expect(screen.getByLabelText('Update the Session Agent')).toHaveValue(mode);
  expect(screen.getByLabelText('New participants before an automatic update')).toHaveValue(25);

  fireEvent.change(screen.getByLabelText('New participants before an automatic update'), { target: { value: '40' } });
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ generationMode: mode, autoAfter: { threshold: 40, unit: 'distinctParticipants' } }),
  );

  fireEvent.change(screen.getByLabelText('Update the Session Agent'), { target: { value: 'manual' } });
  const manual = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  // A stray stored key is not passed on, so it cannot block the save; the view toggles stay as stored.
  expect(manual).not.toHaveProperty('stray');
  expect(manual).toEqual(
    expect.objectContaining({
      generationMode: 'manual',
      autoAfter: { threshold: 25, unit: 'distinctParticipants' },
      views: { circles: true, breakdown: false, riskMatrix: true },
    }),
  );
  // With manual held but not yet saved, the fields stay so the admin can change their mind.
  view.rerender(<ResultsAnalysisSettingsFields value={manual} onChange={onChange} />);
  expect(screen.getByLabelText('Update the Session Agent')).toHaveValue('manual');
  expect(screen.queryByLabelText('New participants before an automatic update')).not.toBeInTheDocument();
  expect(screen.getByTestId('ce-session-agent-updates')).toHaveTextContent('Automatic updates stop when you save.');
});
