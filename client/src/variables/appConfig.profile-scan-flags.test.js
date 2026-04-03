const PROFILE_FLAG_KEYS = [
  'CE_USER_PROFILE_SCAN_ALL_SESSIONS',
  'CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS',
  'CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS',
  'CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS',
];

const clearProfileFlags = () => {
  PROFILE_FLAG_KEYS.forEach((key) => {
    try {
      delete globalThis[key];
    } catch (_) {}
  });
};

describe('appConfig profile scan all-session boot defaults', () => {
  beforeEach(() => {
    clearProfileFlags();
    jest.resetModules();
  });

  afterEach(() => {
    clearProfileFlags();
    jest.resetModules();
  });

  it('keeps per-resource defaults when no legacy runtime override exists', () => {
    jest.isolateModules(() => {
      require('./appConfig.js');
    });

    expect(globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS).toBe(false);
    expect(globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS).toBe(false);
    expect(globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS).toBe(false);
    expect(globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS).toBe(false);
  });

  it('propagates explicit legacy all-session runtime override into per-resource scan flags', () => {
    globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS = true;

    jest.isolateModules(() => {
      require('./appConfig.js');
    });

    expect(globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS).toBe(true);
    expect(globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS).toBe(true);
    expect(globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS).toBe(true);
    expect(globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS).toBe(true);
  });

  it('keeps explicit per-resource runtime overrides when legacy runtime override is present', () => {
    globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS = false;
    globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS = true;

    jest.isolateModules(() => {
      require('./appConfig.js');
    });

    expect(globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS).toBe(false);
    expect(globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS).toBe(true);
    expect(globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS).toBe(false);
    expect(globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS).toBe(false);
  });
});
