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
});
