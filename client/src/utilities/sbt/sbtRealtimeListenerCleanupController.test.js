jest.mock('../web3/contractScripts.js', () => ({
  __esModule: true,
  normalizeSessionSlug: jest.fn((s) => String(s || '')),
}));

const { createSbtRealtimeListenerCleanupController } = require('./sbtRealtimeListenerCleanupController.js');
const { normalizeSessionSlug } = require('../web3/contractScripts.js');

describe('createSbtRealtimeListenerCleanupController', () => {
  beforeEach(() => {
    normalizeSessionSlug.mockImplementation((s) => String(s || ''));
  });

  it('removes factory and instance listeners while clearing coverage', () => {
    const clearCoverage = jest.fn();
    const contractScripts = {
      removeSBTEventListener: jest.fn(),
      removeSBTInstanceEventsListener: jest.fn(),
    };
    const controller = createSbtRealtimeListenerCleanupController({
      clearCoverage,
      contractScripts,
    });

    controller.removeSbtRealtimeListenersForGroup('alpha');

    expect(clearCoverage).toHaveBeenCalledWith('alpha');
    expect(contractScripts.removeSBTEventListener).toHaveBeenCalledWith('none', 'alpha');
    expect(contractScripts.removeSBTInstanceEventsListener).toHaveBeenCalledWith('none', [], 'alpha');
  });

  it('honors removal flags independently', () => {
    const clearCoverage = jest.fn();
    const contractScripts = {
      removeSBTEventListener: jest.fn(),
      removeSBTInstanceEventsListener: jest.fn(),
    };
    const controller = createSbtRealtimeListenerCleanupController({
      clearCoverage,
      contractScripts,
    });

    controller.removeSbtRealtimeListenersForGroup('alpha', {
      removeFactory: false,
      removeInstance: true,
    });
    controller.removeSbtRealtimeListenersForGroup('beta', {
      removeFactory: true,
      removeInstance: false,
    });

    expect(clearCoverage).toHaveBeenCalledTimes(2);
    expect(contractScripts.removeSBTEventListener).toHaveBeenCalledTimes(1);
    expect(contractScripts.removeSBTEventListener).toHaveBeenCalledWith('none', 'beta');
    expect(contractScripts.removeSBTInstanceEventsListener).toHaveBeenCalledTimes(1);
    expect(contractScripts.removeSBTInstanceEventsListener).toHaveBeenCalledWith('none', [], 'alpha');
  });
});
