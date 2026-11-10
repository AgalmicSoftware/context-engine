export const createFidelityOverviewWorker = (): Worker =>
  new Worker(new URL('./fidelityOverview.worker.ts', import.meta.url), { type: 'module' });
