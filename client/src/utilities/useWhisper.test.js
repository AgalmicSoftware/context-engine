import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

jest.mock('recordrtc', () => {
  let nextBlob = null;

  class MockRecordRTC {
    constructor(stream, options = {}) {
      this.options = options;
      this.state = 'recording';
      this._blob =
        nextBlob ||
        new Blob([new Uint8Array(256)], { type: 'audio/wav' });
    }

    startRecording() {
      this.state = 'recording';
    }

    stopRecording(cb) {
      this.state = 'stopped';
      if (typeof cb === 'function') cb();
    }

    pauseRecording() {
      this.state = 'paused';
    }

    resumeRecording() {
      this.state = 'recording';
    }

    getBlob() {
      return this._blob;
    }

    destroy() {
      this.state = 'destroyed';
    }
  }

  MockRecordRTC.__setBlob = (blob) => {
    nextBlob = blob;
  };
  MockRecordRTC.StereoAudioRecorder = function StereoAudioRecorder() {};
  return MockRecordRTC;
});

jest.mock('hark', () =>
  jest.fn(() => ({
    on: jest.fn(),
    stop: jest.fn(),
  }))
);

jest.mock('./ai/aiSettings.js', () => ({
  getEffectiveTranscriptionConfig: jest.fn(),
}));

jest.mock('./worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(),
}));

jest.mock('./worker/workerAuth.js', () => ({
  fetchWorkerWithAuth: jest.fn(),
}));

jest.mock('./useWhisper.js', () => jest.requireActual('./useWhisper.js'));

import RecordRTC from 'recordrtc';
import { getEffectiveTranscriptionConfig } from './ai/aiSettings.js';
import { getCorsProxyUrlOrThrow } from './worker/corsProxy.js';
import { fetchWorkerWithAuth } from './worker/workerAuth.js';
import { useWhisper, RECORDING_STATUS } from './useWhisper';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const WhisperHarness = React.forwardRef(({ options }, ref) => {
  const hook = useWhisper(options);
  React.useImperativeHandle(ref, () => hook, [hook]);
  return null;
});

class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
  }
  createMediaStreamSource() {
    return { connect: jest.fn(), disconnect: jest.fn() };
  }
  createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn(),
        cancelScheduledValues: jest.fn(),
      },
      connect: jest.fn(),
    };
  }
  createMediaStreamDestination() {
    return { stream: { id: 'dest' } };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

describe('useWhisper', () => {
  let container;
  let root;
  let previousActEnvironment;
  let ref;
  let nowSpy;
  let setNow;
  let originalAudioContext;
  let originalWebkitAudioContext;
  let originalMediaDevices;
  let originalFetch;

  const fakeTrack = { stop: jest.fn(), readyState: 'live' };
  const fakeStream = {
    active: true,
    getAudioTracks: () => [fakeTrack],
    getTracks: () => [fakeTrack],
  };

  beforeAll(() => {
    previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    ref = React.createRef();

    originalAudioContext = window.AudioContext;
    originalWebkitAudioContext = window.webkitAudioContext;
    originalMediaDevices = navigator.mediaDevices;
    originalFetch = global.fetch;

    Object.defineProperty(window, 'AudioContext', {
      value: MockAudioContext,
      configurable: true,
    });
    Object.defineProperty(window, 'webkitAudioContext', {
      value: MockAudioContext,
      configurable: true,
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: jest.fn().mockResolvedValue(fakeStream) },
      configurable: true,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'hello world' }),
    });

    getCorsProxyUrlOrThrow.mockResolvedValue('https://fake.worker');
    fetchWorkerWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'hello world' }),
    });

    getEffectiveTranscriptionConfig.mockResolvedValue({
      provider: 'openai',
      model: 'whisper-1',
      apiKey: '',
    });

    RecordRTC.__setBlob(
      new Blob([new Uint8Array(256)], { type: 'audio/wav' })
    );

    let now = 1000;
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    setNow = (next) => {
      now = next;
    };
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
      root = null;
    }
    container.remove();
    container = null;
    ref = null;
    Object.defineProperty(window, 'AudioContext', {
      value: originalAudioContext,
      configurable: true,
    });
    Object.defineProperty(window, 'webkitAudioContext', {
      value: originalWebkitAudioContext,
      configurable: true,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true,
    });
    global.fetch = originalFetch;
    jest.clearAllMocks();
    nowSpy.mockRestore();
  });

  afterAll(() => {
    if (typeof previousActEnvironment === 'undefined') {
      delete globalThis.IS_REACT_ACT_ENVIRONMENT;
      return;
    }
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it('records and transcribes a session', async () => {
    const onComplete = jest.fn();
    const onStop = jest.fn();

    act(() => {
      root.render(
        <WhisperHarness
          ref={ref}
          options={{
            silenceDetection: false,
            onTranscriptionComplete: onComplete,
            onRecordingStop: onStop,
          }}
        />
      );
    });

    await act(async () => {
      await ref.current.startRecording();
    });

    if (!ref.current.audioContextRef.current) {
      ref.current.audioContextRef.current = new MockAudioContext();
    }
    ref.current.audioContextRef.current.state = 'closed';
    setNow(2000);

    await act(async () => {
      await ref.current.stopRecording();
    });

    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(onStop).toHaveBeenCalledWith(expect.any(Blob), 'audio/wav');
    expect(onComplete).toHaveBeenCalledWith('hello world');
    expect(ref.current.status).toBe(RECORDING_STATUS.READY);
    expect(ref.current.getLastRecordingBlob().blob).toBeInstanceOf(Blob);
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/transcribe'),
      expect.any(Object),
      expect.objectContaining({ preferAnonymous: true }),
    );
    const requestInit = fetchWorkerWithAuth.mock.calls[0]?.[1] || {};
    const uploadedFile = requestInit.body?.get?.('file');
    expect(uploadedFile?.type).toBe('audio/wav');
    expect(String(uploadedFile?.name || '')).toMatch(/\.wav$/);
  });

  it('preserves repeated short phrases in final transcripts', async () => {
    fetchWorkerWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'yes yes yes' }),
    });
    const onComplete = jest.fn();

    act(() => {
      root.render(
        <WhisperHarness
          ref={ref}
          options={{
            silenceDetection: false,
            onTranscriptionComplete: onComplete,
          }}
        />
      );
    });

    await act(async () => {
      await ref.current.startRecording();
    });

    if (!ref.current.audioContextRef.current) {
      ref.current.audioContextRef.current = new MockAudioContext();
    }
    ref.current.audioContextRef.current.state = 'closed';
    setNow(2000);

    await act(async () => {
      await ref.current.stopRecording();
    });

    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(onComplete).toHaveBeenCalledWith('yes yes yes');
  });

  it('skips very short recordings', async () => {
    const onComplete = jest.fn();
    const onStop = jest.fn();

    act(() => {
      root.render(
        <WhisperHarness
          ref={ref}
          options={{
            silenceDetection: false,
            onTranscriptionComplete: onComplete,
            onRecordingStop: onStop,
          }}
        />
      );
    });

    await act(async () => {
      await ref.current.startRecording();
    });

    await act(async () => {
      await ref.current.stopRecording();
    });

    expect(onStop).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
    expect(ref.current.status).toBe(RECORDING_STATUS.IDLE);
  });
});
