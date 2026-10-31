import { act, renderHook } from '@testing-library/react';
import { useRollingTranscriptionRecorder } from './useRollingTranscriptionRecorder';
import { transcribeAudio, transcribeGroupAudio } from '../ai/aiClient.js';
import { listRecordingChunks, putRecordingChunk } from './recordingChunkStore';

jest.mock('../ai/aiClient.js', () => ({
  transcribeAudio: jest.fn(),
  transcribeGroupAudio: jest.fn(),
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
      mockChunkRecords.set(record.segment.id, { ...record, segment: { ...record.segment } });
    },
  ),
  clearRecordingChunks: jest.fn(async () => mockChunkRecords.clear()),
}));

const flushPromises = async () => {
  for (let index = 0; index < 40; index++) await Promise.resolve();
};

describe('useRollingTranscriptionRecorder', () => {
  let originalMediaRecorder: unknown;
  let originalMediaDevices: MediaDevices | undefined;
  let mockTrack: { stop: jest.Mock };
  let mockStream: MediaStream;
  const instances: MockMediaRecorder[] = [];

  class MockMediaRecorder {
    static isTypeSupported = jest.fn(() => true);
    static failNextStart = false;

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
      this.ondataavailable?.({
        data: new Blob([new Uint8Array(256).fill(instances.indexOf(this) + 1)], { type: 'audio/webm' }),
      });
    });
    stop = jest.fn(() => {
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
    (transcribeAudio as jest.Mock).mockImplementation(async (_blob: Blob) => `transcript ${instances.length}`);

    originalMediaRecorder = (globalThis as any).MediaRecorder;
    originalMediaDevices = navigator.mediaDevices;
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

  it('keeps raw audio until a failed upload retries and its transcript is saved', async () => {
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

  it('stops on microphone revocation and keeps the final audio available', async () => {
    let ended = () => {};
    Object.assign(mockTrack, {
      addEventListener: (_name: string, callback: () => void) => {
        ended = callback;
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
        addEventListener: (_name: string, callback: () => void) => {
          ended = callback;
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
      expect(result.current.downloadableChunkIds).toHaveLength(1);
      expect(transcribeAudio).not.toHaveBeenCalled();
      await act(async () => {
        await result.current.stopRecording();
        await flushPromises();
      });
      expect(result.current.transcript).toContain('transcript');
      expect(transcribeAudio).toHaveBeenCalledTimes(1);
      const createUrl = jest.fn<typeof URL.createObjectURL>(() => 'blob:recording-fixture');
      const previous = URL.createObjectURL;
      URL.createObjectURL = createUrl;
      const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      try {
        act(() => {
          result.current.downloadChunk(result.current.downloadableChunkIds[0]);
        });
        expect(createUrl).toHaveBeenCalledWith(expect.objectContaining({ size: 512 }));
        expect(click).toHaveBeenCalledTimes(1);
      } finally {
        URL.createObjectURL = previous;
        click.mockRestore();
      }
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
      await act(async () => {
        jest.advanceTimersByTime(3 * 60 * 1000);
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

  it('keeps speaker labels scoped to each independently transcribed chunk', async () => {
    const turns = [{ speaker: 'A', start: 0, end: 1, text: 'Room question.' }];
    (transcribeGroupAudio as jest.Mock).mockImplementation(async () => ({ text: 'Room question.', segments: turns }));
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
    expect(
      result.current.segments.filter((segment) => segment.status === 'complete').map((segment) => segment.speakerTurns),
    ).toEqual([turns, turns]);
    instances[instances.length - 1].state = 'inactive';
    unmount();
    const restored = renderHook(() => useRollingTranscriptionRecorder({ sessionSlug: 'workshop' }));
    await act(async () => {
      await flushPromises();
    });
    expect(restored.result.current.segments.map((segment) => segment.speakerTurns)).toEqual([turns, turns]);
    restored.unmount();
  });
});
