import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ResultsAnalysisSettingsFields from './ResultsAnalysisSettingsFields';

// AI Views is off the site: no settings show for it, on a new session or one on manual builds.
it('shows nothing for a session on manual builds, whatever else is stored', () => {
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
  expect(screen.queryByText(/Generation mode|AI Views|threshold/i)).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

// A session set to build automatically keeps building in its Worker, so its admin keeps one way to stop it.
it.each(['automatic', 'both'])('lets a session on %s builds stop them, keeping the rest of what is stored', (mode) => {
  const onChange = jest.fn();
  const stored = {
    version: 1,
    generationMode: mode,
    autoAfter: { threshold: 25, unit: 'distinctParticipants' },
    views: { circles: true, breakdown: false, riskMatrix: true },
    stray: 'left by an older build',
  };
  const view = render(<ResultsAnalysisSettingsFields value={stored} onChange={onChange} />);
  expect(screen.getByTestId('ce-ai-views-automatic')).toHaveTextContent(/still builds AI Views automatically/);
  expect(screen.getByTestId('ce-ai-views-automatic')).toHaveTextContent(/paid AI call/);
  expect(screen.queryByLabelText('Generation mode')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Stop automatic builds' }));
  expect(onChange).toHaveBeenCalledTimes(1);
  // A stray stored key is not passed on, so it cannot block the save.
  expect(onChange.mock.calls[0][0]).not.toHaveProperty('stray');
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      generationMode: 'manual',
      autoAfter: { threshold: 25, unit: 'distinctParticipants' },
      views: { circles: true, breakdown: false, riskMatrix: true },
    }),
  );
  // Once the page holds the manual setting, the control gives way to a reminder that it still needs saving.
  view.rerender(<ResultsAnalysisSettingsFields value={onChange.mock.calls[0][0]} onChange={onChange} />);
  expect(screen.queryByRole('button', { name: 'Stop automatic builds' })).not.toBeInTheDocument();
  expect(screen.getByTestId('ce-ai-views-stopped')).toHaveTextContent('Automatic AI Views builds stop when you save.');
});
