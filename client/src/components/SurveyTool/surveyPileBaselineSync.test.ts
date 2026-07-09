import { mergeQuestionResponses } from './surveyToolCacheState.js';
import {
  buildPileBaselineCheckPlan,
  buildPileBaselineConsistencyPlan,
  buildPilePrefillReadPlan,
  readPileScopedQuestionResponses,
} from './surveyPileBaselineSync';

const mergeScopedQuestionResponses = (
  target: Record<string, Record<string, unknown>> = {},
  source: Record<string, Record<string, unknown>> = {},
) => mergeQuestionResponses(target as any, source as any) as Record<string, Record<string, unknown>>;

describe('surveyPileBaselineSync', () => {
  it('builds pile baseline check plans for skip cases and rendered-id checks', () => {
    expect(
      buildPileBaselineCheckPlan({
        submissionComplete: false,
        editBaseline: { answers: {} },
        networkIdStr: '84532',
        pileQuestions: [{ id: 'q1' }],
      }),
    ).toEqual({
      shouldSkip: true,
      reason: 'not-submitted',
      renderedIds: [],
    });

    expect(
      buildPileBaselineCheckPlan({
        submissionComplete: true,
        editBaseline: null,
        networkIdStr: '84532',
        pileQuestions: [{ id: 'q1' }],
      }),
    ).toEqual({
      shouldSkip: true,
      reason: 'missing-baseline',
      renderedIds: [],
    });

    expect(
      buildPileBaselineCheckPlan({
        submissionComplete: true,
        editBaseline: { answers: {} },
        networkIdStr: '',
        pileQuestions: [{ id: 'q1' }],
      }),
    ).toEqual({
      shouldSkip: true,
      reason: 'missing-network',
      renderedIds: [],
    });

    expect(
      buildPileBaselineCheckPlan({
        submissionComplete: true,
        editBaseline: { answers: {} },
        networkIdStr: '84532',
        pileQuestions: [{ id: 'q1' }, { id: null }, { id: 'q2' }],
      }),
    ).toEqual({
      shouldSkip: false,
      reason: 'check',
      renderedIds: ['q1', 'q2'],
    });
  });

  it('builds pile prefill read plans for anon, dirty, missing-network, empty, and ready cases', () => {
    expect(
      buildPilePrefillReadPlan({
        account: '',
        networkIdStr: '84532',
        pileQuestions: [{ id: 'q1' }],
      }),
    ).toEqual({
      shouldSkip: true,
      shouldBumpNoop: false,
      reason: 'anon',
    });

    expect(
      buildPilePrefillReadPlan({
        account: '0xabc',
        isDirty: true,
        networkIdStr: '84532',
        pileQuestions: [{ id: 'q1' }],
      }),
    ).toEqual({
      shouldSkip: true,
      shouldBumpNoop: true,
      reason: 'dirty',
    });

    expect(
      buildPilePrefillReadPlan({
        account: '0xabc',
        modifiedCount: 2,
        networkIdStr: '84532',
        pileQuestions: [{ id: 'q1' }],
      }),
    ).toEqual({
      shouldSkip: true,
      shouldBumpNoop: true,
      reason: 'dirty',
    });

    expect(
      buildPilePrefillReadPlan({
        account: '0xabc',
        networkIdStr: '',
        pileQuestions: [{ id: 'q1' }],
      }),
    ).toEqual({
      shouldSkip: true,
      shouldBumpNoop: false,
      reason: 'missing-network',
    });

    expect(
      buildPilePrefillReadPlan({
        account: '0xabc',
        networkIdStr: '84532',
        pileQuestions: [],
      }),
    ).toEqual({
      shouldSkip: true,
      shouldBumpNoop: false,
      reason: 'empty-pile',
    });

    expect(
      buildPilePrefillReadPlan({
        account: '0xabc',
        networkIdStr: '84532',
        pileQuestions: [{ id: 'q1' }],
      }),
    ).toEqual({
      shouldSkip: false,
      shouldBumpNoop: false,
      reason: 'prefill',
    });
  });

  it('reads and merges scoped pile question responses for the active network', () => {
    const readQuestionsCache = jest.fn((scopeSlug: string) => {
      if (scopeSlug === 'edge') {
        return {
          '84532': {
            questionResponses: {
              q1: {
                '0xAbC': { answer: { value: 'edge-answer' } },
              },
            },
          },
        };
      }

      return {
        '84532': {
          questionResponses: {
            Q1: {
              '0xdef': { answer: { value: 'other-answer' } },
            },
            q2: {
              '0x999': { answer: { value: 'other-two' } },
            },
          },
        },
      };
    });

    expect(
      readPileScopedQuestionResponses({
        scopeSlugs: ['edge', 'other'],
        networkIdStr: '84532',
        readQuestionsCache,
        mergeQuestionResponses: mergeScopedQuestionResponses,
      }),
    ).toEqual({
      q1: {
        '0xabc': { answer: { value: 'edge-answer' } },
        '0xdef': { answer: { value: 'other-answer' } },
      },
      q2: {
        '0x999': { answer: { value: 'other-two' } },
      },
    });

    expect(readQuestionsCache).toHaveBeenNthCalledWith(1, 'edge');
    expect(readQuestionsCache).toHaveBeenNthCalledWith(2, 'other');
    expect(
      readPileScopedQuestionResponses({
        scopeSlugs: ['edge'],
        networkIdStr: '',
        readQuestionsCache,
        mergeQuestionResponses: mergeScopedQuestionResponses,
      }),
    ).toEqual({});
  });

  it('maps pile baseline consistency checks into sync vs optimistic plans', () => {
    const checkConsistency = jest.fn(() => true);

    expect(
      buildPileBaselineConsistencyPlan({
        baseline: { answers: {} },
        renderedIds: ['q1'],
        questionResponses: { q1: { '0xabc': { answer: { value: 'yes' } } } },
        account: '0xabc',
        valuesEqual: Object.is,
        checkConsistency,
      }),
    ).toEqual({
      action: 'sync-cache-caught-up',
      isConsistent: true,
    });

    expect(checkConsistency).toHaveBeenCalledWith({
      baseline: { answers: {} },
      renderedIds: ['q1'],
      questionResponses: { q1: { '0xabc': { answer: { value: 'yes' } } } },
      account: '0xabc',
      valuesEqual: Object.is,
    });

    expect(
      buildPileBaselineConsistencyPlan({
        baseline: { answers: {} },
        renderedIds: ['q1'],
        questionResponses: {},
        account: '0xabc',
        checkConsistency: () => false,
      }),
    ).toEqual({
      action: 'maintain-optimistic',
      isConsistent: false,
    });
  });
});
