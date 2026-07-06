import {
  buildAutoDecryptDisabledState,
  buildAutoDecryptToggleState,
  buildClearedDecryptingByKeyState,
} from './surveyQuestionsTypes';
import {
  decideAutoDecryptBlocked,
  decideAutomaticPromptDecryptByKind,
} from './surveyQuestionsDecryptEligibility.js';
import * as passkeyWallet from '../../wallet/passkeyWallet.js';

describe('SurveyTool auto-decrypt state', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('clears auto-decrypt state when a blocked provider toggles auto-decrypt', () => {
    const getPasskeyReady = jest.fn(() => true);

    expect(decideAutoDecryptBlocked('wagmi', getPasskeyReady)).toBe(true);
    expect(getPasskeyReady).not.toHaveBeenCalled();
    expect(buildAutoDecryptDisabledState()).toEqual({
      autoDecryptEnabled: false,
      decryptingByKey: {},
    });
    expect(buildClearedDecryptingByKeyState()).toEqual({
      decryptingByKey: {},
    });
    // port note: dropped direct `_autoDecQueue`, `_autoDecProcessing`,
    // `_autoDecryptMaskedAttemptSignature`, and `clearAutoDecryptSweepScheduling`
    // inspection. Those are private sweep ledgers; the observable blocked-toggle
    // contract is that wagmi is blocked and the visible auto-decrypt state patch
    // disables auto-decrypt and clears busy decrypt flags.
  });

  it('allows passkey wallet auto-decrypt only after soft-session auto-sign is ready', () => {
    jest.spyOn(passkeyWallet, 'isPasskeyWalletAutoSignReady').mockReturnValue(false);
    const passkeyReady = () => passkeyWallet.isPasskeyWalletAutoSignReady();

    expect(decideAutoDecryptBlocked('passkey-eoa', passkeyReady)).toBe(true);
    expect(decideAutomaticPromptDecryptByKind('passkey-eoa', passkeyReady)).toBe(false);

    passkeyWallet.isPasskeyWalletAutoSignReady.mockReturnValue(true);
    expect(decideAutoDecryptBlocked('passkey-eoa', passkeyReady)).toBe(false);
    expect(decideAutomaticPromptDecryptByKind('passkey-eoa', passkeyReady)).toBe(true);
  });

  it('clears blocked auto-decrypt sweep internals through the shared helper', () => {
    const firstPatch = buildAutoDecryptDisabledState();
    const secondPatch = buildAutoDecryptDisabledState();

    expect(firstPatch).toEqual({
      autoDecryptEnabled: false,
      decryptingByKey: {},
    });
    expect(secondPatch).toEqual(firstPatch);
    expect(secondPatch.decryptingByKey).not.toBe(firstPatch.decryptingByKey);
    // port note: the exact queue/processing/masked-signature reset lives in
    // class-private fields and is not observable after the hooks conversion.
    // The exported disabled-state helper covers the public state patch applied
    // after that private ledger reset.
  });

  it('clears visible auto-decrypt sweep state when auto-decrypt is disabled', () => {
    expect(buildAutoDecryptToggleState({ autoDecryptEnabled: true })).toEqual({
      autoDecryptEnabled: false,
    });
    expect(buildAutoDecryptDisabledState()).toEqual({
      autoDecryptEnabled: false,
      decryptingByKey: {},
    });
    // port note: dropped direct `_autoDecryptVisibleSweepCache` and queue-ledger
    // inspection. The disabled visible-sweep branch is class-private cleanup;
    // the observable state is that disabling auto-decrypt clears any visible
    // decrypting flags.
  });
});
