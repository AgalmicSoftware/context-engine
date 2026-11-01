import { normalizeAudioToWav } from '../ai/aiClientAudioTranscription';
import { createRecordingExportWorker } from './createRecordingExportWorker';

/** Decode one part at a time, then feed a single encoder so the MP3 has one continuous stream. */
export async function combineRecordingAudio(audio: Blob[], onProgress: (percent: number) => void = () => {}) {
  if (!audio.length) throw new Error('No saved audio is available to download.');
  const worker = createRecordingExportWorker();
  let startupError = '';
  worker.onerror = () => {
    startupError = 'MP3 export could not start. Try downloading again.';
  };
  const send = (message: { pcm?: ArrayBuffer; finish?: boolean }, transfer: Transferable[] = []) =>
    new Promise<{ audio?: Blob }>((resolve, reject) => {
      if (startupError) {
        reject(new Error(startupError));
        return;
      }
      const timer = setTimeout(() => reject(new Error('MP3 export timed out. Try downloading again.')), 120_000);
      worker.onmessage = ({ data }) => {
        clearTimeout(timer);
        if (data.error) reject(new Error(data.error));
        else resolve(data);
      };
      worker.onerror = () => {
        clearTimeout(timer);
        reject(new Error('MP3 export could not start. Try downloading again.'));
      };
      try {
        worker.postMessage(message, transfer);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  try {
    for (let index = 0; index < audio.length; index++) {
      const wav = await normalizeAudioToWav(audio[index], 44100);
      // Never silently omit an undecodable part and present the result as the whole recording.
      if (!wav) throw new Error('Some audio could not be decoded. You can download the original files below.');
      const pcm = (await wav.arrayBuffer()).slice(44);
      await send({ pcm }, [pcm]);
      onProgress(Math.round(((index + 1) / audio.length) * 100));
    }
    const { audio: mp3 } = await send({ finish: true });
    if (!mp3?.size) throw new Error('The recording contained no audio to export.');
    return mp3;
  } finally {
    worker.terminate();
  }
}
