import {
  GAS_FALLBACKS,
  SBT_TOKENURI_METADATA_TIMEOUT_MS,
  runWithSoftTimeout,
} from './contractScripts.corePureHelpers.js';

describe('contractScripts core pure helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('passes through the original result when timeout is disabled', async () => {
    await expect(runWithSoftTimeout(Promise.resolve('ready'), { timeoutMs: 0 })).resolves.toBe('ready');
  });

  it('falls back softly on timeout and calls the timeout hook once', async () => {
    const onTimeout = jest.fn();
    const pending = new Promise(() => {});
    const wrapped = runWithSoftTimeout(pending, {
      timeoutMs: 25,
      fallbackValue: 'fallback',
      onTimeout,
    });

    jest.advanceTimersByTime(25);

    await expect(wrapped).resolves.toBe('fallback');
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('preserves original rejections when the task fails before timing out', async () => {
    const wrapped = runWithSoftTimeout(Promise.reject(new Error('boom')), {
      timeoutMs: 25,
      fallbackValue: 'fallback',
    });

    await expect(wrapped).rejects.toThrow('boom');
  });

  it('keeps the documented timeout and gas fallback scaling constants stable', () => {
    expect(SBT_TOKENURI_METADATA_TIMEOUT_MS).toBe(4000);
    expect(GAS_FALLBACKS.addSurvey(0)).toBe(280000);
    expect(GAS_FALLBACKS.createSBTDeterministicConfigured(2)).toBe(5700000);
    expect(GAS_FALLBACKS.addHashedPasswords(0)).toBe(280000);
  });
});
