import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth';
import WorkerGroupAutoJoin from './WorkerGroupAutoJoin';

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
const tick = (ms = 5000) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
let fetchMock: jest.MockedFunction<typeof fetch>;
const originalFetch = global.fetch;

describe('WorkerGroupAutoJoin', () => {
  beforeEach(() => {
    jest.useFakeTimers();
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

  it('retains the link through sign-in, joins once after a countdown and cleans only its parameter', async () => {
    const changed = jest.fn();
    window.addEventListener('ce:worker-groups-changed', changed);
    const { rerender } = render(<WorkerGroupAutoJoin {...props} account="" loginComplete={false} />);
    expect(screen.getByText('Sign in to join this group automatically.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(props.toggleLoginModal).toHaveBeenCalledWith(true);
    rerender(<WorkerGroupAutoJoin {...props} />);
    await flush();
    expect(screen.getByText('Joining Participants 2026 in 5…')).toBeInTheDocument();
    await tick(4000);
    expect(joins()).toHaveLength(0);
    await tick(1000);
    expect(screen.getByText('Joined Participants 2026.')).toBeInTheDocument();
    expect(joins()).toHaveLength(1);
    const [url, init] = joins()[0];
    expect(url).toBe('https://worker.example/groups/join');
    expect(JSON.parse(String(init?.body))).toEqual({ groupId: group.groupId, sessionId });
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(window.location.search).toBe('?view=questions');
    expect(window.location.hash).toBe('#questions');
    expect(window.history.state).toEqual({ keep: true });
    rerender(<WorkerGroupAutoJoin {...props} sessionConfig={{ ...config }} />);
    await tick(10000);
    expect(joins()).toHaveLength(1);
    expect(changed).toHaveBeenCalledTimes(1);
    window.removeEventListener('ce:worker-groups-changed', changed);
  });

  it('allows cancellation before sign-in without leaving a retry on refresh', async () => {
    const { unmount } = render(<WorkerGroupAutoJoin {...props} account="" loginComplete={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel auto-join' }));
    unmount();
    render(<WorkerGroupAutoJoin {...props} />);
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ce-session-worker-group-auto-join')).not.toBeInTheDocument();
  });

  it('cancels a countdown and does not restart on rerender or account change', async () => {
    const { rerender } = render(<WorkerGroupAutoJoin {...props} />);
    await flush();
    await tick(4000);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel auto-join' }));
    rerender(<WorkerGroupAutoJoin {...props} account="0x0000000000000000000000000000000000000002" />);
    await tick();
    expect(joins()).toHaveLength(0);
  });

  it('recognizes existing members without posting another join', async () => {
    fetchMock.mockImplementation(async (url: RequestInfo | URL) =>
      response(
        String(url).includes('/my-memberships')
          ? { memberships: [{ group, member: { sessionSlug: 'alpha' } }] }
          : { groups: [group] },
      ),
    );
    render(<WorkerGroupAutoJoin {...props} />);
    await flush();
    expect(screen.getByText('You’re already in Participants 2026.')).toBeInTheDocument();
    expect(joins()).toHaveLength(0);
    expect(window.location.search).toBe('?view=questions');
  });

  it.each(['admin_add', 'expired', 'missing'])('does not auto-join an %s group', async (variant) => {
    fetchMock.mockImplementation(async (url: RequestInfo | URL) =>
      response(
        String(url).includes('/my-memberships')
          ? { memberships: [] }
          : {
              groups:
                variant === 'missing'
                  ? []
                  : [{ ...group, ...(variant === 'expired' ? { joinEndsAt: '2000-01-01' } : { joinMode: variant }) }],
            },
      ),
    );
    render(<WorkerGroupAutoJoin {...props} />);
    await tick();
    expect(screen.getByRole('alert')).toHaveTextContent(variant === 'missing' ? 'unavailable' : 'not open');
    expect(joins()).toHaveLength(0);
  });

  it('fails closed on wrong-session data before joining', async () => {
    fetchMock.mockImplementation(async () =>
      response({ sessionId: '0x22222222222222222222222222222222', groups: [group] }),
    );
    render(<WorkerGroupAutoJoin {...props} />);
    await tick();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(joins()).toHaveLength(0);
  });

  it('leaves a rejected join retryable and never reports success', async () => {
    const initial = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (url: RequestInfo | URL) =>
      String(url).includes('/groups/join')
        ? response({ reason: 'worker_group_member_cap_exceeded' }, 409)
        : initial!(url),
    );
    render(<WorkerGroupAutoJoin {...props} />);
    await tick();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('This group has reached its member limit.');
    expect(window.location.search).toContain('joinGroup');
    await tick(10000);
    expect(joins()).toHaveLength(1);
    fetchMock.mockImplementation(initial!);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await tick();
    expect(screen.getByText('Joined Participants 2026.')).toBeInTheDocument();
    expect(joins()).toHaveLength(2);
  });

  it('invalidates old authentication when the account changes', async () => {
    let resolveOld: (token: string) => void = () => {};
    getToken.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const { rerender } = render(<WorkerGroupAutoJoin {...props} />);
    rerender(<WorkerGroupAutoJoin {...props} account="0x0000000000000000000000000000000000000002" />);
    await act(async () => resolveOld('old-token'));
    await tick();
    expect(joins()).toHaveLength(1);
    expect(
      fetchMock.mock.calls.every(([, init]) => new Headers(init?.headers).get('Authorization') === 'Bearer test-token'),
    ).toBe(true);
  });

  it('cancels pending countdowns on logout and unmount', async () => {
    const { rerender, unmount } = render(<WorkerGroupAutoJoin {...props} />);
    await flush();
    rerender(<WorkerGroupAutoJoin {...props} account="" loginComplete={false} />);
    await tick();
    expect(joins()).toHaveLength(0);
    rerender(<WorkerGroupAutoJoin {...props} />);
    await flush();
    unmount();
    await tick();
    expect(joins()).toHaveLength(0);
  });

  it('does not transfer intent to a different session', async () => {
    const { rerender } = render(<WorkerGroupAutoJoin {...props} />);
    await flush();
    window.history.pushState({}, '', '/session/beta');
    rerender(<WorkerGroupAutoJoin {...props} sessionSlug="beta" sessionConfig={{ ...config, slug: 'beta' }} />);
    await tick();
    expect(joins()).toHaveLength(0);
    expect(screen.queryByTestId('ce-session-worker-group-auto-join')).not.toBeInTheDocument();
  });

  it('cancels pending work when navigation removes the join parameter in the same session', async () => {
    render(<WorkerGroupAutoJoin {...props} />);
    await flush();
    act(() => {
      window.history.pushState({}, '', '/session/alpha?view=questions');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await tick();
    expect(joins()).toHaveLength(0);
    expect(screen.queryByTestId('ce-session-worker-group-auto-join')).not.toBeInTheDocument();
  });

  it('posts only once under StrictMode effect replay', async () => {
    render(
      <React.StrictMode>
        <WorkerGroupAutoJoin {...props} />
      </React.StrictMode>,
    );
    await tick();
    expect(joins()).toHaveLength(1);
  });

  it('does not show a previous account’s successful join after switching accounts', async () => {
    const { rerender } = render(<WorkerGroupAutoJoin {...props} />);
    await tick();
    expect(screen.getByText('Joined Participants 2026.')).toBeInTheDocument();
    rerender(<WorkerGroupAutoJoin {...props} account="0x0000000000000000000000000000000000000002" />);
    await tick();
    expect(joins()).toHaveLength(1);
    expect(screen.queryByTestId('ce-session-worker-group-auto-join')).not.toBeInTheDocument();
  });

  it('ignores malformed or ambiguous links and ordinary session visits', async () => {
    for (const search of ['', '?joinGroup=../bad', '?joinGroup=a&joinGroup=b']) {
      window.history.replaceState({}, '', `/session/alpha${search}`);
      const { unmount } = render(<WorkerGroupAutoJoin {...props} />);
      await tick();
      expect(screen.queryByTestId('ce-session-worker-group-auto-join')).not.toBeInTheDocument();
      unmount();
    }
    expect(getToken).not.toHaveBeenCalled();
  });

  it('does nothing for registry sessions or mismatched session configurations', async () => {
    const { rerender } = render(
      <WorkerGroupAutoJoin {...props} sessionConfig={{ ...config, sessionModeProfile: undefined }} />,
    );
    rerender(<WorkerGroupAutoJoin {...props} sessionSlug="beta" />);
    await tick();
    expect(getToken).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ce-session-worker-group-auto-join')).not.toBeInTheDocument();
  });
});
