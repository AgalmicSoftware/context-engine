import {
  captureSessionRecruitmentSource,
  normalizeRecruitmentSource,
  readSessionRecruitmentSource,
} from './sessionRecruitmentSource';

describe('sessionRecruitmentSource', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/session/alpha');
  });

  it('normalizes bounded source tokens and rejects URLs or malformed values', () => {
    expect(normalizeRecruitmentSource('  partner outreach  ')).toBe('partner-outreach');
    expect(normalizeRecruitmentSource('EDDY-2026:badge.alpha')).toBe('EDDY-2026:badge.alpha');
    expect(normalizeRecruitmentSource('https://example.test/path')).toBe('');
    expect(normalizeRecruitmentSource('_partner')).toBe('');
    expect(normalizeRecruitmentSource(`a${'b'.repeat(200)}`)).toHaveLength(128);
  });

  it('captures the first URL source for a session and keeps it stable across navigation', () => {
    expect(captureSessionRecruitmentSource('alpha', '?src=partner-one&mode=interview')).toBe('partner-one');
    window.history.replaceState({}, '', '/session/alpha?src=partner-two');
    expect(captureSessionRecruitmentSource('alpha', window.location.search)).toBe('partner-one');
    expect(readSessionRecruitmentSource('alpha')).toBe('partner-one');
  });

  it('is scoped by session slug and survives reload-style reads without a current src query', () => {
    expect(captureSessionRecruitmentSource('alpha', '?src=alpha-source')).toBe('alpha-source');
    expect(captureSessionRecruitmentSource('beta', '?src=beta-source')).toBe('beta-source');
    window.history.replaceState({}, '', '/session/alpha');
    expect(readSessionRecruitmentSource('alpha')).toBe('alpha-source');
    expect(readSessionRecruitmentSource('beta')).toBe('beta-source');
  });

  it('stores no full URL, search string, hash, or unrelated query fields', () => {
    expect(captureSessionRecruitmentSource('alpha', '?src=partner&agentToken=private#prefill=secret')).toBe('partner');
    const raw = sessionStorage.getItem('ce:session-recruitment-source:v1:alpha') || '';
    expect(raw).toContain('"source":"partner"');
    expect(raw).not.toContain('agentToken');
    expect(raw).not.toContain('prefill');
    expect(raw).not.toContain('/session');
    expect(raw).not.toContain('?');
  });
});
