import { countKeptChunks, hasUnsavedRecording, RecordingChunkQueue } from './recordingChunkQueue';
import {
  clearRecordingChunks,
  listRecordingChunks,
  putRecordingChunk,
  type RecordingChunk,
} from './recordingChunkStore';
import type { KnownSpeaker, SpeakerTranscriptTurn } from './speakerTranscript';

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
type Transcribe = (
  audio: Blob,
  labels: boolean,
  signal: AbortSignal,
  knownSpeakers: KnownSpeaker[],
) => Promise<{ text: string; speakerTurns?: SpeakerTranscriptTurn[]; speakerSamplesRefused?: boolean }>;
// Exact backoff timings below assume no jitter; the jitter test sets its own value.
let random = 0;
// Voice samples name the voice they came from; tests never decode audio.
const sampleVoices = jest.fn(async (_audio: Blob, ranges: Array<{ start: number; end: number }>) =>
  ranges.map(({ start, end }) => (end - start >= 2 ? `data:audio/wav;base64,${start}-${end}` : null)),
);
const create = (transcribe: Transcribe = jest.fn(async () => ({ text: 'Speech.' })), scope = 'room') => {
  const queue = new RecordingChunkQueue({ scope, transcribe, onChange: jest.fn(), random: () => random, sampleVoices });
  queues.push(queue);
  return queue;
};
beforeEach(() => {
  jest.useFakeTimers();
  random = 0;
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
  expect([...saved.values()].every((record) => record.audio)).toBe(true);
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

it('says an upload stalled while its next request runs, which offers Retry, until it is answered', async () => {
  let answer = (_value: { text: string }) => {};
  let requests = 0;
  // The first request never answers.
  const transcribe = jest.fn<Transcribe>(() =>
    ++requests === 1
      ? new Promise(() => {})
      : new Promise((resolve) => {
          answer = resolve;
        }),
  );
  const queue = create(transcribe);
  await queue.ready;
  queue.capture(queue.begin(false), audio, true);
  await tick();
  expect(queue.segments[0]).toMatchObject({ status: 'transcribing', error: undefined });
  await jest.advanceTimersByTimeAsync(121_000);
  expect(transcribe).toHaveBeenCalledTimes(2);
  expect(queue.segments[0]).toMatchObject({
    status: 'transcribing',
    error: expect.stringContaining('stopped responding'),
  });
  answer({ text: 'Answered.' });
  await tick();
  expect(queue.segments[0]).toMatchObject({ status: 'complete', text: 'Answered.', error: undefined });
});

it('waits two minutes for a hung upload after quick failures, and longer only after a stall', async () => {
  const signals: AbortSignal[] = [];
  const transcribe = jest.fn((_blob: Blob, _labels: boolean, signal: AbortSignal) => {
    signals.push(signal);
    if (signals.length <= 2) return Promise.reject(Object.assign(new Error('Unavailable'), { status: 503 }));
    return signals.length <= 4 ? new Promise<{ text: string }>(() => {}) : Promise.resolve({ text: 'Answered.' });
  });
  const queue = create(transcribe);
  await queue.ready;
  queue.capture(queue.begin(false), audio, true);
  await tick();
  await jest.advanceTimersByTimeAsync(3000);
  expect(transcribe).toHaveBeenCalledTimes(3);
  await jest.advanceTimersByTimeAsync(119_999);
  expect(signals[2].aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(1);
  expect(signals[2].aborted).toBe(true);
  // The stall suggests a slow connection, so the next request gets four minutes.
  await jest.advanceTimersByTimeAsync(4000);
  expect(transcribe).toHaveBeenCalledTimes(4);
  await jest.advanceTimersByTimeAsync(235_000);
  expect(signals[3].aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(5000);
  expect(signals[3].aborted).toBe(true);
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
  const room = async (value: number) => {
    random = value;
    const started = Date.now();
    let calls = 0;
    const queue = create(async () => {
      if (++calls === 1) throw Object.assign(new Error('Busy'), { status: 429 });
      retriedAt.push(Date.now() - started);
      return { text: 'Later.' };
    }, `room-${value}`);
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
  await expect(queue.clear()).rejects.toThrow('confirm deleting');
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
  await expect(queue.clear()).rejects.toThrow('confirm deleting');
  jest.mocked(putRecordingChunk).mockImplementation(async (record) => {
    saved.set(record.segment.id, record);
  });
  queue.retry(id);
  await tick();
  expect(saved.get(id)?.segment.text).toBe('Speech.');
  expect(queue.records.get(id)?.audio).toBe(audio);
  expect(queue.storageError).toBe('');
});

it('saves a refused transcript once a later write succeeds, so a reload neither warns nor uploads it again', async () => {
  const transcribe = jest.fn<Transcribe>(async () => ({ text: 'Speech.' }));
  const queue = create(transcribe);
  await queue.ready;
  const first = queue.begin(false);
  jest.mocked(putRecordingChunk).mockImplementationOnce(async (record: RecordingChunk) => {
    saved.set(record.segment.id, { ...record, segment: { ...record.segment } });
  });
  jest.mocked(putRecordingChunk).mockRejectedValueOnce(new DOMException('Quota exceeded', 'QuotaExceededError'));
  queue.capture(first, audio, true);
  await tick();
  expect(queue.storageError).toContain("This recording can't be recovered after a reload");
  expect(queue.records.get(first)?.audio).toBe(audio);
  // The next chunk's first snapshot is saved: storage works again.
  queue.capture(queue.begin(false), new Blob(['next'], { type: 'audio/webm' }));
  await tick();
  expect(saved.get(first)).toMatchObject({ segment: { status: 'complete', text: 'Speech.' } });
  expect(saved.get(first)?.audio).toBe(audio);
  expect(queue.records.get(first)?.audio).toBe(audio);
  expect(queue.storageError).toBe('');
  queue.dispose();
  const reopened = create(transcribe);
  await reopened.ready;
  await tick();
  expect(reopened.segments[0]).toMatchObject({ status: 'complete', text: 'Speech.' });
  expect(transcribe.mock.calls.filter(([blob]) => blob === audio)).toHaveLength(1);
});

it('never lets a re-save of an uploading chunk overwrite the transcript saved after it', async () => {
  let answer = (_value: { text: string }) => {};
  const transcribe = jest.fn<Transcribe>(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  );
  const queue = create(transcribe);
  await queue.ready;
  const first = queue.begin(false);
  // The chunk's final write is refused, so it uploads from memory.
  jest.mocked(putRecordingChunk).mockRejectedValueOnce(new DOMException('Quota exceeded', 'QuotaExceededError'));
  queue.capture(first, audio, true);
  await tick();
  expect(queue.segments[0].status).toBe('transcribing');
  // The next chunk's first write is slow and succeeds only after the transcript arrives.
  let finishWrite = () => {};
  jest.mocked(putRecordingChunk).mockImplementationOnce(async (record: RecordingChunk) => {
    await new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    saved.set(record.segment.id, { ...record, segment: { ...record.segment } });
  });
  queue.capture(queue.begin(false), new Blob(['next'], { type: 'audio/webm' }));
  await tick();
  answer({ text: 'Speech.' });
  await tick();
  finishWrite();
  await tick();
  expect(saved.get(first)).toMatchObject({ segment: { status: 'complete', text: 'Speech.' } });
  expect(saved.get(first)?.audio).toBe(audio);
  expect(queue.storageError).toBe('');
  queue.dispose();
  const reopened = create(transcribe);
  await reopened.ready;
  await tick();
  expect(transcribe.mock.calls.filter(([blob]) => blob === audio)).toHaveLength(1);
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
  await queue.clear(true);
  queue.capture(queue.begin(true), audio, true);
  await queue.finish();
  expect(transcribe).toHaveBeenLastCalledWith(audio, true, expect.any(AbortSignal), []);
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
  await expect(queue.clear()).rejects.toThrow('confirm deleting');
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
  await expect(queue.clear()).rejects.toThrow('confirm deleting');
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
  expect(transcribe).toHaveBeenCalledWith(audio, false, expect.any(AbortSignal), []);
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

it('counts the kept chunks that reopening will upload, in storage or only in memory', async () => {
  const chunk = (id: string, status: RecordingChunk['segment']['status'], withAudio = true): RecordingChunk => ({
    scope: 'kept-room',
    labelSpeakers: false,
    ...(withAudio ? { audio } : {}),
    segment: { id, index: Number(id.slice(-1)), status, text: '', startedAt: 0 },
  });
  saved.set('chunk-0', chunk('chunk-0', 'complete', true));
  saved.set('chunk-1', chunk('chunk-1', 'queued'));
  // A Failed chunk waits for Retry, so reopening alone won't upload it.
  saved.set('chunk-2', chunk('chunk-2', 'failed'));
  await expect(countKeptChunks('kept-room')).resolves.toBe(1);
  await expect(countKeptChunks('other-room')).resolves.toBe(0);
  // Without device storage, the copy kept in memory counts.
  jest.mocked(listRecordingChunks).mockRejectedValue(new Error('No storage'));
  jest.mocked(putRecordingChunk).mockRejectedValue(new Error('No storage'));
  const queue = create(async () => new Promise(() => {}), 'kept-room');
  await queue.ready;
  queue.capture(queue.begin(false), audio, true);
  await queue.keepAudio();
  queue.dispose();
  await expect(countKeptChunks('kept-room')).resolves.toBe(1);
});

it('treats transcribed audio and pasted text that only this page holds as unsaved until a write succeeds', async () => {
  jest.mocked(putRecordingChunk).mockRejectedValue(new DOMException('Full', 'QuotaExceededError'));
  const first = create(undefined, 'unsaved-room');
  await first.prepare();
  await first.addTranscript('Pasted notes.');
  // A pasted transcript alone would be lost by a reload.
  expect(first.unsaved).toBe(true);
  first.capture(first.begin(false), audio, true);
  await first.finish();
  expect(first.segments.map((segment) => segment.status)).toEqual(['complete', 'complete']);
  await first.keepAudio();
  first.dispose();
  // Closed, with nothing waiting to upload: the recording is still only on this page.
  expect(hasUnsavedRecording('unsaved-room')).toBe(true);
  expect(hasUnsavedRecording('other-room')).toBe(false);
  await expect(countKeptChunks('unsaved-room')).resolves.toBe(0);
  // Reopened, the recording stays unsaved until a write succeeds, then saves the pasted text too.
  let answer = () => {};
  jest.mocked(putRecordingChunk).mockImplementation(async (record: RecordingChunk) => {
    await new Promise<void>((resolve) => {
      answer = resolve;
    });
    saved.set(record.segment.id, { ...record, segment: { ...record.segment } });
  });
  const second = create(undefined, 'unsaved-room');
  await second.ready;
  expect(hasUnsavedRecording('unsaved-room')).toBe(false);
  expect(second.unsaved).toBe(true);
  for (let write = 0; write < 2; write++) {
    answer();
    await tick();
  }
  expect([...saved.values()].map((record) => record.segment.text)).toEqual(['Pasted notes.', 'Speech.']);
  expect(second.unsaved).toBe(false);
  expect(second.storageError).toBe('');
});

describe('speaker labels across chunks', () => {
  const turn = (speaker: string, start: number, end: number): SpeakerTranscriptTurn => ({
    speaker,
    start,
    end,
    text: `${speaker} ${start}.`,
  });
  // Each chunk's reply in turn; the request's known speakers are recorded.
  const replies = (...turnsByChunk: Array<SpeakerTranscriptTurn[] | 'refused'>) => {
    let calls = 0;
    return jest.fn<ReturnType<Transcribe>, Parameters<Transcribe>>(async () => {
      const reply = turnsByChunk[calls++];
      if (reply === 'refused')
        return { text: 'Refused.', speakerTurns: [turn('A', 0, 9)], speakerSamplesRefused: true };
      return { text: 'Speech.', speakerTurns: reply };
    });
  };
  const record = async (queue: RecordingChunkQueue) => {
    queue.capture(queue.begin(true), new Blob([`chunk ${queue.segments.length}`]), true);
    await queue.finish();
  };
  const voices = (queue: RecordingChunkQueue) =>
    queue.segments.map((segment) => segment.speakerTurns?.map((entry) => entry.speaker));
  const sentNames = (transcribe: ReturnType<typeof replies>) =>
    transcribe.mock.calls.map(([, , , known]) => known.map((speaker) => speaker.name));

  it('sends earlier voices with later chunks, so each keeps its Person number', async () => {
    const transcribe = replies(
      [turn('A', 0, 6), turn('B', 6, 9), turn('A', 9, 10)],
      [turn('Person 2', 0, 4), turn('A', 4, 12), turn('Person 1', 12, 13)],
    );
    const queue = create(transcribe, 'voices-1');
    await queue.ready;
    await record(queue);
    await record(queue);
    expect(sentNames(transcribe)).toEqual([[], ['Person 1', 'Person 2']]);
    expect(transcribe.mock.calls[1][3]).toEqual([
      { name: 'Person 1', sample: 'data:audio/wav;base64,0-6' },
      { name: 'Person 2', sample: 'data:audio/wav;base64,6-9' },
    ]);
    expect(voices(queue)).toEqual([
      ['Person 1', 'Person 2', 'Person 1'],
      ['Person 2', 'Person 3', 'Person 1'],
    ]);
    // Samples are cut from each chunk's own audio, and saved with the recording.
    expect(sampleVoices.mock.calls.map(([blob]) => blob)).toEqual([...transcribe.mock.calls.map(([blob]) => blob)]);
    expect(saved.get('known-speakers')?.knownSpeakers?.map((speaker) => speaker.name)).toEqual([
      'Person 1',
      'Person 2',
      'Person 3',
    ]);

    // A reload keeps them, and Clear deletes them.
    queue.dispose();
    const reloadedTranscribe = replies([turn('Person 3', 0, 3)]);
    const reloaded = create(reloadedTranscribe, 'voices-1');
    await reloaded.ready;
    await record(reloaded);
    expect(sentNames(reloadedTranscribe)).toEqual([['Person 1', 'Person 2', 'Person 3']]);
    await reloaded.clear(true);
    expect(saved.has('known-speakers')).toBe(false);
    const cleared = replies([turn('A', 0, 3)]);
    const fresh = create(cleared, 'voices-1');
    await fresh.ready;
    await record(fresh);
    expect(sentNames(cleared)).toEqual([[]]);
  });

  it('restores the voices an earlier page saved', async () => {
    const knownSpeakers = [{ name: 'Person 1', sample: 'data:audio/wav;base64,0-6' }];
    saved.set('known-speakers', {
      scope: 'voices-saved',
      labelSpeakers: false,
      knownSpeakers,
      segment: { id: 'known-speakers', index: -1, status: 'recording', text: '', startedAt: 0 },
    });
    const transcribe = replies([turn('Person 1', 0, 3)]);
    const queue = create(transcribe, 'voices-saved');
    await queue.ready;
    expect(queue.segments).toEqual([]);
    await record(queue);
    expect(transcribe.mock.calls[0][3]).toEqual(knownSpeakers);
    expect(voices(queue)).toEqual([['Person 1']]);
  });

  it('keeps at most four voices, numbering a fifth within its chunk', async () => {
    const transcribe = replies(
      [turn('A', 0, 3), turn('B', 3, 6), turn('C', 6, 9)],
      [turn('Person 1', 0, 3), turn('A', 3, 6), turn('B', 6, 9)],
      [turn('Person 4', 0, 3), turn('A', 3, 6)],
    );
    const queue = create(transcribe, 'voices-2');
    await queue.ready;
    for (let index = 0; index < 3; index += 1) await record(queue);
    expect(sentNames(transcribe).map((names) => names.length)).toEqual([0, 3, 4]);
    expect(voices(queue)).toEqual([
      ['Person 1', 'Person 2', 'Person 3'],
      ['Person 1', 'Person 4', 'Person 5'],
      ['Person 4', 'Person 5'],
    ]);
  });

  it('numbers a chunk on its own when its samples never reached the model', async () => {
    // An older Worker drops the samples, so the model labels the voices A and B again.
    const transcribe = replies(
      [turn('A', 0, 4), turn('B', 4, 8)],
      [turn('A', 0, 4), turn('B', 4, 8), turn('C', 8, 12)],
      [turn('Person 2', 0, 4)],
    );
    const queue = create(transcribe, 'voices-3');
    await queue.ready;
    for (let index = 0; index < 3; index += 1) await record(queue);
    expect(voices(queue)).toEqual([['Person 1', 'Person 2'], ['Person 1', 'Person 2', 'Person 3'], ['Person 2']]);
    expect(queue.segments.map((segment) => Boolean(segment.speakersRenumbered))).toEqual([false, true, false]);
    // Its voices did not join the known people.
    expect(sentNames(transcribe)[2]).toEqual(['Person 1', 'Person 2']);
    expect(sampleVoices).toHaveBeenCalledTimes(1);
  });

  it('stops sending samples the provider refused, for the rest of the recording', async () => {
    const transcribe = replies([turn('A', 0, 4)], 'refused', [turn('A', 0, 4)]);
    const queue = create(transcribe, 'voices-4');
    await queue.ready;
    for (let index = 0; index < 3; index += 1) await record(queue);
    expect(sentNames(transcribe)).toEqual([[], ['Person 1'], []]);
    expect(voices(queue)).toEqual([['Person 1'], ['Person 1'], ['Person 1']]);
    expect(saved.get('known-speakers')?.speakerSamplesRefused).toBe(true);
  });

  it('never holds up later chunks for a sample that takes too long', async () => {
    sampleVoices.mockImplementationOnce(() => new Promise(() => {}));
    const transcribe = replies([turn('A', 0, 4)], [turn('A', 0, 4)]);
    const queue = create(transcribe, 'voices-5');
    await queue.ready;
    queue.capture(queue.begin(true), new Blob(['first']), true);
    queue.capture(queue.begin(true), new Blob(['second']), true);
    await tick();
    expect(transcribe).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(10_000);
    await queue.finish();
    expect(transcribe).toHaveBeenCalledTimes(2);
    // Without a sample, the voice is numbered within each chunk.
    expect(sentNames(transcribe)).toEqual([[], []]);
    expect(voices(queue)).toEqual([['Person 1'], ['Person 1']]);
  });
});

it('persists an imported transcript without sending it for transcription and restores it in order', async () => {
  const transcribe = jest.fn(async () => ({ text: 'Audio discussion.' }));
  const queue = create(transcribe);
  await queue.prepare();
  await queue.addTranscript('Written discussion.');
  expect(transcribe).not.toHaveBeenCalled();
  expect(queue.segments[0]).toMatchObject({ source: 'text', status: 'complete', text: 'Written discussion.' });
  const id = queue.begin(false);
  queue.capture(id, audio, true);
  await queue.finish();
  queue.dispose();
  const restored = create(transcribe);
  await restored.ready;
  expect(restored.segments.map((segment) => segment.text)).toEqual(['Written discussion.', 'Audio discussion.']);
  expect(transcribe).toHaveBeenCalledTimes(1);
});
