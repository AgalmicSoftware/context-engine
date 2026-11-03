import { act, renderHook } from '@testing-library/react';
import { useRollingTranscriptionRecorder } from './useRollingTranscriptionRecorder';
import { transcribeAudio, transcribeGroupAudio } from '../ai/aiClient.js';
import {
  clearRecordingChunks,
  listRecordingChunks,
  putRecordingChunk,
  putRecordingChunks,
} from './recordingChunkStore';
import { cutSpeakerSamples } from './speakerSamples';
import { installFakeWebLocks } from './webLocks.testUtils';

jest.mock('../ai/aiClient.js', () => ({
  transcribeAudio: jest.fn(),
  transcribeGroupAudio: jest.fn(),
}));
// Voice samples name the voice they came from; tests never decode audio.
jest.mock('./speakerSamples', () => ({
  cutSpeakerSamples: jest.fn(async (_audio: Blob, voices: Array<{ label: string }>) =>
    voices.map((voice) => `data:audio/wav;base64,${voice.label}`),
  ),
}));

const mockChunkRecords = new Map<
  string,
  { scope: string; segment: { id: string; status: string; text: string }; audio?: Blob }
>();
jest.mock('./recordingChunkStore', () => ({
  listRecordingChunks: jest.fn(async (scope: string) =>
    [...mockChunkRecords.values()].filter((record) => record.scope === scope),
  ),
  putRecordingChunk: jest.fn(
    async (record: { scope: string; segment: { id: string; status: string; text: string }; audio?: Blob }) => {
      // Keyed like the real store, by scope and segment id.
      mockChunkRecords.set(`${record.scope}|${record.segment.id}`, { ...record, segment: { ...record.segment } });
    },
  ),
  putRecordingChunks: jest.fn(
    async (records: Array<{ scope: string; segment: { id: string; status: string; text: string }; audio?: Blob }>) => {
      for (const record of records)
        mockChunkRecords.set(`${record.scope}|${record.segment.id}`, { ...record, segment: { ...record.segment } });
    },
  ),
  clearRecordingChunks: jest.fn(async () => mockChunkRecords.clear()),
  deleteRecordingChunk: jest.fn(async (scope: string, id: string) => mockChunkRecords.delete(`${scope}|${id}`)),
}));

const flushPromises = async () => {
  for (let index = 0; index < 40; index++) await Promise.resolve();
};
// An imported file decodes to as many seconds of 16 kHz audio as its text names; other bytes don't decode.
class FakeOfflineAudioContext {
  static decoded = 0;
  // Decoding finishes once this settles.
  static wait: Promise<void> = Promise.resolve();
  constructor(
    _channels: number,
    _length: number,
    readonly sampleRate: number,
  ) {}
  async decodeAudioData(bytes: ArrayBuffer) {
    await FakeOfflineAudioContext.wait;
    FakeOfflineAudioContext.decoded += 1;
    const seconds = Number(new TextDecoder().decode(bytes));
    if (!seconds) throw new DOMException('Unable to decode audio data', 'EncodingError');
    const length = seconds * this.sampleRate;
    return {
      numberOfChannels: 1,
      length,
      sampleRate: this.sampleRate,
      duration: seconds,
      getChannelData: () => new Float32Array(length),
    };
  }
}
// Seconds of 16 kHz mono 16-bit audio in an imported part.
const partSeconds = (part: Blob) => (part.size - 44) / 2 / 16_000;

describe('useRollingTranscriptionRecorder', () => {
  let originalMediaRecorder: unknown;
  let originalMediaDevices: MediaDevices | undefined;
  let mockTrack: { stop: jest.Mock };
  let mockStream: MediaStream;
  const instances: MockMediaRecorder[] = [];

  class MockMediaRecorder {
    static isTypeSupported = jest.fn(() => true);
    static failNextStart = false;
    // Recorders made while this is set never deliver audio, as when a phone's capture dies without an event.
    static silent = false;

    silent = MockMediaRecorder.silent;
    stream: MediaStream;
    state: RecordingState = 'inactive';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onstop: (() => void) | null = null;
    start = jest.fn(() => {
      if (MockMediaRecorder.failNextStart) {
        MockMediaRecorder.failNextStart = false;
        throw new Error('Synthetic recorder start failure');
      }
      this.state = 'recording';
    });
    pause = jest.fn(() => {
      this.state = 'paused';
    });
    resume = jest.fn(() => {
      this.state = 'recording';
    });
    requestData = jest.fn(() => {
      if (this.silent) return;
      this.ondataavailable?.({
        data: new Blob([new Uint8Array(256).fill(instances.indexOf(this) + 1)], { type: 'audio/webm' }),
      });
    });
    stop = jest.fn(() => {
      if (!this.silent)
        this.ondataavailable?.({
          data: new Blob([new Uint8Array(256).fill(instances.indexOf(this) + 1)], { type: 'audio/webm' }),
        });
      this.state = 'inactive';
      this.onstop?.();
    });

    constructor(stream: MediaStream) {
      this.stream = stream;
      instances.push(this);
    }
  }

  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockChunkRecords.clear();
    instances.length = 0;
    MockMediaRecorder.failNextStart = false;
    MockMediaRecorder.silent = false;
    (transcribeAudio as jest.Mock).mockImplementation(async (_blob: Blob) => `transcript ${instances.length}`);

    originalMediaRecorder = (globalThis as any).MediaRecorder;
    originalMediaDevices = navigator.mediaDevices;
    FakeOfflineAudioContext.decoded = 0;
    FakeOfflineAudioContext.wait = Promise.resolve();
    Object.defineProperty(window, 'OfflineAudioContext', { configurable: true, value: FakeOfflineAudioContext });
    mockTrack = { stop: jest.fn() };
    mockStream = {
      getTracks: () => [mockTrack],
    } as unknown as MediaStream;

    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: MockMediaRecorder,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest.fn().mockResolvedValue(mockStream),
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'OfflineAudioContext');
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: originalMediaRecorder,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('imports audio and text without microphone access and retains failed audio for retry', async () => {
    (transcribeAudio as jest.MockedFunction<typeof transcribeAudio>).mockRejectedValueOnce(
      Object.assign(new Error('Not enabled'), { status: 403 }),
    );
    const { result } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'import-input' }));
    const audio = new Blob(['60'], { type: 'audio/mpeg' });
    await act(async () => {
      await result.current.addTranscript('Written discussion.');
      await result.current.addAudio(audio);
      await flushPromises();
    });
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete', 'failed']);
    expect(result.current.downloadableChunkIds).toEqual([result.current.segments[1].id]);
    (transcribeAudio as jest.MockedFunction<typeof transcribeAudio>).mockResolvedValueOnce('Uploaded discussion.');
    await act(async () => {
      await result.current.retryChunk(result.current.segments[1].id);
      await flushPromises();
    });
    expect(result.current.transcript).toBe('Written discussion. Uploaded discussion.');
    // Transcribed, its audio is gone.
    expect(result.current.downloadableChunkIds).toEqual([]);
  });

  it('imports a file as chunk-length parts that upload in order, each with its own deadline', async () => {
    const sent: number[] = [];
    jest.mocked(transcribeAudio).mockImplementation((part) => {
      sent.push(partSeconds(part));
      // The second request, the second part's first, never answers.
      return sent.length === 2 ? new Promise<string>(() => {}) : Promise.resolve(`Reply ${sent.length}.`);
    });
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'import-parts' }));
    await act(async () => {
      await result.current.addAudio(new Blob(['420'], { type: 'audio/mpeg' }));
      await flushPromises();
    });
    expect(FakeOfflineAudioContext.decoded).toBe(1);
    // Saved in one write, so a reload finds the whole import or none of it.
    expect(jest.mocked(putRecordingChunks).mock.calls.map(([records]) => records.length)).toEqual([3]);
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete', 'transcribing', 'queued']);
    expect(sent).toEqual([180, 180]);
    // Only the stalled part goes again, under its own deadline; the whole file never goes.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(121_000);
      await flushPromises();
    });
    expect(sent).toEqual([180, 180, 180, 62]);
    expect(result.current.transcript).toBe('Reply 1. Reply 3. Reply 4.');
    expect(result.current.downloadableChunkIds).toEqual([]);
    expect(FakeOfflineAudioContext.decoded).toBe(1);
    unmount();
  });

  it.each([
    ['longer than 30 minutes', '1801', 'Choose audio up to 30 minutes. Split longer recordings first.'],
    ['that does not decode', 'MP3 bytes', "This audio file couldn't be read. Try an MP3 or WAV file."],
  ])('refuses an import %s and adds nothing to the recording', async (_kind, bytes, message) => {
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'import-refused' }));
    await act(async () => {
      await expect(result.current.addAudio(new Blob([bytes], { type: 'audio/mpeg' }))).rejects.toThrow(message);
      await flushPromises();
    });
    expect(result.current.segments).toEqual([]);
    expect(mockChunkRecords.size).toBe(0);
    expect(transcribeAudio).not.toHaveBeenCalled();
    unmount();
  });

  it('finishes closing only once an import still decoding is added and transcribed', async () => {
    let decode = () => {};
    FakeOfflineAudioContext.wait = new Promise((resolve) => {
      decode = resolve;
    });
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'Imported speech.');
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'import-closing' }));
    let adding: Promise<void> = Promise.resolve();
    await act(async () => {
      adding = result.current.addAudio(new Blob(['60'], { type: 'audio/mpeg' }));
      await flushPromises();
    });
    // Record waits too, so the import can't land in the middle of a recording.
    expect(result.current.importing).toBe(true);
    let closed = false;
    let closing: Promise<void> = Promise.resolve();
    await act(async () => {
      closing = result.current.finalizeRecording({ waitForTranscription: true }).then(() => {
        closed = true;
      });
      await flushPromises();
    });
    expect(closed).toBe(false);
    await act(async () => {
      decode();
      await adding;
      await closing;
    });
    expect(result.current.importing).toBe(false);
    expect(result.current.transcript).toBe('Imported speech.');
    unmount();
  });

  it('never lets a rejected or refused import hold up later chunks or Clear, across a reload', async () => {
    jest.mocked(transcribeAudio).mockImplementation(async (audio) => {
      if (audio.type === 'audio/wav') throw Object.assign(new Error('Audio file might be corrupted.'), { status: 400 });
      return 'Recorded speech.';
    });
    const sessionSlug = 'import-rejected';
    let view = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug }));
    try {
      await act(async () => {
        await view.result.current.addAudio(new Blob(['60'], { type: 'audio/mpeg' }));
        await expect(view.result.current.addAudio(new Blob(['1801'], { type: 'audio/mpeg' }))).rejects.toThrow();
        await flushPromises();
      });
      await act(async () => {
        await view.result.current.startRecording();
      });
      await act(async () => {
        await view.result.current.stopRecording();
        await flushPromises();
      });
      expect(view.result.current.segments.map((segment) => segment.status)).toEqual(['failed', 'complete']);
      view.unmount();
      view = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug }));
      await act(flushPromises);
      expect(view.result.current.segments.map((segment) => segment.status)).toEqual(['failed', 'complete']);
      expect(view.result.current.pendingSegmentCount).toBe(0);
      await act(async () => {
        view.result.current.clearDraft(true);
        await flushPromises();
      });
      expect(view.result.current.segments).toEqual([]);
      expect(mockChunkRecords.size).toBe(0);
    } finally {
      view.unmount();
    }
  });

  it('a failed recorder start leaves no empty recording chunk and can be retried', async () => {
    const { result } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'failed-start' }));
    MockMediaRecorder.failNextStart = true;
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toContain('Synthetic recorder start failure');
    expect(result.current.segments).toEqual([]);
    expect(mockChunkRecords.size).toBe(0);
    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.status).toBe('recording');
    expect(result.current.segments).toHaveLength(1);
    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete']);
  });

  it('a failed rotation leaves the current recorder running with no phantom chunk', async () => {
    const { result } = renderHook(() =>
      useRollingTranscriptionRecorder({ sessionSlug: 'failed-rotation', chunkMs: 15000 }),
    );
    await act(async () => {
      await result.current.startRecording();
    });
    MockMediaRecorder.failNextStart = true;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15000);
    });
    expect(result.current.isRecording).toBe(true);
    expect(instances[0].state).toBe('recording');
    expect(result.current.errorMessage).toContain('Synthetic recorder start failure');
    expect(result.current.segments).toHaveLength(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15000);
      await flushPromises();
    });
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete', 'recording']);
    expect(result.current.errorMessage).toBe('');
    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete', 'complete']);
  });

  it.each(['during capture', 'immediately after Record'])('keeps one recording through sign-in %s', async (when) => {
    const { result, rerender, unmount } = renderHook(
      ({ account }) =>
        useRollingTranscriptionRecorder({
          sessionSlug: `sign-in-${when}`,
          context: { account },
          chunkMs: 15000,
        }),
      { initialProps: { account: '' } },
    );
    await act(async () => {
      const starting = result.current.startRecording();
      if (when === 'immediately after Record') rerender({ account: '0x1111111111111111111111111111111111111111' });
      await starting;
    });
    if (when === 'during capture') {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15000);
        await flushPromises();
      });
      rerender({ account: '0x1111111111111111111111111111111111111111' });
    }
    expect(result.current.isRecording).toBe(true);
    expect(mockTrack.stop).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(result.current.segments).toHaveLength(when === 'during capture' ? 2 : 1);
    expect(result.current.segments.every((segment) => segment.status === 'complete')).toBe(true);
    expect(new Set([...mockChunkRecords.values()].map((record) => record.scope)).size).toBe(1);
    const originalTranscript = result.current.transcript;
    unmount();
    const reopened = renderHook(() =>
      useRollingTranscriptionRecorder({
        sessionSlug: `sign-in-${when}`,
        context: { account: '0x1111111111111111111111111111111111111111' },
      }),
    );
    await act(flushPromises);
    expect(reopened.result.current.transcript).toBe(originalTranscript);
    reopened.unmount();
  });

  it('releases the recording after sign-out, once capture stops, so the next account starts afresh', async () => {
    const first = '0x1111111111111111111111111111111111111111';
    const second = '0x2222222222222222222222222222222222222222';
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'First account speech.');
    const { result, rerender, unmount } = renderHook(
      ({ account }) => useRollingTranscriptionRecorder({ sessionSlug: 'shared-phone', context: { account } }),
      { initialProps: { account: first } },
    );
    await act(async () => {
      await result.current.startRecording();
    });
    rerender({ account: '' });
    expect(result.current.isRecording).toBe(true);
    expect(mockTrack.stop).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(result.current.transcript).toBe('');
    rerender({ account: second });
    await act(flushPromises);
    expect(result.current.transcript).toBe('');
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'Second account speech.');
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(result.current.transcript).toBe('Second account speech.');
    unmount();
  });

  it.each([
    ['another account', '0x2222222222222222222222222222222222222222'],
    ['a signed-out visitor', ''],
  ])('starts afresh when the recorder reopens for %s after a sign-out', async (_who, next) => {
    const first = '0x1111111111111111111111111111111111111111';
    const sessionSlug = `reopened-for-${next || 'visitor'}`;
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'First account speech.');
    const recorder = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug, context: { account: first } }));
    await act(async () => {
      await recorder.result.current.startRecording();
    });
    await act(async () => {
      await recorder.result.current.stopRecording();
      await flushPromises();
    });
    expect(recorder.result.current.transcript).toBe('First account speech.');
    recorder.unmount();
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'Next speech.');
    const reopened = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug, context: { account: next } }));
    await act(flushPromises);
    expect(reopened.result.current.transcript).toBe('');
    await act(async () => {
      await reopened.result.current.startRecording();
    });
    await act(async () => {
      await reopened.result.current.stopRecording();
      await flushPromises();
    });
    expect(reopened.result.current.transcript).toBe('Next speech.');
    reopened.unmount();
    if (!next) return;
    const back = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug, context: { account: first } }));
    await act(flushPromises);
    expect(back.result.current.transcript).toBe('First account speech.');
    back.unmount();
  });

  it('keeps the recording open after a sign-out until its last upload is saved', async () => {
    const first = '0x1111111111111111111111111111111111111111';
    let answer = (_text: string) => {};
    (transcribeAudio as jest.Mock).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          answer = resolve;
        }),
    );
    const { result, rerender, unmount } = renderHook(
      ({ account }) => useRollingTranscriptionRecorder({ sessionSlug: 'sign-out-uploading', context: { account } }),
      { initialProps: { account: first } },
    );
    await act(async () => {
      await result.current.startRecording();
    });
    rerender({ account: '' });
    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['transcribing']);
    await act(async () => {
      answer('Paid transcript.');
      await flushPromises();
    });
    const [saved] = [...mockChunkRecords.values()];
    expect(saved).toMatchObject({ segment: { status: 'complete', text: 'Paid transcript.' } });
    expect(saved.audio).toBeUndefined();
    expect(result.current.transcript).toBe('');
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('stops when a second account signs in after a recording started signed out was handed over', async () => {
    const first = '0x1111111111111111111111111111111111111111';
    const second = '0x2222222222222222222222222222222222222222';
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'Speech.');
    const uploadedAs = () =>
      (transcribeAudio as jest.Mock).mock.calls.map(
        (call) => (call[1] as { context: { account: string } }).context.account,
      );
    const { result, rerender, unmount } = renderHook(
      ({ account }) =>
        useRollingTranscriptionRecorder({ sessionSlug: 'handover-switch', context: { account }, chunkMs: 15000 }),
      { initialProps: { account: '' } },
    );
    await act(async () => {
      await result.current.startRecording();
    });
    rerender({ account: first });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15000);
      await flushPromises();
    });
    expect(result.current.isRecording).toBe(true);
    rerender({ account: second });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
      await flushPromises();
    });
    expect(result.current.isRecording).toBe(false);
    expect(uploadedAs()).toEqual([first]);
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete', 'retrying']);
    unmount();
  });

  it('stops when another account signs in mid-recording and uploads only as the account that made it', async () => {
    const first = '0x1111111111111111111111111111111111111111';
    const second = '0x2222222222222222222222222222222222222222';
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'First account speech.');
    const uploadedAs = () =>
      (transcribeAudio as jest.Mock).mock.calls.map(
        (call) => (call[1] as { context: { account: string } }).context.account,
      );
    const { result, rerender, unmount } = renderHook(
      ({ account }) =>
        useRollingTranscriptionRecorder({ sessionSlug: 'account-switch', context: { account }, chunkMs: 15000 }),
      { initialProps: { account: first } },
    );
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15000);
      await flushPromises();
    });
    rerender({ account: second });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
      await flushPromises();
    });
    expect(result.current.isRecording).toBe(false);
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(uploadedAs()).toEqual([first]);
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete', 'retrying']);
    expect([...mockChunkRecords.values()].filter((record) => record.audio)).toHaveLength(1);
    rerender({ account: first });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
      await flushPromises();
    });
    expect(uploadedAs()).toEqual([first, first]);
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete', 'complete']);
    unmount();
  });

  it.each(['while open', 'after reopening'])(
    'keeps a recording only this page holds with its account after a sign-out, %s, and says so',
    async (when) => {
      const first = '0x1111111111111111111111111111111111111111';
      const put = jest.mocked(putRecordingChunk).getMockImplementation()!;
      jest.mocked(putRecordingChunk).mockRejectedValue(new DOMException('Full', 'QuotaExceededError'));
      (transcribeAudio as jest.Mock).mockImplementation(async () => 'Unsaved speech.');
      const sessionSlug = `memory-only-${when}`;
      let recorder = renderHook(
        ({ account }) => useRollingTranscriptionRecorder({ sessionSlug, context: { account } }),
        { initialProps: { account: first } },
      );
      try {
        await act(async () => {
          await recorder.result.current.startRecording();
        });
        await act(async () => {
          await recorder.result.current.stopRecording();
          await flushPromises();
        });
        if (when === 'while open') recorder.rerender({ account: '' });
        else {
          await act(() => recorder.result.current.keepAudio());
          recorder.unmount();
          recorder = renderHook(
            ({ account }) => useRollingTranscriptionRecorder({ sessionSlug, context: { account } }),
            { initialProps: { account: '' } },
          );
        }
        await act(flushPromises);
        expect(recorder.result.current.transcript).toBe('Unsaved speech.');
        expect(recorder.result.current.downloadableChunkIds).toEqual([]);
        expect(recorder.result.current.errorMessage).toContain('belongs to the account that made it');
        await act(async () => {
          await recorder.result.current.startRecording();
        });
        expect(recorder.result.current.isRecording).toBe(false);
        await act(async () => {
          recorder.result.current.clearDraft(true);
          await flushPromises();
        });
        expect(recorder.result.current.transcript).toBe('');
        expect(recorder.result.current.errorMessage).not.toContain('belongs to the account that made it');
      } finally {
        recorder.unmount();
        jest.mocked(putRecordingChunk).mockImplementation(put);
      }
    },
  );

  it('clears a recording made without IndexedDB after its audio is discarded', async () => {
    const list = jest.mocked(listRecordingChunks).getMockImplementation()!;
    const put = jest.mocked(putRecordingChunk).getMockImplementation()!;
    const clear = jest.mocked(clearRecordingChunks).getMockImplementation()!;
    for (const store of [listRecordingChunks, putRecordingChunk, clearRecordingChunks])
      jest.mocked(store).mockRejectedValue(new Error('IndexedDB unavailable'));
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'no-storage-clear' }));
    try {
      await act(async () => {
        await result.current.startRecording();
      });
      await act(async () => {
        await result.current.stopRecording();
        await flushPromises();
      });
      expect(result.current.transcript).toContain('transcript');
      await act(async () => {
        result.current.clearDraft(true);
        await flushPromises();
      });
      expect(result.current.transcript).toBe('');
      expect(result.current.segments).toEqual([]);
    } finally {
      unmount();
      jest.mocked(listRecordingChunks).mockImplementation(list);
      jest.mocked(putRecordingChunk).mockImplementation(put);
      jest.mocked(clearRecordingChunks).mockImplementation(clear);
    }
  });

  it('keeps a hidden period that capture stopped during, ending it at the return, through close and reopen', async () => {
    const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const show = (state: string) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    try {
      jest.setSystemTime(new Date('2026-10-31T14:02:00Z'));
      const first = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'hidden-room' }));
      await act(async () => {
        await first.result.current.startRecording();
      });
      const hiddenAt = Date.now();
      act(() => show('hidden'));
      jest.setSystemTime(new Date('2026-10-31T14:05:00Z'));
      await act(async () => {
        await first.result.current.stopRecording();
        await flushPromises();
      });
      jest.setSystemTime(new Date('2026-10-31T14:12:00Z'));
      await act(async () => {
        show('visible');
        await flushPromises();
      });
      const periods = [{ startedAt: hiddenAt, endedAt: Date.now() }];
      expect(first.result.current.hiddenPeriods).toEqual(periods);
      first.unmount();
      const reopened = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'hidden-room' }));
      await act(flushPromises);
      expect(reopened.result.current.hiddenPeriods).toEqual(periods);
      act(() => reopened.result.current.dismissHiddenPeriods());
      expect(reopened.result.current.hiddenPeriods).toEqual([]);
      reopened.unmount();
    } finally {
      if (visibility) Object.defineProperty(document, 'visibilityState', visibility);
      else Reflect.deleteProperty(document, 'visibilityState');
    }
  });

  it('saves the audio so far as soon as the page is hidden, so a discarded tab loses at most a second', async () => {
    const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const savedAudio = () =>
      [...mockChunkRecords.values()].find((record) => record.segment.id !== 'hidden-periods')?.audio?.size;
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'hidden-save' }));
    try {
      await act(async () => {
        await result.current.startRecording();
      });
      for (let second = 0; second < 5; second++)
        await act(async () => {
          await jest.advanceTimersByTimeAsync(1000);
          instances[0].requestData();
          await flushPromises();
        });
      // The first second is saved at once; the next save would wait ten seconds.
      expect(savedAudio()).toBe(256);
      await act(async () => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        await flushPromises();
      });
      // All five seconds, plus the partial second the recorder hands over when asked.
      expect(savedAudio()).toBe(6 * 256);
      expect(result.current.isRecording).toBe(true);
    } finally {
      unmount();
      if (visibility) Object.defineProperty(document, 'visibilityState', visibility);
      else Reflect.deleteProperty(document, 'visibilityState');
    }
  });

  it('keeps raw audio until a failed upload retries, then lets it go with the saved transcript', async () => {
    (transcribeAudio as jest.Mock)
      .mockImplementationOnce(async () => {
        throw new Error('Temporary upload failure');
      })
      .mockImplementation(async () => 'Recovered speech.');
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'retry' }));
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });
    expect([...mockChunkRecords.values()][0]?.audio?.size).toBe(256);
    expect(result.current.segments[0].status).toBe('retrying');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
      await flushPromises();
    });
    expect(transcribeAudio).toHaveBeenCalledTimes(2);
    expect(result.current.transcript).toBe('Recovered speech.');
    expect([...mockChunkRecords.values()][0]?.segment.text).toBe('Recovered speech.');
    expect([...mockChunkRecords.values()][0]?.audio).toBeUndefined();
    expect(result.current.downloadableChunkIds).toEqual([]);
    unmount();
  });

  it('restarts an upload left hanging by an outage when the connection returns', async () => {
    (transcribeAudio as jest.Mock)
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementation(async () => 'Uploaded after reconnecting.');
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'hung-upload' }));
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(result.current.segments[0].status).toBe('transcribing');
    const firstOptions = (transcribeAudio as jest.Mock).mock.calls[0][1] as { signal: AbortSignal };
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await flushPromises();
    });
    expect(transcribeAudio).toHaveBeenCalledTimes(2);
    expect(result.current.transcript).toBe('Uploaded after reconnecting.');
    expect(firstOptions.signal.aborted).toBe(true);
    unmount();
  });

  it('persists a partial recording before stop and recovers it after reopening', async () => {
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'Recovered partial recording.');
    const first = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'recover' }));
    await act(async () => {
      await first.result.current.startRecording();
    });
    await act(async () => {
      instances[0].requestData();
      await flushPromises();
    });
    expect([...mockChunkRecords.values()][0]?.audio?.size).toBe(256);
    expect(transcribeAudio).not.toHaveBeenCalled();
    // Simulate a process disappearing without the final MediaRecorder event.
    instances[0].state = 'inactive';
    first.unmount();
    const next = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'recover' }));
    await act(async () => {
      await flushPromises();
    });
    expect(next.result.current.transcript).toBe('Recovered partial recording.');
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    next.unmount();
  });

  it('keeps draft questions with the recording, and gives another recording its own', async () => {
    const drafts = {
      questions: [{ id: 'q1', type: 'binary', prompt: 'Kept?' }],
      prompts: ['Kept?'],
      draftedTranscript: 'Speech.',
    };
    const renderRecorder = () =>
      renderHook(({ slug }) => useRollingTranscriptionRecorder({ sessionSlug: slug }), {
        initialProps: { slug: 'kept-drafts' },
      });
    const first = renderRecorder();
    await act(async () => {
      await flushPromises();
    });
    expect(first.result.current.questionDrafts).toBeNull();
    act(() => first.result.current.saveQuestionDrafts(drafts));
    await act(async () => {
      await flushPromises();
    });
    first.unmount();

    const reopened = renderRecorder();
    await act(async () => {
      await flushPromises();
    });
    expect(reopened.result.current.questionDrafts).toEqual(drafts);
    const { scope } = reopened.result.current;
    reopened.rerender({ slug: 'another-session' });
    expect(reopened.result.current.scope).not.toBe(scope);
    expect(reopened.result.current.questionDrafts).toBeNull();
    await act(async () => {
      await flushPromises();
    });
    expect(reopened.result.current.questionDrafts).toBeNull();
    reopened.unmount();
  });

  it('keeps the final audio when a route change unmounts the recorder mid-capture, and uploads it on reopen', async () => {
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'Words before leaving.');
    const first = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'route-change' }));
    await act(async () => {
      await first.result.current.startRecording();
    });
    await act(async () => {
      instances[0].requestData();
      await flushPromises();
    });
    first.unmount();
    await act(flushPromises);
    // The saved snapshot plus the final fragment the recorder delivers on Stop; nothing uploads meanwhile.
    expect([...mockChunkRecords.values()].find((record) => record.audio)?.audio?.size).toBe(512);
    expect(transcribeAudio).not.toHaveBeenCalled();
    const reopened = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'route-change' }));
    await act(flushPromises);
    expect(reopened.result.current.transcript).toBe('Words before leaving.');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    reopened.unmount();
  });

  it('does not start a microphone request completed after switching sessions', async () => {
    let grant!: (value: MediaStream) => void;
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          grant = resolve;
        }),
    );
    const { result, rerender, unmount } = renderHook(
      ({ slug }) => useRollingTranscriptionRecorder({ sessionSlug: slug }),
      { initialProps: { slug: 'first' } },
    );
    let started!: Promise<void>;
    await act(async () => {
      started = result.current.startRecording();
      await flushPromises();
    });
    rerender({ slug: 'second' });
    await act(async () => {
      grant(mockStream);
      await started;
    });
    expect(instances).toHaveLength(0);
    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('says when the device pauses the microphone, and notes the gap where recording continues', async () => {
    const listeners: Record<string, () => void> = {};
    Object.assign(mockTrack, {
      addEventListener: (name: string, callback: () => void) => {
        listeners[name] = callback;
      },
    });
    let uploads = 0;
    (transcribeAudio as jest.Mock).mockImplementation(async () => `Chunk ${++uploads}.`);
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({ sessionSlug: 'muted', chunkMs: 60_000 }),
    );
    await act(async () => {
      await result.current.startRecording();
      await jest.advanceTimersByTimeAsync(10_000);
    });
    // A call or Siri takes the microphone without hiding the page.
    act(() => listeners.mute());
    expect(result.current.microphonePaused).toBe(true);
    expect(result.current.isRecording).toBe(true);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(80_000);
    });
    // The rotation during the pause still ends chunk 1 on time.
    expect(instances).toHaveLength(2);
    await act(async () => {
      listeners.unmute();
      await flushPromises();
    });
    expect(result.current.microphonePaused).toBe(false);
    // Recording continues in a new chunk, which starts a full chunk length from the return.
    expect(instances).toHaveLength(3);
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete', 'complete', 'recording']);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(59_000);
    });
    expect(instances).toHaveLength(3);
    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(result.current.transcript).toBe('Chunk 1. Chunk 2. [Microphone paused for 1 min 20 s.] Chunk 3.');
    unmount();
  });

  it('stops on microphone revocation and keeps the final audio available', async () => {
    let ended = () => {};
    Object.assign(mockTrack, {
      addEventListener: (name: string, callback: () => void) => {
        if (name === 'ended') ended = callback;
      },
    });
    (transcribeAudio as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'revoked' }));
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      ended();
      await flushPromises();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toContain('Restore microphone permission');
    expect([...mockChunkRecords.values()][0]?.audio?.size).toBe(256);
    expect(instances[0].stop).toHaveBeenCalledTimes(1);
    unmount();
  });

  describe('leaving the page', () => {
    const leaving = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    beforeEach(() => window.history.replaceState(null, '', '/session/breakout?mode=groupRecording'));

    it('asks before a reload or tab close while capturing, then while the last chunk uploads', async () => {
      let answer = (_text: string) => {};
      (transcribeAudio as jest.Mock).mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            answer = resolve;
          }),
      );
      const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'leave-upload' }));
      expect(leaving()).toBe(false);
      await act(async () => {
        await result.current.startRecording();
      });
      expect(leaving()).toBe(true);
      await act(async () => {
        await result.current.stopRecording();
        await flushPromises();
      });
      expect(result.current.segments.map((segment) => segment.status)).toEqual(['transcribing']);
      expect(leaving()).toBe(true);
      await act(async () => {
        answer('Uploaded.');
        await flushPromises();
      });
      expect(leaving()).toBe(false);
      unmount();
    });

    it.each(['a transcribed chunk', 'a pasted transcript'])(
      'asks before leaving while %s is held only in memory, also once the recorder closes',
      async (kind) => {
        const put = jest.mocked(putRecordingChunk).getMockImplementation()!;
        jest.mocked(putRecordingChunk).mockRejectedValue(new DOMException('Full', 'QuotaExceededError'));
        const sessionSlug = `leave-memory-${kind.length}`;
        let recorder = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug }));
        try {
          if (kind === 'a transcribed chunk')
            await act(async () => {
              await recorder.result.current.startRecording();
            });
          await act(async () => {
            if (kind === 'a transcribed chunk') await recorder.result.current.stopRecording();
            else await recorder.result.current.addTranscript('Pasted notes.');
            await flushPromises();
          });
          expect(recorder.result.current.segments.map((segment) => segment.status)).toEqual(['complete']);
          expect(recorder.result.current.downloadableChunkIds).toEqual([]);
          expect(leaving()).toBe(true);
          await act(() => recorder.result.current.keepAudio());
          recorder.unmount();
          expect(leaving()).toBe(true);
          // Reopened and cleared, nothing is left to lose.
          recorder = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug }));
          await act(flushPromises);
          expect(recorder.result.current.transcript).toBe(
            kind === 'a transcribed chunk' ? 'transcript 1' : 'Pasted notes.',
          );
          await act(async () => {
            recorder.result.current.clearDraft(true);
            await flushPromises();
          });
          expect(leaving()).toBe(false);
        } finally {
          recorder.unmount();
          jest.mocked(putRecordingChunk).mockImplementation(put);
        }
        expect(leaving()).toBe(false);
      },
    );

    it('keeps the page on Back while capturing, says why, and lets Back leave once capture stops', async () => {
      const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'leave-back' }));
      const address = window.location.href;
      const entries = window.history.length;
      await act(async () => {
        await result.current.startRecording();
      });
      expect(window.history.length).toBe(entries + 1);
      await act(async () => {
        window.history.back();
        await jest.advanceTimersByTimeAsync(10);
      });
      expect(window.location.href).toBe(address);
      expect(result.current.isRecording).toBe(true);
      expect(result.current.backBlocked).toBe(true);
      expect(window.history.length).toBe(entries + 1);
      await act(async () => {
        await result.current.stopRecording();
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10);
      });
      expect(result.current.backBlocked).toBe(false);
      // The extra entry is gone from the top, so one Back leaves.
      expect(window.history.state).toBeNull();
      expect(leaving()).toBe(false);
      unmount();
    });
  });

  it('finishes the last chunk from the audio so far when the recorder never confirms Stop', async () => {
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'Speech before Stop.');
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'lost-stop' }));
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      instances[0].requestData();
      await flushPromises();
    });
    instances[0].stop.mockImplementation(() => {
      instances[0].state = 'inactive';
    });
    await act(async () => {
      const stopping = result.current.stopRecording();
      await jest.advanceTimersByTimeAsync(2000);
      await stopping;
      await flushPromises();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete']);
    expect(result.current.transcript).toBe('Speech before Stop.');
    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    // A stop event that turns up late changes nothing.
    await act(async () => {
      instances[0].onstop?.();
      await flushPromises();
    });
    expect(result.current.status).toBe('idle');
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('finishes a rotated-out chunk whose stop event never comes, so later chunks still upload', async () => {
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({ sessionSlug: 'lost-rotation-stop', chunkMs: 15_000 }),
    );
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      instances[0].requestData();
      await flushPromises();
    });
    instances[0].stop.mockImplementation(() => {
      instances[0].state = 'inactive';
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete', 'complete', 'recording']);
    expect(jest.mocked(transcribeAudio).mock.calls.map(([blob]) => blob.size)).toEqual([256, 256]);
    unmount();
  });

  it('finishes the chunk of a recorder that went quiet without a stop event when Stop is pressed', async () => {
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'went-quiet' }));
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      instances[0].requestData();
      await flushPromises();
    });
    instances[0].state = 'inactive';
    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete']);
    unmount();
  });

  it('ignores audio delivered after a chunk was finished without its stop event', async () => {
    const onLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    let online = false;
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'late-fragment' }));
    try {
      await act(async () => {
        await result.current.startRecording();
      });
      await act(async () => {
        instances[0].requestData();
        await flushPromises();
      });
      instances[0].stop.mockImplementation(() => {
        instances[0].state = 'inactive';
      });
      await act(async () => {
        const stopping = result.current.stopRecording();
        await jest.advanceTimersByTimeAsync(2000);
        await stopping;
      });
      expect(result.current.segments.map((segment) => segment.status)).toEqual(['retrying']);
      await act(async () => {
        instances[0].ondataavailable?.({ data: new Blob([new Uint8Array(256)], { type: 'audio/webm' }) });
        await flushPromises();
      });
      expect(result.current.segments.map((segment) => segment.status)).toEqual(['retrying']);
      await act(async () => {
        online = true;
        window.dispatchEvent(new Event('online'));
        await flushPromises();
      });
      expect(result.current.segments.map((segment) => segment.status)).toEqual(['complete']);
    } finally {
      unmount();
      if (onLine) Object.defineProperty(navigator, 'onLine', onLine);
      else Reflect.deleteProperty(navigator, 'onLine');
    }
  });

  it('shows a stop notice when the recorder stops by itself, keeps its audio, and resumes with one tap', async () => {
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'Speech before the stop.');
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({ sessionSlug: 'self-stop', chunkMs: 15_000 }),
    );
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      // The browser ends capture with no error event, as when the system takes the microphone.
      instances[0].state = 'inactive';
      instances[0].ondataavailable?.({ data: new Blob([new Uint8Array(256)], { type: 'audio/webm' }) });
      instances[0].onstop?.();
      await flushPromises();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/^Recording stopped\. Press Record to continue\./);
    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    expect(result.current.transcript).toBe('Speech before the stop.');
    const elapsed = result.current.elapsedSeconds;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000);
    });
    expect(result.current.elapsedSeconds).toBe(elapsed);
    expect(instances).toHaveLength(1);
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.status).toBe('recording');
    expect(result.current.errorMessage).toBe('');
    unmount();
  });

  it.each(['storage', 'offline'] as const)(
    'shows a microphone stop ahead of the %s notice, which never says capture continues',
    async (notice) => {
      const original = jest.mocked(putRecordingChunk).getMockImplementation()!;
      const onLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');
      if (notice === 'storage') {
        jest.mocked(putRecordingChunk).mockImplementation(async () => {
          throw new DOMException('Full', 'QuotaExceededError');
        });
      }
      let ended = () => {};
      Object.assign(mockTrack, {
        addEventListener: (name: string, callback: () => void) => {
          if (name === 'ended') ended = callback;
        },
      });
      (transcribeAudio as jest.Mock).mockImplementation(() => new Promise(() => {}));
      const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: `${notice}-stop` }));
      try {
        await act(async () => {
          await result.current.startRecording();
        });
        await act(async () => {
          if (notice === 'offline') {
            Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
            window.dispatchEvent(new Event('offline'));
          }
          instances[0].requestData();
          await flushPromises();
        });
        const noticeText = notice === 'storage' ? "This recording can't be recovered after a reload" : 'Offline.';
        expect(result.current.errorMessage).toContain(noticeText);
        await act(async () => {
          ended();
          await flushPromises();
        });
        expect(result.current.status).toBe('error');
        expect(result.current.errorMessage).toMatch(/^Microphone access ended/);
        expect(result.current.errorMessage).toContain(noticeText);
        expect(result.current.errorMessage).not.toMatch(/recording and transcription continue/i);
      } finally {
        unmount();
        jest.mocked(putRecordingChunk).mockImplementation(original);
        if (onLine) Object.defineProperty(navigator, 'onLine', onLine);
        else delete (navigator as { onLine?: boolean }).onLine;
      }
    },
  );

  it('keeps capturing and transcribing from memory when storage fails', async () => {
    const original = jest.mocked(putRecordingChunk).getMockImplementation()!;
    jest.mocked(putRecordingChunk).mockImplementation(async () => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'full' }));
    try {
      await act(async () => {
        await result.current.startRecording();
      });
      await act(async () => {
        instances[0].requestData();
        await flushPromises();
      });
      expect(result.current.isRecording).toBe(true);
      expect(instances[0].stop).not.toHaveBeenCalled();
      expect(result.current.errorMessage).toContain("This recording can't be recovered after a reload");
      expect(result.current.storageFailed).toBe(true);
      expect(result.current.downloadableChunkIds).toHaveLength(1);
      expect(transcribeAudio).not.toHaveBeenCalled();
      // Until it is transcribed, the audio only this page holds can be downloaded.
      const createUrl = jest.fn<typeof URL.createObjectURL>(() => 'blob:recording-fixture');
      const previous = URL.createObjectURL;
      URL.createObjectURL = createUrl;
      const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      try {
        act(() => {
          result.current.downloadChunk(result.current.downloadableChunkIds[0]);
        });
        expect(createUrl).toHaveBeenCalledWith(expect.objectContaining({ size: 256 }));
        expect(click).toHaveBeenCalledTimes(1);
      } finally {
        URL.createObjectURL = previous;
        click.mockRestore();
      }
      await act(async () => {
        await result.current.stopRecording();
        await flushPromises();
      });
      expect(result.current.transcript).toContain('transcript');
      expect(transcribeAudio).toHaveBeenCalledTimes(1);
      // Transcribed, the page keeps only the transcript.
      expect(result.current.downloadableChunkIds).toEqual([]);
    } finally {
      unmount();
      jest.mocked(putRecordingChunk).mockImplementation(original);
    }
  });

  it('records without IndexedDB and explains that reload recovery is unavailable', async () => {
    const list = jest.mocked(listRecordingChunks).getMockImplementation()!;
    const put = jest.mocked(putRecordingChunk).getMockImplementation()!;
    jest.mocked(listRecordingChunks).mockRejectedValue(new Error('IndexedDB unavailable'));
    jest.mocked(putRecordingChunk).mockRejectedValue(new Error('IndexedDB unavailable'));
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'no-storage' }));
    try {
      await act(async () => {
        await result.current.startRecording();
      });
      expect(result.current.isRecording).toBe(true);
      expect(result.current.errorMessage).toContain("This recording can't be recovered after a reload");
      await act(async () => {
        await result.current.stopRecording();
        await flushPromises();
      });
      expect(result.current.transcript).toContain('transcript');
    } finally {
      unmount();
      jest.mocked(listRecordingChunks).mockImplementation(list);
      jest.mocked(putRecordingChunk).mockImplementation(put);
    }
  });

  it('writes at most twenty snapshots and transcript records for a three-minute chunk', async () => {
    const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ chunkMs: 180_001 }));
    await act(async () => {
      await result.current.startRecording();
    });
    for (let second = 0; second < 180; second++) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1000);
        instances[0].requestData();
        await flushPromises();
      });
    }
    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(putRecordingChunk).toHaveBeenCalled();
    expect(jest.mocked(putRecordingChunk).mock.calls.length).toBeLessThanOrEqual(20);
    expect(result.current.transcript).toContain('transcript');
    unmount();
  });

  it('rotates to a fresh recorder segment and transcribes the flushed chunk', async () => {
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({
        sessionSlug: 'demo',
        chunkMs: 15_000,
      }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      }),
    });
    expect(instances).toHaveLength(1);
    expect(instances[0].start).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('recording');

    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await flushPromises();
    });

    expect(instances).toHaveLength(2);
    expect(instances[1].start).toHaveBeenCalledTimes(1);
    expect(instances[0].requestData).not.toHaveBeenCalled();
    expect(instances[0].stop).toHaveBeenCalledTimes(1);
    expect(transcribeAudio).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.stopRecording();
      await flushPromises();
    });

    expect(instances[1].requestData).not.toHaveBeenCalled();
    expect(instances[1].stop).toHaveBeenCalledTimes(1);
    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');

    unmount();
  });

  it('manual stop flushes and transcribes the current partial segment', async () => {
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({
        sessionSlug: 'demo',
        chunkMs: 15_000,
      }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });

    expect(instances[0].stop).toHaveBeenCalledTimes(1);
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(result.current.transcript).toContain('transcript');
    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');

    unmount();
  });

  it('finalizes a paused recorder and waits for the flushed transcription when requested', async () => {
    let resolveTranscription: ((value: string) => void) | null = null;
    (transcribeAudio as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTranscription = resolve;
        }),
    );
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({
        sessionSlug: 'demo',
        chunkMs: 15_000,
      }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.pauseRecording();
    });

    let finalizeSettled = false;
    let finalizePromise: Promise<void> = Promise.resolve();
    await act(async () => {
      finalizePromise = result.current.finalizeRecording({ waitForTranscription: true }).then(() => {
        finalizeSettled = true;
      });
      await flushPromises();
    });

    expect(instances[0].stop).toHaveBeenCalledTimes(1);
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(finalizeSettled).toBe(false);

    await act(async () => {
      resolveTranscription?.('paused final chunk');
      await finalizePromise!;
      await flushPromises();
    });

    expect(finalizeSettled).toBe(true);
    expect(result.current.transcript).toContain('paused final chunk');
    expect(result.current.status).toBe('idle');

    unmount();
  });

  it('pauses and resumes without rotating or advancing the visible timer while paused', async () => {
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({
        sessionSlug: 'demo',
        chunkMs: 15_000,
      }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(result.current.elapsedSeconds).toBe(2);

    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.status).toBe('paused');
    expect(result.current.isPaused).toBe(true);
    expect(instances[0].pause).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(20_000);
      await flushPromises();
    });

    expect(result.current.elapsedSeconds).toBe(2);
    expect(instances).toHaveLength(1);

    act(() => {
      result.current.resumeRecording();
    });

    expect(result.current.status).toBe('recording');
    expect(result.current.isPaused).toBe(false);
    expect(instances[0].resume).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.elapsedSeconds).toBe(3);

    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await flushPromises();
    });

    expect(instances).toHaveLength(2);

    unmount();
  });
  it('retries a failed upload during a 45-minute foreground recording', async () => {
    (transcribeAudio as jest.Mock)
      .mockImplementationOnce(async () => {
        throw new Error('Mobile connection lost');
      })
      .mockImplementation(async () => 'Synthetic room transcript.');
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({ sessionSlug: 'workshop', recordSpeakerAudio: true }),
    );
    await act(async () => {
      await result.current.startRecording();
    });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ echoCancellation: false, noiseSuppression: true }),
    });
    for (let segment = 0; segment < 15; segment += 1) {
      // Answers settle between timers, as in a browser; a synchronous advance would hold them for minutes.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3 * 60 * 1000);
        await flushPromises();
      });
    }
    expect(transcribeAudio).toHaveBeenCalledTimes(16);
    expect(result.current.segments).toHaveLength(16);
    expect(result.current.segments.filter((segment) => segment.status === 'recording')).toHaveLength(1);
    expect(result.current.segments.filter((segment) => segment.status === 'failed')).toHaveLength(0);
    expect(result.current.segments.filter((segment) => segment.status === 'complete')).toHaveLength(15);
    expect(result.current.pendingSegmentCount).toBe(0);
    expect(result.current.elapsedSeconds).toBe(45 * 60);
    unmount();
  });
  it('keeps a fallback transcript and stops requesting labels for the rest of the recording', async () => {
    (transcribeGroupAudio as jest.Mock).mockImplementation(async () => ({
      text: 'First chunk.',
      segments: [],
      labelsUnavailableReason: 'Labels unavailable.',
    }));
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'Second chunk.');
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({ sessionSlug: 'fallback', labelSpeakers: true }),
    );
    await act(async () => {
      await result.current.startRecording();
    });
    for (let index = 0; index < 2; index++)
      await act(async () => {
        jest.advanceTimersByTime(180000);
        await flushPromises();
      });
    expect(result.current.transcript).toContain('First chunk.');
    expect(result.current.transcript).toContain('Second chunk.');
    expect(result.current.labelsUnavailableReason).toBe('Labels unavailable.');
    expect(result.current.segments.filter((segment) => segment.status === 'complete')).toHaveLength(2);
    expect(result.current.segments.filter((segment) => segment.status === 'recording')).toHaveLength(1);
    expect(transcribeGroupAudio).toHaveBeenCalledTimes(1);
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('names voices across chunks, sending earlier voices with later chunks', async () => {
    const turn = (speaker: string, text: string) => ({ speaker, start: 0, end: 4, text });
    (transcribeGroupAudio as jest.Mock)
      .mockImplementationOnce(async () => ({ text: 'Room question.', segments: [turn('A', 'Room question.')] }))
      .mockImplementation(async () => ({ text: 'Room answer.', segments: [turn('Person 1', 'Room answer.')] }));
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({ sessionSlug: 'workshop', labelSpeakers: true }),
    );
    await act(async () => {
      await result.current.startRecording();
    });
    for (let i = 0; i < 2; i++)
      await act(async () => {
        jest.advanceTimersByTime(180000);
        await flushPromises();
      });
    expect(transcribeGroupAudio).toHaveBeenCalledTimes(2);
    expect(transcribeAudio).not.toHaveBeenCalled();
    // The first chunk's voice is sampled from its own audio and sent with the next chunk.
    expect(cutSpeakerSamples).toHaveBeenCalledWith(expect.any(Blob), [expect.objectContaining({ start: 0, end: 4 })]);
    const requests = (transcribeGroupAudio as jest.Mock).mock.calls as Array<[Blob, { knownSpeakers: unknown }]>;
    expect(requests.map(([, options]) => options.knownSpeakers)).toEqual([
      [],
      [{ name: 'Person 1', sample: 'data:audio/wav;base64,A' }],
    ]);
    expect(result.current.transcript).toBe('Person 1: Room question. Room answer.');
    instances[instances.length - 1].state = 'inactive';
    unmount();
    const restored = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'workshop' }));
    await act(async () => {
      await flushPromises();
    });
    expect(
      restored.result.current.segments.map((segment) => segment.speakerTurns?.map((entry) => entry.speaker)),
    ).toEqual([['Person 1'], ['Person 1']]);
    restored.unmount();
  });
  it('lets one tab at a time open a recording, and hands it over when that tab closes', async () => {
    const uninstallLocks = installFakeWebLocks();
    try {
      (transcribeAudio as jest.Mock).mockImplementation(() => new Promise(() => {}));
      const first = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'two-tabs' }));
      await act(async () => {
        await flushPromises();
        await first.result.current.startRecording();
      });
      expect(first.result.current.isRecording).toBe(true);
      const second = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'two-tabs' }));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1000);
      });
      expect(first.result.current.openElsewhere).toBe(false);
      expect(second.result.current.openElsewhere).toBe(true);
      expect(second.result.current.errorMessage).toBe('This recording is open in another tab.');
      await act(async () => {
        await second.result.current.startRecording();
      });
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
      // The first tab stops, keeps its unsent chunk and closes; the second takes over and uploads it.
      await act(async () => {
        await first.result.current.stopRecording();
        await first.result.current.keepAudio();
        await flushPromises();
      });
      expect(transcribeAudio).toHaveBeenCalledTimes(1);
      (transcribeAudio as jest.Mock).mockImplementation(async () => 'Uploaded by the second tab.');
      first.unmount();
      await act(async () => {
        await flushPromises();
      });
      expect(second.result.current.openElsewhere).toBe(false);
      expect(second.result.current.errorMessage).toBe('');
      expect(second.result.current.transcript).toBe('Uploaded by the second tab.');
      expect(transcribeAudio).toHaveBeenCalledTimes(2);
      second.unmount();
    } finally {
      uninstallLocks();
    }
  });

  it('restarts the microphone when no audio has arrived for a chunk length and 30 seconds', async () => {
    let uploads = 0;
    (transcribeAudio as jest.Mock).mockImplementation(async () => `Chunk ${++uploads}.`);
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({ sessionSlug: 'stalled', chunkMs: 60_000 }),
    );
    await act(async () => {
      await result.current.startRecording();
      await jest.advanceTimersByTimeAsync(10_000);
      instances[0].requestData();
    });
    // From now on capture dies without any event; rotating the recorder on the same stream doesn't help.
    instances[0].silent = MockMediaRecorder.silent = true;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(90_000);
    });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(result.current.captureNotice).toBe('');
    MockMediaRecorder.silent = false;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
      await flushPromises();
    });
    // 95 seconds without audio: a fresh microphone stream and recorder take over.
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(true);
    expect(result.current.captureNotice).toBe('No audio arrived for a while, so the microphone was restarted.');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000);
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(result.current.transcript).toBe('Chunk 1. [No audio for 1 min 35 s.] Chunk 2.');
    unmount();
  });

  it('stops with an error, keeping the audio, when the microphone cannot restart', async () => {
    (transcribeAudio as jest.Mock).mockImplementation(async () => 'Before the stall.');
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({ sessionSlug: 'no-restart', chunkMs: 60_000 }),
    );
    await act(async () => {
      await result.current.startRecording();
      instances[0].requestData();
    });
    instances[0].silent = MockMediaRecorder.silent = true;
    jest.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(new Error('Microphone busy'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(95_000);
      await flushPromises();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/^Recording stopped: no audio arrived.*Microphone busy$/);
    // The audio delivered before the stall is transcribed, and one press of Record continues.
    expect(result.current.transcript).toBe('Before the stall.');
    MockMediaRecorder.silent = false;
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);
    unmount();
  });

  it('keeps the last audio a stalled recorder hands over after its stop', async () => {
    let uploads = 0;
    (transcribeAudio as jest.Mock).mockImplementation(async () => `Chunk ${++uploads}.`);
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({ sessionSlug: 'late-flush', chunkMs: 60_000 }),
    );
    await act(async () => {
      await result.current.startRecording();
      instances[0].requestData();
    });
    instances[0].silent = MockMediaRecorder.silent = true;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    // As in a browser, the stalled recorder's buffered audio and stop event come in a later task.
    const stalled = instances[1];
    stalled.stop.mockImplementation(() => {
      stalled.state = 'inactive';
      setTimeout(() => {
        stalled.ondataavailable?.({ data: new Blob([new Uint8Array(512)], { type: 'audio/webm' }) });
        stalled.onstop?.();
      }, 0);
    });
    MockMediaRecorder.silent = false;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(35_000);
      await flushPromises();
    });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(result.current.transcript).toBe('Chunk 1. Chunk 2. [No audio for 1 min 35 s.] Chunk 3.');
    unmount();
  });

  it('runs one microphone restart at a time, and drops one that answers after Stop', async () => {
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({ sessionSlug: 'slow-restart', chunkMs: 60_000 }),
    );
    await act(async () => {
      await result.current.startRecording();
    });
    MockMediaRecorder.silent = instances[0].silent = true;
    let answer = (_stream: MediaStream) => {};
    jest.mocked(navigator.mediaDevices.getUserMedia).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    // The restart waits on the microphone for longer than another stall.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10 * 60_000);
    });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    await act(async () => {
      await result.current.stopRecording();
      await flushPromises();
    });
    expect(result.current.status).toBe('idle');
    const lateTrack = { stop: jest.fn() };
    const recorders = instances.length;
    await act(async () => {
      answer({ getTracks: () => [lateTrack] } as unknown as MediaStream);
      await flushPromises();
    });
    expect(lateTrack.stop).toHaveBeenCalled();
    expect(instances).toHaveLength(recorders);
    expect(instances.some((recorder) => recorder.state === 'recording')).toBe(false);
    unmount();
  });

  it('records without a lock when the browser refuses Web Locks', async () => {
    const refuse = jest.fn(async () => {
      throw new DOMException('Locks are not allowed here.', 'SecurityError');
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: refuse } });
    try {
      const { result, unmount } = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'no-locks' }));
      await act(async () => {
        await flushPromises();
        await result.current.startRecording();
      });
      expect(refuse).toHaveBeenCalled();
      expect(result.current.openElsewhere).toBe(false);
      expect(result.current.isRecording).toBe(true);
      unmount();
    } finally {
      Reflect.deleteProperty(navigator, 'locks');
    }
  });

  it('expects no audio while the page is hidden or the device holds the microphone', async () => {
    const listeners: Record<string, () => void> = {};
    Object.assign(mockTrack, {
      addEventListener: (name: string, callback: () => void) => {
        listeners[name] = callback;
      },
    });
    MockMediaRecorder.silent = true;
    const { result, unmount } = renderHook(() =>
      useRollingTranscriptionRecorder({ sessionSlug: 'quiet', chunkMs: 60_000 }),
    );
    await act(async () => {
      await result.current.startRecording();
    });
    act(() => listeners.mute());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5 * 60_000);
    });
    const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    try {
      await act(async () => {
        listeners.unmute();
        await jest.advanceTimersByTimeAsync(5 * 60_000);
      });
    } finally {
      if (visibility) Object.defineProperty(document, 'visibilityState', visibility);
      else Reflect.deleteProperty(document, 'visibilityState');
    }
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(result.current.captureNotice).toBe('');
    unmount();
  });
});
