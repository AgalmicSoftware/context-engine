/** @file UserPage.analysisCache.test.jsx */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UserPage from './UserPage';
import UserPageHeader from './UserPageHeader';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { analyzeUserCard, analyzeUserOpinions, fetchAnalysisCardPicture } from 'utilities/ai/aiClient.js';
import { analyzeUserFirstRead } from 'utilities/ai/userFirstRead';
import {
  analysisCardAvailableFor,
  publishSavedAnalysisCard,
  readSavedAnalysisCard,
} from 'utilities/analysisCard/analysisCardSaved';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';

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
  analyzeUserCard: jest.fn(),
  fetchAnalysisCardPicture: jest.fn(),
}));

// No first read unless a test gives one: the request then fails quietly, as when the fast model does not answer.
jest.mock('utilities/ai/userFirstRead', () => ({
  analyzeUserFirstRead: jest.fn(async () => {
    throw new Error('no first read in this test');
  }),
}));

// Whether the session's Worker has the card; the session's own switch still decides.
let mockWorkerHasCard = true;
jest.mock('utilities/analysisCard/analysisCardSaved', () => ({
  analysisCardAvailableFor: jest.fn(
    async (opts) =>
      mockWorkerHasCard &&
      jest.requireActual('utilities/ai/aiClientRequestOptions').resolveAiSessionOptions(opts).sessionConfig
        ?.analysisCardEnabled === true,
  ),
  readSavedAnalysisCard: jest.fn(),
  publishSavedAnalysisCard: jest.fn(),
  subscribeSavedAnalysisCards: jest.fn(() => () => {}),
  formatSavedAnalysisCardDate: jest.fn(() => '18 Nov 2026'),
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

// Entries as the page lists them: each names the session it came from. The analysis reads the page's own only.
const ENTRY_LISTS = [
  'sbtList',
  'questionResponseInfo',
  'surveyResponseInfo',
  'questionCreationInfo',
  'surveyCreationInfo',
];
const tagSession = (instance, slug = instance.props.activeSessionSlug ?? '') => {
  const tag = (entry) => ({ ...entry, slug, sessionSlug: slug });
  instance.state = {
    ...instance.state,
    ...Object.fromEntries(ENTRY_LISTS.map((key) => [key, (instance.state[key] || []).map(tag)])),
  };
  return instance;
};
// One group in the page's session, for tests about which session's AI is asked: there must be something to ask about.
const withAnEntry = (instance) => {
  instance.state = {
    ...instance.state,
    sbtList: [{ sbtInfo: { name: 'Session Badge', sbtAddress: '0x00000000000000000000000000000000000000cc' } }],
  };
  return tagSession(instance);
};

let analysisCacheTestSeq = 0;

// The page's header element; the session switch, where shown, comes before it.
const renderedHeader = (instance) => instance.render().props.children.find((child) => child?.type === UserPageHeader);

const makeAnalysisCacheInstance = (props = {}) => {
  analysisCacheTestSeq += 1;
  const slug = props.activeSessionSlug ?? `analysis-cache-test-${analysisCacheTestSeq}`;
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
    // Every entry the page lists names the session it came from; the analysis reads the page's own only.
    sbtList: [
      {
        slug,
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
        slug,
        sessionSlug: slug,
      },
    ],
    detailedQuestionResponses: {
      q1: {
        // Stored as the response writer stores a public answer.
        answer: {
          value: 'A deterministic answer',
          encrypted: false,
          encryptionAudience: 'self',
          encryptionGateId: null,
          audienceMode: 'explicit',
          hash: '',
          encryptedPortion: '',
        },
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
          analysisCardEnabled: true,
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

describe('UserPage analysis cache and routing', () => {
  beforeEach(() => {
    mockWorkerHasCard = true;
    analyzeUserOpinions
      .mockReset()
      .mockResolvedValue({ summary: 'summary', details: 'details', name: 'name', historicalAlignment: {} });
    // Unless a test says otherwise, the card request returns nothing usable and no picture can be drawn.
    analyzeUserCard.mockReset().mockResolvedValue({});
    fetchAnalysisCardPicture.mockReset().mockRejectedValue(new Error('picture_unavailable'));
    // Unless a test says otherwise, the person's saved card cannot be read (an older Worker): the card is made
    // for the viewer as before, and nothing is saved.
    readSavedAnalysisCard.mockReset().mockResolvedValue(null);
    publishSavedAnalysisCard
      .mockReset()
      .mockImplementation(async (_account, published, card) =>
        published ? { status: 'ready', card, savedAt: 1763460000000 } : { status: 'withdrawn' },
      );
    checkSponsoredAccess.mockResolvedValue({
      status: 'unknown',
      gate: null,
      resourceKey: 'default',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    try {
      delete globalThis.CE_SESSION_SCAN_SCOPE;
    } catch (_) {}
    try {
      delete globalThis.CE_SESSION_SCAN_SLUGS;
    } catch (_) {}
    try {
      localStorage.removeItem(REGISTRY_CACHE_KEY);
    } catch (_) {}
  });

  it('selects an AI-open session for analyze when active-session AI gate is denied', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: 'active-slug',
    });
    withAnEntry(instance);
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'summary',
      details: 'details',
      name: 'name',
      historicalAlignment: {},
    });
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['active-slug', 'open-slug']);
    jest.spyOn(instance, '_getSessionConfigForSlugExact').mockImplementation((slug) => ({ slug }));
    checkSponsoredAccess.mockImplementation(async ({ sessionSlug }) =>
      sessionSlug === 'open-slug'
        ? { status: 'no-gate', gate: null, resourceKey: 'ai' }
        : { status: 'denied', gate: { type: 'sbt' }, resourceKey: 'ai' },
    );

    await instance.analyzeUser();

    expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
    expect(analyzeUserOpinions).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        sessionSlug: 'open-slug',
        sessionConfig: expect.objectContaining({ slug: 'open-slug' }),
      }),
    );
  });

  it("analyses only the page's own session: another session's answers reach no prompt, card or cache", async () => {
    const mine = '0x00000000000000000000000000000000000000aa';
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance({ viewAddress: mine, account: mine });
    const publicField = (value) => ({ value, encrypted: false, encryptionAudience: 'self', encryptedPortion: '' });
    // The page lists what every session kept in this browser holds for the person: here a private session's
    // answer, comment, survey, group and created question sit beside this session's one answer.
    const elsewhere = { slug: 'private-session', sessionSlug: 'private-session' };
    instance.state = {
      ...instance.state,
      sbtList: [
        ...instance.state.sbtList,
        { ...elsewhere, sbtInfo: { name: 'Private Circle', sbtAddress: '0x00000000000000000000000000000000000000dd' } },
      ],
      questionResponseInfo: [
        ...instance.state.questionResponseInfo,
        { ...elsewhere, id: 'q-elsewhere', type: 'freeform', prompt: 'A question asked in private' },
        // An entry that names no session is left out too.
        { id: 'q-nowhere', type: 'freeform', prompt: 'A question from nowhere' },
      ],
      detailedQuestionResponses: {
        ...instance.state.detailedQuestionResponses,
        'q-elsewhere': { answer: publicField('SAID IN PRIVATE'), additional: publicField('PRIVATE COMMENT') },
        'q-nowhere': { answer: publicField('SAID NOWHERE'), additional: publicField('') },
      },
      surveyResponseInfo: [{ ...elsewhere, id: 's-elsewhere', title: 'Private survey', questionsCount: 1 }],
      detailedSurveyResponses: {
        's-elsewhere': [
          {
            questionData: { prompt: 'Private survey question', type: 'freeform' },
            responseData: { answer: publicField('SURVEY ANSWER IN PRIVATE') },
          },
        ],
      },
      questionCreationInfo: [{ ...elsewhere, id: 'q-made', type: 'binary', prompt: 'A question made in private' }],
      surveyCreationInfo: [{ ...elsewhere, id: 's-made', title: 'A survey made in private', questionsCount: 2 }],
    };
    readSavedAnalysisCard.mockResolvedValue({ status: 'none' });
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'summary',
      details: 'details',
      name: 'name',
      historicalAlignment: { figure: 'Elinor Ostrom (1933–2012)', reasoning: 'r' },
    });
    // A model that, against its brief, names the other session's question for the card.
    analyzeUserCard.mockResolvedValueOnce({
      title: 'A title',
      matchNote: '',
      tastes: {},
      answers: { ownWords: { questionId: 'q-elsewhere', quote: 'SAID IN PRIVATE' }, yesNo: { questionId: 'q1' } },
    });

    await instance.analyzeUser();
    await waitFor(() => expect(analyzeUserCard).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(instance.state.analysisCardPending).toBe(false));

    const sent = [
      analyzeUserOpinions.mock.calls[0][0],
      analyzeUserFirstRead.mock.calls[0][0],
      analyzeUserCard.mock.calls[0][0],
    ];
    for (const userData of sent) {
      const text = JSON.stringify(userData);
      expect(text).toContain('A deterministic answer');
      expect(text).not.toMatch(/PRIVATE|private|nowhere|NOWHERE/);
      expect(userData.questions.map((question) => question.id)).toEqual(['q1']);
      expect(userData.sbts.map((group) => group.name)).toEqual(['Cache Badge']);
      expect(userData.surveys).toEqual([]);
      expect(userData.questionsCreated).toEqual([]);
      expect(userData.surveysCreated).toEqual([]);
    }
    // Neither the card on screen, nor the one saved to my page, nor the kept analysis holds any of it.
    const { entry } = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
    const kept = JSON.stringify([instance.state.analysisCard, publishSavedAnalysisCard.mock.calls, entry]);
    expect(kept).not.toMatch(/PRIVATE|private|nowhere|NOWHERE/);
  });

  it('asks the AI nothing when the person has nothing in this session, whatever other sessions hold', async () => {
    const { instance } = makeAnalysisCacheInstance();
    tagSession(instance, 'private-session');
    await instance.analyzeUser();
    expect(analyzeUserOpinions).not.toHaveBeenCalled();
    expect(analyzeUserFirstRead).not.toHaveBeenCalled();
    expect(checkSponsoredAccess).not.toHaveBeenCalled();
    expect(instance.state).toMatchObject({
      analyzing: false,
      showAnalysisModal: true,
      analysisError: 'There is nothing from this session to analyze for this account.',
    });
  });

  it('sends public answers but never an Only me answer this browser decrypted', async () => {
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance({ provider: 'wagmi' });
    const lockedResponse = {
      questionID: 'q2',
      answer: {
        value: '*',
        encrypted: true,
        encryptionAudience: 'self',
        encryptionGateId: null,
        audienceMode: 'explicit',
        hash: `0x${'ab'.repeat(32)}`,
        encryptedPortion: '{"v":1}',
      },
      additional: { value: '', encrypted: false, encryptionAudience: 'self', encryptedPortion: '' },
    };
    instance.state = {
      ...instance.state,
      questionResponseInfo: [
        ...instance.state.questionResponseInfo,
        { id: 'q2', type: 'freeform', prompt: 'Private question' },
      ],
      detailedQuestionResponses: { ...instance.state.detailedQuestionResponses, q2: lockedResponse },
    };
    tagSession(instance);
    cryptoUtils.decryptSingleField.mockResolvedValue({
      answers: { q2: { value: 'private plaintext' } },
      additionalComments: {},
      importance: {},
    });

    await expect(instance.handleDecryptQuestionAnswer('q2', 'answer', lockedResponse)).resolves.toBe(true);
    expect(instance.state.detailedQuestionResponses.q2.answer.value).toBe('private plaintext');
    await instance.analyzeUser();

    expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
    const [userData] = analyzeUserOpinions.mock.calls[0];
    expect(userData.questions).toEqual([expect.objectContaining({ id: 'q1', answer: 'A deterministic answer' })]);
    expect(JSON.stringify(userData)).not.toContain('private plaintext');
    const { entry } = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
    expect(entry).toBeTruthy();
    expect(JSON.stringify(entry)).not.toContain('private plaintext');
  });

  it('sends public comments but never a comment this browser decrypted', async () => {
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance({ provider: 'wagmi' });
    const writerField = (value, overrides = {}) => ({
      value,
      encrypted: false,
      encryptionAudience: 'self',
      encryptionGateId: null,
      audienceMode: 'explicit',
      hash: '',
      encryptedPortion: '',
      ...overrides,
    });
    const lockedComment = {
      questionID: 'q2',
      answer: writerField('A second public answer'),
      additional: writerField('*', { encrypted: true, hash: `0x${'cd'.repeat(32)}`, encryptedPortion: '{"v":1}' }),
    };
    instance.state = {
      ...instance.state,
      questionResponseInfo: [
        ...instance.state.questionResponseInfo,
        { id: 'q2', type: 'freeform', prompt: 'Question with a locked comment' },
      ],
      detailedQuestionResponses: {
        q1: { ...instance.state.detailedQuestionResponses.q1, additional: writerField('Public context') },
        q2: lockedComment,
      },
    };
    tagSession(instance);
    cryptoUtils.decryptSingleField.mockResolvedValue({
      answers: {},
      additionalComments: { q2: { value: 'only-me remark' } },
      importance: {},
    });

    await expect(instance.handleDecryptQuestionAnswer('q2', 'additional', lockedComment)).resolves.toBe(true);
    expect(instance.state.detailedQuestionResponses.q2.additional.value).toBe('only-me remark');
    await instance.analyzeUser();

    const [userData] = analyzeUserOpinions.mock.calls[0];
    expect(userData.questions).toEqual([
      expect.objectContaining({ id: 'q1', additionalComment: 'Public context' }),
      expect.objectContaining({ id: 'q2', answer: 'A second public answer', additionalComment: undefined }),
    ]);
    expect(JSON.stringify(userData)).not.toContain('only-me remark');
    const { entry } = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
    expect(JSON.stringify(entry)).not.toContain('only-me remark');
  });

  it('writes analysisCache after a cache miss calls AI', async () => {
    const now = 1710000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance();
    const result = {
      generation: { provider: 'openrouter', model: 'provider/resolved-model', source: 'reported' },
      summary: 'fresh summary',
      details: 'fresh details',
      name: 'Fresh Analysis',
      historicalAlignment: {
        figure: 'Ada Lovelace',
        reasoning: 'Analytical framing.',
      },
    };
    analyzeUserOpinions.mockResolvedValueOnce(result);

    try {
      await instance.analyzeUser();

      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
      const { fingerprint, entry } = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
      expect(fingerprint).toEqual(expect.any(String));
      expect(entry).toMatchObject({
        version: 2,
        fingerprint,
        cachedAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
        address: addressLower,
        networkId: networkID,
        aiContext: {
          sessionSlug: slug,
          provider: 'openai',
          model: 'gpt-6.1-terra',
        },
        result,
      });
      expect(instance.state.analysisGeneration).toEqual(result.generation);
      instance._hydrateAnalysisFromCache(entry);
      expect(instance.state.analysisGeneration).toEqual(result.generation);
      expect(instance.state.analysisServedFromCache).toBe(true);
      expect(instance.state.analysisCachedAt).toBe(now);
      entry.version = 1;
      expect(
        instance._readAnalysisCacheEntry({
          action: 'read',
          addressLower,
          networkId: networkID,
          sessionSlug: slug,
          fingerprint,
        }),
      ).toBeNull();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('keeps fresh analysis visible when the analysisCache write port throws', async () => {
    const now = 1710000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { instance, slug } = makeAnalysisCacheInstance();
    const writeSpy = jest
      .spyOn(instance, '_writeAnalysisCacheEntry')
      .mockRejectedValue(new Error('analysis write failed'));
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'fresh summary despite write failure',
      details: 'fresh details despite write failure',
      name: 'Fresh Despite Write Failure',
      historicalAlignment: {},
    });

    try {
      await instance.analyzeUser();

      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionSlug: slug,
          result: expect.objectContaining({
            summary: 'fresh summary despite write failure',
          }),
        }),
      );
      expect(instance.state.analysisName).toBe('Fresh Despite Write Failure');
      expect(instance.state.aiAnalysis).toBe('fresh summary despite write failure');
      expect(instance.state.analysisServedFromCache).toBe(false);
      expect(instance.state.analysisCachedAt).toBeNull();
      expect(instance.state.analysisError).toBe('');
    } finally {
      nowSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('shows the analysis first, then makes the card: its words and its picture side by side', async () => {
    // My own page: a card is only ever made by its own person.
    const mine = '0x00000000000000000000000000000000000000a1';
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance({ viewAddress: mine, account: mine });
    const picture = { dataUrl: 'data:image/jpeg;base64,AAAA', accentHex: '#aa3311' };
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'summary',
      details: 'details',
      name: 'name',
      historicalAlignment: { figure: 'Grace Hopper (1906–1992)', reasoning: 'Reasoning.' },
    });
    let finishCard;
    analyzeUserCard.mockReturnValueOnce(new Promise((resolve) => (finishCard = resolve)));
    fetchAnalysisCardPicture.mockResolvedValueOnce(picture);

    await instance.analyzeUser();

    // The analysis is on screen and both card requests are out, before the card's words have come back.
    expect(instance.state.aiAnalysis).toBe('summary');
    expect(instance.state.analyzing).toBe(false);
    expect(instance.state.analysisCard).toBeNull();
    expect(instance.state.analysisCardPending).toBe(true);
    await waitFor(() => expect(analyzeUserCard).toHaveBeenCalledTimes(1));
    expect(fetchAnalysisCardPicture).toHaveBeenCalledTimes(1);
    expect(instance.state.analysisCardPending).toBe(true);
    // Someone else's page: no box, and nothing saved.
    expect(instance.state.analysisCardPublish).toBeNull();
    const [cardData, cardAnalysis, cardOptions] = analyzeUserCard.mock.calls[0];
    expect(cardData).toBe(analyzeUserOpinions.mock.calls[0][0]);
    expect(cardAnalysis).toEqual({
      name: 'name',
      summary: 'summary',
      details: 'details',
      figure: 'Grace Hopper (1906–1992)',
      reasoning: 'Reasoning.',
    });
    expect(cardOptions.sessionSlug).toBe(slug);
    // The picture request carries the figure and the session to ask, and nothing the person wrote.
    const [figure, options] = fetchAnalysisCardPicture.mock.calls[0];
    expect(figure).toBe('Grace Hopper (1906–1992)');
    expect(options.sessionSlug).toBe(slug);
    expect(JSON.stringify(fetchAnalysisCardPicture.mock.calls[0])).not.toContain('A deterministic answer');
    await waitFor(() => expect(instance.state.analysisCardPicture).toEqual({ status: 'ready', ...picture }));

    finishCard({
      title: 'Trusts plain tools over grand plans',
      matchNote: 'Made machines speak plainly.',
      tastes: { book: { title: 'A Book', by: 'An Author, 1950' } },
      answers: { ownWords: { questionId: 'q1', quote: 'A deterministic answer' } },
    });
    await waitFor(() => expect(instance.state.analysisCardPending).toBe(false));
    expect(instance.state.analysisCard).toMatchObject({
      own: true,
      // The foot of the card: the account the answers belong to and this site's page for the session.
      account: `${addressLower.slice(0, 6)}…${addressLower.slice(-4)}`,
      link: `${window.location.host}/session/${slug}`,
      title: 'Trusts plain tools over grand plans',
      figure: 'Grace Hopper (1906–1992)',
      answers: { ownWords: { text: 'A deterministic answer', trimmed: true } },
    });
    await waitFor(() =>
      expect(getSingleAnalysisCacheEntry({ slug, networkID, addressLower }).entry.result.card?.title).toBe(
        'Trusts plain tools over grand plans',
      ),
    );

    // Opened again, the analysis and the card come from the cache: only the picture is asked for. A session
    // that cannot draw leaves the card without one.
    analyzeUserOpinions.mockClear();
    analyzeUserCard.mockClear();
    fetchAnalysisCardPicture.mockRejectedValueOnce(new Error('picture_needs_openai_key'));
    await instance.analyzeUser();
    await waitFor(() => expect(instance.state.analysisCardPicture).toEqual({ status: 'none' }));
    expect(analyzeUserOpinions).not.toHaveBeenCalled();
    expect(analyzeUserCard).not.toHaveBeenCalled();
    expect(instance.state.analysisCard.title).toBe('Trusts plain tools over grand plans');
    expect(instance.state.analysisCardPending).toBe(false);
    expect(instance.state.analysisError).toBe('');
  });

  const SAVED_CARD = {
    title: 'Keeps the commons in common hands',
    matchNote: 'Both trust neighbours to set the rules.',
    figure: 'Elinor Ostrom (1933–2012)',
    tastes: { book: null, game: null, film: null, song: null },
    answers: { yesNo: null, ownWords: null, vote: null },
  };
  const matchedAnalysis = () =>
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'summary',
      details: 'details',
      name: 'name',
      historicalAlignment: { figure: 'Grace Hopper (1906–1992)', reasoning: 'Reasoning.' },
    });

  it("on someone else's page shows the card they saved, without writing another", async () => {
    const { instance, slug, addressLower } = makeAnalysisCacheInstance();
    matchedAnalysis();
    readSavedAnalysisCard.mockResolvedValueOnce({ status: 'ready', card: SAVED_CARD, savedAt: 1763460000000 });
    fetchAnalysisCardPicture.mockResolvedValueOnce({ dataUrl: 'data:image/jpeg;base64,AAAA', accentHex: '' });

    await instance.analyzeUser();
    await waitFor(() => expect(instance.state.analysisCardPending).toBe(false));

    expect(readSavedAnalysisCard).toHaveBeenCalledWith(addressLower, expect.objectContaining({ sessionSlug: slug }), {
      fresh: true,
    });
    expect(instance.state.analysisCard).toMatchObject({
      own: false,
      title: 'Keeps the commons in common hands',
      figure: 'Elinor Ostrom (1933–2012)',
      link: `${window.location.host}/session/${slug}`,
    });
    expect(instance.state.analysisCardSavedAt).toBe(1763460000000);
    expect(analyzeUserCard).not.toHaveBeenCalled();
    // The picture is of their card's figure, not of the one this analysis matched.
    expect(fetchAnalysisCardPicture.mock.calls.map(([figure]) => figure)).toEqual(['Elinor Ostrom (1933–2012)']);
    await waitFor(() => expect(instance.state.analysisCardPicture?.status).toBe('ready'));
    expect(publishSavedAnalysisCard).not.toHaveBeenCalled();
    expect(instance.state.analysisCardPublish).toBeNull();
  });

  it.each([
    ['they saved none', { status: 'none' }, '0x00000000000000000000000000000000000000bb'],
    ['their saved card cannot be read', null, '0x00000000000000000000000000000000000000bb'],
    ['nobody is signed in', { status: 'none' }, ''],
  ])("on someone else's page makes no card when %s", async (_why, saved, account) => {
    const { instance } = makeAnalysisCacheInstance({ account });
    matchedAnalysis();
    readSavedAnalysisCard.mockResolvedValueOnce(saved);

    await instance.analyzeUser();
    await waitFor(() => expect(instance.state.aiAnalysis).toBe('summary'));
    // Past the question to the Worker, which is where a card would have been started.
    await waitFor(() => expect(readSavedAnalysisCard).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(instance.state.analysisCardPending).toBe(false));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The analysis is theirs to read; a card is made only by its own person, for their own address.
    expect(analyzeUserCard).not.toHaveBeenCalled();
    expect(fetchAnalysisCardPicture).not.toHaveBeenCalled();
    expect(publishSavedAnalysisCard).not.toHaveBeenCalled();
    expect(instance.state).toMatchObject({ analysisCard: null, analysisCardPicture: null, analysisCardPublish: null });
  });

  it("on someone else's page shows no card kept with an earlier analysis", async () => {
    // As an analysis cached before cards were own-page only, with the card a visitor's Analyze then made.
    const { instance } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'summary',
      details: 'details',
      name: 'name',
      historicalAlignment: { figure: 'Grace Hopper (1906–1992)', reasoning: 'Reasoning.' },
      card: { title: 'A card made for a visitor', figure: 'Grace Hopper (1906–1992)' },
    });
    readSavedAnalysisCard.mockResolvedValueOnce({ status: 'none' });

    await instance.analyzeUser();
    await waitFor(() => expect(readSavedAnalysisCard).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(instance.state.analysisCardPending).toBe(false));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(instance.state.analysisCard).toBeNull();
    expect(analyzeUserCard).not.toHaveBeenCalled();
    expect(fetchAnalysisCardPicture).not.toHaveBeenCalled();
  });

  it("on someone else's page shows no card when they withdrew theirs", async () => {
    const { instance } = makeAnalysisCacheInstance();
    matchedAnalysis();
    readSavedAnalysisCard.mockResolvedValueOnce({ status: 'withdrawn' });

    await instance.analyzeUser();
    await waitFor(() => expect(instance.state.analysisCardPending).toBe(false));

    expect(instance.state.aiAnalysis).toBe('summary');
    expect(instance.state.analysisCard).toBeNull();
    expect(instance.state.analysisCardPicture).toBeNull();
    expect(analyzeUserCard).not.toHaveBeenCalled();
    expect(fetchAnalysisCardPicture).not.toHaveBeenCalled();
  });

  it('on my own page saves a new card, and the box saves or withdraws it', async () => {
    const own = '0x00000000000000000000000000000000000000bb';
    const { instance, slug } = makeAnalysisCacheInstance({ viewAddress: own, account: own });
    matchedAnalysis();
    readSavedAnalysisCard.mockResolvedValueOnce({ status: 'none' });
    analyzeUserCard.mockResolvedValueOnce({ title: 'Trusts plain tools over grand plans' });

    await instance.analyzeUser();
    await waitFor(() => expect(publishSavedAnalysisCard).toHaveBeenCalledTimes(1));

    const [account, published, card, options] = publishSavedAnalysisCard.mock.calls[0];
    expect([account, published, options.sessionSlug]).toEqual([own, true, slug]);
    expect(card).toBe(instance.state.analysisCard);
    expect(card).toMatchObject({ own: true, title: 'Trusts plain tools over grand plans' });
    await waitFor(() => expect(instance.state.analysisCardPublish).toEqual({ shown: true, saving: false, note: '' }));

    // A failure puts the box back to what is saved, and says so.
    publishSavedAnalysisCard.mockRejectedValueOnce(new Error('card_store_unavailable'));
    instance.setAnalysisCardShown(false);
    await waitFor(() => expect(instance.state.analysisCardPublish.note).toMatch(/could not be taken off/));
    expect(instance.state.analysisCardPublish).toMatchObject({ shown: true, saving: false });
    // Unticked: withdrawn.
    instance.setAnalysisCardShown(false);
    await waitFor(() => expect(instance.state.analysisCardPublish).toEqual({ shown: false, saving: false, note: '' }));
    expect(publishSavedAnalysisCard.mock.calls[2].slice(0, 2)).toEqual([own, false]);
    publishSavedAnalysisCard.mockRejectedValueOnce(new Error('card_store_unavailable'));
    instance.setAnalysisCardShown(true);
    await waitFor(() => expect(instance.state.analysisCardPublish.note).toMatch(/could not be saved/));
    expect(instance.state.analysisCardPublish).toMatchObject({ shown: false, saving: false });
    // A card the Worker would refuse says so, without asking to try again.
    publishSavedAnalysisCard.mockRejectedValueOnce(new Error('invalid_card'));
    instance.setAnalysisCardShown(true);
    await waitFor(() =>
      expect(instance.state.analysisCardPublish.note).toBe('This card cannot be saved to your page.'),
    );
    expect(instance.state.analysisCardPublish.shown).toBe(false);
  });

  it('on my own page starts the save as the card appears, and keeps the card while the save is slow', async () => {
    const own = '0x00000000000000000000000000000000000000ee';
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance({ viewAddress: own, account: own });
    matchedAnalysis();
    readSavedAnalysisCard.mockResolvedValueOnce({ status: 'none' });
    analyzeUserCard.mockResolvedValueOnce({ title: 'Trusts plain tools over grand plans' });
    publishSavedAnalysisCard.mockReturnValueOnce(new Promise(() => {}));
    // The cache write that keeps the card is held until the test lets it go.
    const write = instance._writeAnalysisCacheEntry;
    let release;
    let atCard;
    jest.spyOn(instance, '_writeAnalysisCacheEntry').mockImplementation(async (entry) => {
      if (entry.result?.card) {
        // What the box shows once the run that put the card up has finished.
        queueMicrotask(() => (atCard = instance.state.analysisCardPublish));
        await new Promise((resolve) => (release = resolve));
      }
      return write(entry);
    });

    await instance.analyzeUser();
    await waitFor(() => expect(instance.state.analysisCard?.title).toBe('Trusts plain tools over grand plans'));

    // The box is busy from the moment the card shows, so an untick cannot race the save.
    await waitFor(() => expect(release).toBeDefined());
    expect(publishSavedAnalysisCard).toHaveBeenCalledTimes(1);
    expect(atCard).toMatchObject({ shown: true, saving: true });
    // A save that never answers does not hold up the cache.
    release();
    await waitFor(() =>
      expect(getSingleAnalysisCacheEntry({ slug, networkID, addressLower }).entry.result.card?.title).toBe(
        'Trusts plain tools over grand plans',
      ),
    );
  });

  it('on my own page saves nothing once someone else is signed in', async () => {
    const own = '0x00000000000000000000000000000000000000bb';
    const { instance } = makeAnalysisCacheInstance({ viewAddress: own, account: own });
    matchedAnalysis();
    readSavedAnalysisCard.mockResolvedValueOnce({ status: 'none' });
    let finishCard;
    analyzeUserCard.mockReturnValueOnce(new Promise((resolve) => (finishCard = resolve)));

    await instance.analyzeUser();
    await waitFor(() => expect(analyzeUserCard).toHaveBeenCalledTimes(1));
    // The account changes while the card is being written.
    instance.props = { ...instance.props, account: '0x00000000000000000000000000000000000000cc' };
    finishCard({ title: 'Trusts plain tools over grand plans' });
    await waitFor(() => expect(instance.state.analysisCardPending).toBe(false));
    // The box was for the account that was: it goes, and changing it saves nothing.
    await waitFor(() => expect(instance.state.analysisCardPublish).toBeNull());
    instance.setAnalysisCardShown(false);
    instance.setAnalysisCardShown(true);
    expect(publishSavedAnalysisCard).not.toHaveBeenCalled();
  });

  it("shows and saves no saved card in a session other than the page's own", async () => {
    const own = '0x00000000000000000000000000000000000000bb';
    const instance = makeInstance({ viewAddress: own, account: own, activeSessionSlug: 'active-slug' });
    withAnEntry(instance);
    matchedAnalysis();
    // The Worker that will write the card is asked whether the card is on; a card saved there is not this page's.
    readSavedAnalysisCard.mockResolvedValueOnce({ status: 'ready', card: SAVED_CARD, savedAt: 1763460000000 });
    analyzeUserCard.mockResolvedValueOnce({ title: 'Trusts plain tools over grand plans' });
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['active-slug', 'open-slug']);
    jest
      .spyOn(instance, '_getSessionConfigForSlugExact')
      .mockImplementation((slug) => ({ slug, analysisCardEnabled: true }));
    checkSponsoredAccess.mockImplementation(async ({ sessionSlug }) =>
      sessionSlug === 'open-slug'
        ? { status: 'no-gate', gate: null, resourceKey: 'ai' }
        : { status: 'denied', gate: { type: 'sbt' }, resourceKey: 'ai' },
    );

    await instance.analyzeUser();
    await waitFor(() => expect(instance.state.analysisCard?.title).toBe('Trusts plain tools over grand plans'));

    expect(analyzeUserCard.mock.calls[0][2].sessionSlug).toBe('open-slug');
    expect(readSavedAnalysisCard.mock.calls.map(([, options]) => options.sessionSlug)).toEqual(['open-slug']);
    expect(instance.state.analysisCardSavedAt).toBeNull();
    expect(publishSavedAnalysisCard).not.toHaveBeenCalled();
    expect(instance.state.analysisCardPublish).toBeNull();
    await expect(instance.resolveSavedAnalysisCardOptions()).resolves.toBeNull();
  });

  it.each(['participant_aggregate', 'private_admin'])(
    'on my own page shows my card but saves none, and offers no box, where answers are kept private (%s)',
    async (visibility) => {
      const own = '0x00000000000000000000000000000000000000d4';
      const { instance, slug } = makeAnalysisCacheInstance({ viewAddress: own, account: own });
      const config = instance._getSessionConfigForSlugExact(slug);
      jest
        .spyOn(instance, '_getSessionConfigForSlugExact')
        .mockImplementation((candidate) =>
          candidate === slug
            ? { ...config, sessionModeProfile: { authority: { mode: 'worker_canonical' }, results: { visibility } } }
            : null,
        );
      matchedAnalysis();
      // Nothing is saved yet: in a session with public answers this is where my card would be saved.
      readSavedAnalysisCard.mockResolvedValueOnce({ status: 'none' });
      analyzeUserCard.mockResolvedValueOnce({ title: 'Trusts plain tools over grand plans' });

      await instance.analyzeUser();
      await waitFor(() => expect(instance.state.analysisCard).toMatchObject({ own: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // The card quotes answers only I and the admins may read: it never leaves this window.
      expect(publishSavedAnalysisCard).not.toHaveBeenCalled();
      expect(instance.state.analysisCardPublish).toBeNull();
    },
  );

  it.each([
    ['its own session', { activeSessionSlug: undefined }],
    ['a page with no session of its own', { activeSessionSlug: '' }],
  ])('a page loaded before the card was turned off pays for no card, in %s', async (_where, props) => {
    const own = '0x00000000000000000000000000000000000000e5';
    const { instance } = makeAnalysisCacheInstance({ viewAddress: own, account: own });
    if (props.activeSessionSlug === '') instance.props = { ...instance.props, activeSessionSlug: '', sessionSlug: '' };
    tagSession(instance);
    matchedAnalysis();
    // This page's copy of the session still says the card is on; the Worker knows better.
    readSavedAnalysisCard.mockResolvedValueOnce({ status: 'off' });

    await instance.analyzeUser();
    await waitFor(() => expect(instance.state.aiAnalysis).toBe('summary'));
    await waitFor(() => expect(instance.state.analysisCardPending).toBe(false));

    // Asked afresh: what the page read when it opened is from before the card was turned off.
    expect(readSavedAnalysisCard).toHaveBeenCalledTimes(1);
    expect(readSavedAnalysisCard.mock.calls[0][2]).toEqual({ fresh: true });
    // Neither the card's words (an AI call on the session's key) nor its picture is asked for.
    expect(analyzeUserCard).not.toHaveBeenCalled();
    expect(fetchAnalysisCardPicture).not.toHaveBeenCalled();
    expect(publishSavedAnalysisCard).not.toHaveBeenCalled();
    expect(instance.state.analysisCard).toBeNull();
    expect(instance.state.analysisCardPublish).toBeNull();
  });

  it('leaves the card out when its picture is refused because the card is off', async () => {
    const own = '0x00000000000000000000000000000000000000f6';
    const { instance } = makeAnalysisCacheInstance({ viewAddress: own, account: own });
    matchedAnalysis();
    readSavedAnalysisCard.mockResolvedValueOnce(null);
    fetchAnalysisCardPicture.mockReset().mockRejectedValue(new Error('analysis_card_off'));
    let finishWords = () => {};
    analyzeUserCard.mockReturnValueOnce(new Promise((resolve) => (finishWords = resolve)));

    await instance.analyzeUser();
    await waitFor(() => expect(fetchAnalysisCardPicture).toHaveBeenCalled());
    finishWords({ title: 'Trusts plain tools over grand plans' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(instance.state.analysisCard).toBeNull();
    expect(instance.state.analysisCardPending).toBe(false);
    expect(publishSavedAnalysisCard).not.toHaveBeenCalled();
  });

  it("makes no card where the page's own session turned it off, though the AI answers from another", async () => {
    const own = '0x00000000000000000000000000000000000000c3';
    const instance = makeInstance({ viewAddress: own, account: own, activeSessionSlug: 'active-slug' });
    withAnEntry(instance);
    matchedAnalysis();
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['active-slug', 'open-slug']);
    jest
      .spyOn(instance, '_getSessionConfigForSlugExact')
      .mockImplementation((slug) => ({ slug, analysisCardEnabled: slug !== 'active-slug' }));
    checkSponsoredAccess.mockImplementation(async ({ sessionSlug }) =>
      sessionSlug === 'open-slug'
        ? { status: 'no-gate', gate: null, resourceKey: 'ai' }
        : { status: 'denied', gate: { type: 'sbt' }, resourceKey: 'ai' },
    );

    await instance.analyzeUser();
    await waitFor(() => expect(instance.state.aiAnalysis).toBe('summary'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(analyzeUserOpinions.mock.calls.at(-1)[1].sessionSlug).toBe('open-slug');
    for (const mock of [analyzeUserCard, fetchAnalysisCardPicture, readSavedAnalysisCard, publishSavedAnalysisCard]) {
      expect(mock).not.toHaveBeenCalled();
    }
    expect(instance.state.analysisCard).toBeNull();
  });

  it('shows and saves no saved card on a page with no session of its own', async () => {
    // Not the account above, whose analysis in this session is cached by now.
    const own = '0x00000000000000000000000000000000000000dd';
    const instance = makeInstance({ viewAddress: own, account: own, activeSessionSlug: '' });
    withAnEntry(instance);
    matchedAnalysis();
    readSavedAnalysisCard.mockResolvedValueOnce({ status: 'ready', card: SAVED_CARD, savedAt: 1763460000000 });
    analyzeUserCard.mockResolvedValueOnce({ title: 'Trusts plain tools over grand plans' });
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['open-slug']);
    jest
      .spyOn(instance, '_getSessionConfigForSlugExact')
      .mockImplementation((slug) => ({ slug, analysisCardEnabled: true }));
    checkSponsoredAccess.mockResolvedValue({ status: 'no-gate', gate: null, resourceKey: 'ai' });

    await instance.analyzeUser();
    await waitFor(() => expect(instance.state.analysisCard?.title).toBe('Trusts plain tools over grand plans'));

    expect(analyzeUserCard.mock.calls[0][2].sessionSlug).toBe('open-slug');
    expect(instance.state.analysisCardSavedAt).toBeNull();
    expect(publishSavedAnalysisCard).not.toHaveBeenCalled();
    await expect(instance.resolveSavedAnalysisCardOptions()).resolves.toBeNull();
  });

  it('makes, draws, reads, saves and shows no card where it is off or the Worker is too old, a kept card included', async () => {
    const own = '0x00000000000000000000000000000000000000f1';
    const { instance, slug } = makeAnalysisCacheInstance({ viewAddress: own, account: own });
    const on = instance._getSessionConfigForSlugExact(slug);
    expect(on.analysisCardEnabled).toBe(true);
    const { analysisCardEnabled: _unused, ...absent } = on;
    let config = on;
    jest
      .spyOn(instance, '_getSessionConfigForSlugExact')
      .mockImplementation((candidate) => (candidate === slug ? config : null));
    // With the card on, as in a session made on /new: a card is made, saved and kept with the analysis.
    matchedAnalysis();
    readSavedAnalysisCard.mockResolvedValueOnce({ status: 'none' });
    analyzeUserCard.mockResolvedValueOnce({ title: 'Trusts plain tools over grand plans' });
    await instance.analyzeUser();
    await waitFor(() => expect(publishSavedAnalysisCard).toHaveBeenCalledTimes(1));
    expect(instance.state.analysisCard?.title).toBe('Trusts plain tools over grand plans');

    // Turned off by an admin, never turned on (as in every session from before the card), or a Worker from
    // before the card whatever the setting: the kept analysis shows without its card.
    const cardCalls = [
      analyzeUserOpinions,
      analyzeUserCard,
      fetchAnalysisCardPicture,
      readSavedAnalysisCard,
      publishSavedAnalysisCard,
    ];
    for (const [off, workerHasCard] of [
      [{ ...on, analysisCardEnabled: false }, true],
      [absent, true],
      [on, false],
    ]) {
      config = off;
      mockWorkerHasCard = workerHasCard;
      cardCalls.forEach((mock) => mock.mockClear());
      await instance.analyzeUser();
      expect(instance.state.aiAnalysis).toBe('summary');
      await waitFor(() =>
        expect(instance.state).toMatchObject({
          analysisCard: null,
          analysisCardPending: false,
          analysisCardPicture: null,
          analysisCardPublish: null,
          analysisCardSavedAt: null,
        }),
      );
      await expect(instance.resolveSavedAnalysisCardOptions()).resolves.toBeNull();
      instance.setAnalysisCardShown(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
      cardCalls.forEach((mock) => expect(mock).not.toHaveBeenCalled());
    }

    // A new analysis in a session with the card off asks for no card either.
    const other = makeAnalysisCacheInstance({ viewAddress: '0x00000000000000000000000000000000000000f2' });
    const offConfig = { ...on, analysisCardEnabled: false, slug: other.slug };
    jest
      .spyOn(other.instance, '_getSessionConfigForSlugExact')
      .mockImplementation((candidate) => (candidate === other.slug ? offConfig : null));
    matchedAnalysis();
    cardCalls.forEach((mock) => mock.mockClear());
    await other.instance.analyzeUser();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
    expect(other.instance.state.analysisHistoricalFigure).toBe('Grace Hopper (1906–1992)');
    expect(other.instance.state.analysisCard).toBeNull();
    cardCalls.slice(1).forEach((mock) => expect(mock).not.toHaveBeenCalled());
  });

  it('shows a kept card only once its session and Worker are known to have the card', async () => {
    const own = '0x00000000000000000000000000000000000000f3';
    const { instance } = makeAnalysisCacheInstance({ viewAddress: own, account: own });
    matchedAnalysis();
    analyzeUserCard.mockResolvedValueOnce({ title: 'Trusts plain tools over grand plans' });
    await instance.analyzeUser();
    await waitFor(() => expect(instance.state.analysisCard?.title).toBe('Trusts plain tools over grand plans'));

    // Read back from the cache while the Worker is still being asked: the analysis shows, its card does not yet.
    let answer;
    analysisCardAvailableFor.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    analyzeUserCard.mockClear();
    await instance.analyzeUser();
    expect(instance.state.aiAnalysis).toBe('summary');
    expect(instance.state.analysisServedFromCache).toBe(true);
    expect(instance.state.analysisCard).toBeNull();
    answer(true);
    await waitFor(() => expect(instance.state.analysisCard?.title).toBe('Trusts plain tools over grand plans'));
    expect(analyzeUserCard).not.toHaveBeenCalled();
  });

  it('on my own page never saves over a "no", nor when the saved card cannot be read', async () => {
    const own = '0x00000000000000000000000000000000000000bb';
    const withdrawn = makeAnalysisCacheInstance({ viewAddress: own, account: own });
    matchedAnalysis();
    readSavedAnalysisCard.mockResolvedValueOnce({ status: 'withdrawn' });
    analyzeUserCard.mockResolvedValueOnce({ title: 'Trusts plain tools over grand plans' });
    await withdrawn.instance.analyzeUser();
    await waitFor(() =>
      expect(withdrawn.instance.state.analysisCard?.title).toBe('Trusts plain tools over grand plans'),
    );
    expect(withdrawn.instance.state.analysisCardPublish).toEqual({ shown: false, saving: false, note: '' });

    const unreadable = makeAnalysisCacheInstance({ viewAddress: own, account: own });
    matchedAnalysis();
    analyzeUserCard.mockResolvedValueOnce({ title: 'Trusts plain tools over grand plans' });
    await unreadable.instance.analyzeUser();
    await waitFor(() =>
      expect(unreadable.instance.state.analysisCard?.title).toBe('Trusts plain tools over grand plans'),
    );
    expect(unreadable.instance.state.analysisCardPublish).toBeNull();
    unreadable.instance.setAnalysisCardShown(true);
    expect(publishSavedAnalysisCard).not.toHaveBeenCalled();
  });

  it('on my own page takes the box away when the session now keeps answers private', async () => {
    // This page's copy of the session is from before its results were made private: the Worker refuses the save.
    const own = '0x00000000000000000000000000000000000000a7';
    const { instance } = makeAnalysisCacheInstance({ viewAddress: own, account: own });
    matchedAnalysis();
    readSavedAnalysisCard.mockResolvedValueOnce({ status: 'none' });
    publishSavedAnalysisCard.mockReset().mockRejectedValue(new Error('analysis_card_answers_private'));
    analyzeUserCard.mockResolvedValueOnce({ title: 'Trusts plain tools over grand plans' });

    await instance.analyzeUser();
    await waitFor(() => expect(publishSavedAnalysisCard).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(instance.state.analysisCardPublish).toBeNull());

    // The card stays for me to see; there is nothing left to tick.
    expect(instance.state.analysisCard?.title).toBe('Trusts plain tools over grand plans');
    instance.setAnalysisCardShown(true);
    expect(publishSavedAnalysisCard).toHaveBeenCalledTimes(1);
  });

  it('keeps the analysis when the card cannot be written, and tries the card again next time', async () => {
    const mine = '0x00000000000000000000000000000000000000a2';
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance({ viewAddress: mine, account: mine });
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'summary',
      details: 'details',
      name: 'name',
      historicalAlignment: { figure: 'Grace Hopper (1906–1992)', reasoning: 'Reasoning.' },
    });
    analyzeUserCard.mockRejectedValueOnce(new Error('Rate limit exceeded.'));

    await instance.analyzeUser();
    await waitFor(() => expect(instance.state.analysisCardPending).toBe(false));

    expect(instance.state.aiAnalysis).toBe('summary');
    expect(instance.state.analysisError).toBe('');
    expect(instance.state.analysisCard).toBeNull();
    expect(getSingleAnalysisCacheEntry({ slug, networkID, addressLower }).entry.result.card).toBeNull();

    // The cached analysis has no card yet, so opening it again asks for the card only.
    analyzeUserOpinions.mockClear();
    analyzeUserCard.mockResolvedValueOnce({ title: 'Trusts plain tools over grand plans' });
    await instance.analyzeUser();
    await waitFor(() => expect(instance.state.analysisCard?.title).toBe('Trusts plain tools over grand plans'));
    expect(analyzeUserOpinions).not.toHaveBeenCalled();
    expect(analyzeUserCard).toHaveBeenCalledTimes(2);
  });

  it('makes no card when the analysis matched no figure', async () => {
    const { instance } = makeAnalysisCacheInstance();

    await instance.analyzeUser();

    expect(instance.state.analysisCard).toBeNull();
    expect(instance.state.analysisCardPending).toBe(false);
    expect(instance.state.analysisCardPicture).toBeNull();
    expect(analyzeUserCard).not.toHaveBeenCalled();
    expect(fetchAnalysisCardPicture).not.toHaveBeenCalled();
  });

  it('hydrates unchanged analysis input from analysisCache without calling AI', async () => {
    const cachedAt = 1710000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(cachedAt);
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'seed summary',
      details: 'seed details',
      name: 'Seed Analysis',
      historicalAlignment: {},
    });

    try {
      await instance.analyzeUser();
      const seeded = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
      const cachedResult = {
        name: 'Cached Analysis',
        summary: 'cached summary',
        details: 'cached details',
        historicalAlignment: {
          figure: 'Grace Hopper',
          reasoning: 'Cached reasoning.',
        },
      };
      await writeSingleAnalysisCacheEntry({
        slug,
        networkID,
        addressLower,
        fingerprint: seeded.fingerprint,
        entry: {
          ...seeded.entry,
          result: cachedResult,
        },
      });

      analyzeUserOpinions.mockClear();
      nowSpy.mockReturnValue(cachedAt + 2 * 60 * 60 * 1000);

      await instance.analyzeUser();

      expect(analyzeUserOpinions).not.toHaveBeenCalled();
      expect(instance.state.analysisName).toBe('Cached Analysis');
      expect(instance.state.aiAnalysis).toBe('cached summary');
      expect(instance.state.analysisDetails).toBe('cached details');
      expect(instance.state.analysisHistoricalFigure).toBe('Grace Hopper');
      expect(instance.state.analysisHistoricalReasoning).toBe('Cached reasoning.');
      expect(instance.state.analysisServedFromCache).toBe(true);
      expect(instance.state.analysisCachedAt).toBe(cachedAt);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it.each([
    ['on-chain', { network: { id: 84532 } }, '84532'],
    ['default-session', { network: { id: 84532 }, activeSessionSlug: '' }, '84532'],
    ['hosted', { network: null, onChainProfileEnabled: false }, 'worker'],
  ])(
    'reuses %s analysis on header clicks after reopening, but regenerates when an answer changes',
    async (_, props, networkID) => {
      const { instance, slug, addressLower } = makeAnalysisCacheInstance(props);
      analyzeUserOpinions.mockResolvedValueOnce({ summary: 'Original analysis' });
      const view = render(renderedHeader(instance));

      fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
      await waitFor(() => {
        expect(getSingleAnalysisCacheEntry({ slug, networkID, addressLower }).entry?.result.summary).toBe(
          'Original analysis',
        );
      });
      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);

      const { instance: reopened } = makeAnalysisCacheInstance({ ...props, activeSessionSlug: slug });
      view.rerender(renderedHeader(reopened));
      fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
      await waitFor(() => expect(reopened.state.analysisServedFromCache).toBe(true));
      expect(reopened.state.aiAnalysis).toBe('Original analysis');
      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);

      reopened.state.detailedQuestionResponses.q1.answer.value = 'A changed answer';
      analyzeUserOpinions.mockResolvedValueOnce({ summary: 'Updated analysis' });
      view.rerender(renderedHeader(reopened));
      fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
      await waitFor(() => expect(reopened.state.aiAnalysis).toBe('Updated analysis'));
      expect(reopened.state.analysisServedFromCache).toBe(false);
      expect(analyzeUserOpinions).toHaveBeenCalledTimes(2);
      expect(analyzeUserOpinions.mock.lastCall[0].questions[0].answer).toBe('A changed answer');
      await waitFor(() => {
        const cache = cacheScripts.peekCacheSync('analysisCache', slug, { clone: false });
        expect(Object.values(cache[networkID][addressLower])).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ result: expect.objectContaining({ summary: 'Updated analysis' }) }),
          ]),
        );
      });

      view.rerender(renderedHeader(reopened));
      fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
      await waitFor(() => expect(reopened.state.analysisServedFromCache).toBe(true));
      expect(reopened.state.aiAnalysis).toBe('Updated analysis');
      expect(analyzeUserOpinions).toHaveBeenCalledTimes(2);
    },
  );

  it('treats expired analysisCache entries as misses', async () => {
    const cachedAt = 1710000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(cachedAt);
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'seed summary',
      details: 'seed details',
      name: 'Seed Analysis',
      historicalAlignment: {},
    });

    try {
      await instance.analyzeUser();
      const seeded = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
      await writeSingleAnalysisCacheEntry({
        slug,
        networkID,
        addressLower,
        fingerprint: seeded.fingerprint,
        entry: {
          ...seeded.entry,
          expiresAt: cachedAt - 1,
        },
      });

      analyzeUserOpinions.mockClear();
      analyzeUserOpinions.mockResolvedValueOnce({
        summary: 'new summary after expiry',
        details: 'new details after expiry',
        name: 'Fresh After Expiry',
        historicalAlignment: {},
      });
      instance.state = {
        ...instance.state,
        aiAnalysis: 'stale cached summary',
        analysisCachedAt: cachedAt - 1000,
        analysisServedFromCache: true,
      };

      await instance.analyzeUser();

      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
      expect(instance.state.aiAnalysis).toBe('new summary after expiry');
      expect(instance.state.analysisName).toBe('Fresh After Expiry');
      expect(instance.state.analysisServedFromCache).toBe(false);
      expect(instance.state.analysisCachedAt).toBeNull();
      const refreshed = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
      expect(refreshed.entry.cachedAt).toBe(cachedAt);
      expect(refreshed.entry.result.summary).toBe('new summary after expiry');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('falls back to AI when the analysisCache read port throws', async () => {
    const now = 1710000000000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const realPeekCache = cacheScripts.peekCacheSync;
    let analysisReadAttempts = 0;
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug, options) => {
      if (namespace === 'analysisCache' && analysisReadAttempts === 0) {
        analysisReadAttempts += 1;
        throw new Error('analysis read failed');
      }
      return realPeekCache(namespace, slug, options);
    });
    const { instance } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'fallback summary after cache read error',
      details: 'fallback details',
      name: 'Fallback Analysis',
      historicalAlignment: {},
    });

    try {
      await instance.analyzeUser();

      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
      expect(instance.state.analysisName).toBe('Fallback Analysis');
      expect(instance.state.aiAnalysis).toBe('fallback summary after cache read error');
      expect(instance.state.analysisServedFromCache).toBe(false);
      expect(instance.state.analysisCachedAt).toBeNull();
      expect(analysisReadAttempts).toBe(1);
    } finally {
      nowSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('forceRefresh bypasses analysisCache and overwrites the cached entry', async () => {
    const cachedAt = 1710000000000;
    const refreshedAt = cachedAt + 5000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(cachedAt);
    const { instance, slug, networkID, addressLower } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({
      summary: 'seed summary',
      details: 'seed details',
      name: 'Seed Analysis',
      historicalAlignment: {},
    });

    try {
      await instance.analyzeUser();
      const seeded = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });

      analyzeUserOpinions.mockClear();
      analyzeUserOpinions.mockResolvedValueOnce({
        summary: 'force refreshed summary',
        details: 'force refreshed details',
        name: 'Force Refreshed Analysis',
        historicalAlignment: {
          figure: 'Katherine Johnson',
          reasoning: 'Fresh calculation.',
        },
      });
      nowSpy.mockReturnValue(refreshedAt);

      await instance.analyzeUser(true);

      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
      expect(instance.state.analysisName).toBe('Force Refreshed Analysis');
      expect(instance.state.analysisServedFromCache).toBe(false);
      const refreshed = getSingleAnalysisCacheEntry({ slug, networkID, addressLower });
      expect(refreshed.fingerprint).toBe(seeded.fingerprint);
      expect(refreshed.entry.cachedAt).toBe(refreshedAt);
      expect(refreshed.entry.result.summary).toBe('force refreshed summary');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('prefers in-scope open-gate session over stale cache slugs for analyze routing', async () => {
    const inScopeSlug = 'in-scope-open-session';
    const secondaryScopeSlug = 'in-scope-secondary-session';
    const staleCacheSlug = 'stale-cache-session';

    globalThis.CE_SESSION_SCAN_SCOPE = 'list';
    globalThis.CE_SESSION_SCAN_SLUGS = [inScopeSlug, secondaryScopeSlug];
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: inScopeSlug,
    });
    withAnEntry(instance);
    jest
      .spyOn(cacheScripts, 'listNamespaceSlugsSync')
      .mockImplementation((namespace) => (namespace === 'userCache' ? [staleCacheSlug, inScopeSlug] : []));
    jest.spyOn(instance, '_getSessionConfigForSlugExact').mockImplementation((slug) => ({ slug }));
    checkSponsoredAccess.mockResolvedValue({
      status: 'no-gate',
      gate: null,
      resourceKey: 'ai',
    });

    await instance.analyzeUser();

    expect(analyzeUserOpinions).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        context: expect.objectContaining({
          account: '0x00000000000000000000000000000000000000bb',
          chainId: 84532,
        }),
        sessionSlug: inScopeSlug,
        sessionConfig: expect.objectContaining({ slug: inScopeSlug }),
        throwOnError: true,
        sessionSelection: expect.objectContaining({
          gateStatus: 'no-gate',
          reason: 'open-ai-gate',
        }),
      }),
    );
  });

  it('keeps the active session candidate even when strict list scope excludes it', () => {
    const inScopeSlug = 'in-scope-open-session';
    const outOfScopeActiveSlug = 'active-out-of-scope-session';
    const staleCacheSlug = 'stale-cache-session';

    globalThis.CE_SESSION_SCAN_SCOPE = 'list';
    globalThis.CE_SESSION_SCAN_SLUGS = [inScopeSlug];
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: outOfScopeActiveSlug,
    });
    jest
      .spyOn(cacheScripts, 'listNamespaceSlugsSync')
      .mockImplementation((namespace) => (namespace === 'userCache' ? [staleCacheSlug] : []));

    const candidates = instance._getAiSessionSlugCandidates();

    expect(candidates).toEqual([outOfScopeActiveSlug, inScopeSlug]);
  });

  it('uses the active primary session for single-session behavior while preserving the full list scope for deep-scan ordering', () => {
    globalThis.CE_SESSION_SCAN_SCOPE = 'list';
    globalThis.CE_SESSION_SCAN_SLUGS = ['', 'edge'];
    const instance = makeInstance({
      activeSessionSlug: 'primary-session',
    });

    expect(instance.getActiveSessionSlug()).toBe('primary-session');
    expect(instance._getDeepScanPrioritySlugs()).toEqual(['primary-session', '', 'edge']);
  });

  it('turns Worker missing AI key failures into an AI settings recovery action', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { instance } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockRejectedValueOnce(new Error('Server misconfigured: openaiKey is missing.'));

    try {
      await instance.analyzeUser();

      expect(instance.state.analyzing).toBe(false);
      expect(instance.state.analysisError).toBe(
        'AI analysis needs a configured AI provider key. Add an AI key in Account Settings, then refresh this analysis.',
      );
      expect(instance.state.analysisErrorAction).toBe('add-ai-key');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  describe('the first read shown while the analysis is written', () => {
    const firstRead = { headline: 'Wants decisions made close to home.', points: ['One', 'Two'] };
    const pending = () => {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
    // The steps before the request (finding the session, the fingerprint) are not all microtasks.
    const settle = async () => {
      for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    };

    it('shows it while the analysis is under way, and the analysis then takes its place', async () => {
      const { instance } = makeAnalysisCacheInstance();
      const full = pending();
      analyzeUserOpinions.mockReturnValueOnce(full.promise);
      analyzeUserFirstRead.mockResolvedValueOnce(firstRead);

      const run = instance.analyzeUser();
      await settle();

      expect(instance.state.analyzing).toBe(true);
      expect(instance.state.aiAnalysis).toBe('Wants decisions made close to home.');
      expect(instance.state.analysisDetails).toBe('One\nTwo');
      expect(analyzeUserFirstRead.mock.calls[0]).toEqual(analyzeUserOpinions.mock.calls[0]);

      full.resolve({ name: 'The Careful Federalist', summary: 'The full summary.', details: 'The full details.' });
      await run;

      expect(instance.state.analyzing).toBe(false);
      expect(instance.state.aiAnalysis).toBe('The full summary.');
      expect(instance.state.analysisDetails).toBe('The full details.');
      instance.clearAnalysisTimer();
    });

    it('keeps it on screen with the error when the analysis fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { instance } = makeAnalysisCacheInstance();
      const full = pending();
      analyzeUserOpinions.mockReturnValueOnce(full.promise);
      analyzeUserFirstRead.mockResolvedValueOnce(firstRead);

      try {
        const run = instance.analyzeUser();
        await settle();
        full.reject(new TypeError('Load failed'));
        await run;

        expect(instance.state.analyzing).toBe(false);
        expect(instance.state.analysisError).toMatch(/^Unable to reach the AI service/);
        expect(instance.state.aiAnalysis).toBe('Wants decisions made close to home.');
        expect(instance.state.analysisDetails).toBe('One\nTwo');
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('drops one that arrives after the analysis, or after the analysis has failed', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const late = pending();
        const { instance } = makeAnalysisCacheInstance();
        analyzeUserFirstRead.mockReturnValueOnce(late.promise);
        analyzeUserOpinions.mockResolvedValueOnce({ name: 'n', summary: 'The full summary.', details: 'd' });
        await instance.analyzeUser();
        late.resolve(firstRead);
        await settle();
        expect(instance.state.aiAnalysis).toBe('The full summary.');
        instance.clearAnalysisTimer();

        const lateAgain = pending();
        const { instance: other } = makeAnalysisCacheInstance();
        analyzeUserFirstRead.mockReturnValueOnce(lateAgain.promise);
        analyzeUserOpinions.mockRejectedValueOnce(new Error('It failed.'));
        await other.analyzeUser();
        lateAgain.resolve(firstRead);
        await settle();
        expect(other.state.analysisError).toBe('It failed.');
        expect(other.state.aiAnalysis).toBe('');
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('drops one from an earlier press that arrives while a second press is under way', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const { instance } = makeAnalysisCacheInstance();
        const fromFirstPress = pending();
        analyzeUserFirstRead.mockReturnValueOnce(fromFirstPress.promise);
        analyzeUserOpinions.mockRejectedValueOnce(new Error('It failed.'));
        await instance.analyzeUser();

        const full = pending();
        analyzeUserOpinions.mockReturnValueOnce(full.promise);
        const again = instance.analyzeUser(true);
        await settle();
        expect(instance.state.analyzing).toBe(true);

        fromFirstPress.resolve(firstRead);
        await settle();
        expect(instance.state.aiAnalysis).toBe('');

        full.resolve({ name: 'n', summary: 'The full summary.', details: 'd' });
        await again;
        expect(instance.state.aiAnalysis).toBe('The full summary.');
        instance.clearAnalysisTimer();
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('asks for none when the analysis is served from this browser', async () => {
      const { instance } = makeAnalysisCacheInstance();
      analyzeUserOpinions.mockResolvedValueOnce({ name: 'n', summary: 'Kept.', details: 'd' });
      await instance.analyzeUser();
      instance.clearAnalysisTimer();
      expect(analyzeUserFirstRead).toHaveBeenCalledTimes(1);

      await instance.analyzeUser();
      expect(instance.state.analysisServedFromCache).toBe(true);
      expect(analyzeUserFirstRead).toHaveBeenCalledTimes(1);
      expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps network fetch failures distinct from missing AI key recovery', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { instance } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      await instance.analyzeUser();

      expect(instance.state.analyzing).toBe(false);
      expect(instance.state.analysisError).toBe(
        'Unable to reach the AI service. Check your connection or AI settings, then try again.',
      );
      expect(instance.state.analysisErrorAction).toBe('open-ai-settings');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('closes the analysis modal before opening the focused AI settings panel', () => {
    const toggleLoginModal = jest.fn();
    const { instance } = makeAnalysisCacheInstance({ toggleLoginModal });
    instance.state.showAnalysisModal = true;
    instance.analysisTimer = setInterval(() => {}, 1000);

    instance.openAiSettings();

    expect(instance.state.showAnalysisModal).toBe(false);
    expect(instance.analysisTimer).toBeNull();
    expect(toggleLoginModal).toHaveBeenCalledWith({ isOpen: true, focus: 'ai-config' });
  });

  it('does not route analyze calls through default worker fallback when no exact session config resolves', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: 'missing-session-slug',
    });
    withAnEntry(instance);
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['missing-session-slug']);
    jest.spyOn(instance, '_getSessionConfigForSlugExact').mockReturnValue(null);

    try {
      await instance.analyzeUser();

      expect(analyzeUserOpinions).not.toHaveBeenCalled();
      expect(instance.state.analyzing).toBe(false);
      expect(instance.state.analysisError).toContain('No valid AI session configuration');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[account]', '[UserPage] analyzeUser failed:', expect.any(Error));
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('does not treat demo-only slugs as valid analyze-session configs', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: 'rxc',
    });
    withAnEntry(instance);
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['rxc']);
    const exactSpy = jest.spyOn(instance, '_getSessionConfigForSlugExact');
    const demoSpy = jest.spyOn(contractScriptsModule, 'getDemoSessionConfigBySlug').mockReturnValue({
      slug: 'rxc',
      sessionName: 'Weyl v. Yarvin Debate',
    });

    try {
      const session = await instance.resolveAnalysisSessionContext();

      expect(session).toBeNull();
      expect(checkSponsoredAccess).not.toHaveBeenCalled();
      expect(analyzeUserOpinions).not.toHaveBeenCalled();
      expect(demoSpy).not.toHaveBeenCalled();
      expect(exactSpy).toHaveBeenCalledWith('rxc');
      expect(instance._getSessionConfigForSlugExact('rxc')).toBeNull();
    } finally {
      exactSpy.mockRestore();
      demoSpy.mockRestore();
    }
  });

  it('uses the profile route session config for Worker-backed analysis', async () => {
    const sessionConfig = {
      slug: 'demo-interview',
      corsWorkerUrl: 'https://worker.example',
      ai: { provider: 'openai', model: 'gpt-4o-mini' },
    };
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      activeSessionSlug: 'demo-interview',
      sessionConfig,
    });
    withAnEntry(instance);
    jest.spyOn(instance, '_getAiSessionSlugCandidates').mockReturnValue(['demo-interview']);
    checkSponsoredAccess.mockResolvedValue({
      status: 'no-gate',
      gate: null,
      resourceKey: 'ai',
    });

    await instance.analyzeUser();

    expect(analyzeUserOpinions).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        sessionSlug: 'demo-interview',
        sessionConfig,
        throwOnError: true,
      }),
    );
  });

  it('does not treat demo-only alias session keys as valid analyze-session configs', () => {
    const instance = makeInstance();
    const aliasConfig = instance._getSessionConfigForSlugExact('legacyEdge');

    expect(aliasConfig).toBeNull();
  });

  it('does not treat unknown non-general slugs as valid analyze-session configs', () => {
    const instance = makeInstance();
    const unresolved = instance._getSessionConfigForSlugExact('slug-that-does-not-exist-xyz');

    expect(unresolved).toBeNull();
  });

  it('preserves explicit general analyze-session configs when an authoritative empty-slug config exists', () => {
    const priorRegistryCache = localStorage.getItem(REGISTRY_CACHE_KEY);
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          '': {
            slug: '',
            sessionName: 'Registry General',
          },
        },
      }),
    );

    try {
      const instance = makeInstance();
      const general = instance._getSessionConfigForSlugExact('');

      expect(general).toEqual(
        expect.objectContaining({
          slug: '',
          sessionName: 'Registry General',
        }),
      );
    } finally {
      if (priorRegistryCache == null) {
        localStorage.removeItem(REGISTRY_CACHE_KEY);
      } else {
        localStorage.setItem(REGISTRY_CACHE_KEY, priorRegistryCache);
      }
    }
  });
  const switchAnalysisProfile = (instance, patch) => {
    for (const method of [
      'loadPersistedUsername',
      'loadDataFromCache',
      'checkIfBookmarked',
      'loadNicknameFromCache',
      'startProfileDeepScan',
      '_checkAiAvailability',
    ]) {
      jest.spyOn(instance, method).mockImplementation(() => {});
    }
    const prevProps = instance.props;
    const prevState = instance.state;
    instance.props = { ...prevProps, ...patch };
    instance.componentDidUpdate(prevProps, prevState);
  };
  const deferredAnalysis = () => {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  };

  it.each([
    { viewAddress: '0x00000000000000000000000000000000000000dd' },
    { activeSessionSlug: 'another-session' },
    { network: { id: 11155420 } },
  ])('completed analysis never follows a changed profile context: %j', async (patch) => {
    const { instance } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({
      name: 'First profile',
      summary: 'first-only',
      details: 'private-to-first',
    });
    await instance.analyzeUser();
    expect(instance.state.analysisDetails).toBe('private-to-first');
    switchAnalysisProfile(instance, patch);
    expect(instance.state).toMatchObject({
      analysisDetails: '',
      analysisName: '',
      analysisError: '',
      analyzing: false,
      showAnalysisModal: false,
    });
    expect(instance.analysisTimer).toBeNull();
  });

  it('a late profile result stays in its original cache and cannot stop the next request', async () => {
    const owner = makeAnalysisCacheInstance();
    const { instance } = owner;
    const first = deferredAnalysis();
    const second = deferredAnalysis();
    analyzeUserOpinions.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const firstRun = instance.analyzeUser();
    await waitFor(() => expect(analyzeUserOpinions).toHaveBeenCalledTimes(1));
    switchAnalysisProfile(instance, { viewAddress: '0x00000000000000000000000000000000000000dd' });
    withAnEntry(instance);
    const secondRun = instance.analyzeUser();
    await waitFor(() => expect(analyzeUserOpinions).toHaveBeenCalledTimes(2));
    const secondTimer = instance.analysisTimer;
    first.resolve({ name: 'First', summary: 'first-only', details: 'first details' });
    await firstRun;
    expect(getSingleAnalysisCacheEntry(owner).entry?.result.details).toBe('first details');
    expect(instance.state).toMatchObject({ analysisDetails: '', analyzing: true });
    expect(instance.analysisTimer).toBe(secondTimer);
    second.resolve({ name: 'Second', summary: 'second-only', details: 'second details' });
    await secondRun;
    expect(instance.state.analysisDetails).toBe('second details');
    expect(instance.analysisTimer).toBeNull();
  });

  it('a superseded request cannot replace a newer result or its cache reuse on the same profile', async () => {
    const { instance } = makeAnalysisCacheInstance();
    const first = deferredAnalysis();
    analyzeUserOpinions.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ details: 'new result' });
    const firstRun = instance.analyzeUser();
    await waitFor(() => expect(analyzeUserOpinions).toHaveBeenCalledTimes(1));
    await instance.analyzeUser(true);
    first.reject(new Error('obsolete failure'));
    await firstRun;
    expect(instance.state).toMatchObject({ analysisDetails: 'new result', analysisError: '' });
    await instance.analyzeUser();
    expect(analyzeUserOpinions).toHaveBeenCalledTimes(2);
    expect(instance.state).toMatchObject({ analysisDetails: 'new result', analysisServedFromCache: true });
  });

  it("sends no username to the AI, and a name change doesn't count as new input", async () => {
    const { instance } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({ details: 'result' });
    await instance.analyzeUser();
    expect(analyzeUserOpinions.mock.calls[0][0]).not.toHaveProperty('username');
    expect(JSON.stringify(analyzeUserOpinions.mock.calls[0][0])).not.toContain('Cache Test User');
    const previous = instance.state;
    instance.state = { ...previous, username: 'Renamed' };
    instance.componentDidUpdate(instance.props, previous);
    expect(instance.state).toMatchObject({ analysisDetails: 'result' });
  });

  it('keeps a closed analysis dialog closed when the same profile refreshes', async () => {
    const { instance } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({ details: 'old input result' });
    await instance.analyzeUser();
    instance.setState({ showAnalysisModal: false });
    const previous = instance.state;
    instance.state = { ...previous, sbtList: [] };
    instance.componentDidUpdate(instance.props, previous);
    expect(instance.state).toMatchObject({ analysisDetails: '', showAnalysisModal: false });
    expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
  });

  it('keeps the analysis open when the same profile receives refreshed inputs', async () => {
    const { instance } = makeAnalysisCacheInstance();
    analyzeUserOpinions.mockResolvedValueOnce({ details: 'old input result' });
    await instance.analyzeUser();
    expect(instance.state.showAnalysisModal).toBe(true);
    const previous = instance.state;
    instance.state = { ...previous, sbtList: [] };
    instance.componentDidUpdate(instance.props, previous);
    expect(instance.state).toMatchObject({ analysisDetails: '', showAnalysisModal: true });
    switchAnalysisProfile(instance, { viewAddress: '0x00000000000000000000000000000000000000ee' });
    expect(instance.state.showAnalysisModal).toBe(false);
  });

  it('changed analysis inputs invalidate a pending result without applying it', async () => {
    const { instance } = makeAnalysisCacheInstance();
    const pending = deferredAnalysis();
    analyzeUserOpinions.mockReturnValueOnce(pending.promise);
    const run = instance.analyzeUser();
    await waitFor(() => expect(analyzeUserOpinions).toHaveBeenCalledTimes(1));
    const previous = instance.state;
    instance.state = { ...previous, sbtList: [] };
    instance.componentDidUpdate(instance.props, previous);
    pending.resolve({ details: 'obsolete input' });
    await run;
    expect(instance.state).toMatchObject({ analysisDetails: '', analyzing: false, showAnalysisModal: true });
    expect(instance.analysisTimer).toBeNull();
  });
  it('offers Analyze user in the account dialog, which gives the page no sign-in or cache props', async () => {
    const me = '0x00000000000000000000000000000000000000aa';
    const dialogProps = { minimized: true, account: me, viewAddress: me, sessionConfig: { slug: 'dialog-slug' } };
    const { instance } = makeAnalysisCacheInstance({
      ...dialogProps,
      activeSessionSlug: 'dialog-slug',
      isSurveyCacheReady: undefined,
      isQuestionCacheReady: undefined,
      isResponsesCacheReady: undefined,
      isSBTCacheReady: undefined,
    });
    const offered = () => {
      const view = render(renderedHeader(instance));
      const button = view.queryByRole('button', { name: 'Analyze user' });
      view.unmount();
      return !!button;
    };
    try {
      expect(offered()).toBe(false);
      instance.componentDidMount();
      await waitFor(() => expect(instance.state.aiAvailable).toBe(true));
      expect(offered()).toBe(true);
      // No button where the page finds no AI it may use.
      instance.state = { ...instance.state, aiAvailable: false };
      expect(offered()).toBe(false);
    } finally {
      instance.componentWillUnmount();
    }
  });
  it('a delayed cache lookup cannot hydrate a different profile', async () => {
    const { instance } = makeAnalysisCacheInstance();
    await instance.analyzeUser();
    const lookup = deferredAnalysis();
    const original = instance._buildAnalysisCacheContext.bind(instance);
    jest.spyOn(instance, '_buildAnalysisCacheContext').mockImplementation(async (args) => {
      const value = await original(args);
      await lookup.promise;
      return value;
    });
    const cachedRun = instance.analyzeUser();
    await waitFor(() => expect(instance._buildAnalysisCacheContext).toHaveBeenCalled());
    switchAnalysisProfile(instance, { viewAddress: '0x00000000000000000000000000000000000000dd' });
    lookup.resolve();
    await cachedRun;
    expect(instance.state).toMatchObject({
      analysisDetails: '',
      analysisServedFromCache: false,
      showAnalysisModal: false,
    });
    expect(analyzeUserOpinions).toHaveBeenCalledTimes(1);
  });
});
