import { SurveyQuestions } from './SurveyQuestions';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('SurveyQuestions runtime helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('persists SurveyQuestions bookmarks with optimistic cache writes', async () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({ questions: [] });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);

    const subject = new SurveyQuestions({
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    subject.handleBookmarkToggle('q1');
    await Promise.resolve();

    expect(subject.state.bookmarkedQuestions).toEqual(new Set(['q1']));
    expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', {
      questions: ['q1'],
    });
  });

  it('loads SurveyQuestions bookmarks from cache into a normalized string set', async () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({ questions: ['q1', 2] });
    const readSpy = jest.spyOn(cacheScripts, 'readCache');

    const subject = new SurveyQuestions({
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.loadBookmarks();

    expect(readSpy).not.toHaveBeenCalled();
    expect(subject.state.bookmarkedQuestions).toEqual(new Set(['q1', '2']));
  });

  it('coalesces bursty auto-decrypt sweeps into one scheduled pass', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      autoDecryptEnabled: true,
    };
    subject.isAutoDecryptBlocked = jest.fn(() => false);
    subject.shouldUseAnimationFrameForAutoDecryptSweep = jest.fn(() => false);
    subject.maybeAutoDecryptVisibleFields = jest.fn();

    subject.queueAutoDecryptVisibleSweep('a');
    subject.queueAutoDecryptVisibleSweep('b');
    subject.queueAutoDecryptVisibleSweep('c');

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subject.maybeAutoDecryptVisibleFields).toHaveBeenCalledTimes(1);
  });

  it('deduplicates in-flight decrypt tasks keyed to the same field payload', async () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const deferred = createDeferred();
    const runner = jest.fn(() => deferred.promise);

    const first = subject.runDedupedDecryptTask('task-key', runner);
    const second = subject.runDedupedDecryptTask('task-key', runner);
    await Promise.resolve();

    expect(second).toBe(first);
    expect(runner).toHaveBeenCalledTimes(1);

    deferred.resolve(true);
    await first;

    await subject.runDedupedDecryptTask('task-key', runner);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('skips auto-decrypt requeue for unchanged masked payloads after a failed attempt', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const maskedAnswer = {
      value: '*',
      encrypted: true,
      encryptedPortion: 'enc-1',
    };
    const maskedSig = subject.buildAutoDecryptMaskedFieldSignature(maskedAnswer);

    subject.state = {
      ...subject.state,
      autoDecryptEnabled: true,
      submissionError: '',
      showComments: {},
      autoDecryptAttempted: {},
      decryptingByKey: {},
      surveysResponseState: [
        { answers: { q1: maskedAnswer }, additionalComments: {} },
      ],
    };
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1']);
    subject.processAutoDecryptQueue = jest.fn();
    subject._autoDecryptMaskedAttemptSignature = { 'q1:answer': maskedSig };

    subject.maybeAutoDecryptVisibleFields();
    expect(subject._autoDecQueue).toHaveLength(0);
    expect(subject.processAutoDecryptQueue).not.toHaveBeenCalled();

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: {
            q1: {
              ...maskedAnswer,
              encryptedPortion: 'enc-2',
            },
          },
          additionalComments: {},
        },
      ],
    };

    subject.maybeAutoDecryptVisibleFields();
    expect(subject._autoDecQueue).toHaveLength(1);
    expect(subject._autoDecQueue[0]).toMatchObject({ qid: 'q1', field: 'answer' });
    expect(subject.processAutoDecryptQueue).toHaveBeenCalledTimes(1);
  });
});
