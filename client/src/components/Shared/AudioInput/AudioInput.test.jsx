import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';

import AudioInput from './AudioInput';
import { requestAiRewrite } from '../../../utilities/ai/aiScripts';
import { useWhisper, RECORDING_STATUS } from '../../../utilities/useWhisper';

jest.mock('../../../utilities/ai/aiScripts', () => {
  const actual = jest.requireActual('../../../utilities/ai/aiScripts');
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

const buildWhisperState = (overrides = {}) => ({
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
  let container;
  let rafQueue = [];
  let rafId = 0;

  const flushRafQueue = () => {
    const queue = rafQueue.slice();
    rafQueue = [];
    queue.forEach((entry) => {
      if (entry && typeof entry.cb === 'function') {
        entry.cb();
      }
    });
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    useWhisper.mockReset();
    useWhisper.mockReturnValue(buildWhisperState());
    requestAiRewrite.mockReset();
    requestAiRewrite.mockResolvedValue('rewritten');
    rafQueue = [];
    rafId = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafId += 1;
      rafQueue.push({ id: rafId, cb });
      return rafId;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafQueue = rafQueue.map((entry) => (entry && entry.id === id ? null : entry));
    });
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
    container = null;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows a long-form timer while recording', () => {
    jest.useFakeTimers();
    useWhisper.mockReturnValue(buildWhisperState({
      status: RECORDING_STATUS.RECORDING,
      isRecording: true,
    }));

    act(() => {
      ReactDOM.render(
        <AudioInput
          longFormMode
          updateFunction={jest.fn()}
          value=""
          placeholder="Speak"
        />,
        container
      );
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
    useWhisper.mockReturnValue(buildWhisperState({
      status: RECORDING_STATUS.RECORDING,
      isRecording: true,
      stopRecording,
    }));

    act(() => {
      ReactDOM.render(
        <AudioInput
          longFormMode
          recordingDurationSeconds={2}
          updateFunction={jest.fn()}
          value=""
          placeholder="Speak"
        />,
        container
      );
    });

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(stopRecording).toHaveBeenCalledTimes(1);
  });

  it('surfaces a temporary notice instead of starting the disabled recorder', () => {
    const startRecording = jest.fn();
    useWhisper.mockReturnValue(buildWhisperState({ startRecording }));

    act(() => {
      ReactDOM.render(
        <AudioInput
          recordingDisabled
          updateFunction={jest.fn()}
          value=""
          placeholder="Speak"
        />,
        container
      );
    });

    const micButton = container.querySelector('button[aria-label="Recording temporarily disabled"]');
    expect(micButton).not.toBeNull();

    act(() => {
      Simulate.click(micButton);
    });

    expect(startRecording).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Recording is temporarily disabled');
  });

  it('starts recording by default when the mic button is clicked', () => {
    const startRecording = jest.fn();
    useWhisper.mockReturnValue(buildWhisperState({ startRecording }));

    act(() => {
      ReactDOM.render(
        <AudioInput
          updateFunction={jest.fn()}
          value=""
          placeholder="Speak"
        />,
        container
      );
    });

    const micButton = container.querySelector('button[aria-label="Start recording"]');
    expect(micButton).not.toBeNull();

    act(() => {
      Simulate.click(micButton);
    });

    expect(startRecording).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Recording is temporarily disabled');
  });

  it('hides the download dock by default even when text and audio exist', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    useWhisper.mockReturnValue(buildWhisperState({
      lastRecordingBlobRef: { current: { blob, mimeType: 'audio/wav' } },
      getLastRecordingBlob: () => ({ blob, mimeType: 'audio/wav' }),
    }));

    act(() => {
      ReactDOM.render(
        <AudioInput
          updateFunction={jest.fn()}
          value="Hello world"
          placeholder="Speak"
        />,
        container
      );
    });

    const downloadToggle = container.querySelector('button[title="Downloads"]');
    expect(downloadToggle).toBeNull();
  });

  it('shows the download dock when downloads are enabled and text/audio exist', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    useWhisper.mockReturnValue(buildWhisperState({
      lastRecordingBlobRef: { current: { blob, mimeType: 'audio/wav' } },
      getLastRecordingBlob: () => ({ blob, mimeType: 'audio/wav' }),
    }));

    act(() => {
      ReactDOM.render(
        <AudioInput
          enableDownloads={true}
          updateFunction={jest.fn()}
          value="Hello world"
          placeholder="Speak"
        />,
        container
      );
    });

    const downloadToggle = container.querySelector('button[title="Downloads"]');
    expect(downloadToggle).not.toBeNull();
  });

  it('hides the download dock when downloads are disabled', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    useWhisper.mockReturnValue(buildWhisperState({
      lastRecordingBlobRef: { current: { blob, mimeType: 'audio/wav' } },
      getLastRecordingBlob: () => ({ blob, mimeType: 'audio/wav' }),
    }));

    act(() => {
      ReactDOM.render(
        <AudioInput
          enableDownloads={false}
          updateFunction={jest.fn()}
          value="Hello world"
          placeholder="Speak"
        />,
        container
      );
    });

    const downloadToggle = container.querySelector('button[title="Downloads"]');
    expect(downloadToggle).toBeNull();
  });

  it('hides audio download choice outside transcription recording mode', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    useWhisper.mockReturnValue(buildWhisperState({
      lastRecordingBlobRef: { current: { blob, mimeType: 'audio/wav' } },
      getLastRecordingBlob: () => ({ blob, mimeType: 'audio/wav' }),
    }));

    act(() => {
      ReactDOM.render(
        <AudioInput
          enableDownloads={true}
          updateFunction={jest.fn()}
          value="Hello world"
          placeholder="Speak"
        />,
        container
      );
    });

    const downloadToggle = container.querySelector('button[title="Downloads"]');
    expect(downloadToggle).not.toBeNull();
    act(() => {
      Simulate.click(downloadToggle);
    });

    expect(container.querySelector('button[aria-label="Download final transcript"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Download last recording audio"]')).toBeNull();
  });

  it('shows audio and transcript download choices in transcription recording mode', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    useWhisper.mockReturnValue(buildWhisperState({
      lastRecordingBlobRef: { current: { blob, mimeType: 'audio/wav' } },
      getLastRecordingBlob: () => ({ blob, mimeType: 'audio/wav' }),
    }));

    act(() => {
      ReactDOM.render(
        <AudioInput
          longFormMode
          enableDownloads={true}
          updateFunction={jest.fn()}
          value="Hello world"
          placeholder="Speak"
        />,
        container
      );
    });

    const downloadToggle = container.querySelector('button[title="Downloads"]');
    expect(downloadToggle).not.toBeNull();
    act(() => {
      Simulate.click(downloadToggle);
    });

    expect(container.querySelector('button[aria-label="Download final transcript"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Download last recording audio"]')).not.toBeNull();
  });

  it('retries waveform setup until audio refs are ready and then schedules animation', () => {
    jest.useFakeTimers();

    const audioContextRef = { current: null };
    const mediaStreamRef = { current: null };
    const analyser = {
      fftSize: 0,
      frequencyBinCount: 32,
      getByteFrequencyData: jest.fn(),
      disconnect: jest.fn(),
    };
    const sourceNode = {
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    const fakeAudioContext = {
      state: 'running',
      createAnalyser: jest.fn(() => analyser),
      createMediaStreamSource: jest.fn(() => sourceNode),
      resume: jest.fn(() => Promise.resolve()),
    };

    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      fillStyle: '#000',
    }));

    useWhisper.mockReturnValue(buildWhisperState({
      status: RECORDING_STATUS.RECORDING,
      isRecording: true,
      audioContextRef,
      mediaStreamRef,
    }));

    act(() => {
      ReactDOM.render(
        <AudioInput
          updateFunction={jest.fn()}
          value=""
          placeholder="Speak"
        />,
        container
      );
    });

    const rafCallsBeforeRefs = window.requestAnimationFrame.mock.calls.length;
    expect(fakeAudioContext.createAnalyser).not.toHaveBeenCalled();

    audioContextRef.current = fakeAudioContext;
    mediaStreamRef.current = { id: 'stream' };

    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(fakeAudioContext.createAnalyser).toHaveBeenCalledTimes(1);
    expect(fakeAudioContext.createMediaStreamSource).toHaveBeenCalledTimes(1);
    expect(sourceNode.connect).toHaveBeenCalledWith(analyser);
    expect(window.requestAnimationFrame.mock.calls.length).toBeGreaterThan(rafCallsBeforeRefs);
  });

  it('skips duplicate same-text parent updates', () => {
    const updateSpy = jest.fn();
    act(() => {
      ReactDOM.render(
        <AudioInput
          updateFunction={updateSpy}
          value=""
          placeholder="Speak"
        />,
        container
      );
    });

    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();

    act(() => {
      Simulate.change(textarea, { target: { value: 'hello' } });
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenLastCalledWith('hello');

    act(() => {
      Simulate.change(textarea, { target: { value: 'hello' } });
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('emits same text again after parent-controlled reset', () => {
    const updateSpy = jest.fn();
    act(() => {
      ReactDOM.render(
        <AudioInput
          updateFunction={updateSpy}
          value=""
          placeholder="Speak"
        />,
        container
      );
    });

    let textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();

    act(() => {
      Simulate.change(textarea, { target: { value: 'hello' } });
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenLastCalledWith('hello');

    // Simulate controlled parent sync then external reset (e.g. Start Fresh).
    act(() => {
      ReactDOM.render(
        <AudioInput
          updateFunction={updateSpy}
          value="hello"
          placeholder="Speak"
        />,
        container
      );
    });
    act(() => {
      ReactDOM.render(
        <AudioInput
          updateFunction={updateSpy}
          value=""
          placeholder="Speak"
        />,
        container
      );
    });

    textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    act(() => {
      Simulate.change(textarea, { target: { value: 'hello' } });
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
      ReactDOM.render(
        <AudioInput
          updateFunction={updateSpy}
          value=""
          placeholder="Speak"
        />,
        container
      );
    });

    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();

    act(() => {
      Simulate.change(textarea, { target: { value: 'a' } });
      Simulate.change(textarea, { target: { value: 'ab' } });
      Simulate.change(textarea, { target: { value: 'abc' } });
    });
    expect(updateSpy).not.toHaveBeenCalled();

    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenLastCalledWith('abc');
  });

  it('does not re-emit waiting text during parent rerenders with new update callbacks', () => {
    requestAiRewrite.mockImplementation(() => new Promise(() => {}));
    let waitingTick = null;
    jest.spyOn(window, 'setInterval').mockImplementation((cb) => {
      waitingTick = cb;
      return 1;
    });
    jest.spyOn(window, 'clearInterval').mockImplementation(() => {});
    const updateFns = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];

    act(() => {
      ReactDOM.render(
        <AudioInput
          updateFunction={updateFns[0]}
          value="Initial text"
          placeholder="Speak"
        />,
        container
      );
    });

    const rewriteButton = container.querySelector('button[title="AI rewrite"]');
    expect(rewriteButton).not.toBeNull();

    act(() => {
      Simulate.click(rewriteButton);
    });
    expect(updateFns[0]).toHaveBeenCalledTimes(0);
    expect(typeof waitingTick).toBe('function');

    act(() => {
      waitingTick();
    });
    act(() => {
      flushRafQueue();
    });

    expect(updateFns[0]).toHaveBeenCalledTimes(1);
    expect(updateFns[0]).toHaveBeenLastCalledWith('Waiting for AI... 1s');

    act(() => {
      ReactDOM.render(
        <AudioInput
          updateFunction={updateFns[1]}
          value="parent-live-1"
          placeholder="Speak"
        />,
        container
      );
      ReactDOM.render(
        <AudioInput
          updateFunction={updateFns[2]}
          value="parent-live-2"
          placeholder="Speak"
        />,
        container
      );
      ReactDOM.render(
        <AudioInput
          updateFunction={updateFns[3]}
          value="parent-live-3"
          placeholder="Speak"
        />,
        container
      );
    });
    act(() => {
      flushRafQueue();
    });

    expect(updateFns[1]).toHaveBeenCalledTimes(0);
    expect(updateFns[2]).toHaveBeenCalledTimes(0);
    expect(updateFns[3]).toHaveBeenCalledTimes(0);
    expect(updateFns.reduce((count, fn) => count + fn.mock.calls.length, 0)).toBe(1);
  });

  it('cancels queued parent updates on unmount', () => {
    const updateSpy = jest.fn();
    act(() => {
      ReactDOM.render(
        <AudioInput
          updateFunction={updateSpy}
          value=""
          placeholder="Speak"
        />,
        container
      );
    });

    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();

    act(() => {
      Simulate.change(textarea, { target: { value: 'queued' } });
    });
    expect(updateSpy).not.toHaveBeenCalled();

    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('emits rewritten text and reverted text through the parent update callback', async () => {
    requestAiRewrite.mockResolvedValue('Polished version');
    const updateSpy = jest.fn();

    act(() => {
      ReactDOM.render(
        <AudioInput
          updateFunction={updateSpy}
          value="Original version"
          placeholder="Speak"
        />,
        container
      );
    });

    const rewriteButton = container.querySelector('button[title="AI rewrite"]');
    expect(rewriteButton).not.toBeNull();

    await act(async () => {
      Simulate.click(rewriteButton);
      await Promise.resolve();
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenCalledWith('Polished version');

    const revertButton = container.querySelector('button[title="Revert to original"]');
    expect(revertButton).not.toBeNull();

    act(() => {
      Simulate.click(revertButton);
    });
    act(() => {
      flushRafQueue();
    });
    expect(updateSpy).toHaveBeenLastCalledWith('Original version');
  });
});
