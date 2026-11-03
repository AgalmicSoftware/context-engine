import type { RollingTranscriptSegment } from './rollingTranscription';
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
};

const DATABASE = 'ce-recording-chunks';
const STORE = 'chunks';

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

export const listRecordingChunks = (scope: string): Promise<RecordingChunk[]> =>
  transact('readonly', (store) => store.index('scope').getAll(IDBKeyRange.only(scope)));

/**
 * Whether this device keeps audio to upload for a session's recording, made by any account (Failed chunks wait
 * for Retry). Scopes are `[worker, slug, account]` as JSON, so a session's start with its `identity` minus `]`.
 */
export async function hasKeptRecordingAudio(identity: string): Promise<boolean> {
  const prefix = `${identity.slice(0, -1)},`;
  const records = await transact<RecordingChunk[]>('readonly', (store) =>
    store.index('scope').getAll(IDBKeyRange.bound(prefix, `${prefix}￿`)),
  );
  return records.some((record) => record.audio && !['failed', 'complete'].includes(record.segment.status));
}

export async function putRecordingChunk(record: RecordingChunk): Promise<void> {
  await transact('readwrite', (store) => store.put(record));
}

/** Deletes one record of a recording, such as its voice samples. */
export async function deleteRecordingChunk(scope: string, id: string): Promise<void> {
  await transact('readwrite', (store) => store.delete([scope, id]));
}

/** Saves several records in one transaction, so a reload finds all of them or none. */
export async function putRecordingChunks(records: RecordingChunk[]): Promise<void> {
  await transact('readwrite', (store) => records.map((record) => store.put(record))[records.length - 1]);
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
