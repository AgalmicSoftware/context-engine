import {
  clearRecordingChunks,
  deleteRecordingChunk,
  listRecordingChunks,
  putRecordingChunk,
  putRecordingChunks,
  type HiddenPeriod,
  type QuestionDrafts,
  type RecordingChunk,
} from './recordingChunkStore';
import type { CaptureGap, RollingTranscriptSegment } from './rollingTranscription';
import { readSpeakerMerges, type SpeakerMerges } from './speakerMerges';
import { cutSpeakerSamples } from './speakerSamples';
import {
  MAX_KNOWN_SPEAKERS,
  nameSpeakerTurns,
  planSpeakerTurns,
  type KnownSpeaker,
  type SpeakerTranscriptTurn,
} from './speakerTranscript';

// Unsaved records survive closing and reopening the panel in the same page.
const memoryRecordings = new Map<string, Map<string, RecordingChunk>>();
const memoryListeners = new Set<() => void>();
const holdsSpeech = (record: RecordingChunk) => Boolean(record.audio || record.segment.text.trim());
const holdsRecording = (records?: Map<string, RecordingChunk>) => [...(records?.values() || [])].some(holdsSpeech);
const askBeforeLeaving = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  // Some browsers show the prompt only when returnValue is set.
  event.returnValue = '';
};
// What only this page holds outlives the recorder, so a reload or closing the tab asks first wherever the app
// has gone since it closed, until the recording reopens (whose own prompt then applies), saves or clears.
const holdInMemory = (scope: string, records: Map<string, RecordingChunk> | null) => {
  if (records) memoryRecordings.set(scope, records);
  else memoryRecordings.delete(scope);
  if ([...memoryRecordings.values()].some(holdsRecording)) window.addEventListener('beforeunload', askBeforeLeaving);
  else window.removeEventListener('beforeunload', askBeforeLeaving);
  memoryListeners.forEach((listener) => listener());
};
/** Calls `listener` whenever what only this page holds changes; returns its unsubscribe. */
export const subscribeUnsavedRecordings = (listener: () => void) => {
  memoryListeners.add(listener);
  return () => {
    memoryListeners.delete(listener);
  };
};
// Hidden periods are kept with the recording under one reserved record. It has no audio and is never
// complete, so restoring skips it as a chunk (as 0.8.1 does), and Clear deletes it with the recording.
// The page's own copy also covers a failed save.
const HIDDEN_PERIODS_ID = 'hidden-periods';
const memoryHiddenPeriods = new Map<string, HiddenPeriod[]>();
// Voices heard so far, with their samples, are kept the same way while the recording is open or has chunks to
// transcribe, so later chunks keep their Person numbers.
const SPEAKERS_ID = 'known-speakers';
type Speakers = { knownSpeakers: KnownSpeaker[]; speakerSamplesRefused: boolean };
const memorySpeakers = new Map<string, Speakers>();
// So are the recording's draft questions, with the transcript they were drafted from, so reopening shows them as
// the host left them and drafts only newer text. The page holds its own copy only until a save lands, so a save
// that failed is covered while another tab's later save still wins.
const QUESTION_DRAFTS_ID = 'question-drafts';
const memoryQuestionDrafts = new Map<string, QuestionDrafts>();
// And the speakers the host merged, so the transcript and its codes reopen as the host left them. As with hidden
// periods, the page's own copy covers a failed save.
const SPEAKER_MERGES_ID = 'speaker-merges';
const memorySpeakerMerges = new Map<string, SpeakerMerges>();
// Cutting voice samples must never hold up later chunks for long.
const SAMPLE_WAIT_MS = 10_000;
/** Whether a closed recorder left audio or text that only this page holds for a recording. */
export const hasUnsavedRecording = (scope: string): boolean => holdsRecording(memoryRecordings.get(scope));

/** How many chunks of a closed recording hold audio that reopening it will upload (Failed ones wait for Retry). */
export async function countKeptChunks(scope: string): Promise<number> {
  const saved = await listRecordingChunks(scope).catch((): RecordingChunk[] => []);
  const kept = new Set<string>();
  for (const record of [...saved, ...(memoryRecordings.get(scope)?.values() || [])])
    if (record.audio && !['failed', 'complete'].includes(record.segment.status)) kept.add(record.segment.id);
  return kept.size;
}

type Transcription = {
  text: string;
  speakerTurns?: SpeakerTranscriptTurn[];
  labelsUnavailableReason?: string;
  speakerSamplesRefused?: boolean;
};
type Options = {
  scope: string;
  transcribe: (
    audio: Blob,
    labels: boolean,
    signal: AbortSignal,
    knownSpeakers: KnownSpeaker[],
  ) => Promise<Transcription>;
  onChange: () => void;
  // Retry jitter source; tests pass a fixed one instead of patching Math.random.
  random?: () => number;
  // Cuts a WAV sample from each range of a chunk's audio; tests pass one that doesn't decode audio.
  sampleVoices?: typeof cutSpeakerSamples;
};
const failureText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const storageText = (error: unknown) =>
  `This recording can't be recovered after a reload. This page holds it in memory: before leaving, copy the transcript and download any audio not yet transcribed. ${failureText(error)}`;
// A request that never answers must not hold later chunks. After each such stall the next request waits two
// minutes longer, so a slow upload still finishes; quick failures such as a 503 don't lengthen the wait.
const UPLOAD_DEADLINE_MS = 120_000;
const stalledText = 'The upload stopped responding. Retrying.';
// A request that failed after this long was cut on the way, as by a network that closes connections quiet for
// 60 seconds, and counts as a stall too. A labelled chunk can take over a minute to answer, so after two stalls
// it goes again without labels, which answers sooner, and later chunks stop waiting behind it.
const LONG_ATTEMPT_MS = 30_000;
const STALLS_BEFORE_PLAIN = 2;

/**
 * Each chunk is one IndexedDB record: its audio until it is transcribed, then its transcript, which replaces the
 * audio in the same write.
 */
export class RecordingChunkQueue {
  records = new Map<string, RecordingChunk>();
  storageError = '';
  labelsUnavailableReason = '';
  // Label refusals in a row: one may be this chunk's audio, so labels go off only at the second.
  private labelRefusals = 0;
  hiddenPeriods: HiddenPeriod[] = [];
  speakers: Speakers = { knownSpeakers: [], speakerSamplesRefused: false };
  // As restored when the recording opened; saving later drafts leaves it.
  questionDrafts: QuestionDrafts | null = null;
  speakerMerges: SpeakerMerges = {};
  ready: Promise<void>;
  private disposed = false;
  // Device storage answered at least once, so this recording may be saved there.
  private storageAnswered = false;
  private draftsWriteQueued = false;
  private writes: Promise<void> = Promise.resolve();
  private running: Promise<void> | null = null;
  private uploading: { id: string; controller: AbortController } | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = new Map<string, number>();
  private stalls = new Map<string, number>();
  private lastSnapshotAt = new Map<string, number>();
  private failedWrites = new Set<string>();
  private resaving = new Set<string>();
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
      this.storageAnswered = true;
      if (this.disposed) return;
      this.storageError = '';
      const kept = [...(memoryRecordings.get(this.options.scope)?.values() || [])];
      // Transcribed audio that an earlier build kept goes now, as it does once a chunk is transcribed.
      const stripped: RecordingChunk[] = [];
      let storedPeriods: HiddenPeriod[] = [];
      let storedDrafts: QuestionDrafts | null = null;
      let storedMerges: SpeakerMerges = {};
      for (let entry of [...saved, ...kept]) {
        if (entry.segment.id === HIDDEN_PERIODS_ID) {
          storedPeriods = entry.hiddenPeriods || [];
          continue;
        }
        if (entry.segment.id === SPEAKER_MERGES_ID) {
          storedMerges = readSpeakerMerges(entry.speakerMerges);
          continue;
        }
        if (entry.segment.id === QUESTION_DRAFTS_ID) {
          storedDrafts = entry.questionDrafts ?? null;
          continue;
        }
        if (entry.segment.id === SPEAKERS_ID) {
          this.speakers = {
            knownSpeakers: entry.knownSpeakers || [],
            speakerSamplesRefused: Boolean(entry.speakerSamplesRefused),
          };
          continue;
        }
        if (entry.audio && entry.segment.status === 'complete') {
          entry = { ...entry, audio: undefined };
          stripped.push(entry);
        } else if (entry.audio && entry.segment.status !== 'failed')
          entry.segment = { ...entry.segment, status: 'queued', error: undefined };
        else if (!entry.audio && entry.segment.status !== 'complete') continue;
        this.records.set(entry.segment.id, entry);
      }
      // The latest transcribed chunk says whether labels were off then; turning them back on clears it there.
      const latest = this.segments.filter((segment) => segment.status === 'complete').pop();
      this.labelsUnavailableReason = (latest && this.records.get(latest.id)?.labelsUnavailableReason) || '';
      holdInMemory(this.options.scope, null);
      this.resaveKept([...stripped, ...kept]);
      this.restoreHiddenPeriods(storedPeriods);
      this.restoreQuestionDrafts(storedDrafts);
      this.speakerMerges = memorySpeakerMerges.get(this.options.scope) ?? storedMerges;
      this.speakers = memorySpeakers.get(this.options.scope) ?? this.speakers;
      this.forgetSpeakersIfDone();
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
      holdInMemory(this.options.scope, null);
      this.resaveKept(kept);
      this.restoreHiddenPeriods([]);
      this.restoreQuestionDrafts(null);
      this.speakerMerges = memorySpeakerMerges.get(this.options.scope) ?? this.speakerMerges;
      this.speakers = memorySpeakers.get(this.options.scope) ?? this.speakers;
      this.forgetSpeakersIfDone();
      this.changed();
      void this.retry();
    }
  }
  // Restoring happens with the page in view: a period still open from an earlier page ends now.
  private restoreHiddenPeriods(stored: HiddenPeriod[]) {
    this.hiddenPeriods = memoryHiddenPeriods.get(this.options.scope) ?? stored;
    this.pageShown(Date.now());
  }
  // A restore retried after a storage failure (see prepare) keeps any drafts the first one restored.
  private restoreQuestionDrafts(stored: QuestionDrafts | null) {
    this.questionDrafts ??= memoryQuestionDrafts.get(this.options.scope) ?? stored;
  }
  /** Keeps the drafts with the recording. Edits arrive with each keystroke, so one queued write saves the latest. */
  saveQuestionDrafts(drafts: QuestionDrafts) {
    memoryQuestionDrafts.set(this.options.scope, drafts);
    if (this.draftsWriteQueued) return;
    this.draftsWriteQueued = true;
    this.writes = this.writes.then(async () => {
      this.draftsWriteQueued = false;
      const questionDrafts = memoryQuestionDrafts.get(this.options.scope);
      if (!questionDrafts) return;
      try {
        await putRecordingChunk(this.reserved(QUESTION_DRAFTS_ID, { questionDrafts }));
        if (memoryQuestionDrafts.get(this.options.scope) === questionDrafts)
          memoryQuestionDrafts.delete(this.options.scope);
      } catch {
        // Kept on this page until a later save lands.
      }
    });
  }
  /** A period opens only during capture, and ends when the page returns, even if capture stopped meanwhile. */
  pageHidden(at: number) {
    // A phone may suspend or discard a hidden page: save the audio held now, and the next delivery, at once
    // rather than up to ten seconds later.
    for (const record of this.records.values())
      if (record.segment.status === 'recording' && record.audio) {
        this.lastSnapshotAt.delete(record.segment.id);
        void this.save(record);
      }
    if (!this.hiddenPeriods.some((period) => period.endedAt == null))
      this.saveHiddenPeriods([...this.hiddenPeriods, { startedAt: at }]);
  }
  /** `carriedOn`: audio kept arriving while the page was hidden, so the period needs no notice. */
  pageShown(at: number, carriedOn = false) {
    if (!this.hiddenPeriods.some((period) => period.endedAt == null)) return;
    this.saveHiddenPeriods(
      carriedOn
        ? this.hiddenPeriods.filter((period) => period.endedAt != null)
        : this.hiddenPeriods.map((period) => ({ ...period, endedAt: period.endedAt ?? at })),
    );
  }
  dismissHiddenPeriods() {
    this.saveHiddenPeriods([]);
  }
  saveSpeakerMerges(speakerMerges: SpeakerMerges) {
    this.speakerMerges = speakerMerges;
    memorySpeakerMerges.set(this.options.scope, speakerMerges);
    this.saveReserved(SPEAKER_MERGES_ID, { speakerMerges });
    this.changed();
  }
  private saveHiddenPeriods(hiddenPeriods: HiddenPeriod[]) {
    this.hiddenPeriods = hiddenPeriods;
    memoryHiddenPeriods.set(this.options.scope, hiddenPeriods);
    this.saveReserved(HIDDEN_PERIODS_ID, { hiddenPeriods });
    this.changed();
  }
  private saveSpeakers(speakers: Speakers) {
    this.speakers = speakers;
    memorySpeakers.set(this.options.scope, speakers);
    this.saveReserved(SPEAKERS_ID, speakers);
  }
  private reserved(id: string, fields: Partial<RecordingChunk>): RecordingChunk {
    return {
      scope: this.options.scope,
      labelSpeakers: false,
      ...fields,
      segment: { id, index: -1, status: 'recording', text: '', startedAt: 0 },
    };
  }
  private saveReserved(id: string, fields: Partial<RecordingChunk>) {
    const record = this.reserved(id, fields);
    // Best effort, in order with chunk writes, so Clear deletes it after any pending save.
    this.writes = this.writes.then(() => putRecordingChunk(record).catch(() => {}));
  }
  // Audio or a transcript kept only in memory stays unsaved (in failedWrites) until a write succeeds, so the
  // warning and the prompt before leaving hold meanwhile, and a later close or unmount keeps the memory copy. A
  // silent chunk's empty transcript is saved too, or its stored audio would be sent again.
  private resaveKept(kept: RecordingChunk[]) {
    for (const entry of kept)
      if ((entry.audio || entry.segment.status === 'complete') && this.records.get(entry.segment.id) === entry) {
        const { id } = entry.segment;
        this.failedWrites.add(id);
        this.resaving.add(id);
        void this.save(entry).finally(() => this.resaving.delete(id));
      }
  }
  async prepare() {
    await this.ready;
    if (this.storageError && !this.records.size) await this.restore();
  }
  begin(labelSpeakers: boolean, gapBefore?: CaptureGap): string {
    const index = this.segments.reduce((max, entry) => Math.max(max, entry.index), -1) + 1;
    const id = `segment-${Date.now()}-${index}`;
    this.records.set(id, {
      scope: this.options.scope,
      labelSpeakers,
      segment: { id, index, status: 'recording', text: '', startedAt: Date.now(), ...(gapBefore && { gapBefore }) },
    });
    this.changed();
    return id;
  }
  async addTranscript(text: string) {
    if (!text.trim()) return;
    const id = this.begin(false);
    const previous = this.records.get(id)!;
    const record: RecordingChunk = {
      ...previous,
      segment: { ...previous.segment, source: 'text', status: 'complete', text: text.trim(), completedAt: Date.now() },
    };
    this.records.set(id, record);
    this.changed();
    await this.save(record);
  }
  /** Adds an import's parts as finished chunks, saved in one write so that a reload finds all of them or none. */
  addParts(parts: Blob[], labelSpeakers: boolean) {
    const records = parts.map((audio) => {
      const id = this.begin(labelSpeakers);
      const begun = this.records.get(id)!;
      const record: RecordingChunk = { ...begun, audio, segment: { ...begun.segment, status: 'queued' } };
      this.records.set(id, record);
      return record;
    });
    this.changed();
    void this.save(records).then(() => this.pump());
  }
  private save(records: RecordingChunk | RecordingChunk[]): Promise<boolean> {
    const batch = Array.isArray(records) ? records : [records];
    let saved = false;
    const operation = this.writes.then(async () => {
      try {
        await (batch.length > 1 ? putRecordingChunks(batch) : putRecordingChunk(batch[0]));
        saved = true;
        this.storageAnswered = true;
        for (const { segment } of batch) this.failedWrites.delete(segment.id);
        if (!this.failedWrites.size) this.storageError = '';
        else this.resaveFailed();
      } catch (error) {
        for (const { segment } of batch) this.failedWrites.add(segment.id);
        this.storageError = storageText(error);
        if (this.disposed) holdInMemory(this.options.scope, this.records);
      }
      this.changed();
    });
    this.writes = operation;
    return operation.then(() => saved);
  }
  // A write just succeeded, so storage works again: save what it refused earlier. Otherwise a refused
  // transcript keeps its audio in memory and the warning stays up, and after a reload its chunk is sent again.
  // An uploading chunk is left to its upload, which saves the outcome: re-saving the copy from before the
  // upload could land after the transcript and overwrite it.
  private resaveFailed() {
    for (const id of this.failedWrites) {
      const record = this.records.get(id);
      if (!record) this.failedWrites.delete(id);
      if (!record || record.segment.status === 'transcribing' || this.resaving.has(id)) continue;
      this.resaving.add(id);
      const saving = this.save(record);
      void saving.finally(() => this.resaving.delete(id));
    }
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
    // After a stall the next request may hang too, so it keeps saying so, which offers Retry while it runs.
    record.segment = {
      ...record.segment,
      status: 'transcribing',
      error: this.stalls.has(id) ? stalledText : undefined,
    };
    this.changed();
    const controller = new AbortController();
    this.uploading = { id, controller };
    const stalledLabels = (this.stalls.get(id) || 0) >= STALLS_BEFORE_PLAIN;
    const labels = record.labelSpeakers && !this.labelsUnavailableReason && !stalledLabels;
    const startedAt = Date.now();
    let deadlinePassed = false;
    try {
      if (this.disposed) return;
      const result = await new Promise<Transcription>((resolve, reject) => {
        const stalls = this.stalls.get(id) || 0;
        const deadline = setTimeout(
          () => {
            deadlinePassed = true;
            this.stalls.set(id, stalls + 1);
            controller.abort();
          },
          UPLOAD_DEADLINE_MS * (stalls + 1),
        );
        controller.signal.addEventListener('abort', () => reject(new Error(stalledText)), { once: true });
        const { knownSpeakers, speakerSamplesRefused } = this.speakers;
        this.options
          .transcribe(record.audio!, labels, controller.signal, labels && !speakerSamplesRefused ? knownSpeakers : [])
          .then(resolve, reject)
          .finally(() => clearTimeout(deadline));
      }).finally(() => {
        this.uploading = null;
      });
      if (this.disposed) return;
      // One refusal may be this chunk's own audio, which is then transcribed without labels; two in a row turn
      // labels off for the recording, until the host turns them back on.
      if (labels) this.labelRefusals = result.labelsUnavailableReason ? this.labelRefusals + 1 : 0;
      if (result.labelsUnavailableReason && this.labelRefusals >= 2)
        this.labelsUnavailableReason = result.labelsUnavailableReason;
      const named = result.speakerTurns?.length ? await this.nameSpeakers(record.audio!, result) : null;
      if (this.disposed) return;
      // Words without a speaker are in no one's code. Labels off for the whole recording say so on their own.
      const speakersDropped =
        record.labelSpeakers &&
        !this.labelsUnavailableReason &&
        Boolean(String(result.text || '').trim()) &&
        !result.speakerTurns?.length;
      const complete: RecordingChunk = {
        scope: record.scope,
        labelSpeakers: record.labelSpeakers,
        labelsUnavailableReason: this.labelsUnavailableReason,
        segment: {
          ...record.segment,
          status: 'complete',
          text: String(result.text || '').trim(),
          speakerTurns: named?.turns ?? result.speakerTurns,
          ...(named?.renumbered ? { speakersRenumbered: true } : {}),
          ...(speakersDropped ? { speakersDropped: true } : {}),
          error: undefined,
          completedAt: Date.now(),
        },
      };
      // The transcript replaces the stored audio in one write, so the audio leaves the device only once its
      // transcript is saved; if the write fails, the stored audio stays for a reload to transcribe again. This page
      // keeps only the transcript either way, and saves it again once storage works.
      await this.save(complete);
      this.records.set(id, complete);
      this.attempts.delete(id);
      this.stalls.delete(id);
      this.changed();
    } catch (error) {
      if (this.disposed) return;
      const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
      const retry = !(status >= 400 && status < 500 && status !== 408 && status !== 429);
      if (retry && !deadlinePassed && Date.now() - startedAt >= LONG_ATTEMPT_MS)
        this.stalls.set(id, (this.stalls.get(id) || 0) + 1);
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
          ([1000, 2000, 4000, 8000, 15_000][attempt - 1] ?? 30_000) * (1 - (this.options.random ?? Math.random)() / 2),
        );
      this.changed();
    }
  }
  /**
   * Names a chunk's voices Person 1, Person 2… Up to four voices first heard here join the known speakers with
   * a sample of their longest turn, which later chunks send so the model gives them the same names.
   */
  private async nameSpeakers(audio: Blob, { speakerTurns = [], speakerSamplesRefused }: Transcription) {
    if (speakerSamplesRefused) this.saveSpeakers({ ...this.speakers, speakerSamplesRefused: true });
    const { knownSpeakers } = this.speakers;
    const known = knownSpeakers.map((speaker) => speaker.name);
    const plan = planSpeakerTurns(speakerTurns, known);
    const room = plan.isolated || this.speakers.speakerSamplesRefused ? 0 : MAX_KNOWN_SPEAKERS - known.length;
    const samples = room > 0 && plan.voices.length ? await this.sampleVoices(audio, plan.voices) : [];
    const sampled = plan.voices
      .flatMap(({ label }, index) => {
        const sample = samples[index];
        return sample ? [{ label, sample }] : [];
      })
      .slice(0, room);
    const { turns, added } = nameSpeakerTurns(
      plan,
      known,
      sampled.map(({ label }) => label),
    );
    // A closed recorder leaves this chunk to upload again when it reopens, sampling its voices then.
    if (added.length && !this.disposed)
      this.saveSpeakers({
        ...this.speakers,
        knownSpeakers: [...knownSpeakers, ...added.map((name, index) => ({ name, sample: sampled[index].sample }))],
      });
    return { turns, renumbered: plan.isolated };
  }
  private sampleVoices(audio: Blob, voices: Array<{ start: number; end: number }>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sample = this.options.sampleVoices ?? cutSpeakerSamples;
    return Promise.race([
      sample(audio, voices).catch(() => []),
      new Promise<never[]>((resolve) => {
        timer = setTimeout(() => resolve([]), SAMPLE_WAIT_MS);
      }),
    ]).finally(() => clearTimeout(timer));
  }
  /** The host turns labels back on after they went off: later chunks ask for them again. */
  restoreSpeakerLabels() {
    if (!this.labelsUnavailableReason) return;
    this.labelsUnavailableReason = '';
    this.labelRefusals = 0;
    // Kept with the latest chunk, which is what a reload reads.
    const latest = this.segments.filter((segment) => segment.status === 'complete').pop();
    const record = latest && this.records.get(latest.id);
    if (record?.labelsUnavailableReason) {
      const cleared = { ...record, labelsUnavailableReason: '' };
      this.records.set(record.segment.id, cleared);
      void this.save(cleared);
    }
    this.changed();
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
      if (
        (!id || id === record.segment.id) &&
        this.failedWrites.has(record.segment.id) &&
        !this.resaving.has(record.segment.id) &&
        record.segment.status === 'complete'
      )
        void this.save(record);
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
  /** Whether only this page holds some of the recording (audio or text), so a reload would lose it. */
  get unsaved(): boolean {
    return Boolean(this.storageError || this.failedWrites.size) && holdsRecording(this.records);
  }
  /** After pending saves: whether no chunk is waiting or uploading, and whether only this page holds some of it. */
  async settled() {
    await this.ready;
    await this.writes;
    return {
      idle: this.segments.every((segment) => ['complete', 'failed'].includes(segment.status)),
      unsaved: this.unsaved,
    };
  }
  async keepAudio() {
    await this.ready;
    await this.writes;
    holdInMemory(this.options.scope, this.storageError ? this.records : null);
  }
  /** Every retained recording, including completed audio, requires explicit discard before deletion. */
  async clear(discardAudio = false) {
    if (this.segments.some((entry) => !['complete', 'failed'].includes(entry.status))) {
      throw new Error('Transcribe pending audio before clearing the recording. Download the audio first.');
    }
    if (!discardAudio && [...this.records.values()].some((record) => record.audio)) {
      throw new Error('Download the audio before clearing, or confirm deleting the recording.');
    }
    await this.writes;
    try {
      await clearRecordingChunks(this.options.scope);
    } catch (error) {
      // Storage that never answered holds nothing to delete. A later failed save doesn't show that: earlier chunks
      // may be saved, and a reload would bring them back, so the recording stays and Clear can be tried again.
      if (this.storageAnswered || !this.storageError) {
        throw new Error(`This recording couldn't be deleted from this device. Try again. ${failureText(error)}`);
      }
    }
    this.records.clear();
    holdInMemory(this.options.scope, null);
    memoryHiddenPeriods.delete(this.options.scope);
    memorySpeakers.delete(this.options.scope);
    memoryQuestionDrafts.delete(this.options.scope);
    memorySpeakerMerges.delete(this.options.scope);
    this.questionDrafts = null;
    this.speakerMerges = {};
    this.hiddenPeriods = [];
    this.speakers = { knownSpeakers: [], speakerSamplesRefused: false };
    this.labelsUnavailableReason = '';
    this.labelRefusals = 0;
    this.storageError = '';
    this.changed();
  }
  // Voice samples only label later chunks. Once every chunk is transcribed and saved they go, when the recorder
  // closes or, after a closed tab, when the recording next opens; a later Record more numbers its voices afresh.
  private forgetSpeakersIfDone() {
    if (!this.speakers.knownSpeakers.length || this.failedWrites.size) return;
    if (this.segments.some((segment) => segment.status !== 'complete')) return;
    this.speakers = { knownSpeakers: [], speakerSamplesRefused: false };
    // Kept on this page too, so reopening before the delete lands doesn't bring them back.
    memorySpeakers.set(this.options.scope, this.speakers);
    this.writes = this.writes.then(() => deleteRecordingChunk(this.options.scope, SPEAKERS_ID).catch(() => {}));
  }
  dispose() {
    this.disposed = true;
    // Leaving without Close and keep (Back, a route change) must not drop audio that only memory holds.
    if (this.storageError || this.failedWrites.size) holdInMemory(this.options.scope, this.records);
    this.forgetSpeakersIfDone();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.waiters.forEach((resolve) => resolve());
    this.waiters.clear();
  }
}
