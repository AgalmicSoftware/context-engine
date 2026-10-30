import { act, renderHook } from '@testing-library/react';
import { jest } from '@jest/globals';
import { useRecordingWakeLock } from './useRecordingWakeLock';

const originalWakeLock = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
let request: jest.Mock<(kind: string) => Promise<ReturnType<typeof makeLock>>>;
const makeLock = () => {
  let onRelease = () => {};
  const lock = {
    released: false,
    release: jest.fn(async () => {
      lock.released = true;
      onRelease();
    }),
    addEventListener: jest.fn((_event: string, callback: () => void) => {
      onRelease = callback;
    }),
  };
  return lock;
};
const visible = (state: string) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
};
beforeEach(() => {
  request = jest.fn<(kind: string) => Promise<ReturnType<typeof makeLock>>>();
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  visible('visible');
});
afterEach(() => {
  if (originalWakeLock) Object.defineProperty(navigator, 'wakeLock', originalWakeLock);
  else Reflect.deleteProperty(navigator, 'wakeLock');
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
  else Reflect.deleteProperty(document, 'visibilityState');
});

it('holds the screen while recording, reacquires after returning and releases on stop', async () => {
  const first = makeLock();
  const second = makeLock();
  request.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  const { result, rerender } = renderHook(({ active }) => useRecordingWakeLock(active), {
    initialProps: { active: true },
  });
  await act(async () => {});
  expect(request).toHaveBeenCalledWith('screen');
  expect(result.current.wakeLockHeld).toBe(true);
  await act(async () => {
    visible('hidden');
  });
  expect(result.current.pageHidden).toBe(true);
  expect(first.release).toHaveBeenCalledTimes(1);
  expect(result.current.wakeLockHeld).toBe(false);
  await act(async () => {
    visible('visible');
  });
  expect(result.current.pageHidden).toBe(false);
  expect(result.current.wakeLockHeld).toBe(true);
  rerender({ active: false });
  expect(second.release).toHaveBeenCalledTimes(1);
  expect(result.current.wakeLockHeld).toBe(false);
});

it('releases a pending grant after unmount and never leaves the screen held', async () => {
  const lock = makeLock();
  let resolve: (value: typeof lock) => void = () => {};
  request.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { unmount } = renderHook(() => useRecordingWakeLock(true));
  unmount();
  await act(async () => {
    resolve(lock);
  });
  expect(lock.release).toHaveBeenCalledTimes(1);
});

it('keeps recording usable when the API is missing or refuses the lock', async () => {
  request.mockRejectedValue(new Error('power saving'));
  const { result, unmount } = renderHook(() => useRecordingWakeLock(true));
  await act(async () => {});
  expect(result.current.wakeLockHeld).toBe(false);
  unmount();
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined });
  const missing = renderHook(() => useRecordingWakeLock(true));
  expect(missing.result.current.wakeLockHeld).toBe(false);
});
