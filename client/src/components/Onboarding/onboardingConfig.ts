import { isDemoSessionSlug } from '../../utilities/session/demoSessionSlugs.js';

export const FIRST_VISIT_STORAGE_KEY = 'firstVisit';
export const ONBOARDING_COMPLETE_STORAGE_KEY = 'ce_onboarding_complete';
export const COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY = 'ce:forceColdLoadWelcomeSlides';

// Keep welcome slides active only for direct session entry points; tests/dev can still force the overlay on.
export const COLD_LOAD_ONBOARDING_ENABLED = true;

type OnboardingStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const parseStorageBoolean = (value: unknown): boolean | null => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

export const isSessionColdLoadOnboardingRoute = (pathname: unknown): boolean => {
  const normalizedPathname =
    String(pathname || '')
      .trim()
      .replace(/\/+$/, '') || '/';
  if (normalizedPathname === '/session') return true;
  if (!normalizedPathname.startsWith('/session/')) return false;

  const firstSegment = normalizedPathname.slice('/session/'.length).split('/')[0]?.toLowerCase();
  return firstSegment !== 'new' && isDemoSessionSlug(firstSegment);
};

export const shouldAutoOpenColdLoadOnboarding = (
  storage: Pick<OnboardingStorage, 'getItem'>,
  pathname: unknown = '',
): boolean => {
  const forcedValue = parseStorageBoolean(storage?.getItem?.(COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY));
  if (forcedValue != null) return forcedValue;
  return COLD_LOAD_ONBOARDING_ENABLED && isSessionColdLoadOnboardingRoute(pathname);
};

export const readColdLoadOnboardingState = (storage: OnboardingStorage, pathname: unknown = '') => {
  const firstVisit = storage.getItem(FIRST_VISIT_STORAGE_KEY) == null;
  storage.setItem(FIRST_VISIT_STORAGE_KEY, String(firstVisit));

  return {
    firstVisit,
    shouldStartOnboarding:
      storage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY) == null && shouldAutoOpenColdLoadOnboarding(storage, pathname),
  };
};
