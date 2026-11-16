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
// so the note on where research data goes is offered only where the Worker says it accepts it.
describe('Session settings note on where the data goes', () => {
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
        sessionSlug="data-note-salon"
        sessionConfig={{
          slug: 'data-note-salon',
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

  it('offers the note where the Worker accepts it', async () => {
    renderPage('https://data-note-new.example.workers.dev', ['worker_groups', 'interview_data_note_v1']);
    await openParticipation();
    expect(await screen.findByLabelText('Where the data goes')).toBeInTheDocument();
  });

  it('leaves the note out for a Worker too old to accept it', async () => {
    renderPage('https://data-note-old.example.workers.dev', ['worker_groups']);
    await openParticipation();
    expect(screen.getByLabelText('Voice interviews and AI prefill')).toBeChecked();
    expect(screen.queryByLabelText('Where the data goes')).not.toBeInTheDocument();
  });
});
