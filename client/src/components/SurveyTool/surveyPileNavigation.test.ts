export {};

describe.each([false, true])('pile navigation with deployment default %s', (defaultEnabled) => {
  afterEach(() => {
    jest.dontMock('../../variables/appConfig.js');
  });

  it('uses only explicit boolean session overrides and otherwise inherits the deployment default', () => {
    jest.doMock('../../variables/appConfig.js', () => ({ DEFAULT_PILE_AUTO_ADVANCE_ENABLED: defaultEnabled }));
    jest.isolateModules(() => {
      const { resolvePileAutoAdvanceEnabled } = require('./surveyPileNavigation');
      expect(resolvePileAutoAdvanceEnabled({ pileAutoAdvanceEnabled: true })).toBe(true);
      expect(resolvePileAutoAdvanceEnabled({ pileAutoAdvanceEnabled: false })).toBe(false);
      for (const config of [undefined, null, {}, { pileAutoAdvanceEnabled: 'false' }, { pileAutoAdvanceEnabled: 0 }]) {
        expect(resolvePileAutoAdvanceEnabled(config)).toBe(defaultEnabled);
      }
    });
  });
});
