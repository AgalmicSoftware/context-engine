import {
  runSurveyResultsQuestionNetworkAsyncReadController,
  runSurveyResultsQuestionNetworkReadController,
} from './surveyResultsQuestionNetworkReadController';

describe('surveyResultsQuestionNetworkReadController', () => {
  it('reads scoped question buckets through the injected read port and returns a plain memo result', () => {
    const buckets: Record<string, unknown> = {
      edge: {
        questionsLatestBlock: 41,
        questionResponsesLatestBlock: 42,
        questions: {
          q1: {
            id: 'q1',
            prompt: 'Edge prompt',
            sessionSlug: 'edge',
            type: 'freeform',
          },
          qpending: {
            id: 'qpending',
            prompt: '[encrypted]',
            sessionSlug: 'edge',
            __ceQuestionMetadataPending: true,
          },
        },
        questionResponses: {
          q1: {
            '0xaaa': { answer: { value: 'ready' } },
          },
          qpending: {
            '0xbbb': { answer: { value: 'pending' } },
          },
        },
      },
      alpha: {
        questionsLatestBlock: 37,
        questionResponsesLatestBlock: 38,
        questions: {
          q2: {
            id: 'q2',
            prompt: 'Alpha prompt',
            sessionSlug: 'alpha',
            sessionSlugExplicit: true,
          },
        },
        questionResponses: {
          q2: {
            '0xccc': { answer: { value: true } },
          },
        },
      },
    };
    const readQuestionBucket = jest.fn((slug) => buckets[String(slug)] || {});

    const result = runSurveyResultsQuestionNetworkReadController({
      netIdStr: 84532,
      questionReadSlugs: ['edge', 'alpha'],
      requireAuthoritativeBinding: false,
      viewMode: 'questions',
      ports: {
        readQuestionBucket,
      },
    });

    expect(readQuestionBucket).toHaveBeenCalledWith('edge', '84532');
    expect(readQuestionBucket).toHaveBeenCalledWith('alpha', '84532');
    expect(result.memoHit).toBe(false);
    expect(result.result).toMatchObject({
      questionsLatestBlock: 41,
      questionResponsesLatestBlock: 42,
      questions: {
        q1: expect.objectContaining({ prompt: 'Edge prompt', sessionSlug: 'edge' }),
        q2: expect.objectContaining({ prompt: 'Alpha prompt', sessionSlug: 'alpha' }),
      },
      questionResponses: {
        q1: {
          '0xaaa': { answer: { value: 'ready' } },
        },
        q2: {
          '0xccc': { answer: { value: true } },
        },
      },
    });
    expect(result.result.questions.qpending).toBeUndefined();
    expect(result.result.questionResponses.qpending).toBeUndefined();
    expect(result.memo).toMatchObject({
      netIdStr: '84532',
      requireAuthoritativeBinding: false,
      slugsKey: 'edge|alpha',
      viewMode: 'questions',
    });
  });

  it('reuses memoized scoped results when bucket references are unchanged', () => {
    const edgeBucket = {
      questionsLatestBlock: 5,
      questionResponsesLatestBlock: 6,
      questions: {
        q1: { id: 'q1', prompt: 'Edge prompt', sessionSlug: 'edge' },
      },
      questionResponses: {},
    };
    const first = runSurveyResultsQuestionNetworkReadController({
      netIdStr: '84532',
      questionReadSlugs: ['edge'],
      ports: {
        readQuestionBucket: jest.fn(() => edgeBucket),
      },
      viewMode: 'questions',
    });
    const readQuestionBucket = jest.fn(() => edgeBucket);

    const second = runSurveyResultsQuestionNetworkReadController({
      netIdStr: '84532',
      previousMemo: first.memo,
      questionReadSlugs: ['edge'],
      ports: {
        readQuestionBucket,
      },
      viewMode: 'questions',
    });

    expect(readQuestionBucket).toHaveBeenCalledTimes(1);
    expect(second.memoHit).toBe(true);
    expect(second.result).toBe(first.result);
    expect(second.memo).toBe(first.memo);
  });

  it('normalizes ready cached responses with the scoped read identity args', () => {
    const readQuestionBucket = jest.fn(() => ({
      questionsLatestBlock: 12,
      questionResponsesLatestBlock: 13,
      questions: {
        'Q-Ready': {
          id: 'Q-Ready',
          prompt: 'Ready response question',
          sessionSlug: 'edge',
        },
      },
      questionResponses: {
        'Q-Ready': {
          '0xABC': { answer: { value: 'Cached response' } },
        },
      },
    }));

    const result = runSurveyResultsQuestionNetworkReadController({
      netIdStr: 84532,
      questionReadSlugs: ['edge'],
      ports: {
        readQuestionBucket,
      },
      viewMode: 'questions',
    });

    expect(readQuestionBucket).toHaveBeenCalledWith('edge', '84532');
    expect(result.result.questions).toEqual({
      'q-ready': expect.objectContaining({
        id: 'Q-Ready',
        prompt: 'Ready response question',
        sessionSlug: 'edge',
      }),
    });
    expect(result.result.questionResponses).toEqual({
      'q-ready': {
        '0xABC': { answer: { value: 'Cached response' } },
      },
    });
    expect(result.result.questionResponsesLatestBlock).toBe(13);
  });

  it('falls back to zero for malformed scoped latest-block metadata', () => {
    const readQuestionBucket = jest.fn(() => ({
      questionsLatestBlock: 'not-a-block',
      questionResponsesLatestBlock: Number.POSITIVE_INFINITY,
      questions: {
        q1: {
          id: 'q1',
          prompt: 'Malformed metadata question',
          sessionSlug: 'edge',
        },
      },
      questionResponses: {
        q1: {
          '0xABC': { answer: { value: 'Cached response' } },
        },
      },
    }));

    const result = runSurveyResultsQuestionNetworkReadController({
      netIdStr: 84532,
      questionReadSlugs: ['edge'],
      ports: {
        readQuestionBucket,
      },
      viewMode: 'questions',
    });

    expect(result.result.questionsLatestBlock).toBe(0);
    expect(result.result.questionResponsesLatestBlock).toBe(0);
    expect(result.result.questions.q1).toEqual(
      expect.objectContaining({
        prompt: 'Malformed metadata question',
      }),
    );
    expect(result.result.questionResponses.q1).toEqual({
      '0xABC': { answer: { value: 'Cached response' } },
    });
  });

  it('keeps empty and missing cached response buckets empty without inventing fallback responses', () => {
    const readQuestionBucket = jest.fn((slug) =>
      slug === 'edge'
        ? {
            questionsLatestBlock: 9,
            questionResponsesLatestBlock: 0,
            questions: {
              q1: {
                id: 'q1',
                prompt: 'Question without responses',
                sessionSlug: 'edge',
              },
            },
            questionResponses: {},
          }
        : null,
    );

    const result = runSurveyResultsQuestionNetworkReadController({
      netIdStr: '84532',
      questionReadSlugs: ['edge', 'missing'],
      ports: {
        readQuestionBucket,
      },
      viewMode: 'questions',
    });

    expect(readQuestionBucket).toHaveBeenCalledWith('edge', '84532');
    expect(readQuestionBucket).toHaveBeenCalledWith('missing', '84532');
    expect(result.result.questions).toEqual({
      q1: expect.objectContaining({
        prompt: 'Question without responses',
        sessionSlug: 'edge',
      }),
    });
    expect(result.result.questionResponses).toEqual({});
    expect(result.result.questionResponsesLatestBlock).toBe(0);
  });

  it('does not leak responses for questions outside the scoped question bucket', () => {
    const readQuestionBucket = jest.fn(() => ({
      questionsLatestBlock: 17,
      questionResponsesLatestBlock: 18,
      questions: {
        q1: {
          id: 'q1',
          prompt: 'Scoped prompt',
          sessionSlug: 'edge',
          sessionSlugExplicit: true,
        },
        q2: {
          id: 'q2',
          prompt: 'Out of scope prompt',
          sessionSlug: 'other',
          sessionSlugExplicit: true,
        },
      },
      questionResponses: {
        q1: {
          '0xAAA': { answer: { value: 'kept' } },
        },
        q2: {
          '0xBBB': { answer: { value: 'dropped' } },
        },
      },
    }));

    const result = runSurveyResultsQuestionNetworkReadController({
      netIdStr: 84532,
      questionReadSlugs: ['edge'],
      ports: {
        readQuestionBucket,
      },
      requireAuthoritativeBinding: true,
      viewMode: 'questions',
    });

    expect(result.result.questions).toEqual({
      q1: expect.objectContaining({
        prompt: 'Scoped prompt',
        sessionSlug: 'edge',
      }),
    });
    expect(result.result.questionResponses).toEqual({
      q1: {
        '0xAAA': { answer: { value: 'kept' } },
      },
    });
  });

  it('keeps response-derived live metadata for an authoritative pinned session route', () => {
    const readQuestionBucket = jest.fn(() => ({
      questionsLatestBlock: 23,
      questionResponsesLatestBlock: 24,
      questions: {
        qlive: {
          id: 'qlive',
          prompt: 'Live response-backed prompt',
          sessionSlug: 'demo',
          sessionSlugExplicit: true,
          source: 'response-payload',
          __ceQuestionMetadataFromResponse: true,
        },
        qbucket: {
          id: 'qbucket',
          prompt: 'Bucket-inferred prompt',
          sessionSlug: 'demo',
          sessionSlugExplicit: false,
          source: 'response-payload',
          __ceQuestionMetadataFromResponse: true,
        },
        qforeign: {
          id: 'qforeign',
          prompt: 'Foreign prompt',
          sessionSlug: 'edge',
          sessionSlugExplicit: true,
          source: 'response-payload',
          __ceQuestionMetadataFromResponse: true,
        },
      },
      questionResponses: {
        qlive: {
          '0xAAA': { answer: { value: 'Agree' } },
        },
        qbucket: {
          '0xBBB': { answer: { value: 'Unsure' } },
        },
        qforeign: {
          '0xCCC': { answer: { value: 'Disagree' } },
        },
      },
    }));

    const result = runSurveyResultsQuestionNetworkReadController({
      netIdStr: 11155420,
      questionReadSlugs: ['demo'],
      ports: {
        readQuestionBucket,
      },
      requireAuthoritativeBinding: true,
      viewMode: 'questions',
    });

    expect(result.result.questions).toEqual({
      qlive: expect.objectContaining({
        prompt: 'Live response-backed prompt',
        sessionSlug: 'demo',
        sessionSlugExplicit: true,
      }),
    });
    expect(result.result.questionResponses).toEqual({
      qlive: {
        '0xAAA': { answer: { value: 'Agree' } },
      },
    });
  });

  it('uses the async read port only when the injected peek port misses', async () => {
    const peekBucket = {
      questionsLatestBlock: 20,
      questionResponsesLatestBlock: 21,
      questions: {
        qpeek: {
          id: 'qpeek',
          prompt: 'Peek prompt',
          sessionSlug: 'edge',
        },
      },
      questionResponses: {
        qpeek: {
          '0xaaa': { answer: { value: 'Peek response' } },
        },
      },
    };
    const readBucket = {
      questionsLatestBlock: 30,
      questionResponsesLatestBlock: 31,
      questions: {
        qread: {
          id: 'qread',
          prompt: 'Read prompt',
          sessionSlug: 'fallback',
        },
      },
      questionResponses: {
        qread: {
          '0xbbb': { answer: { value: 'Read response' } },
        },
      },
    };
    const peekQuestionBucket = jest.fn((slug) => (slug === 'edge' ? peekBucket : {}));
    const readQuestionBucket = jest.fn((slug) => (slug === 'fallback' ? readBucket : null));

    const result = await runSurveyResultsQuestionNetworkAsyncReadController({
      netIdStr: 84532,
      questionReadSlugs: ['edge', 'fallback'],
      ports: {
        peekQuestionBucket,
        readQuestionBucket,
      },
      requireAuthoritativeBinding: false,
    });

    expect(peekQuestionBucket).toHaveBeenCalledWith('edge', '84532');
    expect(peekQuestionBucket).toHaveBeenCalledWith('fallback', '84532');
    expect(readQuestionBucket).toHaveBeenCalledTimes(1);
    expect(readQuestionBucket).toHaveBeenCalledWith('fallback', '84532');
    expect(result.statePatch).toEqual({});
    expect(result.result).toMatchObject({
      questionsLatestBlock: 30,
      questionResponsesLatestBlock: 31,
      questions: {
        qpeek: expect.objectContaining({ prompt: 'Peek prompt', sessionSlug: 'edge' }),
        qread: expect.objectContaining({ prompt: 'Read prompt', sessionSlug: 'fallback' }),
      },
      questionResponses: {
        qpeek: {
          '0xaaa': { answer: { value: 'Peek response' } },
        },
        qread: {
          '0xbbb': { answer: { value: 'Read response' } },
        },
      },
    });
  });

  it('does not call async write, persistence, decrypt, export, fetch, polling, or state ports', async () => {
    const ports = {
      peekQuestionBucket: jest.fn(() => ({})),
      readQuestionBucket: jest.fn(() => ({})),
      writeCache: jest.fn(),
      persistCache: jest.fn(),
      decryptResponses: jest.fn(),
      exportResults: jest.fn(),
      fetchResults: jest.fn(),
      schedulePolling: jest.fn(),
      setState: jest.fn(),
    };

    await runSurveyResultsQuestionNetworkAsyncReadController({
      netIdStr: '84532',
      questionReadSlugs: ['edge'],
      ports,
    });

    expect(ports.peekQuestionBucket).toHaveBeenCalledTimes(1);
    expect(ports.readQuestionBucket).toHaveBeenCalledTimes(1);
    expect(ports.writeCache).not.toHaveBeenCalled();
    expect(ports.persistCache).not.toHaveBeenCalled();
    expect(ports.decryptResponses).not.toHaveBeenCalled();
    expect(ports.exportResults).not.toHaveBeenCalled();
    expect(ports.fetchResults).not.toHaveBeenCalled();
    expect(ports.schedulePolling).not.toHaveBeenCalled();
    expect(ports.setState).not.toHaveBeenCalled();
  });

  it('does not call write, persistence, decrypt, export, fetch, polling, or state ports', () => {
    const ports = {
      readQuestionBucket: jest.fn(() => ({})),
      writeCache: jest.fn(),
      persistCache: jest.fn(),
      decryptResponses: jest.fn(),
      exportResults: jest.fn(),
      fetchResults: jest.fn(),
      schedulePolling: jest.fn(),
      setState: jest.fn(),
    };

    runSurveyResultsQuestionNetworkReadController({
      netIdStr: '84532',
      questionReadSlugs: ['edge'],
      ports,
    });

    expect(ports.readQuestionBucket).toHaveBeenCalledTimes(1);
    expect(ports.writeCache).not.toHaveBeenCalled();
    expect(ports.persistCache).not.toHaveBeenCalled();
    expect(ports.decryptResponses).not.toHaveBeenCalled();
    expect(ports.exportResults).not.toHaveBeenCalled();
    expect(ports.fetchResults).not.toHaveBeenCalled();
    expect(ports.schedulePolling).not.toHaveBeenCalled();
    expect(ports.setState).not.toHaveBeenCalled();
  });
});
