export type RealtimeInterviewTurn = {
  itemId: string;
  text: string;
  role: 'responder' | 'interviewer';
  startMs?: number;
  endMs?: number;
  fragment?: boolean;
};

export type RealtimeInterviewSession = {
  mediaStream: MediaStream;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<{ transcript: string; turns: RealtimeInterviewTurn[] }>;
  getTranscript: () => string;
  appendInstructions?: (content: string) => boolean;
};

export type RealtimeInterviewRecordingState = 'recording' | 'paused' | 'stopped';

type StartRealtimeInterviewOptions = {
  workerUrl: string;
  sessionSlug: string;
  instructions: string;
  audioElement: HTMLAudioElement;
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
  onError?: (error: Error) => void;
  onRecordingState?: (state: RealtimeInterviewRecordingState) => void;
  onTranscript?: (transcript: string, turns: RealtimeInterviewTurn[]) => void;
  fetchImpl?: typeof fetch;
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
  createPeerConnection?: () => RTCPeerConnection;
};

const trim = (value: unknown) => String(value == null ? '' : value).trim();
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export const REALTIME_INTERVIEW_OPENING_INSTRUCTION =
  'Begin immediately with the opening question specified in your session instructions, or one directly relevant session question. No greeting or preamble. Then listen.';

export const readRealtimeResponderTurn = (event: unknown): RealtimeInterviewTurn | null => {
  const record = asRecord(event);
  if (record.type === 'session.input_transcript.delta') {
    if (typeof record.delta !== 'string' || !record.delta) return null;
    return {
      itemId: trim(record.event_id),
      text: record.delta,
      role: 'responder',
      fragment: true,
      startMs: typeof record.start_ms === 'number' ? record.start_ms : undefined,
      endMs: typeof record.end_ms === 'number' ? record.end_ms : undefined,
    };
  }
  if (record.type !== 'conversation.item.input_audio_transcription.completed' || !trim(record.transcript)) return null;
  return { itemId: trim(record.item_id || record.itemId), text: trim(record.transcript), role: 'responder' };
};

const readRealtimeInterviewerTurn = (event: Record<string, unknown>): RealtimeInterviewTurn | null => {
  if (event.type === 'session.output_transcript.delta') {
    const fragment = readRealtimeResponderTurn({ ...event, type: 'session.input_transcript.delta' });
    return fragment ? { ...fragment, role: 'interviewer' } : null;
  }
  if (!['response.output_audio_transcript.done', 'response.audio_transcript.done'].includes(trim(event.type)))
    return null;
  const text = trim(event.transcript);
  if (!text) return null;
  // Both legacy event names can describe the same completed output. Use content
  // identity, not event identity, so replay never duplicates an interviewer question.
  const itemId = trim(event.item_id || event.response_id || event.event_id);
  return {
    itemId: itemId ? `interviewer:${itemId}:${event.output_index ?? 0}:${event.content_index ?? 0}` : '',
    text,
    role: 'interviewer',
  };
};

const orderConversationTurns = (turns: RealtimeInterviewTurn[], slots: Map<string, string | null>) => {
  const orderedIds: string[] = [];
  const placed = new Set<string>();
  const place = (id: string) => {
    if (placed.has(id)) return;
    placed.add(id);
    const previous = slots.get(id);
    if (previous && slots.has(previous)) place(previous);
    const after = previous ? orderedIds.indexOf(previous) : -1;
    if (previous && after === -1) orderedIds.push(id);
    else orderedIds.splice(after + 1, 0, id);
  };
  // Predecessors can arrive later; rebuild slots independently of transcript
  // completion order. Unknown items retain arrival order after known slots.
  slots.forEach((_previous, id) => place(id));
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  const position = (turn: RealtimeInterviewTurn) => {
    const id = turn.role === 'interviewer' ? turn.itemId.replace(/^interviewer:(.*):[^:]+:[^:]+$/, '$1') : turn.itemId;
    return positions.get(id) ?? Infinity;
  };
  return [...turns].sort((a, b) => position(a) - position(b));
};

export const buildRealtimeInterviewTranscript = (turns: RealtimeInterviewTurn[]): string => {
  const ordered = turns.some((turn) => turn.fragment)
    ? [...turns].sort((a, b) => (a.startMs ?? Infinity) - (b.startMs ?? Infinity))
    : turns;
  const rows: Array<{ role: RealtimeInterviewTurn['role']; text: string; fragment?: boolean }> = [];
  for (const turn of ordered) {
    const previous = rows[rows.length - 1];
    // Preserve exact deltas and speaker boundaries so a short reply retains its question context.
    if (turn.fragment && previous?.fragment && previous.role === turn.role) previous.text += turn.text;
    else rows.push({ role: turn.role, text: turn.text, fragment: turn.fragment });
  }
  return rows
    .filter((row) => row.text.trim())
    .map((row) => `${row.role === 'interviewer' ? 'Interviewer' : 'Responder'}: ${row.text.trim()}`)
    .join('\n');
};

const stopTracks = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => {
    track.onended = null;
    track.onmute = null;
    try {
      track.enabled = false;
    } catch {}
    try {
      track.stop();
    } catch {}
  });
};

// Abort every await, including non-cancellable browser promises; late media grants are stopped separately.
const abortable = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> =>
  new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException('Interview cancelled.', 'AbortError'));
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
  });

const waitFor = (target: EventTarget, event: string, ready: () => boolean, signal: AbortSignal) => {
  if (ready()) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(event, check);
      signal.removeEventListener('abort', abort);
    };
    const check = () => {
      if (ready()) {
        cleanup();
        resolve();
      }
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    target.addEventListener(event, check);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    else check();
  });
};

export const startSessionRealtimeInterview = async ({
  workerUrl,
  sessionSlug,
  instructions,
  audioElement,
  signal,
  onStatus = () => {},
  onError = () => {},
  onRecordingState = () => {},
  onTranscript = () => {},
  fetchImpl = fetch,
  mediaDevices = navigator.mediaDevices,
  createPeerConnection = () => new RTCPeerConnection(),
}: StartRealtimeInterviewOptions): Promise<RealtimeInterviewSession> => {
  const baseUrl = trim(workerUrl).replace(/\/+$/, '').replace(/\/ai$/i, '');
  if (!baseUrl) throw new Error('Session Worker URL is unavailable. Ask the session owner to configure it.');
  if (!mediaDevices?.getUserMedia)
    throw new Error('Microphone access requires HTTPS or localhost and a supported browser.');
  const controller = new AbortController();
  let stream: MediaStream | null = null;
  let microphone: MediaStream;
  let peer: RTCPeerConnection | null = null;
  let channel: RTCDataChannel | null = null;
  let stopped = false;
  let ready = false;
  let live = true;
  let started = false;
  let paused = false;
  const turns: RealtimeInterviewTurn[] = [];
  const conversationSlots = new Map<string, string | null>();
  const orderedTurns = () => (live ? [...turns] : orderConversationTurns(turns, conversationSlots));
  const sessionEvents = new EventTarget();
  const remoteStreams = new Set<MediaStream>();
  const timeout = setTimeout(
    () => controller.abort(new Error('Interview connection timed out. Check your connection and try again.')),
    30_000,
  );
  const externalAbort = () => controller.abort(new DOMException('Interview cancelled.', 'AbortError'));
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timeout);
    signal?.removeEventListener('abort', externalAbort);
    stopTracks(stream);
    if (peer) {
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
    }
    if (channel) {
      channel.removeEventListener('message', handleMessage);
      channel.removeEventListener('close', connectionFailed);
      channel.removeEventListener('error', connectionFailed);
      try {
        channel.close();
      } catch {}
    }
    try {
      peer?.close();
    } catch {}
    try {
      audioElement.pause();
    } catch {}
    remoteStreams.forEach(stopTracks);
    audioElement.srcObject = null;
    onRecordingState('stopped');
  };
  const fail = (error: Error) => {
    if (stopped) return;
    controller.abort(error);
    if (ready) onError(error);
  };
  const connectionFailed = () =>
    fail(
      new Error('Interview connection lost. Generate drafts from the captured transcript or start a new interview.'),
    );
  const handleMessage = (message: MessageEvent) => {
    if (stopped) return;
    let event: Record<string, unknown>;
    try {
      event = asRecord(JSON.parse(String(message.data || '')));
    } catch {
      return;
    }
    if (event.type === 'session.started' || (!live && event.type === 'session.created')) {
      started = true;
      sessionEvents.dispatchEvent(new Event('started'));
    } else if (event.type === 'error' || event.type === 'conversation.item.input_audio_transcription.failed') {
      fail(
        new Error(
          'The voice service could not continue the interview. Try again; contact the session owner if it persists.',
        ),
      );
    } else if (event.type === 'session.closed') {
      connectionFailed();
    } else if (event.type === 'session.delegation.created' && live) {
      const id = asRecord(event.delegation).id;
      if (typeof id === 'string' && channel?.readyState === 'open')
        channel.send(
          JSON.stringify({
            type: 'session.commentary.append',
            delegation_id: id,
            content:
              'This interview only collects responses. No external task was performed. Drafts will be prepared after the responder stops the interview. Continue asking the interview questions.',
          }),
        );
    }
    let changed = false;
    if (
      !live &&
      ['conversation.item.created', 'conversation.item.added', 'input_audio_buffer.committed'].includes(
        trim(event.type),
      )
    ) {
      const id = trim(event.item_id || asRecord(event.item).id);
      const previous = trim(event.previous_item_id) || null;
      if (id && (!conversationSlots.has(id) || conversationSlots.get(id) !== previous)) {
        conversationSlots.delete(id);
        conversationSlots.set(id, previous);
        changed = true;
      }
    }
    const turn = readRealtimeInterviewerTurn(event) || readRealtimeResponderTurn(event);
    if (turn) {
      const existing = turn.itemId ? turns.findIndex((entry) => entry.itemId === turn.itemId) : -1;
      if (existing === -1) {
        turns.push({ ...turn, itemId: turn.itemId || `fragment-${turns.length}` });
        changed = true;
      } else if (!turn.fragment && turns[existing].text !== turn.text) {
        turns[existing] = turn;
        changed = true;
      }
    }
    if (changed) {
      const ordered = orderedTurns();
      onTranscript(buildRealtimeInterviewTranscript(ordered), ordered);
    }
  };
  controller.signal.addEventListener('abort', cleanup, { once: true });
  signal?.addEventListener('abort', externalAbort, { once: true });
  if (signal?.aborted) externalAbort();
  const run = <T>(promise: Promise<T>) => abortable(promise, controller.signal);

  try {
    controller.signal.throwIfAborted();
    onStatus('Connecting — allow microphone access');
    const mediaPromise = mediaDevices.getUserMedia({ audio: true }).then((value) => {
      if (stopped) stopTracks(value);
      else {
        stream = value;
        value.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      return value;
    });
    microphone = await run(mediaPromise);
    peer = createPeerConnection();
    const activePeer = peer;
    peer.ontrack = (event) => {
      const remote = event.streams[0] || new MediaStream([event.track]);
      if (stopped) {
        stopTracks(remote);
        return;
      }
      remoteStreams.add(remote);
      audioElement.autoplay = true;
      audioElement.srcObject = remote;
      void audioElement
        .play()
        .catch(() =>
          fail(new Error('Audio playback was blocked. Allow sound for this site and start the interview again.')),
        );
    };
    peer.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(activePeer.connectionState)) connectionFailed();
    };
    if (!microphone.getAudioTracks().some((track) => track.readyState === 'live'))
      throw new Error('No active microphone was found. Connect a microphone and try again.');
    microphone.getAudioTracks().forEach((track) => {
      track.onended = () => fail(new Error('Microphone disconnected. Reconnect it and start a new interview.'));
      track.onmute = () =>
        fail(new Error('Microphone input was interrupted. Check the microphone and start a new interview.'));
      activePeer.addTrack(track, microphone);
    });
    channel = peer.createDataChannel('oai-events');
    const activeChannel = channel;
    channel.addEventListener('message', handleMessage);
    channel.addEventListener('close', connectionFailed);
    channel.addEventListener('error', connectionFailed);
    const offer = await run(peer.createOffer());
    await run(peer.setLocalDescription(offer));
    await waitFor(
      peer,
      'icegatheringstatechange',
      () => activePeer.iceGatheringState === 'complete',
      controller.signal,
    );
    onStatus('Connecting to the interviewer…');
    const response = await run(
      fetchImpl(`${baseUrl}/realtime/call?slug=${encodeURIComponent(sessionSlug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-session-slug': sessionSlug },
        body: JSON.stringify({ sdp: peer.localDescription?.sdp || offer.sdp || '', instructions }),
        signal: controller.signal,
      }),
    );
    const answerSdp = await run(response.text());
    if (!response.ok) {
      let message = 'Could not connect to the session Worker. Try again or contact the session owner.';
      try {
        const body = JSON.parse(answerSdp);
        if (typeof body.error === 'string') message = body.error;
      } catch {}
      throw new Error(message);
    }
    const protocol = response.headers.get('x-interview-protocol');
    if (protocol !== 'live' && protocol !== 'realtime')
      throw new Error(
        'The session Worker needs an Interview update. Ask the session owner to redeploy the current Worker.',
      );
    live = protocol === 'live';
    await run(peer.setRemoteDescription({ type: 'answer', sdp: answerSdp }));
    await waitFor(channel, 'open', () => activeChannel.readyState === 'open', controller.signal);
    await waitFor(peer, 'connectionstatechange', () => activePeer.connectionState === 'connected', controller.signal);
    await waitFor(sessionEvents, 'started', () => started, controller.signal);
    controller.signal.throwIfAborted();
    if (!microphone.getAudioTracks().some((track) => track.readyState === 'live' && !track.muted))
      throw new Error('Microphone is unavailable. Check its permissions and try again.');
    microphone.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    audioElement.muted = false;
    channel.send(
      JSON.stringify(
        live
          ? {
              type: 'session.instructions.append',
              delegation_id: null,
              content: REALTIME_INTERVIEW_OPENING_INSTRUCTION,
            }
          : {
              type: 'response.create',
              response: { output_modalities: ['audio'], instructions: REALTIME_INTERVIEW_OPENING_INSTRUCTION },
            },
      ),
    );
    clearTimeout(timeout);
    ready = true;
    onStatus('Listening');
    onRecordingState('recording');
  } catch (error) {
    controller.abort(error);
    if (error instanceof DOMException && error.name === 'NotAllowedError')
      throw new Error(
        'Microphone permission was denied. Allow microphone access in your browser settings, then try again.',
      );
    if (error instanceof DOMException && ['NotFoundError', 'NotReadableError'].includes(error.name))
      throw new Error('Microphone is unavailable or in use. Check the device and try again.');
    throw error;
  }

  return {
    mediaStream: microphone,
    pause: () => {
      if (stopped || paused) return;
      paused = true;
      stream?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      audioElement.muted = true;
      onStatus('Paused');
      onRecordingState('paused');
    },
    resume: () => {
      if (stopped || !paused) return;
      if (
        !stream?.getAudioTracks().some((track) => track.readyState === 'live' && !track.muted) ||
        peer?.connectionState !== 'connected' ||
        channel?.readyState !== 'open'
      ) {
        connectionFailed();
        return;
      }
      paused = false;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      audioElement.muted = false;
      onStatus('Listening');
      onRecordingState('recording');
    },
    stop: async () => {
      if (!stopped) {
        // Stop means immediate privacy cleanup, not waiting for final usage or late transcript events.
        try {
          if (live && channel?.readyState === 'open') channel.send(JSON.stringify({ type: 'session.close' }));
        } catch {}
        controller.abort();
      }
      const ordered = orderedTurns();
      return { transcript: buildRealtimeInterviewTranscript(ordered), turns: ordered };
    },
    appendInstructions: (content) => {
      if (stopped || paused || channel?.readyState !== 'open' || !content.trim()) return false;
      try {
        channel.send(
          JSON.stringify(
            live
              ? { type: 'session.instructions.append', delegation_id: null, content: content.slice(0, 450) }
              : {
                  type: 'conversation.item.create',
                  item: {
                    type: 'message',
                    role: 'system',
                    content: [{ type: 'input_text', text: content.slice(0, 450) }],
                  },
                },
          ),
        );
        return true;
      } catch {
        return false;
      }
    },
    getTranscript: () => buildRealtimeInterviewTranscript(orderedTurns()),
  };
};
