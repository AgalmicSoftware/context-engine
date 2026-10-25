import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

jest.mock('recordrtc', () => {
  let nextBlob = null;

  class MockRecordRTC {
    constructor(stream, options = {}) {
      this.options = options;
      this.state = 'recording';
      this._blob = nextBlob || new Blob([new Uint8Array(256)], { type: 'audio/wav' });
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
  })),
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
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from './session/sessionModeProfile';

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

    RecordRTC.__setBlob(new Blob([new Uint8Array(256)], { type: 'audio/wav' }));

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

  it('records and transcribes a session with authenticated fallback available', async () => {
    const onComplete = jest.fn();
    const onStop = jest.fn();
    const sessionConfig = {
      sessionSlug: 'demo-sh',
      sessionId: '0xb822b3eca85bdc35cf83cb947bceb6b2',
    };

    act(() => {
      root.render(
        <WhisperHarness
          ref={ref}
          options={{
            silenceDetection: false,
            sessionSlug: 'demo-sh',
            sessionConfig,
            onTranscriptionComplete: onComplete,
            onRecordingStop: onStop,
          }}
        />,
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
      expect.objectContaining({
        preferAnonymous: true,
        sessionConfig,
        sessionSlug: 'demo-sh',
      }),
    );
    expect(fetchWorkerWithAuth.mock.calls[0]?.[2]?.anonymousOnly).not.toBe(true);
    const requestInit = fetchWorkerWithAuth.mock.calls[0]?.[1] || {};
    const uploadedFile = requestInit.body?.get?.('file');
    expect(uploadedFile?.type).toBe('audio/wav');
    expect(String(uploadedFile?.name || '')).toMatch(/\.wav$/);
  });

  it.each([
    { label: 'Worker default', suppliedWorker: true, expectedModel: 'worker-transcription-model' },
    {
      label: 'explicit model',
      suppliedWorker: true,
      explicitModel: 'explicit-transcription-model',
      expectedModel: 'explicit-transcription-model',
    },
    { label: 'local override', suppliedWorker: true, localOverride: true, expectedModel: 'local-transcription-model' },
    {
      label: 'explicit model over local override',
      suppliedWorker: true,
      localOverride: true,
      explicitModel: 'explicit-transcription-model',
      expectedModel: 'explicit-transcription-model',
    },
    { label: 'unconfigured default', suppliedWorker: false, expectedModel: 'whisper-1' },
  ])(
    'uploads dictation with the resolved $label',
    async ({ suppliedWorker, localOverride, explicitModel, expectedModel }) => {
      const actualSettings = jest.requireActual('./ai/aiSettings.js');
      const sessionConfig = suppliedWorker
        ? {
            slug: 'dictation-session',
            sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
            ai: { models: { transcription: { provider: 'openai', model: 'worker-transcription-model' } } },
          }
        : undefined;
      localStorage.clear();
      getEffectiveTranscriptionConfig.mockImplementation(actualSettings.getEffectiveTranscriptionConfig);
      try {
        if (localOverride) {
          actualSettings.saveLocalAiSettings({
            useLocal: true,
            transcription: { provider: 'openai', model: 'local-transcription-model' },
            providers: { openai: { apiKey: 'synthetic-transcription-key' } },
          });
        }
        act(() => {
          root.render(
            <WhisperHarness
              ref={ref}
              options={{
                silenceDetection: false,
                timeSlice: 0,
                sessionSlug: 'dictation-session',
                sessionConfig,
                workerUrl: 'https://dictation-worker.example.test',
                ...(explicitModel ? { model: explicitModel } : {}),
              }}
            />,
          );
        });
        await act(async () => {
          await ref.current.startRecording();
        });
        ref.current.audioContextRef.current.state = 'closed';
        setNow(2000);
        await act(async () => {
          await ref.current.stopRecording();
          await flushPromises();
          await flushPromises();
        });
        expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
        const [url, request, auth] = fetchWorkerWithAuth.mock.calls[0];
        expect(url).toBe('https://dictation-worker.example.test/transcribe');
        expect(request.body.get('model')).toBe(expectedModel);
        expect(request.body.get('provider')).toBe('openai');
        expect(request.body.get('apiKey')).toBe(localOverride ? 'synthetic-transcription-key' : null);
        expect(auth).toMatchObject({
          sessionSlug: 'dictation-session',
          sessionConfig,
          preferAnonymous: true,
        });
        expect(auth.anonymousOnly).not.toBe(true);
        expect(ref.current.transcript.final).toBe('hello world');
      } finally {
        actualSettings.saveLocalAiSettings({ useLocal: false, providers: { openai: { apiKey: '' } } });
        localStorage.clear();
      }
    },
  );

  it('switches from a Continuity microphone to an available built-in computer microphone', async () => {
    const iphoneTrack = { label: 'iPhone Microphone', stop: jest.fn(), readyState: 'live' };
    const macTrack = { label: 'MacBook Pro Microphone', stop: jest.fn(), readyState: 'live' };
    const iphoneStream = {
      active: true,
      getAudioTracks: () => [iphoneTrack],
      getTracks: () => [iphoneTrack],
    };
    const macStream = {
      active: true,
      getAudioTracks: () => [macTrack],
      getTracks: () => [macTrack],
    };
    const getUserMedia = jest.fn().mockResolvedValueOnce(iphoneStream).mockResolvedValueOnce(macStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia,
        enumerateDevices: jest.fn().mockResolvedValue([
          { kind: 'audioinput', deviceId: 'continuity-1', label: 'iPhone Microphone' },
          { kind: 'audioinput', deviceId: 'builtin-1', label: 'MacBook Pro Microphone' },
        ]),
      },
      configurable: true,
    });

    act(() => {
      root.render(<WhisperHarness ref={ref} options={{ silenceDetection: false }} />);
    });

    await act(async () => {
      await ref.current.startRecording();
    });

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[0][0]).toEqual({
      audio: expect.objectContaining({
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      }),
    });
    expect(getUserMedia.mock.calls[1][0]).toEqual({
      audio: expect.objectContaining({ deviceId: { exact: 'builtin-1' } }),
    });
    expect(iphoneTrack.stop).toHaveBeenCalledTimes(1);
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
        />,
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

  it('hands the final transcript to the parent once, outside render', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onComplete = jest.fn();
    let parentText = '';
    // AudioInput stores the transcript in its parent; StrictMode replays impure state updaters.
    const Parent = () => {
      const [text, setText] = React.useState('');
      parentText = text;
      const options = React.useMemo(
        () => ({
          silenceDetection: false,
          onTranscriptionComplete: (finalText) => {
            onComplete(finalText);
            setText(finalText);
          },
        }),
        [],
      );
      return <WhisperHarness ref={ref} options={options} />;
    };

    try {
      act(() => {
        root.render(
          <React.StrictMode>
            <Parent />
          </React.StrictMode>,
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

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith('hello world');
      expect(parentText).toBe('hello world');
      expect(ref.current.transcript.final).toBe('hello world');
      const errors = consoleError.mock.calls.map((args) => args.map(String).join(' ')).join('\n');
      expect(errors).not.toMatch(/Cannot update a component/);
    } finally {
      consoleError.mockRestore();
    }
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
        />,
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

  it('cancels an active recording without finalizing or uploading it', async () => {
    const onStop = jest.fn();
    const onComplete = jest.fn();
    act(() =>
      root.render(
        <WhisperHarness
          ref={ref}
          options={{ silenceDetection: false, onRecordingStop: onStop, onTranscriptionComplete: onComplete }}
        />,
      ),
    );
    await act(async () => {
      await ref.current.startRecording();
    });
    setNow(2000);
    act(() => {
      ref.current.cancelRecording();
    });
    await act(async () => {
      await flushPromises();
    });
    expect(ref.current.status).toBe(RECORDING_STATUS.IDLE);
    expect(ref.current.mediaStreamRef.current).toBeNull();
    expect(onStop).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
  });

  it('does not upload after cancellation while transcription settings are resolving', async () => {
    let resolveSettings;
    getEffectiveTranscriptionConfig.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSettings = resolve;
      }),
    );
    const onComplete = jest.fn();
    act(() =>
      root.render(
        <WhisperHarness
          ref={ref}
          options={{
            silenceDetection: false,
            workerUrl: 'https://original.worker.test',
            onTranscriptionComplete: onComplete,
          }}
        />,
      ),
    );
    await act(async () => {
      await ref.current.startRecording();
    });
    ref.current.audioContextRef.current.state = 'closed';
    setNow(2000);
    await act(async () => {
      await ref.current.stopRecording();
    });
    act(() => {
      ref.current.cancelRecording();
    });
    act(() =>
      root.render(
        <WhisperHarness
          ref={ref}
          options={{
            silenceDetection: false,
            workerUrl: 'https://replacement.worker.test',
            onTranscriptionComplete: onComplete,
          }}
        />,
      ),
    );
    await act(async () => {
      await ref.current.startRecording();
    });
    await act(async () => {
      resolveSettings({ provider: 'openai', model: 'whisper-1' });
      await flushPromises();
    });
    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(ref.current.status).toBe(RECORDING_STATUS.RECORDING);
    ref.current.audioContextRef.current.state = 'closed';
    setNow(3000);
    await act(async () => {
      await ref.current.stopRecording();
      await flushPromises();
    });
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(fetchWorkerWithAuth.mock.calls[0][0]).toBe('https://replacement.worker.test/transcribe');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
