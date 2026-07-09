import { createSurveyQuestionsDataRuntime } from './surveyQuestionsDataRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  buildEmptyResponseFieldState: jest.fn(() => ({ value: '' })),
  buildMergedSurveyResponseState: jest.fn(() => ({ merged: true })),
  ensureQuestionsNet: jest.fn((cache, netId) => ({
    ...cache,
    [netId]: {
      questionResponses: {},
      questionResponsesMeta: {},
      questions: {},
      ...(cache?.[netId] || {}),
    },
  })),
  getCurrentRenderedQuestionIds: jest.fn(() => ['q1']),
  inst: {
    _getEffectiveDraftSlug: jest.fn(() => 'edge'),
    _isMounted: true,
  },
  propsRef: {
    current: {
      provider: { id: 'provider' },
    },
  },
  readQuestionsCache: jest.fn(() => ({
    '11155420': {
      questions: {
        q1: {
          id: 'q1',
          prompt: 'Cached question',
        },
      },
    },
  })),
  readQuestionsCacheAsync: jest.fn(async () => ({
    '11155420': {
      questionResponses: {
        q1: {
          '0xold': { answer: 'old' },
        },
      },
      questionResponsesMeta: {
        q1: {
          '0xold': { bn: 1, li: 0 },
        },
      },
      questions: {},
    },
  })),
  resolveEffectiveSlug: jest.fn(() => 'edge'),
  resolveQuestionReadCacheContext: jest.fn(() => ({
    networkIdStr: '11155420',
    sessionSlug: 'edge',
  })),
  surveyLog: {
    error: jest.fn(),
    warn: jest.fn(),
  },
  surveyQuestionReadsPort: {
    getResponse: jest.fn(async () => ({
      answer: 'latest',
      blockNumber: 5,
      logIndex: 2,
    })),
  },
  writeQuestionsCache: jest.fn(async () => undefined),
  ...overrides,
});

describe('surveyQuestionsDataRuntime', () => {
  it('writes latest question responses into a freshly reread cache bucket', async () => {
    const context = createContext();
    const runtime = createSurveyQuestionsDataRuntime(context);

    await expect(runtime.getLatestQuestionResponse('0xABC', 'q1', '11155420', {})).resolves.toEqual({
      answer: 'latest',
      blockNumber: 5,
      logIndex: 2,
    });

    expect(context.surveyQuestionReadsPort.getResponse).toHaveBeenCalledWith(
      context.propsRef.current.provider,
      '0xABC',
      'q1',
      'edge',
    );
    expect(context.readQuestionsCacheAsync).toHaveBeenCalledWith('edge');
    expect(context.writeQuestionsCache).toHaveBeenCalledWith(
      'edge',
      expect.objectContaining({
        '11155420': expect.objectContaining({
          questionResponses: expect.objectContaining({
            q1: expect.objectContaining({
              '0xabc': expect.objectContaining({ answer: 'latest' }),
              '0xold': { answer: 'old' },
            }),
          }),
          questionResponsesMeta: expect.objectContaining({
            q1: expect.objectContaining({
              '0xabc': { bn: 5, li: 2 },
              '0xold': { bn: 1, li: 0 },
            }),
          }),
        }),
      }),
    );
  });

  it('does not overwrite a fresher cached question response with stale chain data', async () => {
    const context = createContext({
      readQuestionsCacheAsync: jest.fn(async () => ({
        '11155420': {
          questionResponses: {
            q1: {
              '0xabc': { answer: 'fresh-cache' },
            },
          },
          questionResponsesMeta: {
            q1: {
              '0xabc': { bn: 9, li: 0 },
            },
          },
          questions: {},
        },
      })),
      surveyQuestionReadsPort: {
        getResponse: jest.fn(async () => ({
          answer: 'stale-chain',
          blockNumber: 5,
          logIndex: 2,
        })),
      },
    });
    const runtime = createSurveyQuestionsDataRuntime(context);

    await expect(runtime.getLatestQuestionResponse('0xABC', 'q1', '11155420', {})).resolves.toEqual({
      answer: 'stale-chain',
      blockNumber: 5,
      logIndex: 2,
    });

    expect(context.writeQuestionsCache).not.toHaveBeenCalled();
  });

  it('loads questions from the resolved cache scope', async () => {
    const context = createContext();
    const runtime = createSurveyQuestionsDataRuntime(context);

    await expect(runtime.loadQuestionFromCache('Q1')).resolves.toEqual({
      id: 'q1',
      prompt: 'Cached question',
    });
    expect(context.resolveQuestionReadCacheContext).toHaveBeenCalledWith(context.propsRef.current, 'edge');
    expect(context.readQuestionsCache).toHaveBeenCalledWith('edge');
  });

  it('delegates survey response merges with rendered ids and empty-field builder', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsDataRuntime(context);

    expect(runtime.mergeSurveyResponseState({ existing: true }, [{ id: 'q1' }], 2)).toEqual({ merged: true });
    expect(context.buildMergedSurveyResponseState).toHaveBeenCalledWith({
      buildEmptyResponseFieldState: context.buildEmptyResponseFieldState,
      currentState: { existing: true },
      newQuestionPool: [{ id: 'q1' }],
      renderedQuestionIds: ['q1'],
      surveyIndex: 2,
    });
  });

  it('parses JSON answer values without throwing on plain text', () => {
    const runtime = createSurveyQuestionsDataRuntime(createContext());

    expect(runtime.parseAnswerValue('{"answer":"yes"}')).toEqual({ answer: 'yes' });
    expect(runtime.parseAnswerValue('[1,2]')).toEqual([1, 2]);
    expect(runtime.parseAnswerValue('plain answer')).toBe('plain answer');
  });
});
