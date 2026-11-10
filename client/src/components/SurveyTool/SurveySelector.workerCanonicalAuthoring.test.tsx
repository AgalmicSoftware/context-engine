import { E2E_TESTIDS } from '../../utilities/e2eTestIds';
import { LazyCreateQuestionsAndSurveys, QuestionsDashboard, SurveySelector } from './SurveySelector';
import QuestionFilter from './QuestionFilter';
import * as cacheScripts from '../../utilities/cache/cacheScripts';
import { resolveEffectiveSlug } from './surveyToolScope';
import { resolveEffectiveSessionContext } from './questionFilterRuntimeSupport';

const SESSION_ID = `0x${'3'.repeat(32)}`;

const pureWorkerSessionConfig = {
  slug: 'worker-session',
  sessionId: SESSION_ID,
  corsWorkerUrl: 'https://worker-selector.example.test',
  networkChainId: 11155420,
  contracts: {},
  sessionModeProfile: {
    profileVersion: 1,
    preset: 'custom',
    authority: { mode: 'worker_canonical' },
    evm: { registryChainId: null },
    storage: {
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'none', encryption: 'none' },
    },
    identity: { default: 'passkey', enabled: ['passkey'] },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'none' },
    surfaces: {
      web: true,
      telegram: false,
      miniApp: false,
      agentHttp: false,
      mcp: false,
      ceCc: false,
    },
    results: {
      visibility: 'public_full_if_storage_public',
      exposure: {
        aggregateResultsEnabled: true,
        anonymizedGroupsEnabled: false,
        minGroupSize: 2,
      },
    },
    export: { scope: 'all_session' },
  },
  storageProfile: {
    backend: 'cloudflare',
    resources: {
      questions: 'active',
      surveys: 'active',
    },
    payloadAccessControl: {
      gate: 'none',
      encryption: 'none',
      mode: 'public_read',
    },
  },
};

const findElement = (node: any, predicate: (candidate: any) => boolean): any => {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate);
      if (match) return match;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (predicate(node)) return node;
  return findElement(node.props?.children, predicate);
};

describe('SurveySelector Worker-canonical authoring reachability', () => {
  it('keeps Create reachable and forwards the exact validated Worker session config', () => {
    const subject = new SurveySelector({
      activeSessionSlug: 'worker-session',
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      network: { id: 11155420 },
      networkChainId: null,
      sessionConfig: pureWorkerSessionConfig,
      singleQuestionMode: false,
    });
    subject.state = {
      ...subject.state,
      createSurveyMode: false,
      loading: false,
      showLongLoading: false,
      showResults: false,
      viewMode: 'questions',
    };

    const closedTree = subject.render();
    const createToggle = findElement(
      closedTree,
      (candidate) => candidate?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_CREATE_TOGGLE,
    );
    expect(createToggle).toBeTruthy();

    subject.state = {
      ...subject.state,
      createSurveyMode: true,
    };
    const openTree = subject.render();
    const authoringNode = findElement(openTree, (candidate) => candidate?.type === LazyCreateQuestionsAndSurveys);

    expect(authoringNode).toBeTruthy();
    expect(authoringNode.props.sessionConfig).toBe(pureWorkerSessionConfig);
    expect(authoringNode.props.activeSessionSlug).toBe('worker-session');
  });
});

describe('SurveySelector pinned Worker question loading', () => {
  const originalUrl = window.location.href;
  const sessionConfig = { ...pureWorkerSessionConfig, networkChainId: null };
  const question = { id: 'worker-question', prompt: 'A Worker question', sessionSlug: 'worker-session' };
  const QuestionList = () => null;

  beforeEach(() => {
    window.history.replaceState({}, '', '/session/demo/questions');
  });

  afterEach(() => {
    window.history.replaceState({}, '', originalUrl);
    jest.restoreAllMocks();
  });

  const renderDashboard = (questionPool: object[] = []) => {
    const selector = new SurveySelector({
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionSlugPinned: true,
      sessionConfig,
      network: null,
      networkChainId: null,
      questionPool,
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      SurveyQuestionsComponent: QuestionList,
    });
    selector.state = { ...selector.state, loading: false, viewMode: 'questions' };
    const node = findElement(selector.render(), (candidate) => candidate.type === QuestionsDashboard);
    const dashboard = new QuestionsDashboard(node.props);
    dashboard.setState = jest.fn((patch: object, callback?: () => void) => {
      dashboard.state = { ...dashboard.state, ...patch };
      callback?.();
    });
    return dashboard;
  };

  it.each(['cache', 'pool'])('loads the pinned Worker %s without an EVM network on an alias route', (source) => {
    const peek = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
      if (namespace !== 'questionsCache' || slug !== 'worker-session' || source !== 'cache') return {};
      return { worker: { questions: { [question.id]: question }, questionResponses: {} } };
    });
    const dashboard = renderDashboard(source === 'pool' ? [question] : []);

    dashboard.loadQuestions();

    expect(dashboard.state.questions).toEqual([expect.objectContaining(question)]);
    expect(dashboard.state.filteredQuestions).toEqual([expect.objectContaining(question)]);
    expect(peek).toHaveBeenCalledWith('questionsCache', 'worker-session', { clone: false });
    expect(peek).not.toHaveBeenCalledWith('questionsCache', 'demo', { clone: false });
  });

  it('keeps the filter and question list on the pinned Worker session behind the alias', () => {
    const tree = renderDashboard().render();
    const filter = findElement(tree, (candidate) => candidate.type === QuestionFilter);
    const list = findElement(tree, (candidate) => candidate.type === QuestionList);

    expect(resolveEffectiveSessionContext(filter.props)).toMatchObject({
      sessionSlug: 'worker-session',
      sessionConfig,
    });
    expect(resolveEffectiveSlug(list.props)).toBe('worker-session');
  });
});
