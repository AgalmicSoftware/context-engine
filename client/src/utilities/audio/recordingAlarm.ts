/**
 * @file recordingAlarm.ts: a recorder left on a table calls for help when it stops: three short tones, and a buzz
 * where the phone allows one. The sound needs an audio context started by a tap, so Record primes it.
 */
type AudioContextConstructor = typeof AudioContext;

let context: AudioContext | null = null;

const audioContextConstructor = (): AudioContextConstructor | null =>
  typeof window === 'undefined'
    ? null
    : window.AudioContext ||
      (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext ||
      null;

/** Call from the tap that starts recording, so the alarm may sound later without one. */
export const primeRecordingAlarm = () => {
  try {
    const Context = audioContextConstructor();
    if (!Context) return;
    context ??= new Context();
    void context.resume?.()?.catch(() => {});
  } catch {
    // No sound then; the stop still shows on screen.
  }
};

export const releaseRecordingAlarm = () => {
  const current = context;
  context = null;
  void current?.close?.()?.catch(() => {});
};

export const soundRecordingAlarm = () => {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
  } catch {
    // Not every device can buzz.
  }
  try {
    primeRecordingAlarm();
    if (!context) return;
    const start = context.currentTime;
    for (let beep = 0; beep < 3; beep += 1) {
      const tone = context.createOscillator();
      const volume = context.createGain();
      tone.frequency.value = 880;
      volume.gain.value = 0.3;
      tone.connect(volume).connect(context.destination);
      tone.start(start + beep * 0.45);
      tone.stop(start + beep * 0.45 + 0.3);
    }
  } catch {
    // The stop still shows on screen.
  }
};
