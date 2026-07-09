import { __test__isSessionWizardDevMode } from './sessionWizardConfig';

describe('SessionWizard dev mode detection', () => {
  it('treats missing process globals as non-production', () => {
    expect(__test__isSessionWizardDevMode(undefined)).toBe(true);
  });

  it('disables dev-only persistence in production', () => {
    expect(
      __test__isSessionWizardDevMode({
        env: { NODE_ENV: 'production', PUBLIC_URL: '' },
      }),
    ).toBe(false);
  });
});
