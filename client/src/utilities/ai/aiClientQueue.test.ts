import { createQueuedAiCallRunner, isAiRequestWithoutReply, isTransientAiQueueError } from './aiClientQueue';

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

  it("knows each browser's words for a request that got no reply", () => {
    expect(isAiRequestWithoutReply('Failed to fetch')).toBe(true);
    expect(isAiRequestWithoutReply('Load failed')).toBe(true);
    expect(isAiRequestWithoutReply('NetworkError when attempting to fetch resource.')).toBe(true);
    expect(isAiRequestWithoutReply('NetworkError when attempting to fetch resource')).toBe(true);
    expect(isAiRequestWithoutReply('Failed to fetch dynamically imported module')).toBe(false);
    expect(isAiRequestWithoutReply('Rate limit exceeded.')).toBe(false);
  });

  it.each(['Load failed', 'Failed to fetch'])(
    'sends a request lost on the way (%s) once more, without waiting',
    async (lost) => {
      const delay = jest.fn<Promise<void>, [number]>();
      const enqueue = createQueuedAiCallRunner({ delay });
      const invoke = jest
        .fn<Promise<string>, []>()
        .mockRejectedValueOnce(new TypeError(lost))
        .mockResolvedValueOnce('ok');

      await expect(enqueue(invoke)).resolves.toBe('ok');

      expect(invoke).toHaveBeenCalledTimes(2);
      expect(delay).not.toHaveBeenCalled();
    },
  );

  it('gives up when the second try gets no reply either', async () => {
    const enqueue = createQueuedAiCallRunner({ delay: async () => {} });
    const lost = new TypeError('Load failed');
    const invoke = jest.fn<Promise<string>, []>().mockRejectedValue(lost);

    await expect(enqueue(invoke)).rejects.toBe(lost);

    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('sends again once per call: a second lost request ends the call, the next call gets its own', async () => {
    const enqueue = createQueuedAiCallRunner({ delay: async () => {}, random: () => 0 });
    const lost = new TypeError('Load failed');
    const first = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new Error('rate limit exceeded'))
      .mockRejectedValueOnce(lost)
      .mockResolvedValueOnce('too late');
    const second = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValueOnce('ok');

    await expect(enqueue(first)).rejects.toBe(lost);
    await expect(enqueue(second)).resolves.toBe('ok');

    expect(first).toHaveBeenCalledTimes(3);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('does not send again an error that only reads like a lost request', async () => {
    const enqueue = createQueuedAiCallRunner({ delay: async () => {} });
    const refused = new Error('Load failed');
    const invoke = jest.fn<Promise<string>, []>().mockRejectedValue(refused);

    await expect(enqueue(invoke)).rejects.toBe(refused);

    expect(invoke).toHaveBeenCalledTimes(1);
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
