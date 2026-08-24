import { createLogger } from '../logging.js';

const audioLog = createLogger('ai');

// OpenAI's speech-to-text docs cap each /transcribe file upload at 25 MB.
// We stay below that with a 24 MiB client-side ceiling to leave multipart headroom.
export const TRANSCRIBE_MAX_UPLOAD_BYTES = 24 * 1024 * 1024;
export const TRANSCRIBE_WAV_TARGET_HZ = 16000;
const TRANSCRIBE_CHUNK_HEADROOM_BYTES = 64 * 1024;
const TRANSCRIBE_CHUNK_OVERLAP_MS = 250;

type NamedAudioBlob = Blob & {
  name?: string;
};

type AudioBlobLike = {
  arrayBuffer?: () => Promise<ArrayBuffer>;
  type?: string;
  size?: number;
  name?: string;
};

type DecodedMonoAudio = {
  mono: Float32Array;
  sampleRate: number;
};

type SplitAudioOptions = {
  maxUploadBytes?: number;
  targetHz?: number;
  overlapMs?: number;
};

type AudioRuntimeWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const getAudioContextConstructor = (): typeof AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const runtimeWindow = window as AudioRuntimeWindow;
  return runtimeWindow.AudioContext || runtimeWindow.webkitAudioContext || null;
};

const closeAudioContext = async (ctx: AudioContext): Promise<void> => {
  try {
    await ctx.close();
  } catch {
    // Best-effort cleanup only.
  }
};

const downsampleMonoFloat32 = (input: Float32Array, srcRate: number, targetHz: number): Float32Array => {
  if (!(input instanceof Float32Array)) return new Float32Array();
  if (!Number.isFinite(srcRate) || !Number.isFinite(targetHz) || srcRate <= 0 || targetHz <= 0) {
    return input;
  }
  if (srcRate === targetHz) return input;

  const ratio = srcRate / targetHz;
  const newLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i += 1) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, input.length - 1);
    const frac = pos - left;
    out[i] = input[left] * (1 - frac) + input[right] * frac;
  }
  return out;
};

const float32ToInt16 = (input: Float32Array): Int16Array => {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
};

const writeAsciiToDataView = (view: DataView, offset: number, text: string): void => {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
};

const buildMonoWavBlob = (pcmI16: Int16Array, sampleRate: number): Blob => {
  const dataSize = pcmI16.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAsciiToDataView(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiToDataView(view, 8, 'WAVE');
  writeAsciiToDataView(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAsciiToDataView(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcmI16.length; i += 1) {
    view.setInt16(offset, pcmI16[i], true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

export const createNamedAudioFile = (blob: Blob, name = 'audio.wav', type = 'audio/wav'): File | NamedAudioBlob => {
  try {
    return new File([blob], name, { type });
  } catch {
    const namedBlob = blob as NamedAudioBlob;
    namedBlob.name = name;
    return namedBlob;
  }
};

const readBlobAsArrayBuffer = async (blob: AudioBlobLike): Promise<ArrayBuffer> => {
  if (blob && typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  if (typeof FileReader === 'undefined' || !(blob instanceof Blob)) {
    throw new Error('Blob.arrayBuffer is not supported in this environment');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error('Failed to read audio blob as ArrayBuffer'));
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read audio blob'));
    reader.readAsArrayBuffer(blob);
  });
};

const mixAudioBufferToMono = (audioBuf: AudioBuffer): Float32Array => {
  const channelCount = Math.max(1, audioBuf.numberOfChannels || 1);
  const frameCount = Math.max(0, audioBuf.length || 0);
  const mono = new Float32Array(frameCount);
  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const channelData = audioBuf.getChannelData(channelIndex);
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      mono[frameIndex] += channelData[frameIndex] / channelCount;
    }
  }
  return mono;
};

const decodeAudioToMonoFloat32 = async (
  inputBlob: AudioBlobLike,
  label = 'Audio decode failed',
): Promise<DecodedMonoAudio | null> => {
  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) return null;

  const arrayBuf = await readBlobAsArrayBuffer(inputBlob);
  const ctx = new AudioContextCtor();
  try {
    const audioBuf = await new Promise<AudioBuffer>((resolve, reject) => {
      const result = ctx.decodeAudioData(arrayBuf, resolve, reject);
      if (result && typeof result.then === 'function') result.then(resolve).catch(reject);
    });
    return {
      mono: mixAudioBufferToMono(audioBuf),
      sampleRate: audioBuf.sampleRate || 44100,
    };
  } catch (error) {
    audioLog.warn(label, error);
    return null;
  } finally {
    await closeAudioContext(ctx);
  }
};

export const mergeTranscriptText = (prev: unknown, next: unknown): string => {
  const a = String(prev || '').trim();
  const b = String(next || '').trim();
  if (!a) return b;
  if (!b) return a;

  const tokenize = (s: string): string[] =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const A = tokenize(a);
  const B = tokenize(b);
  let bestK = 0;
  const maxK = Math.min(A.length, B.length);
  for (let k = maxK; k >= 1; k -= 1) {
    let ok = true;
    for (let i = 0; i < k; i += 1) {
      if (A[A.length - k + i] !== B[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      bestK = k;
      break;
    }
  }

  if (bestK > 0) {
    const overlappedChars = B.slice(0, bestK).join(' ').length;
    if (overlappedChars < 8) bestK = 0;
  }

  let bTrimmed = b;
  if (bestK > 0) {
    const re = new RegExp(`^(([\\s\\W]*\\w+[\\s\\W]*){${bestK}})`);
    bTrimmed = b.replace(re, '');
  }

  return `${a}${a && bTrimmed && !/\s$/.test(a) ? ' ' : ''}${bTrimmed}`.trim();
};

export const splitAudioBlobToWavChunks = async (
  inputBlob: AudioBlobLike,
  {
    maxUploadBytes = TRANSCRIBE_MAX_UPLOAD_BYTES,
    targetHz = TRANSCRIBE_WAV_TARGET_HZ,
    overlapMs = TRANSCRIBE_CHUNK_OVERLAP_MS,
  }: SplitAudioOptions = {},
): Promise<Array<File | NamedAudioBlob>> => {
  const decoded = await decodeAudioToMonoFloat32(inputBlob, 'Audio decode failed during chunked transcription:');
  if (!decoded) return [];

  const downsampled = downsampleMonoFloat32(decoded.mono, decoded.sampleRate, targetHz);
  if (!(downsampled instanceof Float32Array) || downsampled.length === 0) return [];

  const safeMaxBytes = Math.max(1024, Math.floor(maxUploadBytes) - TRANSCRIBE_CHUNK_HEADROOM_BYTES);
  const maxSamplesPerChunk = Math.max(1, Math.floor((safeMaxBytes - 44) / 2));
  const overlapSamples = Math.max(
    0,
    Math.min(Math.floor((overlapMs / 1000) * targetHz), Math.floor(maxSamplesPerChunk / 8)),
  );
  const chunks: Array<File | NamedAudioBlob> = [];
  let start = 0;
  let index = 0;

  while (start < downsampled.length) {
    const end = Math.min(downsampled.length, start + maxSamplesPerChunk);
    const slice = downsampled.subarray(start, end);
    const wavBlob = buildMonoWavBlob(float32ToInt16(slice), targetHz);
    const fname = `audio-part-${String(index + 1).padStart(4, '0')}.wav`;
    chunks.push(createNamedAudioFile(wavBlob, fname, 'audio/wav'));
    if (end >= downsampled.length) break;
    start = Math.max(end - overlapSamples, start + 1);
    index += 1;
  }

  return chunks;
};

/**
 * Minimal client-side normalization to mono WAV using Web Audio.
 * Returns a File when possible, else a Blob with .name set.
 */
export const normalizeAudioToWav = async (
  inputBlob: AudioBlobLike,
  targetHz = TRANSCRIBE_WAV_TARGET_HZ,
): Promise<File | NamedAudioBlob | null> => {
  const decoded = await decodeAudioToMonoFloat32(inputBlob, 'Audio decode failed during WAV normalization:');
  if (!decoded) return null;
  const monoF32 = downsampleMonoFloat32(decoded.mono, decoded.sampleRate, targetHz);
  const pcmI16 = float32ToInt16(monoF32);

  const wavBlob = buildMonoWavBlob(pcmI16, targetHz);
  return createNamedAudioFile(wavBlob, 'normalized.wav', 'audio/wav');
};
