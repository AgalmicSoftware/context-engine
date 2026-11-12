import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import ResultsBuildStatus from './ResultsBuildStatus';

const nextBuild = {
  model: 'deep-model',
  prompts: { plan: 'You are planning <Questions>', map: 'You are mapping <Responses>' },
};

afterEach(() => {
  jest.useRealTimers();
});

it('counts the seconds since the build started and names the model', () => {
  jest.useFakeTimers();
  jest.setSystemTime(100_000);
  render(<ResultsBuildStatus kind="debate-atlas" busy nextBuild={nextBuild} startedAtMs={58_000} />);
  // The live region announces the task, not each tick.
  expect(screen.getByRole('status')).toHaveTextContent('Building the atlas · 42s');
  expect(screen.getByRole('status')).toHaveAccessibleName('');
  act(() => {
    jest.advanceTimersByTime(3000);
  });
  expect(screen.getByRole('status')).toHaveTextContent('Building the atlas · 45s');
  expect(screen.getByText('AI model: deep-model')).toBeVisible();
});

it('shows the prompts only when asked', () => {
  render(<ResultsBuildStatus kind="debate-atlas" busy nextBuild={nextBuild} startedAtMs={Date.now()} />);
  const toggle = screen.getByRole('button', { name: /Show AI prompt/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('You are planning <Questions>')).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(screen.getByRole('button', { name: /Hide AI prompt/ })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('region', { name: 'Planning prompt' })).toHaveTextContent('You are planning <Questions>');
  expect(screen.getByRole('region', { name: 'Mapping prompt' })).toHaveTextContent('You are mapping <Responses>');
});

it('still times a build when the Worker gave no model or prompts', () => {
  render(<ResultsBuildStatus kind="debate-atlas" busy nextBuild={null} startedAtMs={null} />);
  expect(screen.getByRole('status')).toHaveTextContent(/^\s*Building the atlas · 0s$/);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByText(/AI model/)).not.toBeInTheDocument();
});

it('keeps one live region from the running build to its failure, so the failure is read out', () => {
  const { rerender } = render(
    <ResultsBuildStatus kind="debate-atlas" busy nextBuild={nextBuild} startedAtMs={Date.now()} />,
  );
  const region = screen.getByRole('status');
  rerender(
    <ResultsBuildStatus
      kind="debate-atlas"
      busy={false}
      error="Planning the atlas failed."
      nextBuild={nextBuild}
      startedAtMs={null}
    />,
  );
  expect(screen.getByRole('status')).toBe(region);
  expect(region).toHaveTextContent('Planning the atlas failed.');
  // A failed build shows no model or prompts.
  expect(screen.queryByText(/AI model/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it("names a risk matrix build and shows its one prompt, leaving out the atlas's", () => {
  render(
    <ResultsBuildStatus
      kind="risk-matrix"
      busy
      nextBuild={{ model: 'deep-model', prompts: { build: 'You are building <Responses>', plan: 'Stray' } }}
      startedAtMs={Date.now()}
    />,
  );
  expect(screen.getByTestId('ce-session-risk-matrix-status')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent(/^\s*Building the risk matrix · 0s$/);
  fireEvent.click(screen.getByRole('button', { name: /Show AI prompt/ }));
  expect(screen.getByRole('region', { name: 'Building prompt' })).toHaveTextContent('You are building <Responses>');
  expect(screen.getAllByRole('region')).toHaveLength(1);
});
