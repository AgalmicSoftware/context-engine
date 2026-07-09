import { renderHook } from '@testing-library/react';
import useSessionWizardCleanupEffect from './useSessionWizardCleanupEffect.js';

const createTimerRef = (callback: jest.Mock) => ({
  current: setTimeout(callback, 100),
});

describe('useSessionWizardCleanupEffect', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks the wizard unmounted and clears timer refs on unmount', () => {
    const callbacks = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];
    const isMountedRef = { current: true };
    const sessionIdRotationTimerRef = createTimerRef(callbacks[0]);
    const adminUrlStatusTimerRef = createTimerRef(callbacks[1]);
    const sessionIdStatusTimerRef = createTimerRef(callbacks[2]);
    const jsonCopiedTimerRef = createTimerRef(callbacks[3]);

    const { unmount } = renderHook(() =>
      useSessionWizardCleanupEffect({
        isMountedRef,
        sessionIdRotationTimerRef,
        adminUrlStatusTimerRef,
        sessionIdStatusTimerRef,
        jsonCopiedTimerRef,
      }),
    );

    unmount();
    jest.advanceTimersByTime(100);

    expect(isMountedRef.current).toBe(false);
    expect(sessionIdRotationTimerRef.current).toBe(null);
    expect(adminUrlStatusTimerRef.current).toBe(null);
    expect(sessionIdStatusTimerRef.current).toBe(null);
    expect(jsonCopiedTimerRef.current).toBe(null);
    callbacks.forEach((callback) => {
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
