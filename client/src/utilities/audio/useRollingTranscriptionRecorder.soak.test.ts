/**
 * Thirty minutes of breakout recording through the real recorder hook, chunk queue, transcription client
 * and Worker transport. Only the edges are fake: MediaRecorder and the microphone, timers, the IndexedDB
 * store, audio decoding and the Session Worker's /transcribe replies. A reload loads fresh modules, so
 * nothing survives it that a real reload would lose.
 */
import React from 'react';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { RecordingChunk } from './recordingChunkStore';

type RecorderHook = typeof import('./useRollingTranscriptionRecorder').useRollingTranscriptionRecorder;
type Recorder = ReturnType<RecorderHook>;
type WorkerGeneration = 'current' | 'refuses labels' | 'text only';
type Upload = {
  chunk: number;
  fragments: number;
  labels: boolean;
  knownSpeakers: string[];
  sentAt: number;
  outcome?: string;
  settledAt?: number;
};

// Each recorder's one-second fragments have their own prime size, so an upload's size tells which recorder
// made it and how many fragments it holds (a chunk holds at most 200, fewer than any size).
const FRAGMENT_SIZES = [211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281];
const decodeAudio = (size: number) => {
  const index = FRAGMENT_SIZES.findIndex((bytes) => size % bytes === 0 && size / bytes <= 200);
  if (index < 0) throw new Error(`Unknown audio of ${size} bytes`);
  return { chunk: index + 1, fragments: size / FRAGMENT_SIZES[index] };
};
const page = { visible: true, online: true };

const mockStore = {
  records: new Map<string, RecordingChunk>(),
  failNext: null as ((record: RecordingChunk) => boolean) | null,
};
// IndexedDB hands back structured clones, never the objects the page holds.
const mockClone = (record: RecordingChunk): RecordingChunk => ({
  ...record,
  segment: { ...record.segment },
  hiddenPeriods: record.hiddenPeriods?.map((period) => ({ ...period })),
});
jest.mock('./recordingChunkStore', () => ({
  listRecordingChunks: async (scope: string) =>
    [...mockStore.records.values()].filter((record) => record.scope === scope).map(mockClone),
  putRecordingChunk: async (record: RecordingChunk) => {
    if (mockStore.failNext?.(record)) {
      mockStore.failNext = null;
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    mockStore.records.set(`${record.scope}|${record.segment.id}`, mockClone(record));
  },
  clearRecordingChunks: async (scope: string) => {
    for (const [key, record] of mockStore.records) if (record.scope === scope) mockStore.records.delete(key);
  },
}));

const mockResponse = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });
const mockWorker = {
  generation: 'current' as WorkerGeneration,
  uploads: [] as Upload[],
  // Replies to a chunk's first requests, in order; later requests succeed.
  plan: new Map<number, Array<'503' | 'hang' | 'corrupt'>>(),
  transcribe(init: RequestInit) {
    const form = init.body as FormData;
    const labels = form.get('labelSpeakers') === 'true';
    const knownSpeakers = form.getAll('known_speaker_names[]').map(String);
    const upload: Upload = {
      ...decodeAudio((form.get('file') as Blob).size),
      labels,
      knownSpeakers,
      sentAt: Date.now(),
    };
    mockWorker.uploads.push(upload);
    return new Promise((resolve, reject) => {
      const settle = (outcome: string, finish: () => void) => {
        if (upload.outcome) return;
        Object.assign(upload, { outcome, settledAt: Date.now() });
        finish();
      };
      init.signal?.addEventListener(
        'abort',
        () => settle('aborted', () => reject(new DOMException('The operation was aborted.', 'AbortError'))),
        { once: true },
      );
      if (!page.online) return settle('offline', () => reject(new TypeError('Failed to fetch')));
      const reply = mockWorker.plan.get(upload.chunk)?.shift();
      if (reply === 'hang') return;
      setTimeout(() => {
        const text = `Chunk ${upload.chunk} speech.`;
        if (reply === '503') settle('503', () => resolve(mockResponse(503, { error: 'Service unavailable.' })));
        else if (reply === 'corrupt')
          settle('corrupt', () =>
            resolve(
              mockResponse(400, {
                error: 'Audio file might be corrupted or unsupported.',
                details: { error: { param: 'file' } },
              }),
            ),
          );
        else if (labels && mockWorker.generation === 'refuses labels')
          settle('refused', () =>
            resolve(
              mockResponse(403, {
                error: "This model is not allowed on the session's AI key. Use the session model or your own key.",
                reason: 'ai_model_not_allowed',
              }),
            ),
          );
        else if (labels && mockWorker.generation === 'current') {
          // One voice speaks in each room. With its sample the model gives it the known name; without, "A".
          const speaker = knownSpeakers[0] || 'A';
          settle('ok', () =>
            resolve(mockResponse(200, { text, segments: [{ speaker, start: 0, end: upload.fragments, text }] })),
          );
        } else settle('ok', () => resolve(mockResponse(200, { text })));
      }, 1500);
    });
  },
};
jest.mock('../worker/workerAuth.js', () => ({
  fetchWorkerWithAuth: (_url: string, init: RequestInit) => mockWorker.transcribe(init),
}));

class FakeMediaRecorder {
  static isTypeSupported = () => true;
  static made: FakeMediaRecorder[] = [];
  // Chunks whose recorder never confirms its stop, as a browser bug can do.
  static lostStops = new Set<number>();
  readonly chunk: number;
  readonly mimeType = 'audio/webm;codecs=opus';
  state: RecordingState = 'inactive';
  emitted = 0;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private ticker: ReturnType<typeof setInterval> | undefined;
  private dead = false;
  constructor() {
    this.chunk = FakeMediaRecorder.made.push(this);
  }
  private emit() {
    this.emitted += 1;
    const data = new Blob([new Uint8Array(FRAGMENT_SIZES[this.chunk - 1])], { type: this.mimeType });
    this.ondataavailable?.({ data });
  }
  start(timeslice: number) {
    this.state = 'recording';
    // As on iOS Safari, a hidden page captures nothing.
    this.ticker = setInterval(() => {
      if (this.state === 'recording' && page.visible) this.emit();
    }, timeslice);
  }
  pause() {
    this.state = 'paused';
  }
  resume() {
    this.state = 'recording';
  }
  requestData() {
    if (this.state !== 'inactive' && page.visible) this.emit();
  }
  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    clearInterval(this.ticker);
    if (FakeMediaRecorder.lostStops.has(this.chunk)) return;
    // The last partial second and the stop event arrive in a later task.
    setTimeout(() => {
      if (this.dead) return;
      if (page.visible) this.emit();
      this.onstop?.();
    }, 0);
  }
  /** The page is gone: nothing more arrives from this recorder. */
  crash() {
    this.dead = true;
    this.state = 'inactive';
    clearInterval(this.ticker);
  }
}

const WORKER = 'https://breakout-worker.example';
const ACCOUNT = '0x1111111111111111111111111111111111111111';
const START = new Date('2026-11-05T10:00:00Z').getTime();
const at = (minutes: number, seconds = 0) => (minutes * 60 + seconds) * 1000;
// A reload starts from fresh modules, so nothing held in module memory survives it.
const loadPage = (): RecorderHook => {
  let hook: RecorderHook | undefined;
  jest.isolateModules(() => {
    hook = require('./useRollingTranscriptionRecorder').useRollingTranscriptionRecorder;
  });
  return hook!;
};
jest.doMock('react', () => React);

const descriptors = {
  MediaRecorder: Object.getOwnPropertyDescriptor(globalThis, 'MediaRecorder'),
  mediaDevices: Object.getOwnPropertyDescriptor(navigator, 'mediaDevices'),
  onLine: Object.getOwnPropertyDescriptor(navigator, 'onLine'),
  visibilityState: Object.getOwnPropertyDescriptor(document, 'visibilityState'),
  AudioContext: Object.getOwnPropertyDescriptor(window, 'AudioContext'),
  arrayBuffer: Object.getOwnPropertyDescriptor(Blob.prototype, 'arrayBuffer'),
};
const restore = (target: object, name: string, descriptor?: PropertyDescriptor) => {
  if (descriptor) Object.defineProperty(target, name, descriptor);
  else Reflect.deleteProperty(target, name);
};
// Decoding gives a second of 16 kHz audio for each fragment, as the recorder delivers one a second.
class FakeAudioContext {
  async decodeAudioData(data: ArrayBuffer) {
    const samples = decodeAudio(data.byteLength).fragments * 16_000;
    return {
      numberOfChannels: 1,
      length: samples,
      sampleRate: 16_000,
      getChannelData: () => new Float32Array(samples),
    };
  }
  async close() {}
}
function blobBytes(this: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(this);
  });
}
// The latest microphone's event listeners, so the test can play the device pausing it.
const microphone = { listeners: {} as Record<string, () => void> };
const getUserMedia = jest.fn(async () => {
  microphone.listeners = {};
  const addEventListener = (name: string, listener: () => void) => {
    microphone.listeners[name] = listener;
  };
  const track = { kind: 'audio', label: 'Phone microphone', stop: jest.fn(), addEventListener };
  return { getTracks: () => [track], getAudioTracks: () => [track] };
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(START);
  window.sessionStorage.clear();
  mockStore.records.clear();
  mockStore.failNext = null;
  mockWorker.uploads = [];
  mockWorker.plan.clear();
  FakeMediaRecorder.made = [];
  FakeMediaRecorder.lostStops = new Set([10]);
  Object.assign(page, { visible: true, online: true });
  getUserMedia.mockClear();
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => page.online });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (page.visible ? 'visible' : 'hidden'),
  });
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
  Object.defineProperty(Blob.prototype, 'arrayBuffer', { configurable: true, value: blobBytes });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  restore(globalThis, 'MediaRecorder', descriptors.MediaRecorder);
  restore(navigator, 'mediaDevices', descriptors.mediaDevices);
  restore(navigator, 'onLine', descriptors.onLine);
  restore(document, 'visibilityState', descriptors.visibilityState);
  restore(window, 'AudioContext', descriptors.AudioContext);
  restore(Blob.prototype, 'arrayBuffer', descriptors.arrayBuffer);
});

it.each<WorkerGeneration>(['current', 'refuses labels', 'text only'])(
  'keeps every chunk of a disrupted 30-minute recording with a %s Worker',
  async (generation) => {
    mockWorker.generation = generation;
    // A burst of 503s, then a Worker that struggles before one request never answers.
    mockWorker.plan.set(2, ['503', '503', '503', '503']);
    mockWorker.plan.set(7, ['503', '503', 'hang']);
    // The provider can't decode chunk 9, with labels or without, and chunk 10's recorder never confirms its stop
    // when a call ends and the microphone returns.
    mockWorker.plan.set(9, ['corrupt', 'corrupt']);
    // Device storage refuses one write: the commit of chunk 4's transcript.
    mockStore.failNext = (record) => record.segment.index === 3 && record.segment.status === 'complete';
    let elapsed = 0;
    // Five-second steps let React render as the recording goes, and keep the run to a few seconds.
    const runUntil = async (target: number) => {
      while (elapsed < target) {
        const step = Math.min(5000, target - elapsed);
        await act(async () => {
          await jest.advanceTimersByTimeAsync(step);
        });
        elapsed += step;
      }
    };
    const setPage = (change: Partial<typeof page>) =>
      act(() => {
        const event =
          'online' in change ? (change.online ? 'online' : 'offline') : 'visible' in change ? 'visibilitychange' : '';
        Object.assign(page, change);
        (event === 'visibilitychange' ? document : window).dispatchEvent(new Event(event));
      });
    const openPage = async (account: string) => {
      const hook = loadPage();
      const opened = renderHook(
        (props: { account: string }) =>
          hook({ sessionSlug: 'breakout', workerUrl: WORKER, context: props, labelSpeakers: true }),
        { initialProps: { account } },
      );
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      return opened;
    };
    const statuses = (view: RenderHookResult<Recorder, { account: string }>) =>
      view.result.current.segments.map((segment) => segment.status);

    let view = await openPage('');
    await act(async () => {
      await view.result.current.startRecording();
    });
    expect(view.result.current.status).toBe('recording');

    await runUntil(at(2));
    view.rerender({ account: ACCOUNT });
    await runUntil(at(7, 30));
    setPage({ online: false });
    await runUntil(at(9, 30));
    expect(statuses(view).slice(0, 3)).toEqual(['complete', 'complete', 'retrying']);
    expect(view.result.current.errorMessage).toContain('Offline');
    setPage({ online: true });

    await runUntil(at(13));
    // Later writes succeed, so chunk 4's transcript is saved after all and its audio let go.
    expect(statuses(view).slice(0, 4)).toEqual(['complete', 'complete', 'complete', 'complete']);
    expect(view.result.current.errorMessage).toBe('');
    expect(view.result.current.downloadableChunkIds).toEqual([view.result.current.segments[4].id]);

    await runUntil(at(15, 30));
    expect(mockWorker.uploads.every((upload) => upload.outcome)).toBe(true);
    // Reload in the middle of chunk 6: the page is gone without another event.
    FakeMediaRecorder.made.forEach((recorder) => recorder.crash());
    view.unmount();
    view = await openPage(ACCOUNT);
    expect(view.result.current.status).toBe('idle');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(statuses(view)).toEqual(['complete', 'complete', 'complete', 'complete', 'complete', 'transcribing']);

    await runUntil(at(16));
    await act(async () => {
      await view.result.current.startRecording();
    });
    expect(view.result.current.status).toBe('recording');
    await runUntil(at(20));
    setPage({ visible: false });
    await runUntil(at(24));
    setPage({ visible: true });
    await runUntil(at(25, 30));
    // A call takes the microphone for a minute without hiding the page.
    act(() => microphone.listeners.mute());
    expect(view.result.current.microphonePaused).toBe(true);
    await runUntil(at(26, 30));
    act(() => microphone.listeners.unmute());
    expect(view.result.current.microphonePaused).toBe(false);
    await runUntil(at(30, 30));
    await act(async () => {
      const stopping = view.result.current.stopRecording();
      await jest.advanceTimersByTimeAsync(0);
      await stopping;
    });
    await runUntil(at(35));

    const recorder = view.result.current;
    const rejected = recorder.segments[8];
    expect(FakeMediaRecorder.made).toHaveLength(12);
    expect(statuses(view)).toEqual([...Array(8).fill('complete'), 'failed', 'complete', 'complete', 'complete']);
    const speech = (chunks: number[]) => chunks.map((chunk) => `Chunk ${chunk} speech.`).join(' ');
    const gap = '[Recording gap: chunk 9 could not be transcribed.]';
    const call = '[Microphone paused for 1 min.]';
    // The room's one voice is Person 1 in every chunk, before and after the reload.
    expect(recorder.transcript).toBe(
      generation === 'current'
        ? [`Person 1: ${speech([1, 2, 3, 4, 5, 6, 7, 8])}`, gap, `Person 1: ${speech([10])}`, call]
            .concat(`Person 1: ${speech([11, 12])}`)
            .join('\n')
        : [speech([1, 2, 3, 4, 5, 6, 7, 8]), gap, speech([10]), call, speech([11, 12])].join(' '),
    );
    expect(recorder.pendingSegmentCount).toBe(0);
    expect(recorder.errorMessage).toBe('');
    expect(recorder.elapsedSeconds).toBe(14 * 60 + 30);
    expect(recorder.hiddenPeriods).toEqual([{ startedAt: START + at(20), endedAt: START + at(24) }]);
    const transcribed = recorder.segments.filter((segment) => segment.status === 'complete');
    expect(transcribed.map((segment) => segment.speakerTurns?.map((turn) => turn.speaker) ?? [])).toEqual(
      transcribed.map(() => (generation === 'current' ? ['Person 1'] : [])),
    );
    expect(Boolean(recorder.labelsUnavailableReason)).toBe(generation !== 'current');
    // Two presses of Record, one before and one after the reload; nothing else opened the microphone.
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    // Only the rejected chunk keeps its audio, and it downloads whole.
    expect(recorder.downloadableChunkIds).toEqual([rejected.id]);
    const downloads: Blob[] = [];
    const urls = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.assign(URL, { createObjectURL: (blob: Blob) => `blob:${downloads.push(blob)}`, revokeObjectURL: () => {} });
    try {
      act(() => recorder.downloadChunk(rejected.id));
    } finally {
      Object.assign(URL, { createObjectURL: urls.create, revokeObjectURL: urls.revoke });
      click.mockRestore();
    }
    expect(downloads.map((blob) => decodeAudio(blob.size))).toEqual([
      { chunk: 9, fragments: FakeMediaRecorder.made[8].emitted },
    ]);

    for (const made of FakeMediaRecorder.made) {
      const sent = mockWorker.uploads.filter((upload) => upload.chunk === made.chunk);
      const last = sent[sent.length - 1];
      if (made.chunk === 9) {
        expect(last.outcome).toBe('corrupt');
        continue;
      }
      // Transcribed once, and never sent again afterwards.
      expect(sent.filter((upload) => upload.outcome === 'ok')).toEqual([last]);
      // Every second the microphone delivered reached the Worker, except those after chunk 6's last save
      // before the reload: up to ten seconds, as documented.
      if (made.chunk === 6) expect(made.emitted - last.fragments).toBeLessThanOrEqual(10);
      else expect(last.fragments).toBe(made.emitted);
    }
    // No request waited more than two minutes for an answer.
    for (const upload of mockWorker.uploads) expect(upload.settledAt! - upload.sentAt).toBeLessThanOrEqual(120_000);
    // The voice's five-second sample, cut from the first chunk, is kept with the recording.
    const voices = [...mockStore.records.values()].find((record) => record.segment.id === 'known-speakers');
    expect(voices?.knownSpeakers?.map(({ name, sample }) => [name, sample.length])).toEqual(
      generation === 'current' ? [['Person 1', 'data:audio/wav;base64,'.length + ((44 + 160_000) / 3) * 4]] : undefined,
    );
    // Device storage keeps every chunk in one recording, and audio only for the rejected one.
    const stored = [...mockStore.records.values()].filter((record) => record.segment.index >= 0);
    expect(stored).toHaveLength(12);
    expect(new Set(stored.map((record) => record.scope)).size).toBe(1);
    expect(stored.filter((record) => record.audio).map((record) => record.segment)).toEqual([
      expect.objectContaining({ id: rejected.id, status: 'failed' }),
    ]);
    view.unmount();
  },
  60_000,
);
