import {
  executeOwnSingleQuestionResponseBootstrap,
  executeViewedSingleQuestionResponseBootstrap,
  readFreshSingleQuestionCachedResponderResponse,
  writeSingleQuestionResponseToCache,
} from './surveyToolSingleQuestionController';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const applyStateUpdate = (stateRef: { current: Record<string, any> }, update: any) => {
  const patch = typeof update === 'function' ? update(stateRef.current) : update;
  stateRef.current = { ...stateRef.current, ...(patch || {}) };
  return patch;
};

describe('surveyToolSingleQuestionController', () => {
  it('hydrates a viewed response from a fresh persistent cache reread before hash fallback', async () => {
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const latest = {
      responder: responderAddress,
      answer: { value: '*', encrypted: true, encryptedPortion: 'cipher-answer' },
      additional: { value: '', encrypted: false },
    };
    const stateRef = {
      current: {
        parsedViewAddressAnswers: null,
        isLoadingResponse: false,
        noResponse: false,
        responseLookupWarning: '',
        startFresh: false,
        suppressPrefill: false,
      },
    };
    const safeSetState = jest.fn((update) => applyStateUpdate(stateRef, update));
    const getResponseHash = jest.fn();
    const scheduleRetry = jest.fn();

    await expect(executeViewedSingleQuestionResponseBootstrap({
      props: {
        provider: {},
        account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      state: stateRef.current,
      questionId: 'q1',
      responderAddress,
      effectiveSingleSlug: 'edge',
      safeSetState,
      getResponse: jest.fn().mockResolvedValue(null),
      getResponseHash,
      readCachedResponderResponse: jest.fn().mockReturnValue(null),
      readFreshCachedResponderResponse: jest.fn().mockResolvedValue(latest),
      normalizeViewedResponse: jest.fn((value) => value),
      mergeViewedResponse: jest.fn((_prev, next) => next),
      scheduleRetry,
      clearRetry: jest.fn(),
      writeResponseToCache: jest.fn(),
      prefillSingleQuestionResponse: jest.fn(),
    })).resolves.toEqual(expect.objectContaining({
      applied: true,
      reason: 'loaded',
      latest,
    }));

    expect(getResponseHash).not.toHaveBeenCalled();
    expect(scheduleRetry).not.toHaveBeenCalled();
    expect(stateRef.current.noResponse).toBe(false);
    expect(stateRef.current.isLoadingResponse).toBe(false);
    expect(stateRef.current.responseLookupWarning).toBe('');
    expect(stateRef.current.parsedViewAddressAnswers).toEqual(latest);
  });

  it('marks malformed viewed responses as no-response with a warning', async () => {
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const stateRef = {
      current: {
        parsedViewAddressAnswers: null,
        isLoadingResponse: false,
        noResponse: false,
        responseLookupWarning: '',
        startFresh: false,
        suppressPrefill: false,
      },
    };
    const safeSetState = jest.fn((update) => applyStateUpdate(stateRef, update));
    const clearRetry = jest.fn();

    await expect(executeViewedSingleQuestionResponseBootstrap({
      props: {
        provider: {},
        account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      state: stateRef.current,
      questionId: 'q1',
      responderAddress,
      effectiveSingleSlug: 'edge',
      safeSetState,
      getResponse: jest.fn().mockResolvedValue({ answer: { value: 'bad' } }),
      getResponseHash: jest.fn(),
      readCachedResponderResponse: jest.fn().mockReturnValue(null),
      readFreshCachedResponderResponse: jest.fn().mockResolvedValue(null),
      normalizeViewedResponse: jest.fn().mockReturnValue(null),
      mergeViewedResponse: jest.fn((_prev, next) => next),
      scheduleRetry: jest.fn(),
      clearRetry,
      writeResponseToCache: jest.fn(),
      prefillSingleQuestionResponse: jest.fn(),
    })).resolves.toEqual(expect.objectContaining({
      applied: false,
      reason: 'malformed',
    }));

    expect(clearRetry).toHaveBeenCalledTimes(1);
    expect(stateRef.current.noResponse).toBe(true);
    expect(stateRef.current.isLoadingResponse).toBe(false);
    expect(stateRef.current.parsedViewAddressAnswers).toBeNull();
    expect(stateRef.current.responseLookupWarning).toContain(responderAddress);
  });

  it('settles optimistic own single-question submissions only when chain data is consistent', async () => {
    const latest = {
      answer: { value: 'Agree', encrypted: false },
      additional: { value: '', encrypted: false },
    };
    const stateRef = {
      current: {
        submissionComplete: true,
        startFresh: false,
        suppressPrefill: false,
        isLoadingResponse: true,
        userHasResponse: false,
        userResponseEncrypted: false,
        userAnswers: null,
      },
    };
    const safeSetState = jest.fn((update) => applyStateUpdate(stateRef, update));
    const writeResponseToCache = jest.fn();
    const prefillSingleQuestionResponse = jest.fn();

    await expect(executeOwnSingleQuestionResponseBootstrap({
      props: {
        provider: {},
        account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      state: stateRef.current,
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      safeSetState,
      getResponse: jest.fn().mockResolvedValue(latest),
      writeResponseToCache,
      areResponsesConsistent: jest.fn().mockReturnValue(true),
      prefillSingleQuestionResponse,
    })).resolves.toEqual(expect.objectContaining({
      applied: true,
      reason: 'loaded',
      latest,
    }));

    expect(writeResponseToCache).toHaveBeenCalledWith(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      latest
    );
    expect(prefillSingleQuestionResponse).not.toHaveBeenCalled();
    expect(stateRef.current.userHasResponse).toBe(true);
    expect(stateRef.current.userAnswers).toEqual(latest);
    expect(stateRef.current.submissionComplete).toBe(false);
    expect(stateRef.current.isLoadingResponse).toBe(false);
  });

  it('reuses fresh cache entries from alternate network buckets and updates the caller cache reference', async () => {
    const responderAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const freshCache = {
      '84532': {
        questionResponses: {
          q1: {
            [responderAddress]: {
              answer: { value: 'cached', encrypted: false },
            },
          },
        },
      },
    };
    const updateQuestionsCache = jest.fn();

    await expect(readFreshSingleQuestionCachedResponderResponse({
      responder: responderAddress,
      questionId: 'q1',
      netIdStr: '',
      effectiveSingleSlug: 'edge',
      readQuestionsCacheAsync: jest.fn().mockResolvedValue(freshCache),
      ensureQuestionsNet: jest.fn((cache) => cache),
      cloneValue: clone,
      updateQuestionsCache,
    })).resolves.toEqual({
      answer: { value: 'cached', encrypted: false },
    });

    expect(updateQuestionsCache).toHaveBeenCalledWith(freshCache);
  });

  it('does not overwrite newer cached responses with stale writes', async () => {
    const existingCache = {
      '84532': {
        questionResponses: {
          q1: {
            '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': {
              answer: { value: 'newer', encrypted: false },
            },
          },
        },
        questionResponsesMeta: {
          q1: {
            '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': {
              bn: 12,
              txi: 3,
              li: 0,
              ts: 200,
            },
          },
        },
      },
    };
    const writeQuestionsCache = jest.fn();

    const result = await writeSingleQuestionResponseToCache({
      responder: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      respObj: {
        answer: { value: 'older', encrypted: false },
        blockNumber: 11,
        transactionIndex: 0,
        logIndex: 0,
        timestamp: 100,
      },
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      netIdStr: '84532',
      readQuestionsCacheAsync: jest.fn().mockResolvedValue(clone(existingCache)),
      ensureQuestionsNet: jest.fn((cache) => cache),
      writeQuestionsCache,
    });

    expect(writeQuestionsCache).not.toHaveBeenCalled();
    expect(result).toEqual(existingCache);
  });
});
