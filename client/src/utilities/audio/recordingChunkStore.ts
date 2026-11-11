import type { RollingTranscriptSegment } from './rollingTranscription';
import type { SpeakerMerges } from './speakerMerges';
import type { KnownSpeaker } from './speakerTranscript';

/** `endedAt` is unset while the page is still hidden. */
export type HiddenPeriod = { startedAt: number; endedAt?: number };

/** Draft questions as the host left them, every prompt drafted so far, and the transcript last drafted from. */
export type QuestionDrafts = {
  questions: Record<string, unknown>[];
  prompts: string[];
  draftedTranscript: string;
};

export type RecordingChunk = {
  scope: string;
  segment: RollingTranscriptSegment;
  audio?: Blob;
  labelSpeakers: boolean;
  labelsUnavailableReason?: string;
  // Set only on the recording's hidden-periods record (see recordingChunkQueue).
  hiddenPeriods?: HiddenPeriod[];
  // Set only on the recording's known-speakers record.
  knownSpeakers?: KnownSpeaker[];
  speakerSamplesRefused?: boolean;
  // Set only on the recording's question-drafts record.
  questionDrafts?: QuestionDrafts;
  // Set only on the recording's speaker-merges record.
  speakerMerges?: SpeakerMerges;
};

const DATABASE = 'ce-recording-chunks';
const STORE = 'chunks';
// Safari can refuse to store a Blob ("Error preparing Blob/File data to be stored in object store"), so a
// chunk's audio is stored as its bytes and type, and read back as a Blob.
type StoredChunk = Omit<RecordingChunk, 'audio'> & { audioBytes?: ArrayBuffer; audioType?: string };
const toStored = async ({ audio, ...record }: RecordingChunk): Promise<StoredChunk> =>
  audio ? { ...record, audioBytes: await audio.arrayBuffer(), audioType: audio.type } : record;
const fromStored = ({ audioBytes, audioType, ...record }: StoredChunk): RecordingChunk =>
  audioBytes ? { ...record, audio: new Blob([audioBytes], { type: audioType }) } : record;

async function openStore(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw new Error('Audio storage is unavailable in this browser.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: ['scope', 'segment.id'] });
      store.createIndex('scope', 'scope');
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other recording tabs to unlock audio storage.'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openStore();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    let request: IDBRequest<T>;
    try {
      transaction = database.transaction(STORE, mode);
      request = action(transaction.objectStore(STORE));
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    // A successful request can still be rolled back by quota/transaction failure.
    transaction.oncomplete = () => {
      database.close();
      resolve(request.result);
    };
    transaction.onabort = transaction.onerror = () => {
      database.close();
      reject(transaction.error || request.error || new Error('Audio storage failed.'));
    };
  });
}

export const listRecordingChunks = async (scope: string): Promise<RecordingChunk[]> =>
  (await transact<StoredChunk[]>('readonly', (store) => store.index('scope').getAll(IDBKeyRange.only(scope)))).map(
    fromStored,
  );

/**
 * Whether this device keeps audio to upload for a session's recording, made by any account (Failed chunks wait
 * for Retry). Scopes are `[worker, slug, account]` as JSON, so a session's start with its `identity` minus `]`.
 */
export async function hasKeptRecordingAudio(identity: string): Promise<boolean> {
  const prefix = `${identity.slice(0, -1)},`;
  const records = await transact<StoredChunk[]>('readonly', (store) =>
    store.index('scope').getAll(IDBKeyRange.bound(prefix, `${prefix}￿`)),
  );
  return records.some((record) => record.audioBytes && !['failed', 'complete'].includes(record.segment.status));
}

export async function putRecordingChunk(record: RecordingChunk): Promise<void> {
  const stored = await toStored(record);
  await transact('readwrite', (store) => store.put(stored));
}

/** Deletes one record of a recording, such as its voice samples. */
export async function deleteRecordingChunk(scope: string, id: string): Promise<void> {
  await transact('readwrite', (store) => store.delete([scope, id]));
}

/** Saves several records in one transaction, so a reload finds all of them or none. */
export async function putRecordingChunks(records: RecordingChunk[]): Promise<void> {
  const stored = await Promise.all(records.map(toStored));
  await transact('readwrite', (store) => stored.map((record) => store.put(record))[stored.length - 1]);
}

export async function clearRecordingChunks(scope: string): Promise<void> {
  const database = await openStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    const request = transaction.objectStore(STORE).index('scope').openCursor(IDBKeyRange.only(scope));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onabort = transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}
