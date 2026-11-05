import { buildOnePageSessionAggregatorCacheResult } from './onePageSessionAggregatorCacheRuntime';

const mockHiddenQuestionIds = jest.fn((_slug: string) => new Set<string>());
jest.mock('../SurveyTool/surveyToolScope', () => ({
  ...(jest.requireActual('../SurveyTool/surveyToolScope') as object),
  getBlockedQuestionIdsSet: (slug: string) => mockHiddenQuestionIds(slug),
}));

const answer = (questionID: string) => ({ questionID, type: 'binary', answer: { value: 'Agree', encrypted: false } });
const node = {
  questions: {
    q1: { id: 'q1', prompt: 'Shown', type: 'binary' },
    q2: { id: 'q2', prompt: 'Hidden', type: 'binary' },
  },
  questionResponses: { q1: { '0xa': answer('q1') }, q2: { '0xa': answer('q2') } },
};
const build = () =>
  buildOnePageSessionAggregatorCacheResult({
    cacheScope: '11155420',
    displaySlug: 'pilot',
    isQuestionCacheReady: true,
    questionSourceSlug: 'pilot',
    readQuestionsCache: () => ({ '11155420': node }),
    resolveQuestionPool: () => [],
    workerCacheIdentity: null,
    writeQuestionsCache: jest.fn(),
  });

describe('buildOnePageSessionAggregatorCacheResult', () => {
  it('leaves a question on the hidden list, and its answers, out of the report', () => {
    mockHiddenQuestionIds.mockReturnValue(new Set());
    const shown = build();
    expect(Object.keys(shown.map).sort()).toEqual(['q1', 'q2']);

    mockHiddenQuestionIds.mockReturnValue(new Set(['q2']));
    const hidden = build();
    expect(Object.keys(hidden.map)).toEqual(['q1']);
    expect(mockHiddenQuestionIds).toHaveBeenCalledWith('pilot');
    // The report rebuilds when the list changes, though the cache did not.
    expect(hidden.sourceSignature).not.toBe(shown.sourceSignature);
  });
});
