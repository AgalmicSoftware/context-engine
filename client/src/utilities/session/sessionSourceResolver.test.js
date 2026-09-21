import { getDemoSessionMap } from './sessionDemoCompat.js';
import * as sessionWorkerAvailability from './sessionWorkerAvailability.js';
import {
  findDemoSessionByWorkerUrl,
  getAllDemoSessionConfigs,
  getDefaultSessionConfig,
  getDemoSessionConfigForDisplay,
  resolveSessionSlugAlias,
} from './sessionSourceResolver.js';

describe('sessionSourceResolver', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves known aliases and passes unknown slugs through unchanged', () => {
    const general = resolveSessionSlugAlias('general');
    const passthrough = resolveSessionSlugAlias('missing-session-slug');

    expect(general.requestedSessionSlug).toBe('');
    expect(general.sessionSlug).toBe('');
    expect(general.sessionConfig).toBeNull();
    expect(passthrough.requestedSessionSlug).toBe('missing-session-slug');
    expect(passthrough.sessionSlug).toBe('missing-session-slug');
    expect(passthrough.sessionConfig).toBeNull();
  });

  it('returns the normalized default demo session config', () => {
    const config = getDefaultSessionConfig();

    expect(config).toEqual(expect.any(Object));
    expect(config?.slug ?? '').toBe('');
    expect(typeof config?.sessionName).toBe('string');
  });

  it('treats /session/demo as a display alias for the configured primary demo session', () => {
    expect(getDemoSessionConfigForDisplay('demo')).toMatchObject({
      slug: 'demo-sh',
      sessionName: 'Demo Session',
      sessionModeProfile: {
        authority: {
          mode: 'worker_canonical',
        },
      },
    });
  });

  it('exposes the bundled demo-interview-5 Worker config for clean demo links', () => {
    expect(getDemoSessionConfigForDisplay('demo-interview-5')).toMatchObject({
      slug: 'demo-interview-5',
      sessionId: '0xa0dfc46736b8288854ae2c4156877879',
      corsWorkerUrl: 'https://ce-demo-interview-5-c1cde84edac7.agalmic.workers.dev/',
      sessionModeProfile: {
        authority: { mode: 'worker_canonical' },
      },
    });
  });

  it('returns all demo sessions as normalized [key, config] pairs', () => {
    const entries = getAllDemoSessionConfigs();

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBe(Object.keys(getDemoSessionMap()).length);
    expect(entries[0]).toEqual([expect.any(String), expect.anything()]);
  });

  it('finds a demo session by worker URL and returns null for misses', () => {
    const defaultConfig = getDefaultSessionConfig();
    const workerUrl = 'https://demo-general.example';

    jest
      .spyOn(sessionWorkerAvailability, 'getUsableSessionWorkerUrl')
      .mockImplementation(({ slug, sessionConfig } = {}) =>
        (sessionConfig?.slug ?? slug ?? '') === '' ? workerUrl : '',
      );

    expect(findDemoSessionByWorkerUrl(workerUrl)).toEqual(defaultConfig);
    expect(findDemoSessionByWorkerUrl('https://missing-worker.example')).toBeNull();
  });
});
