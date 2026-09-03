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

  it('pauses microphone capture and fully tears down local and remote audio when stopped', async () => {
    class MockDataChannel extends EventTarget {
      readyState: RTCDataChannelState = 'open';
      send = jest.fn();
      close = jest.fn();
    }

    const localTrack = {
      enabled: true,
      readyState: 'live',
      stop: jest.fn(),
    } as unknown as MediaStreamTrack;
    const remoteTrack = {
      enabled: true,
      readyState: 'live',
      stop: jest.fn(),
    } as unknown as MediaStreamTrack;
    const localStream = {
      getTracks: () => [localTrack],
      getAudioTracks: () => [localTrack],
    } as unknown as MediaStream;
    const remoteStream = {
      getTracks: () => [remoteTrack],
    } as unknown as MediaStream;
    const channel = new MockDataChannel();
    const peer = {
      ontrack: null as RTCPeerConnection['ontrack'],
      localDescription: { type: 'offer', sdp: 'offer-sdp' } as RTCSessionDescription,
      addTrack: jest.fn(),
      createDataChannel: jest.fn(() => channel as unknown as RTCDataChannel),
      createOffer: jest.fn(async () => ({ type: 'offer', sdp: 'offer-sdp' }) as RTCSessionDescriptionInit),
      setLocalDescription: jest.fn(async () => undefined),
      setRemoteDescription: jest.fn(async () => undefined),
      close: jest.fn(),
    } as unknown as RTCPeerConnection;
    const audioElement = document.createElement('audio');
    Object.defineProperty(audioElement, 'srcObject', { configurable: true, writable: true, value: null });
    const play = jest.spyOn(audioElement, 'play').mockResolvedValue(undefined);
    const pause = jest.spyOn(audioElement, 'pause').mockImplementation(() => undefined);
    const recordingStates: string[] = [];
    const transcripts: string[] = [];

    const session = await startSessionRealtimeInterview({
      workerUrl: 'https://worker.example',
      sessionSlug: 'demo',
      instructions: 'Ask the questions.',
      audioElement,
      onRecordingState: (state) => recordingStates.push(state),
      onTranscript: (transcript) => transcripts.push(transcript),
      fetchImpl: jest.fn(async () => ({
        ok: true,
        text: async () => 'answer-sdp',
      })) as unknown as typeof fetch,
      mediaDevices: {
        getUserMedia: jest.fn(async () => localStream),
      },
      createPeerConnection: () => peer,
    });

    peer.ontrack?.({ streams: [remoteStream], track: remoteTrack } as unknown as RTCTrackEvent);
    expect(play).toHaveBeenCalledTimes(1);
    expect(session.mediaStream).toBe(localStream);

    session.pause();
    expect(localTrack.enabled).toBe(false);
    session.resume();
    expect(localTrack.enabled).toBe(true);

    channel.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'conversation.item.input_audio_transcription.completed',
          item_id: 'before-stop',
          transcript: 'Captured before stopping.',
        }),
      }),
    );
    expect(transcripts).toEqual(['Responder: Captured before stopping.']);

    await session.stop();
    await session.stop();
    channel.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          type: 'conversation.item.input_audio_transcription.completed',
          item_id: 'after-stop',
          transcript: 'This must be ignored.',
        }),
      }),
    );

    expect(localTrack.enabled).toBe(false);
    expect(localTrack.stop).toHaveBeenCalledTimes(1);
    expect(remoteTrack.stop).toHaveBeenCalledTimes(1);
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(peer.close).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(audioElement.srcObject).toBeNull();
    expect(recordingStates).toEqual(['recording', 'paused', 'recording', 'stopped']);
    expect(transcripts).toEqual(['Responder: Captured before stopping.']);
  });
});
