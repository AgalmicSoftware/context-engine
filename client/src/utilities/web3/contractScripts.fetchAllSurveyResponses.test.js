const mockFetchLogsSmartWithProvider = jest.fn();
const mockGetReadProviderForChain = jest.fn();
const mockGetReadProviderForGroup = jest.fn();
const mockSessionReadProvider = { name: 'mock-session-provider' };

jest.mock('../logging.js', () => ({
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
  shouldLog: jest.fn(() => false),
}));

jest.mock('./rpcSmartLogFetch.js', () => {
  const actual = jest.requireActual('./rpcSmartLogFetch.js');
  return {
    ...actual,
    createFetchLogsSmartWithProvider: jest.fn(() => mockFetchLogsSmartWithProvider),
  };
});

jest.mock('./rpcProviders.js', () => {
  const actual = jest.requireActual('./rpcProviders.js');
  return {
    ...actual,
    getReadProviderForChain: mockGetReadProviderForChain,
    getReadProviderForGroup: mockGetReadProviderForGroup,
  };
});

const { ethers } = require('ethers');
const contractScriptsBarrel = require('./chainGateway.js');

const contractScripts = contractScriptsBarrel.default;
const { isRetryableSurveyResponseReadError } = contractScriptsBarrel.__test__contractScriptsErrors;

const GROUP_CFG = {
  slug: 'fetch-all-survey-responses-session',
  networkChainId: 84532,
  blockLimits: {
    start: 1,
    end: null,
  },
  contracts: {
    surveys: {
      address: '0x1111111111111111111111111111111111111111',
      chainId: 84532,
    },
  },
};

const SURVEY_ID = ethers.utils.id('fetch-all-survey-responses');
const QUESTION_ID = ethers.utils.id('fetch-all-survey-question');
const RESPONSES_SUBMITTED_IFACE = new ethers.utils.Interface([
  'event ResponsesSubmitted(address indexed responder,bytes32[] questionIds,bytes32 indexed surveyId)',
]);

const makeResponsesSubmittedLog = (responder, blockNumber, logIndex = 0) => {
  const encoded = RESPONSES_SUBMITTED_IFACE.encodeEventLog(RESPONSES_SUBMITTED_IFACE.getEvent('ResponsesSubmitted'), [
    responder,
    [QUESTION_ID],
    SURVEY_ID,
  ]);
  return {
    address: GROUP_CFG.contracts.surveys.address,
    blockNumber,
    logIndex,
    transactionIndex: 0,
    topics: encoded.topics,
    data: encoded.data,
  };
};

const makeResponseReadError = (message, extra = {}) => {
  const error = new Error(message);
  Object.assign(error, extra);
  if (extra.arweaveFailure && typeof extra.arweaveFailure === 'object') {
    error.arweaveFailure = {
      message,
      ...extra.arweaveFailure,
    };
  }
  return error;
};

describe('isRetryableSurveyResponseReadError', () => {
  it.each([402, 408, 429, 500, 502, 503, 504])('treats status %s as retryable', (status) => {
    expect(isRetryableSurveyResponseReadError(makeResponseReadError(`status ${status}`, { status }))).toBe(true);
  });

  it.each([401, 403])('treats status %s as terminal', (status) => {
    expect(isRetryableSurveyResponseReadError(makeResponseReadError(`status ${status}`, { status }))).toBe(false);
  });

  it.each([402, 'NETWORK_ERROR', 'TIMEOUT', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'])(
    'treats code %s as retryable',
    (code) => {
      expect(isRetryableSurveyResponseReadError(makeResponseReadError(`code ${code}`, { code }))).toBe(true);
    },
  );

  it('treats nested error.code 503 as retryable', () => {
    expect(
      isRetryableSurveyResponseReadError(
        makeResponseReadError('', {
          error: { code: 503 },
        }),
      ),
    ).toBe(true);
  });

  it('treats nested error.statusCode 429 as retryable', () => {
    expect(
      isRetryableSurveyResponseReadError(
        makeResponseReadError('', {
          error: { statusCode: 429 },
        }),
      ),
    ).toBe(true);
  });

  it.each(['ECONNREFUSED', 'connection refused', 'connection reset', 'socket hang up'])(
    'treats %s messages as retryable',
    (message) => {
      expect(isRetryableSurveyResponseReadError(makeResponseReadError(message))).toBe(true);
    },
  );

  it.each([
    ['reason socket hang up', { reason: 'socket hang up' }, true],
    ['reason connection refused', { reason: 'connection refused' }, true],
    ['nested error.message connection reset', { error: { message: 'connection reset' } }, true],
    ['nested error.message quota exceeded', { error: { message: 'quota exceeded' } }, true],
    ['reason invalid response data', { reason: 'invalid response data' }, false],
  ])('treats %s according to the nested error shape', (_label, extra, expected) => {
    expect(isRetryableSurveyResponseReadError(makeResponseReadError('', extra))).toBe(expected);
  });

  it('treats Arweave cooldown metadata as retryable', () => {
    expect(
      isRetryableSurveyResponseReadError(
        makeResponseReadError('Arweave cooldown active', {
          arweaveFailure: {
            kind: 'cooldown',
          },
        }),
      ),
    ).toBe(true);
  });

  it('treats AbortError as terminal', () => {
    expect(
      isRetryableSurveyResponseReadError(
        makeResponseReadError('request aborted', {
          name: 'AbortError',
        }),
      ),
    ).toBe(false);
  });
});

describe('contractScripts.fetchAllSurveyResponses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchLogsSmartWithProvider.mockReset();
    mockGetReadProviderForChain.mockReset();
    mockGetReadProviderForChain.mockReturnValue({ name: 'mock-provider' });
    mockGetReadProviderForGroup.mockReset();
    mockGetReadProviderForGroup.mockReturnValue(mockSessionReadProvider);

    jest.spyOn(ethers, 'Contract').mockImplementation(function MockContract() {
      return {
        address: GROUP_CFG.contracts.surveys.address,
        filters: {
          ResponsesSubmitted: jest.fn((_responder, _questionIds, surveyId) => ({
            address: GROUP_CFG.contracts.surveys.address,
            topics: ['0xtopic', surveyId],
          })),
        },
      };
    });

    jest.spyOn(contractScripts, 'getRelevantBlockWindowForFilter').mockResolvedValue({
      fromBlock: 1,
      toBlock: 30,
    });
    jest.spyOn(contractScripts, 'getBlockWithCaching').mockResolvedValue({
      timestamp: 1712345678,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns successful responses without a partial-failure signal when all reads succeed', async () => {
    const responderA = '0x00000000000000000000000000000000000000aa';
    const responderB = '0x00000000000000000000000000000000000000bb';
    mockFetchLogsSmartWithProvider.mockResolvedValue([
      makeResponsesSubmittedLog(responderA, 7, 0),
      makeResponsesSubmittedLog(responderB, 9, 1),
    ]);

    jest.spyOn(contractScripts, 'getSurveyResponse').mockImplementation(async (_providerName, responder) => ({
      answer: responder.slice(-4),
    }));

    const result = await contractScripts.fetchAllSurveyResponses('none', SURVEY_ID, 1, 30, GROUP_CFG);

    expect(mockGetReadProviderForGroup).toHaveBeenCalledWith(
      expect.objectContaining({ slug: GROUP_CFG.slug }),
      expect.objectContaining({ contractKey: 'surveys' }),
    );
    expect(mockGetReadProviderForChain).not.toHaveBeenCalled();
    expect(mockFetchLogsSmartWithProvider).toHaveBeenCalledWith(
      mockSessionReadProvider,
      expect.objectContaining({
        address: GROUP_CFG.contracts.surveys.address,
      }),
      1,
      30,
    );
    expect(result.hadPartialFailure).toBe(false);
    expect(result.lowestFailedBlock).toBeNull();
    expect(result.responses).toHaveLength(2);
    expect(result.responses).toEqual([
      expect.objectContaining({
        responder: responderA,
        surveyId: SURVEY_ID,
        response: { answer: '00aa' },
        blockNumber: 7,
        logIndex: 0,
        timestamp: 1712345678,
      }),
      expect.objectContaining({
        responder: responderB,
        surveyId: SURVEY_ID,
        response: { answer: '00bb' },
        blockNumber: 9,
        logIndex: 1,
        timestamp: 1712345678,
      }),
    ]);
  });

  it('batches survey response reads while preserving survey/responder output shape', async () => {
    const responderA = '0x00000000000000000000000000000000000000aa';
    const responderB = '0x00000000000000000000000000000000000000bb';
    const pendingReads = new Map();
    mockFetchLogsSmartWithProvider.mockResolvedValue([
      makeResponsesSubmittedLog(responderA, 7, 0),
      makeResponsesSubmittedLog(responderB, 9, 1),
    ]);

    jest.spyOn(contractScripts, 'getSurveyResponse').mockImplementation(
      (_providerName, responder) =>
        new Promise((resolve) => {
          pendingReads.set(String(responder).toLowerCase(), resolve);
        }),
    );

    const run = contractScripts.getSurveyResponses('none', 1, 30, GROUP_CFG);
    await Promise.resolve();
    await Promise.resolve();

    expect(contractScripts.getSurveyResponse).toHaveBeenCalledTimes(2);
    pendingReads.get(responderB.toLowerCase())({ answer: 'B' });
    pendingReads.get(responderA.toLowerCase())({ answer: 'A' });

    await expect(run).resolves.toEqual({
      [SURVEY_ID.toLowerCase()]: {
        [responderA.toLowerCase()]: { answer: 'A' },
        [responderB.toLowerCase()]: { answer: 'B' },
      },
    });
  });

  it('threads forced Arweave recovery into chunked question response reads', async () => {
    const responder = '0x00000000000000000000000000000000000000aa';
    mockFetchLogsSmartWithProvider.mockResolvedValue([makeResponsesSubmittedLog(responder, 7, 0)]);

    const getResponseSpy = jest.spyOn(contractScripts, 'getResponse').mockResolvedValue({
      answer: 'recovered',
    });
    const onPartialData = jest.fn();

    await contractScripts.getQuestionResponsesChunkedWithCallback('none', 1, 30, null, onPartialData, GROUP_CFG, {
      forceArweaveFetch: true,
    });

    expect(getResponseSpy).toHaveBeenCalledWith(
      'none',
      responder,
      QUESTION_ID.toLowerCase(),
      GROUP_CFG,
      expect.objectContaining({
        _resolvedCfg: expect.objectContaining({ slug: GROUP_CFG.slug }),
        forceArweaveFetch: true,
      }),
    );
    expect(onPartialData).toHaveBeenCalledWith(
      expect.objectContaining({
        [QUESTION_ID.toLowerCase()]: [
          expect.objectContaining({
            responder,
            response: { answer: 'recovered' },
            blockNumber: 7,
          }),
        ],
      }),
      30,
    );
  });

  it('drops terminal read failures without setting a partial-failure signal', async () => {
    const responderA = '0x00000000000000000000000000000000000000aa';
    const responderB = '0x00000000000000000000000000000000000000bb';
    mockFetchLogsSmartWithProvider.mockResolvedValue([
      makeResponsesSubmittedLog(responderA, 7, 0),
      makeResponsesSubmittedLog(responderB, 9, 1),
    ]);

    const getSurveyResponseSpy = jest
      .spyOn(contractScripts, 'getSurveyResponse')
      .mockImplementation(async (_providerName, responder) => {
        if (responder === responderB) {
          throw makeResponseReadError('Invalid response JSON for tx bad-payload', {
            retryable: false,
            state: 'terminal_invalid',
            kind: 'invalid',
            arweaveFailure: {
              retryable: false,
              state: 'terminal_invalid',
              kind: 'invalid',
            },
          });
        }
        return { answer: 'kept' };
      });

    const result = await contractScripts.fetchAllSurveyResponses('none', SURVEY_ID, 1, 30, GROUP_CFG);

    expect(getSurveyResponseSpy).toHaveBeenCalledWith('none', responderB, SURVEY_ID, GROUP_CFG, { throwOnError: true });
    expect(result.responses).toEqual([
      expect.objectContaining({
        responder: responderA,
        response: { answer: 'kept' },
        blockNumber: 7,
      }),
    ]);
    expect(result.hadPartialFailure).toBe(false);
    expect(result.lowestFailedBlock).toBeNull();
  });

  it('drops AbortError response reads without setting a partial-failure signal', async () => {
    const responderA = '0x00000000000000000000000000000000000000aa';
    const responderB = '0x00000000000000000000000000000000000000bb';
    mockFetchLogsSmartWithProvider.mockResolvedValue([
      makeResponsesSubmittedLog(responderA, 7, 0),
      makeResponsesSubmittedLog(responderB, 9, 1),
    ]);

    const getSurveyResponseSpy = jest
      .spyOn(contractScripts, 'getSurveyResponse')
      .mockImplementation(async (_providerName, responder) => {
        if (responder === responderB) {
          throw makeResponseReadError('request aborted', {
            name: 'AbortError',
          });
        }
        return { answer: 'kept' };
      });

    const result = await contractScripts.fetchAllSurveyResponses('none', SURVEY_ID, 1, 30, GROUP_CFG);

    expect(getSurveyResponseSpy).toHaveBeenCalledWith('none', responderB, SURVEY_ID, GROUP_CFG, { throwOnError: true });
    expect(result.responses).toEqual([
      expect.objectContaining({
        responder: responderA,
        response: { answer: 'kept' },
        blockNumber: 7,
      }),
    ]);
    expect(result.hadPartialFailure).toBe(false);
    expect(result.lowestFailedBlock).toBeNull();
  });

  it('tracks the earliest retryable failed response block while keeping successful responses', async () => {
    const responderA = '0x00000000000000000000000000000000000000aa';
    const responderB = '0x00000000000000000000000000000000000000bb';
    const responderC = '0x00000000000000000000000000000000000000cc';
    mockFetchLogsSmartWithProvider.mockResolvedValue([
      makeResponsesSubmittedLog(responderA, 11, 0),
      makeResponsesSubmittedLog(responderB, 14, 1),
      makeResponsesSubmittedLog(responderC, 12, 2),
    ]);

    jest.spyOn(contractScripts, 'getSurveyResponse').mockImplementation(async (_providerName, responder) => {
      if (responder === responderB || responder === responderC) {
        throw new Error('network timeout while fetching survey response');
      }
      return { answer: 'kept' };
    });

    const result = await contractScripts.fetchAllSurveyResponses('none', SURVEY_ID, 1, 30, GROUP_CFG);

    expect(result.responses).toEqual([
      expect.objectContaining({
        responder: responderA,
        response: { answer: 'kept' },
        blockNumber: 11,
      }),
    ]);
    expect(result.hadPartialFailure).toBe(true);
    expect(result.lowestFailedBlock).toBe(12);
  });

  it('only lets retryable failures clamp the watermark when terminal and retryable reads are mixed', async () => {
    const responderA = '0x00000000000000000000000000000000000000aa';
    const responderB = '0x00000000000000000000000000000000000000bb';
    const responderC = '0x00000000000000000000000000000000000000cc';
    mockFetchLogsSmartWithProvider.mockResolvedValue([
      makeResponsesSubmittedLog(responderA, 10, 0),
      makeResponsesSubmittedLog(responderB, 8, 1),
      makeResponsesSubmittedLog(responderC, 12, 2),
    ]);

    jest.spyOn(contractScripts, 'getSurveyResponse').mockImplementation(async (_providerName, responder) => {
      if (responder === responderB) {
        throw makeResponseReadError('Invalid response JSON for tx terminal', {
          retryable: false,
          state: 'terminal_invalid',
          kind: 'invalid',
          arweaveFailure: {
            retryable: false,
            state: 'terminal_invalid',
            kind: 'invalid',
          },
        });
      }
      if (responder === responderC) {
        throw new Error('network timeout while fetching survey response');
      }
      return { answer: 'kept' };
    });

    const result = await contractScripts.fetchAllSurveyResponses('none', SURVEY_ID, 1, 30, GROUP_CFG);

    expect(result.responses).toEqual([
      expect.objectContaining({
        responder: responderA,
        response: { answer: 'kept' },
        blockNumber: 10,
      }),
    ]);
    expect(result.hadPartialFailure).toBe(true);
    expect(result.lowestFailedBlock).toBe(12);
  });

  it('treats 402 quota-exhausted response reads as retryable so the watermark clamps', async () => {
    const responderA = '0x00000000000000000000000000000000000000aa';
    const responderB = '0x00000000000000000000000000000000000000bb';
    mockFetchLogsSmartWithProvider.mockResolvedValue([
      makeResponsesSubmittedLog(responderA, 10, 0),
      makeResponsesSubmittedLog(responderB, 12, 1),
    ]);

    jest.spyOn(contractScripts, 'getSurveyResponse').mockImplementation(async (_providerName, responder) => {
      if (responder === responderB) {
        throw makeResponseReadError('payment required: quota exhausted for survey response read', {
          status: 402,
        });
      }
      return { answer: 'kept' };
    });

    const result = await contractScripts.fetchAllSurveyResponses('none', SURVEY_ID, 1, 30, GROUP_CFG);

    expect(result.responses).toEqual([
      expect.objectContaining({
        responder: responderA,
        response: { answer: 'kept' },
        blockNumber: 10,
      }),
    ]);
    expect(result.hadPartialFailure).toBe(true);
    expect(result.lowestFailedBlock).toBe(12);
  });
});
