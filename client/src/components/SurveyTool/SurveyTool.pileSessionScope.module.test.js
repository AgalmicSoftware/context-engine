import SurveyTool from './SurveyTool';
import {
  computeSubmitLabel,
  doesQuestionProgressMatchSlug,
  normalizeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
  buildSurveyDraftSemanticSignature,
} from './surveyToolUtils.js';
import { SurveyQuestions } from './SurveyQuestions';
import { PileViewMode } from './SurveyPileViewMode';
import { QuestionsDashboard } from './SurveySelector';
import DeferredRatingSlider from './DeferredRatingSlider';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import { DeferredCommitSlider } from './DeferredCommitSlider';
import { QuestionFilter as RawQuestionFilter } from './QuestionFilter';
import TagModal from '../TagPage/TagModal';
import GatedPromptNotice from './GatedPromptNotice';
import styles from './SurveyTool.module.scss';
import { renderToStaticMarkup } from 'react-dom/server';
import contractScripts, * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as portoFunctions from '../../utilities/web3/portoFunctions.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import * as sponsoredAccess from '../../utilities/web3/sponsoredAccess.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import {
  countElements,
  findElement,
  findFirstNodeByType,
  findNodeByClassName,
  getElementChildren,
  nodeHasClassName,
  treeHasDataTestId,
  treeHasLabel,
  treeHasText,
} from './surveyToolTreeTestHelpers.js';

const defaultCacheNode = {
  questions: {},
  questionResponses: {},
  pendingQuestionMetadata: {},
};

const makeLegacySessionConfig = (slug, blockedQuestionIds = []) => ({
  slug,
  networkChainId: 84532,
  BLOCKED_QUESTION_IDS: blockedQuestionIds,
  __registry: {
    registryChainId: 84532,
    sessionIdHex: '0x00112233445566778899aabbccddeeff',
  },
});

const setupListScope = (blockedAlpha = []) => {
  jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
  jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);

  const strictLookup = (slug) => {
    if (slug === 'alpha') return makeLegacySessionConfig(slug, blockedAlpha);
    return makeLegacySessionConfig(slug);
  };

  jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
  jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup);
};

const mockQuestionCaches = (questionCachesBySlug = {}) => {
  const readSpy = jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace, slug) => {
    if (namespace !== 'questionsCache') return {};
    return questionCachesBySlug[slug] || {};
  });
  return { promise, resolve, reject };
};

const renderPile = (props = {}) =>
  renderSurveyPileViewMode(
    {
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
      runtimeStrategy: createPileViewRuntimeStrategy(),
      ...props,
    },
    { route: '/session/edge' },
  );

const createScopedQuestionCaches = () => ({
  edge: {
    84532: {
      ...defaultCacheNode,
      questions: {
        q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' },
      },
    },
  },
  alpha: {
    84532: {
      ...defaultCacheNode,
      questions: {
        q2: { id: 'q2', prompt: 'Alpha 2', type: 'freeform' },
        qBlockedAlpha: { id: 'qBlockedAlpha', prompt: 'Blocked alpha', type: 'freeform' },
      },
      questionResponses: {
        q2: {
          '0xabc': { answer: { value: 'yes', encrypted: false }, additional: { value: '', encrypted: false } },
        },
      },
    },
  },
  beta: {
    84532: {
      ...defaultCacheNode,
      questions: {
        q3: { id: 'q3', prompt: 'Beta 3', type: 'freeform' },
      },
    },
  },
});

const cappedScanProgress = (overrides = {}) => ({
  slug: 'edge',
  phase: 'scan',
  totalBlocks: 50000,
  requestedTotalBlocks: 234000,
  wasCapped: true,
  scannedBlocks: 50000,
  remainingBlocks: 184000,
  startedAtMs: 1000,
  ...overrides,
});

describe('SurveyTool pile session scope and progress', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('keeps pile warm-seed questions session-local on /session routes even when list scope includes other slugs', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);
      const strictLookup = (slug) => {
        if (slug === 'edge') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        if (slug === 'alpha') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: ['qblockedalpha'] };
        if (slug === 'beta') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
      };
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup);

      const questionCachesBySlug = {
        edge: {
          '84532': {
            questions: {
              q1: { id: 'q1', prompt: 'Edge 1' },
            },
            questionResponses: {},
          },
        },
        alpha: {
          '84532': {
            questions: {
              q2: { id: 'q2', prompt: 'Alpha 2' },
              qBlockedAlpha: { id: 'qBlockedAlpha', prompt: 'Blocked alpha' },
            },
            questionResponses: {},
          },
        },
        beta: {
          '84532': {
            questions: {
              q3: { id: 'q3', prompt: 'Beta 3' },
            },
            questionResponses: {},
          },
        },
      };
      const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace !== 'questionsCache') return {};
        return questionCachesBySlug[slug] || {};
      });

      const shell = new SurveyTool({
        minifiedMode: 'pile',
        network: { id: 84532 },
        networkChainId: 84532,
        account: '',
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
        isQuestionCacheReady: true,
        questionResponsesNonce: 1,
        questionsCacheNonce: 1,
        onFilterChange: jest.fn(),
      });
      const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

      const idsLower = subject.state.pileQuestions.map((q) => String(q.id).toLowerCase());
      expect(idsLower).toEqual(['q1']);
      expect(subject.state.allQuestionsForFilter.map((q) => String(q.id).toLowerCase())).toEqual(['q1']);
      const byIdLower = new Map(
        subject.state.pileQuestions.map((q) => [String(q.id).toLowerCase(), q])
      );
      expect(byIdLower.get('q1')?.sessionSlug).toBe('edge');
      expect(byIdLower.has('q2')).toBe(false);
      expect(byIdLower.has('q3')).toBe(false);
      expect(idsLower).not.toContain('qblockedalpha');
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
      expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
      expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'beta', { clone: false });
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('keeps pile question loads session-local on /session routes even when list scope includes other slugs', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);
      const strictLookup = (slug) => {
        if (slug === 'edge') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        if (slug === 'alpha') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        if (slug === 'beta') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
      };
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup);

      const questionCachesBySlug = {
        edge: {
          '84532': {
            questions: {
              q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' },
            },
            questionResponses: {},
          },
        },
        alpha: {
          '84532': {
            questions: {
              q2: { id: 'q2', prompt: 'Alpha 2', type: 'freeform' },
            },
            questionResponses: {
              q2: {
                '0xabc': { answer: { value: 'yes', encrypted: false }, additional: { value: '', encrypted: false } },
              },
            },
          },
        },
        beta: {
          '84532': {
            questions: {
              q3: { id: 'q3', prompt: 'Beta 3', type: 'freeform' },
            },
            questionResponses: {},
          },
        },
      };
      const readSpy = jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace, slug) => {
        if (namespace !== 'questionsCache') return {};
        return questionCachesBySlug[slug] || {};
      });
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace !== 'questionsCache') return {};
        return questionCachesBySlug[slug] || {};
      });

    expect(await screen.findByText('Edge 1')).toBeInTheDocument();
    expect(screen.queryByText('Alpha 2')).toBeNull();
    expect(screen.queryByText('Beta 3')).toBeNull();
    expect(screen.queryByText('Blocked alpha')).toBeNull();
    expect(readSpy).toHaveBeenCalledWith('questionsCache', 'edge');
    expect(readSpy).not.toHaveBeenCalledWith('questionsCache', 'alpha');
    expect(readSpy).not.toHaveBeenCalledWith('questionsCache', 'beta');
    // port note: dropped direct QuestionFilter prop inspection; the scoped prefix is
    // asserted through the same helper used to render that prop, while QuestionFilter
    // storage behavior is covered in QuestionFilter.pipelineAutosave.test.ts.
    expect(
      buildQuestionFilterStorageKeyPrefix(
        {
          activeSessionSlug: 'edge',
          sessionSlug: 'edge',
          network: { id: 84532 },
          networkChainId: 84532,
        },
        'edge',
      ),
    ).toBe('dg:filters:edge');
  });

  it('renders capped pile loading progress with the requested total block count', async () => {
    mockQuestionCaches({ edge: { 84532: defaultCacheNode } });

    renderPile({
      isQuestionCacheReady: false,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      questionScanProgress: {
        slug: 'edge',
        phase: 'scan',
        totalBlocks: 50000,
        requestedTotalBlocks: 234000,
        wasCapped: true,
        scannedBlocks: 50000,
        remainingBlocks: 184000,
        startedAtMs: 1000,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      hasHiddenGatedQuestions: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };

  it('tracks pile loading progress relative to the current refresh window', async () => {
    mockQuestionCaches({ edge: { 84532: defaultCacheNode } });
    const { rerenderSurveyQuestions } = renderPile({
      isQuestionCacheReady: false,
      questionScanProgress: cappedScanProgress(),
    });

    subject.props = {
      ...subject.props,
      questionScanProgress: {
        slug: 'edge',
        phase: 'scan',
        totalBlocks: 50000,
        requestedTotalBlocks: 234000,
        wasCapped: true,
        scannedBlocks: 100000,
        remainingBlocks: 134000,
        startedAtMs: 1000,
      },
    };

    const tree = subject.render();

    expect(treeHasText(tree, '134,000 blocks left')).toBe(true);
    expect(treeHasText(tree, '50,000 / 184,000')).toBe(true);
  });

});
