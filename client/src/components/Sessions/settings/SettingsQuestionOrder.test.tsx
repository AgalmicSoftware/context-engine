import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../../utilities/session/sessionModeProfile';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds';
import SessionSettingsPage from './SessionSettingsPage';
import { QUESTION_ORDER_NEEDS_NEWER_WORKER } from '../InterviewSettingsFields';

jest.mock('../../../utilities/session/sessionWorkerDiscovery', () => ({
  ...(jest.requireActual('../../../utilities/session/sessionWorkerDiscovery') as object),
  fetchWorkerCanonicalSessionBootstrap: async () => null,
}));
jest.mock('../setup/ContextSourcesPanel', () => ({ __esModule: true, default: () => null }));

const ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';
const LABEL = 'Question order';

// An older Session Worker refuses interview settings it doesn't know, failing the whole save, so the
// question order is offered only where the Worker says it takes it, and shown wherever it isn't the
// default, so a session put back on an older Worker can set it back and save.
describe('Session settings question order', () => {
  // `features: null` makes the capability read fail.
  const renderPage = (workerOrigin: string, features: string[] | null, questionOrder?: string) => {
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
        sessionSlug="question-order-salon"
        sessionConfig={{
          slug: 'question-order-salon',
          sessionId: `0x${'4e'.repeat(16)}`,
          adminAddress: ADMIN_ADDRESS,
          corsWorkerUrl: workerOrigin,
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          interviewModeEnabled: true,
          ...(questionOrder === undefined ? {} : { interviewMode: { enabled: true, questionOrder } }),
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

  it('offers the choice, newest first, where the Worker takes it', async () => {
    renderPage('https://question-order-new.example.workers.dev', ['interview_question_order_v1', 'worker_groups']);
    await openParticipation();
    const field = await screen.findByLabelText(LABEL);
    expect(field).toHaveValue('newest');
    fireEvent.change(field, { target: { value: 'arranged' } });
    expect(screen.getByLabelText(LABEL)).toHaveValue('arranged');
  });

  it('leaves the choice out for a Worker too old to take it', async () => {
    renderPage('https://question-order-old.example.workers.dev', ['worker_groups']);
    await openParticipation();
    expect(screen.getByLabelText('Voice interviews and AI prefill')).toBeChecked();
    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument();
  });

  it('shows the choice while it is set, where the Worker was put back on one that refuses it, until it is the default', async () => {
    renderPage('https://question-order-back.example.workers.dev', ['worker_groups'], 'arranged');
    await openParticipation();
    const field = await screen.findByLabelText(LABEL);
    expect(field).toHaveValue('arranged');
    expect(screen.getByText(QUESTION_ORDER_NEEDS_NEWER_WORKER)).toBeInTheDocument();
    fireEvent.change(field, { target: { value: 'newest' } });
    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument();
    expect(screen.queryByText(QUESTION_ORDER_NEEDS_NEWER_WORKER)).not.toBeInTheDocument();
  });

  it('shows the choice, set, with no warning, when the Worker’s capabilities can’t be read', async () => {
    const fetchImpl = renderPage('https://question-order-down.example.workers.dev', null, 'arranged');
    // A failed read shows no release, so wait for the read itself.
    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.click(screen.getByTestId(`${E2E_TESTIDS.SETUP_MORE_PREFIX}participation`));
    expect(screen.getByLabelText(LABEL)).toHaveValue('arranged');
    expect(screen.queryByText(QUESTION_ORDER_NEEDS_NEWER_WORKER)).not.toBeInTheDocument();
  });
});
