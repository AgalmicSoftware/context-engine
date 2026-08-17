import {
  SPEECH_AUDIO_CONSTRAINTS,
  requestPreferredSpeechMicrophone,
  selectLocalComputerMicrophone,
} from './microphoneSelection';

const buildTrack = (label: string) => ({ label, stop: jest.fn() });
const buildStream = (track: ReturnType<typeof buildTrack>) =>
  ({
    getAudioTracks: () => [track],
    getTracks: () => [track],
  }) as unknown as MediaStream;
const buildDevice = (label: string, deviceId: string) =>
  ({ kind: 'audioinput', label, deviceId, groupId: '', toJSON: () => ({}) }) as MediaDeviceInfo;

describe('microphoneSelection', () => {
  it('selects an identifiable local computer microphone instead of a Continuity input', () => {
    expect(
      selectLocalComputerMicrophone([
        buildDevice('iPhone Microphone', 'phone'),
        buildDevice('USB Podcast Microphone', 'usb'),
        buildDevice('MacBook Pro Microphone', 'built-in'),
      ])?.deviceId,
    ).toBe('built-in');
  });

  it('respects a selected non-Continuity microphone without overriding it', async () => {
    const externalTrack = buildTrack('USB Podcast Microphone');
    const externalStream = buildStream(externalTrack);
    const mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(externalStream),
      enumerateDevices: jest.fn().mockResolvedValue([buildDevice('MacBook Pro Microphone', 'built-in')]),
    } as unknown as MediaDevices;

    await expect(requestPreferredSpeechMicrophone(mediaDevices)).resolves.toBe(externalStream);
    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: SPEECH_AUDIO_CONSTRAINTS });
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(mediaDevices.enumerateDevices).not.toHaveBeenCalled();
    expect(externalTrack.stop).not.toHaveBeenCalled();
  });

  it('keeps the authorized Continuity stream if built-in device selection fails', async () => {
    const iphoneTrack = buildTrack('Continuity Microphone (iPhone)');
    const iphoneStream = buildStream(iphoneTrack);
    const mediaDevices = {
      getUserMedia: jest
        .fn()
        .mockResolvedValueOnce(iphoneStream)
        .mockRejectedValueOnce(new DOMException('Device unavailable', 'NotReadableError')),
      enumerateDevices: jest.fn().mockResolvedValue([buildDevice('Built-in Microphone', 'built-in')]),
    } as unknown as MediaDevices;

    await expect(requestPreferredSpeechMicrophone(mediaDevices)).resolves.toBe(iphoneStream);
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(iphoneTrack.stop).not.toHaveBeenCalled();
  });
});
