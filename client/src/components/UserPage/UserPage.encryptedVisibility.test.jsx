/** @file UserPage.encryptedVisibility.test.jsx */
import UserPage from './UserPage';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';

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

jest.mock('utilities/ai/aiScripts.js', () => ({
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

const buildGateAccessCacheKey = (instance, { slug = '', resourceKey = '' } = {}) =>
  buildUserPageGateAccessCacheKey({
    account: instance.props.account,
    networkID: instance.props.network?.id,
    resourceKey,
    sbtCacheRevision: instance.props.sbtCacheRevision,
    slug,
  });

describe('UserPage encrypted response visibility', () => {
  beforeEach(() => {
    checkSponsoredAccess.mockResolvedValue({
      status: 'unknown',
      gate: null,
      resourceKey: 'default',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('hides encrypted question content when gate access is denied', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const deniedKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    const defaultNoGateKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'default' });
    instance._responseGateAccessStatusByKey.set(deniedKey, { status: 'denied', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(defaultNoGateKey, { status: 'no-gate', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: '[encrypted]',
                  type: 'freeform',
                  promptEncrypted: '{"v":2}',
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress]: JSON.stringify({
                    answer: { value: 'hello world' },
                  }),
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

    expect(instance.state.questionResponseInfo).toHaveLength(0);
    expect(instance.state.questionCreationInfo).toHaveLength(0);
    expect(instance.state.loadingQuestions).toBe(false);
    expect(instance.state.hasUncertainGateAccess).toBe(false);
  });

  it('hides encrypted question content without gate checks when the viewer has no account', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '' });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: '[encrypted]',
                  type: 'freeform',
                  promptEncrypted: '{"v":2}',
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress]: JSON.stringify({
                    answer: {
                      value: '*',
                      encrypted: true,
                      encryptedPortion: '{"v":2}',
                      encryptionAudience: 'gate',
                    },
                  }),
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

    expect(instance.state.questionResponseInfo).toHaveLength(0);
    expect(instance.state.questionCreationInfo).toHaveLength(0);
    expect(instance.state.loadingQuestions).toBe(false);
    expect(instance.state.hasUncertainGateAccess).toBe(false);
    expect(checkSponsoredAccess).not.toHaveBeenCalled();
    expect(cryptoUtils.decryptSingleField).not.toHaveBeenCalled();
  });

  it('keeps question responses visible when only additional comments are encrypted and gate access is denied', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const deniedKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    const defaultNoGateKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'default' });
    instance._responseGateAccessStatusByKey.set(deniedKey, { status: 'denied', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(defaultNoGateKey, { status: 'no-gate', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: 'Public prompt',
                  type: 'freeform',
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress]: JSON.stringify({
                    answer: { value: 'public answer' },
                    additional: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                  }),
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

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo[0].canDecryptOtherResponses).toBe(false);
    expect(instance.state.questionResponseInfo[0].responseEncryption).toEqual({
      answerEncrypted: false,
      additionalEncrypted: true,
    });
    expect(instance.state.detailedQuestionResponses.q1.answer.value).toBe('public answer');
    expect(instance.state.detailedQuestionResponses.q1.additional.encrypted).toBe(true);
  });

  it('keeps survey responses visible when only additional comments are encrypted and gate access is denied', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const deniedKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'surveyResponses' });
    const defaultNoGateKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'default' });
    instance._responseGateAccessStatusByKey.set(deniedKey, { status: 'denied', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(defaultNoGateKey, { status: 'no-gate', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
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
                    responses: [
                      {
                        questionID: 'q1',
                        answer: { value: 'public survey answer' },
                        additional: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                      },
                    ],
                  }),
                },
              },
            },
          },
        },
      ],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: 'Question 1',
                  type: 'freeform',
                },
              },
              questionResponses: {},
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyResponseInfo).toHaveLength(1);
    expect(instance.state.detailedSurveyResponses.s1).toHaveLength(1);
    expect(instance.state.detailedSurveyResponses.s1[0].canDecryptOtherResponses).toBe(false);
    expect(instance.state.detailedSurveyResponses.s1[0].responseEncryption).toEqual({
      answerEncrypted: false,
      additionalEncrypted: true,
    });
    expect(instance.state.detailedSurveyResponses.s1[0].responseData.answer.value).toBe('public survey answer');
    expect(instance.state.detailedSurveyResponses.s1[0].responseData.additional.encrypted).toBe(true);
  });

  it('shows encrypted question responses when gate access is granted', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const grantedKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    instance._responseGateAccessStatusByKey.set(grantedKey, { status: 'granted', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: '[encrypted]',
                  type: 'freeform',
                  promptEncrypted: '{"v":2}',
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress]: JSON.stringify({
                    answer: {
                      value: '*',
                      encrypted: true,
                      encryptedPortion: '{"v":2}',
                      encryptionAudience: 'gate',
                    },
                  }),
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

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo[0].canDecryptOtherResponses).toBe(true);
    expect(instance.state.questionCreationInfo).toHaveLength(1);
  });

  it('uses the viewer-response source slug when evaluating encrypted question visibility', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const otherAddress = '0x00000000000000000000000000000000000000cc';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const openGrantedKey = buildGateAccessCacheKey(instance, {
      slug: 'open-session',
      resourceKey: 'questionResponses',
    });
    const openDefaultKey = buildGateAccessCacheKey(instance, { slug: 'open-session', resourceKey: 'default' });
    const closedDeniedKey = buildGateAccessCacheKey(instance, {
      slug: 'closed-session',
      resourceKey: 'questionResponses',
    });
    const closedDefaultKey = buildGateAccessCacheKey(instance, { slug: 'closed-session', resourceKey: 'default' });
    instance._responseGateAccessStatusByKey.set(openGrantedKey, { status: 'granted', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(openDefaultKey, { status: 'no-gate', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(closedDeniedKey, { status: 'denied', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(closedDefaultKey, { status: 'no-gate', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'open-session',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: '[encrypted]',
                  type: 'freeform',
                  promptEncrypted: '{"v":2}',
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress]: JSON.stringify({
                    answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                  }),
                },
              },
            },
          },
        },
        {
          slug: 'closed-session',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: '[encrypted]',
                  type: 'freeform',
                  promptEncrypted: '{"v":2}',
                },
              },
              questionResponses: {
                q1: {
                  [otherAddress]: JSON.stringify({
                    answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                  }),
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

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo[0].id).toBe('q1');
  });

  it('uses the viewer-response source slug when evaluating encrypted survey visibility', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const otherAddress = '0x00000000000000000000000000000000000000cc';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const openGrantedKey = buildGateAccessCacheKey(instance, { slug: 'open-session', resourceKey: 'surveyResponses' });
    const openDefaultKey = buildGateAccessCacheKey(instance, { slug: 'open-session', resourceKey: 'default' });
    const closedDeniedKey = buildGateAccessCacheKey(instance, {
      slug: 'closed-session',
      resourceKey: 'surveyResponses',
    });
    const closedDefaultKey = buildGateAccessCacheKey(instance, { slug: 'closed-session', resourceKey: 'default' });
    instance._responseGateAccessStatusByKey.set(openGrantedKey, { status: 'granted', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(openDefaultKey, { status: 'no-gate', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(closedDeniedKey, { status: 'denied', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(closedDefaultKey, { status: 'no-gate', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [
        {
          slug: 'closed-session',
          data: {
            [networkID]: {
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
                  [otherAddress]: JSON.stringify({
                    responses: [
                      {
                        questionID: 'q1',
                        answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                      },
                    ],
                  }),
                },
              },
            },
          },
        },
        {
          slug: 'open-session',
          data: {
            [networkID]: {
              surveys: {},
              surveyResponses: {
                s1: {
                  [viewAddress]: JSON.stringify({
                    responses: [
                      {
                        questionID: 'q1',
                        answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                      },
                    ],
                  }),
                },
              },
            },
          },
        },
      ],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'closed-session',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: '[encrypted]',
                  type: 'freeform',
                  promptEncrypted: '{"v":2}',
                },
              },
              questionResponses: {},
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyResponseInfo).toHaveLength(1);
    expect(instance.state.surveyResponseInfo[0].id).toBe('s1');
    expect(instance.state.detailedSurveyResponses.s1).toHaveLength(1);
    expect(instance.state.detailedSurveyResponses.s1[0].canDecryptOtherResponses).toBe(true);
  });

  it('revalidates stale terminal gate statuses during encrypted visibility refresh', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const staleTs = Date.now() - 61 * 1000;
    const grantedKey = buildGateAccessCacheKey(instance, { slug: 'edge', resourceKey: 'questionResponses' });
    const defaultNoGateKey = buildGateAccessCacheKey(instance, { slug: 'edge', resourceKey: 'default' });
    instance._responseGateAccessStatusByKey.set(grantedKey, { status: 'granted', ts: staleTs });
    instance._responseGateAccessStatusByKey.set(defaultNoGateKey, { status: 'no-gate', ts: staleTs });
    checkSponsoredAccess.mockResolvedValue({
      status: 'granted',
      gate: null,
      resourceKey: 'questionResponses',
    });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: '[encrypted]',
                  type: 'freeform',
                  promptEncrypted: '{"v":2}',
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress]: JSON.stringify({
                    answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                  }),
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

    expect(checkSponsoredAccess).toHaveBeenCalled();
    const requestedResources = checkSponsoredAccess.mock.calls.map(([arg]) => arg?.resourceKey);
    expect(requestedResources).toEqual(expect.arrayContaining(['questionResponses', 'default']));
  });

  it('shows encrypted question responses when only default gate is granted', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const defaultGrantedKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'default' });
    const resourceNoGateKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    instance._responseGateAccessStatusByKey.set(defaultGrantedKey, { status: 'granted', ts: Date.now() });
    instance._responseGateAccessStatusByKey.set(resourceNoGateKey, { status: 'no-gate', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: '[encrypted]',
                  type: 'freeform',
                  promptEncrypted: '{"v":2}',
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress]: JSON.stringify({
                    answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                  }),
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

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo[0].canDecryptOtherResponses).toBe(true);
    expect(instance.state.questionCreationInfo).toHaveLength(1);
    expect(instance.state.loadingQuestions).toBe(false);
  });

  it('keeps question loading active when encrypted visibility is uncertain (gate status unknown)', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    const unknownKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    instance._responseGateAccessStatusByKey.set(unknownKey, { status: 'unknown', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: '[encrypted]',
                  type: 'freeform',
                  promptEncrypted: '{"v":2}',
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress]: JSON.stringify({
                    answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                  }),
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

    expect(instance.state.questionResponseInfo).toHaveLength(0);
    expect(instance.state.questionCreationInfo).toHaveLength(0);
    expect(instance.state.loadingQuestions).toBe(true);
    expect(instance.state.hasUncertainGateAccess).toBe(true);
    expect(
      checkSponsoredAccess.mock.calls.map(([arg]) => ({
        resourceKey: arg?.resourceKey,
        sessionSlug: arg?.sessionSlug,
      })),
    ).toEqual(
      expect.arrayContaining([
        { resourceKey: 'questionResponses', sessionSlug: 'edge' },
        { resourceKey: 'default', sessionSlug: 'edge' },
      ]),
    );
  });

  it('does not keep SBT loading active when only question gate visibility is uncertain', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress, account: '0x00000000000000000000000000000000000000bb' });
    instance.state = {
      ...instance.state,
      hasUncertainUserData: false,
      hasUncertainGateAccess: true,
    };
    const unknownKey = instance._buildGateAccessCacheKey({ slug: 'edge', resourceKey: 'questionResponses' });
    instance._responseGateAccessStatusByKey.set(unknownKey, { status: 'unknown', ts: Date.now() });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: '[encrypted]',
                  type: 'freeform',
                  promptEncrypted: '{"v":2}',
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress]: JSON.stringify({
                    answer: { value: '*', encrypted: true, encryptionAudience: 'gate' },
                  }),
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

    expect(instance.state.loadingQuestions).toBe(true);
    expect(instance.state.loadingSBTs).toBe(false);
    expect(instance.state.hasUncertainGateAccess).toBe(true);
  });
});
