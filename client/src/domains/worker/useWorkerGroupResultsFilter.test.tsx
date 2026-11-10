import { act, renderHook, waitFor } from '@testing-library/react';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { dispatchWorkerGroupsChanged } from '../../utilities/worker/workerGroupChangeEvents';
import {
  getWorkerSessionToken,
  loadWorkerGroupMembers,
  loadWorkerGroupOverview,
  type WorkerGroupMemberPage,
} from './workerGroupPorts';
import { useWorkerGroupResultsFilter } from './useWorkerGroupResultsFilter';
import { loadWorkerGroupCohort } from './workerGroupResultsAccess';
jest.mock('./workerGroupPorts', () => {
  const auth = jest.requireActual<typeof import('../../utilities/worker/workerAuth')>(
    '../../utilities/worker/workerAuth',
  );
  return {
    getWorkerSessionToken: jest.fn(),
    isWorkerSignInNeededError: auth.isWorkerSignInNeededError,
    subscribeWorkerSessionToken: auth.subscribeWorkerSessionToken,
    loadWorkerGroupMembers: jest.fn(),
    loadWorkerGroupOverview: jest.fn(),
  };
});
const token = jest.mocked(getWorkerSessionToken),
  members = jest.mocked(loadWorkerGroupMembers),
  overview = jest.mocked(loadWorkerGroupOverview);
const scope = { sessionId: '0x' + '1'.repeat(32), sessionSlug: 'test', workerUrl: 'https://worker.example' };
const group = {
  groupId: 'eddy-2026',
  label: 'EDDY-2026',
  sessionSlug: 'test',
  joinMode: 'open' as const,
  memberVisibility: 'session' as const,
};
const a = '0x' + 'a'.repeat(40),
  b = '0x' + 'b'.repeat(40);
const selection = { ...scope, creatorInclude: [], creatorExclude: [], responderInclude: [group], responderExclude: [] };
const config = {
  slug: 'test',
  sessionIdHex: scope.sessionId,
  corsWorkerUrl: scope.workerUrl,
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};
const page = (address: string, nextCursor = ''): WorkerGroupMemberPage => ({
  group,
  members: [{ groupId: group.groupId, sessionSlug: 'test', principal: { kind: 'passkey_account', address } }],
  memberCount: 1,
  nextCursor,
});
const input = { sessionConfig: config, sessionSlug: 'test', account: a, selection };
beforeEach(() => {
  jest.resetAllMocks();
  token.mockResolvedValue('synthetic-token');
  overview.mockResolvedValue({ groups: [group], memberships: [] });
  members.mockResolvedValue(page(a));
});
it('loads every page before making inclusion or exclusion results available', async () => {
  members
    .mockResolvedValueOnce({ ...page(a, 'next'), memberCount: 2 })
    .mockResolvedValueOnce({ ...page(b), memberCount: 2 });
  const { result } = renderHook(() => useWorkerGroupResultsFilter(input));
  expect(result.current.cohort.status).toBe('loading');
  await waitFor(() => expect(result.current.cohort.status).toBe('ready'));
  expect([...result.current.cohort.members[group.groupId]]).toEqual([a, b]);
  expect(members.mock.calls[1][0].cursor).toBe('next');
});
it('blocks denied reads and retries, without reusing the previous account’s directory', async () => {
  const { result, rerender } = renderHook((props) => useWorkerGroupResultsFilter(props), { initialProps: input });
  await waitFor(() => expect(result.current.cohort.status).toBe('ready'));
  members.mockRejectedValueOnce(new Error('worker_group_member_list_forbidden'));
  rerender({ ...input, account: b });
  expect(result.current.cohort.members).toEqual({});
  await waitFor(() => expect(result.current.cohort.status).toBe('error'));
  expect(result.current.cohort.message).toContain('permission');
  act(() => result.current.refresh());
  expect(result.current.cohort.status).toBe('loading');
  await waitFor(() => expect(result.current.cohort.status).toBe('ready'));
});
it('invalidates on join/leave events and does not fetch after sign-out', async () => {
  const { result, rerender } = renderHook((props) => useWorkerGroupResultsFilter(props), { initialProps: input });
  await waitFor(() => expect(result.current.cohort.status).toBe('ready'));
  members.mockResolvedValue({ ...page(a), members: [], memberCount: 0 });
  act(() => {
    dispatchWorkerGroupsChanged(scope);
  });
  expect(result.current.cohort.status).toBe('ready');
  expect([...result.current.cohort.members[group.groupId]]).toEqual([a]);
  await waitFor(() => expect(result.current.cohort.members[group.groupId]?.size).toBe(0));
  token.mockClear();
  rerender({ ...input, account: '' });
  expect(result.current.cohort.members).toEqual({});
  await waitFor(() => expect(result.current.cohort.message).toContain('Sign in'));
  expect(token).not.toHaveBeenCalled();
});
it('keeps native selection inert on-chain without making Worker or authentication requests', () => {
  const { result } = renderHook(() =>
    useWorkerGroupResultsFilter({ ...input, sessionConfig: { chainId: 11155420 }, discover: true }),
  );
  expect(result.current.cohort.active).toBe(false);
  expect(token).not.toHaveBeenCalled();
  expect(members).not.toHaveBeenCalled();
});
it('rejects cyclic pagination, failed later pages, and unmappable principals', async () => {
  members.mockResolvedValue(page(a, 'same'));
  await expect(loadWorkerGroupCohort(selection, 'token')).rejects.toThrow('incomplete');
  members.mockReset().mockResolvedValueOnce(page(a, 'next')).mockRejectedValueOnce(new Error('offline'));
  await expect(loadWorkerGroupCohort(selection, 'token')).rejects.toThrow('offline');
  members.mockResolvedValue({ ...page(a), members: [{ principal: { kind: 'telegram', principalId: 'synthetic' } }] });
  await expect(loadWorkerGroupCohort(selection, 'token')).rejects.toThrow('identities');
});
it('rejects session changes before authenticating or reading the old Group', async () => {
  const { result } = renderHook(() =>
    useWorkerGroupResultsFilter({ ...input, sessionConfig: { ...config, sessionIdHex: '0x' + '2'.repeat(32) } }),
  );
  await waitFor(() => expect(result.current.cohort.status).toBe('error'));
  expect(result.current.cohort.message).toContain('different session');
  expect(token).not.toHaveBeenCalled();
});

it('rejects a truncated final page even if no continuation cursor was returned', async () => {
  members.mockResolvedValue({ ...page(a), memberCount: 2 });
  await expect(loadWorkerGroupCohort(selection, 'token')).rejects.toThrow('incomplete');
});

it('keeps loaded members visible while a focus refresh is pending', async () => {
  const { result } = renderHook(() => useWorkerGroupResultsFilter(input));
  await waitFor(() => expect(result.current.cohort.status).toBe('ready'));
  let finish: (value: WorkerGroupMemberPage) => void = () => {};
  members.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(members).toHaveBeenCalledTimes(2));
  expect(result.current.cohort.status).toBe('ready');
  expect([...result.current.cohort.members[group.groupId]]).toEqual([a]);
  await act(async () => finish(page(b)));
  expect([...result.current.cohort.members[group.groupId]]).toEqual([b]);
});

const { WorkerSignInNeededError } = jest.requireActual<typeof import('../../utilities/worker/workerAuth')>(
  '../../utilities/worker/workerAuth',
);
const prompts = () => token.mock.calls.map(([options]) => (options as { prompt?: boolean }).prompt);

it('never asks for a refresh on focus or the timer, while opening the filter and Refresh do', async () => {
  jest.useFakeTimers();
  try {
    // The filter is open.
    const { result } = renderHook(() => useWorkerGroupResultsFilter({ ...input, discover: true }));
    await waitFor(() => expect(result.current.cohort.status).toBe('ready'));
    token.mockRejectedValue(new WorkerSignInNeededError());
    act(() => window.dispatchEvent(new Event('focus')));
    await act(async () => jest.advanceTimersByTime(60000));
    expect(prompts()).toEqual([true, false, false]);
    // What the filter showed stays, rather than a sign-in error.
    expect(result.current.cohort.status).toBe('ready');
    expect([...result.current.cohort.members[group.groupId]]).toEqual([a]);
    token.mockResolvedValue('synthetic-token');
    act(() => result.current.refresh());
    await waitFor(() => expect(prompts()).toEqual([true, false, false, true]));
    // A Refresh click before a queued quiet refresh runs still counts as the person's.
    act(() => {
      dispatchWorkerGroupsChanged(scope);
      result.current.refresh();
    });
    await waitFor(() => expect(prompts()).toEqual([true, false, false, true, true]));
    // Only that load was the person's.
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(prompts()).toEqual([true, false, false, true, true, false]));
  } finally {
    jest.useRealTimers();
  }
});

it('asks someone signed in for a Group filter saved or in a link, and keeps its refreshes quiet', async () => {
  // Results opened with a Group filter from a link or an earlier visit.
  const { result } = renderHook(() => useWorkerGroupResultsFilter(input));
  await waitFor(() => expect(result.current.cohort.status).toBe('ready'));
  expect(prompts()).toEqual([true]);
  token.mockRejectedValue(new WorkerSignInNeededError());
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(prompts()).toEqual([true, false]));
  act(() => window.dispatchEvent(new Event('ce:worker-session-token')));
  await waitFor(() => expect(prompts()).toEqual([true, false, false]));
  // What the filter showed stays, rather than a sign-in error.
  expect(result.current.cohort.status).toBe('ready');
  expect([...result.current.cohort.members[group.groupId]]).toEqual([a]);
});

it('never asks again as the filter is closed and opened after a declined sign-in, while Retry does', async () => {
  token.mockRejectedValue(new Error('The passkey prompt was dismissed.'));
  const { result, rerender } = renderHook((props) => useWorkerGroupResultsFilter(props), {
    initialProps: { ...input, discover: true },
  });
  await waitFor(() => expect(result.current.cohort.status).toBe('error'));
  expect(prompts()).toEqual([true]);
  token.mockRejectedValue(new WorkerSignInNeededError());
  // Closing the filter hides its controls without unmounting them, so the saved Group's members load again.
  rerender({ ...input, discover: false });
  await waitFor(() => expect(prompts()).toEqual([true, false]));
  rerender({ ...input, discover: true });
  await waitFor(() => expect(prompts()).toEqual([true, false, false]));
  expect(result.current.cohort.status).toBe('error');
  token.mockResolvedValue('synthetic-token');
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.cohort.status).toBe('ready'));
  expect(prompts()).toEqual([true, false, false, true]);
});

it('asks when the filter first opens on a page that loaded with it closed', async () => {
  const closed = { ...input, selection: null, discover: false };
  const { result, rerender } = renderHook((props) => useWorkerGroupResultsFilter(props), { initialProps: closed });
  expect(token).not.toHaveBeenCalled();
  rerender({ ...closed, discover: true });
  await waitFor(() => expect(result.current.groups).toEqual([group]));
  expect(prompts()).toEqual([true]);
});

it('asks again for a new account, and never shows the last account’s members when that is declined', async () => {
  const { result, rerender } = renderHook((props) => useWorkerGroupResultsFilter(props), { initialProps: input });
  await waitFor(() => expect(result.current.cohort.status).toBe('ready'));
  token
    .mockRejectedValueOnce(new Error('The passkey prompt was dismissed.'))
    .mockRejectedValue(new WorkerSignInNeededError());
  // A refresh due at the same moment doesn't make the new account's first load a quiet one.
  act(() => {
    rerender({ ...input, account: b });
    dispatchWorkerGroupsChanged(scope);
  });
  await waitFor(() => expect(result.current.cohort.status).toBe('error'));
  expect(prompts()).toEqual([true, true]);
  expect(result.current.cohort.members).toEqual({});
  // A refresh that can't sign in quietly leaves the failure, and its Retry, on screen.
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(prompts()).toEqual([true, true, false]));
  expect(result.current.cohort.message).toBe('The passkey prompt was dismissed.');
  expect(result.current.cohort.members).toEqual({});
});

it('offers a sign-in, never the last account’s members, when a refresh can’t sign in before a new account’s list loads', async () => {
  const { result, rerender } = renderHook((props) => useWorkerGroupResultsFilter(props), { initialProps: input });
  await waitFor(() => expect(result.current.cohort.status).toBe('ready'));
  token.mockImplementationOnce(() => new Promise(() => undefined)).mockRejectedValue(new WorkerSignInNeededError());
  rerender({ ...input, account: b });
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(result.current.cohort.status).toBe('error'));
  expect(prompts()).toEqual([true, true, false]);
  expect(result.current.cohort.message).toBe('Sign in to filter results by Group.');
  expect(result.current.cohort.members).toEqual({});
});
