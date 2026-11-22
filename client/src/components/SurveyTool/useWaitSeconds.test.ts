import { act, renderHook } from '@testing-library/react';
import { useWaitSeconds } from './useWaitSeconds';

describe('useWaitSeconds', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts whole seconds of the current wait, from 0 for each new one, and stops when it ends', () => {
    const view = renderHook(({ wait }) => useWaitSeconds(wait), { initialProps: { wait: '' } });
    expect(view.result.current).toBe(0);
    view.rerender({ wait: 'drafting' });
    act(() => jest.advanceTimersByTime(2_500));
    expect(view.result.current).toBe(2);
    view.rerender({ wait: 'submitting' });
    expect(view.result.current).toBe(0);
    act(() => jest.advanceTimersByTime(1_000));
    expect(view.result.current).toBe(1);
    view.rerender({ wait: '' });
    expect(view.result.current).toBe(0);
    act(() => jest.advanceTimersByTime(5_000));
    expect(view.result.current).toBe(0);
    // The same wait started again counts afresh, not on from where it stopped.
    view.rerender({ wait: 'submitting' });
    expect(view.result.current).toBe(0);
  });

  it('shows the true time when a phone held back the ticks of a background tab', () => {
    const view = renderHook(() => useWaitSeconds('submitting'));
    act(() => jest.setSystemTime(Date.now() + 60_000));
    act(() => jest.advanceTimersByTime(1_000));
    expect(view.result.current).toBe(61);
  });
});
