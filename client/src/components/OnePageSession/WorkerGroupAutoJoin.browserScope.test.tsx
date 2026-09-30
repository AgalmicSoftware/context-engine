import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth';
import WorkerGroupAutoJoin from './WorkerGroupAutoJoin';
import { fetchWorkerCanonicalSessionBootstrap } from '../../utilities/session/sessionWorkerDiscovery';
jest.mock('../../utilities/session/sessionWorkerDiscovery', () => ({
  ...jest.requireActual<Record<string, unknown>>('../../utilities/session/sessionWorkerDiscovery'),
  fetchWorkerCanonicalSessionBootstrap: jest.fn(),
}));
const bootstrap = jest.mocked(fetchWorkerCanonicalSessionBootstrap);

jest.mock('../../utilities/worker/workerAuth', () => ({ getWorkerSessionToken: jest.fn() }));
const getToken = jest.mocked(getWorkerSessionToken);
const sessionId = '0x11111111111111111111111111111111';
const account = '0x0000000000000000000000000000000000000001';
const group = {
  groupId: 'participants-2026',
  sessionSlug: 'alpha',
  label: 'Participants 2026',
  joinMode: 'open',
  memberVisibility: 'session',
};
const config = {
  slug: 'alpha',
  sessionIdHex: sessionId,
  corsWorkerUrl: 'https://worker.example',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};
const props = {
  sessionConfig: config,
  sessionSlug: 'alpha',
  account,
  provider: null,
  loginComplete: true,
  toggleLoginModal: jest.fn(),
};
const response = (data: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify({ ok: status === 200, sessionId, sessionSlug: 'alpha', ...data }), { status });
const flush = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
let fetchMock: jest.MockedFunction<typeof fetch>;
const originalFetch = global.fetch;

describe('WorkerGroupAutoJoin', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    sessionStorage.clear();
    localStorage.clear();
    bootstrap.mockReset().mockResolvedValue({
      config,
      sessionId,
      sessionSlug: 'alpha',
      workerOrigin: 'https://worker.example',
      configRevision: 'v1',
    });
    window.history.replaceState(
      { keep: true },
      '',
      '/session/alpha?joinGroup=participants-2026&view=questions#questions',
    );
    getToken.mockReset().mockResolvedValue('test-token');
    fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/groups/list')) return response({ groups: [group] });
      if (String(input).includes('/groups/my-memberships')) return response({ memberships: [] });
      if (String(input).includes('/groups/join')) return response({ group, memberCount: 1 });
      throw new Error(`Unexpected request: ${input}`);
    });
    global.fetch = fetchMock;
  });
  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });
  const joins = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/groups/join'));

  it('a signed-out cancellation still applies when the visitor is already signed in on the next visit', async () => {
    const { unmount } = render(<WorkerGroupAutoJoin {...props} account="" loginComplete={false} />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel auto-join' }));
    unmount();
    // The visitor signs in elsewhere, then follows the same invitation again.
    window.history.replaceState({}, '', '/session/alpha?joinGroup=participants-2026');
    render(<WorkerGroupAutoJoin {...props} />);
    await flush();
    expect(joins()).toHaveLength(0);
  });

  it('cancelling from the pre-resolution notice while signed out is honoured after sign-in', async () => {
    bootstrap.mockImplementationOnce(() => new Promise(() => {}));
    window.history.replaceState(
      {},
      '',
      '/session/alpha?joinGroup=participants-2026&worker=https%3A%2F%2Fworker.example',
    );
    const { unmount } = render(
      <WorkerGroupAutoJoin {...props} account="" loginComplete={false} sessionConfig={null} sessionSlug="" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel auto-join' }));
    unmount();
    window.history.replaceState({}, '', '/session/alpha?joinGroup=participants-2026');
    render(<WorkerGroupAutoJoin {...props} />);
    await flush();
    expect(joins()).toHaveLength(0);
  });
});
