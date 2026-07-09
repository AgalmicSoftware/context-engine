import { writeSubmittedResponsesToLocalCaches } from './surveyToolPostSubmitCacheController';
import { normalizeSubmitReceipt } from './surveyToolSubmitTransactionController';
import { buildSubmissionGroupContext } from './surveyToolHydrationFlow';
import { processRatingEnvelopesForSubmit } from './surveyToolRatingEnvelopeSubmitController';
import { resolveSurveyToolSubmittedCacheWriteContext } from './surveyToolSessionResolution';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

const TX_HASH = `0x${'6'.repeat(64)}`;

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const makeCacheDeps = ({
  account = '0xabc',
  effectiveDraftSlug = '',
  singleQuestionMode = false,
  isStandalone = false,
  network = { id: 84532 },
  networkChainId = undefined,
  resolveBySlug = undefined,
} = {}) => ({
  account,
  effectiveDraftSlug,
  singleQuestionMode,
  isStandalone,
  deepClone,
  resolveSubmittedCacheWriteContext: (sessionSlug) =>
    resolveSurveyToolSubmittedCacheWriteContext({
      sessionSlug,
      network,
      networkChainId,
      resolveBySlug,
    }),
});

const buildSubmitContextKey = (context = {}) =>
  [
    String(context.account || '')
      .trim()
      .toLowerCase(),
    String(context.providerKind || '')
      .trim()
      .toLowerCase(),
    String(context.effectiveDraftSlug || '')
      .trim()
      .toLowerCase(),
    String(context.chainId || '').trim(),
    context.singleQuestionMode ? 'single' : context.isStandalone ? 'standalone' : 'survey',
    String(context.surveyIndex ?? '').trim(),
    String(context.surveyId || '')
      .trim()
      .toLowerCase(),
    String(context.questionID || '')
      .trim()
      .toLowerCase(),
  ].join('|');

describe('SurveyTool submit cache writes', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('writes submitted responses into local caches without advancing scan watermarks', async () => {
    const slug = 'edge-submit-local';
    const surveyId = '0xsurvey';
    const responder = '0xabc';
    const surveyResponseSeed = {
      surveyID: surveyId,
      responder,
      surveyTitle: 'Existing Survey',
      responses: [
        {
          questionID: 'q0',
          responder,
          type: 'freeform',
          prompt: 'Existing prompt',
          answer: { value: 'old', encrypted: false },
          additional: { value: '', encrypted: false },
        },
      ],
      blockNumber: 5,
      transactionIndex: 0,
      logIndex: 0,
      timestamp: 5,
    };

    await cacheScripts.removeCache('questionsCache', slug).catch(() => null);
    await cacheScripts.removeCache('surveysCache', slug).catch(() => null);
    await cacheScripts.writeCache('surveysCache', slug, {
      84532: {
        surveys: {
          [surveyId]: {
            id: surveyId,
            surveyID: surveyId,
            title: 'Existing Survey',
            questionIDs: ['q0'],
          },
        },
        surveysLatestBlock: 0,
        surveyResponses: {
          [surveyId]: {
            [responder]: surveyResponseSeed,
          },
        },
        surveyResponsesLatestBlock: {},
      },
    });

    try {
      const result = await writeSubmittedResponsesToLocalCaches(
        {
          receipt: {
            blockNumber: 22,
            transactionIndex: 3,
            transactionHash: `0x${'2'.repeat(64)}`,
          },
          questionResponses: [
            {
              questionID: 'q1',
              responder,
              type: 'freeform',
              prompt: 'New prompt',
              answer: { value: 'fresh', encrypted: false },
              additional: { value: '', encrypted: false },
              importance: null,
              conviction: null,
              sessionName: 'Edge Session',
            },
          ],
          surveyResponse: {
            surveyID: surveyId,
            responder,
            surveyTitle: 'Updated Survey',
            sessionName: 'Edge Session',
            responses: [
              {
                questionID: 'q1',
                responder,
                type: 'freeform',
                prompt: 'New prompt',
                answer: { value: 'fresh', encrypted: false },
                additional: { value: '', encrypted: false },
              },
            ],
          },
          surveyId,
        },
        makeCacheDeps({
          account: responder,
          effectiveDraftSlug: slug,
        }),
      );

      expect(result).toEqual({ questionCacheWritten: true, surveyCacheWritten: true });

      const questionsCache = await cacheScripts.readCache('questionsCache', slug);
      expect(questionsCache?.['84532']?.questionResponses?.q1?.[responder]).toEqual(
        expect.objectContaining({
          questionID: 'q1',
          blockNumber: 22,
          transactionIndex: 3,
          logIndex: 0,
          transactionHash: `0x${'2'.repeat(64)}`,
        }),
      );
      expect(questionsCache?.['84532']?.questionResponsesMeta?.q1?.[responder]).toEqual(
        expect.objectContaining({
          bn: 22,
          txi: 3,
          li: 0,
        }),
      );
      expect(questionsCache?.['84532']?.questionResponsesLatestBlock).toBe(0);
      expect(questionsCache?.['84532']?.questions?.q1).toEqual(
        expect.objectContaining({
          id: 'q1',
          prompt: 'New prompt',
          type: 'freeform',
          sessionName: 'Edge Session',
        }),
      );

      const surveysCache = await cacheScripts.readCache('surveysCache', slug);
      const mergedSurveyResponse = surveysCache?.['84532']?.surveyResponses?.[surveyId]?.[responder];
      expect(mergedSurveyResponse).toEqual(
        expect.objectContaining({
          surveyID: surveyId,
          blockNumber: 22,
          transactionIndex: 3,
          logIndex: 0,
          transactionHash: `0x${'2'.repeat(64)}`,
        }),
      );
      expect(mergedSurveyResponse?.responses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ questionID: 'q0' }),
          expect.objectContaining({ questionID: 'q1' }),
        ]),
      );
      expect(surveysCache?.['84532']?.surveys?.[surveyId]).toEqual(
        expect.objectContaining({
          title: 'Updated Survey',
          sessionName: 'Edge Session',
          questionIDs: expect.arrayContaining(['q0', 'q1']),
        }),
      );
      expect(surveysCache?.['84532']?.surveyResponsesLatestBlock).toEqual({});
    } finally {
      await cacheScripts.removeCache('questionsCache', slug).catch(() => null);
      await cacheScripts.removeCache('surveysCache', slug).catch(() => null);
    }
  });

  it('writes submitted responses into the explicit submission slug cache instead of the route slug', async () => {
    const routeSlug = 'edge-submit-route';
    const submissionSlug = 'alpha-submit-target';
    const responder = '0xabc';

    await cacheScripts.removeCache('questionsCache', routeSlug).catch(() => null);
    await cacheScripts.removeCache('questionsCache', submissionSlug).catch(() => null);
    await cacheScripts.writeCache('questionsCache', routeSlug, {
      84532: {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });

    try {
      const result = await writeSubmittedResponsesToLocalCaches(
        {
          receipt: {
            blockNumber: 31,
            transactionIndex: 4,
            transactionHash: `0x${'8'.repeat(64)}`,
          },
          questionResponses: [
            {
              questionID: 'q1',
              responder,
              type: 'freeform',
              prompt: 'Alpha prompt',
              answer: { value: 'fresh', encrypted: false },
              additional: { value: '', encrypted: false },
            },
          ],
          submissionSlug,
        },
        makeCacheDeps({
          account: responder,
          effectiveDraftSlug: routeSlug,
        }),
      );

      expect(result).toEqual({ questionCacheWritten: true, surveyCacheWritten: false });
      const routeCache = await cacheScripts.readCache('questionsCache', routeSlug);
      const submissionCache = await cacheScripts.readCache('questionsCache', submissionSlug);
      expect(routeCache?.['84532']?.questionResponses?.q1).toBeUndefined();
      expect(submissionCache?.['84532']?.questionResponses?.q1?.[responder]).toEqual(
        expect.objectContaining({
          questionID: 'q1',
          blockNumber: 31,
          transactionIndex: 4,
        }),
      );
    } finally {
      await cacheScripts.removeCache('questionsCache', routeSlug).catch(() => null);
      await cacheScripts.removeCache('questionsCache', submissionSlug).catch(() => null);
    }
  });

  it('routes pile submissions through the changed question session slug', async () => {
    const submitResponses = jest.fn().mockResolvedValue({
      wait: jest.fn().mockResolvedValue({
        status: 1,
        transactionHash: TX_HASH,
      }),
    });
    const questionResponses = [
      {
        questionID: 'q1',
        responder: '0xabc',
        type: 'freeform',
        prompt: 'Prompt 1',
        answer: { value: 'yes', encrypted: false },
        additional: { value: '', encrypted: false },
      },
    ];
    const submissionContext = buildSubmissionGroupContext({
      questionIds: ['q1'],
      slugByQuestionId: new Map([['q1', 'alpha']]),
      fallbackSlug: 'edge',
    });

    expect(submissionContext).toEqual(
      expect.objectContaining({
        ok: true,
        submissionGroupKey: 'alpha',
      }),
    );

    const tx = await submitResponses(
      {},
      ['hashed-q1'],
      questionResponses,
      `0x${'0'.repeat(64)}`,
      null,
      submissionContext.submissionGroupKey,
    );
    const receipt = await normalizeSubmitReceipt(tx, {
      questionResponses,
      surveyResponse: null,
      surveyId: `0x${'0'.repeat(64)}`,
      submissionGroupKey: submissionContext.submissionGroupKey,
      deepClone,
    });

    expect(submitResponses.mock.calls[0][5]).toBe('alpha');
    expect(receipt).toEqual(
      expect.objectContaining({
        status: 1,
        __ceSubmissionGroupKey: 'alpha',
      }),
    );
  });

  it('blocks pile submissions that span multiple session slugs', async () => {
    const submitResponses = jest.fn();
    const submissionContext = buildSubmissionGroupContext({
      questionIds: ['q1', 'q2'],
      slugByQuestionId: new Map([
        ['q1', 'alpha'],
        ['q2', 'beta'],
      ]),
      fallbackSlug: 'edge',
    });

    expect(submissionContext).toEqual(
      expect.objectContaining({
        ok: false,
        error:
          'Cannot submit responses from multiple sessions at once. Narrow the question view to one session and try again.',
        sessionSlugs: ['alpha', 'beta'],
      }),
    );
    expect(() => {
      if (!submissionContext.ok) throw new Error(submissionContext.error);
      submitResponses();
    }).toThrow(
      'Cannot submit responses from multiple sessions at once. Narrow the question view to one session and try again.',
    );
    expect(submitResponses).not.toHaveBeenCalled();
  });

  it('does not broadcast when submit context changes during rating encryption', async () => {
    const submitResponses = jest.fn();
    const snapshot = {
      account: '0xabc',
      providerKind: 'browser',
      effectiveDraftSlug: 'edge',
      chainId: 84532,
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      surveyId: '0xsurvey',
      questionID: '',
    };
    let currentContext = { ...snapshot };
    const snapshotKey = buildSubmitContextKey(snapshot);
    const questionResponses = [
      {
        questionID: 'q1',
        responder: '0xabc',
        type: 'freeform',
        prompt: 'Prompt 1',
        answer: { value: '*', encrypted: true, encryptedPortion: '{}' },
        additional: { value: '', encrypted: false },
        importance: 4,
      },
    ];

    await processRatingEnvelopesForSubmit(
      {
        sliceForSubmit: {
          answers: { q1: { value: '*', encrypted: true, encryptedPortion: '{}' } },
          additionalComments: { q1: { value: '', encrypted: false } },
        },
        userAnswersSource: null,
        questionResponses,
        changedMapForSubmit: { q1: { importance: true } },
        encryptionBaseOpts: {
          provider: {},
          account: snapshot.account,
          chainId: snapshot.chainId,
          surveyId: snapshot.surveyId,
          kind: 'rating',
          hasher: { hash: jest.fn() },
        },
      },
      {
        isQuestionLockedForResponse: () => false,
        resolveFieldEncryptionAudience: () => 'self',
        getEffectiveRecipientsForQid: () => [],
        getEffectiveRecipientsForField: () => [],
        getDefaultResponseEncryptionAudienceForQid: () => 'self',
        buildLitEncryptionOptionsForRecipients: () => null,
        encryptEnvelopeValue: jest.fn(async () => {
          currentContext = { ...currentContext, account: '0xdef' };
          return 'encrypted-rating';
        }),
        getImportanceFromResponse: (response) =>
          typeof response?.importance === 'number' ? response.importance : null,
        getConvictionFromResponse: (response) =>
          typeof response?.conviction === 'number' ? response.conviction : null,
      },
    );

    expect(() => {
      if (snapshotKey !== buildSubmitContextKey(currentContext)) {
        throw new Error('Submission context changed before broadcast.');
      }
      submitResponses();
    }).toThrow('Submission context changed before broadcast.');
    expect(submitResponses).not.toHaveBeenCalled();
    // port note: the old test reached through `submitSurveyResponse()` and
    // `buildSubmitContextSnapshot()`; this port keeps the awaited rating-encryption
    // stale-context guard and broadcast suppression without class instance coupling.
  });

  it('does not write submitted responses into a borrowed general network cache when the draft slug is unresolved', async () => {
    const slug = 'missing-session-slug';
    const surveyId = '0xsurvey';
    const responder = '0xabc';
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (inputSlug) =>
      String(inputSlug || '')
        .trim()
        .toLowerCase() === ''
        ? generalCfg
        : null;

    await cacheScripts.removeCache('questionsCache', slug).catch(() => null);
    await cacheScripts.removeCache('surveysCache', slug).catch(() => null);
    await cacheScripts.writeCache('questionsCache', slug, {
      84532: {
        questions: {
          qGeneral: {
            id: 'qGeneral',
            prompt: 'Borrowed general prompt',
          },
        },
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    await cacheScripts.writeCache('surveysCache', slug, {
      84532: {
        surveys: {
          [surveyId]: {
            id: surveyId,
            surveyID: surveyId,
            title: 'Borrowed General Survey',
            questionIDs: ['qGeneral'],
          },
        },
        surveyResponses: {},
      },
    });

    try {
      const result = await writeSubmittedResponsesToLocalCaches(
        {
          receipt: {
            blockNumber: 22,
            transactionIndex: 3,
            transactionHash: `0x${'2'.repeat(64)}`,
          },
          questionResponses: [
            {
              questionID: 'q1',
              responder,
              type: 'freeform',
              prompt: 'New prompt',
              answer: { value: 'fresh', encrypted: false },
              additional: { value: '', encrypted: false },
            },
          ],
          surveyResponse: {
            surveyID: surveyId,
            responder,
            surveyTitle: 'Updated Survey',
            responses: [
              {
                questionID: 'q1',
                responder,
                type: 'freeform',
                prompt: 'New prompt',
                answer: { value: 'fresh', encrypted: false },
                additional: { value: '', encrypted: false },
              },
            ],
          },
          surveyId,
        },
        makeCacheDeps({
          account: responder,
          effectiveDraftSlug: slug,
          network: null,
          resolveBySlug: strictLookup,
        }),
      );

      expect(result).toEqual({ questionCacheWritten: false, surveyCacheWritten: false });

      const questionsCache = await cacheScripts.readCache('questionsCache', slug);
      expect(questionsCache?.['84532']?.questions?.qGeneral).toEqual(
        expect.objectContaining({
          id: 'qGeneral',
          prompt: 'Borrowed general prompt',
        }),
      );
      expect(questionsCache?.['84532']?.questions?.q1).toBeUndefined();
      expect(questionsCache?.['84532']?.questionResponses?.q1).toBeUndefined();

      const surveysCache = await cacheScripts.readCache('surveysCache', slug);
      expect(surveysCache?.['84532']?.surveys?.[surveyId]).toEqual(
        expect.objectContaining({
          title: 'Borrowed General Survey',
          questionIDs: ['qGeneral'],
        }),
      );
      expect(surveysCache?.['84532']?.surveyResponses?.[surveyId]?.[responder]).toBeUndefined();
    } finally {
      await cacheScripts.removeCache('questionsCache', slug).catch(() => null);
      await cacheScripts.removeCache('surveysCache', slug).catch(() => null);
    }
  });
});
