describe('terminology', () => {
  const ORIGINAL_MODE = process.env.REACT_APP_TERMINOLOGY_MODE;

  afterEach(() => {
    if (typeof ORIGINAL_MODE === 'undefined') {
      delete process.env.REACT_APP_TERMINOLOGY_MODE;
    } else {
      process.env.REACT_APP_TERMINOLOGY_MODE = ORIGINAL_MODE;
    }
    jest.unmock('../../variables/publicEnv.js');
    jest.resetModules();
  });

  it('defaults to plain mode', () => {
    delete process.env.REACT_APP_TERMINOLOGY_MODE;

    jest.isolateModules(() => {
      const { DICTIONARIES, isCryptoMode, sbtBasePath, sbtsListPath, t } = require('./terminology.js');

      expect(isCryptoMode()).toBe(false);
      expect(t('sbt')).toBe('Group');
      expect(t('sbtLower')).toBe('group');
      expect(t('minted')).toBe('Collected');
      expect(t('walletLower')).toBe('account');
      expect(sbtBasePath()).toBe('/group');
      expect(sbtsListPath()).toBe('/groups');
      expect(DICTIONARIES.crypto.wallet).toBe('Wallet');
    });
  });

  it('switches to crypto mode when requested', () => {
    process.env.REACT_APP_TERMINOLOGY_MODE = 'crypto';

    jest.isolateModules(() => {
      const { isCryptoMode, sbtBasePath, sbtsListPath, t } = require('./terminology.js');

      expect(isCryptoMode()).toBe(true);
      expect(t('sbt')).toBe('SBT');
      expect(t('sbtLower')).toBe('SBT');
      expect(t('sbtsLower')).toBe('SBTs');
      expect(t('gateLower')).toBe('gate');
      expect(t('gate')).toBe('Gate');
      expect(sbtBasePath()).toBe('/sbt');
      expect(sbtsListPath()).toBe('/sbts');
    });
  });

  it('reads terminology mode once at module init', () => {
    const readPublicEnv = jest.fn(() => 'crypto');

    jest.isolateModules(() => {
      jest.doMock('../../variables/publicEnv.js', () => ({
        readPublicEnv,
      }));

      const { isCryptoMode, sbtBasePath, sbtsListPath, t } = require('./terminology.js');

      expect(readPublicEnv).toHaveBeenCalledTimes(1);
      expect(isCryptoMode()).toBe(true);
      expect(t('sbt')).toBe('SBT');
      expect(t('gate')).toBe('Gate');
      expect(sbtBasePath()).toBe('/sbt');
      expect(sbtsListPath()).toBe('/sbts');
      expect(readPublicEnv).toHaveBeenCalledTimes(1);
    });
  });
});
