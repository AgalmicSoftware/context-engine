import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const microphone = () => {
  const track = { stop: jest.fn(), readyState: 'live' };
  return { active: true, getAudioTracks: () => [track], getTracks: () => [track], track };
};
const settle = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

class TestAudioContext {
  state = 'running';
  currentTime = 0;
  createMediaStreamSource = jest.fn(() => ({ connect: jest.fn() }));
  createGain = () => ({ gain: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() }, connect: jest.fn() });
  createMediaStreamDestination = () => ({ stream: {} });
  close = jest.fn(async () => {
    this.state = 'closed';
  });
  resume = jest.fn(async () => {
    this.state = 'running';
  });
}

describe('useWhisper startup ownership', () => {
  let root;
  let container;
  let hook;
  let useHook;
  let loadRecorder;
  let recorderStart;
  let recorderDestroy;
  let recorderResume;
  let recorderStop;
  let onRecordingStop;
  let loadHark;
  let silenceDetection;
  let monitorFactory;
  let originalMediaDevices;
  let originalAudioContext;
  let originalActEnvironment;

  const Harness = () => {
    hook = useHook({ silenceDetection, onRecordingStop });
    return null;
  };

  beforeEach(() => {
    originalActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    originalMediaDevices = navigator.mediaDevices;
    originalAudioContext = window.AudioContext;
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: TestAudioContext });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: jest.fn() } });
    loadRecorder = deferred();
    recorderStart = jest.fn();
    recorderDestroy = jest.fn();
    recorderResume = jest.fn();
    recorderStop = jest.fn((callback) => callback());
    onRecordingStop = jest.fn();
    loadHark = deferred();
    silenceDetection = false;
    monitorFactory = jest.fn(() => ({ on: jest.fn(), stop: jest.fn() }));
    class Recorder {
      startRecording = recorderStart;
      destroy = recorderDestroy;
      pauseRecording = jest.fn();
      resumeRecording = recorderResume;
      stopRecording = recorderStop;
      getBlob = () => new Blob([]);
    }
    jest.resetModules();
    jest.doMock('react', () => React);
    jest.doMock('recordrtc', () => ({ __esModule: true, default: loadRecorder.promise }));
    jest.doMock('hark', () => ({ __esModule: true, default: loadHark.promise }));
    jest.doMock('./ai/aiSettings.js', () => ({ getEffectiveTranscriptionConfig: jest.fn() }));
    jest.doMock('./worker/corsProxy.js', () => ({ getCorsProxyUrlOrThrow: jest.fn() }));
    jest.doMock('./worker/workerAuth.js', () => ({ fetchWorkerWithAuth: jest.fn() }));
    jest.doMock('./worker/workerSessionResolution.js', () => ({ defaultStrictAllowDemoFallback: jest.fn() }));
    useHook = jest.requireActual('./useWhisper').useWhisper;
    loadRecorder.Recorder = Recorder;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    container.remove();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMediaDevices });
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: originalAudioContext });
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
    jest.restoreAllMocks();
  });

  it('stops permission granted after unmount without starting a recorder', async () => {
    const permission = deferred();
    const stream = microphone();
    navigator.mediaDevices.getUserMedia.mockReturnValue(permission.promise);
    loadRecorder.resolve(loadRecorder.Recorder);
    let starting;
    act(() => {
      starting = hook.startRecording();
    });
    act(() => root.unmount());
    root = null;
    await act(async () => {
      permission.resolve(stream);
      await starting;
    });
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(recorderStart).not.toHaveBeenCalled();
    expect(hook.mediaStreamRef.current).toBeNull();
  });

  it('allows only one start before React can commit the requesting state', async () => {
    const permission = deferred();
    const stream = microphone();
    navigator.mediaDevices.getUserMedia.mockReturnValue(permission.promise);
    loadRecorder.resolve(loadRecorder.Recorder);
    let starts;
    act(() => {
      starts = [hook.startRecording(), hook.startRecording()];
    });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    await act(async () => {
      permission.resolve(stream);
      await Promise.all(starts);
    });
    expect(recorderStart).toHaveBeenCalledTimes(1);
  });

  it.each(['resolve', 'reject'])(
    'ignores an older permission %s after cancellation and a newer start',
    async (outcome) => {
      const permission = deferred();
      const oldStream = microphone();
      const newStream = microphone();
      navigator.mediaDevices.getUserMedia.mockReturnValueOnce(permission.promise).mockResolvedValueOnce(newStream);
      loadRecorder.resolve(loadRecorder.Recorder);
      let oldStart;
      act(() => {
        oldStart = hook.startRecording();
      });
      await act(async () => {
        await hook.stopRecording();
      });
      await act(async () => {
        await hook.startRecording();
      });
      await act(async () => {
        if (outcome === 'resolve') permission.resolve(oldStream);
        else permission.reject(Object.assign(new Error('old denial'), { name: 'NotAllowedError' }));
        await oldStart;
      });
      expect(recorderStart).toHaveBeenCalledTimes(1);
      expect(hook.mediaStreamRef.current).toBe(newStream);
      expect(hook.status).toBe('recording');
      expect(hook.errorMessage).toBe('');
      if (outcome === 'resolve') expect(oldStream.track.stop).toHaveBeenCalledTimes(1);
      expect(newStream.track.stop).not.toHaveBeenCalled();
    },
  );

  it('cancels a start while the recorder module is still loading', async () => {
    const stream = microphone();
    navigator.mediaDevices.getUserMedia.mockResolvedValue(stream);
    let starting;
    await act(async () => {
      starting = hook.startRecording();
      await settle();
    });
    expect(hook.mediaStreamRef.current).toBe(stream);
    await act(async () => {
      await hook.stopRecording();
    });
    await act(async () => {
      loadRecorder.resolve(loadRecorder.Recorder);
      await starting;
    });
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(recorderStart).not.toHaveBeenCalled();
    expect(hook.status).toBe('idle');
  });

  it('keeps a newer audio context when an obsolete resume and close finish', async () => {
    const resume = deferred();
    const close = deferred();
    const oldContext = new TestAudioContext();
    oldContext.state = 'suspended';
    oldContext.resume.mockImplementation(() => resume.promise);
    oldContext.close.mockImplementation(() => close.promise);
    hook.audioContextRef.current = oldContext;
    const oldStream = microphone();
    const newStream = microphone();
    navigator.mediaDevices.getUserMedia.mockResolvedValueOnce(oldStream).mockResolvedValueOnce(newStream);
    loadRecorder.resolve(loadRecorder.Recorder);
    let starting;
    await act(async () => {
      starting = hook.startRecording();
      await settle();
    });
    expect(oldContext.resume).toHaveBeenCalledTimes(1);
    await act(async () => {
      await hook.stopRecording();
    });
    await act(async () => {
      await hook.startRecording();
    });
    const newContext = hook.audioContextRef.current;
    await act(async () => {
      close.resolve();
      resume.resolve();
      await starting;
    });
    expect(newContext).not.toBe(oldContext);
    expect(hook.audioContextRef.current).toBe(newContext);
    expect(oldContext.createMediaStreamSource).not.toHaveBeenCalled();
    expect(recorderStart).toHaveBeenCalledTimes(1);
    expect(oldStream.track.stop).toHaveBeenCalledTimes(1);
    expect(newStream.track.stop).not.toHaveBeenCalled();
  });

  it('can start after StrictMode repeats effect setup and cleanup', async () => {
    act(() =>
      root.render(
        <React.StrictMode>
          <Harness />
        </React.StrictMode>,
      ),
    );
    const stream = microphone();
    navigator.mediaDevices.getUserMedia.mockResolvedValue(stream);
    loadRecorder.resolve(loadRecorder.Recorder);
    await act(async () => {
      await hook.startRecording();
    });
    expect(recorderStart).toHaveBeenCalledTimes(1);
    expect(hook.status).toBe('recording');
  });

  it.each(['resolve', 'reject'])('ignores a silence detector import %s after cancellation', async (outcome) => {
    silenceDetection = true;
    act(() => root.render(<Harness />));
    const stream = microphone();
    navigator.mediaDevices.getUserMedia.mockResolvedValue(stream);
    loadRecorder.resolve(loadRecorder.Recorder);
    let starting;
    await act(async () => {
      starting = hook.startRecording();
      await settle();
    });
    expect(recorderStart).toHaveBeenCalledTimes(1);
    await act(async () => {
      await hook.stopRecording();
    });
    await act(async () => {
      if (outcome === 'resolve') loadHark.resolve(monitorFactory);
      else loadHark.reject(new Error('late module failure'));
      await starting;
    });
    expect(monitorFactory).not.toHaveBeenCalled();
    expect(hook.errorMessage).toBe('');
    expect(hook.status).toBe('idle');
  });

  it('ignores a recorder resume that finishes after unmount', async () => {
    navigator.mediaDevices.getUserMedia.mockResolvedValue(microphone());
    loadRecorder.resolve(loadRecorder.Recorder);
    await act(async () => {
      await hook.startRecording();
    });
    await act(async () => {
      await hook.pauseRecording();
    });
    const resuming = deferred();
    recorderResume.mockReturnValue(resuming.promise);
    const audioContext = hook.audioContextRef.current;
    audioContext.state = 'suspended';
    let resume;
    act(() => {
      resume = hook.resumeRecording();
    });
    act(() => root.unmount());
    root = null;
    await act(async () => {
      resuming.resolve();
      await resume;
    });
    expect(audioContext.resume).not.toHaveBeenCalled();
    expect(monitorFactory).not.toHaveBeenCalled();
  });

  it('ignores a silence detector failure after a completed recording', async () => {
    silenceDetection = true;
    act(() => root.render(<Harness />));
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    navigator.mediaDevices.getUserMedia.mockResolvedValue(microphone());
    loadRecorder.resolve(loadRecorder.Recorder);
    let starting;
    await act(async () => {
      starting = hook.startRecording();
      await settle();
    });
    now.mockReturnValue(2000);
    hook.audioContextRef.current.state = 'closed';
    await act(async () => {
      await hook.stopRecording();
    });
    await act(async () => {
      loadHark.reject(new Error('late detector failure'));
      await starting;
    });
    expect(hook.status).toBe('ready');
    expect(hook.errorMessage).toBe('');
  });

  it('does not resume the context of a newer recording when an old recorder resume finishes', async () => {
    navigator.mediaDevices.getUserMedia.mockResolvedValue(microphone());
    loadRecorder.resolve(loadRecorder.Recorder);
    await act(async () => {
      await hook.startRecording();
    });
    await act(async () => {
      await hook.pauseRecording();
    });
    const resuming = deferred();
    recorderResume.mockReturnValue(resuming.promise);
    let resume;
    act(() => {
      resume = hook.resumeRecording();
    });
    hook.audioContextRef.current.state = 'closed';
    await act(async () => {
      await hook.stopRecording();
    });
    await act(async () => {
      await hook.startRecording();
    });
    const newContext = hook.audioContextRef.current;
    newContext.state = 'suspended';
    await act(async () => {
      resuming.resolve();
      await resume;
    });
    expect(newContext.resume).not.toHaveBeenCalled();
  });

  it('ignores a recorder stop callback after unmount', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    navigator.mediaDevices.getUserMedia.mockResolvedValue(microphone());
    loadRecorder.resolve(loadRecorder.Recorder);
    await act(async () => {
      await hook.startRecording();
    });
    now.mockReturnValue(2000);
    hook.audioContextRef.current.state = 'closed';
    let stopped;
    recorderStop.mockImplementation((callback) => {
      stopped = callback;
    });
    let stopping;
    act(() => {
      stopping = hook.stopRecording();
    });
    act(() => root.unmount());
    root = null;
    await act(async () => {
      await expect(stopped()).resolves.toBeUndefined();
      await stopping;
    });
    expect(onRecordingStop).not.toHaveBeenCalled();
  });

  it('ignores audio context closure after unmount during stop', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    navigator.mediaDevices.getUserMedia.mockResolvedValue(microphone());
    loadRecorder.resolve(loadRecorder.Recorder);
    await act(async () => {
      await hook.startRecording();
    });
    now.mockReturnValue(2000);
    const closing = deferred();
    hook.audioContextRef.current.state = 'suspended';
    hook.audioContextRef.current.close.mockReturnValue(closing.promise);
    let stopping;
    act(() => {
      stopping = hook.stopRecording();
    });
    act(() => root.unmount());
    root = null;
    await act(async () => {
      closing.resolve();
      await stopping;
    });
    expect(onRecordingStop).not.toHaveBeenCalled();
  });

  it('retains one silence monitor when startup and resume share a delayed import', async () => {
    silenceDetection = true;
    act(() => root.render(<Harness />));
    navigator.mediaDevices.getUserMedia.mockResolvedValue(microphone());
    loadRecorder.resolve(loadRecorder.Recorder);
    let starting;
    await act(async () => {
      starting = hook.startRecording();
      await settle();
    });
    await act(async () => {
      await hook.pauseRecording();
    });
    let resuming;
    await act(async () => {
      resuming = hook.resumeRecording();
      await settle();
    });
    await act(async () => {
      loadHark.resolve(monitorFactory);
      await Promise.all([starting, resuming]);
    });
    expect(monitorFactory.mock.results.filter(({ value }) => !value.stop.mock.calls.length)).toHaveLength(1);
  });

  it('ignores a resume rejection after stop enters processing in the same attempt', async () => {
    navigator.mediaDevices.getUserMedia.mockResolvedValue(microphone());
    loadRecorder.resolve(loadRecorder.Recorder);
    await act(async () => {
      await hook.startRecording();
    });
    await act(async () => {
      await hook.pauseRecording();
    });
    const resuming = deferred();
    recorderResume.mockReturnValue(resuming.promise);
    let resume;
    act(() => {
      resume = hook.resumeRecording();
    });
    const closing = deferred();
    hook.audioContextRef.current.state = 'suspended';
    hook.audioContextRef.current.close.mockReturnValue(closing.promise);
    let stopping;
    act(() => {
      stopping = hook.stopRecording();
    });
    await act(async () => {
      resuming.reject(new Error('obsolete resume'));
      await resume;
    });
    expect(hook.status).toBe('processing');
    expect(hook.errorMessage).toBe('');
    await act(async () => {
      closing.resolve();
      await stopping;
    });
  });
});
