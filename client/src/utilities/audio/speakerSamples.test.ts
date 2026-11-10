import { cutSpeakerSamples } from './speakerSamples';
import { normalizeAudioToWav } from '../ai/aiClientAudioTranscription';

jest.mock('../ai/aiClientAudioTranscription', () => ({ normalizeAudioToWav: jest.fn() }));

const RATE = 16_000;
// A decoded chunk: 16 kHz mono 16-bit PCM after a 44-byte header, each sample holding its own index.
const decodedChunk = (seconds: number) => {
  const bytes = new Uint8Array(44 + seconds * RATE * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < seconds * RATE; index += 1) view.setInt16(44 + index * 2, index % 30_000, true);
  return { arrayBuffer: async () => bytes.buffer };
};
const readSample = (url: string) => {
  const bytes = Uint8Array.from(atob(url.replace('data:audio/wav;base64,', '')), (char) => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const text = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  return {
    header: [text(0, 4), text(8, 4), text(12, 4), text(36, 4)],
    format: [view.getUint16(20, true), view.getUint16(22, true), view.getUint32(24, true), view.getUint16(34, true)],
    sizes: [view.getUint32(4, true), view.getUint32(40, true)],
    firstSample: view.getInt16(44, true),
    seconds: (bytes.length - 44) / 2 / RATE,
  };
};

beforeEach(() => {
  jest.mocked(normalizeAudioToWav).mockReset();
});

it('cuts about five seconds from the middle of each range as 16 kHz mono WAV', async () => {
  jest.mocked(normalizeAudioToWav).mockResolvedValue(decodedChunk(60) as unknown as File);
  const audio = new Blob(['chunk'], { type: 'audio/webm' });
  const [long, short, brief, late] = await cutSpeakerSamples(audio, [
    { start: 10, end: 22 },
    { start: 30, end: 33 },
    { start: 40, end: 41.5 },
    { start: 58, end: 64 },
  ]);
  expect(normalizeAudioToWav).toHaveBeenCalledTimes(1);
  expect(normalizeAudioToWav).toHaveBeenCalledWith(audio, RATE);
  const sample = readSample(long!);
  expect(sample.header).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
  // PCM, one channel, 16 kHz, 16 bits.
  expect(sample.format).toEqual([1, 1, RATE, 16]);
  expect(sample.sizes).toEqual([36 + 5 * RATE * 2, 5 * RATE * 2]);
  expect(sample.seconds).toBe(5);
  // The middle five seconds of 10–22 s start at 13.5 s.
  expect(sample.firstSample).toBe((13.5 * RATE) % 30_000);
  // A range under five seconds is sampled whole; under two seconds, or past the audio's end, not at all.
  expect(readSample(short!).seconds).toBe(3);
  expect(readSample(short!).firstSample).toBe((30 * RATE) % 30_000);
  expect(brief).toBeNull();
  expect(late).toBeNull();
});

it('returns no samples without decoding when no range is long enough, or when decoding fails', async () => {
  const audio = new Blob(['chunk'], { type: 'audio/webm' });
  await expect(cutSpeakerSamples(audio, [{ start: 0, end: 1 }])).resolves.toEqual([null]);
  expect(normalizeAudioToWav).not.toHaveBeenCalled();
  jest.mocked(normalizeAudioToWav).mockResolvedValue(null);
  await expect(cutSpeakerSamples(audio, [{ start: 0, end: 8 }])).resolves.toEqual([null]);
});
