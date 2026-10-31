import { hasKeptRecordingAudio, type RecordingChunk } from './recordingChunkStore';
import { recordingOwner } from './recordingOwner';
import type { RollingTranscriptSegment } from './rollingTranscription';

// Just enough IndexedDB for a read of the scope index over a key range, compared as strings as browsers do.
let mockRecords: RecordingChunk[] = [];
const range = (lower: string, upper: string) => ({ lower, upper });
const fakeDatabase = {
  close: () => {},
  transaction: () => {
    const transaction: { oncomplete?: () => void; objectStore: () => unknown } = {
      objectStore: () => ({
        index: () => ({
          getAll: ({ lower, upper }: ReturnType<typeof range>) => {
            setTimeout(() => transaction.oncomplete?.());
            return { result: mockRecords.filter(({ scope }) => scope >= lower && scope <= upper) };
          },
        }),
      }),
    };
    return transaction;
  },
};

beforeAll(() => {
  Object.assign(globalThis, {
    IDBKeyRange: { bound: range },
    indexedDB: {
      open: () => {
        const request: { result: typeof fakeDatabase; onsuccess?: () => void } = { result: fakeDatabase };
        setTimeout(() => request.onsuccess?.());
        return request;
      },
    },
  });
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'IDBKeyRange');
  Reflect.deleteProperty(globalThis, 'indexedDB');
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
  ...(audio ? { audio: new Blob(['audio']) } : {}),
});

it.each([
  ['a queued chunk', [chunk('rxc', '0xabc', 'queued')], true],
  ['another account’s chunk', [chunk('rxc', '', 'retrying')], true],
  ['only a Failed chunk, which waits for Retry', [chunk('rxc', '0xabc', 'failed')], false],
  ['only transcribed chunks without audio', [chunk('rxc', '0xabc', 'complete', false)], false],
  ['a chunk of a session whose slug starts the same', [chunk('rxc-2', '0xabc', 'queued')], false],
  ['nothing', [], false],
])('finds kept audio for a session given %s', async (_case, records, kept) => {
  mockRecords = records;
  await expect(hasKeptRecordingAudio(session.identity)).resolves.toBe(kept);
});
