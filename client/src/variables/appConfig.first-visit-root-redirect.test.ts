export {};

const GLOBAL_KEY = 'CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED';
const runtimeGlobals = globalThis as Record<string, unknown>;

const clearGlobal = () => {
  try {
    delete runtimeGlobals[GLOBAL_KEY];
  } catch (_) {}
};

describe('appConfig first-visit root redirect boot defaults', () => {
  beforeEach(() => {
    clearGlobal();
    jest.resetModules();
  });

  afterEach(() => {
    clearGlobal();
    jest.resetModules();
  });

  it('publishes the default first-visit root redirect runtime value when unset', () => {
    jest.isolateModules(() => {
      require('./appConfig.js');
    });

    expect(runtimeGlobals[GLOBAL_KEY]).toBe(true);
  });

  it('preserves an explicit runtime override', () => {
    runtimeGlobals[GLOBAL_KEY] = false;

    jest.isolateModules(() => {
      require('./appConfig.js');
    });

    expect(runtimeGlobals[GLOBAL_KEY]).toBe(false);
  });
});
