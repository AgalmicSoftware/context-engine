import {
  decideAutoDecryptBlocked,
  decideAutomaticPromptDecryptByKind,
} from './surveyQuestionsDecryptEligibility.js';

describe('surveyQuestionsDecryptEligibility', () => {
  describe('decideAutoDecryptBlocked', () => {
    it('blocks wagmi without probing passkey readiness', () => {
      const getPasskeyReady = jest.fn(() => true);

      expect(decideAutoDecryptBlocked('wagmi', getPasskeyReady)).toBe(true);
      expect(getPasskeyReady).not.toHaveBeenCalled();
    });

    it('uses passkey readiness for passkey EOA providers', () => {
      const ready = jest.fn(() => true);
      const notReady = jest.fn(() => false);

      expect(decideAutoDecryptBlocked('passkey-eoa', ready)).toBe(false);
      expect(ready).toHaveBeenCalledTimes(1);
      expect(decideAutoDecryptBlocked('passkey-eoa', notReady)).toBe(true);
      expect(notReady).toHaveBeenCalledTimes(1);
    });

    it.each([['web3auth'], [null], [undefined], ['other']])(
      'does not block %p without probing passkey readiness',
      (providerKind) => {
        const getPasskeyReady = jest.fn(() => true);

        expect(decideAutoDecryptBlocked(providerKind, getPasskeyReady)).toBe(false);
        expect(getPasskeyReady).not.toHaveBeenCalled();
      },
    );
  });

  describe('decideAutomaticPromptDecryptByKind', () => {
    it('allows web3auth without probing passkey readiness', () => {
      const getPasskeyReady = jest.fn(() => false);

      expect(decideAutomaticPromptDecryptByKind('web3auth', getPasskeyReady)).toBe(true);
      expect(getPasskeyReady).not.toHaveBeenCalled();
    });

    it('uses passkey readiness for passkey EOA providers', () => {
      const ready = jest.fn(() => true);
      const notReady = jest.fn(() => false);

      expect(decideAutomaticPromptDecryptByKind('passkey-eoa', ready)).toBe(true);
      expect(ready).toHaveBeenCalledTimes(1);
      expect(decideAutomaticPromptDecryptByKind('passkey-eoa', notReady)).toBe(false);
      expect(notReady).toHaveBeenCalledTimes(1);
    });

    it.each([['wagmi'], [null], ['other']])(
      'does not attempt automatic decrypt for %p without probing passkey readiness',
      (providerKind) => {
        const getPasskeyReady = jest.fn(() => true);

        expect(decideAutomaticPromptDecryptByKind(providerKind, getPasskeyReady)).toBe(false);
        expect(getPasskeyReady).not.toHaveBeenCalled();
      },
    );
  });
});
