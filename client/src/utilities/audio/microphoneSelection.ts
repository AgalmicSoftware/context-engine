const CONTINUITY_MICROPHONE_PATTERN = /\b(?:iphone|ipad|continuity)\b/i;
const LOCAL_COMPUTER_MICROPHONE_PATTERNS = [
  /\bmacbook\b/i,
  /\bstudio display\b/i,
  /\bbuilt[ -]?in\b/i,
  /\binternal\b/i,
  /\bmicrophone array\b/i,
];

export const SPEECH_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  autoGainControl: true,
  channelCount: { ideal: 1 },
  echoCancellation: true,
  noiseSuppression: true,
};

const readActiveMicrophoneLabel = (stream: MediaStream): string =>
  String(stream.getAudioTracks?.()[0]?.label || '').trim();

const isContinuityMicrophone = (label: string): boolean => CONTINUITY_MICROPHONE_PATTERN.test(label);

const localMicrophoneScore = (label: string): number => {
  const index = LOCAL_COMPUTER_MICROPHONE_PATTERNS.findIndex((pattern) => pattern.test(label));
  return index < 0 ? Number.POSITIVE_INFINITY : index;
};

export const selectLocalComputerMicrophone = (devices: MediaDeviceInfo[]): MediaDeviceInfo | null => {
  const candidates = devices
    .filter((device) => device.kind === 'audioinput' && device.deviceId && !isContinuityMicrophone(device.label))
    .map((device) => ({ device, score: localMicrophoneScore(device.label) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score);
  return candidates[0]?.device || null;
};

export const requestPreferredSpeechMicrophone = async (mediaDevices: MediaDevices): Promise<MediaStream> => {
  const initialStream = await mediaDevices.getUserMedia({ audio: SPEECH_AUDIO_CONSTRAINTS });
  if (!isContinuityMicrophone(readActiveMicrophoneLabel(initialStream)) || !mediaDevices.enumerateDevices) {
    return initialStream;
  }

  try {
    const devices = await mediaDevices.enumerateDevices();
    const localMicrophone = selectLocalComputerMicrophone(devices);
    if (!localMicrophone) return initialStream;

    const replacementStream = await mediaDevices.getUserMedia({
      audio: {
        ...SPEECH_AUDIO_CONSTRAINTS,
        deviceId: { exact: localMicrophone.deviceId },
      },
    });
    // Regression guard: only release the Continuity stream after its replacement
    // succeeds, otherwise a transient device-selection error would lose recording entirely.
    initialStream.getTracks().forEach((track) => track.stop());
    return replacementStream;
  } catch {
    // Device enumeration and exact-device selection are optional enhancements.
    // Preserve the already-authorized stream when either browser operation fails.
    return initialStream;
  }
};
