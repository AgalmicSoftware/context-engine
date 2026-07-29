import { normalizeSessionWizardEndsAt } from './sessionWizardSessionLifecycle';

describe('sessionWizardSessionLifecycle', () => {
  it('normalizes an optional future end time to an ISO timestamp', () => {
    expect(
      normalizeSessionWizardEndsAt('2030-01-02T03:04:00Z', {
        nowMs: Date.parse('2030-01-01T00:00:00Z'),
      }),
    ).toBe('2030-01-02T03:04:00.000Z');
    expect(normalizeSessionWizardEndsAt('', { nowMs: 0 })).toBe('');
  });

  it('rejects invalid or expired end times', () => {
    expect(() => normalizeSessionWizardEndsAt('not-a-date', { nowMs: 0 })).toThrow(
      'Session end time must be a valid date and time.',
    );
    expect(() =>
      normalizeSessionWizardEndsAt('2030-01-01T00:00:00Z', {
        nowMs: Date.parse('2030-01-01T00:00:00Z'),
      }),
    ).toThrow('Session end time must be in the future.');
  });
});
