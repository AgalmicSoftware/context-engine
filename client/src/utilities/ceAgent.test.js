import { resolvePolisReportSessionSlug } from './ceAgent.js';

describe('ceAgent PolisReport contract', () => {
  it('prefers an explicit params.sessionSlug', () => {
    expect(resolvePolisReportSessionSlug({
      params: { sessionSlug: 'explicit-session' },
      state: { activeSessionSlug: 'active-session' },
    })).toBe('explicit-session');
  });

  it('falls back to the active session slug when params are omitted', () => {
    expect(resolvePolisReportSessionSlug({
      params: {},
      state: { activeSessionSlug: 'active-session' },
    })).toBe('active-session');
  });

  it('does not silently fall back to a legacy fixture slug', () => {
    expect(resolvePolisReportSessionSlug({
      params: {},
      state: { activeSessionSlug: '' },
    })).toBe('');
  });
});
