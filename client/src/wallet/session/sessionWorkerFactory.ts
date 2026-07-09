export const createSessionWorker = (): Worker =>
  new Worker(new URL('./sessionWorker.ts', import.meta.url), { type: 'module' });
