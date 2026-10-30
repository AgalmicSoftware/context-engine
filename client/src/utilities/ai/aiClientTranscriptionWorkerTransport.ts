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

export class SpeakerLabelsUnavailableError extends Error {
  name = 'SpeakerLabelsUnavailableError';
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
  const fileLike = maybeBlob
    ? createNamedAudioFile(maybeBlob, fileName || sourceName || 'audio.wav', sourceType || 'audio/wav')
    : audioFileOrBlob;
  const resolvedName = fileName || stringValue(asRecord(fileLike).name) || 'audio.wav';
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
    const record = asRecord(data);
    const code = stringValue(record.reason || record.code || asRecord(record.error).code);
    if (
      groupSpeakerLabels &&
      (resp.status === 413 ||
        [
          'ai_model_not_allowed',
          'model_not_found',
          'unsupported_model',
          'unsupported_response_format',
          'unsupported_provider',
        ].includes(code))
    ) {
      throw new SpeakerLabelsUnavailableError(
        'Speaker labels are unavailable for this provider, Worker, or audio size.',
      );
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
