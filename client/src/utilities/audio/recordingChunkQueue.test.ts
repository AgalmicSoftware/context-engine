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
type Transcribe = (audio: Blob, labels: boolean) => Promise<{ text: string }>;
const create = (transcribe: Transcribe = jest.fn(async () => ({ text: 'Speech.' })), scope = 'room') => {
  const queue = new RecordingChunkQueue({ scope, transcribe, onChange: jest.fn() });
  queues.push(queue);
  return queue;
};
beforeEach(() => {
  jest.useFakeTimers();
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
  expect([...saved.values()].every((record) => !record.audio)).toBe(true);
});

it('keeps audio after five failures, blocks later chunks, and supports manual retry', async () => {
  const transcribe = jest.fn<Transcribe>(async () => {
    throw new Error('Upload refused');
  });
  const queue = create(transcribe);
  await queue.ready;
  const first = queue.begin(false);
  queue.capture(first, audio, true);
  const second = queue.begin(false);
  queue.capture(second, new Blob(['next']), true);
  await tick();
  await jest.advanceTimersByTimeAsync(15000);
  await tick();
  expect(transcribe).toHaveBeenCalledTimes(5);
  expect(queue.segments.map((segment) => segment.status)).toEqual(['error', 'queued']);
  expect(saved.get(first)?.audio).toBe(audio);
  await expect(queue.finish()).rejects.toThrow('Retry');
  await expect(queue.clear()).rejects.toThrow('pending audio');
  transcribe.mockImplementation(async () => ({ text: 'Recovered.' }));
  queue.retry(first);
  await queue.finish();
  expect(queue.segments.map((segment) => segment.status)).toEqual(['complete', 'complete']);
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
  expect(queue.storageError).toContain('Free storage');
  expect(queue.segments[0].status).toBe('retrying');
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
  expect(transcribe).toHaveBeenLastCalledWith(audio, true);
});
