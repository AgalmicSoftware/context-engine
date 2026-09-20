import { act, renderHook, waitFor } from '@testing-library/react';
import { useInterviewReadiness } from './useInterviewReadiness';

const originalFetch = global.fetch;
const mediaDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const permissionsDescriptor = Object.getOwnPropertyDescriptor(navigator, 'permissions');
const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: jest.fn() } });
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: jest.fn(async () => ({ state: 'prompt' })) },
  });
});
afterEach(() => {
  global.fetch = originalFetch;
  for (const [name, descriptor] of [
    ['mediaDevices', mediaDescriptor],
    ['permissions', permissionsDescriptor],
  ] as const) {
    if (descriptor) Object.defineProperty(navigator, name, descriptor);
    else Reflect.deleteProperty(navigator, name);
  }
});

it.each([
  [{ interview: { ready: true } }, 'ready'],
  [{ interview: { ready: false, reason: 'Configure voice access.' } }, 'unavailable'],
  [{ resources: { ai: true } }, 'unknown'],
] as const)('uses explicit voice readiness and treats old Workers as unverified: %j', async (body, state) => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => body });
  const { result } = renderHook(() => useInterviewReadiness('https://worker.example/', 'demo'));
  expect(result.current.state).toBe('checking');
  await waitFor(() => expect(result.current.state).toBe(state));
  expect(fetchMock).toHaveBeenCalledWith(
    'https://worker.example/resource-presence?interview=1',
    expect.objectContaining({ headers: { 'X-Session-Slug': 'demo' } }),
  );
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
});

it('reports blocked microphone permission without requesting capture', async () => {
  jest.mocked(navigator.permissions.query).mockResolvedValue({ state: 'denied' } as PermissionStatus);
  const { result } = renderHook(() => useInterviewReadiness('https://worker.example', 'demo'));
  await waitFor(() => expect(result.current.state).toBe('unavailable'));
  expect(result.current.detail).toContain('Allow microphone access');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('can retry a failed readiness check', async () => {
  fetchMock
    .mockRejectedValueOnce(new Error('Network'))
    .mockResolvedValue({ ok: true, json: async () => ({ interview: { ready: true } }) });
  const { result } = renderHook(() => useInterviewReadiness('https://worker.example', 'demo'));
  await waitFor(() => expect(result.current.state).toBe('unknown'));
  act(() => result.current.retry());
  expect(result.current.state).toBe('checking');
  await waitFor(() => expect(result.current.state).toBe('ready'));
});

it('aborts old checks and ignores their late completion when switching Workers', async () => {
  let finish!: (value: unknown) => void;
  fetchMock
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({ ok: true, json: async () => ({ interview: { ready: false } }) });
  const { result, rerender, unmount } = renderHook(({ url }) => useInterviewReadiness(url, 'demo'), {
    initialProps: { url: 'https://old.example' },
  });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const signal = fetchMock.mock.calls[0][1].signal;
  rerender({ url: 'https://new.example' });
  expect(signal.aborted).toBe(true);
  await waitFor(() => expect(result.current.state).toBe('unavailable'));
  await act(async () => finish({ ok: true, json: async () => ({ interview: { ready: true } }) }));
  expect(result.current.state).toBe('unavailable');
  unmount();
  expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true);
});
