import { LazySurveyResults, QuestionsDashboard, SurveySelector } from './SurveySelector';

const findElement = (node: any, predicate: (candidate: any) => boolean): any => {
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        stack.push(current[i]);
      }
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) return current;
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

describe('SurveySelector Lit hook forwarding', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('forwards scoped Lit hooks to selected survey question and results surfaces', () => {
    const litHooks = { getKey: jest.fn(), saveKey: jest.fn() };
    const lit = { getKey: jest.fn() };
    const SurveyQuestionsComponent = () => null;
    const subject = new SurveySelector({
      SurveyQuestionsComponent,
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isSurveyCacheReady: true,
      isSBTCacheReady: true,
      singleQuestionMode: false,
      network: { id: 11155420 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      account: '0x123',
      provider: {},
      lit,
      litHooks,
    });
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'survey',
      selectedSurveyIndex: 0,
      surveys: [{ id: '0xsurvey', title: 'Gated Survey', questionIDs: ['0xq'] }],
      showResults: true,
      createSurveyMode: false,
    };
    subject.areSurveySpecificQuestionsLoaded = jest.fn(() => true);
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));

    const tree = subject.render();
    const questionsNode = findElement(tree, (node) => node.type === SurveyQuestionsComponent);
    const resultsNode = findElement(tree, (node) => node.type === LazySurveyResults);

    expect(questionsNode?.props?.lit).toBe(lit);
    expect(questionsNode?.props?.litHooks).toBe(litHooks);
    expect(resultsNode?.props?.lit).toBe(lit);
    expect(resultsNode?.props?.litHooks).toBe(litHooks);
  });

  it('forwards scoped Lit hooks from questions dashboard to pile question surfaces', () => {
    const litHooks = { getKey: jest.fn(), saveKey: jest.fn() };
    const lit = { getKey: jest.fn() };
    const SurveyQuestionsComponent = () => null;
    const subject = new QuestionsDashboard({
      SurveyQuestionsComponent,
      account: '0x123',
      provider: {},
      network: { id: 11155420 },
      lit,
      litHooks,
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isSurveyCacheReady: true,
      isSBTCacheReady: true,
    });
    subject.state = {
      ...subject.state,
      filterLoading: false,
      filteredQuestions: [{ id: '0xq', prompt: 'Question?' }],
    };

    const tree = subject.render();
    const questionsNode = findElement(tree, (node) => node.type === SurveyQuestionsComponent);

    expect(questionsNode?.props?.lit).toBe(lit);
    expect(questionsNode?.props?.litHooks).toBe(litHooks);
  });
});
