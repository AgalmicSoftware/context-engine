export type RealtimeInterviewTurn = {
  itemId: string;
  text: string;
  role: 'responder';
};

export type RealtimeInterviewSession = {
  mediaStream: MediaStream;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<{ transcript: string; turns: RealtimeInterviewTurn[] }>;
  getTranscript: () => string;
};

export type RealtimeInterviewRecordingState = 'recording' | 'paused' | 'stopped';

type StartRealtimeInterviewOptions = {
  workerUrl: string;
  sessionSlug: string;
  instructions: string;
  audioElement: HTMLAudioElement;
  onStatus?: (status: string) => void;
  onRecordingState?: (state: RealtimeInterviewRecordingState) => void;
  onTranscript?: (transcript: string, turns: RealtimeInterviewTurn[]) => void;
  fetchImpl?: typeof fetch;
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
  createPeerConnection?: () => RTCPeerConnection;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const trim = (value: unknown) => String(value == null ? '' : value).trim();

export const REALTIME_INTERVIEW_OPENING_INSTRUCTION =
  'Begin with a short welcome, then ask what important insight the responder wants to share—either about themselves and their perspective or about the broader topic. Mention that they can steer the conversation toward what matters most to them at any point.';

export const readRealtimeResponderTurn = (event: unknown): RealtimeInterviewTurn | null => {
  const record = asRecord(event);
  const type = trim(record.type);
  if (type !== 'conversation.item.input_audio_transcription.completed') return null;
  const text = trim(record.transcript);
  if (!text) return null;
  return {
    itemId: trim(record.item_id || record.itemId) || `turn-${Date.now()}`,
    text,
    role: 'responder',
  };
};

export const buildRealtimeInterviewTranscript = (turns: RealtimeInterviewTurn[]): string =>
  turns.map((turn) => `Responder: ${turn.text}`).join('\n');

const waitForDataChannelOpen = (channel: RTCDataChannel): Promise<void> => {
  if (channel.readyState === 'open') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Realtime interview connection timed out.')), 15_000);
    channel.addEventListener(
      'open',
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    channel.addEventListener(
      'error',
      () => {
        window.clearTimeout(timeout);
        reject(new Error('Realtime interview data channel failed.'));
      },
      { once: true },
    );
  });
};

export const startSessionRealtimeInterview = async ({
  workerUrl,
  sessionSlug,
  instructions,
  audioElement,
  onStatus = () => {},
  onRecordingState = () => {},
  onTranscript = () => {},
  fetchImpl = fetch,
  mediaDevices = navigator.mediaDevices,
  createPeerConnection = () => new RTCPeerConnection(),
}: StartRealtimeInterviewOptions): Promise<RealtimeInterviewSession> => {
  const baseUrl = trim(workerUrl).replace(/\/+$/, '').replace(/\/ai$/i, '');
  if (!baseUrl) throw new Error('Session Worker URL is unavailable.');
  onStatus('Requesting microphone access…');
  const stream = await mediaDevices.getUserMedia({ audio: true });
  const peer = createPeerConnection();
  const turns: RealtimeInterviewTurn[] = [];
  let stopped = false;

  const stopStreamTracks = (value: unknown) => {
    if (!value || typeof value !== 'object' || !('getTracks' in value)) return;
    const getTracks = (value as { getTracks?: () => MediaStreamTrack[] }).getTracks;
    if (typeof getTracks !== 'function') return;
    let tracks: MediaStreamTrack[] = [];
    try {
      tracks = getTracks.call(value);
    } catch {
      return;
    }
    tracks.forEach((track) => {
      try {
        track.enabled = false;
      } catch {}
      try {
        track.stop();
      } catch {}
    });
  };

  peer.ontrack = (event) => {
    audioElement.autoplay = true;
    audioElement.srcObject = event.streams[0] || new MediaStream([event.track]);
    void audioElement.play().catch(() => {});
  };
  stream.getTracks().forEach((track) => peer.addTrack(track, stream));
  const channel = peer.createDataChannel('oai-events');
  const handleMessage = (message: MessageEvent) => {
    if (stopped) return;
    try {
      const event = JSON.parse(String(message.data || ''));
      const turn = readRealtimeResponderTurn(event);
      if (!turn || turns.some((entry) => entry.itemId === turn.itemId)) return;
      turns.push(turn);
      onTranscript(buildRealtimeInterviewTranscript(turns), [...turns]);
    } catch {}
  };
  channel.addEventListener('message', handleMessage);
  const closeRealtimeMedia = () => {
    channel.removeEventListener('message', handleMessage);
    peer.ontrack = null;
    stopStreamTracks(stream);
    try {
      channel.close();
    } catch {}
    try {
      peer.close();
    } catch {}
    try {
      audioElement.pause();
    } catch {}
    stopStreamTracks(audioElement.srcObject);
    audioElement.srcObject = null;
  };

  try {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const sdp = peer.localDescription?.sdp || offer.sdp || '';
    onStatus('Connecting to the interviewer…');
    const response = await fetchImpl(`${baseUrl}/realtime/call?slug=${encodeURIComponent(sessionSlug)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-session-slug': sessionSlug,
      },
      body: JSON.stringify({ sdp, instructions }),
    });
    const answerSdp = await response.text();
    if (!response.ok) {
      let message = 'Could not start the realtime interview.';
      try {
        message = JSON.parse(answerSdp)?.error || message;
      } catch {}
      throw new Error(message);
    }
    await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    await waitForDataChannelOpen(channel);
    channel.send(
      JSON.stringify({
        type: 'response.create',
        response: {
          output_modalities: ['audio'],
          instructions: REALTIME_INTERVIEW_OPENING_INSTRUCTION,
        },
      }),
    );
    onStatus('Interview in progress');
    onRecordingState('recording');
  } catch (error) {
    stopped = true;
    closeRealtimeMedia();
    onRecordingState('stopped');
    throw error;
  }

  const pause = () => {
    if (stopped) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    onStatus('Interview paused');
    onRecordingState('paused');
  };

  const resume = () => {
    if (stopped) return;
    stream.getAudioTracks().forEach((track) => {
      if (track.readyState !== 'ended') track.enabled = true;
    });
    onStatus('Interview in progress');
    onRecordingState('recording');
  };

  const stop = async () => {
    if (!stopped) {
      stopped = true;
      closeRealtimeMedia();
      onStatus('Interview ended');
      onRecordingState('stopped');
    }
    return { transcript: buildRealtimeInterviewTranscript(turns), turns: [...turns] };
  };

  return {
    mediaStream: stream,
    pause,
    resume,
    stop,
    getTranscript: () => buildRealtimeInterviewTranscript(turns),
  };
};
