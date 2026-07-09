import { createSurveyResultsLocalStoragePollingRuntime } from './surveyResultsLocalStoragePollingRuntime';

describe('surveyResultsLocalStoragePollingRuntime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('schedules polls with the existing min-mid-max stable backoff cadence', () => {
    const pollLocalStorageForUpdates = jest.fn(() => false);
    const runtime = createSurveyResultsLocalStoragePollingRuntime({
      minDelayMs: 20,
      midDelayMs: 40,
      maxDelayMs: 120,
      isOpen: () => true,
      isDocumentHidden: () => false,
      isMounted: () => true,
      pollLocalStorageForUpdates,
    });

    runtime.start();
    expect(runtime.hasScheduledPoll()).toBe(true);
    expect(runtime.getDelayMs()).toBe(20);

    jest.advanceTimersByTime(19);
    expect(pollLocalStorageForUpdates).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(pollLocalStorageForUpdates).toHaveBeenCalledTimes(1);
    expect(runtime.getStableCycles()).toBe(1);
    expect(runtime.getDelayMs()).toBe(40);
    expect(runtime.hasScheduledPoll()).toBe(true);

    jest.advanceTimersByTime(40);
    expect(pollLocalStorageForUpdates).toHaveBeenCalledTimes(2);
    expect(runtime.getStableCycles()).toBe(2);
    expect(runtime.getDelayMs()).toBe(120);
  });

  it('resets to the minimum delay after an observed cache change', () => {
    const pollLocalStorageForUpdates = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const runtime = createSurveyResultsLocalStoragePollingRuntime({
      minDelayMs: 20,
      midDelayMs: 40,
      maxDelayMs: 120,
      isOpen: () => true,
      isDocumentHidden: () => false,
      isMounted: () => true,
      pollLocalStorageForUpdates,
    });

    runtime.start();
    jest.advanceTimersByTime(20);
    expect(runtime.getStableCycles()).toBe(1);
    expect(runtime.getDelayMs()).toBe(40);

    jest.advanceTimersByTime(40);
    expect(runtime.getStableCycles()).toBe(0);
    expect(runtime.getDelayMs()).toBe(20);
  });

  it('stops scheduled work and never polls while hidden or closed', () => {
    let open = false;
    let hidden = false;
    const pollLocalStorageForUpdates = jest.fn(() => false);
    const runtime = createSurveyResultsLocalStoragePollingRuntime({
      minDelayMs: 20,
      midDelayMs: 40,
      maxDelayMs: 120,
      isOpen: () => open,
      isDocumentHidden: () => hidden,
      isMounted: () => true,
      pollLocalStorageForUpdates,
    });

    runtime.start();
    expect(runtime.hasScheduledPoll()).toBe(false);

    open = true;
    hidden = true;
    runtime.start();
    expect(runtime.hasScheduledPoll()).toBe(false);

    hidden = false;
    runtime.start();
    expect(runtime.hasScheduledPoll()).toBe(true);

    runtime.stop();
    expect(runtime.hasScheduledPoll()).toBe(false);
    jest.advanceTimersByTime(20);
    expect(pollLocalStorageForUpdates).not.toHaveBeenCalled();
  });

  it('matches callback-time hidden and unmounted guards', () => {
    let hidden = false;
    let mounted = true;
    const pollLocalStorageForUpdates = jest.fn(() => false);
    const runtime = createSurveyResultsLocalStoragePollingRuntime({
      minDelayMs: 20,
      midDelayMs: 40,
      maxDelayMs: 120,
      isOpen: () => true,
      isDocumentHidden: () => hidden,
      isMounted: () => mounted,
      pollLocalStorageForUpdates,
    });

    runtime.start();
    hidden = true;
    jest.advanceTimersByTime(20);
    expect(pollLocalStorageForUpdates).not.toHaveBeenCalled();
    expect(runtime.hasScheduledPoll()).toBe(false);

    hidden = false;
    runtime.start();
    mounted = false;
    jest.advanceTimersByTime(20);
    expect(pollLocalStorageForUpdates).not.toHaveBeenCalled();
    expect(runtime.hasScheduledPoll()).toBe(false);
  });

  it('invokes signature invalidation only for explicit reset reasons', () => {
    const onResetWithReason = jest.fn();
    const runtime = createSurveyResultsLocalStoragePollingRuntime({
      minDelayMs: 20,
      midDelayMs: 40,
      maxDelayMs: 120,
      isOpen: () => true,
      isDocumentHidden: () => false,
      isMounted: () => true,
      pollLocalStorageForUpdates: () => false,
      onResetWithReason,
    });

    runtime.updateBackoff(false);
    expect(runtime.getStableCycles()).toBe(1);

    runtime.resetBackoff();
    expect(runtime.getStableCycles()).toBe(0);
    expect(onResetWithReason).not.toHaveBeenCalled();

    runtime.updateBackoff(false);
    runtime.resetBackoff('manual-refresh');
    expect(runtime.getStableCycles()).toBe(0);
    expect(onResetWithReason).toHaveBeenCalledWith('manual-refresh');
  });
});
