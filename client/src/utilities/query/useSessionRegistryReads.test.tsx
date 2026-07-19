import React, { type ReactNode } from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { appQueryFoundation } from '../../app/runtime/appQueryClient';
import { useSessionRegistryReads } from './useSessionRegistryReads';

const mockGetAllSessionSlugs = jest.fn();
const mockGetSessionConfigBySlug = jest.fn();
const mockSubscribeToCacheUpdates = jest.fn((target: Window, listener: EventListenerOrEventListenerObject) => {
  target.addEventListener('ce:session-registry-cache-updated', listener);
  return () => target.removeEventListener('ce:session-registry-cache-updated', listener);
});

jest.mock('../../domains/sessions/registry/sessionRegistryReadPorts.js', () => ({
  __esModule: true,
  sessionRegistryReadsPort: {
    getAllSessionSlugs: (...args: any[]) => mockGetAllSessionSlugs(...args),
    getSessionConfigBySlug: (...args: any[]) => mockGetSessionConfigBySlug(...args),
    subscribeToCacheUpdates: (...args: any[]) => mockSubscribeToCacheUpdates(...args),
  },
}));

jest.mock('../../app/runtime/appWagmiRuntime', () => ({
  wagmiClient: (() => {
    const { QueryClient: TestQueryClient } = jest.requireActual('@tanstack/react-query');
    return { queryClient: new TestQueryClient({ defaultOptions: { queries: { retry: false } } }) };
  })(),
}));

let queryClient: QueryClient;

const QueryWrapper = ({ children }: { children: ReactNode }) => {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const AppQueryClientProvider = appQueryFoundation.Provider;

const RegistrySnapshotProbe = () => {
  const { snapshotQuery } = useSessionRegistryReads({ chainId: 84532 });
  return <output data-testid="registry-snapshot-slugs">{snapshotQuery.data?.slugs.join('|') || ''}</output>;
};

const AppRegistryHarness = ({ showConsumer = true }: { showConsumer?: boolean }) => (
  <AppQueryClientProvider>{showConsumer ? <RegistrySnapshotProbe /> : null}</AppQueryClientProvider>
);

describe('useSessionRegistryReads', () => {
  const appScope = { scope: 'ce-app', persist: false };
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockGetAllSessionSlugs.mockReturnValue(['', 'edge']);
    mockGetSessionConfigBySlug.mockImplementation((slug) => (slug ? { slug, sessionName: `${slug} session` } : null));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('builds a frozen app-scoped key for the registry snapshot', () => {
    renderHook(() => useSessionRegistryReads({ chainId: '11155420' }), {
      wrapper: QueryWrapper,
    });
    const [query] = queryClient.getQueryCache().getAll();
    const key = query.queryKey;

    expect(key).toEqual([appScope, 'sessions', 'registry', 11155420, null, null, 'snapshot']);
    expect(Object.isFrozen(key)).toBe(true);
  });

  it('resolves the provider client and preserves synchronous mount data', () => {
    const { result } = renderHook(() => useSessionRegistryReads({ chainId: 84532 }), {
      wrapper: QueryWrapper,
    });

    expect(result.current.queryClient).toBe(queryClient);
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

  it('keeps requested-only config reads isolated from the registry list projection', () => {
    const { result } = renderHook(
      () =>
        useSessionRegistryReads({
          chainId: 84532,
          includeRegistryList: false,
          sessionSlugs: ['edge'],
        }),
      { wrapper: QueryWrapper },
    );
    const [query] = queryClient.getQueryCache().getAll();

    expect(query.queryKey).toEqual([
      appScope,
      'sessions',
      'registry',
      84532,
      null,
      null,
      'snapshot',
      'requested-only',
      'edge',
    ]);
    expect(result.current.snapshotQuery.data).toEqual({
      slugs: [],
      configsBySlug: {
        edge: { slug: 'edge', sessionName: 'edge session' },
      },
    });
    expect(mockGetAllSessionSlugs).not.toHaveBeenCalled();
    expect(mockGetSessionConfigBySlug).toHaveBeenCalledWith('edge');
  });

  it('invalidates and refetches an active registry query exactly once per cache event', async () => {
    queryClient = appQueryFoundation.client;
    queryClient.clear();
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const view = render(<AppRegistryHarness />);

    expect(screen.getByTestId('registry-snapshot-slugs')).toHaveTextContent('|edge');

    mockGetAllSessionSlugs.mockReturnValue(['', 'edge', 'alpha']);
    act(() => {
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('registry-snapshot-slugs')).toHaveTextContent('|edge|alpha');
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenLastCalledWith({
      queryKey: [appScope, 'sessions', 'registry'],
    });
    expect(mockGetAllSessionSlugs).toHaveBeenCalledTimes(2);
    expect(mockSubscribeToCacheUpdates).toHaveBeenCalledTimes(1);

    view.unmount();
    act(() => {
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });

  it('refetches a registry write while the provider stays mounted without a consumer', async () => {
    queryClient = appQueryFoundation.client;
    queryClient.clear();
    const view = render(<AppRegistryHarness />);

    expect(screen.getByTestId('registry-snapshot-slugs')).toHaveTextContent('|edge');
    view.rerender(<AppRegistryHarness showConsumer={false} />);
    expect(screen.queryByTestId('registry-snapshot-slugs')).not.toBeInTheDocument();

    mockGetAllSessionSlugs.mockReturnValue(['', 'edge', 'alpha']);
    act(() => {
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
    });

    view.rerender(<AppRegistryHarness />);
    await waitFor(() => {
      expect(screen.getByTestId('registry-snapshot-slugs')).toHaveTextContent('|edge|alpha');
    });
    expect(mockGetAllSessionSlugs).toHaveBeenCalledTimes(2);
    expect(mockSubscribeToCacheUpdates).toHaveBeenCalledTimes(1);

    view.unmount();
    queryClient.clear();
  });

  it('shares one registry listener until the last provider for a client unmounts', () => {
    queryClient = appQueryFoundation.client;
    queryClient.clear();
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const firstProvider = render(<AppQueryClientProvider>{null}</AppQueryClientProvider>);
    const secondProvider = render(<AppQueryClientProvider>{null}</AppQueryClientProvider>);

    expect(mockSubscribeToCacheUpdates).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);

    firstProvider.unmount();
    act(() => {
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(2);

    secondProvider.unmount();
    act(() => {
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    queryClient.clear();
  });
});
