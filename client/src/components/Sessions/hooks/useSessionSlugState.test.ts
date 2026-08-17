import { act, renderHook } from '@testing-library/react';
import useSessionSlugState from './useSessionSlugState.js';

describe('useSessionSlugState', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('starts with idle slug availability', () => {
    const sessionExists = jest.fn();
    const { result } = renderHook(() =>
      useSessionSlugState({
        slug: '',
        privateSlugMode: false,
        registryChainId: 11155420,
        sessionExists,
      }),
    );

    expect(result.current.slugAvailability).toEqual({ status: 'idle' });
  });

  it('does not schedule or invoke a slug authority port while disabled', () => {
    jest.useFakeTimers();
    const sessionExists = jest.fn();
    const { result } = renderHook(() =>
      useSessionSlugState({
        enabled: false,
        slug: 'worker-session',
        privateSlugMode: false,
        registryChainId: 11155420,
        sessionExists,
      }),
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(sessionExists).not.toHaveBeenCalled();
    expect(result.current.slugAvailability).toEqual({ status: 'idle' });
  });

  it('invalidates an in-flight authority check when the hook is disabled', async () => {
    jest.useFakeTimers();
    let resolveExists: ((exists: boolean) => void) | undefined;
    const sessionExists = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveExists = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useSessionSlugState({
          enabled,
          slug: 'worker-session',
          privateSlugMode: false,
          registryChainId: 11155420,
          sessionExists,
        }),
      { initialProps: { enabled: true } },
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(sessionExists).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    await act(async () => {
      resolveExists?.(true);
      await Promise.resolve();
    });

    expect(result.current.slugAvailability).toEqual({ status: 'idle' });
  });

  it('cleans up a pending slug timer on unmount', () => {
    jest.useFakeTimers();
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const sessionExists = jest.fn();
    const { unmount } = renderHook(() =>
      useSessionSlugState({
        slug: 'available-session',
        privateSlugMode: false,
        registryChainId: 11155420,
        sessionExists,
      }),
    );

    expect(jest.getTimerCount()).toBe(1);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('resets checking slug availability back to idle', () => {
    jest.useFakeTimers();
    const sessionExists = jest.fn(
      (_args: { registryChainId?: unknown; slug: string }) => new Promise<boolean>(() => {}),
    );
    const { result } = renderHook(() =>
      useSessionSlugState({
        slug: 'available-session',
        privateSlugMode: false,
        registryChainId: 11155420,
        sessionExists,
      }),
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(sessionExists).toHaveBeenCalledWith({
      registryChainId: 11155420,
      slug: 'available-session',
    });
    expect(result.current.slugAvailability).toEqual({ status: 'checking' });

    act(() => {
      result.current.resetSlugAvailability();
    });

    expect(result.current.slugAvailability).toEqual({ status: 'idle' });
  });

  it('reflects injected registry check results for public slugs', async () => {
    jest.useFakeTimers();
    const sessionExists = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { result, rerender } = renderHook(
      ({ slug }) =>
        useSessionSlugState({
          slug,
          privateSlugMode: false,
          registryChainId: 11155420,
          sessionExists,
        }),
      { initialProps: { slug: 'taken-session' } },
    );

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sessionExists).toHaveBeenNthCalledWith(1, {
      registryChainId: 11155420,
      slug: 'taken-session',
    });
    expect(result.current.slugAvailability).toEqual({ status: 'taken' });

    rerender({ slug: 'open-session' });
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sessionExists).toHaveBeenNthCalledWith(2, {
      registryChainId: 11155420,
      slug: 'open-session',
    });
    expect(result.current.slugAvailability).toEqual({ status: 'available' });
  });

  it('marks public slug availability as error when the registry check rejects', async () => {
    jest.useFakeTimers();
    const sessionExists = jest.fn().mockRejectedValueOnce(new Error('registry unavailable'));
    const { result } = renderHook(() =>
      useSessionSlugState({
        slug: 'error-session',
        privateSlugMode: false,
        registryChainId: 11155420,
        sessionExists,
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sessionExists).toHaveBeenCalledWith({
      registryChainId: 11155420,
      slug: 'error-session',
    });
    expect(result.current.slugAvailability).toEqual({ status: 'error' });
  });
});
