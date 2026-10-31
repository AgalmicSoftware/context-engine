import {
  clearRecordingChunks,
  listRecordingChunks,
  putRecordingChunk,
  type RecordingChunk,
} from './recordingChunkStore';
import type { RollingTranscriptSegment } from './rollingTranscription';
import type { SpeakerTranscriptTurn } from './speakerTranscript';

// Unsaved records survive closing and reopening the panel in the same page.
const memoryRecordings = new Map<string, Map<string, RecordingChunk>>();

type Transcription = { text: string; speakerTurns?: SpeakerTranscriptTurn[]; labelsUnavailableReason?: string };
type Options = {
  scope: string;
  transcribe: (audio: Blob, labels: boolean, signal: AbortSignal) => Promise<Transcription>;
  onChange: () => void;
};
const failureText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const storageText = (error: unknown) =>
  `This recording can't be recovered after a reload. Its audio and transcript are kept in memory on this page; download unsaved audio before leaving. ${failureText(error)}`;
// A request that never answers must not hold later chunks. Each attempt waits longer, so a slow upload still finishes.
const UPLOAD_DEADLINE_MS = 120_000;
const stalledText = 'The upload stopped responding. Retrying.';

/** Raw audio and its completed transcript share one atomic IndexedDB record. */
export class RecordingChunkQueue {
  records = new Map<string, RecordingChunk>();
  storageError = '';
  labelsUnavailableReason = '';
  ready: Promise<void>;
  private disposed = false;
  private writes: Promise<void> = Promise.resolve();
  private running: Promise<void> | null = null;
  private uploading: { id: string; controller: AbortController } | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = new Map<string, number>();
  private lastSnapshotAt = new Map<string, number>();
  private failedWrites = new Set<string>();
  private waiters = new Set<() => void>();

  constructor(private options: Options) {
    this.ready = this.restore();
  }
  get segments(): RollingTranscriptSegment[] {
    return [...this.records.values()].map((entry) => entry.segment).sort((a, b) => a.index - b.index);
  }
  private changed() {
    if (!this.disposed) this.options.onChange();
  }
  private async restore() {
    try {
      const saved = await listRecordingChunks(this.options.scope);
      if (this.disposed) return;
      this.storageError = '';
      const kept = [...(memoryRecordings.get(this.options.scope)?.values() || [])];
      for (const entry of [...saved, ...kept]) {
        if (entry.audio && !['failed', 'complete'].includes(entry.segment.status))
          entry.segment = { ...entry.segment, status: 'queued', error: undefined };
        else if (!entry.audio && entry.segment.status !== 'complete') continue;
        this.records.set(entry.segment.id, entry);
        if (entry.labelsUnavailableReason) this.labelsUnavailableReason = entry.labelsUnavailableReason;
      }
      memoryRecordings.delete(this.options.scope);
      this.resaveKept(kept);
      this.changed();
      void this.retry();
    } catch (error) {
      this.storageError = storageText(error);
      const kept = [...(memoryRecordings.get(this.options.scope)?.values() || [])];
      for (const entry of kept) {
        if (entry.audio && !['failed', 'complete'].includes(entry.segment.status))
          entry.segment = { ...entry.segment, status: 'queued' };
        this.records.set(entry.segment.id, entry);
      }
      memoryRecordings.delete(this.options.scope);
      this.resaveKept(kept);
      this.changed();
      void this.retry();
    }
  }
  // Audio kept only in memory stays unsaved until a write succeeds: a failed write keeps the
  // warning (and failedWrites), so a later close or unmount keeps the memory copy instead of dropping it.
  private resaveKept(kept: RecordingChunk[]) {
    for (const entry of kept)
      if (entry.audio && entry.segment.status !== 'complete' && this.records.get(entry.segment.id) === entry)
        void this.save(entry);
  }
  async prepare() {
    await this.ready;
    if (this.storageError && !this.records.size) await this.restore();
  }
  begin(labelSpeakers: boolean): string {
    const index = this.segments.reduce((max, entry) => Math.max(max, entry.index), -1) + 1;
    const id = `segment-${Date.now()}-${index}`;
    this.records.set(id, {
      scope: this.options.scope,
      labelSpeakers,
      segment: { id, index, status: 'recording', text: '', startedAt: Date.now() },
    });
    this.changed();
    return id;
  }
  private save(record: RecordingChunk): Promise<boolean> {
    let saved = false;
    const operation = this.writes.then(async () => {
      try {
        await putRecordingChunk(record);
        saved = true;
        this.failedWrites.delete(record.segment.id);
        if (!this.failedWrites.size) this.storageError = '';
      } catch (error) {
        this.failedWrites.add(record.segment.id);
        this.storageError = storageText(error);
        if (this.disposed) memoryRecordings.set(this.options.scope, this.records);
      }
      this.changed();
    });
    this.writes = operation;
    return operation.then(() => saved);
  }
  capture(id: string, audio: Blob, finished = false): void {
    const previous = this.records.get(id);
    if (!previous || previous.segment.status === 'complete') return;
    if (!audio.size) {
      if (finished) {
        this.records.delete(id);
        this.changed();
        this.pump();
      }
      return;
    }
    const record = {
      ...previous,
      audio,
      segment: { ...previous.segment, status: finished ? ('queued' as const) : ('recording' as const) },
    };
    this.records.set(id, record);
    this.changed();
    // Keep cumulative container headers for Safari, but bound full-blob writes.
    const lastSnapshot = this.lastSnapshotAt.get(id);
    if (finished || lastSnapshot == null || Date.now() - lastSnapshot >= 10_000) {
      this.lastSnapshotAt.set(id, Date.now());
      void this.save(record).then(() => {
        if (finished) this.pump();
      });
    }
  }
  private firstPending() {
    const first = this.segments.find((entry) => !['complete', 'failed'].includes(entry.status));
    return first && this.records.get(first.id);
  }
  private settle() {
    if (this.running || this.retryTimer) return;
    this.waiters.forEach((resolve) => resolve());
    this.waiters.clear();
  }
  private pump() {
    if (this.disposed || this.running || this.retryTimer) return;
    const record = this.firstPending();
    if (!record?.audio || record.segment.status === 'recording') {
      this.settle();
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      record.segment = {
        ...record.segment,
        status: 'retrying',
        error: 'Offline. Reconnect to resume saved audio in order.',
      };
      this.changed();
      this.settle();
      return;
    }
    this.running = this.upload(record).finally(() => {
      this.running = null;
      this.pump();
    });
  }
  private async upload(record: RecordingChunk) {
    const { id } = record.segment;
    const attempt = (this.attempts.get(id) || 0) + 1;
    this.attempts.set(id, attempt);
    record.segment = { ...record.segment, status: 'transcribing', error: undefined };
    this.changed();
    const controller = new AbortController();
    this.uploading = { id, controller };
    try {
      if (this.disposed) return;
      const result = await new Promise<Transcription>((resolve, reject) => {
        const deadline = setTimeout(() => controller.abort(), UPLOAD_DEADLINE_MS * attempt);
        controller.signal.addEventListener('abort', () => reject(new Error(stalledText)), { once: true });
        this.options
          .transcribe(record.audio!, record.labelSpeakers && !this.labelsUnavailableReason, controller.signal)
          .then(resolve, reject)
          .finally(() => clearTimeout(deadline));
      }).finally(() => {
        this.uploading = null;
      });
      if (this.disposed) return;
      if (result.labelsUnavailableReason) this.labelsUnavailableReason = result.labelsUnavailableReason;
      const complete: RecordingChunk = {
        scope: record.scope,
        labelSpeakers: record.labelSpeakers,
        labelsUnavailableReason: this.labelsUnavailableReason,
        segment: {
          ...record.segment,
          status: 'complete',
          text: String(result.text || '').trim(),
          speakerTurns: result.speakerTurns,
          error: undefined,
          completedAt: Date.now(),
        },
      };
      // Removing audio is part of the same transaction that commits its transcript.
      const persisted = await this.save(complete);
      // A failed durable commit must keep both the paid transcript and original audio in memory.
      this.records.set(id, persisted ? complete : { ...complete, audio: record.audio });
      this.attempts.delete(id);
      this.changed();
    } catch (error) {
      if (this.disposed) return;
      const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
      const retry = !(status >= 400 && status < 500 && status !== 408 && status !== 429);
      record.segment = { ...record.segment, status: retry ? 'retrying' : 'failed', error: failureText(error) };
      this.records.set(id, record);
      if (!retry) await this.save(record);
      if (retry)
        this.retryTimer = setTimeout(
          () => {
            this.retryTimer = null;
            this.pump();
          },
          // Rooms sharing a key must not retry in step: wait a random half to all of the backoff.
          ([1000, 2000, 4000, 8000, 15_000][attempt - 1] ?? 30_000) * (1 - Math.random() / 2),
        );
      this.changed();
    }
  }
  /** Back online: a request sent before the outage may never answer, so start it again now. */
  async reconnect() {
    await this.abandonUpload();
    await this.retry();
  }
  private async abandonUpload() {
    this.uploading?.controller.abort();
    await this.running;
  }
  /** Naming the chunk that is uploading abandons its request, which may never answer, and sends it again. */
  async retry(id?: string) {
    if (id && this.uploading?.id === id) await this.abandonUpload();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    for (const record of this.records.values()) {
      if ((!id || id === record.segment.id) && record.audio && record.segment.status === 'complete') {
        const complete = { ...record, audio: undefined };
        void this.save(complete).then((persisted) => {
          if (persisted) this.records.set(record.segment.id, complete);
          this.changed();
        });
      }
      if (
        (!id || id === record.segment.id) &&
        record.audio &&
        (record.segment.status === 'retrying' || (Boolean(id) && record.segment.status === 'failed'))
      ) {
        this.attempts.delete(record.segment.id);
        record.segment = { ...record.segment, status: 'queued', error: undefined };
      }
    }
    this.changed();
    this.pump();
  }
  async finish() {
    await this.ready;
    await this.writes;
    this.pump();
    if (this.running || this.retryTimer) await new Promise<void>((resolve) => this.waiters.add(resolve));
    if (this.segments.some((entry) => !['complete', 'failed'].includes(entry.status))) {
      throw new Error(
        this.storageError ||
          'Some audio is waiting for transcription. Reconnect or Retry a failed chunk, or download its audio before leaving.',
      );
    }
  }
  async keepAudio() {
    await this.ready;
    await this.writes;
    if (this.storageError) memoryRecordings.set(this.options.scope, this.records);
    else memoryRecordings.delete(this.options.scope);
  }
  /** Deleting audio that has no saved transcript (a Failed chunk, or a memory-only copy) needs `discardAudio`. */
  async clear(discardAudio = false) {
    if (this.segments.some((entry) => !['complete', 'failed'].includes(entry.status))) {
      throw new Error('Transcribe pending audio before clearing the recording. Download any stuck chunks first.');
    }
    if (!discardAudio && [...this.records.values()].some((record) => record.audio)) {
      throw new Error(
        'Keep unsaved audio until its transcript is saved. Reconnect to retry storage or download it before leaving.',
      );
    }
    await this.writes;
    try {
      await clearRecordingChunks(this.options.scope);
    } catch (error) {
      // Without working device storage there is nothing saved to delete; otherwise a reload would bring it back.
      if (!this.storageError) throw error;
    }
    this.records.clear();
    memoryRecordings.delete(this.options.scope);
    this.labelsUnavailableReason = '';
    this.storageError = '';
    this.changed();
  }
  dispose() {
    this.disposed = true;
    // Leaving without Close and keep (Back, a route change) must not drop audio that only memory holds.
    if (this.storageError || this.failedWrites.size) memoryRecordings.set(this.options.scope, this.records);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.waiters.forEach((resolve) => resolve());
    this.waiters.clear();
  }
}
