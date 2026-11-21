import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../../utilities/session/sessionModeProfile';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds';
import SessionSettingsPage from './SessionSettingsPage';

jest.mock('../../../utilities/session/sessionWorkerDiscovery', () => ({
  ...(jest.requireActual('../../../utilities/session/sessionWorkerDiscovery') as object),
  fetchWorkerCanonicalSessionBootstrap: async () => null,
}));
jest.mock('../setup/ContextSourcesPanel', () => ({ __esModule: true, default: () => null }));

const ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';

// An older Session Worker refuses interview settings it doesn't know, failing the whole save,
// so the voice interview's context switch is offered only where the Worker says it takes it.
describe('Session settings voice interview context', () => {
  const renderPage = (workerOrigin: string, features: string[]) => {
    const fetchImpl = jest.fn(async (url: unknown) =>
      String(url).startsWith(`${workerOrigin}/capabilities`)
        ? new Response(JSON.stringify({ type: 'ce_worker_capabilities', version: 1, apiVersion: 1, features }))
        : new Response('{}', { status: 404 }),
    ) as unknown as typeof fetch;
    render(
      <SessionSettingsPage
        account={ADMIN_ADDRESS}
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="voice-context-salon"
        sessionConfig={{
          slug: 'voice-context-salon',
          sessionId: `0x${'3f'.repeat(16)}`,
          adminAddress: ADMIN_ADDRESS,
          corsWorkerUrl: workerOrigin,
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          interviewModeEnabled: true,
        }}
        workerOrigin={workerOrigin}
        fetchImpl={fetchImpl}
      />,
    );
  };
  const openParticipation = async () => {
    await screen.findByTestId('ce-settings-worker-release');
    fireEvent.click(screen.getByTestId(`${E2E_TESTIDS.SETUP_MORE_PREFIX}participation`));
  };

  it('offers the switch, off, where the Worker takes it', async () => {
    renderPage('https://voice-context-new.example.workers.dev', ['worker_groups', 'interview_voice_context_v1']);
    await openParticipation();
    const field = await screen.findByLabelText('Interviewer reads the session context');
    expect(field).toHaveValue('false');
    fireEvent.change(field, { target: { value: 'true' } });
    expect(screen.getByLabelText('Interviewer reads the session context')).toHaveValue('true');
  });

  it('leaves the switch out for a Worker too old to take it', async () => {
    renderPage('https://voice-context-old.example.workers.dev', ['worker_groups']);
    await openParticipation();
    expect(screen.getByLabelText('Voice interviews and AI prefill')).toBeChecked();
    expect(screen.queryByLabelText('Interviewer reads the session context')).not.toBeInTheDocument();
  });
});
