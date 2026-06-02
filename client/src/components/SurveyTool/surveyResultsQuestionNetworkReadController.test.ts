import {
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

  it('keeps empty and missing cached response buckets empty without inventing fallback responses', () => {
    const readQuestionBucket = jest.fn((slug) => (
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
        : null
    ));

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
