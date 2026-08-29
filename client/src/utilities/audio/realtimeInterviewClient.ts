export type RealtimeInterviewTurn = {
  itemId: string;
  text: string;
  role: 'responder';
};

export type RealtimeInterviewSession = {
  stop: () => Promise<{ transcript: string; turns: RealtimeInterviewTurn[] }>;
  getTranscript: () => string;
};

type StartRealtimeInterviewOptions = {
  workerUrl: string;
  sessionSlug: string;
  instructions: string;
  audioElement: HTMLAudioElement;
  onStatus?: (status: string) => void;
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
    channel.addEventListener('open', () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
    channel.addEventListener('error', () => {
      window.clearTimeout(timeout);
      reject(new Error('Realtime interview data channel failed.'));
    }, { once: true });
  });
};

export const startSessionRealtimeInterview = async ({
  workerUrl,
  sessionSlug,
  instructions,
  audioElement,
  onStatus = () => {},
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

  peer.ontrack = (event) => {
    audioElement.autoplay = true;
    audioElement.srcObject = event.streams[0] || new MediaStream([event.track]);
    void audioElement.play().catch(() => {});
  };
  stream.getTracks().forEach((track) => peer.addTrack(track, stream));
  const channel = peer.createDataChannel('oai-events');
  channel.addEventListener('message', (message) => {
    try {
      const event = JSON.parse(String(message.data || ''));
      const turn = readRealtimeResponderTurn(event);
      if (!turn || turns.some((entry) => entry.itemId === turn.itemId)) return;
      turns.push(turn);
      onTranscript(buildRealtimeInterviewTranscript(turns), [...turns]);
    } catch {}
  });

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
      try { message = JSON.parse(answerSdp)?.error || message; } catch {}
      throw new Error(message);
    }
    await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    await waitForDataChannelOpen(channel);
    channel.send(JSON.stringify({
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
        instructions: REALTIME_INTERVIEW_OPENING_INSTRUCTION,
      },
    }));
    onStatus('Interview in progress');
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    channel.close();
    peer.close();
    throw error;
  }

  const stop = async () => {
    if (!stopped) {
      stopped = true;
      stream.getTracks().forEach((track) => track.stop());
      channel.close();
      peer.close();
      audioElement.pause();
      audioElement.srcObject = null;
      onStatus('Interview ended');
    }
    return { transcript: buildRealtimeInterviewTranscript(turns), turns: [...turns] };
  };

  return {
    stop,
    getTranscript: () => buildRealtimeInterviewTranscript(turns),
  };
};
