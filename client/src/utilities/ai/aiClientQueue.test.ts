import { createQueuedAiCallRunner, isTransientAiQueueError } from './aiClientQueue';

const flushMicrotasks = (): Promise<void> => Promise.resolve();

describe('aiClientQueue', () => {
  it('classifies the same transient worker overload messages as retryable', () => {
    expect(isTransientAiQueueError(new Error('rate limit exceeded'))).toBe(true);
    expect(isTransientAiQueueError(new Error('Worker is temporarily overloaded, try again'))).toBe(true);
    expect(isTransientAiQueueError(new Error('HTTP 429'))).toBe(true);
    expect(isTransientAiQueueError(new Error('invalid prompt'))).toBe(false);
  });

  it('retries transient failures with the existing exponential jitter formula', async () => {
    const delays: number[] = [];
    const enqueue = createQueuedAiCallRunner({
      delay: async (ms) => {
        delays.push(ms);
      },
      random: () => 0.5,
    });
    const invoke = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('rate limit exceeded'))
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValueOnce('ok');

    await expect(enqueue(invoke)).resolves.toBe('ok');

    expect(invoke).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([600, 1100]);
  });

  it('does not retry non-transient failures', async () => {
    const delay = jest.fn<Promise<void>, [number]>();
    const enqueue = createQueuedAiCallRunner({ delay });
    const error = new Error('invalid prompt');
    const invoke = jest.fn<Promise<string>, []>().mockRejectedValue(error);

    await expect(enqueue(invoke)).rejects.toBe(error);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it('serializes calls and continues after a queued failure', async () => {
    const enqueue = createQueuedAiCallRunner({
      delay: async () => {},
      random: () => 0,
    });
    const events: string[] = [];
    let releaseFirst: () => void = () => {};
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = enqueue(async () => {
      events.push('first-start');
      await firstBlocked;
      events.push('first-end');
      throw new Error('invalid prompt');
    }).catch((error: unknown) => {
      events.push(`first-error:${String((error as Error).message || '')}`);
    });
    const second = enqueue(async () => {
      events.push('second-start');
      return 'second';
    });

    await flushMicrotasks();
    expect(events).toEqual(['first-start']);

    releaseFirst();
    await first;
    await expect(second).resolves.toBe('second');

    expect(events).toEqual(['first-start', 'first-end', 'first-error:invalid prompt', 'second-start']);
  });
});
