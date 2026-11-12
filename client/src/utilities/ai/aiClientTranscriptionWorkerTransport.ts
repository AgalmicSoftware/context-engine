import { GROUP_TRANSCRIPTION_MODEL } from '../../../../shared/aiDefaults.mjs';
import { audioFileExtension } from '../audio/audioFileExtension';
import { normalizeSpeakerTurns, type KnownSpeaker, type SpeakerTranscriptTurn } from '../audio/speakerTranscript';
import { createNamedAudioFile } from './aiClientAudioTranscription';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { shouldFallbackToAuthenticatedFlow } from '../worker/workerAuthFallbackPolicy.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';

type UnknownRecord = Record<string, unknown>;

export type TranscriptionWorkerConfig = {
  provider?: unknown;
  model?: unknown;
  apiKey?: unknown;
  rpcUrl?: unknown;
};

export type TranscriptionWorkerTransport = {
  endpoint: string;
  baseUrl: string;
  sessionSlug?: unknown;
  sessionConfig?: unknown;
  context?: unknown;
  transcriptionCfg?: TranscriptionWorkerConfig;
};

export type TranscriptionUploadOptions = {
  fileName?: string;
  onJsonParseError?: (error: unknown) => void;
  signal?: AbortSignal;
  // Group labels only: voices from earlier chunks, so the model gives them the same names.
  knownSpeakers?: KnownSpeaker[];
  // false for uploads nobody asked for just now: a refusal fails the upload instead of asking to sign in.
  prompt?: boolean;
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};

const stringValue = (value: unknown): string => (typeof value === 'string' ? value : '');

export const resolveTranscriptionWorkerEndpoint = (corsWorkerUrl: unknown): { endpoint: string; baseUrl: string } => {
  const workerUrl = String(corsWorkerUrl || '');
  return {
    endpoint: workerUrl.endsWith('/transcribe') ? workerUrl : `${workerUrl.replace(/\/+$/, '')}/transcribe`,
    baseUrl: workerUrl.replace(/\/+$/, '').replace(/\/transcribe$/i, ''),
  };
};

const appendTranscriptionConfig = (form: FormData, transcriptionCfg: TranscriptionWorkerConfig = {}): void => {
  const provider = stringValue(transcriptionCfg.provider);
  const model = stringValue(transcriptionCfg.model);
  const apiKey = stringValue(transcriptionCfg.apiKey);
  const rpcUrl = stringValue(transcriptionCfg.rpcUrl);
  if (provider) form.append('provider', provider);
  if (model) form.append('model', model);
  if (apiKey) form.append('apiKey', apiKey);
  if (rpcUrl) form.append('rpcUrl', rpcUrl);
};

const parseTranscriptionErrorMessage = (data: unknown, status: unknown): string => {
  const record = asRecord(data);
  const error = record.error;
  const errorRecord = asRecord(error);
  return (
    stringValue(error) ||
    stringValue(errorRecord.message) ||
    stringValue(record.message) ||
    `Transcription failed (${status}).`
  );
};

// A labelled 3-minute chunk takes over a minute to answer, and some networks close a connection after 60 quiet
// seconds. A small request on the same connection (HTTP/2 or HTTP/3) keeps it in use while the transcription waits.
const CONNECTION_KEEP_ALIVE_MS = 20_000;

const keepConnectionInUse = (baseUrl: string, signal?: AbortSignal): (() => void) => {
  let request: AbortController | undefined;
  const stop = () => {
    clearInterval(timer);
    request?.abort();
    signal?.removeEventListener('abort', stop);
  };
  const timer = setInterval(() => {
    // One at a time, so a stuck request can't hold the browser's connections. no-store keeps it from its cache.
    request?.abort();
    request = new AbortController();
    fetch(`${baseUrl}/capabilities`, { cache: 'no-store', signal: request.signal }).then(
      // Workers before 0.8.0 count this missing route as a failed login, and have no slow labelled transcription.
      ({ status }) => {
        if (status === 401 || status === 404) stop();
      },
      // Only the traffic matters.
      () => undefined,
    );
  }, CONNECTION_KEEP_ALIVE_MS);
  signal?.addEventListener('abort', stop);
  return stop;
};

export const SIGN_IN_TO_SEND = 'Sign in to send this part: press Retry.';

/** `chunkOnly` refusals (this audio's size or content) leave labels on for the rest of the recording. */
export class SpeakerLabelsUnavailableError extends Error {
  name = 'SpeakerLabelsUnavailableError';
  constructor(
    message: string,
    readonly chunkOnly = false,
  ) {
    super(message);
  }
}

const requestAudioTranscription = async (
  audioFileOrBlob: unknown,
  transport: TranscriptionWorkerTransport,
  { fileName = '', signal, onJsonParseError, knownSpeakers = [], prompt }: TranscriptionUploadOptions = {},
  groupSpeakerLabels = false,
): Promise<UnknownRecord & { text: string }> => {
  const maybeBlob = typeof Blob !== 'undefined' && audioFileOrBlob instanceof Blob ? audioFileOrBlob : null;
  const sourceName = stringValue(asRecord(audioFileOrBlob).name);
  const sourceType = stringValue(asRecord(audioFileOrBlob).type);
  const defaultName = `audio.${audioFileExtension(sourceType)}`;
  const fileLike = maybeBlob
    ? createNamedAudioFile(maybeBlob, fileName || sourceName || defaultName, sourceType || 'audio/wav')
    : audioFileOrBlob;
  const resolvedName = fileName || stringValue(asRecord(fileLike).name) || defaultName;
  const form = new FormData();
  form.append('file', fileLike as Blob, resolvedName);
  appendTranscriptionConfig(form, transport?.transcriptionCfg);
  if (groupSpeakerLabels) {
    form.append('purpose', 'group-conversation');
    form.append('labelSpeakers', 'true');
    // Paired by position; Workers before 0.9.0 drop them.
    for (const { name } of knownSpeakers) form.append('known_speaker_names[]', name);
    for (const { sample } of knownSpeakers) form.append('known_speaker_references[]', sample);
  }

  const stopKeepingConnection = keepConnectionInUse(transport.baseUrl, signal);
  const resp = await fetchWorkerWithAuth(
    transport.endpoint,
    { method: 'POST', body: form, ...(signal ? { signal } : {}) },
    {
      sessionSlug: transport.sessionSlug,
      sessionConfig: transport.sessionConfig,
      context: transport.context,
      workerUrl: transport.baseUrl,
      // Keep open-session dictation anonymous, but let signed-in users authenticate
      // for the session's AI key when its gates reject anonymous access.
      preferAnonymous: true,
      fallbackOnGateUnavailable: true,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
      prompt,
    },
  ).finally(stopKeepingConnection);
  // A refusal that signing in would lift says nothing about labels.
  const signInNeeded =
    prompt === false &&
    (resp.status === 401 ||
      (resp.status === 403 && (await shouldFallbackToAuthenticatedFlow(resp, { fallbackOnGateUnavailable: true }))));
  let data: unknown = {};
  try {
    data = await resp.json();
  } catch (error) {
    if (onJsonParseError) onJsonParseError(error);
    data = {};
  }

  if (!resp.ok) {
    const transient = resp.status === 408 || resp.status === 429 || resp.status >= 500;
    if (signInNeeded) throw Object.assign(new Error(SIGN_IN_TO_SEND), { status: resp.status });
    if (groupSpeakerLabels && !transient && resp.status >= 400 && resp.status < 500) {
      // Only a rejection of this chunk's audio (too large, or a provider error naming the file, which older
      // Workers relay under `details.error`) leaves labels on for later chunks. Anything else, such as a
      // Worker without label support, would refuse every chunk, so labels end for the recording.
      const audioRejected = resp.status === 413 || asRecord(asRecord(asRecord(data).details).error).param === 'file';
      throw audioRejected
        ? new SpeakerLabelsUnavailableError('This chunk was rejected with speaker labels.', true)
        : new SpeakerLabelsUnavailableError('Speaker labels are unavailable for this provider or Worker.');
    }
    throw Object.assign(new Error(parseTranscriptionErrorMessage(data, resp.status)), { status: resp.status });
  }

  // A success without text is a lost reply (a dropped connection, say), not silence: saving it as a transcript
  // would delete the chunk's audio. Released Workers always send text, so this leaves real silence alone.
  const { text } = asRecord(data);
  if (typeof text !== 'string') {
    throw Object.assign(new Error('The transcription reply could not be read.'), { status: 502 });
  }
  return { ...asRecord(data), text };
};

export const uploadAudioForTranscription = async (
  audioFileOrBlob: unknown,
  transport: TranscriptionWorkerTransport,
  options: TranscriptionUploadOptions = {},
): Promise<string> => (await requestAudioTranscription(audioFileOrBlob, transport, options)).text;

export type DiarizedTranscription = {
  text: string;
  segments: SpeakerTranscriptTurn[];
  labelsUnavailableReason?: string;
  // The known speaker samples were refused, so this chunk was labelled without them.
  speakerSamplesRefused?: boolean;
};

export const uploadAudioForDiarizedTranscription = async (
  audioFileOrBlob: unknown,
  transport: TranscriptionWorkerTransport,
  options: TranscriptionUploadOptions = {},
): Promise<DiarizedTranscription> => {
  const config = transport.transcriptionCfg || {};
  if (config.provider && config.provider !== 'openai')
    throw new SpeakerLabelsUnavailableError('Speaker labels require OpenAI transcription.');
  const labelled = {
    ...transport,
    transcriptionCfg: { ...config, provider: 'openai', model: GROUP_TRANSCRIPTION_MODEL },
  };
  let data: UnknownRecord & { text: string };
  let speakerSamplesRefused = false;
  try {
    data = await requestAudioTranscription(audioFileOrBlob, labelled, options, true);
  } catch (error) {
    // Samples are an extra: their refusal must not end labels for the recording, so send this chunk once more
    // without them. A refusal of that request too ends labels as before.
    if (!(error instanceof SpeakerLabelsUnavailableError) || error.chunkOnly || !options.knownSpeakers?.length)
      throw error;
    data = await requestAudioTranscription(audioFileOrBlob, labelled, { ...options, knownSpeakers: [] }, true);
    speakerSamplesRefused = true;
  }
  if (!Array.isArray(data.segments)) {
    return {
      text: data.text,
      segments: [],
      labelsUnavailableReason: 'This Worker returned text without speaker labels.',
    };
  }
  return {
    text: data.text,
    segments: normalizeSpeakerTurns(data.segments),
    ...(speakerSamplesRefused ? { speakerSamplesRefused } : {}),
  };
};
