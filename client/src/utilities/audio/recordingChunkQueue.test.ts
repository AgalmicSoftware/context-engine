import { RecordingChunkQueue } from './recordingChunkQueue';
import {
  clearRecordingChunks,
  listRecordingChunks,
  putRecordingChunk,
  type RecordingChunk,
} from './recordingChunkStore';

jest.mock('./recordingChunkStore', () => ({
  clearRecordingChunks: jest.fn(),
  listRecordingChunks: jest.fn(),
  putRecordingChunk: jest.fn(),
}));
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const audio = new Blob(['recorded audio'], { type: 'audio/webm' });
let saved: Map<string, RecordingChunk>;
let queues: RecordingChunkQueue[];
type Transcribe = (audio: Blob, labels: boolean, signal: AbortSignal) => Promise<{ text: string }>;
const create = (transcribe: Transcribe = jest.fn(async () => ({ text: 'Speech.' })), scope = 'room') => {
  const queue = new RecordingChunkQueue({ scope, transcribe, onChange: jest.fn() });
  queues.push(queue);
  return queue;
};
beforeEach(() => {
  jest.useFakeTimers();
  // Exact backoff timings below assume no jitter; the jitter test sets its own values.
  jest.spyOn(Math, 'random').mockReturnValue(0);
  saved = new Map();
  queues = [];
  (listRecordingChunks as jest.MockedFunction<typeof listRecordingChunks>).mockImplementation(async (scope: string) =>
    [...saved.values()].filter((entry) => entry.scope === scope),
  );
  (putRecordingChunk as jest.MockedFunction<typeof putRecordingChunk>).mockImplementation(
    async (record: RecordingChunk) => {
      saved.set(record.segment.id, { ...record, segment: { ...record.segment } });
    },
  );
  (clearRecordingChunks as jest.MockedFunction<typeof clearRecordingChunks>).mockImplementation(async () =>
    saved.clear(),
  );
});
afterEach(() => {
  queues.forEach((queue) => queue.dispose());
  jest.useRealTimers();
  jest.clearAllMocks();
  jest.mocked(Math.random).mockRestore();
});

it('retries the first chunk with backoff before uploading later chunks', async () => {
  const calls: Blob[] = [];
  const transcribe = jest.fn(async (blob: Blob) => {
    calls.push(blob);
    if (calls.length < 3) throw new Error('503');
    return { text: 'Saved.' };
  });
  const queue = create(transcribe);
  await queue.ready;
  const first = queue.begin(false);
  queue.capture(first, audio, true);
  const later = new Blob(['later']);
  const second = queue.begin(false);
  queue.capture(second, later, true);
  await tick();
  expect(calls).toEqual([audio]);
  await jest.advanceTimersByTimeAsync(999);
  expect(calls).toHaveLength(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(calls).toEqual([audio, audio]);
  await jest.advanceTimersByTimeAsync(2000);
  await tick();
  expect(calls).toEqual([audio, audio, audio, later]);
  expect(queue.segments.map((segment) => segment.status)).toEqual(['complete', 'complete']);
  expect([...saved.values()].every((record) => !record.audio)).toBe(true);
});

it('abandons an upload that never answers, retries it, then uploads later chunks', async () => {
  const signals: AbortSignal[] = [];
  const transcribe = jest.fn((_blob: Blob, _labels: boolean, signal: AbortSignal) => {
    signals.push(signal);
    return signals.length === 1 ? new Promise<{ text: string }>(() => {}) : Promise.resolve({ text: 'Answered.' });
  });
  const queue = create(transcribe);
  await queue.ready;
  const later = new Blob(['later']);
  queue.capture(queue.begin(false), audio, true);
  queue.capture(queue.begin(false), later, true);
  await tick();
  await jest.advanceTimersByTimeAsync(119_999);
  expect(transcribe).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(queue.segments[0]).toMatchObject({ status: 'retrying', error: expect.stringContaining('stopped responding') });
  expect(signals[0].aborted).toBe(true);
  await jest.advanceTimersByTimeAsync(2000);
  expect(transcribe).toHaveBeenCalledTimes(3);
  expect(transcribe.mock.calls[1][0]).toBe(audio);
  expect(transcribe.mock.calls[2][0]).toBe(later);
  expect(queue.segments.map((segment) => segment.status)).toEqual(['complete', 'complete']);
});

it('restarts the uploading chunk at once when asked to retry it', async () => {
  const signals: AbortSignal[] = [];
  const queue = create((_blob: Blob, _labels: boolean, signal: AbortSignal) => {
    signals.push(signal);
    return signals.length === 1 ? new Promise<{ text: string }>(() => {}) : Promise.resolve({ text: 'Answered.' });
  });
  await queue.ready;
  const id = queue.begin(false);
  queue.capture(id, audio, true);
  await tick();
  expect(queue.segments[0].status).toBe('transcribing');
  await queue.retry(id);
  await tick();
  expect(signals).toHaveLength(2);
  expect(signals[0].aborted).toBe(true);
  expect(queue.segments[0]).toMatchObject({ status: 'complete', text: 'Answered.' });
});

it('spreads each retry over the second half of its backoff so rooms sharing a key do not retry in step', async () => {
  const retriedAt: number[] = [];
  const room = async (random: number) => {
    jest.mocked(Math.random).mockReturnValue(random);
    const started = Date.now();
    let calls = 0;
    const queue = create(async () => {
      if (++calls === 1) throw Object.assign(new Error('Busy'), { status: 429 });
      retriedAt.push(Date.now() - started);
      return { text: 'Later.' };
    }, `room-${random}`);
    await queue.ready;
    queue.capture(queue.begin(false), audio, true);
    await tick();
    await jest.advanceTimersByTimeAsync(1000);
  };
  await room(0);
  await room(0.9);
  expect(retriedAt).toEqual([1000, 550]);
});

it('recovers from a thirty-second outage without manual action', async () => {
  const started = Date.now();
  const transcribe = jest.fn(async () => {
    if (Date.now() - started < 30_000) throw Object.assign(new Error('Unavailable'), { status: 503 });
    return { text: 'Recovered.' };
  });
  const queue = create(transcribe);
  await queue.ready;
  queue.capture(queue.begin(false), audio, true);
  await tick();
  await jest.advanceTimersByTimeAsync(30_000);
  await queue.finish();
  expect(transcribe).toHaveBeenCalledTimes(6);
  expect(queue.segments[0]).toMatchObject({ status: 'complete', text: 'Recovered.' });
});

it('skips permanent failures while retaining their exact audio for retry and download', async () => {
  const badAudio = new Blob(['all original bytes'], { type: 'audio/mp4' });
  const transcribe = jest.fn(async (blob: Blob) => {
    if (blob === badAudio) throw Object.assign(new Error('Undecodable audio'), { status: 400 });
    return { text: 'Kept transcript.' };
  });
  const queue = create(transcribe);
  await queue.ready;
  queue.capture(queue.begin(false), audio, true);
  const failed = queue.begin(false);
  queue.capture(failed, badAudio, true);
  queue.capture(queue.begin(false), new Blob(['third']), true);
  await queue.finish();
  expect(queue.segments.map((segment) => segment.status)).toEqual(['complete', 'failed', 'complete']);
  expect(queue.records.get(failed)?.audio).toBe(badAudio);
  expect(saved.get(failed)?.audio).toBe(badAudio);
  await expect(queue.clear()).rejects.toThrow('unsaved audio');
  transcribe.mockImplementation(async () => ({ text: 'Recovered.' }));
  queue.retry(failed);
  await queue.finish();
  expect(queue.segments.every((segment) => segment.status === 'complete')).toBe(true);
});

it('does not delete raw audio if persisting the completed transcript fails', async () => {
  const queue = create();
  await queue.ready;
  const id = queue.begin(false);
  (putRecordingChunk as jest.MockedFunction<typeof putRecordingChunk>).mockImplementation(
    async (record: RecordingChunk) => {
      if (record.segment.status === 'complete') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      saved.set(record.segment.id, { ...record, segment: { ...record.segment } });
    },
  );
  queue.capture(id, audio, true);
  await tick();
  expect(saved.get(id)?.audio).toBe(audio);
  expect(queue.records.get(id)?.audio).toBe(audio);
  expect(queue.storageError).toContain("This recording can't be recovered after a reload");
  expect(queue.segments[0]).toMatchObject({ status: 'complete', text: 'Speech.' });
  await expect(queue.clear()).rejects.toThrow('unsaved audio');
  jest.mocked(putRecordingChunk).mockImplementation(async (record) => {
    saved.set(record.segment.id, record);
  });
  queue.retry(id);
  await tick();
  expect(saved.get(id)?.segment.text).toBe('Speech.');
  expect(queue.records.get(id)?.audio).toBeUndefined();
  expect(queue.storageError).toBe('');
});

it('recovers interrupted chunks in index order without mixing another scope', async () => {
  const record = (id: string, index: number, scope: string): RecordingChunk => ({
    scope,
    audio: new Blob([id]),
    labelSpeakers: true,
    segment: { id, index, text: '', status: 'recording', startedAt: index },
  });
  const later = record('later', 1, 'room'),
    first = record('first', 0, 'room');
  saved.set('later', later);
  saved.set('foreign', record('foreign', 0, 'other'));
  saved.set('first', first);
  const transcribe = jest.fn<Transcribe>(async () => ({ text: 'Restored.' }));
  const queue = create(transcribe);
  await queue.finish();
  expect(transcribe.mock.calls.map(([blob]) => blob)).toEqual([first.audio, later.audio]);
  expect(saved.get('foreign')?.audio).toBeDefined();
});

it('leaves interrupted audio recoverable when an old upload resolves after disposal', async () => {
  let resolve!: (value: { text: string }) => void;
  const queue = create(
    jest.fn(
      () =>
        new Promise<{ text: string }>((done) => {
          resolve = done;
        }),
    ),
  );
  await queue.ready;
  const id = queue.begin(false);
  queue.capture(id, audio, true);
  await tick();
  queue.dispose();
  resolve({ text: 'Late response.' });
  await tick();
  expect(saved.get(id)?.audio).toBe(audio);
  expect(saved.get(id)?.segment.text).toBe('');
});

it('pauses uploads offline and resumes kept audio on retry', async () => {
  const online = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  try {
    const transcribe = jest.fn(async () => ({ text: 'Back online.' }));
    const queue = create(transcribe);
    await queue.ready;
    const id = queue.begin(false);
    queue.capture(id, audio, true);
    await tick();
    expect(transcribe).not.toHaveBeenCalled();
    expect(queue.segments[0].error).toContain('Offline');
    expect(saved.get(id)?.audio).toBe(audio);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    queue.retry();
    await queue.finish();
    expect(transcribe).toHaveBeenCalledTimes(1);
  } finally {
    if (online) Object.defineProperty(navigator, 'onLine', online);
    else Reflect.deleteProperty(navigator, 'onLine');
  }
});

it('allows recording after storage becomes available again', async () => {
  jest.mocked(listRecordingChunks).mockRejectedValueOnce(new Error('Storage unavailable'));
  const queue = create();
  await queue.ready;
  expect(queue.storageError).toContain('Storage unavailable');
  await expect(queue.prepare()).resolves.toBeUndefined();
  expect(queue.storageError).toBe('');
});

it('resets speaker fallback when a completed recording is cleared', async () => {
  const transcribe = jest.fn<Transcribe>(async () => ({
    text: 'Plain transcript.',
    labelsUnavailableReason: 'Labels unavailable',
  }));
  const queue = create(transcribe);
  await queue.ready;
  queue.capture(queue.begin(true), audio, true);
  await queue.finish();
  expect(queue.labelsUnavailableReason).toBe('Labels unavailable');
  await queue.clear();
  queue.capture(queue.begin(true), audio, true);
  await queue.finish();
  expect(transcribe).toHaveBeenLastCalledWith(audio, true, expect.any(AbortSignal));
});

it('clears a recording made without IndexedDB once its memory-only audio is explicitly discarded', async () => {
  jest.mocked(listRecordingChunks).mockRejectedValue(new Error('No storage'));
  jest.mocked(putRecordingChunk).mockRejectedValue(new Error('No storage'));
  jest.mocked(clearRecordingChunks).mockRejectedValue(new Error('No storage'));
  const queue = create(undefined, 'no-storage-clear');
  await queue.ready;
  queue.capture(queue.begin(false), audio, true);
  await queue.finish();
  expect(queue.segments[0]).toMatchObject({ status: 'complete', text: 'Speech.' });
  await expect(queue.clear()).rejects.toThrow('unsaved audio');
  expect(queue.records.size).toBe(1);
  await queue.clear(true);
  expect(queue.records.size).toBe(0);
  expect(queue.storageError).toBe('');
});

it('clears a Failed chunk only once its audio is explicitly discarded', async () => {
  const queue = create(async () => {
    throw Object.assign(new Error('Undecodable audio'), { status: 400 });
  });
  await queue.ready;
  const id = queue.begin(false);
  queue.capture(id, audio, true);
  await queue.finish();
  expect(queue.segments[0].status).toBe('failed');
  await expect(queue.clear()).rejects.toThrow('unsaved audio');
  expect(saved.get(id)?.audio).toBe(audio);
  await queue.clear(true);
  expect(queue.records.size).toBe(0);
  expect(saved.size).toBe(0);
});

it('restores hidden periods saved by an earlier page and ends one still open at the return', async () => {
  jest.setSystemTime(5000);
  saved.set('hidden-periods', {
    scope: 'reloaded-room',
    labelSpeakers: false,
    hiddenPeriods: [{ startedAt: 1000, endedAt: 2000 }, { startedAt: 3000 }],
    segment: { id: 'hidden-periods', index: -1, status: 'recording', text: '', startedAt: 0 },
  });
  const queue = create(undefined, 'reloaded-room');
  await queue.ready;
  await tick();
  const periods = [
    { startedAt: 1000, endedAt: 2000 },
    { startedAt: 3000, endedAt: 5000 },
  ];
  expect(queue.segments).toEqual([]);
  expect(queue.hiddenPeriods).toEqual(periods);
  expect(saved.get('hidden-periods')?.hiddenPeriods).toEqual(periods);
  queue.dismissHiddenPeriods();
  await tick();
  expect(saved.get('hidden-periods')?.hiddenPeriods).toEqual([]);
});

it('reopens kept pending audio even when IndexedDB is unavailable', async () => {
  jest.mocked(listRecordingChunks).mockRejectedValue(new Error('No storage'));
  jest.mocked(putRecordingChunk).mockRejectedValue(new Error('No storage'));
  const queue = create(async () => new Promise(() => {}), 'volatile-room');
  await queue.ready;
  const id = queue.begin(false);
  queue.capture(id, audio, true);
  await queue.keepAudio();
  queue.dispose();
  const transcribe = jest.fn<Transcribe>(async () => ({ text: 'Recovered from memory.' }));
  const reopened = create(transcribe, 'volatile-room');
  await reopened.finish();
  expect(transcribe).toHaveBeenCalledWith(audio, false, expect.any(AbortSignal));
  expect(reopened.segments[0].text).toBe('Recovered from memory.');
  expect(reopened.records.get(id)?.audio).toBe(audio);
  expect(reopened.storageError).toContain("can't be recovered after a reload");
});

it.each([408, 429, 500])('keeps retrying HTTP %s with a capped backoff', async (status) => {
  const times: number[] = [];
  const started = Date.now();
  const queue = create(async () => {
    times.push(Date.now() - started);
    throw Object.assign(new Error('Temporary failure'), { status });
  });
  await queue.ready;
  queue.capture(queue.begin(false), audio, true);
  await tick();
  await jest.advanceTimersByTimeAsync(90_000);
  expect(times).toEqual([0, 1000, 3000, 7000, 15000, 30000, 60000, 90000]);
  expect(queue.segments[0].status).toBe('retrying');
});

it('keeps memory-only audio through a second close-and-keep when storage reads but cannot write', async () => {
  jest.mocked(putRecordingChunk).mockRejectedValue(new DOMException('Full', 'QuotaExceededError'));
  const pending = () => new Promise<{ text: string }>(() => {});
  const open = async () => {
    const queue = create(pending, 'full-phone');
    await queue.ready;
    await tick();
    return queue;
  };
  const first = await open();
  const id = first.begin(false);
  first.capture(id, audio, true);
  await first.keepAudio();
  first.dispose();
  const second = await open();
  expect(second.records.get(id)?.audio).toBe(audio);
  expect(second.storageError).toContain("This recording can't be recovered after a reload");
  await second.keepAudio();
  second.dispose();
  const third = await open();
  expect(third.records.get(id)?.audio).toBe(audio);
});

it('saves kept memory-only audio to device storage once writes work again', async () => {
  jest.mocked(putRecordingChunk).mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'));
  const pending = () => new Promise<{ text: string }>(() => {});
  const first = create(pending, 'recovered-phone');
  await first.ready;
  const id = first.begin(false);
  first.capture(id, audio, true);
  await first.keepAudio();
  first.dispose();
  const second = create(pending, 'recovered-phone');
  await second.ready;
  await tick();
  await second.keepAudio();
  expect(second.storageError).toBe('');
  expect(saved.get(id)?.audio).toBe(audio);
  second.dispose();
});

it('keeps memory-only audio when an unreadable store reopens and a later write succeeds', async () => {
  jest.mocked(putRecordingChunk).mockRejectedValue(new DOMException('Full', 'QuotaExceededError'));
  const pending = () => new Promise<{ text: string }>(() => {});
  const first = create(pending, 'flaky-phone');
  await first.ready;
  const id = first.begin(false);
  first.capture(id, audio, true);
  await first.keepAudio();
  first.dispose();
  jest.mocked(listRecordingChunks).mockRejectedValueOnce(new Error('Unreadable'));
  jest.mocked(putRecordingChunk).mockImplementation(async (record: RecordingChunk) => {
    if (record.segment.id === id) throw new DOMException('Full', 'QuotaExceededError');
    saved.set(record.segment.id, { ...record, segment: { ...record.segment } });
  });
  const second = create(pending, 'flaky-phone');
  await second.ready;
  await tick();
  second.capture(second.begin(false), new Blob(['later audio'], { type: 'audio/webm' }), true);
  await second.keepAudio();
  expect(second.storageError).toContain("This recording can't be recovered after a reload");
  second.dispose();
  const third = create(pending, 'flaky-phone');
  await third.ready;
  await tick();
  expect(third.records.get(id)?.audio).toBe(audio);
});

it.each(['after', 'before'])(
  'keeps memory-only audio when the recorder closes without Close and keep, %s its save fails',
  async (timing) => {
    jest.mocked(putRecordingChunk).mockRejectedValue(new DOMException('Full', 'QuotaExceededError'));
    const pending = () => new Promise<{ text: string }>(() => {});
    const first = create(pending, `route-change-${timing}`);
    await first.ready;
    const id = first.begin(false);
    first.capture(id, audio, true);
    if (timing === 'after') await tick();
    first.dispose();
    await tick();
    const second = create(pending, `route-change-${timing}`);
    await second.ready;
    await tick();
    expect(second.records.get(id)?.audio).toBe(audio);
  },
);

it('keeps memory-only audio when Close and keep runs before the store answers', async () => {
  jest.mocked(putRecordingChunk).mockRejectedValue(new DOMException('Full', 'QuotaExceededError'));
  const pending = () => new Promise<{ text: string }>(() => {});
  const first = create(pending, 'slow-store');
  await first.ready;
  const id = first.begin(false);
  first.capture(id, audio, true);
  await first.keepAudio();
  first.dispose();
  let answer: (value: RecordingChunk[]) => void = () => {};
  jest.mocked(listRecordingChunks).mockImplementationOnce(
    () =>
      new Promise<RecordingChunk[]>((resolve) => {
        answer = resolve;
      }),
  );
  const second = create(pending, 'slow-store');
  const kept = second.keepAudio();
  answer([]);
  await kept;
  second.dispose();
  const third = create(pending, 'slow-store');
  await third.ready;
  await tick();
  expect(third.records.get(id)?.audio).toBe(audio);
});
