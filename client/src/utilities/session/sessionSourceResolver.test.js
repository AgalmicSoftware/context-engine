import { KNOWN_SESSIONS } from './knownSessionsFile';
import { getDemoSessionMap } from './sessionDemoCompat.js';
import {
  getAllDemoSessionConfigs,
  getDefaultSessionConfig,
  getDemoSessionConfigForDisplay,
} from './sessionSourceResolver.js';

describe('sessionSourceResolver', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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

  it.each(Object.entries(KNOWN_SESSIONS))(
    'exposes the known session %s with its Worker for clean links',
    (slug, entry) => {
      expect(getDemoSessionConfigForDisplay(slug)).toMatchObject({
        slug,
        sessionId: entry.sessionId,
        corsWorkerUrl: entry.worker,
        workerCanonicalCleanRoute: true,
        sessionModeProfile: {
          authority: { mode: 'worker_canonical' },
        },
      });
    },
  );

  it('returns all demo sessions as normalized [key, config] pairs', () => {
    const entries = getAllDemoSessionConfigs();

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBe(Object.keys(getDemoSessionMap()).length);
    expect(entries[0]).toEqual([expect.any(String), expect.anything()]);
  });
});
