import {
  COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY,
  FIRST_VISIT_STORAGE_KEY,
  ONBOARDING_COMPLETE_STORAGE_KEY,
  readColdLoadOnboardingState,
} from './onboardingConfig.js';

const createStorageMock = (seed: Record<string, string> = {}) => {
  const values: Record<string, string> = { ...seed };
  return {
    getItem: jest.fn((key: string) => (Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null)),
    setItem: jest.fn((key: string, value: string) => {
      values[key] = String(value);
    }),
    values,
  };
};

describe('readColdLoadOnboardingState', () => {
  it('keeps cold-load onboarding disabled by default on first visit', () => {
    const storage = createStorageMock();

    expect(readColdLoadOnboardingState(storage)).toEqual({
      firstVisit: true,
      shouldStartOnboarding: false,
    });
    expect(storage.setItem).toHaveBeenCalledWith(FIRST_VISIT_STORAGE_KEY, 'true');
  });

  it('allows explicitly forcing the cold-load onboarding back on for testing', () => {
    const storage = createStorageMock({
      [COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY]: 'true',
    });

    expect(readColdLoadOnboardingState(storage)).toEqual({
      firstVisit: true,
      shouldStartOnboarding: true,
    });
  });

  it('does not auto-open once onboarding completion has been recorded', () => {
    const storage = createStorageMock({
      [COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY]: 'true',
      [ONBOARDING_COMPLETE_STORAGE_KEY]: 'true',
    });

    expect(readColdLoadOnboardingState(storage)).toEqual({
      firstVisit: true,
      shouldStartOnboarding: false,
    });
  });
});
