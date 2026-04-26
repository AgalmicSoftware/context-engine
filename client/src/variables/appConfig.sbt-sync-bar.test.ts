export {};

const GLOBAL_KEY = 'CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP';
const runtimeGlobals = globalThis as Record<string, unknown>;

const clearGlobal = () => {
  try {
    delete runtimeGlobals[GLOBAL_KEY];
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

    expect(runtimeGlobals[GLOBAL_KEY]).toBe(50);
  });

  it('preserves an explicit runtime override', () => {
    runtimeGlobals[GLOBAL_KEY] = 75;

    jest.isolateModules(() => {
      require('./appConfig.js');
    });

    expect(runtimeGlobals[GLOBAL_KEY]).toBe(75);
  });
});
