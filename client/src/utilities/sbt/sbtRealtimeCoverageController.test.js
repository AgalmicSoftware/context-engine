jest.mock('../web3/chainGateway.js', () => ({
  __esModule: true,
  normalizeSessionSlug: jest.fn((s) => String(s || '')),
}));

const { createSbtRealtimeCoverageController } = require('./sbtRealtimeCoverageController.js');
const { normalizeSessionSlug } = require('../web3/chainGateway.js');

const createStateHost = () => {
  let state = {
    sbtRealtimeCoverageBySlug: {},
  };
  return {
    getState: () => state,
    setState: jest.fn((updater, cb) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      if (patch && typeof patch === 'object') {
        state = {
          ...state,
          ...patch,
        };
      }
      if (typeof cb === 'function') cb();
    }),
  };
};

describe('createSbtRealtimeCoverageController', () => {
  beforeEach(() => {
    normalizeSessionSlug.mockImplementation((s) => String(s || ''));
  });

  it('sets and clears realtime coverage flags per group', () => {
    const host = createStateHost();
    const controller = createSbtRealtimeCoverageController({ setState: host.setState });

    controller.setSbtRealtimeCoverageForGroup('alpha', true);
    expect(host.getState().sbtRealtimeCoverageBySlug).toEqual({ alpha: true });

    controller.clearSbtRealtimeCoverageForGroup('alpha');
    expect(host.getState().sbtRealtimeCoverageBySlug).toEqual({});
  });

  it('does not rewrite state when the requested coverage value is already current', () => {
    const host = createStateHost();
    const controller = createSbtRealtimeCoverageController({ setState: host.setState });

    controller.setSbtRealtimeCoverageForGroup('alpha', true);
    controller.setSbtRealtimeCoverageForGroup('alpha', true);
    controller.clearSbtRealtimeCoverageForGroup('beta');

    expect(host.setState).toHaveBeenCalledTimes(3);
    expect(host.getState().sbtRealtimeCoverageBySlug).toEqual({ alpha: true });
  });
});
