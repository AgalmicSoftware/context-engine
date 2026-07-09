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

type SpeechExtractionOptions = {
  thresholdDb?: number;
  frameMs?: number;
  hopMs?: number;
  minSilenceMs?: number;
  minSpeechMs?: number;
  targetHz?: number;
  sizeThresholdBytes?: number;
  crossfadeMs?: number;
};

type AudioRuntimeWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

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

/**
 * Optional client-side speech extraction using a VAD-like RMS threshold.
 * Runtime tunables are supplied by the UI through setVadTrimConfig.
 */
export const extractSpeechAudio = async (
  inputBlob: AudioBlobLike,
  opts: SpeechExtractionOptions = {},
): Promise<File | NamedAudioBlob | null> => {
  try {
    if (!inputBlob || typeof inputBlob.arrayBuffer !== 'function') return null;

    const { thresholdDb, frameMs, hopMs, minSilenceMs, minSpeechMs, targetHz, crossfadeMs } = opts || {};
    if (
      !isFiniteNumber(thresholdDb) ||
      !isFiniteNumber(frameMs) ||
      !isFiniteNumber(hopMs) ||
      !isFiniteNumber(minSilenceMs) ||
      !isFiniteNumber(minSpeechMs) ||
      !isFiniteNumber(targetHz)
    ) {
      return null;
    }

    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) return null;

    const ctx = new AudioContextCtor();
    try {
      const ab = await readBlobAsArrayBuffer(inputBlob);
      const audioBuf = await new Promise<AudioBuffer>((resolve, reject) => {
        const result = ctx.decodeAudioData(ab, resolve, reject);
        if (result && typeof result.then === 'function') result.then(resolve).catch(reject);
      });

      const sr = Math.max(8000, Math.min(192000, audioBuf.sampleRate || 44100));
      const ch = Math.max(1, audioBuf.numberOfChannels || 1);
      const len = audioBuf.length || 0;
      if (!len) return null;

      const mono = new Float32Array(len);
      for (let c = 0; c < ch; c += 1) {
        const d = audioBuf.getChannelData(c);
        for (let i = 0; i < len; i += 1) mono[i] += d[i] / ch;
      }

      const frameSamples = Math.max(1, Math.round((frameMs / 1000) * sr));
      const hopSamples = Math.max(1, Math.round((hopMs / 1000) * sr));
      const minSilenceS = Math.max(0, Math.round((minSilenceMs / 1000) * sr));
      const minSpeechS = Math.max(0, Math.round((minSpeechMs / 1000) * sr));

      const ps = new Float32Array(len + 1);
      for (let i = 1; i <= len; i += 1) {
        const s = mono[i - 1];
        ps[i] = ps[i - 1] + s * s;
      }

      const frameStarts: number[] = [];
      const isSpeech: boolean[] = [];
      for (let start = 0; start + frameSamples <= len; start += hopSamples) {
        const end = start + frameSamples;
        const sumsq = ps[end] - ps[start];
        const rms = Math.sqrt(sumsq / frameSamples);
        const db = 20 * Math.log10(rms + 1e-12);
        frameStarts.push(start);
        isSpeech.push(db > thresholdDb);
      }

      const segments: Array<{ start: number; end: number }> = [];
      let runStart = -1;
      for (let i = 0; i < isSpeech.length; i += 1) {
        const speech = isSpeech[i];
        const start = frameStarts[i];
        const end = start + frameSamples;
        if (speech && runStart < 0) runStart = start;
        const atEnd = i === isSpeech.length - 1;
        if ((speech && atEnd) || (!speech && runStart >= 0)) {
          const segEnd = speech && atEnd ? end : start;
          if (segEnd > runStart) segments.push({ start: runStart, end: segEnd });
          runStart = -1;
        }
      }
      if (!segments.length) return null;

      const merged: Array<{ start: number; end: number }> = [];
      for (const seg of segments) {
        if (!merged.length) {
          merged.push({ ...seg });
          continue;
        }
        const last = merged[merged.length - 1];
        const gap = seg.start - last.end;
        if (gap <= minSilenceS) {
          last.end = Math.max(last.end, seg.end);
        } else {
          merged.push({ ...seg });
        }
      }

      const kept = merged.filter((seg) => seg.end - seg.start >= minSpeechS);
      if (!kept.length) return null;

      let total = 0;
      for (const seg of kept) total += seg.end - seg.start;
      if (!total) return null;

      const trimmed = new Float32Array(total);
      let writeOffset = 0;
      const fadeSamples = isFiniteNumber(crossfadeMs) && crossfadeMs > 0 ? Math.round((crossfadeMs / 1000) * sr) : 0;

      for (let segmentIndex = 0; segmentIndex < kept.length; segmentIndex += 1) {
        const { start, end } = kept[segmentIndex];
        const slice = mono.subarray(start, end);
        trimmed.set(slice, writeOffset);

        if (fadeSamples > 1) {
          if (segmentIndex < kept.length - 1) {
            for (let i = 0; i < fadeSamples && i < slice.length; i += 1) {
              const t = (fadeSamples - i) / fadeSamples;
              trimmed[writeOffset + slice.length - 1 - i] *= t;
            }
          }
          if (segmentIndex > 0) {
            const head = Math.min(fadeSamples, slice.length);
            for (let i = 0; i < head; i += 1) {
              const t = (i + 1) / fadeSamples;
              trimmed[writeOffset + i] *= t;
            }
          }
        }

        writeOffset += slice.length;
      }

      const dsF32 = downsampleMonoFloat32(trimmed, sr, targetHz);
      const pcmI16 = float32ToInt16(dsF32);
      const wavBlob = buildMonoWavBlob(pcmI16, targetHz);
      return createNamedAudioFile(wavBlob, 'speech-only.wav', 'audio/wav');
    } catch (error) {
      audioLog.warn('Audio decode failed during speech extraction:', error);
      return null;
    } finally {
      await closeAudioContext(ctx);
    }
  } catch (error) {
    audioLog.warn('Speech extraction failed:', error);
    return null;
  }
};
