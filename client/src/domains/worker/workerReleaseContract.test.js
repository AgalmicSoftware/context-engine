/** @jest-environment node */
// Settings shows the AI daily limit only on a Worker that lists this feature,
// so the name here must be the one the Worker sends.
import { FEATURES } from '../../../../workers/sessionCorsWorker/workerCapabilities.js';
import { AI_DAILY_LIMIT_FEATURE } from './workerRelease';

it('names the AI daily limit feature the Session Worker lists', () => {
  expect(FEATURES).toContain(AI_DAILY_LIMIT_FEATURE);
});
