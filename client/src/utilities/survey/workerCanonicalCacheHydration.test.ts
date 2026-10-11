import { cloneSessionModePreset } from '../session/sessionModeProfile';
import {
  hydrateWorkerCanonicalQuestionCache,
  hydrateWorkerCanonicalSurveyCache,
} from './workerCanonicalCacheHydration';

const SESSION_ID = `0x${'44'.repeat(16)}`;
const PUBLIC_ACCESS = { gate: 'none', encryption: 'none' };
const CONFIG = {
  slug: 'hydration',
  sessionId: SESSION_ID,
  sessionIdHex: SESSION_ID,
  corsWorkerUrl: 'https://hydration.example/',
  storageProfile: {
    backend: 'cloudflare',
    resources: { questions: 'active', surveys: 'active', responses: 'active' },
    payloadAccessControl: PUBLIC_ACCESS,
  },
  sessionModeProfile: {
    ...cloneSessionModePreset('fast_cheap_cloudflare'),
    preset: 'custom',
    storage: { backend: 'cloudflare', payloadAccessControl: PUBLIC_ACCESS },
    encryption: { mode: 'none' },
  },
};

describe.each([
  ['question', hydrateWorkerCanonicalQuestionCache, 'loadQuestions'],
  ['survey', hydrateWorkerCanonicalSurveyCache, 'loadSurveys'],
] as const)('Worker %s cache hydration', (_label, hydrate, loaderKey) => {
  it('seeds the session cache before yielding to load anything else', async () => {
    const persist = jest.fn(async () => true);
    const onSuccess = jest.fn();
    const hydration = hydrate({
      host: {
        getSessionCfg: () => CONFIG,
        workerCanonicalMetadataHydrationPort: { [loaderKey]: jest.fn(async () => []) },
      },
      sessionSlug: 'hydration',
      sessionConfig: CONFIG,
      persist,
      createPersistenceError: () => new Error('Could not persist'),
      onSuccess,
    });

    // No code chunk sits between the session bootstrap and its first cache write.
    expect(persist).toHaveBeenCalledTimes(1);
    await hydration;
    expect(persist).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledWith(0);
  });
});
