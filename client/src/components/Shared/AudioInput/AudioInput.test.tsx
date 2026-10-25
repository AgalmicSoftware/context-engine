import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { fireEvent, screen } from '@testing-library/react';

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
  cancelRecording: () => void;
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
const mockReadThemeToken = readThemeToken as jest.MockedFunction<typeof readThemeToken>;
const mockSubscribeThemeChanges = subscribeThemeChanges as jest.MockedFunction<typeof subscribeThemeChanges>;
const actGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

jest.mock('../../../utilities/ai/aiClient', () => {
  const actual = jest.requireActual('../../../utilities/ai/aiClient');
  return {
    ...actual,
    requestAiRewrite: jest.fn(),
  };
});

jest.mock('../../../utilities/useWhisper', () => {
  const actual = jest.requireActual('../../../utilities/useWhisper');
  return { ...actual, useWhisper: jest.fn() };
});

jest.mock('../../../utilities/ui/themeRuntime', () => ({
  readThemeToken: jest.fn((...args: unknown[]) => (typeof args[1] === 'string' ? args[1] : '')),
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
  cancelRecording: jest.fn(),
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
    mockReadThemeToken.mockImplementation((_token, fallback = '') => fallback);
    mockSubscribeThemeChanges.mockImplementation(() => jest.fn());
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

    const micButton = requireElement(
      container.querySelector<HTMLButtonElement>('button[aria-label="Start recording"]'),
    );

    act(() => {
      clickElement(micButton);
    });

    expect(startRecording).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Recording is temporarily disabled');
  });

  it('explains microphone and AI rewrite controls on hover and keyboard focus', async () => {
    act(() => {
      root.render(<AudioInput value="Draft comments" updateFunction={jest.fn()} hideEncryption />);
    });
    const rewrite = requireElement(container.querySelector('button[aria-label="AI rewrite"]'));
    fireEvent.mouseOver(rewrite);
    expect(
      await screen.findByText('AI rewrite: remove filler words and improve punctuation. You can revert the result.'),
    ).toBeInTheDocument();
    fireEvent.mouseOut(rewrite);
    act(() => {
      requireElement(container.querySelector<HTMLButtonElement>('button[aria-label="Start recording"]')).focus();
    });
    expect(await screen.findByText('Record speech and add its transcript to this text.')).toBeInTheDocument();
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

  it('publishes typed edits before the next frame', () => {
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
    expect(updateSpy).toHaveBeenLastCalledWith('abc');
    act(() => flushRafQueue());
    expect(updateSpy).toHaveBeenCalledTimes(3);
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

  it('does not repeat a delivered edit after unmount', () => {
    const updateSpy = jest.fn();
    act(() => {
      root.render(<AudioInput updateFunction={updateSpy} value="" placeholder="Speak" />);
    });

    const textarea = requireElement(container.querySelector('textarea'));

    act(() => {
      changeElementValue(textarea, 'queued');
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
      rootMounted = false;
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('exposes record, rewrite and revert controls through stable test IDs', async () => {
    mockRequestAiRewrite.mockResolvedValue('Polished version');

    act(() => {
      root.render(<AudioInput updateFunction={jest.fn()} value="Original version" placeholder="Speak" />);
    });

    expect(requireElement(container.querySelector('[data-testid="ce-audio-input-record"]'))).toHaveAttribute(
      'aria-label',
      'Start recording',
    );
    await act(async () => {
      clickElement(requireElement(container.querySelector('[data-testid="ce-audio-input-ai-rewrite"]')));
      await Promise.resolve();
    });
    act(() => {
      flushRafQueue();
    });
    expect(container.querySelector('[data-testid="ce-audio-input-ai-rewrite"]')).toBeNull();
    expect(requireElement(container.querySelector('[data-testid="ce-audio-input-ai-revert"]'))).toHaveAttribute(
      'aria-label',
      'Revert to original',
    );
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

  it('disables rewrite and revert controls while the editor is disabled', async () => {
    const update = jest.fn();
    act(() => root.render(<AudioInput value="Original" updateFunction={update} disabled />));
    const rewrite = screen.getByRole('button', { name: 'AI rewrite' }) as HTMLButtonElement;
    expect(rewrite.disabled).toBe(true);
    act(() => clickElement(rewrite));
    expect(mockRequestAiRewrite).not.toHaveBeenCalled();
    act(() => root.render(<AudioInput value="Original" updateFunction={update} />));
    await act(async () => {
      clickElement(screen.getByRole('button', { name: 'AI rewrite' }));
    });
    act(() => flushRafQueue());
    update.mockClear();
    act(() => root.render(<AudioInput value="Original" updateFunction={update} disabled />));
    const revert = screen.getByRole('button', { name: 'Revert to original' }) as HTMLButtonElement;
    expect(revert.disabled).toBe(true);
    act(() => {
      clickElement(revert);
      flushRafQueue();
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('starts only one rewrite when clicked twice before a render', () => {
    mockRequestAiRewrite.mockReturnValue(new Promise(() => {}));
    act(() => root.render(<AudioInput value="Original" />));
    const rewrite = screen.getByRole('button', { name: 'AI rewrite' });
    act(() => {
      clickElement(rewrite);
      clickElement(rewrite);
    });
    expect(mockRequestAiRewrite).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['value', { value: 'Different answer' }],
    ['slug', { sessionSlug: 'new-session' }],
    ['Worker URL', { workerUrl: 'https://new.worker.test' }],
    ['session ID', { sessionConfig: { sessionId: 'new-session-id' } }],
    ['configured Worker', { sessionConfig: { corsWorkerUrl: 'https://new.worker.test' } }],
    ['account', { context: { account: '0x222' } }],
    ['question', { dataCeQuestionId: 'new-question' }],
  ] as const)('rejects pending rewrite success after the %s changes', async (_label, changes) => {
    let finish!: (text: string) => void;
    mockRequestAiRewrite.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const oldUpdate = jest.fn();
    const newUpdate = jest.fn();
    const props = {
      value: 'Original',
      sessionSlug: 'old-session',
      workerUrl: 'https://old.worker.test',
      sessionConfig: { sessionId: 'old-session-id', corsWorkerUrl: 'https://old.worker.test' },
      context: { account: '0x111' },
      dataCeQuestionId: 'old-question',
    };
    act(() => root.render(<AudioInput {...props} updateFunction={oldUpdate} />));
    act(() => clickElement(screen.getByRole('button', { name: 'AI rewrite' })));
    act(() => root.render(<AudioInput {...props} {...changes} updateFunction={newUpdate} />));
    await act(async () => {
      finish('Obsolete rewrite');
    });
    act(() => flushRafQueue());
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'value' in changes ? changes.value : 'Original',
    );
    expect(oldUpdate).not.toHaveBeenCalled();
    expect(newUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Revert to original' })).toBeNull();
  });

  it('does not restore an obsolete draft when a pending rewrite fails after a value reset', async () => {
    let fail!: (error: Error) => void;
    mockRequestAiRewrite.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const update = jest.fn();
    act(() => root.render(<AudioInput value="Original" updateFunction={update} />));
    act(() => clickElement(screen.getByRole('button', { name: 'AI rewrite' })));
    act(() => root.render(<AudioInput value="Reset answer" updateFunction={update} />));
    await act(async () => {
      fail(new Error('late failure'));
    });
    act(() => flushRafQueue());
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Reset answer');
    expect(update).not.toHaveBeenCalled();
  });

  it('invalidates a pending rewrite when disabled and permits a fresh rewrite after enabling', async () => {
    let finish!: (text: string) => void;
    mockRequestAiRewrite.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const update = jest.fn();
    act(() => root.render(<AudioInput value="Original" updateFunction={update} />));
    act(() => clickElement(screen.getByRole('button', { name: 'AI rewrite' })));
    act(() => root.render(<AudioInput value="Original" updateFunction={update} disabled />));
    await act(async () => {
      finish('Obsolete rewrite');
    });
    act(() => flushRafQueue());
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Original');
    expect(update).not.toHaveBeenCalled();
    act(() => root.render(<AudioInput value="Original" updateFunction={update} />));
    await act(async () => {
      clickElement(screen.getByRole('button', { name: 'AI rewrite' }));
    });
    act(() => flushRafQueue());
    expect(update).toHaveBeenCalledWith('rewritten');
  });

  it('clears rewrite undo after an external value reset', async () => {
    const update = jest.fn();
    act(() => root.render(<AudioInput value="Original" updateFunction={update} />));
    await act(async () => {
      clickElement(screen.getByRole('button', { name: 'AI rewrite' }));
    });
    act(() => flushRafQueue());
    act(() => root.render(<AudioInput value="Reset answer" updateFunction={update} />));
    expect(screen.queryByRole('button', { name: 'Revert to original' })).toBeNull();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Reset answer');
  });

  it('delivers a completed rewrite to its source before a later source change clears undo', async () => {
    const oldUpdate = jest.fn();
    const newUpdate = jest.fn();
    act(() => root.render(<AudioInput value="Original" sessionSlug="old" updateFunction={oldUpdate} />));
    await act(async () => {
      clickElement(screen.getByRole('button', { name: 'AI rewrite' }));
    });
    act(() => root.render(<AudioInput value="Original" sessionSlug="new" updateFunction={newUpdate} />));
    act(() => flushRafQueue());
    expect(oldUpdate).toHaveBeenCalledWith('rewritten');
    expect(newUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Revert to original' })).toBeNull();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Original');
  });

  it('keeps rewrite and undo across equivalent source objects, callback changes, and controlled echoes', async () => {
    let finish!: (text: string) => void;
    mockRequestAiRewrite.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const oldUpdate = jest.fn();
    const newUpdate = jest.fn();
    const source = () => ({
      sessionSlug: 'same',
      sessionConfig: { sessionId: 'same-id' },
      context: { account: '0x111' },
    });
    act(() => root.render(<AudioInput {...source()} value="Original" updateFunction={oldUpdate} />));
    act(() => clickElement(screen.getByRole('button', { name: 'AI rewrite' })));
    act(() => root.render(<AudioInput {...source()} value="Original" updateFunction={newUpdate} />));
    await act(async () => {
      finish('Polished');
    });
    act(() => flushRafQueue());
    expect(oldUpdate).not.toHaveBeenCalled();
    expect(newUpdate).toHaveBeenLastCalledWith('Polished');
    act(() => root.render(<AudioInput {...source()} value="Polished" updateFunction={newUpdate} />));
    act(() => {
      clickElement(screen.getByRole('button', { name: 'Revert to original' }));
      flushRafQueue();
    });
    expect(newUpdate).toHaveBeenLastCalledWith('Original');
  });

  it.each([
    ['value', { value: 'Replacement answer' }],
    ['source', { workerUrl: 'https://replacement.worker.test' }],
    ['disabled', { disabled: true }],
  ] as const)('discards old dictation and cancels recording when the %s changes', (_label, changes) => {
    const update = jest.fn();
    const whisper = buildWhisperState();
    mockUseWhisper.mockReturnValue(whisper);
    const props = { value: 'Original', workerUrl: 'https://original.worker.test', updateFunction: update };
    act(() => root.render(<AudioInput {...props} />));
    const oldCallbacks = mockUseWhisper.mock.calls.at(-1)?.[0] as { onTranscriptionComplete: (text: string) => void };
    act(() => clickElement(screen.getByRole('button', { name: 'Start recording' })));
    expect(whisper.startRecording).toHaveBeenCalledTimes(1);
    act(() => root.render(<AudioInput {...props} {...changes} />));
    act(() => {
      oldCallbacks.onTranscriptionComplete('Obsolete dictation');
      flushRafQueue();
    });
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'value' in changes ? changes.value : 'Original',
    );
    expect(update).not.toHaveBeenCalled();
    expect(whisper.cancelRecording).toHaveBeenCalledTimes(1);
  });

  it('does not revive old dictation after switching away and back to the same source', () => {
    const update = jest.fn();
    act(() => root.render(<AudioInput value="Original" sessionSlug="a" updateFunction={update} />));
    const oldCallbacks = mockUseWhisper.mock.calls.at(-1)?.[0] as { onTranscriptionComplete: (text: string) => void };
    act(() => root.render(<AudioInput value="Original" sessionSlug="b" updateFunction={update} />));
    act(() => root.render(<AudioInput value="Original" sessionSlug="a" updateFunction={update} />));
    act(() => {
      oldCallbacks.onTranscriptionComplete('Obsolete dictation');
      flushRafQueue();
    });
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Original');
    expect(update).not.toHaveBeenCalled();
  });

  it('appends current dictation after a controlled echo of the user’s own edit', () => {
    const update = jest.fn();
    act(() => root.render(<AudioInput value="Original" updateFunction={update} />));
    const callbacks = mockUseWhisper.mock.calls.at(-1)?.[0] as { onTranscriptionComplete: (text: string) => void };
    act(() => {
      changeElementValue(screen.getByRole('textbox'), 'Typed draft');
      flushRafQueue();
    });
    act(() => root.render(<AudioInput value="Typed draft" updateFunction={update} />));
    act(() => {
      callbacks.onTranscriptionComplete('Current dictation');
      flushRafQueue();
    });
    expect(update).toHaveBeenLastCalledWith('Typed draft Current dictation');
  });

  it.each([
    { status: RECORDING_STATUS.REQUESTING_PERMISSION },
    { isRecording: true },
    { isPaused: true },
    { isProcessing: true },
    { isStreaming: true },
  ])('prevents rewrite during dictation activity %j', (activity) => {
    mockUseWhisper.mockReturnValue(buildWhisperState(activity));
    act(() => root.render(<AudioInput value="Original" />));
    const rewrite = screen.getByRole('button', { name: 'AI rewrite' }) as HTMLButtonElement;
    expect(rewrite.disabled).toBe(true);
    act(() => clickElement(rewrite));
    expect(mockRequestAiRewrite).not.toHaveBeenCalled();
  });

  it('guards rewrite immediately after requesting the microphone before a render', () => {
    act(() => root.render(<AudioInput value="Original" />));
    const rewrite = screen.getByRole('button', { name: 'AI rewrite' });
    act(() => {
      clickElement(screen.getByRole('button', { name: 'Start recording' }));
      clickElement(rewrite);
    });
    expect(mockRequestAiRewrite).not.toHaveBeenCalled();
  });

  it('releases the microphone-start guard when its field is replaced', async () => {
    mockUseWhisper.mockReturnValue(buildWhisperState({ startRecording: jest.fn(() => new Promise(() => {})) }));
    act(() => root.render(<AudioInput value="Original" sessionSlug="a" />));
    act(() => clickElement(screen.getByRole('button', { name: 'Start recording' })));
    act(() => root.render(<AudioInput value="Replacement" sessionSlug="b" />));
    await act(async () => clickElement(screen.getByRole('button', { name: 'AI rewrite' })));
    expect(mockRequestAiRewrite).toHaveBeenCalledWith('Replacement', expect.objectContaining({ sessionSlug: 'b' }));
  });

  it('does not let an old microphone request clear a newer startup guard', async () => {
    let finishFirst: () => void;
    const startRecording = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockImplementationOnce(() => new Promise(() => {}));
    mockUseWhisper.mockReturnValue(buildWhisperState({ startRecording }));
    act(() => root.render(<AudioInput value="Original" sessionSlug="a" />));
    act(() => clickElement(screen.getByRole('button', { name: 'Start recording' })));
    act(() => root.render(<AudioInput value="Replacement" sessionSlug="b" />));
    act(() => clickElement(screen.getByRole('button', { name: 'Start recording' })));
    await act(async () => finishFirst());
    act(() => clickElement(screen.getByRole('button', { name: 'AI rewrite' })));
    expect(mockRequestAiRewrite).not.toHaveBeenCalled();
  });

  it('ignores another record click while microphone startup is pending', async () => {
    const startRecording = jest
      .fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValue(undefined);
    mockUseWhisper.mockReturnValue(buildWhisperState({ startRecording }));
    act(() => root.render(<AudioInput value="Original" />));
    await act(async () => {
      clickElement(screen.getByRole('button', { name: 'Start recording' }));
      clickElement(screen.getByRole('button', { name: 'Start recording' }));
    });
    act(() => clickElement(screen.getByRole('button', { name: 'AI rewrite' })));
    expect(startRecording).toHaveBeenCalledTimes(1);
    expect(mockRequestAiRewrite).not.toHaveBeenCalled();
  });

  it.each(['rewrite', 'dictation', 'typing'] as const)(
    'submits the completed %s before an animation frame',
    async (kind) => {
      const submit = jest.fn();
      const Form = () => {
        const [answer, setAnswer] = React.useState('Original');
        const [disabled, setDisabled] = React.useState(false);
        return (
          <>
            <AudioInput value={answer} updateFunction={setAnswer} disabled={disabled} />
            <button
              onClick={() => {
                submit(answer);
                setDisabled(true);
              }}
            >
              Submit
            </button>
          </>
        );
      };
      act(() => root.render(<Form />));
      if (kind === 'rewrite') {
        await act(async () => clickElement(screen.getByRole('button', { name: 'AI rewrite' })));
      } else if (kind === 'typing') {
        act(() => changeElementValue(screen.getByRole('textbox'), 'Typed'));
      } else {
        const callbacks = mockUseWhisper.mock.calls.at(-1)?.[0] as { onTranscriptionComplete: (text: string) => void };
        act(() => callbacks.onTranscriptionComplete('dictated'));
      }
      act(() => clickElement(screen.getByRole('button', { name: 'Submit' })));
      expect(submit).toHaveBeenCalledWith(
        kind === 'rewrite' ? 'rewritten' : kind === 'typing' ? 'Typed' : 'Original dictated',
      );
      act(() => flushRafQueue());
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(submit.mock.calls[0][0]);
    },
  );

  it('preserves a completed typed update when the same input becomes disabled', () => {
    const update = jest.fn();
    act(() => root.render(<AudioInput value="Original" updateFunction={update} />));
    act(() => changeElementValue(screen.getByRole('textbox'), 'Typed'));
    act(() => root.render(<AudioInput value="Original" updateFunction={update} disabled />));
    act(() => flushRafQueue());
    expect(update).toHaveBeenLastCalledWith('Typed');
  });
});
