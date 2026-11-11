import {
  hasKeptRecordingAudio,
  listRecordingChunks,
  putRecordingChunk,
  putRecordingChunks,
  type RecordingChunk,
} from './recordingChunkStore';
import { recordingOwner } from './recordingOwner';
import type { RollingTranscriptSegment } from './rollingTranscription';

// Just enough IndexedDB for puts and a read of the scope index over a key range, compared as strings as browsers do.
let mockRecords: Record<string, unknown>[] = [];
let mockTransactions = 0;
const range = (lower: string, upper: string) => ({ lower, upper });
const fakeDatabase = {
  close: () => {},
  transaction: () => {
    mockTransactions += 1;
    const transaction: { oncomplete?: () => void; objectStore: () => unknown } = {
      objectStore: () => ({
        put: (record: Record<string, unknown>) => {
          setTimeout(() => transaction.oncomplete?.());
          mockRecords.push(record);
          return {};
        },
        index: () => ({
          getAll: ({ lower, upper }: ReturnType<typeof range>) => {
            setTimeout(() => transaction.oncomplete?.());
            return { result: mockRecords.filter(({ scope }) => String(scope) >= lower && String(scope) <= upper) };
          },
        }),
      }),
    };
    return transaction;
  },
};
// jsdom's Blob has no arrayBuffer(), which browsers' Blobs have.
const arrayBuffer = Object.getOwnPropertyDescriptor(Blob.prototype, 'arrayBuffer');
function readBytes(this: Blob) {
  return new Promise<ArrayBuffer>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(this);
  });
}

beforeAll(() => {
  Object.assign(globalThis, {
    IDBKeyRange: { bound: range, only: (value: string) => range(value, value) },
    indexedDB: {
      open: () => {
        const request: { result: typeof fakeDatabase; onsuccess?: () => void } = { result: fakeDatabase };
        setTimeout(() => request.onsuccess?.());
        return request;
      },
    },
  });
  Object.defineProperty(Blob.prototype, 'arrayBuffer', { configurable: true, value: readBytes });
});

beforeEach(() => {
  mockRecords = [];
  mockTransactions = 0;
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'IDBKeyRange');
  Reflect.deleteProperty(globalThis, 'indexedDB');
  if (arrayBuffer) Object.defineProperty(Blob.prototype, 'arrayBuffer', arrayBuffer);
  else Reflect.deleteProperty(Blob.prototype, 'arrayBuffer');
});

const session = recordingOwner({ sessionSlug: 'rxc', sessionConfig: null, workerUrl: 'https://worker.example' });
const chunk = (
  sessionSlug: string,
  account: string,
  status: RollingTranscriptSegment['status'],
  audio = true,
): RecordingChunk => ({
  scope: JSON.stringify(['https://worker.example', sessionSlug, account]),
  segment: { id: `${sessionSlug}-${account}-${status}`, index: 0, status, text: '', startedAt: 0 },
  labelSpeakers: true,
  ...(audio ? { audio: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mp4' }) } : {}),
});

it.each([
  ['a queued chunk', [chunk('rxc', '0xabc', 'queued')], true],
  ['another account’s chunk', [chunk('rxc', '', 'retrying')], true],
  ['only a Failed chunk, which waits for Retry', [chunk('rxc', '0xabc', 'failed')], false],
  ['only transcribed chunks without audio', [chunk('rxc', '0xabc', 'complete', false)], false],
  ['completed audio kept for download', [chunk('rxc', '0xabc', 'complete')], false],
  ['a chunk of a session whose slug starts the same', [chunk('rxc-2', '0xabc', 'queued')], false],
  ['nothing', [], false],
])('finds kept audio for a session given %s', async (_case, records, kept) => {
  if (records.length) await putRecordingChunks(records);
  await expect(hasKeptRecordingAudio(session.identity)).resolves.toBe(kept);
});

it('stores audio as its bytes, which Safari keeps where it refuses a Blob, and reads it back as audio', async () => {
  const record = chunk('rxc', '0xabc', 'queued');
  await putRecordingChunk(record);
  const [stored] = mockRecords;
  expect(stored).not.toHaveProperty('audio');
  expect(stored.audioType).toBe('audio/mp4');
  expect([...new Uint8Array(stored.audioBytes as ArrayBuffer)]).toEqual([1, 2, 3]);

  const [restored] = await listRecordingChunks(record.scope);
  expect(restored).toEqual({ ...record, audio: expect.any(Blob) });
  expect(restored.audio?.type).toBe('audio/mp4');
  expect([...new Uint8Array(await restored.audio!.arrayBuffer())]).toEqual([1, 2, 3]);
});

it('saves several records in one transaction, so a reload finds all of them or none', async () => {
  const parts = ['queued', 'retrying', 'failed'] as const;
  await putRecordingChunks(parts.map((status) => chunk('rxc', '0xabc', status)));
  expect(mockTransactions).toBe(1);
  expect(mockRecords.map((record) => (record.segment as RollingTranscriptSegment).status)).toEqual(parts);
});
