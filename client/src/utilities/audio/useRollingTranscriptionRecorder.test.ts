import { act, renderHook } from '@testing-library/react';
import { useRollingTranscriptionRecorder } from './useRollingTranscriptionRecorder';
import { transcribeAudio } from '../ai/aiClient.js';

jest.mock('../ai/aiClient.js', () => ({
  transcribeAudio: jest.fn(),
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('useRollingTranscriptionRecorder', () => {
  let originalMediaRecorder: unknown;
  let originalMediaDevices: MediaDevices | undefined;
  let mockTrack: { stop: jest.Mock };
  let mockStream: MediaStream;
  const instances: MockMediaRecorder[] = [];

  class MockMediaRecorder {
    static isTypeSupported = jest.fn(() => true);

    stream: MediaStream;
    state: RecordingState = 'inactive';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onstop: (() => void) | null = null;
    start = jest.fn(() => {
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
    instances.length = 0;
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
});
