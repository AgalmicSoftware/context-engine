export const FIRST_VISIT_STORAGE_KEY = 'firstVisit';
export const ONBOARDING_COMPLETE_STORAGE_KEY = 'ce_onboarding_complete';
export const COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY = 'ce:forceColdLoadWelcomeSlides';

// Leave the intro capability in place, but keep cold-load auto-open disabled by default.
export const COLD_LOAD_ONBOARDING_ENABLED = false;

const parseStorageBoolean = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

export const shouldAutoOpenColdLoadOnboarding = (storage) => {
  const forcedValue = parseStorageBoolean(storage?.getItem?.(COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY));
  if (forcedValue != null) return forcedValue;
  return COLD_LOAD_ONBOARDING_ENABLED;
};

export const readColdLoadOnboardingState = (storage) => {
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
