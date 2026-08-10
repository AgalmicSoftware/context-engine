import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import AudioInput from './AudioInput';
import { requestAiRewrite } from '../../../utilities/ai/aiClient';
import { useWhisper, RECORDING_STATUS } from '../../../utilities/useWhisper';
import { readThemeToken, subscribeThemeChanges } from '../../../utilities/ui/themeRuntime';

type LastRecording = {
  blob: Blob | null;
  mimeType?: string;
};

type MutableRef<T> = {
  current: T | null;
};

type TranscriptState = {
  live: string;
  final: string;
};

type AnalyserNodeLike = {
  fftSize: number;
  frequencyBinCount: number;
  getByteFrequencyData: (array: Uint8Array) => void;
  disconnect: () => void;
};

type MediaStreamLike = {
  id?: string;
};

type SourceNodeLike = {
  connect: (node: AnalyserNodeLike) => void;
  disconnect: () => void;
};

type AudioContextLike = {
  state: AudioContextState;
  createAnalyser: () => AnalyserNodeLike;
  createMediaStreamSource: (stream: MediaStreamLike) => SourceNodeLike;
  resume: () => Promise<void>;
};

type WhisperState = {
  status: string;
  isRecording: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  isStreaming: boolean;
  transcript: TranscriptState;
  errorMessage: string;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  audioContextRef: MutableRef<AudioContextLike>;
  mediaStreamRef: MutableRef<MediaStreamLike>;
  lastRecordingBlobRef: {
    current: LastRecording;
  };
  getLastRecordingBlob: () => LastRecording;
};

type UseWhisperMock = jest.MockedFunction<(options?: unknown) => WhisperState>;
type RequestAiRewriteMock = jest.MockedFunction<(text: string, options?: unknown) => Promise<string>>;

type RafEntry = {
  id: number;
  cb: FrameRequestCallback;
} | null;

const mockUseWhisper = useWhisper as unknown as UseWhisperMock;
const mockRequestAiRewrite = requestAiRewrite as unknown as RequestAiRewriteMock;
const actGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

jest.mock('../../../utilities/ai/aiClient', () => {
  const actual = jest.requireActual('../../../utilities/ai/aiClient');
  return {
    ...actual,
    requestAiRewrite: jest.fn(),
    setVadTrimEnabled: jest.fn(),
  };
});

jest.mock('../../../utilities/useWhisper', () => {
  const actual = jest.requireActual('../../../utilities/useWhisper');
  return { ...actual, useWhisper: jest.fn() };
});

jest.mock('../../../utilities/ui/themeRuntime', () => ({
  readThemeToken: jest.fn((_token: string, fallback: string) => fallback),
  subscribeThemeChanges: jest.fn(() => jest.fn()),
}));

const buildWhisperState = (overrides: Partial<WhisperState> = {}): WhisperState => ({
  status: RECORDING_STATUS.READY,
  isRecording: false,
  isPaused: false,
  isProcessing: false,
  isStreaming: false,
  transcript: { live: '', final: '' },
  errorMessage: '',
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  pauseRecording: jest.fn(),
  resumeRecording: jest.fn(),
  audioContextRef: { current: null },
  mediaStreamRef: { current: null },
  lastRecordingBlobRef: { current: { blob: null, mimeType: '' } },
  getLastRecordingBlob: () => ({ blob: null, mimeType: '' }),
  ...overrides,
});

describe('AudioInput', () => {
  let container: HTMLDivElement;
  let root: Root;
  let rootMounted = false;
  let previousActEnvironment: boolean | undefined;
  let rafQueue: RafEntry[] = [];
  let rafId = 0;
  let requestAnimationFrameSpy: jest.SpyInstance<number, [FrameRequestCallback]>;

  const requireElement = <T extends Element>(element: T | null): T => {
    expect(element).not.toBeNull();
    return element as T;
  };

  const setNativeValue = (element: Element, value: string) => {
    const ownDescriptor = Object.getOwnPropertyDescriptor(element, 'value');
    const prototype = Object.getPrototypeOf(element);
    const prototypeDescriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : undefined;
    const setter = prototypeDescriptor?.set || ownDescriptor?.set;
    if (setter) {
      setter.call(element, value);
      return;
    }
    (element as HTMLInputElement | HTMLTextAreaElement).value = value;
  };

  const changeElementValue = (element: Element, value: string) => {
    setNativeValue(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const clickElement = (element: Element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  };

  const flushRafQueue = () => {
    const queue = rafQueue.slice();
    rafQueue = [];
    queue.forEach((entry) => {
      if (entry && typeof entry.cb === 'function') {
        entry.cb(0);
      }
    });
  };

  beforeAll(() => {
    previousActEnvironment = actGlobal.IS_REACT_ACT_ENVIRONMENT;
    actGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    rootMounted = true;
    mockUseWhisper.mockReset();
    mockUseWhisper.mockReturnValue(buildWhisperState());
    mockRequestAiRewrite.mockReset();
    mockRequestAiRewrite.mockResolvedValue('rewritten');
    (readThemeToken as jest.Mock).mockImplementation((_token: string, fallback: string) => fallback);
    (subscribeThemeChanges as jest.Mock).mockImplementation(() => jest.fn());
    rafQueue = [];
    rafId = 0;
    requestAnimationFrameSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafId += 1;
      rafQueue.push({ id: rafId, cb });
      return rafId;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafQueue = rafQueue.map((entry) => (entry && entry.id === id ? null : entry));
    });
  });

  afterEach(() => {
    if (rootMounted) {
      act(() => {
        root.unmount();
      });
      rootMounted = false;
    }
    container.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (typeof previousActEnvironment === 'undefined') {
      delete actGlobal.IS_REACT_ACT_ENVIRONMENT;
      return;
    }
    actGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it('shows a long-form timer while recording', () => {
    jest.useFakeTimers();
    mockUseWhisper.mockReturnValue(
      buildWhisperState({
        status: RECORDING_STATUS.RECORDING,
        isRecording: true,
      }),
    );

    act(() => {
      root.render(<AudioInput longFormMode updateFunction={jest.fn()} value="" placeholder="Speak" />);
    });

    expect(container.textContent).toContain('Recording');

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(container.textContent).toContain('2s');
  });

  it('auto-stops recording when a duration limit is reached', () => {
    jest.useFakeTimers();
    const stopRecording = jest.fn();
    mockUseWhisper.mockReturnValue(
      buildWhisperState({
        status: RECORDING_STATUS.RECORDING,
        isRecording: true,
        stopRecording,
      }),
    );

    act(() => {
      root.render(
        <AudioInput
          longFormMode
          recordingDurationSeconds={2}
          updateFunction={jest.fn()}
          value=""
          placeholder="Speak"
        />,
      );
    });

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(stopRecording).toHaveBeenCalledTimes(1);
  });

  it('surfaces a temporary notice instead of starting the disabled recorder', () => {
    const startRecording = jest.fn();
    mockUseWhisper.mockReturnValue(buildWhisperState({ startRecording }));

    act(() => {
      root.render(<AudioInput recordingDisabled updateFunction={jest.fn()} value="" placeholder="Speak" />);
    });

    const micButton = requireElement(container.querySelector('button[aria-label="Recording temporarily disabled"]'));

    act(() => {
      clickElement(micButton);
    });

    expect(startRecording).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Recording is temporarily disabled');
  });

  it('starts recording by default when the mic button is clicked', () => {
    const startRecording = jest.fn();
    mockUseWhisper.mockReturnValue(buildWhisperState({ startRecording }));

    act(() => {
      root.render(<AudioInput updateFunction={jest.fn()} value="" placeholder="Speak" />);
    });

    const micButton = requireElement(container.querySelector('button[aria-label="Start recording"]'));

    act(() => {
      clickElement(micButton);
    });

    expect(startRecording).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Recording is temporarily disabled');
  });

  it('hides the download dock by default even when text and audio exist', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    mockUseWhisper.mockReturnValue(
      buildWhisperState({
        lastRecordingBlobRef: { current: { blob, mimeType: 'audio/wav' } },
        getLastRecordingBlob: () => ({ blob, mimeType: 'audio/wav' }),
      }),
    );

    act(() => {
      root.render(<AudioInput updateFunction={jest.fn()} value="Hello world" placeholder="Speak" />);
    });

    const downloadToggle = container.querySelector('button[title="Downloads"]');
    expect(downloadToggle).toBeNull();
  });

  it('shows the download dock when downloads are enabled and text/audio exist', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    mockUseWhisper.mockReturnValue(
      buildWhisperState({
        lastRecordingBlobRef: { current: { blob, mimeType: 'audio/wav' } },
        getLastRecordingBlob: () => ({ blob, mimeType: 'audio/wav' }),
      }),
    );

    act(() => {
      root.render(
        <AudioInput enableDownloads={true} updateFunction={jest.fn()} value="Hello world" placeholder="Speak" />,
      );
    });

    expect(requireElement(container.querySelector('button[title="Downloads"]'))).not.toBeNull();
  });

  it('hides the download dock when downloads are disabled', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    mockUseWhisper.mockReturnValue(
      buildWhisperState({
        lastRecordingBlobRef: { current: { blob, mimeType: 'audio/wav' } },
        getLastRecordingBlob: () => ({ blob, mimeType: 'audio/wav' }),
      }),
    );

    act(() => {
      root.render(
        <AudioInput enableDownloads={false} updateFunction={jest.fn()} value="Hello world" placeholder="Speak" />,
      );
    });

    const downloadToggle = container.querySelector('button[title="Downloads"]');
    expect(downloadToggle).toBeNull();
  });

  it('hides audio download choice outside transcription recording mode', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    mockUseWhisper.mockReturnValue(
      buildWhisperState({
        lastRecordingBlobRef: { current: { blob, mimeType: 'audio/wav' } },
        getLastRecordingBlob: () => ({ blob, mimeType: 'audio/wav' }),
      }),
    );

    act(() => {
      root.render(
        <AudioInput enableDownloads={true} updateFunction={jest.fn()} value="Hello world" placeholder="Speak" />,
      );
    });

    const downloadToggle = requireElement(container.querySelector('button[title="Downloads"]'));
    act(() => {
      clickElement(downloadToggle);
    });

    expect(container.querySelector('button[aria-label="Download final transcript"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Download last recording audio"]')).toBeNull();
  });

  it('shows audio and transcript download choices in transcription recording mode', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    mockUseWhisper.mockReturnValue(
      buildWhisperState({
        lastRecordingBlobRef: { current: { blob, mimeType: 'audio/wav' } },
        getLastRecordingBlob: () => ({ blob, mimeType: 'audio/wav' }),
      }),
    );

    act(() => {
      root.render(
        <AudioInput
          longFormMode
          enableDownloads={true}
          updateFunction={jest.fn()}
          value="Hello world"
          placeholder="Speak"
        />,
      );
    });

    const downloadToggle = requireElement(container.querySelector('button[title="Downloads"]'));
    act(() => {
      clickElement(downloadToggle);
    });

    expect(container.querySelector('button[aria-label="Download final transcript"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Download last recording audio"]')).not.toBeNull();
  });

  it('retries waveform setup until audio refs are ready and then schedules animation', () => {
    jest.useFakeTimers({ doNotFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });

    const audioContextRef: MutableRef<AudioContextLike> = { current: null };
    const mediaStreamRef: MutableRef<MediaStreamLike> = { current: null };
    const analyser: AnalyserNodeLike = {
      fftSize: 0,
      frequencyBinCount: 32,
      getByteFrequencyData: jest.fn(),
      disconnect: jest.fn(),
    };
    const sourceNode: SourceNodeLike = {
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    const fakeAudioContext: AudioContextLike = {
      state: 'running',
      createAnalyser: jest.fn(() => analyser),
      createMediaStreamSource: jest.fn(() => sourceNode),
      resume: jest.fn(() => Promise.resolve()),
    };

    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          clearRect: jest.fn(),
          fillRect: jest.fn(),
          fillStyle: '#000',
        }) as unknown as CanvasRenderingContext2D,
    );

    mockUseWhisper.mockReturnValue(
      buildWhisperState({
        status: RECORDING_STATUS.RECORDING,
        isRecording: true,
        audioContextRef,
        mediaStreamRef,
      }),
    );

    act(() => {
      root.render(<AudioInput updateFunction={jest.fn()} value="" placeholder="Speak" />);
    });

    const rafCallsBeforeRefs = requestAnimationFrameSpy.mock.calls.length;
    expect(fakeAudioContext.createAnalyser).not.toHaveBeenCalled();

    audioContextRef.current = fakeAudioContext;
    mediaStreamRef.current = { id: 'stream' };

    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(fakeAudioContext.createAnalyser).toHaveBeenCalledTimes(1);
    expect(fakeAudioContext.createMediaStreamSource).toHaveBeenCalledTimes(1);
    expect(sourceNode.connect).toHaveBeenCalledWith(analyser);
    expect(requestAnimationFrameSpy.mock.calls.length).toBeGreaterThan(rafCallsBeforeRefs);
    expect(readThemeToken).toHaveBeenCalledWith('ce-control-face', 'Canvas');
    expect(readThemeToken).toHaveBeenCalledWith('ce-action-primary', 'Highlight');
    expect(subscribeThemeChanges).toHaveBeenCalled();
  });

  it('skips duplicate same-text parent updates', () => {
    const updateSpy = jest.fn();
    act(() => {
      root.render(<AudioInput updateFunction={updateSpy} value="" placeholder="Speak" />);
    });

    const textarea = requireElement(container.querySelector('textarea'));

    act(() => {
      changeElementValue(textarea, 'hello');
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenLastCalledWith('hello');

    act(() => {
      changeElementValue(textarea, 'hello');
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('emits same text again after parent-controlled reset', () => {
    const updateSpy = jest.fn();
    act(() => {
      root.render(<AudioInput updateFunction={updateSpy} value="" placeholder="Speak" />);
    });

    let textarea = requireElement(container.querySelector('textarea'));

    act(() => {
      changeElementValue(textarea, 'hello');
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenLastCalledWith('hello');

    // Simulate controlled parent sync then external reset (e.g. Start Fresh).
    act(() => {
      root.render(<AudioInput updateFunction={updateSpy} value="hello" placeholder="Speak" />);
    });
    act(() => {
      root.render(<AudioInput updateFunction={updateSpy} value="" placeholder="Speak" />);
    });

    textarea = requireElement(container.querySelector('textarea'));
    act(() => {
      changeElementValue(textarea, 'hello');
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenLastCalledWith('hello');
  });

  it('coalesces burst typing into a single parent update per frame', () => {
    const updateSpy = jest.fn();
    act(() => {
      root.render(<AudioInput updateFunction={updateSpy} value="" placeholder="Speak" />);
    });

    const textarea = requireElement(container.querySelector('textarea'));

    act(() => {
      changeElementValue(textarea, 'a');
      changeElementValue(textarea, 'ab');
      changeElementValue(textarea, 'abc');
    });
    expect(updateSpy).not.toHaveBeenCalled();

    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenLastCalledWith('abc');
  });

  it('keeps AI waiting text out of parent updates during rerenders', () => {
    mockRequestAiRewrite.mockImplementation(() => new Promise(() => {}));
    let waitingTick: (() => void) | null = null;
    const setIntervalMock: typeof window.setInterval = (handler: TimerHandler) => {
      if (typeof handler === 'function') {
        waitingTick = () => handler();
      }
      return 1;
    };
    const clearIntervalMock: typeof window.clearInterval = () => {};
    jest.spyOn(window, 'setInterval').mockImplementation(setIntervalMock);
    jest.spyOn(window, 'clearInterval').mockImplementation(clearIntervalMock);
    const updateFns = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];

    act(() => {
      root.render(<AudioInput updateFunction={updateFns[0]} value="Initial text" placeholder="Speak" />);
    });

    const textarea = requireElement(container.querySelector('textarea'));
    const rewriteButton = requireElement(container.querySelector('button[title="AI rewrite"]'));

    act(() => {
      clickElement(rewriteButton);
    });
    expect(updateFns[0]).toHaveBeenCalledTimes(0);
    const tick = waitingTick as (() => void) | null;
    expect(typeof tick).toBe('function');
    if (!tick) throw new Error('Expected waiting timer callback');

    act(() => {
      tick();
    });
    act(() => {
      flushRafQueue();
    });

    expect((textarea as HTMLTextAreaElement).value).toBe('Waiting for AI... 1s');
    expect(updateFns[0]).not.toHaveBeenCalled();

    act(() => {
      root.render(<AudioInput updateFunction={updateFns[1]} value="parent-live-1" placeholder="Speak" />);
      root.render(<AudioInput updateFunction={updateFns[2]} value="parent-live-2" placeholder="Speak" />);
      root.render(<AudioInput updateFunction={updateFns[3]} value="parent-live-3" placeholder="Speak" />);
    });
    act(() => {
      flushRafQueue();
    });

    expect(updateFns[1]).toHaveBeenCalledTimes(0);
    expect(updateFns[2]).toHaveBeenCalledTimes(0);
    expect(updateFns[3]).toHaveBeenCalledTimes(0);
    expect(updateFns.reduce((count, fn) => count + fn.mock.calls.length, 0)).toBe(0);
  });

  it('cancels queued parent updates on unmount', () => {
    const updateSpy = jest.fn();
    act(() => {
      root.render(<AudioInput updateFunction={updateSpy} value="" placeholder="Speak" />);
    });

    const textarea = requireElement(container.querySelector('textarea'));

    act(() => {
      changeElementValue(textarea, 'queued');
    });
    expect(updateSpy).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
      rootMounted = false;
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('emits rewritten text and reverted text through the parent update callback', async () => {
    mockRequestAiRewrite.mockResolvedValue('Polished version');
    const updateSpy = jest.fn();

    act(() => {
      root.render(<AudioInput updateFunction={updateSpy} value="Original version" placeholder="Speak" />);
    });

    const rewriteButton = requireElement(container.querySelector('button[title="AI rewrite"]'));

    await act(async () => {
      clickElement(rewriteButton);
      await Promise.resolve();
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenCalledWith('Polished version');

    const revertButton = requireElement(container.querySelector('button[title="Revert to original"]'));

    act(() => {
      clickElement(revertButton);
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenLastCalledWith('Original version');
  });

  it('restores current text when the first AI rewrite fails', async () => {
    mockRequestAiRewrite.mockRejectedValueOnce(new Error('rewrite failed'));
    const updateSpy = jest.fn();

    act(() => {
      root.render(<AudioInput updateFunction={updateSpy} value="" placeholder="Speak" />);
    });

    const textarea = requireElement(container.querySelector('textarea'));
    act(() => {
      changeElementValue(textarea, 'Current draft');
    });

    const rewriteButton = requireElement(container.querySelector('button[title="AI rewrite"]'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      clickElement(rewriteButton);
      await Promise.resolve();
    });
    act(() => {
      flushRafQueue();
    });

    expect(mockRequestAiRewrite).toHaveBeenCalledWith('Current draft', expect.any(Object));
    expect(consoleErrorSpy).toHaveBeenCalledWith('[surveys]', '[AudioInput] AI rewrite error:', expect.any(Error));
    expect((textarea as HTMLTextAreaElement).value).toBe('Current draft');
    expect(updateSpy).toHaveBeenLastCalledWith('Current draft');
  });

  it('does not restore an older original after a later AI rewrite fails', async () => {
    mockRequestAiRewrite
      .mockResolvedValueOnce('First rewrite')
      .mockRejectedValueOnce(new Error('later rewrite failed'));
    const updateSpy = jest.fn();

    act(() => {
      root.render(<AudioInput updateFunction={updateSpy} value="First original" placeholder="Speak" />);
    });

    const textarea = requireElement(container.querySelector('textarea'));
    const rewriteButton = requireElement(container.querySelector('button[title="AI rewrite"]'));

    await act(async () => {
      clickElement(rewriteButton);
      await Promise.resolve();
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenLastCalledWith('First rewrite');

    const revertButton = requireElement(container.querySelector('button[title="Revert to original"]'));
    act(() => {
      clickElement(revertButton);
    });
    act(() => {
      flushRafQueue();
    });

    act(() => {
      changeElementValue(textarea, 'Second current draft');
    });

    const nextRewriteButton = requireElement(container.querySelector('button[title="AI rewrite"]'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      clickElement(nextRewriteButton);
      await Promise.resolve();
    });
    act(() => {
      flushRafQueue();
    });

    expect(mockRequestAiRewrite).toHaveBeenLastCalledWith('Second current draft', expect.any(Object));
    expect(consoleErrorSpy).toHaveBeenCalledWith('[surveys]', '[AudioInput] AI rewrite error:', expect.any(Error));
    expect((textarea as HTMLTextAreaElement).value).toBe('Second current draft');
    expect(updateSpy).toHaveBeenLastCalledWith('Second current draft');
    expect(updateSpy).not.toHaveBeenLastCalledWith('First original');
  });
});
