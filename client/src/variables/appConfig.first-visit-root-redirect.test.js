const GLOBAL_KEY = 'CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED';

const clearGlobal = () => {
  try {
    delete globalThis[GLOBAL_KEY];
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

    expect(globalThis[GLOBAL_KEY]).toBe(true);
  });

  it('preserves an explicit runtime override', () => {
    globalThis[GLOBAL_KEY] = false;

    jest.isolateModules(() => {
      require('./appConfig.js');
    });

    expect(globalThis[GLOBAL_KEY]).toBe(false);
  });
});
