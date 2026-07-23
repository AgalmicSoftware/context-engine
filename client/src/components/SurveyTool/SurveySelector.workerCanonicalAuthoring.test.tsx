import { E2E_TESTIDS } from '../../utilities/e2eTestIds';
import { LazyCreateQuestionsAndSurveys, SurveySelector } from './SurveySelector';

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
