import { buildSessionWizardDefaultAllowedOrigins } from './sessionWizardWorkerDefaults';

describe('SessionWizard default allowOrigins', () => {
  it('prepends the current browser origin for worker initialization', () => {
    const out = buildSessionWizardDefaultAllowedOrigins('https://custom.example');

    expect(out[0]).toBe('https://custom.example');
    expect(out).toEqual(
      expect.arrayContaining([
        'https://contextengine.sh',
        'https://www.contextengine.sh',
        'https://contextengine.xyz',
        'https://www.contextengine.xyz',
        'http://localhost:3000',
        'http://127.0.0.1:3001',
        'http://localhost:7391',
        'http://127.0.0.1:7391',
      ]),
    );
  });

  it('falls back to the stable default origin list when the current origin is unavailable', () => {
    const out = buildSessionWizardDefaultAllowedOrigins('');

    expect(out[0]).toBe('https://contextengine.sh');
    expect(out).toEqual(
      expect.arrayContaining([
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:7391',
        'http://127.0.0.1:7391',
      ]),
    );
  });
});
