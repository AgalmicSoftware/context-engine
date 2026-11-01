export const createRecordingExportWorker = () =>
  new Worker(new URL('./recordingMp3.worker.ts', import.meta.url), { type: 'module' });
