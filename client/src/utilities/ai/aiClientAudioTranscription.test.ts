import { audioBufferToWavParts, decodeAudioAtRate } from './aiClientAudioTranscription';

const RATE = 16_000;
// A decoded buffer whose channels hold `values`, repeated for `seconds`; a function value gives each sample's.
const decoded = (seconds: number, ...values: Array<number | ((index: number) => number)>) =>
  ({
    numberOfChannels: values.length,
    length: seconds * RATE,
    sampleRate: RATE,
    duration: seconds,
    getChannelData: (channel: number) => {
      const value = values[channel];
      const samples = new Float32Array(seconds * RATE);
      return typeof value === 'number' ? samples.fill(value) : samples.map((_, index) => value(index));
    },
  }) as unknown as AudioBuffer;
const bytes = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
const readWav = async (part: Blob) => {
  const view = new DataView(await bytes(part));
  return {
    rate: view.getUint32(24, true),
    channels: view.getUint16(22, true),
    seconds: view.getUint32(40, true) / 2 / RATE,
    firstSample: view.getInt16(44, true),
  };
};

describe('decodeAudioAtRate', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'OfflineAudioContext');
  afterEach(() => {
    if (original) Object.defineProperty(window, 'OfflineAudioContext', original);
    else Reflect.deleteProperty(window, 'OfflineAudioContext');
  });

  it('decodes once in an OfflineAudioContext at the requested rate, which resamples while decoding', async () => {
    const contexts: number[][] = [];
    const audio = decoded(2, 0.5);
    class FakeOfflineAudioContext {
      constructor(...args: number[]) {
        contexts.push(args);
      }
      decodeAudioData = jest.fn(async (bytes: ArrayBuffer) => {
        expect(new TextDecoder().decode(bytes)).toBe('file bytes');
        return audio;
      });
    }
    Object.defineProperty(window, 'OfflineAudioContext', { configurable: true, value: FakeOfflineAudioContext });
    await expect(decodeAudioAtRate(new Blob(['file bytes']), RATE)).resolves.toBe(audio);
    expect(contexts).toEqual([[1, 1, RATE]]);
  });

  it('resolves null when the browser cannot decode the audio or has no OfflineAudioContext', async () => {
    Reflect.deleteProperty(window, 'OfflineAudioContext');
    await expect(decodeAudioAtRate(new Blob(['audio']), RATE)).resolves.toBeNull();
    class RefusingContext {
      decodeAudioData = async () => {
        throw new DOMException('Unable to decode audio data', 'EncodingError');
      };
    }
    Object.defineProperty(window, 'OfflineAudioContext', { configurable: true, value: RefusingContext });
    await expect(decodeAudioAtRate(new Blob(['not audio']), RATE)).resolves.toBeNull();
  });
});

describe('audioBufferToWavParts', () => {
  it('cuts decoded audio into 16-bit mono WAV parts of the given length, the last one shorter', async () => {
    const parts = audioBufferToWavParts(decoded(7 * 60, 0.5), 180);
    expect(await Promise.all(parts.map(readWav))).toEqual(
      [180, 180, 62].map((seconds) => ({ rate: RATE, channels: 1, seconds, firstSample: 0x3fff })),
    );
    expect(parts.map((part) => part.type)).toEqual(['audio/wav', 'audio/wav', 'audio/wav']);
  });

  it('starts each later part a second early, so a word cut at a boundary is whole in one part', async () => {
    // Each sample holds the second it falls in.
    const parts = audioBufferToWavParts(
      decoded(400, (index) => Math.floor(index / RATE) / 1000),
      180,
    );
    const firstSeconds = (await Promise.all(parts.map(readWav))).map(({ firstSample }) =>
      Math.round((firstSample / 0x7fff) * 1000),
    );
    expect(firstSeconds).toEqual([0, 179, 358]);
  });

  it('lets a last second or less ride with the part before it', async () => {
    const parts = audioBufferToWavParts(decoded(359.5, 0.5), 180);
    expect((await Promise.all(parts.map(readWav))).map((part) => part.seconds)).toEqual([180, 180.5]);
    expect(audioBufferToWavParts(decoded(0.5, 0.5), 180)).toHaveLength(1);
  });

  it('mixes the channels of each part into one', async () => {
    const [part] = audioBufferToWavParts(decoded(1, 0.5, -0.25), 180);
    expect(await readWav(part)).toMatchObject({ seconds: 1, firstSample: Math.round(0.125 * 0x7fff - 0.5) });
  });
});
