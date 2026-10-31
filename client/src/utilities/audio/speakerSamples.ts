import { normalizeAudioToWav } from '../ai/aiClientAudioTranscription';

const SAMPLE_RATE = 16_000;
const WAV_HEADER_BYTES = 44;
// OpenAI takes known speaker samples of 2–10 seconds; about five seconds of one voice is enough to match it.
const SAMPLE_SECONDS = 5;
const MIN_SAMPLE_SECONDS = 2;

/** A 16 kHz mono 16-bit PCM WAV file around `pcm`. */
const wavFile = (pcm: Uint8Array): Uint8Array => {
  const bytes = new Uint8Array(WAV_HEADER_BYTES + pcm.length);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) =>
    [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, pcm.length, true);
  bytes.set(pcm, WAV_HEADER_BYTES);
  return bytes;
};

const wavDataUrl = (bytes: Uint8Array): string => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return `data:audio/wav;base64,${btoa(binary)}`;
};

/**
 * Cuts about five seconds from the middle of each range (in seconds into `audio`) as a WAV data URL, decoding
 * the audio once. A range under two seconds, or one the audio ends before, gets null, as does every range
 * when the browser can't decode the audio.
 */
export async function cutSpeakerSamples(
  audio: Blob,
  ranges: Array<{ start: number; end: number }>,
): Promise<Array<string | null>> {
  const usable = ranges.map(({ start, end }) => end - start >= MIN_SAMPLE_SECONDS);
  const decoded = usable.some(Boolean) ? await normalizeAudioToWav(audio, SAMPLE_RATE) : null;
  if (!decoded) return ranges.map(() => null);
  const pcm = new Uint8Array(await decoded.arrayBuffer()).subarray(WAV_HEADER_BYTES);
  return ranges.map(({ start, end }, index) => {
    if (!usable[index]) return null;
    const seconds = Math.min(SAMPLE_SECONDS, end - start);
    // Whole 16-bit samples only.
    const first = Math.round(((start + end - seconds) / 2) * SAMPLE_RATE) * 2;
    const length = Math.round(seconds * SAMPLE_RATE) * 2;
    return first + length > pcm.length ? null : wavDataUrl(wavFile(pcm.subarray(first, first + length)));
  });
}
