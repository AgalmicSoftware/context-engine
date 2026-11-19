import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../../utilities/session/sessionModeProfile';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds';
import SessionSettingsPage from './SessionSettingsPage';

jest.mock('../../../utilities/session/sessionWorkerDiscovery', () => ({
  ...(jest.requireActual('../../../utilities/session/sessionWorkerDiscovery') as object),
  fetchWorkerCanonicalSessionBootstrap: async () => null,
}));
jest.mock('../setup/ContextSourcesPanel', () => ({ __esModule: true, default: () => null }));

const ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';

// An older Session Worker refuses gpt-live-1.1 on save, failing the whole save,
// so Settings lists it only where the Worker says it takes it.
describe('Session settings interview voice model', () => {
  // `features: null` makes the capability read fail.
  const renderPage = (workerOrigin: string, features: string[] | null, realtimeModel?: string) => {
    const fetchImpl = jest.fn(async (url: unknown) =>
      String(url).startsWith(`${workerOrigin}/capabilities`)
        ? features
          ? new Response(JSON.stringify({ type: 'ce_worker_capabilities', version: 1, apiVersion: 1, features }))
          : new Response('{}', { status: 503 })
        : new Response('{}', { status: 404 }),
    ) as unknown as typeof fetch;
    render(
      <SessionSettingsPage
        account={ADMIN_ADDRESS}
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="voice-model-trial"
        sessionConfig={{
          slug: 'voice-model-trial',
          sessionId: `0x${'4f'.repeat(16)}`,
          adminAddress: ADMIN_ADDRESS,
          corsWorkerUrl: workerOrigin,
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          interviewModeEnabled: true,
          interviewMode: { enabled: true, provider: 'openai', ...(realtimeModel ? { realtimeModel } : {}) },
        }}
        workerOrigin={workerOrigin}
        fetchImpl={fetchImpl}
      />,
    );
    return fetchImpl;
  };
  const openParticipation = async () => {
    await screen.findByTestId('ce-settings-worker-release');
    fireEvent.click(screen.getByTestId(`${E2E_TESTIDS.SETUP_MORE_PREFIX}participation`));
  };
  const options = () =>
    Array.from((screen.getByLabelText('Interview voice model') as HTMLSelectElement).options).map(
      (option) => option.value,
    );

  it('lists gpt-live-1.1 as the default where the Worker takes it, and keeps a session on gpt-live-1 there', async () => {
    renderPage(
      'https://voice-model-new.example.workers.dev',
      ['worker_groups', 'interview_gpt_live_1_1_v1'],
      'gpt-live-1',
    );
    await openParticipation();
    await screen.findByRole('option', { name: 'gpt-live-1.1 (default)' });
    expect(screen.getByLabelText('Interview voice model')).toHaveValue('gpt-live-1');
  });

  it('shows gpt-live-1 as the default and leaves gpt-live-1.1 out for a Worker too old to take it', async () => {
    renderPage('https://voice-model-old.example.workers.dev', ['worker_groups']);
    await openParticipation();
    await screen.findByRole('option', { name: 'gpt-live-1 (default)' });
    expect(screen.getByLabelText('Interview voice model')).toHaveValue('gpt-live-1');
    expect(options()).not.toContain('gpt-live-1.1');
  });

  it('gives no warning when the Worker’s capabilities can’t be read', async () => {
    const fetchImpl = renderPage('https://voice-model-down.example.workers.dev', null, 'gpt-live-1.1');
    // A failed read shows no release, so wait for the read itself.
    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.click(screen.getByTestId(`${E2E_TESTIDS.SETUP_MORE_PREFIX}participation`));
    expect(screen.getByLabelText('Interview voice model')).toHaveValue('gpt-live-1.1');
    expect(screen.queryByText(/refuses every save/)).not.toBeInTheDocument();
  });

  it('warns when gpt-live-1.1 is set but the Worker was put back on one that refuses it', async () => {
    renderPage('https://voice-model-back.example.workers.dev', ['worker_groups'], 'gpt-live-1.1');
    await openParticipation();
    expect(await screen.findByText(/doesn’t take gpt-live-1.1 and refuses every save/)).toBeInTheDocument();
    expect(screen.getByLabelText('Interview voice model')).toHaveValue('gpt-live-1.1');
  });
});
