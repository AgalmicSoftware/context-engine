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

const syncClassSetState = (subject) => {
  subject.setState = jest.fn((next, cb) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    if (patch && typeof patch === 'object') {
      subject.state = { ...subject.state, ...patch };
    }
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject.setState;
};

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
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
    });

    subject.clearAutoDecryptSweepScheduling = jest.fn();
    subject._autoDecQueue = [{ qid: 'q1', field: 'answer' }];
    subject._autoDecProcessing = true;
    subject._autoDecryptMaskedAttemptSignature = { 'q1:answer': 'masked-sig' };

    subject.resetBlockedAutoDecryptSweepInternals();

    expect(subject._autoDecQueue).toEqual([]);
    expect(subject._autoDecProcessing).toBe(false);
    expect(subject._autoDecryptMaskedAttemptSignature).toEqual({});
    expect(subject.clearAutoDecryptSweepScheduling).toHaveBeenCalledTimes(1);
  });

  it('clears visible auto-decrypt sweep state when auto-decrypt is disabled', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
    });

    subject.clearAutoDecryptSweepScheduling = jest.fn();
    subject._autoDecryptVisibleSweepCache = { idsKey: 'q1' };
    subject._autoDecQueue = [{ qid: 'q1', field: 'answer' }];
    subject._autoDecProcessing = true;
    subject._autoDecryptMaskedAttemptSignature = { 'q1:answer': 'masked-sig' };
    subject.state = {
      ...subject.state,
      autoDecryptEnabled: false,
      submissionError: '',
      surveysResponseState: [{ answers: {}, additionalComments: {} }],
    };
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1']);

    subject.maybeAutoDecryptVisibleFields();

    expect(subject._autoDecryptVisibleSweepCache).toBeNull();
    expect(subject._autoDecQueue).toEqual([]);
    expect(subject._autoDecProcessing).toBe(false);
    expect(subject._autoDecryptMaskedAttemptSignature).toEqual({});
    expect(subject.clearAutoDecryptSweepScheduling).toHaveBeenCalledTimes(1);
  });
});
