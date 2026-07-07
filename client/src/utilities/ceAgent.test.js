import { resolvePolisReportSessionSlug } from './ceAgent.js';

describe('ceAgent PolisReport contract', () => {
  it('prefers an explicit params.sessionSlug', () => {
    expect(
      resolvePolisReportSessionSlug({
        params: { sessionSlug: 'explicit-session' },
        state: { activeSessionSlug: 'active-session' },
      }),
    ).toBe('explicit-session');
  });

  it('falls back to the active session slug when params are omitted', () => {
    expect(
      resolvePolisReportSessionSlug({
        params: {},
        state: { activeSessionSlug: 'active-session' },
      }),
    ).toBe('active-session');
  });

  it('does not silently fall back to a legacy fixture slug', () => {
    expect(
      resolvePolisReportSessionSlug({
        params: {},
        state: { activeSessionSlug: '' },
      }),
    ).toBe('');
  });

  it('does not install the dev agent unless the local flag or query flag is enabled', () => {
    expect(installCeAgent()).toBe(false);
    expect(window.__ceAgent).toBeUndefined();

    window.localStorage.setItem('ce-agent-enabled', '1');

    expect(installCeAgent()).toBe(true);
    expect(window.__ceAgent).toEqual(
      expect.objectContaining({
        getState: expect.any(Function),
        describe: expect.any(Function),
        perform: expect.any(Function),
        run: expect.any(Function),
      }),
    );
    expect(installCeAgent()).toBe(true);
  });

  it('exposes stable contract metadata and malformed-run errors through the installed agent', async () => {
    window.history.pushState({}, '', '/agent?agent=1');

    expect(installCeAgent()).toBe(true);

    const contract = window.__ceAgent.describe();
    expect(contract).toEqual(
      expect.objectContaining({
        version: 1,
        activation: expect.objectContaining({
          route: '/agent',
          queryParam: 'agent=1',
          localStorageKey: 'ce-agent-enabled',
        }),
      }),
    );
    expect(contract.actions.map((action) => action.type)).toEqual([
      'navigate',
      'fill',
      'click',
      'assertVisible',
      'invokeAi',
    ]);

    await expect(window.__ceAgent.run(null)).resolves.toEqual({
      ok: false,
      results: [
        expect.objectContaining({
          ok: false,
          type: 'run',
          error: 'run(actions) expects an array',
        }),
      ],
    });
    await expect(window.__ceAgent.perform({})).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: 'Missing action.type',
      }),
    );
  });
});
