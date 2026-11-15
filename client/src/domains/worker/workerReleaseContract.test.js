/** @jest-environment node */
// Settings shows the AI daily limit only on a Worker that lists this feature,
// so the name here must be the one the Worker sends.
import { FEATURES } from '../../../../workers/sessionCorsWorker/workerCapabilities.js';
import { WORKERS_AI_FEATURE as WORKER_LISTS } from '../../../../workers/sessionCorsWorker/workerCapabilities.js';
import { AI_DAILY_LIMIT_FEATURE, WORKERS_AI_FEATURE, readWorkerRunsWorkersAi } from './workerRelease';

it('names the AI daily limit feature the Session Worker lists', () => {
  expect(FEATURES).toContain(AI_DAILY_LIMIT_FEATURE);
});

it('names the Workers AI feature the Session Worker lists when it has the AI binding', async () => {
  expect(WORKERS_AI_FEATURE).toBe(WORKER_LISTS);
  const reply = (features) => async () =>
    new Response(JSON.stringify({ type: 'ce_worker_capabilities', version: 1, apiVersion: 1, features }), {
      status: 200,
    });
  await expect(readWorkerRunsWorkersAi('https://ai.example', 'with', reply([WORKERS_AI_FEATURE]))).resolves.toBe(true);
  await expect(readWorkerRunsWorkersAi('https://ai.example', 'without', reply(['worker_groups']))).resolves.toBe(false);
  await expect(readWorkerRunsWorkersAi('', 'none', reply([WORKERS_AI_FEATURE]))).resolves.toBe(false);
});
