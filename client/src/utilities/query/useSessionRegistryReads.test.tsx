import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { appQueryFoundation } from '../../app/runtime/appQueryClient';
import { useSessionRegistryReads } from './useSessionRegistryReads';

const mockGetAllSessionSlugs = jest.fn();
const mockGetSessionConfigBySlug = jest.fn();
const mockSubscribeToCacheUpdates = jest.fn(
  (target: Window, listener: EventListenerOrEventListenerObject) => {
    target.addEventListener('ce:session-registry-cache-updated', listener);
    return () => target.removeEventListener('ce:session-registry-cache-updated', listener);
  },
);

jest.mock('../../app/runtime/appWagmiRuntime', () => ({
  wagmiClient: (() => {
    const { QueryClient } = jest.requireActual('@tanstack/react-query');
    return {
      queryClient: new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      }),
    };
  })(),
}));

jest.mock('../../domains/sessions/registry/sessionRegistryReadPorts.js', () => ({
  __esModule: true,
  sessionRegistryReadsPort: {
    getAllSessionSlugs: (...args: any[]) => mockGetAllSessionSlugs(...args),
    getSessionConfigBySlug: (...args: any[]) => mockGetSessionConfigBySlug(...args),
    subscribeToCacheUpdates: (...args: any[]) => mockSubscribeToCacheUpdates(...args),
  },
}));

const QueryWrapper = ({ children }: { children: ReactNode }) => {
  const Provider = appQueryFoundation.Provider;
  return <Provider>{children}</Provider>;
};

describe('useSessionRegistryReads', () => {
  beforeEach(() => {
    appQueryFoundation.client.clear();
    mockGetAllSessionSlugs.mockReturnValue(['', 'edge']);
    mockGetSessionConfigBySlug.mockImplementation((slug) =>
      slug ? { slug, sessionName: `${slug} session` } : null,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('builds a frozen scalar key for the registry snapshot', () => {
    renderHook(() => useSessionRegistryReads({ chainId: '11155420' }), {
      wrapper: QueryWrapper,
    });
    const [query] = appQueryFoundation.client.getQueryCache().getAll();
    const key = query.queryKey;

    expect(key).toEqual(['sessions', 'registry', 11155420, null, null, 'snapshot']);
    expect(Object.isFrozen(key)).toBe(true);
  });

  it('resolves the shared app client and preserves synchronous mount data', () => {
    const { result } = renderHook(() => useSessionRegistryReads({ chainId: 84532 }), {
      wrapper: QueryWrapper,
    });

    expect(result.current.queryClient).toBe(appQueryFoundation.client);
    expect(result.current.snapshotQuery.data).toEqual({
      slugs: ['', 'edge'],
      configsBySlug: {
        edge: { slug: 'edge', sessionName: 'edge session' },
      },
    });
    expect(mockGetAllSessionSlugs).toHaveBeenCalledTimes(1);
    expect(mockGetAllSessionSlugs).toHaveBeenCalledWith({ includeEmpty: true });
    expect(mockGetSessionConfigBySlug).toHaveBeenCalledTimes(1);
    expect(mockGetSessionConfigBySlug).toHaveBeenCalledWith('edge');
  });

  it('invalidates the registry family and refetches on the cache event', async () => {
    const invalidateQueries = jest.spyOn(appQueryFoundation.client, 'invalidateQueries');
    const { result, unmount } = renderHook(() => useSessionRegistryReads({ chainId: 84532 }), {
      wrapper: QueryWrapper,
    });

    mockGetAllSessionSlugs.mockReturnValue(['', 'edge', 'alpha']);
    act(() => {
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
    });

    await waitFor(() => {
      expect(result.current.snapshotQuery.data?.slugs).toEqual(['', 'edge', 'alpha']);
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['sessions', 'registry'],
    });
    expect(mockGetAllSessionSlugs).toHaveBeenCalledTimes(2);
    expect(mockSubscribeToCacheUpdates).toHaveBeenCalledTimes(1);

    unmount();
  });
});
