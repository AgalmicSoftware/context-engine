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
  it('does not auto-open cold-load onboarding by default on first visit', () => {
    const storage = createStorageMock();

    expect(readColdLoadOnboardingState(storage, '/')).toEqual({
      firstVisit: true,
      shouldStartOnboarding: false,
    });
    expect(storage.setItem).toHaveBeenCalledWith(FIRST_VISIT_STORAGE_KEY, 'true');
  });

  it('auto-opens cold-load onboarding by default on direct session links', () => {
    const storage = createStorageMock();

    expect(readColdLoadOnboardingState(storage, '/session/demo')).toEqual({
      firstVisit: true,
      shouldStartOnboarding: true,
    });
  });

  it('auto-opens cold-load onboarding by default on configured demo session links', () => {
    const storage = createStorageMock();

    expect(readColdLoadOnboardingState(storage, '/session/demo-1')).toEqual({
      firstVisit: true,
      shouldStartOnboarding: true,
    });
  });

  it('does not auto-open cold-load onboarding on registry session links', () => {
    const storage = createStorageMock();

    expect(readColdLoadOnboardingState(storage, '/session/e2e-custom-20260623-113657')).toEqual({
      firstVisit: true,
      shouldStartOnboarding: false,
    });
  });

  it('does not auto-open cold-load onboarding on nested registry session links', () => {
    const storage = createStorageMock();

    expect(readColdLoadOnboardingState(storage, '/session/e2e-custom-20260623-113657/questions')).toEqual({
      firstVisit: true,
      shouldStartOnboarding: false,
    });
  });

  it('auto-opens cold-load onboarding on the base session route too', () => {
    const storage = createStorageMock();

    expect(readColdLoadOnboardingState(storage, '/session')).toEqual({
      firstVisit: true,
      shouldStartOnboarding: true,
    });
  });

  it('does not auto-open cold-load onboarding on the session wizard route', () => {
    const storage = createStorageMock();

    expect(readColdLoadOnboardingState(storage, '/session/new')).toEqual({
      firstVisit: true,
      shouldStartOnboarding: false,
    });
  });

  it('does not auto-open cold-load onboarding on nested session wizard routes', () => {
    const storage = createStorageMock();

    expect(readColdLoadOnboardingState(storage, '/session/new/')).toEqual({
      firstVisit: true,
      shouldStartOnboarding: false,
    });
  });

  it('allows explicitly disabling the cold-load onboarding for testing on session links', () => {
    const storage = createStorageMock({
      [COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY]: 'false',
    });

    expect(readColdLoadOnboardingState(storage, '/session/demo')).toEqual({
      firstVisit: true,
      shouldStartOnboarding: false,
    });
  });

  it('allows explicitly forcing the cold-load onboarding on for testing', () => {
    const storage = createStorageMock({
      [COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY]: 'true',
    });

    expect(readColdLoadOnboardingState(storage, '/')).toEqual({
      firstVisit: true,
      shouldStartOnboarding: true,
    });
  });

  it('does not auto-open once onboarding completion has been recorded', () => {
    const storage = createStorageMock({
      [COLD_LOAD_ONBOARDING_OVERRIDE_STORAGE_KEY]: 'true',
      [ONBOARDING_COMPLETE_STORAGE_KEY]: 'true',
    });

    expect(readColdLoadOnboardingState(storage, '/session/demo')).toEqual({
      firstVisit: true,
      shouldStartOnboarding: false,
    });
  });

  it('keeps direct session welcome slides eligible until onboarding is explicitly completed', () => {
    const storage = createStorageMock({
      [FIRST_VISIT_STORAGE_KEY]: 'true',
    });

    expect(readColdLoadOnboardingState(storage, '/session/demo')).toEqual({
      firstVisit: false,
      shouldStartOnboarding: true,
    });
    expect(storage.setItem).toHaveBeenCalledWith(FIRST_VISIT_STORAGE_KEY, 'false');
  });

  it('does not auto-open on non-session routes after first visit has already been recorded', () => {
    const storage = createStorageMock({
      [FIRST_VISIT_STORAGE_KEY]: 'true',
    });

    expect(readColdLoadOnboardingState(storage, '/about')).toEqual({
      firstVisit: false,
      shouldStartOnboarding: false,
    });
  });
});
