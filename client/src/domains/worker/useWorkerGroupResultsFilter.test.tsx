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
jest.mock('./workerGroupPorts', () => ({
  getWorkerSessionToken: jest.fn(),
  loadWorkerGroupMembers: jest.fn(),
  loadWorkerGroupOverview: jest.fn(),
}));
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
  members.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(members).toHaveBeenCalledTimes(2));
  expect(result.current.cohort.status).toBe('ready');
  expect([...result.current.cohort.members[group.groupId]]).toEqual([a]);
  await act(async () => finish(page(b)));
  expect([...result.current.cohort.members[group.groupId]]).toEqual([b]);
});
