import { act, renderHook, waitFor } from '@testing-library/react';

import { useContextGroups } from './useContextGroups';
import { loadPublicWorkerGroups, loadWorkerGroupOverview } from '../../domains/worker/workerGroupPorts';
import {
  getWorkerSessionToken,
  hasCachedWorkerSessionToken,
  subscribeWorkerSessionToken,
} from '../worker/workerAuth.js';

jest.mock('../../domains/worker/workerGroupPorts', () => ({
  loadPublicWorkerGroups: jest.fn(),
  loadWorkerGroupOverview: jest.fn(),
}));
jest.mock('../worker/workerAuth.js', () => ({
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
const forbidden = () => Object.assign(new Error('worker_group_discovery_not_public'), { status: 403 });
const group = (groupId: string, label: string) => ({ groupId, label, sessionSlug: 'salon' });

type Props = { sessionConfig: Record<string, string>; account?: string };
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
    jest.mocked(hasCachedWorkerSessionToken).mockResolvedValue(false);
    jest.mocked(getWorkerSessionToken).mockResolvedValue('worker-session-credential');
    // A private session refuses the anonymous list.
    jest.mocked(loadPublicWorkerGroups).mockRejectedValue(forbidden());
    jest.mocked(loadWorkerGroupOverview).mockResolvedValue({
      groups: [group('salon', 'Salon')] as never,
      memberships: [],
    });
  });

  it('lists a private session’s groups for a reader signed in to its Worker', async () => {
    jest.mocked(hasCachedWorkerSessionToken).mockResolvedValue(true);
    const { result } = mount({ sessionConfig: SALON, account: ME });
    await waitFor(() => expect(result.current).toEqual([{ groupId: 'salon', label: 'Salon' }]));
    expect(hasCachedWorkerSessionToken).toHaveBeenCalledWith(expect.objectContaining({ context: { account: ME } }));
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

    jest.mocked(hasCachedWorkerSessionToken).mockResolvedValue(true);
    act(() => hearToken());
    await waitFor(() => expect(result.current).toEqual([{ groupId: 'salon', label: 'Salon' }]));
    expect(loadWorkerGroupOverview).toHaveBeenCalledTimes(1);
  });
});
