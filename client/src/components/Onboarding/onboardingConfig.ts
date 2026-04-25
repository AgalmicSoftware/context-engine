export const FIRST_VISIT_STORAGE_KEY = 'firstVisit';
export const ONBOARDING_COMPLETE_STORAGE_KEY = 'ce_onboarding_complete';
export const COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY = 'ce:forceColdLoadWelcomeSlides';

// Leave the intro capability in place, but keep cold-load auto-open disabled by default.
export const COLD_LOAD_ONBOARDING_ENABLED = false;

type OnboardingStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const parseStorageBoolean = (value: unknown): boolean | null => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

export const shouldAutoOpenColdLoadOnboarding = (storage: Pick<OnboardingStorage, 'getItem'>): boolean => {
  const forcedValue = parseStorageBoolean(storage?.getItem?.(COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY));
  if (forcedValue != null) return forcedValue;
  return COLD_LOAD_ONBOARDING_ENABLED;
};

export const readColdLoadOnboardingState = (storage: OnboardingStorage) => {
  const firstVisit = storage.getItem(FIRST_VISIT_STORAGE_KEY) == null;
  storage.setItem(FIRST_VISIT_STORAGE_KEY, String(firstVisit));

  return {
    firstVisit,
    shouldStartOnboarding:
      firstVisit &&
      storage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY) == null &&
      shouldAutoOpenColdLoadOnboarding(storage),
  };
};
