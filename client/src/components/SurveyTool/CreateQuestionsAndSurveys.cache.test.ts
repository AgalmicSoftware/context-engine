import {
  E2E_TESTIDS,
  REGISTRY_CACHE_KEY,
  arweaveScripts,
  cacheScripts,
  collectTreeNodes,
  contractScripts,
  cryptoUtils,
  getChainById,
  getDefaultHttpRpc,
  makeInstance,
  nodeHasClassName,
  normalizeArweaveUrl,
  peekCacheSyncMock,
  renderToStaticMarkup,
  resourceKeys,
  sessionRegistryStore,
  sessionRegistryUtils,
  subscribeCacheUpdatesMock,
  treeHasText,
  writeCacheOptimisticMock,
  hasSubmittedResourcesInManagedCache,
  readManagedCacheSnapshot,
  sanitizeDocumentUrls,
  selectManagedNetBucketSnapshot,
} from './CreateQuestionsAndSurveys';
import { renderToStaticMarkup } from 'react-dom/server';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import { arweaveScripts } from '../../utilities/arweave/arweaveScripts';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import * as resourceKeys from '../../utilities/session/resourceKeys.js';
import contractScripts from '../../utilities/web3/contractScripts.js';
import { sessionRegistryStore, sessionRegistryUtils } from '../../utilities/web3/sessionRegistry.js';
import { getChainById, getDefaultHttpRpc } from '../../variables/chains.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  peekCacheSync: jest.fn(() => null),
  removeCache: jest.fn(),
  subscribeCacheUpdates: jest.fn(() => () => {}),
  writeCache: jest.fn(),
  writeCacheOptimistic: jest.fn(),
}));

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';
type TreeNode = any;
type TreePredicate = (node: TreeNode) => boolean;
type CreateQuestionsAndSurveysProps = Record<string, any>;
const peekCacheSyncMock = cacheScripts.peekCacheSync as jest.Mock;
const subscribeCacheUpdatesMock = cacheScripts.subscribeCacheUpdates as jest.Mock;
const writeCacheOptimisticMock = cacheScripts.writeCacheOptimistic as jest.Mock;

const makeInstance = (props: CreateQuestionsAndSurveysProps = {}): any => {
  const instance = new CreateQuestionsAndSurveys({
    network: { id: 84532 },
    activeSessionSlug: 'edge',
    ...props,
  }) as any;
  instance._isMounted = true;
  instance.setState = jest.fn((update, cb) => {
    const patch = typeof update === 'function'
      ? update(instance.state, instance.props)
      : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });
  return instance;
};

const collectTreeNodes = (node: TreeNode, predicate: TreePredicate, acc: TreeNode[] = []): TreeNode[] => {
  if (node == null) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => collectTreeNodes(child, predicate, acc));
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  return collectTreeNodes(node?.props?.children, predicate, acc);
};

const treeHasText = (node: TreeNode, text: string): boolean => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

const nodeHasClassName = (node: TreeNode, className: string): boolean => {
  const raw = node?.props?.className;
  if (!raw) return false;
  return String(raw).split(/\s+/).includes(className);
};

describe('CreateQuestionsAndSurveys managed cache reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    try { delete (globalThis as any).CE_ARWEAVE_GATEWAY_URL; } catch (_) {}
    try { delete (globalThis as any).CE_ARWEAVE_AR_IO_URL; } catch (_) {}
    try { delete (globalThis as any).CE_ARWEAVE_DIRECT_TO_AR_IO; } catch (_) {}
  });

  it('reads managed cache snapshots with clone disabled', () => {
    peekCacheSyncMock.mockReturnValue({ surveys: ['a'] });

    const snapshot = readManagedCacheSnapshot('bookmarksCache', 'edge');

    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith(
      'bookmarksCache',
      'edge',
      { clone: false }
    );
    expect(snapshot).toEqual({ surveys: ['a'] });
  });

  it('selects a network bucket with numeric-key fallback', () => {
    peekCacheSyncMock.mockReturnValue({
      84532: {
        surveys: {
          a: { id: 'a' },
        },
      },
    });

    const bucket = selectManagedNetBucketSnapshot('surveysCache', 'edge', '84532');

    expect(bucket).toEqual({
      surveys: {
        a: { id: 'a' },
      },
    });
  });

  it('checks submitted resources in managed cache for survey and question flows', () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        surveys: { '0xsurvey': { id: '0xsurvey' } },
        questions: { q1: { id: 'q1' }, q2: { id: 'q2' } },
      },
    });

    expect(hasSubmittedResourcesInManagedCache({
      slug: 'edge',
      netId: '84532',
      surveyAddedSuccessfully: true,
      surveyId: '0xSurvey',
    })).toBe(true);

    expect(hasSubmittedResourcesInManagedCache({
      slug: 'edge',
      netId: '84532',
      questionsAddedSuccessfully: true,
      questionIds: ['q1', 'q2'],
    })).toBe(true);
  });

  it('rejects incomplete submitted resource cache hits', () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        questions: { q1: { id: 'q1' } },
      },
    });

    expect(hasSubmittedResourcesInManagedCache({
      slug: 'edge',
      questionsAddedSuccessfully: true,
      questionIds: ['q1'],
    })).toBe(false);

    expect(hasSubmittedResourcesInManagedCache({
      slug: 'edge',
      netId: '84532',
      questionsAddedSuccessfully: true,
      questionIds: ['q1', 'q2'],
    })).toBe(false);

    expect(hasSubmittedResourcesInManagedCache({
      slug: 'edge',
      netId: '84532',
      questionsAddedSuccessfully: true,
      questionIds: 'q1' as unknown as string[],
    })).toBe(false);
  });

  it('copies survey links with session query params when an active session slug exists', () => {
    const instance = makeInstance({ activeSessionSlug: 'edge' });
    const originalClipboard = navigator.clipboard;
    const writeText = jest.fn().mockResolvedValue(undefined);
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
      instance.setCopySuccessState = jest.fn();

      instance.copySurveyLinkToClipboard('0xSurvey');

      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/survey/0xSurvey?session=edge`);
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('canonicalizes copied survey links for reserved session aliases', () => {
    const originalClipboard = navigator.clipboard;
    const writeText = jest.fn().mockResolvedValue(undefined);
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      const debateInstance = makeInstance({ activeSessionSlug: 'DEBATE' });
      debateInstance.setCopySuccessState = jest.fn();
      debateInstance.copySurveyLinkToClipboard('0xSurvey');

      const generalInstance = makeInstance({ activeSessionSlug: 'general' });
      generalInstance.setCopySuccessState = jest.fn();
      generalInstance.copySurveyLinkToClipboard('0xSurvey');

      expect(writeText).toHaveBeenNthCalledWith(1, `${window.location.origin}/survey/0xSurvey?session=DEBATE`);
      expect(writeText).toHaveBeenNthCalledWith(2, `${window.location.origin}/survey/0xSurvey`);
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('blocks submit when any question prompt is blank after trim', async () => {
    const addQuestionsSpy = jest.spyOn(contractScripts, 'addQuestions').mockResolvedValue({
      receipt: { status: 1 },
      uploadedQuestions: [],
    });

    try {
      const instance = makeInstance({
        loginComplete: true,
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'edge',
        network: { id: 84532 },
      });

      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        questions: [{
          id: 'q1',
          type: 'freeform',
          prompt: '   ',
          tags: [],
        }],
      };

      await instance.createSurvey();

      expect(instance.state.formValidationError).toBe('Question 1 prompt cannot be blank.');
      expect(addQuestionsSpy).not.toHaveBeenCalled();
      expect(instance.state.isSubmitting).toBe(false);
    } finally {
      addQuestionsSpy.mockRestore();
    }
  });

  it('accepts http(s), root-relative, Arweave, and Lit document URLs while blocking unsafe hrefs', () => {
    const txId = 'a'.repeat(43);
    const arUrl = `ar://${txId}`;
    const litUrl = `lit://arweave/${txId}`;
    const legacyLitUrl = `lit+ar://${txId}`;
    const relativeViewerUrl = `/session/0xSessionToken/docs?__ceDocTx=${txId}&__ceDocStorage=lit-arweave&__ceDocKind=link`;
    const unsafeJavascriptUrl = ['java', 'script:alert(1)'].join('');
    const unsafeDataUrl = 'data:text/html,<script>alert(1)</script>';

    expect(sanitizeDocumentUrls([
      'https://example.com/doc',
      'http://example.com/alt',
      relativeViewerUrl,
      arUrl,
      litUrl,
      legacyLitUrl,
      unsafeJavascriptUrl,
      unsafeDataUrl,
    ])).toEqual([
      'https://example.com/doc',
      'http://example.com/alt',
      relativeViewerUrl,
      arUrl,
      litUrl,
      legacyLitUrl,
    ]);

    const allowedInstance = makeInstance();
    allowedInstance.state = {
      ...allowedInstance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      questions: [],
      documentURLs: ['https://safe.example/doc'],
      docURLInput: relativeViewerUrl,
    };

    allowedInstance.addDocumentURL();

    expect(allowedInstance.state.docURLError).toBe('');
    expect(allowedInstance.state.documentURLs).toEqual([
      'https://safe.example/doc',
      relativeViewerUrl,
    ]);
    const allowedAnchorHrefs = collectTreeNodes(allowedInstance.render(), (node) => node?.type === 'a')
      .map((node) => node?.props?.href)
      .filter(Boolean);
    expect(allowedAnchorHrefs).toContain(relativeViewerUrl);

    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      questions: [],
      documentURLs: [
        'https://safe.example/doc',
        arUrl,
        litUrl,
        legacyLitUrl,
        unsafeJavascriptUrl,
        unsafeDataUrl,
      ],
      docURLInput: unsafeJavascriptUrl,
    };

    instance.addDocumentURL();

    expect(instance.state.docURLError).toBe(
      'Document URLs must use http://, https://, a root-relative path (/...), ar://, or a supported Lit encrypted-doc URL.'
    );
    expect(instance.state.documentURLs).toEqual([
      'https://safe.example/doc',
      arUrl,
      litUrl,
      legacyLitUrl,
      unsafeJavascriptUrl,
      unsafeDataUrl,
    ]);

    const markup = renderToStaticMarkup(instance.render());
    expect(markup).toContain('href="https://safe.example/doc"');
    expect(markup).toContain(
      `href="${normalizeArweaveUrl(arUrl, { contextLabel: 'create_survey_document_url' })}"`
    );
    expect(markup).toContain(`Encrypted doc (${litUrl})`);
    expect(markup).toContain(`Encrypted doc (${legacyLitUrl})`);
    expect(markup).not.toContain(`href="${litUrl}"`);
    expect(markup).not.toContain(`href="${legacyLitUrl}"`);
    expect(markup).not.toContain(`href="${unsafeJavascriptUrl}"`);
    expect(markup).not.toContain('href="data:text/html');
  });

  it('coalesces cache update events and marks cache watch as loaded', () => {
    jest.useFakeTimers();
    let onUpdate: ((event: any) => void) | null = null;
    subscribeCacheUpdatesMock.mockImplementation((handler: (event: any) => void) => {
      onUpdate = handler;
      return () => {};
    });
    let reads = 0;
    peekCacheSyncMock.mockImplementation(() => {
      reads += 1;
      if (reads < 2) {
        return {
          '84532': {
            surveys: {},
          },
        };
      }
      return {
        '84532': {
          surveys: {
            '0xsurvey': { id: '0xsurvey' },
          },
        },
      };
    });

    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      surveyAddedSuccessfully: true,
      questionsAddedSuccessfully: false,
      lastSubmittedSurveyId: '0xSurvey',
      uploadedQuestions: [],
      cacheLoaded: false,
      submitStep: 2,
    };

    instance.startCacheWatch();
    expect(instance.state.cacheLoaded).toBe(false);
    expect(typeof onUpdate).toBe('function');

    const updateHandler = onUpdate as ((event: any) => void) | null;
    if (updateHandler) {
      updateHandler({ namespace: 'surveysCache', slug: 'edge', action: 'write' });
    }
    if (instance._cacheWatchCoalescer && typeof instance._cacheWatchCoalescer.flushNow === 'function') {
      instance._cacheWatchCoalescer.flushNow();
    } else {
      jest.advanceTimersByTime(20);
    }

    expect(instance.state.cacheLoaded).toBe(true);
    expect(instance.state.submitStep).toBe(3);
    expect(instance._cacheWatchTimer).toBeNull();
    jest.useRealTimers();
  });

  it('keeps polling fallback active when subscription events are absent', () => {
    jest.useFakeTimers();
    subscribeCacheUpdatesMock.mockImplementation(() => () => {});
    let reads = 0;
    peekCacheSyncMock.mockImplementation(() => {
      reads += 1;
      if (reads < 3) {
        return {
          '84532': {
            questions: {
              q1: { id: 'q1' },
            },
          },
        };
      }
      return {
        '84532': {
          questions: {
            q1: { id: 'q1' },
            q2: { id: 'q2' },
          },
        },
      };
    });

    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      surveyAddedSuccessfully: false,
      questionsAddedSuccessfully: true,
      uploadedQuestions: [{ questionId: 'q1' }, { questionId: 'q2' }],
      cacheLoaded: false,
      submitStep: 2,
    };

    instance.startCacheWatch();
    expect(instance.state.cacheLoaded).toBe(false);

    jest.advanceTimersByTime(2100);

    expect(instance.state.cacheLoaded).toBe(true);
    expect(instance.state.submitStep).toBe(3);
    jest.useRealTimers();
  });

  it('treats question cache seeding as best-effort when write-through fails', async () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    writeCacheOptimisticMock
      .mockRejectedValueOnce(new Error('quota exceeded'))
      .mockResolvedValue(undefined);

    const instance = makeInstance();
    instance.getSessionConfig = jest.fn(() => ({
      slug: 'edge',
      networkChainId: 84532,
      contracts: { surveys: { chainId: 84532 } },
    }));

    await expect(instance.seedUploadedQuestionsCache({
      questionDataArray: [
        { id: 'q1', type: 'freeform', prompt: 'Question 1', creator: '0xabc' },
      ],
      uploadedQuestions: [
        { questionId: 'q1', arweaveTxId: 'arweave-tx-1' },
      ],
      sourceQuestions: [
        { id: 'q1', type: 'freeform', prompt: 'Question 1' },
      ],
    })).resolves.toBe(false);

    expect(writeCacheOptimisticMock).toHaveBeenCalled();
  });

  it('keeps question cache write-through scoped to unresolved non-general slugs', async () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    writeCacheOptimisticMock.mockResolvedValue(undefined);

    const instance = makeInstance({
      activeSessionSlug: 'missing-session',
      sessionSlug: 'missing-session',
      network: { id: 84532 },
    });
    instance.getSessionConfig = jest.fn(() => ({
      slug: 'missing-session',
      networkChainId: 84532,
      contracts: {},
    }));

    await expect(instance.seedUploadedQuestionsCache({
      questionDataArray: [
        { id: 'q1', type: 'freeform', prompt: 'Question 1', creator: '0xabc' },
      ],
      uploadedQuestions: [
        { questionId: 'q1', arweaveTxId: 'arweave-tx-1' },
      ],
      sourceQuestions: [
        { id: 'q1', type: 'freeform', prompt: 'Question 1' },
      ],
    })).resolves.toBe(true);

    expect(writeCacheOptimisticMock).toHaveBeenCalledWith(
      'questionsCache',
      'missing-session',
      expect.any(Object)
    );
    expect(writeCacheOptimisticMock).not.toHaveBeenCalledWith(
      'questionsCache',
      '',
      expect.anything()
    );
  });

  it('seeds uploaded question cache with storageRef-first compatibility fields', async () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    writeCacheOptimisticMock.mockResolvedValue(undefined);

    const instance = makeInstance();
    instance.getSessionConfig = jest.fn(() => ({
      slug: 'edge',
      networkChainId: 84532,
      contracts: { surveys: { chainId: 84532 } },
    }));

    await expect(instance.seedUploadedQuestionsCache({
      questionDataArray: [
        {
          id: 'q1',
          type: 'freeform',
          prompt: 'Question 1',
          creator: '0xabc',
          arweaveTxId: 'legacy-tx',
        },
      ],
      uploadedQuestions: [
        {
          questionId: 'q1',
          storageRef: { backend: 'arweave', id: 'preferred-tx', resource: 'questions' },
        },
      ],
      sourceQuestions: [
        { id: 'q1', type: 'freeform', prompt: 'Question 1' },
      ],
    })).resolves.toBe(true);

    const cacheWrite = writeCacheOptimisticMock.mock.calls.find(([namespace]) => namespace === 'questionsCache');
    const writtenQuestions = cacheWrite?.[2]?.['84532']?.questions || {};
    expect(writtenQuestions.q1.arweaveTxId).toBe('preferred-tx');
    expect(writtenQuestions.q1.storageRef).toEqual({
      backend: 'arweave',
      id: 'preferred-tx',
      uri: 'ar://preferred-tx',
      resource: 'questions',
    });
  });

  it('still writes question cache through the general bucket for general-session authoring', async () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    writeCacheOptimisticMock.mockResolvedValue(undefined);

    const instance = makeInstance({
      activeSessionSlug: '',
      sessionSlug: '',
      network: { id: 84532 },
    });
    instance.getSessionConfig = jest.fn(() => ({
      slug: '',
      networkChainId: 84532,
      contracts: {},
    }));

    await expect(instance.seedUploadedQuestionsCache({
      questionDataArray: [
        { id: 'q1', type: 'freeform', prompt: 'Question 1', creator: '0xabc' },
      ],
      uploadedQuestions: [
        { questionId: 'q1', arweaveTxId: 'arweave-tx-1' },
      ],
      sourceQuestions: [
        { id: 'q1', type: 'freeform', prompt: 'Question 1' },
      ],
    })).resolves.toBe(true);

    expect(writeCacheOptimisticMock).toHaveBeenCalledWith(
      'questionsCache',
      '',
      expect.any(Object)
    );
  });

  it('seeds question cache only for the primary authoring slug when stale slug hints exist', async () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    writeCacheOptimisticMock.mockResolvedValue(undefined);

    const instance = makeInstance({
      activeSessionSlug: 'primary-session',
      sessionSlug: 'stale-session',
      network: { id: 84532 },
    });
    instance.getSessionConfig = jest.fn(() => ({
      slug: 'primary-session',
      networkChainId: 84532,
      contracts: {},
    }));
    instance.getActiveSessionSlug = jest.fn(() => 'stale-session');

    await expect(instance.seedUploadedQuestionsCache({
      questionDataArray: [
        { id: 'q1', type: 'freeform', prompt: 'Question 1', creator: '0xabc' },
      ],
      uploadedQuestions: [
        { questionId: 'q1', arweaveTxId: 'arweave-tx-1' },
      ],
      sourceQuestions: [
        { id: 'q1', type: 'freeform', prompt: 'Question 1' },
      ],
    })).resolves.toBe(true);

    expect(writeCacheOptimisticMock).toHaveBeenCalledTimes(1);
    expect(writeCacheOptimisticMock).toHaveBeenCalledWith(
      'questionsCache',
      'primary-session',
      expect.any(Object)
    );
  });

  it('does not clear managed caches after standalone question submit success', async () => {
    const addQuestionsSpy = jest.spyOn(contractScripts, 'addQuestions').mockResolvedValue({
      receipt: { status: 1 },
      uploadedQuestions: [{ questionId: 'q1', arweaveTxId: 'tx-1' }],
    });

    const instance = makeInstance({
      loginComplete: true,
      provider: 'web3auth',
      account: '0xabc',
      activeSessionSlug: 'edge',
      network: { id: 84532 },
    });

    instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
      slug: 'edge',
      sessionName: 'edge',
      networkChainId: 84532,
      contracts: { surveys: { chainId: 84532 } },
    });
    instance.resolveGateOptions = jest.fn(() => ({ gateMap: {} }));
    instance.clearUnfinishedSurveyDraft = jest.fn();
    instance.seedUploadedQuestionsCache = jest.fn().mockResolvedValue(true);
    instance.startCacheWatch = jest.fn();
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      title: '',
      questions: [{
        id: 'q1',
        type: 'freeform',
        prompt: 'Question 1',
        tags: [],
      }],
      documentURLs: [],
      surveyHash: '',
    };

    await instance.createSurvey();

    expect(instance.seedUploadedQuestionsCache).toHaveBeenCalled();
    expect(cacheScripts.removeCache).not.toHaveBeenCalled();
    expect(addQuestionsSpy).toHaveBeenCalled();
    addQuestionsSpy.mockRestore();
  });

  it('keeps only primitive tags for render and submit paths', async () => {
    const addQuestionsSpy = jest.spyOn(contractScripts, 'addQuestions').mockResolvedValue({
      receipt: { status: 1 },
      uploadedQuestions: [{ questionId: 'q1', arweaveTxId: 'tx-1' }],
    });

    try {
      const instance = makeInstance({
        loginComplete: true,
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'edge',
        network: { id: 84532 },
      });

      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'edge',
        sessionName: 'edge',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      });
      instance.resolveGateOptions = jest.fn(() => ({
        gateMap: {},
        gateOptions: [],
        defaultGateId: '',
      }));
      instance.clearUnfinishedSurveyDraft = jest.fn();
      instance.seedUploadedQuestionsCache = jest.fn().mockResolvedValue(true);
      instance.startCacheWatch = jest.fn();
      instance.state = {
        ...instance.state,
        showAutoTool: false,
        isStandaloneQuestion: true,
        title: '',
        questions: [{
          id: 'q1',
          uiKey: 'q1',
          type: 'freeform',
          prompt: 'Question 1',
          tags: [42, null, true, false, ' topic ', {}, ['nested']],
          aiGeneratedTagsFromSource: [42, null, true, false, ' topic ', {}, ['nested']],
          currentTagInputValue: '',
          isGeneratingTags: false,
        }],
        documentURLs: [],
        surveyHash: '',
      };

      const markup = renderToStaticMarkup(instance.render());
      expect(markup).not.toContain('[object Object]');

      await instance.createSurvey();

      expect(addQuestionsSpy).toHaveBeenCalled();
      expect(addQuestionsSpy.mock.calls[0][2][0].tags).toEqual(['42', 'true', 'false', 'topic']);
    } finally {
      addQuestionsSpy.mockRestore();
    }
  });

  it('keeps standalone question submit scoped to the unresolved requested slug when exact session config is missing', async () => {
    const addQuestionsSpy = jest
      .spyOn(contractScripts, 'addQuestions')
      .mockRejectedValue(new Error('[addQuestions] Missing surveys contract address for session slug "missing-session".'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const instance = makeInstance({
        loginComplete: true,
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'missing-session',
        network: { id: 84532 },
      });

      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'missing-session',
        networkChainId: 84532,
        contracts: {},
      });
      instance.resolveGateOptions = jest.fn(() => ({ gateMap: {} }));
      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        title: '',
        questions: [{
          id: 'q1',
          type: 'freeform',
          prompt: 'Question 1',
          tags: [],
        }],
        documentURLs: [],
        surveyHash: '',
      };

      await instance.createSurvey();

      expect(addQuestionsSpy).toHaveBeenCalledWith(
        'web3auth',
        ['q1'],
        expect.any(Array),
        [expect.any(String)],
        expect.objectContaining({
          slug: 'missing-session',
          networkChainId: 84532,
        })
      );
      expect(instance.state.isSubmitting).toBe(false);
      expect(instance.state.submissionError).toContain('missing-session');
    } finally {
      consoleSpy.mockRestore();
      addQuestionsSpy.mockRestore();
    }
  });

  it('resets submit progress UI when the survey Arweave upload fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const latestBlockSpy = jest.spyOn(contractScripts, 'getLatestBlockNumber').mockResolvedValue(123);
    const addSurveySpy = jest.spyOn(contractScripts, 'addSurveyWithQuestions').mockResolvedValue({
      uploadedQuestions: [],
      receipt: { status: 1 },
    });
    const keySpy = jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({
      arweaveJwk: '{"kty":"RSA"}',
    } as any);
    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave').mockRejectedValue(new Error('upload failed'));

    try {
      const instance = makeInstance({
        loginComplete: true,
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'edge',
        network: { id: 84532 },
      });

      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'edge',
        sessionName: 'edge',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      });
      instance.resolveGateOptions = jest.fn(() => ({ gateMap: {} }));
      instance.state = {
        ...instance.state,
        showAutoTool: false,
        isStandaloneQuestion: false,
        title: 'Survey Title',
        surveyHash: '0xsurvey',
        questions: [{
          id: 'q1',
          uiKey: 'q1',
          type: 'freeform',
          prompt: 'Question 1',
          tags: [],
          currentTagInputValue: '',
          aiGeneratedTagsFromSource: [],
          isGeneratingTags: false,
        }],
        documentURLs: ['https://safe.example/doc'],
      };

      await instance.createSurvey();

      expect(uploadSpy).toHaveBeenCalled();
      expect(addSurveySpy).not.toHaveBeenCalled();
      expect(instance.state.isSubmitting).toBe(false);
      expect(instance.state.progress).toBe(0);
      expect(instance.state.showSubmitSteps).toBe(false);
      expect(instance.state.submitStep).toBe(0);
      expect(instance.state.submissionError).toBe('upload failed');
    } finally {
      consoleSpy.mockRestore();
      latestBlockSpy.mockRestore();
      addSurveySpy.mockRestore();
      keySpy.mockRestore();
      uploadSpy.mockRestore();
    }
  });

  it('forces direct Arweave for survey metadata when the effective key is local', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const latestBlockSpy = jest.spyOn(contractScripts, 'getLatestBlockNumber').mockResolvedValue(123);
    const addSurveySpy = jest.spyOn(contractScripts, 'addSurveyWithQuestions').mockResolvedValue({
      uploadedQuestions: [],
      receipt: { status: 1 },
    });
    const keySpy = jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({
      arweaveJwk: '{"kty":"RSA"}',
      source: 'local',
    } as any);
    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave').mockResolvedValue('survey-arweave-tx');
    writeCacheOptimisticMock.mockResolvedValue(undefined);
    peekCacheSyncMock.mockReturnValue({});

    try {
      const instance = makeInstance({
        loginComplete: true,
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'demo-session-2',
        sessionSlug: 'demo-session-2',
        network: { id: 8453, chainId: 8453 },
        networkChainId: 84532,
      });

      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'demo-session-2',
        sessionName: 'Demo Session 2',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      });
      instance.resolveGateOptions = jest.fn(() => ({ gateMap: {} }));
      instance.clearUnfinishedSurveyDraft = jest.fn();
      instance.startCacheWatch = jest.fn();
      instance.state = {
        ...instance.state,
        showAutoTool: false,
        isStandaloneQuestion: false,
        title: 'Fresh Survey',
        surveyHash: '0xsurvey',
        questions: [{
          id: 'q1',
          uiKey: 'q1',
          type: 'freeform',
          prompt: 'Question 1',
          tags: [],
          currentTagInputValue: '',
          aiGeneratedTagsFromSource: [],
          isGeneratingTags: false,
        }],
        documentURLs: ['https://safe.example/doc'],
      };

      await instance.createSurvey();

      expect(uploadSpy).toHaveBeenCalledWith(
        expect.any(String),
        'json',
        expect.objectContaining({
          arweaveJwk: '{"kty":"RSA"}',
          forceDirectArweaveUpload: true,
          sessionSlug: 'demo-session-2',
        })
      );
      expect(addSurveySpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
      latestBlockSpy.mockRestore();
      addSurveySpy.mockRestore();
      keySpy.mockRestore();
      uploadSpy.mockRestore();
    }
  });

  it('seeds surveys and questions caches after survey creation so deep links can resolve immediately', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const latestBlockSpy = jest.spyOn(contractScripts, 'getLatestBlockNumber').mockResolvedValue(123);
    const addSurveySpy = jest.spyOn(contractScripts, 'addSurveyWithQuestions').mockResolvedValue({
      uploadedQuestions: [],
      receipt: { status: 1 },
    });
    const keySpy = jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({
      arweaveJwk: '{"kty":"RSA"}',
    } as any);
    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave').mockResolvedValue('survey-arweave-tx');
    writeCacheOptimisticMock.mockResolvedValue(undefined);
    peekCacheSyncMock.mockReturnValue({});

    try {
      const instance = makeInstance({
        loginComplete: true,
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'demo-session-2',
        sessionSlug: 'demo-session-2',
        network: { id: 8453, chainId: 8453 },
        networkChainId: 84532,
        sessionConfig: {
          slug: 'demo-session-2',
          sessionName: 'Demo Session 2',
          networkChainId: 84532,
          contracts: { surveys: { chainId: 84532 } },
        },
      });

      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'demo-session-2',
        sessionName: 'Demo Session 2',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      });
      instance.resolveGateOptions = jest.fn(() => ({ gateMap: {} }));
      instance.clearUnfinishedSurveyDraft = jest.fn();
      instance.startCacheWatch = jest.fn();
      instance.state = {
        ...instance.state,
        showAutoTool: false,
        isStandaloneQuestion: false,
        title: 'Fresh Survey',
        surveyHash: '0xsurvey',
        questions: [{
          id: 'q1',
          uiKey: 'q1',
          type: 'freeform',
          prompt: 'Question 1',
          tags: [],
          currentTagInputValue: '',
          aiGeneratedTagsFromSource: [],
          isGeneratingTags: false,
        }],
        documentURLs: ['https://safe.example/doc'],
      };

      await instance.createSurvey();

      expect(addSurveySpy).toHaveBeenCalled();
      const questionsWrite = writeCacheOptimisticMock.mock.calls.find(
        (args: any[]) => args[0] === 'questionsCache'
      );
      const surveysWrite = writeCacheOptimisticMock.mock.calls.find(
        (args: any[]) => args[0] === 'surveysCache'
      );

      expect(questionsWrite).toBeTruthy();
      expect(questionsWrite[1]).toBe('demo-session-2');
      expect(Object.keys(questionsWrite[2])).toEqual(['84532']);
      expect(questionsWrite[2]).toEqual(expect.objectContaining({
        '84532': expect.objectContaining({
          questions: expect.objectContaining({
            q1: expect.objectContaining({
              id: 'q1',
              associatedSurveyId: '0xsurvey',
            }),
          }),
        }),
      }));

      expect(surveysWrite).toBeTruthy();
      expect(surveysWrite[1]).toBe('demo-session-2');
      expect(Object.keys(surveysWrite[2])).toEqual(['84532']);
      expect(surveysWrite[2]).toEqual(expect.objectContaining({
        '84532': expect.objectContaining({
          surveys: expect.objectContaining({
            '0xsurvey': expect.objectContaining({
              surveyID: '0xsurvey',
              id: '0xsurvey',
              title: 'Fresh Survey',
              sessionSlug: 'demo-session-2',
              slug: 'demo-session-2',
              questionIDs: ['q1'],
            }),
          }),
        }),
      }));
      expect(instance.startCacheWatch).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
      latestBlockSpy.mockRestore();
      addSurveySpy.mockRestore();
      keySpy.mockRestore();
      uploadSpy.mockRestore();
    }
  });

  it('watches the resolved session chain bucket after submit when wallet-facing network props differ', () => {
    peekCacheSyncMock.mockImplementation((namespace: any) => {
      if (namespace !== 'surveysCache') return {};
      return {
        '84532': {
          surveys: {
            '0xsurvey': { id: '0xsurvey' },
          },
        },
        '8453': {
          surveys: {},
        },
      };
    });

    const instance = makeInstance({
      activeSessionSlug: 'demo-session-2',
      sessionSlug: 'demo-session-2',
      network: { id: 8453, chainId: 8453, name: 'Base' },
      networkChainId: 84532,
      sessionConfig: {
        slug: 'demo-session-2',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      },
    });
    instance.state = {
      ...instance.state,
      surveyAddedSuccessfully: true,
      questionsAddedSuccessfully: false,
      lastSubmittedSurveyId: '0xSurvey',
      uploadedQuestions: [],
      cacheLoaded: false,
      submitStep: 2,
    };

    instance.startCacheWatch();

    expect(instance.state.cacheLoaded).toBe(true);
    expect(instance.state.submitStep).toBe(3);
    expect(instance._cacheWatchTimer).toBeNull();
  });

  it('keeps authoring lock options empty for unresolved non-general slugs even when the general session is authoritative', () => {
    const priorRegistryCache = localStorage.getItem(REGISTRY_CACHE_KEY);
    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify({
      sessions: {
        '': {
          slug: '',
          sessionName: 'Registry General',
          networkChainId: 84532,
          __registry: {
            gateAuthority: 'onchain',
            gatesByResource: {
              questionResponses: {
                gateId: 'question_gate',
                sbtAddresses: ['0x1111111111111111111111111111111111111111'],
                lookupStatus: 'ok',
              },
              default: {
                gateId: 'default_gate',
                sbtAddresses: ['0x2222222222222222222222222222222222222222'],
                lookupStatus: 'ok',
              },
            },
          },
          sponsored: {
            defaultGateId: 'default_gate',
            gates: {
              question_gate: {
                label: 'Registry questionResponses gate',
                sbtAddresses: ['0x1111111111111111111111111111111111111111'],
                mode: 'all',
              },
              default_gate: {
                label: 'Registry default gate',
                sbtAddresses: ['0x2222222222222222222222222222222222222222'],
                mode: 'any',
              },
            },
          },
        },
      },
    }));

    try {
      const instance = makeInstance({
        activeSessionSlug: 'missing-session',
        sessionSlug: 'missing-session',
      });

      const resolved = instance.getResolvedSessionConfig();
      const { gateOptions, defaultGateId } = instance.resolveGateOptions(
        resolved,
        { isStandaloneQuestion: true }
      );

      expect(resolved).toEqual(expect.objectContaining({
        slug: 'missing-session',
        networkChainId: 84532,
      }));
      expect(instance.resolveLockAudienceSessionName(resolved)).toBe('missing-session');
      expect(defaultGateId).toBe('');
      expect(gateOptions).toEqual([]);
    } finally {
      if (priorRegistryCache == null) {
        localStorage.removeItem(REGISTRY_CACHE_KEY);
      } else {
        localStorage.setItem(REGISTRY_CACHE_KEY, priorRegistryCache);
      }
    }
  });

  it('keeps submit-time registry refresh scoped to the unresolved requested slug when exact session config is missing', async () => {
    const fetchSpy = jest
      .spyOn(sessionRegistryUtils, 'fetchSessionFromRegistry')
      .mockResolvedValue(null);
    const upsertSpy = jest
      .spyOn(sessionRegistryUtils, 'upsertSessionRegistryCache')
      .mockImplementation(() => null);

    try {
      const instance = makeInstance({
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'missing-session',
        sessionSlug: 'missing-session',
        network: { id: 84532, chainId: 84532 },
      });

      const resolved = await instance.ensureResolvedSessionConfigForSubmit({
        slug: 'missing-session',
        networkChainId: 84532,
        contracts: {},
      });

      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({
        chainId: 84532,
        slug: 'missing-session',
        providerLike: 'web3auth',
        account: '0xabc',
      }));
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(resolved).toEqual(expect.objectContaining({
        slug: 'missing-session',
        networkChainId: 84532,
        contracts: {},
      }));
    } finally {
      fetchSpy.mockRestore();
      upsertSpy.mockRestore();
    }
  });

  it('uses the session chain for wagmi network guard even when the wallet-facing network prop is Base mainnet', async () => {
    const instance = makeInstance({
      provider: 'wagmi',
      loginComplete: true,
      account: '0xabc',
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      network: { id: 8453, chainId: 8453, name: 'Base' },
      networkChainId: 84532,
      sessionConfig: {
        slug: 'edge',
        networkChainId: 84532,
        contracts: {
          surveys: { address: '0x1111111111111111111111111111111111111111', chainId: 84532 },
        },
      },
    });
    instance.getWalletChainId = jest.fn().mockResolvedValue('0x2105');
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      questions: [{
        id: 'q1',
        type: 'freeform',
        prompt: 'Prompt 1',
        tags: [],
      }],
    };

    await instance.createSurvey();

    expect(instance.state.needsNetworkSwitch).toBe(true);
    expect(instance.state.isSubmitting).toBe(false);
  });

  it('updates associated survey ids without regenerating question ids', () => {
    const instance = makeInstance();
    instance.saveToLocalStorage = jest.fn();
    instance.generateQuestionId = jest.fn(() => 'regenerated-id');
    instance.state = {
      ...instance.state,
      questions: [{
        id: 'existing-id',
        type: 'multichoice',
        prompt: 'Pick one',
        options: ['Alpha'],
        singleSelect: false,
        associatedSurveyId: '',
      }],
    };

    instance.handleAssociatedSurveyIdChange(0, 'survey-2');

    expect(instance.generateQuestionId).not.toHaveBeenCalled();
    expect(instance.state.questions[0]).toMatchObject({
      id: 'existing-id',
      associatedSurveyId: 'survey-2',
    });
    expect(instance.saveToLocalStorage).toHaveBeenCalled();
  });

  it('uses scoped litHooks props for locked question submits when global hooks are absent', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const stopAfterLitGuard = new Error('passed lit hook guard');
    try {
      try { delete (window as any).__litHooks; } catch (_) {}
      try { delete (window as any).litHooks; } catch (_) {}
      const instance = makeInstance({
        provider: 'web3auth',
        loginComplete: true,
        account: '0xabc',
        activeSessionSlug: 'demo-2',
        sessionSlug: 'demo-2',
        network: { id: 84532, chainId: 84532 },
        networkChainId: 84532,
        litHooks: { saveKey: jest.fn() },
        sessionConfig: {
          slug: 'demo-2',
          networkChainId: 84532,
        },
      });
      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'demo-2',
        networkChainId: 84532,
      });
      instance.resolveGateOptions = jest.fn(() => ({
        gateMap: {
          default: {
            id: 'default',
            gateId: 'default',
            label: 'Default gate',
            sbtAddress: '0x0000000000000000000000000000000000000101',
            chainId: 84532,
            mode: 'any',
          },
        },
      }));
      instance.removeDuplicateQuestions = jest.fn(() => {
        throw stopAfterLitGuard;
      });
      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        questions: [{
          id: 'q1',
          type: 'freeform',
          prompt: 'Prompt 1',
          tags: [],
          lockGateIds: ['default'],
        }],
      };

      await instance.createSurvey();

      expect(instance.state.submissionError).toBe('passed lit hook guard');
      expect(instance.state.submissionError).not.toContain('Lit hooks not initialized');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('derives Chipotle hooks from session config for locked question submits when globals are absent', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const stopAfterLitGuard = new Error('passed derived lit hook guard');
    try {
      try { delete (window as any).__litHooks; } catch (_) {}
      try { delete (window as any).litHooks; } catch (_) {}
      const sessionConfig = {
        slug: 'chipotle-session',
        networkChainId: 11155420,
        corsWorkerUrl: 'https://worker.example.test',
        __registry: {
          gateAuthority: 'onchain',
          gatesByResource: {
            default: {
              lookupStatus: 'ok',
              sbtAddresses: ['0x0000000000000000000000000000000000000101'],
              chainId: 11155420,
              mode: 'any',
            },
          },
        },
      };
      const instance = makeInstance({
        provider: 'web3auth',
        loginComplete: true,
        account: '0xabc',
        activeSessionSlug: 'chipotle-session',
        sessionSlug: 'chipotle-session',
        network: { id: 11155420, chainId: 11155420 },
        networkChainId: 11155420,
        sessionConfig,
      });
      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue(sessionConfig);
      instance.resolveGateOptions = jest.fn(() => ({
        gateMap: {
          default: {
            id: 'default',
            gateId: 'default',
            label: 'Default gate',
            sbtAddress: '0x0000000000000000000000000000000000000101',
            chainId: 11155420,
            mode: 'any',
          },
        },
      }));
      instance.removeDuplicateQuestions = jest.fn(() => {
        throw stopAfterLitGuard;
      });
      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        questions: [{
          id: 'q1',
          type: 'freeform',
          prompt: 'Prompt 1',
          tags: [],
          lockGateIds: ['default'],
        }],
      };

      await instance.createSurvey();

      expect(instance.state.submissionError).toBe('passed derived lit hook guard');
      expect(instance.state.submissionError).not.toContain('Lit hooks not initialized');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('derives Chipotle hooks from registry cache when submit config lacks worker runtime fields', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const registryConfigSpy = jest.spyOn(sessionRegistryStore, 'getSessionConfig');
    const stopAfterLitGuard = new Error('passed registry-derived lit hook guard');
    try {
      try { delete (window as any).__litHooks; } catch (_) {}
      try { delete (window as any).litHooks; } catch (_) {}
      registryConfigSpy.mockReturnValue({
        slug: 'registry-chipotle',
        networkChainId: 11155420,
        corsWorkerUrl: 'https://worker.example.test',
        lit: { network: 'chipotle' },
        __registry: {
          gateAuthority: 'onchain',
          gatesByResource: {
            default: {
              lookupStatus: 'ok',
              sbtAddresses: ['0x0000000000000000000000000000000000000101'],
              chainId: 11155420,
              mode: 'any',
            },
          },
        },
      });
      const instance = makeInstance({
        provider: 'web3auth',
        loginComplete: true,
        account: '0xabc',
        activeSessionSlug: 'registry-chipotle',
        sessionSlug: 'registry-chipotle',
        network: { id: 11155420, chainId: 11155420 },
        networkChainId: 11155420,
        sessionConfig: {
          slug: 'registry-chipotle',
          networkChainId: 11155420,
          contracts: {
            surveys: { chainId: 11155420 },
          },
        },
      });
      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'registry-chipotle',
        networkChainId: 11155420,
        contracts: {
          surveys: { chainId: 11155420 },
        },
      });
      instance.resolveGateOptions = jest.fn(() => ({
        gateMap: {
          default: {
            id: 'default',
            gateId: 'default',
            label: 'Default gate',
            sbtAddress: '0x0000000000000000000000000000000000000101',
            chainId: 11155420,
            mode: 'any',
          },
        },
      }));
      instance.removeDuplicateQuestions = jest.fn(() => {
        throw stopAfterLitGuard;
      });
      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        questions: [{
          id: 'q1',
          type: 'freeform',
          prompt: 'Prompt 1',
          tags: [],
          lockGateIds: ['default'],
        }],
      };

      await instance.createSurvey();

      expect(registryConfigSpy).toHaveBeenCalledWith('registry-chipotle');
      expect(instance.state.submissionError).toBe('passed registry-derived lit hook guard');
      expect(instance.state.submissionError).not.toContain('Lit hooks not initialized');
    } finally {
      registryConfigSpy.mockRestore();
      consoleSpy.mockRestore();
    }
  });

  it('applies the default session gate to untouched standalone questions before upload', async () => {
    const encryptedPromptEnvelope = {
      version: 'ce-envelope-v1',
      ciphertext: 'ciphertext',
      recipients: [{ type: 'lit-sbt-v1' }],
    };
    const encryptSpy = jest.spyOn(cryptoUtils, 'encryptEnvelopeValue')
      .mockResolvedValue(encryptedPromptEnvelope as any);
    const addQuestionsSpy = jest.spyOn(contractScripts, 'addQuestions').mockResolvedValue({
      receipt: { status: 1 },
      uploadedQuestions: [{ questionId: 'q1', arweaveTxId: 'tx-1' }],
    });

    try {
      const instance = makeInstance({
        provider: 'web3auth',
        loginComplete: true,
        account: '0xabc',
        activeSessionSlug: 'demo-2',
        sessionSlug: 'demo-2',
        network: { id: 84532, chainId: 84532 },
        networkChainId: 84532,
        litHooks: { saveKey: jest.fn() },
      });
      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'demo-2',
        sessionName: 'demo 2',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      });
      instance.resolveGateOptions = jest.fn(() => ({
        gateMap: {
          default_gate: {
            id: 'default_gate',
            gateId: 'default_gate',
            label: 'Default gate',
            sbtAddress: '0x0000000000000000000000000000000000000101',
            chainId: 84532,
            mode: 'any',
          },
        },
        gateOptions: [{
          id: 'default_gate',
          label: 'demo 2',
          badgeLabel: 'demo 2',
          color: '#5affc2',
        }],
        defaultGateId: 'default_gate',
      }));
      instance.clearUnfinishedSurveyDraft = jest.fn();
      instance.seedUploadedQuestionsCache = jest.fn().mockResolvedValue(true);
      instance.startCacheWatch = jest.fn();
      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        title: '',
        questions: [{
          id: 'q1',
          type: 'binary',
          prompt: 'Test Q Encrypted',
          tags: [],
          lockGateIds: [],
        }],
        documentURLs: [],
        surveyHash: '',
      };

      await instance.createSurvey();

      expect(addQuestionsSpy).toHaveBeenCalledTimes(1);
      const uploadedQuestion = addQuestionsSpy.mock.calls[0][2][0];
      expect(uploadedQuestion).toEqual(expect.objectContaining({
        prompt: '[encrypted]',
        promptEncrypted: encryptedPromptEnvelope,
        encryption: expect.objectContaining({
          enabled: true,
          targets: { questions: true, questionTags: true },
        }),
      }));
      expect(uploadedQuestion.prompt).not.toBe('Test Q Encrypted');
      expect(encryptSpy).toHaveBeenCalledWith(
        'Test Q Encrypted',
        expect.objectContaining({
          lit: expect.objectContaining({
            recipients: expect.arrayContaining([
              expect.objectContaining({
                chain: expect.any(String),
                accessControlConditions: expect.any(Array),
              }),
            ]),
          }),
        })
      );
    } finally {
      encryptSpy.mockRestore();
      addQuestionsSpy.mockRestore();
    }
  });

  it('blocks default-gated standalone question submits when Lit hooks are missing', async () => {
    const addQuestionsSpy = jest.spyOn(contractScripts, 'addQuestions').mockResolvedValue({
      receipt: { status: 1 },
      uploadedQuestions: [{ questionId: 'q1', arweaveTxId: 'tx-1' }],
    });

    try {
      try { delete (window as any).__litHooks; } catch (_) {}
      try { delete (window as any).litHooks; } catch (_) {}
      const instance = makeInstance({
        provider: 'web3auth',
        loginComplete: true,
        account: '0xabc',
        activeSessionSlug: 'demo-2',
        sessionSlug: 'demo-2',
        network: { id: 84532, chainId: 84532 },
        networkChainId: 84532,
      });
      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'demo-2',
        sessionName: 'demo 2',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      });
      instance.resolveGateOptions = jest.fn(() => ({
        gateMap: {
          default_gate: {
            id: 'default_gate',
            gateId: 'default_gate',
            label: 'Default gate',
            sbtAddress: '0x0000000000000000000000000000000000000101',
            chainId: 84532,
            mode: 'any',
          },
        },
        gateOptions: [{
          id: 'default_gate',
          label: 'demo 2',
          badgeLabel: 'demo 2',
          color: '#5affc2',
        }],
        defaultGateId: 'default_gate',
      }));
      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        title: '',
        questions: [{
          id: 'q1',
          type: 'binary',
          prompt: 'Test Q Encrypted',
          tags: [],
          lockGateIds: [],
        }],
        documentURLs: [],
        surveyHash: '',
      };

      await instance.createSurvey();

      expect(addQuestionsSpy).not.toHaveBeenCalled();
      expect(instance.state.submissionError).toContain('Lit hooks not initialized');
    } finally {
      addQuestionsSpy.mockRestore();
    }
  });

  it('uses __registry.registryChainId for wagmi network guard when sessionConfig omits networkChainId', async () => {
    const instance = makeInstance({
      provider: 'wagmi',
      loginComplete: true,
      account: '0xabc',
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      network: { id: 8453, chainId: 8453, name: 'Base' },
      sessionConfig: {
        slug: 'edge',
        contracts: {
          surveys: { address: '0x1111111111111111111111111111111111111111' },
        },
        __registry: {
          registryChainId: 84532,
        },
      },
    });
    instance.getWalletChainId = jest.fn().mockResolvedValue('0x2105');
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      questions: [{
        id: 'q1',
        type: 'freeform',
        prompt: 'Prompt 1',
        tags: [],
      }],
    };

    await instance.createSurvey();

    expect(instance.state.needsNetworkSwitch).toBe(true);
    expect(instance.state.isSubmitting).toBe(false);
  });

  it('does not trigger the wagmi network guard when the session chain is unresolved', async () => {
    const stopAfterGuard = new Error('stop after network guard');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const instance = makeInstance({
      provider: 'wagmi',
      loginComplete: true,
      account: '0xabc',
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      network: { id: 8453, chainId: 8453, name: 'Base' },
      sessionConfig: {
        slug: 'edge',
        networkChainId: null,
        contracts: {
          surveys: { address: '0x1111111111111111111111111111111111111111' },
        },
      },
    });
    instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
      slug: 'edge',
      networkChainId: null,
      contracts: {
        surveys: { address: '0x1111111111111111111111111111111111111111' },
      },
    });
    instance.resolveSessionChainId = jest.fn().mockReturnValue(null);
    instance.getWalletChainId = jest.fn().mockResolvedValue('0x2105');
    instance.removeDuplicateQuestions = jest.fn(() => {
      throw stopAfterGuard;
    });
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      questions: [{
        id: 'q1',
        type: 'freeform',
        prompt: 'Prompt 1',
        tags: [],
      }],
    };

    try {
      await instance.createSurvey();

      expect(instance.state.needsNetworkSwitch).toBe(false);
      expect(instance.removeDuplicateQuestions).toHaveBeenCalled();
      expect(instance.state.submissionError).toBe(stopAfterGuard.message);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('adds the missing wallet network with a non-PATH RPC URL', async () => {
    const originalEthereum = (window as any).ethereum;
    const request = jest.fn()
      .mockRejectedValueOnce({ code: 4902 })
      .mockResolvedValueOnce(undefined);
    (window as any).ethereum = { request } as any;
    try {
      const instance = makeInstance({ provider: 'wagmi' });
      instance.resolveSessionChainId = jest.fn(() => 84532);
      instance.resolveTargetNetwork = jest.fn(() => getChainById(84532));

      await instance.switchToCorrectNetwork();

      expect(request).toHaveBeenNthCalledWith(1, {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x14a34' }],
      });
      expect(request).toHaveBeenNthCalledWith(2, {
        method: 'wallet_addEthereumChain',
        params: [expect.objectContaining({
          rpcUrls: [getDefaultHttpRpc(84532, { allowPath: false })],
        })],
      });
    } finally {
      window.ethereum = originalEthereum;
    }
  });

  it('renders the survey/questions toggle immediately on initial load', () => {
    const instance = makeInstance();

    const tree = instance.render();

    expect(treeHasText(tree, 'Survey')).toBe(true);
    expect(treeHasText(tree, 'Questions')).toBe(true);
  });

  it('hides the survey/questions toggle on untouched pile-entry auto mode while keeping the manual switch visible', () => {
    const instance = makeInstance({ hideSurveyQuestionToggleUntilAuthoring: true });

    const tree = instance.render();
    const modeToggles = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'modeToggle'));
    const modeSwitches = collectTreeNodes(
      tree,
      (node) => node?.props?.['data-testid'] === 'ce-create-mode-switch'
    );

    expect(modeToggles).toHaveLength(0);
    expect(modeSwitches).toHaveLength(1);
    expect(treeHasText(modeSwitches[0], 'Manual')).toBe(true);
  });

  it('shows the survey/questions toggle after switching pile entry into manual mode', () => {
    const instance = makeInstance({ hideSurveyQuestionToggleUntilAuthoring: true });
    instance.state = { ...instance.state, showAutoTool: false };

    const tree = instance.render();
    const modeToggles = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'modeToggle'));

    expect(modeToggles).toHaveLength(1);
    expect(treeHasText(modeToggles[0], 'Survey')).toBe(true);
    expect(treeHasText(modeToggles[0], 'Questions')).toBe(true);
  });

  it('shows the survey/questions toggle after AI generation loads authored draft content for pile entry', () => {
    const instance = makeInstance({ hideSurveyQuestionToggleUntilAuthoring: true });
    instance.clearUnfinishedSurveyDraft = jest.fn();
    instance.updateSurveyHash = jest.fn();
    instance.saveToLocalStorage = jest.fn();

    instance.handleAutoQuestionsGenerated(
      [{ type: 'freeform', prompt: 'What should happen next?', tags: [] }],
      [],
      ''
    );

    const tree = instance.render();
    const modeToggles = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'modeToggle'));

    expect(instance.state.showAutoTool).toBe(false);
    expect(instance.state.questions).toHaveLength(1);
    expect(modeToggles).toHaveLength(1);
    expect(treeHasText(modeToggles[0], 'Survey')).toBe(true);
    expect(treeHasText(modeToggles[0], 'Questions')).toBe(true);
  });

  it('renders labeled manual and AI mode switch text instead of icon-only toggle', () => {
    const instance = makeInstance();

    let tree = instance.render();
    let modeSwitches = collectTreeNodes(
      tree,
      (node) => node?.props?.['data-testid'] === 'ce-create-mode-switch'
    );
    expect(modeSwitches).toHaveLength(1);
    expect(treeHasText(modeSwitches[0], 'Manual')).toBe(true);

    instance.state = { ...instance.state, showAutoTool: false };
    tree = instance.render();
    modeSwitches = collectTreeNodes(
      tree,
      (node) => node?.props?.['data-testid'] === 'ce-create-mode-switch'
    );
    expect(modeSwitches).toHaveLength(1);
    expect(treeHasText(modeSwitches[0], 'from URL / Content')).toBe(true);
  });

  it('hides survey/question gate controls when the active session exposes no selectable gates', () => {
    const instance = makeInstance();
    instance.resolveGateOptions = jest.fn(() => ({
      gateMap: {},
      gateOptions: [],
      defaultGateId: '',
    }));
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      questions: [{
        uiKey: 'q1',
        id: 'q1',
        type: 'freeform',
        prompt: 'Question 1',
        tags: [],
        currentTagInputValue: '',
        aiGeneratedTagsFromSource: [],
        isGeneratingTags: false,
      }],
    };

    const tree = instance.render();
    const markup = renderToStaticMarkup(tree);
    const gateLockMatches = markup.match(new RegExp(`data-testid="${E2E_TESTIDS.GATE_LOCK}"`, 'g')) || [];
    const surveyTitleLocks = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'surveyTitleLock'));
    const inheritToggles = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'inheritToggle'));

    expect(gateLockMatches).toHaveLength(0);
    expect(surveyTitleLocks).toHaveLength(0);
    expect(inheritToggles).toHaveLength(0);
  });

  it('renders survey/question gate controls when the active session has selectable gates', () => {
    const instance = makeInstance();
    instance.resolveGateOptions = jest.fn(() => ({
      gateMap: {
        gate_1: { id: 'gate_1' },
      },
      gateOptions: [{
        id: 'gate_1',
        label: 'Edge Session',
        badgeLabel: 'Edge Session',
        color: '#5affc2',
      }],
      defaultGateId: 'gate_1',
    }));
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      questions: [{
        uiKey: 'q1',
        id: 'q1',
        type: 'freeform',
        prompt: 'Question 1',
        tags: [],
        currentTagInputValue: '',
        aiGeneratedTagsFromSource: [],
        isGeneratingTags: false,
      }],
    };

    const tree = instance.render();
    const markup = renderToStaticMarkup(tree);
    const gateLockMatches = markup.match(new RegExp(`data-testid="${E2E_TESTIDS.GATE_LOCK}"`, 'g')) || [];
    const surveyTitleLocks = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'surveyTitleLock'));
    const inheritToggles = collectTreeNodes(tree, (node) => nodeHasClassName(node, 'inheritToggle'));

    expect(gateLockMatches).toHaveLength(2);
    expect(surveyTitleLocks).toHaveLength(1);
    expect(inheritToggles).toHaveLength(1);
  });

  it('renders uploaded-question Arweave links against ar.io when direct mode is enabled', () => {
    const txId = '8_2VRRP5Ka0b5F9yiq_nm2hJto8qnQazZ2EtfLJ0viE';
    (globalThis as any).CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    (globalThis as any).CE_ARWEAVE_AR_IO_URL = 'https://ar-io.example.test';

    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      questionsAddedSuccessfully: true,
      questions: [{
        uiKey: 'q1',
        id: 'question-id-1234567890',
        type: 'freeform',
        prompt: 'Question 1',
        tags: [],
        currentTagInputValue: '',
        aiGeneratedTagsFromSource: [],
        isGeneratingTags: false,
      }],
      uploadedQuestions: [
        { questionId: 'question-id-1234567890', arweaveTxId: txId },
      ],
    };

    const markup = renderToStaticMarkup(instance.render());

    expect(markup).toContain(`href="https://ar-io.example.test/${txId}"`);
  });

  it('renders submitted-survey Arweave links against ar.io when direct mode is enabled', () => {
    const txId = '8_2VRRP5Ka0b5F9yiq_nm2hJto8qnQazZ2EtfLJ0viE';
    (globalThis as any).CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    (globalThis as any).CE_ARWEAVE_AR_IO_URL = 'https://ar-io.example.test';

    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      surveyAddedSuccessfully: true,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      questions: [{
        uiKey: 'q1',
        id: 'question-id-1234567890',
        type: 'freeform',
        prompt: 'Question 1',
        tags: [],
        currentTagInputValue: '',
        aiGeneratedTagsFromSource: [],
        isGeneratingTags: false,
      }],
      lastSubmittedSurveyId: '0xSurvey',
      lastSubmittedSurveyArweaveTxId: txId,
    };

    const markup = renderToStaticMarkup(instance.render());

    expect(markup).toContain(`href="https://ar-io.example.test/${txId}"`);
  });

  it('canonicalizes submitted-survey display links for reserved session aliases', () => {
    const buildSurveyLinks = (activeSessionSlug: string) => {
      const instance = makeInstance({ activeSessionSlug });
      instance.state = {
        ...instance.state,
        showAutoTool: false,
        surveyAddedSuccessfully: true,
        isStandaloneQuestion: false,
        title: 'Survey Title',
        questions: [{
          uiKey: 'q1',
          id: 'question-id-1234567890',
          type: 'freeform',
          prompt: 'Question 1',
          tags: [],
          currentTagInputValue: '',
          aiGeneratedTagsFromSource: [],
          isGeneratingTags: false,
        }],
        lastSubmittedSurveyId: '0xSurvey',
      };

      return collectTreeNodes(
        instance.render(),
        (node) => node?.type === 'a' && typeof node?.props?.href === 'string' && node.props.href.startsWith('/survey/')
      ).map((node) => node.props.href);
    };

    const debateLinks = buildSurveyLinks('DEBATE');
    expect(debateLinks).toContain('/survey/0xSurvey?session=DEBATE');
    expect(debateLinks).not.toContain('/survey/0xSurvey?session=rxc');

    const generalLinks = buildSurveyLinks('general');
    expect(generalLinks).toContain('/survey/0xSurvey');
    expect(generalLinks).not.toContain('/survey/0xSurvey?session=general');
  });

  it('filters authoring lock options to response-related gates and labels them with the session name', () => {
    const instance = makeInstance();
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: false,
    };

    const { gateOptions, defaultGateId } = instance.resolveGateOptions({
      sessionName: 'FOR TEST 12',
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          surveyResponses: {
            gateId: 'survey_gate',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
            lookupStatus: 'ok',
          },
          default: {
            gateId: 'default_gate',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            lookupStatus: 'ok',
          },
          docUrls: {
            gateId: 'doc_urls_gate',
            sbtAddresses: ['0x3333333333333333333333333333333333333333'],
            lookupStatus: 'ok',
          },
        },
      },
      sponsored: {
        gates: {
          survey_gate: {
            label: 'Registry surveyResponses gate',
            mode: 'all',
            sbtAddresses: [
              '0x1111111111111111111111111111111111111111',
            ],
          },
          default_gate: {
            label: 'Registry default gate',
            mode: 'any',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
          },
          doc_urls_gate: {
            label: 'Registry docUrls gate',
            mode: 'any',
            sbtAddresses: ['0x3333333333333333333333333333333333333333'],
          },
        },
      },
    }, { isStandaloneQuestion: false });

    expect(defaultGateId).toBe('survey_gate');
    expect(gateOptions).toEqual([
      expect.objectContaining({
        id: 'default_gate',
        label: 'FOR TEST 12 (default)',
        badgeLabel: 'FOR TEST 12',
        mode: 'any',
        sbtAddress: '0x2222222222222222222222222222222222222222',
        sbtAddresses: ['0x2222222222222222222222222222222222222222'],
      }),
      expect.objectContaining({
        id: 'survey_gate',
        label: 'FOR TEST 12 (survey)',
        badgeLabel: 'FOR TEST 12',
        mode: 'all',
        sbtAddress: '0x1111111111111111111111111111111111111111',
        sbtAddresses: ['0x1111111111111111111111111111111111111111'],
      }),
    ]);
  });
});
