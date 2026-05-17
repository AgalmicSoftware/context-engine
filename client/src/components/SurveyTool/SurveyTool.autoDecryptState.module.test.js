import { SurveyQuestions } from './SurveyQuestions';
import * as portoFunctions from '../../utilities/web3/portoFunctions.js';

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
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
    });

    subject.state = {
      ...subject.state,
      autoDecryptEnabled: true,
      decryptingByKey: { 'q1:answer': true },
    };
    syncClassSetState(subject);
    subject.isAutoDecryptBlocked = jest.fn(() => true);
    subject.clearAutoDecryptSweepScheduling = jest.fn();
    subject._autoDecQueue = [{ qid: 'q1', field: 'answer' }];
    subject._autoDecProcessing = true;
    subject._autoDecryptMaskedAttemptSignature = { 'q1:answer': 'masked-sig' };

    subject.toggleAutoDecrypt();

    expect(subject.state.autoDecryptEnabled).toBe(false);
    expect(subject.state.decryptingByKey).toEqual({});
    expect(subject._autoDecQueue).toEqual([]);
    expect(subject._autoDecProcessing).toBe(false);
    expect(subject._autoDecryptMaskedAttemptSignature).toEqual({});
    expect(subject.clearAutoDecryptSweepScheduling).toHaveBeenCalledTimes(1);
  });

  it('allows Porto auto-decrypt only after session-key auto-sign is ready', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      provider: 'porto_passkey',
    });

    jest.spyOn(portoFunctions, 'isPortoAutoSignReady').mockReturnValue(false);
    expect(subject.isAutoDecryptBlocked()).toBe(true);
    expect(subject.shouldAttemptAutomaticPromptDecrypt()).toBe(false);

    portoFunctions.isPortoAutoSignReady.mockReturnValue(true);
    expect(subject.isAutoDecryptBlocked()).toBe(false);
    expect(subject.shouldAttemptAutomaticPromptDecrypt()).toBe(true);
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
