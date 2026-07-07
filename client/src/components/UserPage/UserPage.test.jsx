/** @file UserPage.test.jsx */
import UserPage from './UserPage';
import styles from './UserPage.module.scss';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import { analyzeUserOpinions } from 'utilities/ai/aiClient.js';
import { ethers } from 'ethers';
import { notify } from '../../utilities/ui/notify.js';

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  getGlobalLitHooks: jest.fn(() => null),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    decryptSingleField: jest.fn(),
  },
}));

jest.mock('../../utilities/web3/sponsoredAccess.js', () => ({
  checkSponsoredAccess: jest.fn(),
}));

jest.mock('utilities/ai/aiClient.js', () => ({
  analyzeUserOpinions: jest.fn(async () => ({
    summary: 'summary',
    details: 'details',
    name: 'name',
    historicalAlignment: {},
  })),
}));

const makeInstance = (props = {}) => {
  const instance = new UserPage({
    viewAddress: '0x00000000000000000000000000000000000000aa',
    network: { id: 84532 },
    isSurveyCacheReady: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    isSBTCacheReady: true,
    sbtCacheRevision: 0,
    questionResponsesNonce: 0,
    ...props,
  });

  instance._isMounted = true;
  instance.setState = jest.fn((update, cb) => {
    const patch = typeof update === 'function' ? update(instance.state, instance.props) : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });

  return instance;
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

let analysisCacheTestSeq = 0;

const makeAnalysisCacheInstance = (props = {}) => {
  analysisCacheTestSeq += 1;
  const slug = props.activeSessionSlug || `analysis-cache-test-${analysisCacheTestSeq}`;
  const viewAddress = props.viewAddress || '0x00000000000000000000000000000000000000aa';
  const networkID = String(props.network?.id || 84532);
  const instance = makeInstance({
    activeSessionSlug: slug,
    viewAddress,
    network: { id: Number(networkID) },
    account: '0x00000000000000000000000000000000000000bb',
    ...props,
  });

  instance.state = {
    ...instance.state,
    username: 'Cache Test User',
    sbtList: [
      {
        sbtInfo: {
          name: 'Cache Badge',
          sbtAddress: '0x00000000000000000000000000000000000000cc',
        },
      },
    ],
    questionResponseInfo: [
      {
        id: 'q1',
        type: 'freeform',
        prompt: 'What should be cached?',
      },
    ],
    detailedQuestionResponses: {
      q1: {
        answer: { value: 'A deterministic answer' },
        conviction: 4,
      },
    },
    surveyResponseInfo: [],
    detailedSurveyResponses: {},
    questionCreationInfo: [],
    surveyCreationInfo: [],
  };

  jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue([slug]);
  jest.spyOn(instance, '_getSessionConfigForSlugExact').mockImplementation((candidate) =>
    candidate === slug
      ? {
          slug,
          ai: {
            mode: 'openai',
            models: { thinking: 'gpt-5' },
            modelProviders: { thinking: 'openai' },
          },
        }
      : null,
  );
  checkSponsoredAccess.mockResolvedValue({
    status: 'no-gate',
    gate: null,
    resourceKey: 'ai',
  });

  return {
    instance,
    slug,
    networkID,
    addressLower: viewAddress.toLowerCase(),
  };
};

const getSingleAnalysisCacheEntry = ({ slug, networkID, addressLower }) => {
  const cacheObj = cacheScripts.peekCacheSync('analysisCache', slug, { clone: false });
  const bucket = cacheObj?.[networkID]?.[addressLower] || {};
  const [[fingerprint, entry] = []] = Object.entries(bucket);
  return { cacheObj, fingerprint, entry };
};

const writeSingleAnalysisCacheEntry = async ({ slug, networkID, addressLower, fingerprint, entry }) => {
  const current = cacheScripts.peekCacheSync('analysisCache', slug, { clone: false }) || {};
  await cacheScripts.writeCache('analysisCache', slug, {
    ...current,
    [networkID]: {
      ...(current[networkID] || {}),
      [addressLower]: {
        ...(current[networkID]?.[addressLower] || {}),
        [fingerprint]: entry,
      },
    },
  });
};

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';

const collectTreeNodes = (node, predicate, acc = []) => {
  if (node == null) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => collectTreeNodes(child, predicate, acc));
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  return collectTreeNodes(node?.props?.children, predicate, acc);
};

const getNodeTypeName = (node) => {
  const type = node?.type;
  if (!type) return '';
  if (typeof type === 'string') return type;
  return String(type.displayName || type.name || '');
};

const treeHasText = (node, text) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

const normalizeChildrenArray = (value) => (Array.isArray(value) ? value : [value].filter(Boolean));

describe('UserPage clipboard helpers', () => {
  it('does not mark the address copied when clipboard write rejects', async () => {
    const instance = makeInstance();
    const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = jest.fn().mockRejectedValue(new Error('clipboard denied'));
    const errorSpy = jest.spyOn(notify, 'error').mockImplementation(() => undefined);
    const successSpy = jest.spyOn(notify, 'success').mockImplementation(() => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      await instance.copyToClipboard();

      expect(writeText).toHaveBeenCalledWith('0x00000000000000000000000000000000000000aa');
      expect(errorSpy).toHaveBeenCalledWith('Could not copy address');
      expect(successSpy).not.toHaveBeenCalled();
      expect(instance.state.copied).not.toBe(true);
    } finally {
      if (originalClipboardDescriptor) {
        Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
      } else {
        delete navigator.clipboard;
      }
    }
  });
});

describe('UserPage username editing', () => {
  it('keeps username editing open when local persistence fails', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const storageError = new Error('quota exceeded');
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw storageError;
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const instance = makeInstance({
      account: viewAddress,
      viewAddress,
      network: { id: 84532 },
    });
    instance.state = {
      ...instance.state,
      username: 'Unsaved User',
      usernameError: '',
      isEditingUsername: true,
    };

    try {
      instance.setUsername();

      expect(setItemSpy).toHaveBeenCalledWith(
        'userPageUsername_84532_0x00000000000000000000000000000000000000aa',
        'Unsaved User',
      );
      expect(instance.state.username).toBe('Unsaved User');
      expect(instance.state.isEditingUsername).toBe(true);
      expect(instance.state.usernameError).toBe('Failed to save username locally.');
      expect(instance.setState.mock.calls.some(([patch]) => patch?.isEditingUsername === false)).toBe(false);
      const [header] = collectTreeNodes(instance.render(), (node) => getNodeTypeName(node) === 'UserPageHeader');
      expect(header.props.usernameErrorDisplayState).toEqual({
        shouldRenderUsernameError: true,
        usernameErrorText: 'Failed to save username locally.',
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith('[account]', 'Error saving username to localStorage:', storageError);
    } finally {
      setItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });
});

describe('UserPage analyze action boundary', () => {
  it('routes header analyze clicks through the parent-owned analyze handler with preserved args', () => {
    const instance = makeInstance();
    instance.analyzeUser = jest.fn();
    const tree = instance.render();
    const [header] = collectTreeNodes(tree, (node) => getNodeTypeName(node) === 'UserPageHeader');
    const event = { preventDefault: jest.fn(), type: 'click' };

    expect(header).toBeTruthy();
    expect(header.props.analyzeButtonDisplayState.disabled).toBe(false);

    const result = header.props.onAnalyzeUser(event);

    expect(result).toEqual({
      blockedReason: 'none',
      status: 'dispatched',
    });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(instance.analyzeUser).toHaveBeenCalledTimes(1);
    expect(instance.analyzeUser).toHaveBeenCalledWith(event);
  });

  it('keeps disabled header analyze clicks inert before reaching analyze side effects', () => {
    const instance = makeInstance({ isSBTCacheReady: false });
    instance.analyzeUser = jest.fn();
    const tree = instance.render();
    const [header] = collectTreeNodes(tree, (node) => getNodeTypeName(node) === 'UserPageHeader');
    const event = { preventDefault: jest.fn(), type: 'click' };

    expect(header).toBeTruthy();
    expect(header.props.analyzeButtonDisplayState.disabled).toBe(true);

    const result = header.props.onAnalyzeUser(event);

    expect(result).toEqual({
      blockedReason: 'none',
      status: 'disabled',
    });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(instance.analyzeUser).not.toHaveBeenCalled();
  });
});

describe('UserPage bookmark action boundary', () => {
  it('routes visible header bookmark clicks through the parent-owned bookmark handler', () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      viewAddress: '0x00000000000000000000000000000000000000aa',
    });
    instance.toggleBookmark = jest.fn();
    const tree = instance.render();
    const [header] = collectTreeNodes(tree, (node) => getNodeTypeName(node) === 'UserPageHeader');
    const event = { preventDefault: jest.fn(), type: 'click' };

    expect(header).toBeTruthy();
    expect(header.props.headerActionVisibility.showBookmarkButton).toBe(true);

    const result = header.props.onBookmark(event);

    expect(result).toEqual({
      blockedReason: 'none',
      status: 'dispatched',
    });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(instance.toggleBookmark).toHaveBeenCalledTimes(1);
    expect(instance.toggleBookmark).toHaveBeenCalledWith(event);
  });

  it('keeps hidden owner bookmark actions inert before reaching bookmark side effects', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: viewAddress,
      viewAddress,
    });
    instance.toggleBookmark = jest.fn();
    const tree = instance.render();
    const [header] = collectTreeNodes(tree, (node) => getNodeTypeName(node) === 'UserPageHeader');
    const event = { preventDefault: jest.fn(), type: 'click' };

    expect(header).toBeTruthy();
    expect(header.props.headerActionVisibility.showBookmarkButton).toBe(false);

    const result = header.props.onBookmark(event);

    expect(result).toEqual({
      blockedReason: 'none',
      status: 'hidden',
    });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(instance.toggleBookmark).not.toHaveBeenCalled();
  });
});

describe('UserPage decrypt action boundary', () => {
  it('keeps rendered decrypt wiring inert without an account while preserving cached response identity', async () => {
    const encryptedResponse = {
      questionID: 'q1',
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: '{"v":2}',
        encryptionAudience: 'gate',
      },
    };
    const instance = makeInstance({
      account: '',
      activeSessionSlug: 'edge',
      provider: 'wagmi',
    });
    instance.state = {
      ...instance.state,
      detailedQuestionResponses: {
        q1: encryptedResponse,
      },
      loadingQuestions: false,
      loadingSBTs: false,
      loadingSurveys: false,
      questionCreationInfo: [],
      questionResponseInfo: [
        {
          canDecryptOtherResponses: true,
          id: 'q1',
          prompt: 'Cached gated response',
          sessionSlug: 'edge',
        },
      ],
      selectedTab: 'questions',
      showSectionQuestionResponsesOpen: true,
      showSectionQuestionsCreatedOpen: true,
      surveyCreationInfo: [],
      surveyResponseInfo: [],
    };

    const tree = instance.render();
    const [questionSection] = collectTreeNodes(tree, (node) => getNodeTypeName(node) === 'UserPageQuestionSection');

    expect(questionSection).toBeTruthy();
    expect(questionSection.props.questionResponseEntries).toEqual([
      {
        canDecryptOtherResponses: true,
        id: 'q1',
        prompt: 'Cached gated response',
        sessionSlug: 'edge',
      },
    ]);
    expect(questionSection.props.detailedQuestionResponseMap.q1).toBe(encryptedResponse);
    expect(questionSection.props.questionResponsesNonce).toBe(0);
    expect(questionSection.props.sbtCacheRevision).toBe(0);

    const didDecrypt = await questionSection.props.onDecryptQuestion('q1', 'answer', encryptedResponse);

    expect(didDecrypt).toBe(false);
    expect(cryptoUtils.decryptSingleField).not.toHaveBeenCalled();
    expect(instance.setState).not.toHaveBeenCalled();
  });
});

describe('UserPage survey route boundaries', () => {
  it('keeps parent-owned survey href and open callbacks aligned with session and responder routes', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({ viewAddress });
    instance.state = {
      ...instance.state,
      selectedTab: 'surveys',
      surveyResponseInfo: [
        {
          documentURLs: [],
          id: 'survey response',
          questionsCount: 1,
          slug: 'alpha',
          tags: [],
          title: 'Response Survey',
        },
      ],
      surveyCreationInfo: [
        {
          documentURLs: [],
          id: 'created survey',
          questionIDs: [],
          questionsCount: 1,
          slug: 'beta',
          tags: [],
          title: 'Created Survey',
        },
      ],
    };
    const tree = instance.render();
    const [surveySection] = collectTreeNodes(tree, (node) => getNodeTypeName(node) === 'UserPageSurveySection');

    expect(surveySection).toBeTruthy();
    expect(surveySection.props.getSurveyCreatedHref({ id: 'created survey' }, 'beta')).toBe(
      '/survey/created%20survey?session=beta',
    );

    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const event = { stopPropagation: jest.fn() };
    surveySection.props.onOpenSurveyResponse({ id: 'survey response', slug: 'alpha' }, event);

    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      '/survey/survey%20response?session=alpha&responder=0x00000000000000000000000000000000000000aa',
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });
});

describe('UserPage cold-load network fallback', () => {
  it('renders cached survey/question/sbt data when network id is unavailable', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const cacheNetworkID = '84532';
    const instance = makeInstance({ viewAddress, network: {} });

    const dataByNamespace = {
      surveysCache: [
        {
          slug: 'edge',
          data: {
            [cacheNetworkID]: {
              surveys: {
                s1: {
                  id: 's1',
                  title: 'Survey 1',
                  creator: viewAddress,
                  questionIDs: ['q1'],
                },
              },
              surveyResponses: {
                s1: {
                  [viewAddress]: JSON.stringify({
                    responses: [{ questionID: 'q1', answer: { value: 'yes' } }],
                  }),
                },
              },
            },
          },
        },
      ],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [cacheNetworkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  prompt: 'Question 1',
                  type: 'freeform',
                  creator: viewAddress,
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress]: JSON.stringify({
                    answer: { value: 'value' },
                  }),
                },
              },
            },
          },
        },
      ],
      sbtCache: [
        {
          slug: 'edge',
          data: {
            [cacheNetworkID]: {
              sbtList: {
                '0x100': {
                  sbtAddress: '0x100',
                  sbtInfo: { name: 'Badge 100', unlisted: false },
                  mintedAddresses: [viewAddress],
                  burnedAddresses: [],
                },
              },
            },
          },
        },
      ],
      userCache: [
        {
          slug: 'edge',
          data: {
            [viewLower]: {
              [cacheNetworkID]: {
                lastBlockScanned: 120,
                data: {},
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyResponseInfo).toHaveLength(1);
    expect(instance.state.surveyCreationInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionCreationInfo).toHaveLength(1);
    expect(instance.state.sbtList).toHaveLength(1);
    expect(instance.state.loadingSurveys).toBe(false);
    expect(instance.state.loadingQuestions).toBe(false);
    expect(instance.state.loadingSBTs).toBe(false);
  });

  it('uses userCache data from non-active chain buckets when network id mismatches', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const cacheNetworkID = '84532';
    const instance = makeInstance({ viewAddress, network: { id: 1 } });

    const dataByNamespace = {
      surveysCache: [],
      questionsCache: [],
      sbtCache: [],
      userCache: [
        {
          slug: 'edge',
          data: {
            [viewLower]: {
              [cacheNetworkID]: {
                lastBlockScanned: 120,
                data: {
                  createdSurveys: [
                    {
                      id: 's1',
                      data: {
                        id: 's1',
                        title: 'Survey from userCache',
                        questionIDs: ['q1'],
                      },
                    },
                  ],
                  surveyResponses: [
                    {
                      surveyId: 's1',
                      responder: viewLower,
                      response: {
                        responses: [
                          {
                            questionID: 'q1',
                            answer: { value: 'yes' },
                          },
                        ],
                      },
                    },
                  ],
                  createdQuestions: [
                    {
                      id: 'q1',
                      data: {
                        id: 'q1',
                        prompt: 'Question from userCache',
                        type: 'freeform',
                      },
                    },
                  ],
                  questionResponses: [
                    {
                      questionId: 'q1',
                      responder: viewLower,
                      response: {
                        answer: { value: 'value' },
                      },
                    },
                  ],
                  sbts: [
                    {
                      sbtAddress: '0x100',
                      sbtInfo: { name: 'Badge from userCache', unlisted: false },
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyCreationInfo).toHaveLength(1);
    expect(instance.state.surveyResponseInfo).toHaveLength(1);
    expect(instance.state.questionCreationInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.sbtList).toHaveLength(1);
    expect(instance.state.loadingSurveys).toBe(false);
    expect(instance.state.loadingQuestions).toBe(false);
    expect(instance.state.loadingSBTs).toBe(false);
  });

  it('merges non-active cache partitions even when active-chain buckets exist', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const instance = makeInstance({ viewAddress, network: { id: 1 } });

    const dataByNamespace = {
      surveysCache: [
        {
          slug: 'edge',
          data: {
            1: {
              surveys: {
                sActive: {
                  id: 'sActive',
                  title: 'Active Chain Survey',
                  creator: '0x00000000000000000000000000000000000000bb',
                  questionIDs: ['qActive'],
                },
              },
              surveyResponses: {},
            },
            84532: {
              surveys: {
                sOther: {
                  id: 'sOther',
                  title: 'Other Chain Survey',
                  creator: viewAddress,
                  questionIDs: ['qOther'],
                },
              },
              surveyResponses: {
                sOther: {
                  [viewLower]: JSON.stringify({
                    responses: [{ questionID: 'qOther', answer: { value: 'yes' } }],
                  }),
                },
              },
            },
          },
        },
      ],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            1: {
              questions: {
                qActive: {
                  id: 'qActive',
                  prompt: 'Active Prompt',
                  type: 'freeform',
                },
              },
              questionResponses: {},
            },
            84532: {
              questions: {
                qOther: {
                  id: 'qOther',
                  prompt: 'Other Prompt',
                  type: 'freeform',
                  creator: viewAddress,
                },
              },
              questionResponses: {
                qOther: {
                  [viewLower]: JSON.stringify({ answer: { value: 'cross-chain value' } }),
                },
              },
            },
          },
        },
      ],
      sbtCache: [
        {
          slug: 'edge',
          data: {
            1: {
              sbtList: {
                '0x111': {
                  sbtAddress: '0x111',
                  sbtInfo: { name: 'Active Badge', unlisted: false },
                  mintedAddresses: [],
                  burnedAddresses: [],
                },
              },
            },
            84532: {
              sbtList: {
                '0x222': {
                  sbtAddress: '0x222',
                  sbtInfo: { name: 'Cross Badge', unlisted: false },
                  mintedAddresses: [viewLower],
                  burnedAddresses: [],
                },
              },
            },
          },
        },
      ],
      userCache: [],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyResponseInfo).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'sother' })]),
    );
    expect(instance.state.questionResponseInfo).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'qother' })]),
    );
    expect(instance.state.sbtList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sbtInfo: expect.objectContaining({ sbtAddress: '0x222' }),
        }),
      ]),
    );
  });
});
