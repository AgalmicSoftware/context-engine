import SurveyTool from './SurveyTool';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { SurveySelector } from './SurveySelector';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import { resolveSurveyToolQuestionReadCacheContext } from './surveyToolSessionResolution';

const REACT_LAZY_TYPE = Symbol.for('react.lazy');

const findFirstNode = (node, predicate) => {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstNode(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (predicate(node)) return node;
  return findFirstNode(node?.props?.children, predicate);
};

const findFirstNodeByType = (node, targetType) => findFirstNode(node, (candidate) => candidate?.type === targetType);

const findLazySurveyResultsNode = (node) =>
  findFirstNode(
    node,
    (candidate) =>
      candidate?.type?.$$typeof === REACT_LAZY_TYPE &&
      Object.prototype.hasOwnProperty.call(candidate.props || {}, 'isOpen'),
  );

const findLazySurveyQuestionsNode = (node) =>
  findFirstNode(
    node,
    (candidate) =>
      candidate?.type?.$$typeof === REACT_LAZY_TYPE &&
      Object.prototype.hasOwnProperty.call(candidate.props || {}, 'singleQuestionMode'),
  );

describe('SurveyTool compatibility wiring', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('loads without syntax/runtime import errors', () => {
    expect(SurveyTool).toBeDefined();
  });

  it('uses __registry.registryChainId when SurveyQuestions resolves the session chain', () => {
    const resolveBySlug = jest.fn((slug) =>
      slug === 'edge'
        ? {
            slug: 'edge',
            __registry: {
              registryChainId: 84532,
            },
          }
        : null,
    );

    const resolved = resolveSurveyToolQuestionReadCacheContext({
      sessionSlug: 'edge',
      network: { id: 8453, chainId: 8453, name: 'Base' },
      resolveBySlug,
    });

    expect(resolved).toMatchObject({
      sessionSlug: 'edge',
      sessionConfig: {
        slug: 'edge',
        __registry: {
          registryChainId: 84532,
        },
      },
      networkId: 84532,
      networkIdStr: '84532',
    });
    expect(resolveBySlug).toHaveBeenCalledWith('edge');
    // port note: dropped direct `SurveyQuestions.resolveSessionChainId()`
    // invocation. The exported session-resolution helper is the behavior-level
    // chain selector that preserves the same registryChainId-over-wallet rule.
  });

  it('renders extracted PileViewMode through SurveyTool.tsx in pile mode', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      onFilterChange: jest.fn(),
    });

    const tree = shell.render();

    expect(tree.type?.$$typeof).toBe(REACT_LAZY_TYPE);
    expect(tree.props.minifiedMode).toBe('pile');
  });

  it('forwards scoped Lit hooks from SurveyTool into normal survey surfaces', () => {
    const litHooks = { getKey: jest.fn(), saveKey: jest.fn() };
    const lit = { getKey: jest.fn() };
    const shell = new SurveyTool({
      network: { id: 11155420 },
      networkChainId: 11155420,
      lit,
      litHooks,
    });

    const tree = shell.render();
    const selectorNode = findFirstNodeByType(tree, SurveySelector);
    const resultsNode = findLazySurveyResultsNode(tree);

    expect(selectorNode?.props?.lit).toBe(lit);
    expect(selectorNode?.props?.litHooks).toBe(litHooks);
    expect(resultsNode?.props?.lit).toBe(lit);
    expect(resultsNode?.props?.litHooks).toBe(litHooks);
    expect(resultsNode?.props?.isOpen).toBe(false);
  });

  it('forwards scoped Lit hooks from SurveyTool into single-question surfaces', () => {
    const litHooks = { getKey: jest.fn(), saveKey: jest.fn() };
    const lit = { getKey: jest.fn() };
    const sessionConfig = {
      slug: 'edge',
      networkChainId: 11155420,
      encryption: {
        gates: {
          questionResponses: {
            type: 'sbt',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
          },
        },
      },
    };
    const shell = new SurveyTool({
      singleQuestionMode: true,
      questionID: '0xquestion',
      network: { id: 11155420 },
      networkChainId: 11155420,
      sessionSlug: 'edge',
      sessionConfig,
      lit,
      litHooks,
    });

    const tree = shell.render();
    const questionsNode = findLazySurveyQuestionsNode(tree);

    expect(questionsNode?.props?.lit).toBe(lit);
    expect(questionsNode?.props?.litHooks).toBe(litHooks);
    expect(questionsNode?.props?.sessionSlug).toBe('edge');
    expect(questionsNode?.props?.sessionConfig).toBe(sessionConfig);
    expect(questionsNode?.props?.networkChainId).toBe(11155420);
  });

  it('keeps extracted PileViewMode wired to the SurveyQuestions base class', () => {
    const { getByTestId } = renderSurveyPileViewMode({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      isQuestionCacheReady: true,
      onFilterChange: jest.fn(),
      runtimeStrategy: createPileViewRuntimeStrategy(),
    });

    expect(getByTestId('ce-survey-filter-toggle')).toBeInTheDocument();
    expect(getByTestId('ce-survey-create-toggle-pile')).toBeInTheDocument();
    // port note: dropped prototype inheritance assertion. The coordinated
    // hooks flip intentionally removes `extends SurveyQuestions`; this guard
    // now verifies the extracted pile surface still renders through its shared
    // runtime wiring instead of pinning the class prototype chain.
  });
});
