import { act, renderHook, waitFor } from '@testing-library/react';

import { useContextGroups } from './useContextGroups';
import { loadPublicWorkerGroups, loadWorkerGroupOverview } from '../../domains/worker/workerGroupPorts';
import {
  getCachedWorkerSessionToken,
  getWorkerSessionToken,
  hasCachedWorkerSessionToken,
  subscribeWorkerSessionToken,
} from '../worker/workerAuth.js';

jest.mock('../../domains/worker/workerGroupPorts', () => ({
  loadPublicWorkerGroups: jest.fn(),
  loadWorkerGroupOverview: jest.fn(),
}));
jest.mock('../worker/workerAuth.js', () => ({
  getCachedWorkerSessionToken: jest.fn(),
  getWorkerSessionToken: jest.fn(),
  hasCachedWorkerSessionToken: jest.fn(),
  subscribeWorkerSessionToken: jest.fn(),
}));
jest.mock('../session/sessionWorkerAvailability', () => ({
  getUsableSessionWorkerUrl: ({ sessionConfig }: { sessionConfig: { workerUrl?: string } }) =>
    sessionConfig.workerUrl || '',
}));
jest.mock('../session/sessionWorkerDiscovery', () => ({
  resolveWorkerCanonicalSessionIdHex: (sessionConfig: { sessionId?: string }) => sessionConfig.sessionId || '',
}));

const ME = '0xaaaa000000000000000000000000000000000001';
const SALON = { workerUrl: 'https://salon-worker.example.test', sessionId: `0x${'1'.repeat(32)}` };
const DEBATE = { workerUrl: 'https://debate-worker.example.test', sessionId: `0x${'2'.repeat(32)}` };
const forbidden = () => Object.assign(new Error('worker_group_discovery_not_public'), { status: 403 });
const group = (groupId: string, label: string) => ({ groupId, label, sessionSlug: 'salon' });
// Lets a refused list finish loading.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

type Props = { sessionSlug?: string; sessionConfig: Record<string, string>; account?: string };
const mount = (initialProps: Props) =>
  renderHook((props: Props) => useContextGroups({ sessionSlug: 'salon', ...props }), { initialProps });

describe('useContextGroups', () => {
  let hearToken: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    hearToken = () => undefined;
    jest.mocked(subscribeWorkerSessionToken).mockImplementation((listener) => {
      hearToken = listener;
      return () => undefined;
    });
    // No token is held.
    jest.mocked(getCachedWorkerSessionToken).mockResolvedValue('');
    // A private session refuses the anonymous list.
    jest.mocked(loadPublicWorkerGroups).mockRejectedValue(forbidden());
    jest.mocked(loadWorkerGroupOverview).mockResolvedValue({
      groups: [group('salon', 'Salon')] as never,
      memberships: [],
    });
  });

  it('lists a private session’s groups for a reader signed in to its Worker', async () => {
    jest.mocked(getCachedWorkerSessionToken).mockResolvedValue('worker-session-credential');
    const { result } = mount({ sessionConfig: SALON, account: ME });
    await waitFor(() => expect(result.current).toEqual([{ groupId: 'salon', label: 'Salon' }]));
    expect(getCachedWorkerSessionToken).toHaveBeenCalledWith(expect.objectContaining({ context: { account: ME } }));
    expect(loadWorkerGroupOverview).toHaveBeenCalledWith({
      ...SALON,
      credentialToken: 'worker-session-credential',
      sessionSlug: 'salon',
    });
    expect(loadPublicWorkerGroups).not.toHaveBeenCalled();
  });

  it('lists again when the reader signs in or the Worker gives them a token', async () => {
    const { result, rerender } = mount({ sessionConfig: SALON });
    await waitFor(() => expect(loadPublicWorkerGroups).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual([]);

    rerender({ sessionConfig: SALON, account: ME });
    await waitFor(() => expect(loadPublicWorkerGroups).toHaveBeenCalledTimes(2));
    expect(result.current).toEqual([]);

    jest.mocked(getCachedWorkerSessionToken).mockResolvedValue('worker-session-credential');
    act(() => hearToken());
    await waitFor(() => expect(result.current).toEqual([{ groupId: 'salon', label: 'Salon' }]));
    expect(loadWorkerGroupOverview).toHaveBeenCalledTimes(1);
  });

  it('falls back to the public list when the Worker refuses the reader’s token', async () => {
    // As when a settings change signs everyone out, while this browser still holds the old token.
    jest.mocked(getCachedWorkerSessionToken).mockResolvedValue('worker-session-credential');
    jest.mocked(loadWorkerGroupOverview).mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }));
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue([group('salon', 'Salon')] as never);
    const { result } = mount({ sessionConfig: SALON, account: ME });
    await waitFor(() => expect(result.current).toEqual([{ groupId: 'salon', label: 'Salon' }]));
    expect(loadWorkerGroupOverview).toHaveBeenCalledTimes(1);
  });

  it('never asks the reader to sign when their token is missing or has lapsed', async () => {
    // A check that found the token, then a read after it lapsed, would start a wallet sign-in.
    jest.mocked(hasCachedWorkerSessionToken).mockResolvedValue(true);
    jest.mocked(getWorkerSessionToken).mockResolvedValue('worker-session-credential');
    const { result } = mount({ sessionConfig: SALON, account: ME });
    await settle();
    expect(getWorkerSessionToken).not.toHaveBeenCalled();
    expect(loadPublicWorkerGroups).toHaveBeenCalledWith({ ...SALON, sessionSlug: 'salon' });
    expect(result.current).toEqual([]);
  });

  it('never shows another session’s groups, while its own load or when they can’t be read', async () => {
    jest.mocked(loadPublicWorkerGroups).mockResolvedValueOnce([group('salon', 'Salon')] as never);
    const { result, rerender } = mount({ sessionConfig: SALON });
    await waitFor(() => expect(result.current).toEqual([{ groupId: 'salon', label: 'Salon' }]));

    rerender({ sessionSlug: 'debate', sessionConfig: DEBATE });
    expect(result.current).toEqual([]);
    await waitFor(() => expect(loadPublicWorkerGroups).toHaveBeenLastCalledWith({ ...DEBATE, sessionSlug: 'debate' }));
    await settle();
    expect(result.current).toEqual([]);
  });

  it('drops a reader’s groups when they sign out', async () => {
    jest.mocked(getCachedWorkerSessionToken).mockResolvedValueOnce('worker-session-credential');
    const { result, rerender } = mount({ sessionConfig: SALON, account: ME });
    await waitFor(() => expect(result.current).toEqual([{ groupId: 'salon', label: 'Salon' }]));

    rerender({ sessionConfig: SALON });
    expect(result.current).toEqual([]);
    await waitFor(() => expect(loadPublicWorkerGroups).toHaveBeenCalledTimes(1));
    await settle();
    expect(result.current).toEqual([]);
  });
});
