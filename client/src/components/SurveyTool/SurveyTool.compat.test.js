import SurveyTool from './SurveyTool';
import { SurveyQuestions } from './SurveyQuestions';
import { PileViewMode } from './SurveyPileViewMode';
import { SurveySelector } from './SurveySelector';

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

const findFirstNodeByType = (node, targetType) => (
  findFirstNode(node, (candidate) => candidate?.type === targetType)
);

const findLazySurveyResultsNode = (node) => (
  findFirstNode(node, (candidate) => (
    candidate?.type?.$$typeof === REACT_LAZY_TYPE &&
    Object.prototype.hasOwnProperty.call(candidate.props || {}, 'isOpen')
  ))
);

const findLazySurveyQuestionsNode = (node) => (
  findFirstNode(node, (candidate) => (
    candidate?.type?.$$typeof === REACT_LAZY_TYPE &&
    Object.prototype.hasOwnProperty.call(candidate.props || {}, 'singleQuestionMode')
  ))
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
    const subject = new SurveyQuestions({
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      network: { id: 8453, chainId: 8453, name: 'Base' },
    });
    subject.resolveEffectiveResponseGateConfig = jest.fn(() => ({
      slug: 'edge',
      __registry: {
        registryChainId: 84532,
      },
    }));

    expect(subject.resolveSessionChainId('edge')).toBe(84532);
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
    const shell = new SurveyTool({
      singleQuestionMode: true,
      questionID: '0xquestion',
      network: { id: 11155420 },
      networkChainId: 11155420,
      lit,
      litHooks,
    });

    const tree = shell.render();
    const questionsNode = findLazySurveyQuestionsNode(tree);

    expect(questionsNode?.props?.lit).toBe(lit);
    expect(questionsNode?.props?.litHooks).toBe(litHooks);
  });

  it('keeps extracted PileViewMode wired to the SurveyQuestions base class', () => {
    expect(Object.getPrototypeOf(PileViewMode.prototype)).toBe(SurveyQuestions.prototype);
  });
});
