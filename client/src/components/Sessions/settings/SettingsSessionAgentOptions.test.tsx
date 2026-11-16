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

// An older Session Worker refuses a Session Agent setting with a field it doesn't know, failing the
// whole save, so each option is offered only where the Worker says it accepts it.
describe('Session settings options for the Session Agent', () => {
  const openAgent = async (workerOrigin: string, features: string[]) => {
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
        sessionSlug="agent-options-salon"
        sessionConfig={{
          slug: 'agent-options-salon',
          sessionId: `0x${'4e'.repeat(16)}`,
          adminAddress: ADMIN_ADDRESS,
          corsWorkerUrl: workerOrigin,
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          sessionAgentReady: true,
          sessionAgent: { audiences: [] },
        }}
        workerOrigin={workerOrigin}
        fetchImpl={fetchImpl}
      />,
    );
    await screen.findByTestId('ce-settings-worker-release');
    fireEvent.click(screen.getByTestId(`${E2E_TESTIDS.SETUP_MORE_PREFIX}ai`));
    // The options every Worker with a Session Agent takes are there either way.
    expect(await screen.findByTestId('ce-setup-session-agent-min-answers')).toBeInTheDocument();
  };

  it('offers Record chats and Anyone can ask where the Worker accepts them', async () => {
    await openAgent('https://agent-options-new.example.workers.dev', [
      'worker_groups',
      'session_agent_chats',
      'session_agent_signed_out',
    ]);
    expect(await screen.findByLabelText('Record chats')).not.toBeChecked();
    expect(screen.getByLabelText('Anyone can ask')).toBeChecked();
  });

  it('offers each only where the Worker accepts that one', async () => {
    await openAgent('https://agent-options-part.example.workers.dev', ['worker_groups', 'session_agent_chats']);
    expect(await screen.findByLabelText('Record chats')).toBeInTheDocument();
    expect(screen.queryByLabelText('Anyone can ask')).not.toBeInTheDocument();
  });

  it('leaves both out for a Worker too old to accept them', async () => {
    await openAgent('https://agent-options-old.example.workers.dev', ['worker_groups']);
    expect(screen.queryByLabelText('Record chats')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Anyone can ask')).not.toBeInTheDocument();
  });
});
