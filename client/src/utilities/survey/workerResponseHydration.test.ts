import { mergeWorkerCanonicalQuestionMetadata } from '../../domains/surveys/workerCanonicalMetadataHydrationPort';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../session/sessionModeProfile.js';
import { resolveWorkerCanonicalCacheIdentity } from './workerCanonicalCacheIdentity';
import {
  loadWorkerResponses,
  mergeWorkerQuestionResponses,
  mergeWorkerUserResponses,
} from './workerResponseHydration.js';
import { hydrateWorkerCanonicalResponses, resolveWorkerResponseHydrationRun } from './workerResponseHydrationRuntime';

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
  it('returns a flagged partial result for a 12,000-row listing', async () => {
    const onPartial = jest.fn();
    const listPage = jest.fn(async ({ cursor }: any) => {
      const start = Number(cursor || 0);
      return {
        items: Array.from({ length: 100 }, (_, i) => ({
          storageRef: { id: `ref-${start + i}` },
          metadata: { responder: 'participant' },
        })),
        cursor: String(start + 100),
        listComplete: start + 100 >= 12000,
      };
    });
    const rows = await loadWorkerResponses(
      { sessionSlug: 'demo-sh', sessionConfig: workerConfig, onPartial },
      {
        listSessionStorageRefsPage: listPage,
        readSessionStorageBlob: async () =>
          new Response(
            JSON.stringify({
              sessionSlug: 'demo-sh',
              sessionId: SESSION_ID,
              questionId: 'q1',
              answer: { value: 'answer' },
            }),
          ),
      },
    );
    expect(rows).toHaveLength(10000);
    expect(onPartial).toHaveBeenCalledTimes(1);
    expect(listPage).toHaveBeenCalledTimes(100);
  });

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

  it('reuses cached immutable refs while reading newly submitted edits', async () => {
    const listSessionStorageRefsPage = jest.fn().mockResolvedValue({
      items: ['cached', 'edited'].map((id) => ({
        storageRef: { backend: 'cloudflare', id },
        metadata: { responder: 'participant', createdAt: '2026-07-22T12:00:01.000Z' },
      })),
      listComplete: true,
      cursor: null,
    });
    const readSessionStorageBlob = jest.fn<Promise<Response>, [Record<string, unknown>]>(
      async () =>
        new Response(
          JSON.stringify({
            questionID: 'question-a',
            sessionId: SESSION_ID,
            sessionSlug: 'demo-sh',
            answer: { value: false },
          }),
        ),
    );
    const rows = await loadWorkerResponses(
      {
        sessionSlug: 'demo-sh',
        sessionConfig: workerConfig,
        cachedStorageRefIds: new Set(['cached']),
      },
      { listSessionStorageRefsPage, readSessionStorageBlob },
    );
    expect(readSessionStorageBlob).toHaveBeenCalledTimes(1);
    expect(readSessionStorageBlob).toHaveBeenCalledWith(
      expect.objectContaining({ storageRef: expect.objectContaining({ id: 'edited' }) }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        storageRefId: 'edited',
        response: expect.objectContaining({ answer: { value: false } }),
      }),
    ]);
  });

  it('skips a response with non-text fields instead of failing the whole load', async () => {
    // JSON can carry an object whose text conversion throws.
    const hostile = () => JSON.parse('{"toString":1}');
    const payloads: Record<string, Record<string, unknown>> = {
      good: { questionID: 'question-a', sessionId: SESSION_ID, sessionSlug: 'demo-sh', answer: { value: true } },
      badSlug: { questionID: 'question-a', sessionId: SESSION_ID, sessionSlug: hostile(), answer: { value: true } },
      badQuestion: { questionID: hostile(), sessionId: SESSION_ID, sessionSlug: 'demo-sh', answer: { value: true } },
      badPrompt: {
        questionID: 'question-b',
        sessionId: SESSION_ID,
        sessionSlug: 'demo-sh',
        prompt: hostile(),
        type: hostile(),
        answer: { value: true },
      },
    };
    const listSessionStorageRefsPage = jest.fn().mockResolvedValue({
      items: Object.keys(payloads).map((id) => ({
        storageRef: { backend: 'cloudflare', id },
        metadata: { responder: `0xresponder-${id}`, createdAt: '2026-07-22T12:00:01.000Z' },
      })),
      listComplete: true,
      cursor: null,
    });
    const readSessionStorageBlob = jest.fn(
      async ({ storageRef }: any) => ({ json: async () => payloads[storageRef.id] }) as Response,
    );

    const rows = await loadWorkerResponses(
      { sessionSlug: 'demo-sh', sessionConfig: workerConfig },
      { listSessionStorageRefsPage, readSessionStorageBlob },
    );
    expect(rows.map((row) => row.storageRefId)).toEqual(['good', 'badPrompt']);

    // Its prompt and type are not text, so it adds an answer but no placeholder question.
    const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig: workerConfig, sessionSlug: 'demo-sh' });
    const merged = mergeWorkerQuestionResponses({}, rows, 'demo-sh', identity) as any;
    expect(merged.worker.questions['question-b']).toBeUndefined();
    expect(Object.keys(merged.worker.questionResponses['question-b'])).toEqual(['0xresponder-badprompt']);
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

  it('keeps known question metadata when a response payload claims another prompt or type', () => {
    const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig: workerConfig, sessionSlug: 'demo-sh' });
    const empty = mergeWorkerQuestionResponses({}, [], 'demo-sh', identity) as any;
    const canonical = { id: 'question-a', prompt: 'Canonical prompt', type: 'binary' };
    empty.worker.questions = { 'question-a': canonical };

    const merged = mergeWorkerQuestionResponses(
      empty,
      [
        {
          questionId: 'question-a',
          responder: '0xresponder',
          response: { questionID: 'question-a', prompt: 'Spoofed headline', type: 'freeform', answer: { value: 'x' } },
          storageRefId: 'response-a-ref',
          timestamp: 10,
        },
      ],
      'demo-sh',
      identity,
    ) as any;

    expect(merged.worker.questions['question-a']).toEqual(canonical);
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

it('finishes own-answer pagination beyond the public cap and reads only returned own payloads', async () => {
  let pageCount = 0;
  const readBlob = jest.fn(
    async () =>
      new Response(
        JSON.stringify({
          sessionSlug: 'demo-sh',
          sessionId: SESSION_ID,
          questionID: 'q1',
          answer: { value: 'latest' },
        }),
      ),
  );
  const rows = await loadWorkerResponses(
    { sessionSlug: 'demo-sh', sessionConfig: workerConfig, account: '0xabc', ownResponses: true },
    {
      listSessionStorageRefsPage: async (options) => {
        expect(options.ownResponses).toEqual({ account: '0xabc', sessionId: SESSION_ID });
        pageCount += 1;
        return {
          items:
            pageCount === 120
              ? [{ storageRef: { id: 'ref-own' }, metadata: { responder: '0xabc', createdAt: '2026-01-01T00:00:00Z' } }]
              : [],
          cursor: pageCount < 120 ? String(pageCount) : null,
          listComplete: pageCount === 120,
        };
      },
      readSessionStorageBlob: readBlob,
    },
  );
  expect(pageCount).toBe(120);
  expect(readBlob).toHaveBeenCalledTimes(1);
  expect(rows[0].response.answer).toEqual({ value: 'latest' });
});

it('never considers repeated cursors or malformed own payloads a complete empty history', async () => {
  const options = { sessionSlug: 'demo-sh', sessionConfig: workerConfig, account: '0xabc', ownResponses: true };
  await expect(
    loadWorkerResponses(options, {
      listSessionStorageRefsPage: async () => ({ items: [], cursor: 'repeated', listComplete: false }),
    }),
  ).rejects.toThrow('invalid cursor');
  await expect(
    loadWorkerResponses(options, {
      listSessionStorageRefsPage: async () => ({
        items: [{ storageRef: { id: 'ref-own' }, metadata: { responder: '0xabc' } }],
        cursor: null,
        listComplete: true,
      }),
      readSessionStorageBlob: async () => new Response('invalid json'),
    }),
  ).rejects.toThrow('could not be read');
});

// A capped listing leaves a continuation, so repeated refreshes of a large
// session eventually load every row instead of rereading the same prefix.
// The cap counts pages, so one row per page keeps this fast.
describe('capped Worker response listings', () => {
  const ROWS = 120;
  const createLargeSession = () => {
    let failCursor = '';
    const listPage = jest.fn(async ({ cursor }: any) => {
      if (cursor && cursor === failCursor) throw new Error('Expired cursor');
      const start = Number(cursor || 0);
      return {
        items: [
          {
            storageRef: { id: `ref-${start}` },
            metadata: { responder: `participant-${start}`, createdAt: '2026-10-01T00:00:00.000Z' },
          },
        ],
        cursor: String(start + 1),
        listComplete: start + 1 >= ROWS,
      };
    });
    const readBlob = async ({ storageRef }: any) =>
      new Response(
        JSON.stringify({
          sessionSlug: 'demo-sh',
          sessionId: SESSION_ID,
          questionId: 'q1',
          answer: { value: storageRef.id },
        }),
      );
    let questions: any = {};
    let users: any = {};
    const markReady = jest.fn();
    const refresh = () =>
      hydrateWorkerCanonicalResponses({
        sessionSlug: 'demo-sh',
        sessionConfig: workerConfig,
        run: resolveWorkerResponseHydrationRun({ sessionConfig: workerConfig, sessionSlug: 'demo-sh' })!,
        loadWorkerResponses: (options) =>
          loadWorkerResponses(options, { listSessionStorageRefsPage: listPage, readSessionStorageBlob: readBlob }),
        getAccount: () => '',
        getProviderLike: () => null,
        getCurrentSessionConfig: () => workerConfig,
        shouldAbort: () => false,
        markLoading: () => {},
        markReady,
        createPersistenceError: (message) => new Error(message),
        updateQuestionsCacheAtomic: async (update) => {
          questions = update(questions);
          return true;
        },
        updateUserCacheAtomic: async (update) => {
          users = update(users);
          return true;
        },
      });
    return {
      refresh,
      listPage,
      markReady,
      failAt: (cursor: string) => {
        failCursor = cursor;
      },
      answered: () => Object.keys(questions.worker.questionResponses.q1 || {}).length,
      node: () => questions.worker,
    };
  };

  it('continues each refresh where the capped one stopped until every row is loaded', async () => {
    const session = createLargeSession();
    await session.refresh();
    expect(session.answered()).toBe(100);
    expect(session.node().workerResponseListCursor).toBe('100');
    expect(session.markReady).toHaveBeenLastCalledWith(true);

    await session.refresh();
    expect(session.listPage).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: '119' }));
    // The resumed listing returned only the tail; rows from the first run stay.
    expect(session.answered()).toBe(ROWS);
    expect(session.node().workerResponseListCursor).toBeUndefined();
    expect(session.node().workerResponseHydrationStatus).toBe('partial');
  });

  it('restarts from the first page after a continuation fails', async () => {
    const session = createLargeSession();
    await session.refresh();
    session.failAt('100');
    await expect(session.refresh()).rejects.toThrow('Expired cursor');
    expect(session.node().workerResponseListCursor).toBeUndefined();
    session.failAt('');
    session.listPage.mockClear();
    await session.refresh();
    expect(session.listPage).toHaveBeenNthCalledWith(1, expect.objectContaining({ cursor: null }));
  });
});

describe('hidden Worker questions', () => {
  it.each(['hide-first', 'answer-first'])('keeps a question absent after %s', (order) => {
    const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig: workerConfig, sessionSlug: 'demo-sh' });
    const hide = (cache: unknown) =>
      mergeWorkerCanonicalQuestionMetadata(cache, [{ hidden: true, id: 'q1' }], identity);
    const answer = (cache: unknown) =>
      mergeWorkerQuestionResponses(
        cache,
        [
          {
            questionId: 'q1',
            responder: 'participant',
            storageRefId: 'answer',
            timestamp: 1,
            response: { prompt: 'A hidden question', answer: { value: 'Agree' } },
          },
        ],
        'demo-sh',
        identity,
      );
    const cache = (order === 'hide-first' ? answer(hide(null)) : hide(answer(null))) as any;
    expect(cache.worker.questions.q1).toBeUndefined();
    expect(cache.worker.workerQuestionMetadataTombstones.q1).toBe(true);
    expect(cache.worker.questionResponses.q1.participant).toBeDefined();
  });
});
