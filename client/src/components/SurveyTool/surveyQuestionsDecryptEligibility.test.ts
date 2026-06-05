import {
  decideAutoDecryptBlocked,
  decideAutomaticPromptDecryptByKind,
} from './surveyQuestionsDecryptEligibility.js';

describe('surveyQuestionsDecryptEligibility', () => {
  describe('decideAutoDecryptBlocked', () => {
    it('blocks wagmi without probing porto readiness', () => {
      const getPortoReady = jest.fn(() => true);

      expect(decideAutoDecryptBlocked('wagmi', getPortoReady)).toBe(true);
      expect(getPortoReady).not.toHaveBeenCalled();
    });

    it('uses porto readiness for porto providers', () => {
      const ready = jest.fn(() => true);
      const notReady = jest.fn(() => false);

      expect(decideAutoDecryptBlocked('porto', ready)).toBe(false);
      expect(ready).toHaveBeenCalledTimes(1);
      expect(decideAutoDecryptBlocked('porto', notReady)).toBe(true);
      expect(notReady).toHaveBeenCalledTimes(1);
    });

    it.each([['web3auth'], [null], [undefined], ['other']])(
      'does not block %p without probing porto readiness',
      (providerKind) => {
        const getPortoReady = jest.fn(() => true);

        expect(decideAutoDecryptBlocked(providerKind, getPortoReady)).toBe(false);
        expect(getPortoReady).not.toHaveBeenCalled();
      },
    );
  });

  describe('decideAutomaticPromptDecryptByKind', () => {
    it('allows web3auth without probing porto readiness', () => {
      const getPortoReady = jest.fn(() => false);

      expect(decideAutomaticPromptDecryptByKind('web3auth', getPortoReady)).toBe(true);
      expect(getPortoReady).not.toHaveBeenCalled();
    });

    it('uses porto readiness for porto providers', () => {
      const ready = jest.fn(() => true);
      const notReady = jest.fn(() => false);

      expect(decideAutomaticPromptDecryptByKind('porto', ready)).toBe(true);
      expect(ready).toHaveBeenCalledTimes(1);
      expect(decideAutomaticPromptDecryptByKind('porto', notReady)).toBe(false);
      expect(notReady).toHaveBeenCalledTimes(1);
    });

    it.each([['wagmi'], [null], ['other']])(
      'does not attempt automatic decrypt for %p without probing porto readiness',
      (providerKind) => {
        const getPortoReady = jest.fn(() => true);

        expect(decideAutomaticPromptDecryptByKind(providerKind, getPortoReady)).toBe(false);
        expect(getPortoReady).not.toHaveBeenCalled();
      },
    );
  });
});
