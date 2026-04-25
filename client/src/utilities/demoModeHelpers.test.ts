import { isDemoModeEnabled } from './demoModeHelpers.js';

describe('isDemoModeEnabled', () => {
  it('supports the current structured demo mode shape', () => {
    expect(isDemoModeEnabled({ tools: true })).toBe(true);
    expect(isDemoModeEnabled({ tools: false })).toBe(false);
  });

  it('keeps legacy boolean payload support', () => {
    expect(isDemoModeEnabled(true)).toBe(true);
    expect(isDemoModeEnabled(false)).toBe(false);
  });

  it('ignores removed legacy object flags', () => {
    expect(isDemoModeEnabled({ futureTab: true, votes: true })).toBe(false);
  });
});
