import { primeRecordingAlarm, releaseRecordingAlarm, soundRecordingAlarm } from './recordingAlarm';

class FakeAudioContext {
  static made = 0;
  static tones: Array<{ start: number; stop: number }> = [];
  currentTime = 2;
  destination = {};
  resume = jest.fn(async () => {});
  close = jest.fn(async () => {});
  constructor() {
    FakeAudioContext.made += 1;
  }
  createGain() {
    const gain = { gain: { value: 0 }, connect: () => this.destination };
    return gain;
  }
  createOscillator() {
    const tone = { start: 0, stop: 0 };
    FakeAudioContext.tones.push(tone);
    return {
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start: (at: number) => {
        tone.start = at;
      },
      stop: (at: number) => {
        tone.stop = at;
      },
    };
  }
}

describe('the recording alarm', () => {
  const vibrate = jest.fn();
  beforeEach(() => {
    FakeAudioContext.made = 0;
    FakeAudioContext.tones = [];
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    vibrate.mockClear();
  });
  afterEach(() => {
    releaseRecordingAlarm();
    Reflect.deleteProperty(window, 'AudioContext');
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('plays three tones through the context Record primed, and buzzes', () => {
    primeRecordingAlarm();
    soundRecordingAlarm();
    expect(FakeAudioContext.made).toBe(1);
    expect(FakeAudioContext.tones).toEqual([
      { start: 2, stop: 2.3 },
      { start: 2.45, stop: 2.75 },
      { start: 2.9, stop: expect.closeTo(3.2) },
    ]);
    expect(vibrate).toHaveBeenCalled();
  });

  it('stays quiet without breaking where a browser has no sound', () => {
    Reflect.deleteProperty(window, 'AudioContext');
    expect(() => soundRecordingAlarm()).not.toThrow();
    expect(vibrate).toHaveBeenCalled();
  });
});
