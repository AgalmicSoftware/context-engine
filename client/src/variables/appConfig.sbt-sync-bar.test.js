const GLOBAL_KEY = 'CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP';

const clearGlobal = () => {
  try {
    delete globalThis[GLOBAL_KEY];
  } catch (_) {}
};

describe('appConfig SBT sync bar research step boot defaults', () => {
  beforeEach(() => {
    clearGlobal();
    jest.resetModules();
  });

  afterEach(() => {
    clearGlobal();
    jest.resetModules();
  });

  it('publishes the default research-step runtime value when unset', () => {
    jest.isolateModules(() => {
      require('./appConfig.js');
    });

    expect(globalThis[GLOBAL_KEY]).toBe(50);
  });

  it('preserves an explicit runtime override', () => {
    globalThis[GLOBAL_KEY] = 75;

    jest.isolateModules(() => {
      require('./appConfig.js');
    });

    expect(globalThis[GLOBAL_KEY]).toBe(75);
  });
});
