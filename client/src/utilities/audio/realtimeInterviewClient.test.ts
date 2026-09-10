import {
  buildRealtimeInterviewTranscript,
  readRealtimeResponderTurn,
  REALTIME_INTERVIEW_OPENING_INSTRUCTION,
  startSessionRealtimeInterview,
} from './realtimeInterviewClient';

describe('realtime interview transcript collection', () => {
  it('collects only completed responder transcription events', () => {
    expect(
      readRealtimeResponderTurn({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'item-1',
        transcript: 'Reversible decisions matter.',
      }),
    ).toEqual({ itemId: 'item-1', text: 'Reversible decisions matter.', role: 'responder' });
    expect(
      readRealtimeResponderTurn({ type: 'response.output_audio_transcript.done', transcript: 'Assistant' }),
    ).toBeNull();
  });

  it('builds a mapper transcript without assistant utterances', () => {
    expect(
      buildRealtimeInterviewTranscript([
        { itemId: 'one', text: 'First point.', role: 'responder' },
        { itemId: 'two', text: 'Second point.', role: 'responder' },
      ]),
    ).toBe('Responder: First point.\nResponder: Second point.');
  });

  it('opens with personal-or-topic insight and makes steering explicit', () => {
    expect(REALTIME_INTERVIEW_OPENING_INSTRUCTION).toContain(
      'either about themselves and their perspective or about the broader topic',
    );
    expect(REALTIME_INTERVIEW_OPENING_INSTRUCTION).toContain('steer the conversation');
    expect(REALTIME_INTERVIEW_OPENING_INSTRUCTION).toContain('at any point');
  });
});

function harness(protocol = 'live') {
  class Channel extends EventTarget {
    readyState = 'open';
    send = jest.fn();
    close = jest.fn(() => {
      this.readyState = 'closed';
    });
    emit = (event: unknown) => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(event) }));
  }
  const channel = new Channel();
  const track = {
    enabled: true,
    readyState: 'live',
    muted: false,
    onended: null as (() => void) | null,
    onmute: null as (() => void) | null,
    stop: jest.fn(() => {
      track.readyState = 'ended';
    }),
  };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  class Peer extends EventTarget {
    ontrack: ((event: RTCTrackEvent) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    connectionState = 'connected';
    iceGatheringState = 'complete';
    localDescription = { type: 'offer', sdp: 'v=0\r\no=offer\r\n' };
    addTrack = jest.fn();
    createDataChannel = jest.fn(() => channel);
    createOffer = jest.fn(async () => this.localDescription);
    setLocalDescription = jest.fn(async () => {});
    setRemoteDescription = jest.fn(async () =>
      channel.emit({ type: protocol === 'live' ? 'session.started' : 'session.created' }),
    );
    close = jest.fn(() => {
      this.connectionState = 'closed';
    });
  }
  const peer = new Peer();
  const audio = document.createElement('audio');
  Object.defineProperty(audio, 'srcObject', { writable: true, value: null });
  jest.spyOn(audio, 'play').mockResolvedValue();
  jest.spyOn(audio, 'pause').mockImplementation(() => {});
  const controller = new AbortController();
  const options = {
    workerUrl: 'https://worker.example/ai',
    sessionSlug: 'demo',
    instructions: 'Ask one question.',
    audioElement: audio,
    signal: controller.signal,
    onStatus: jest.fn(),
    onError: jest.fn(),
    onRecordingState: jest.fn(),
    onTranscript: jest.fn(),
    mediaDevices: { getUserMedia: jest.fn(async () => stream) },
    createPeerConnection: jest.fn(() => peer as unknown as RTCPeerConnection),
    fetchImpl: jest.fn(async () => ({
      ok: true,
      headers: new Headers({ 'x-interview-protocol': protocol }),
      text: async () => 'v=0\r\no=answer\r\n',
    })) as unknown as jest.MockedFunction<typeof fetch>,
  };
  return {
    channel,
    track,
    stream,
    peer,
    audio,
    controller,
    options,
    start: () => startSessionRealtimeInterview(options),
  };
}

const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe('interview connection lifecycle', () => {
  it('waits for session.started and the peer before enabling capture and sending a Live greeting', async () => {
    const h = harness();
    h.peer.connectionState = 'connecting';
    h.peer.setRemoteDescription.mockImplementation(async () => true);
    const pending = h.start();
    await tick();
    expect(h.track.enabled).toBe(false);
    expect(h.options.onRecordingState).not.toHaveBeenCalledWith('recording');
    h.peer.connectionState = 'connected';
    h.peer.dispatchEvent(new Event('connectionstatechange'));
    await tick();
    expect(h.options.onRecordingState).not.toHaveBeenCalledWith('recording');
    h.channel.emit({ type: 'session.started' });
    const session = await pending;
    expect(h.track.enabled).toBe(true);
    expect(JSON.parse(h.channel.send.mock.calls[0][0])).toEqual({
      type: 'session.instructions.append',
      delegation_id: null,
      content: REALTIME_INTERVIEW_OPENING_INSTRUCTION,
    });
    expect(h.options.fetchImpl).toHaveBeenCalledWith(
      'https://worker.example/realtime/call?slug=demo',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await session.stop();
  });

  it('appends exact Live transcript fragments, deduplicates by event ID, and orders late fragments by time', async () => {
    const h = harness();
    const session = await h.start();
    const first = { type: 'session.input_transcript.delta', event_id: 'a', start_ms: 10, delta: 'I value' };
    h.channel.emit({ type: 'session.output_transcript.delta', event_id: 'assistant', delta: 'What?' });
    h.channel.emit({ type: 'session.input_transcript.delta', event_id: 'b', start_ms: 20, delta: ' choice.' });
    h.channel.emit(first);
    h.channel.emit(first);
    expect(session.getTranscript()).toBe('Responder: I value choice.\nInterviewer: What?');
    await session.stop();
    h.channel.emit({ type: 'session.input_transcript.delta', event_id: 'late', delta: 'Ignored' });
    expect(session.getTranscript()).toBe('Responder: I value choice.\nInterviewer: What?');
  });

  it('preserves the legacy Realtime opening and completed responder events', async () => {
    const h = harness('realtime');
    const session = await h.start();
    expect(JSON.parse(h.channel.send.mock.calls[0][0]).type).toBe('response.create');
    h.channel.emit({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'one',
      transcript: 'Legacy speech.',
    });
    expect(session.getTranscript()).toBe('Responder: Legacy speech.');
    await session.stop();
  });

  it.each([false, true])(
    'cleans up synchronously and idempotently, including stale remote callbacks (paused=%s)',
    async (paused) => {
      const h = harness();
      const session = await h.start();
      const remoteTrack = { enabled: true, stop: jest.fn() };
      const remote = { getTracks: () => [remoteTrack] } as unknown as MediaStream;
      const lateTrack = h.peer.ontrack;
      lateTrack?.({ streams: [remote] } as unknown as RTCTrackEvent);
      session.pause();
      expect(h.track.enabled).toBe(false);
      expect(h.audio.muted).toBe(true);
      session.resume();
      expect(h.track.enabled).toBe(true);
      if (paused) session.pause();
      const ending = session.stop();
      expect(h.track.stop).toHaveBeenCalledTimes(1);
      expect(h.track.enabled).toBe(false);
      expect(h.peer.close).toHaveBeenCalledTimes(1);
      expect(h.channel.close).toHaveBeenCalledTimes(1);
      expect(h.audio.pause).toHaveBeenCalled();
      expect(h.audio.srcObject).toBeNull();
      expect(remoteTrack.stop).toHaveBeenCalledTimes(1);
      lateTrack?.({ streams: [remote] } as unknown as RTCTrackEvent);
      expect(h.audio.srcObject).toBeNull();
      await ending;
      await session.stop();
      session.resume();
      expect(h.track.stop).toHaveBeenCalledTimes(1);
      expect(JSON.parse(h.channel.send.mock.calls.at(-1)![0]).type).toBe('session.close');
    },
  );

  it('stops a late microphone grant after cancellation without creating a peer', async () => {
    const h = harness();
    let grant!: (stream: MediaStream) => void;
    h.options.mediaDevices.getUserMedia.mockImplementation(
      () =>
        new Promise((resolve) => {
          grant = resolve;
        }),
    );
    const pending = h.start();
    h.controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    grant(h.stream);
    await tick();
    expect(h.track.stop).toHaveBeenCalledTimes(1);
    expect(h.options.createPeerConnection).not.toHaveBeenCalled();
  });

  it('aborts the Worker request and rejects late HTTP completion without applying an SDP', async () => {
    const h = harness();
    let finish!: (value: Response) => void;
    h.options.fetchImpl.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = h.start();
    await tick();
    h.controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.track.stop).toHaveBeenCalled();
    finish({ ok: true } as Response);
    await tick();
    expect(h.peer.setRemoteDescription).not.toHaveBeenCalled();
  });

  it.each(['peer', 'addTrack', 'offer'])('cleans the microphone if %s setup throws', async (step) => {
    const h = harness();
    const fail = () => {
      throw new Error('setup failed');
    };
    if (step === 'peer') h.options.createPeerConnection.mockImplementation(fail);
    if (step === 'addTrack') h.peer.addTrack.mockImplementation(fail);
    if (step === 'offer') h.peer.createOffer.mockImplementation(fail);
    await expect(h.start()).rejects.toThrow('setup failed');
    expect(h.track.stop).toHaveBeenCalledTimes(1);
  });

  it.each(['track', 'mute', 'peer', 'channel', 'api', 'closed', 'playback'])(
    'recovers truthfully from a running %s failure',
    async (failure) => {
      const h = harness();
      const session = await h.start();
      if (failure === 'track') h.track.onended?.();
      if (failure === 'mute') h.track.onmute?.();
      if (failure === 'peer') {
        h.peer.connectionState = 'disconnected';
        h.peer.onconnectionstatechange?.();
      }
      if (failure === 'channel') h.channel.dispatchEvent(new Event('close'));
      if (failure === 'api') h.channel.emit({ type: 'error', error: { message: 'service error' } });
      if (failure === 'closed') h.channel.emit({ type: 'session.closed' });
      if (failure === 'playback') {
        jest.mocked(h.audio.play).mockRejectedValue(new Error('blocked'));
        h.peer.ontrack?.({ streams: [h.stream] } as unknown as RTCTrackEvent);
        await tick();
      }
      expect(h.options.onError).toHaveBeenCalledTimes(1);
      expect(h.track.enabled).toBe(false);
      expect(h.audio.srcObject).toBeNull();
      session.resume();
      expect(h.options.onRecordingState.mock.calls.at(-1)).toEqual(['stopped']);
    },
  );

  it('does not report resumed recording when the microphone has ended', async () => {
    const h = harness();
    const session = await h.start();
    session.pause();
    h.track.readyState = 'ended';
    session.resume();
    expect(h.options.onRecordingState.mock.calls.at(-1)).toEqual(['stopped']);
    expect(h.track.enabled).toBe(false);
  });

  it('times out startup, removes listeners, and can start fresh', async () => {
    jest.useFakeTimers();
    try {
      const h = harness();
      h.peer.iceGatheringState = 'gathering';
      const pending = h.start();
      const rejection = expect(pending).rejects.toThrow('timed out');
      await tick();
      jest.advanceTimersByTime(30_000);
      await rejection;
      expect(h.track.stop).toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
      const fresh = harness();
      const session = await fresh.start();
      await session.stop();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('interview startup recovery', () => {
  it.each(['NotAllowedError', 'NotFoundError', 'NotReadableError'])('explains microphone %s failures', async (name) => {
    const h = harness();
    h.options.mediaDevices.getUserMedia.mockRejectedValue(new DOMException('Device failure', name));
    await expect(h.start()).rejects.toThrow(/microphone|Microphone/);
    expect(h.options.createPeerConnection).not.toHaveBeenCalled();
  });

  it('requires a Worker that declares its actual Interview protocol', async () => {
    const h = harness();
    h.options.fetchImpl.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      text: async () => 'v=0\r\n',
    } as Response);
    await expect(h.start()).rejects.toThrow('redeploy');
    expect(h.track.stop).toHaveBeenCalled();
  });

  it.each(['channel', 'session'])('cancels while waiting for %s readiness and rejects late events', async (stage) => {
    const h = harness();
    if (stage === 'channel') h.channel.readyState = 'connecting';
    else h.peer.setRemoteDescription.mockImplementation(async () => true);
    const pending = h.start();
    await tick();
    h.controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    h.channel.readyState = 'open';
    h.channel.dispatchEvent(new Event('open'));
    h.channel.emit({ type: 'session.started' });
    expect(h.options.onRecordingState).not.toHaveBeenCalledWith('recording');
    expect(h.channel.send).not.toHaveBeenCalled();
    expect(h.track.stop).toHaveBeenCalledTimes(1);
  });
});

it('retains interviewer context and timestamp order for a short numeric reply, rejecting late text', async () => {
  const h = harness();
  const session = await startSessionRealtimeInterview(h.options);
  h.channel.emit({
    type: 'session.input_transcript.delta',
    event_id: 'answer',
    delta: 'Four.',
    start_ms: 5000,
    end_ms: 5500,
  });
  h.channel.emit({
    type: 'session.output_transcript.delta',
    event_id: 'question',
    delta: 'How much do you trust AI companies to self-regulate?',
    start_ms: 1000,
    end_ms: 3000,
  });
  h.channel.emit({
    type: 'session.output_transcript.delta',
    event_id: 'scale',
    delta: ' From one to ten.',
    start_ms: 3000,
    end_ms: 4000,
  });
  const result = await session.stop();
  expect(result.transcript).toBe(
    'Interviewer: How much do you trust AI companies to self-regulate? From one to ten.\nResponder: Four.',
  );
  expect(result.turns[0]).toMatchObject({ role: 'responder', startMs: 5000, endMs: 5500 });
  h.channel.emit({ type: 'session.output_transcript.delta', event_id: 'late', delta: 'Ignore this', start_ms: 6000 });
  expect(session.getTranscript()).toBe(result.transcript);
});
