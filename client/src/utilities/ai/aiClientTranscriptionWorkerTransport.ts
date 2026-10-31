import { audioFileExtension } from '../audio/audioFileExtension';
import { normalizeSpeakerTurns, type SpeakerTranscriptTurn } from '../audio/speakerTranscript';
import { createNamedAudioFile } from './aiClientAudioTranscription';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
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
  { fileName = '', signal, onJsonParseError }: TranscriptionUploadOptions = {},
  groupSpeakerLabels = false,
): Promise<UnknownRecord> => {
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
  }

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
    },
  );
  let data: unknown = {};
  try {
    data = await resp.json();
  } catch (error) {
    if (onJsonParseError) onJsonParseError(error);
    data = {};
  }

  if (!resp.ok) {
    const transient = resp.status === 408 || resp.status === 429 || resp.status >= 500;
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

  return asRecord(data);
};

export const uploadAudioForTranscription = async (
  audioFileOrBlob: unknown,
  transport: TranscriptionWorkerTransport,
  options: TranscriptionUploadOptions = {},
): Promise<string> => stringValue((await requestAudioTranscription(audioFileOrBlob, transport, options)).text);

export type DiarizedTranscription = {
  text: string;
  segments: SpeakerTranscriptTurn[];
  labelsUnavailableReason?: string;
};

export const uploadAudioForDiarizedTranscription = async (
  audioFileOrBlob: unknown,
  transport: TranscriptionWorkerTransport,
  options: TranscriptionUploadOptions = {},
): Promise<DiarizedTranscription> => {
  const config = transport.transcriptionCfg || {};
  if (config.provider && config.provider !== 'openai')
    throw new SpeakerLabelsUnavailableError('Speaker labels require OpenAI transcription.');
  const data = await requestAudioTranscription(
    audioFileOrBlob,
    {
      ...transport,
      transcriptionCfg: { ...config, provider: 'openai', model: 'gpt-4o-transcribe-diarize' },
    },
    options,
    true,
  );
  if (!Array.isArray(data.segments)) {
    const reason = 'This Worker returned text without speaker labels.';
    if (typeof data.text === 'string') return { text: data.text, segments: [], labelsUnavailableReason: reason };
    throw new SpeakerLabelsUnavailableError(reason);
  }
  return { text: stringValue(data.text), segments: normalizeSpeakerTurns(data.segments) };
};
