import React from 'react';
import { render, screen } from '@testing-library/react';
import WorkerResponseHydrationNotice from './WorkerResponseHydrationNotice';
import { resolveWorkerResponseHydrationRun } from '../../utilities/survey/workerResponseHydrationRuntime';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

it('shows incomplete results only for the matching Worker and session', () => {
  const sessionConfig = { slug: 'example', sessionId: `0x${'1'.repeat(32)}`, corsWorkerUrl: 'https://worker.example',
    sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE) };
  const run = resolveWorkerResponseHydrationRun({ sessionConfig, sessionSlug: 'example' })!;
  const partialRuns = { [run.key]: true };
  const { rerender } = render(<WorkerResponseHydrationNotice sessionConfig={sessionConfig} sessionSlug="example" partialRuns={partialRuns} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Results and exports may omit answers or recent edits');
  rerender(<WorkerResponseHydrationNotice sessionConfig={{ ...sessionConfig, corsWorkerUrl: 'https://replacement.example' }} sessionSlug="example" partialRuns={partialRuns} />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  rerender(<WorkerResponseHydrationNotice sessionConfig={sessionConfig} sessionSlug="example" partialRuns={{ [run.key]: false }} />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
