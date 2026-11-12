import { buildSessionWizardDefaultAllowedOrigins } from './sessionWizardWorkerDefaults';

describe('SessionWizard default allowOrigins', () => {
  it("prepends the current browser origin to the site's own origins", () => {
    expect(buildSessionWizardDefaultAllowedOrigins('http://localhost:3000')).toEqual([
      'http://localhost:3000',
      'https://contextengine.sh',
      'https://www.contextengine.sh',
    ]);
  });

  it("falls back to the site's own origins when the current origin is unavailable", () => {
    expect(buildSessionWizardDefaultAllowedOrigins('')).toEqual([
      'https://contextengine.sh',
      'https://www.contextengine.sh',
    ]);
  });
});
