import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../session/sessionModeProfile.js';
import { resolveWorkerCanonicalCacheIdentity } from './workerCanonicalCacheIdentity';
import {
  loadWorkerResponses,
  mergeWorkerQuestionResponses,
  mergeWorkerUserResponses,
} from './workerResponseHydration.js';

const SESSION_ID = `0x${'5'.repeat(32)}`;
const WORKER_URL = 'https://demo-sh-worker.example.test';
const workerConfig = {
  slug: 'demo-sh',
  sessionId: SESSION_ID,
  corsWorkerUrl: `${WORKER_URL}/`,
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: {
    backend: 'cloudflare',
    resources: {
      questions: 'active',
      surveys: 'active',
      responses: 'active',
    },
    payloadAccessControl: {
      gate: 'role_gate',
      encryption: 'worker_envelope',
      mode: 'worker_sbt_gate',
    },
  },
};

describe('workerCanonicalResponseHydration', () => {
  it('fails closed before storage listing for an incomplete Worker profile', async () => {
    const listSessionStorageRefsPage = jest.fn();

    await expect(
      loadWorkerResponses(
        {
          sessionSlug: 'demo-sh',
          sessionConfig: {
            slug: 'demo-sh',
            sessionModeProfile: { authority: { mode: 'worker_canonical' } },
          },
        },
        { listSessionStorageRefsPage },
      ),
    ).resolves.toEqual([]);

    expect(listSessionStorageRefsPage).not.toHaveBeenCalled();
  });

  it('paginates response refs and trusts Worker-bound responder metadata over payload claims', async () => {
    const listSessionStorageRefsPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: [
          {
            storageRef: { backend: 'cloudflare', id: 'question-ref' },
            metadata: {
              responder: '0x0000000000000000000000000000000000000ABC',
              createdAt: '2026-07-22T12:00:00.000Z',
            },
          },
          {
            storageRef: { backend: 'cloudflare', id: 'legacy-unbound-ref' },
            metadata: { createdAt: '2026-07-22T12:00:00.500Z' },
          },
          {
            storageRef: { backend: 'cloudflare', id: 'wrong-slug-ref' },
            metadata: {
              responder: '0x0000000000000000000000000000000000000ABC',
              createdAt: '2026-07-22T12:00:00.750Z',
            },
          },
        ],
        cursor: 'page-two',
        listComplete: false,
      })
      .mockResolvedValueOnce({
        items: [
          {
            storageRef: { backend: 'cloudflare', id: 'survey-container-ref' },
            metadata: {
              responder: '0x0000000000000000000000000000000000000ABC',
              createdAt: '2026-07-22T12:00:01.000Z',
            },
          },
        ],
        cursor: null,
        listComplete: true,
      });
    const readSessionStorageBlob = jest.fn(async ({ storageRef }: any) =>
      storageRef.id === 'question-ref'
        ? new Response(
            JSON.stringify({
              questionID: 'QUESTION-A',
              responder: '0x0000000000000000000000000000000000000bad',
              answer: { value: true },
              sessionId: SESSION_ID,
              sessionSlug: 'demo-sh',
            }),
            { headers: { 'Content-Type': 'application/json' } },
          )
        : storageRef.id === 'legacy-unbound-ref'
          ? new Response(
              JSON.stringify({
                questionID: 'QUESTION-A',
                responder: '0x0000000000000000000000000000000000000bad',
                answer: { value: false },
                sessionId: `0x${'9'.repeat(32)}`,
                sessionSlug: 'demo-sh',
              }),
              { headers: { 'Content-Type': 'application/json' } },
            )
          : storageRef.id === 'wrong-slug-ref'
            ? new Response(
                JSON.stringify({
                  questionID: 'QUESTION-A',
                  answer: { value: false },
                  sessionId: SESSION_ID,
                  sessionSlug: 'other-session',
                }),
                { headers: { 'Content-Type': 'application/json' } },
              )
            : new Response(
                JSON.stringify({
                  surveyID: 'survey-a',
                  responses: [{ questionID: 'QUESTION-A' }],
                  sessionId: SESSION_ID,
                  sessionSlug: 'demo-sh',
                }),
                { headers: { 'Content-Type': 'application/json' } },
              ),
    );

    const rows = await loadWorkerResponses(
      {
        account: 'gated-account',
        providerLike: 'gated-provider',
        sessionSlug: 'demo-sh',
        sessionConfig: workerConfig,
      },
      { listSessionStorageRefsPage, readSessionStorageBlob },
    );

    expect(listSessionStorageRefsPage).toHaveBeenNthCalledWith(1, {
      sessionSlug: 'demo-sh',
      sessionConfig: workerConfig,
      context: {
        account: 'gated-account',
        providerLike: 'gated-provider',
      },
      workerUrl: WORKER_URL,
      resource: 'responses',
      cursor: null,
      limit: 100,
    });
    expect(listSessionStorageRefsPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        context: {
          account: 'gated-account',
          providerLike: 'gated-provider',
        },
        cursor: 'page-two',
        limit: 100,
        resource: 'responses',
        workerUrl: WORKER_URL,
      }),
    );
    expect(
      readSessionStorageBlob.mock.calls.every(
        ([options]) =>
          options.context.account === 'gated-account' &&
          options.context.providerLike === 'gated-provider' &&
          options.sessionSlug === 'demo-sh' &&
          options.sessionConfig === workerConfig &&
          options.workerUrl === WORKER_URL,
      ),
    ).toBe(true);
    expect(rows).toEqual([
      expect.objectContaining({
        questionId: 'question-a',
        responder: '0x0000000000000000000000000000000000000abc',
        storageRefId: 'question-ref',
        timestamp: Math.floor(Date.parse('2026-07-22T12:00:00.000Z') / 1000),
      }),
    ]);
  });

  it('fails closed on a repeated incomplete-page cursor', async () => {
    const listSessionStorageRefsPage = jest.fn().mockResolvedValue({
      items: [],
      cursor: 'same-cursor',
      listComplete: false,
    });

    await expect(
      loadWorkerResponses({ sessionSlug: 'demo-sh', sessionConfig: workerConfig }, { listSessionStorageRefsPage }),
    ).rejects.toThrow('invalid cursor');
  });

  it('replaces same-slug response caches when the exact Worker authority changes to an empty session', () => {
    const identityA = resolveWorkerCanonicalCacheIdentity({
      sessionConfig: workerConfig,
      sessionSlug: 'demo-sh',
    });
    const replacementConfig = {
      ...workerConfig,
      sessionId: `0x${'8'.repeat(32)}`,
      corsWorkerUrl: 'https://replacement-worker.example.test',
    };
    const identityB = resolveWorkerCanonicalCacheIdentity({
      sessionConfig: replacementConfig,
      sessionSlug: 'demo-sh',
    });
    const rows = [
      {
        questionId: 'question-a',
        responder: '0xresponder',
        response: { questionID: 'question-a', prompt: 'Session A question', answer: true },
        storageRefId: 'response-a-ref',
        timestamp: 10,
      },
    ];
    const questionCacheA = mergeWorkerQuestionResponses(
      {
        '11155420': {
          questionResponses: { registryQuestion: { registryResponder: { answer: true } } },
        },
      },
      rows,
      'demo-sh',
      identityA,
    ) as any;
    const userCacheA = mergeWorkerUserResponses(
      {
        '0xregistry': {
          '11155420': {
            data: { questionResponses: [{ questionId: 'registryQuestion' }] },
          },
        },
      },
      rows,
      identityA,
    ) as any;

    const questionCacheB = mergeWorkerQuestionResponses(questionCacheA, [], 'demo-sh', identityB) as any;
    const userCacheB = mergeWorkerUserResponses(userCacheA, [], identityB) as any;

    expect(questionCacheB.worker.questionResponses).toEqual({});
    expect(questionCacheB.worker.questions).toEqual({});
    expect(questionCacheB.worker.workerCanonicalIdentity).toEqual(identityB);
    expect(questionCacheB['11155420']).toEqual(questionCacheA['11155420']);
    expect(userCacheB['0xresponder']?.worker).toBeUndefined();
    expect(userCacheB['0xregistry']['11155420']).toEqual(userCacheA['0xregistry']['11155420']);
  });
});
