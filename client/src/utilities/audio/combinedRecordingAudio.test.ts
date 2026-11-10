import { combineRecordingAudio } from './combinedRecordingAudio';
import { normalizeAudioToWav } from '../ai/aiClientAudioTranscription';
import { createRecordingExportWorker } from './createRecordingExportWorker';

jest.mock('../ai/aiClientAudioTranscription', () => ({ normalizeAudioToWav: jest.fn() }));
jest.mock('./createRecordingExportWorker', () => ({ createRecordingExportWorker: jest.fn() }));

it('passes each decoded part in order to one encoder, flushes once and terminates it', async () => {
  const output = new Blob(['mp3'], { type: 'audio/mpeg' });
  const messages: Array<{ pcm?: ArrayBuffer; finish?: boolean }> = [];
  const worker = {
    onmessage: (_event: { data: unknown }) => {},
    onerror: () => {},
    terminate: jest.fn(),
    postMessage: (data: { pcm?: ArrayBuffer; finish?: boolean }) => {
      messages.push(data);
      queueMicrotask(() => worker.onmessage({ data: data.finish ? { audio: output } : { ready: true } }));
    },
  };
  jest.mocked(createRecordingExportWorker).mockReturnValue(worker as unknown as Worker);
  const first = new Blob(['first']),
    second = new Blob(['second']);
  jest.mocked(normalizeAudioToWav).mockImplementation(
    async (blob) =>
      ({
        arrayBuffer: async () => {
          const bytes = new Uint8Array(46);
          bytes[44] = blob === first ? 1 : 2;
          return bytes.buffer;
        },
      }) as Blob,
  );
  const progress = jest.fn();
  await expect(combineRecordingAudio([first, second], progress)).resolves.toBe(output);
  expect(messages.map((message) => (message.pcm ? new Uint8Array(message.pcm)[0] : 'finish'))).toEqual([
    1,
    2,
    'finish',
  ]);
  expect(progress.mock.calls).toEqual([[50], [100]]);
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

it('refuses an incomplete export when a part cannot decode, preserving the originals for recovery', async () => {
  const worker = { terminate: jest.fn(), postMessage: jest.fn() };
  jest.mocked(createRecordingExportWorker).mockReturnValue(worker as unknown as Worker);
  jest.mocked(normalizeAudioToWav).mockResolvedValue(null);
  await expect(combineRecordingAudio([new Blob(['broken'])])).rejects.toThrow('original files');
  expect(worker.postMessage).not.toHaveBeenCalled();
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

it('does not create an encoder for an empty recording', async () => {
  jest.mocked(createRecordingExportWorker).mockClear();
  await expect(combineRecordingAudio([])).rejects.toThrow('No saved audio');
  expect(createRecordingExportWorker).not.toHaveBeenCalled();
});
