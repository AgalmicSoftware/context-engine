import { getDemoSessionSlugs, getPrimaryDemoSessionSlug, isDemoSessionSlug } from './demoSessionSlugs.js';

describe('demoSessionSlugs', () => {
  it('normalizes, dedupes, and preserves configured demo session order', () => {
    expect(getDemoSessionSlugs([' Demo-1 ', 'demo-3', 'demo-2', 'demo', 'demo-1', ''])).toEqual([
      'demo-1',
      'demo-3',
      'demo-2',
      'demo',
    ]);
    expect(getPrimaryDemoSessionSlug([' Demo-1 ', 'demo-3', 'demo-2', 'demo'])).toBe('demo-1');
    expect(isDemoSessionSlug('DEMO-1', [' Demo-1 ', 'demo-3', 'demo-2', 'demo'])).toBe(true);
    expect(isDemoSessionSlug('edge', [' Demo-1 ', 'demo-3', 'demo-2', 'demo'])).toBe(false);
  });

  it('falls back to the legacy demo slug when the configured list is empty', () => {
    expect(getPrimaryDemoSessionSlug([])).toBe('demo');
  });
});
