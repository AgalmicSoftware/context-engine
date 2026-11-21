import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../../utilities/session/sessionModeProfile';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds';
import SessionSettingsPage from './SessionSettingsPage';
import { VOICE_CONTEXT_NEEDS_NEWER_WORKER } from '../InterviewSettingsFields';

jest.mock('../../../utilities/session/sessionWorkerDiscovery', () => ({
  ...(jest.requireActual('../../../utilities/session/sessionWorkerDiscovery') as object),
  fetchWorkerCanonicalSessionBootstrap: async () => null,
}));
jest.mock('../setup/ContextSourcesPanel', () => ({ __esModule: true, default: () => null }));

const ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';

// An older Session Worker refuses interview settings it doesn't know, failing the whole save,
// so the voice interview's context switch is offered only where the Worker says it takes it,
// and shown wherever it is on, so a session put back on an older Worker can turn it off and save.
describe('Session settings voice interview context', () => {
  // `features: null` makes the capability read fail.
  const renderPage = (workerOrigin: string, features: string[] | null, voiceSessionContext?: boolean) => {
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
        sessionSlug="voice-context-salon"
        sessionConfig={{
          slug: 'voice-context-salon',
          sessionId: `0x${'3f'.repeat(16)}`,
          adminAddress: ADMIN_ADDRESS,
          corsWorkerUrl: workerOrigin,
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          interviewModeEnabled: true,
          ...(voiceSessionContext === undefined ? {} : { interviewMode: { enabled: true, voiceSessionContext } }),
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

  it('shows the switch while it is on, where the Worker was put back on one that refuses it, until it is off', async () => {
    renderPage('https://voice-context-back.example.workers.dev', ['worker_groups'], true);
    await openParticipation();
    const field = await screen.findByLabelText('Interviewer reads the session context');
    expect(field).toHaveValue('true');
    expect(screen.getByText(VOICE_CONTEXT_NEEDS_NEWER_WORKER)).toBeInTheDocument();
    fireEvent.change(field, { target: { value: 'false' } });
    expect(screen.queryByLabelText('Interviewer reads the session context')).not.toBeInTheDocument();
    expect(screen.queryByText(VOICE_CONTEXT_NEEDS_NEWER_WORKER)).not.toBeInTheDocument();
  });

  it('shows the switch, on, with no warning, when the Worker’s capabilities can’t be read', async () => {
    const fetchImpl = renderPage('https://voice-context-down.example.workers.dev', null, true);
    // A failed read shows no release, so wait for the read itself.
    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.click(screen.getByTestId(`${E2E_TESTIDS.SETUP_MORE_PREFIX}participation`));
    expect(screen.getByLabelText('Interviewer reads the session context')).toHaveValue('true');
    expect(screen.queryByText(VOICE_CONTEXT_NEEDS_NEWER_WORKER)).not.toBeInTheDocument();
  });
});
