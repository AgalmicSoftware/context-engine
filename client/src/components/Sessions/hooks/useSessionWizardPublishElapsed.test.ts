import { act, renderHook } from '@testing-library/react';
import useSessionWizardPublishElapsed from './useSessionWizardPublishElapsed.js';

describe('useSessionWizardPublishElapsed', () => {
  let now = 1000;
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.useFakeTimers();
    now = 1000;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    jest.useRealTimers();
  });

  it('resets elapsed time when publish is idle', () => {
    const setPublishStepElapsedMs = jest.fn();

    renderHook(() =>
      useSessionWizardPublishElapsed({
        publishBusy: false,
        publishStep: 0,
        setPublishStepElapsedMs,
      }),
    );

    expect(setPublishStepElapsedMs).toHaveBeenCalledWith(0);
  });

  it('ticks elapsed time while a publish step is active', () => {
    const setPublishStepElapsedMs = jest.fn();

    renderHook(() =>
      useSessionWizardPublishElapsed({
        publishBusy: true,
        publishStep: 2,
        setPublishStepElapsedMs,
      }),
    );

    expect(setPublishStepElapsedMs).toHaveBeenCalledWith(0);

    now = 1240;
    act(() => {
      jest.advanceTimersByTime(240);
    });

    expect(setPublishStepElapsedMs).toHaveBeenLastCalledWith(240);
  });

  it('clears the timer on unmount', () => {
    const setPublishStepElapsedMs = jest.fn();
    const { unmount } = renderHook(() =>
      useSessionWizardPublishElapsed({
        publishBusy: true,
        publishStep: 1,
        setPublishStepElapsedMs,
      }),
    );

    unmount();
    now = 2000;
    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(setPublishStepElapsedMs).toHaveBeenCalledTimes(1);
  });
});
