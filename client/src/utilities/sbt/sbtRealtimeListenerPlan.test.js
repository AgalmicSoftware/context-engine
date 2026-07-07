const { getSbtInstanceListenerPlan } = require('./sbtRealtimeListenerPlan.js');

const createSbtList = (addresses = []) =>
  addresses.reduce((acc, address) => {
    acc[String(address).toLowerCase()] = { sbtAddress: address };
    return acc;
  }, {});

describe('getSbtInstanceListenerPlan', () => {
  it('skips instance listeners when the network ID is missing', () => {
    expect(
      getSbtInstanceListenerPlan({
        networkID: '',
        sbtList: createSbtList(['0xA']),
      }),
    ).toMatchObject({
      addresses: [],
      reason: 'missing-network',
      shouldAttach: false,
      shouldMarkCoverage: false,
    });
  });

  it('marks realtime coverage when the cache has no instance addresses', () => {
    expect(
      getSbtInstanceListenerPlan({
        networkID: '11155420',
        sbtList: {},
      }),
    ).toMatchObject({
      addresses: [],
      reason: 'empty-cache',
      shouldAttach: false,
      shouldMarkCoverage: true,
    });
  });

  it('skips attach when policy disables instance listeners', () => {
    expect(
      getSbtInstanceListenerPlan({
        allowInstanceListeners: false,
        networkID: '11155420',
        sbtList: createSbtList(['0xA']),
      }),
    ).toMatchObject({
      count: 1,
      reason: 'disabled',
      shouldAttach: false,
      shouldMarkCoverage: false,
    });
  });

  it('honors explicit max overrides that disable instance listeners', () => {
    expect(
      getSbtInstanceListenerPlan({
        maxOverridePresent: true,
        maxOverrideValue: '0',
        networkID: '11155420',
        sbtList: createSbtList(['0xA']),
      }),
    ).toMatchObject({
      maxInstanceListeners: 0,
      reason: 'max-disabled',
      shouldAttach: false,
      shouldMarkCoverage: false,
    });
  });

  it('skips attach when cached addresses exceed the configured max', () => {
    expect(
      getSbtInstanceListenerPlan({
        maxOverridePresent: true,
        maxOverrideValue: '1',
        networkID: '11155420',
        sbtList: createSbtList(['0xA', '0xB']),
      }),
    ).toMatchObject({
      count: 2,
      maxInstanceListeners: 1,
      reason: 'too-many',
      shouldAttach: false,
      shouldMarkCoverage: false,
    });
  });

  it('returns the attach plan for an allowed address set', () => {
    expect(
      getSbtInstanceListenerPlan({
        maxOverridePresent: true,
        maxOverrideValue: '2',
        networkID: '11155420',
        sbtList: createSbtList(['0xA', '0xB']),
      }),
    ).toMatchObject({
      addresses: ['0xA', '0xB'],
      count: 2,
      maxInstanceListeners: 2,
      reason: 'attach',
      shouldAttach: true,
      shouldMarkCoverage: true,
    });
  });
});
