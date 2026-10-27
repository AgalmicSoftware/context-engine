import {
  loadWorkerCanonicalQuestionMatcher,
  loadWorkerCanonicalQuestions,
  loadWorkerCanonicalSurveys,
  mergeWorkerCanonicalQuestionMetadata,
  mergeWorkerCanonicalSurveyMetadata,
  type WorkerCanonicalMetadataEntry,
} from './workerCanonicalMetadataHydrationPort';
import { peekCacheSync } from '../../utilities/cache/cacheScripts';
import { generateQuestionId } from '../../utilities/shared/questionUtils.mjs';
import { resolveWorkerCanonicalCacheIdentity } from '../../utilities/survey/workerCanonicalCacheIdentity';
import { mergeWorkerQuestionResponses } from '../../utilities/survey/workerResponseHydration';

jest.mock('../../utilities/cache/cacheScripts', () => ({ peekCacheSync: jest.fn(() => null) }));

const SESSION_ID = `0x${'2'.repeat(32)}`;
const WORKER_URL = 'https://metadata-worker.example.test';

const buildWorkerSessionConfig = ({
  sessionId = SESSION_ID,
  workerUrl = WORKER_URL,
}: {
  sessionId?: string;
  workerUrl?: string;
} = {}): Record<string, unknown> => ({
  slug: 'worker-session',
  sessionId,
  corsWorkerUrl: `${workerUrl}/`,
  sessionModeProfile: {
    profileVersion: 1,
    preset: 'custom',
    authority: { mode: 'worker_canonical' },
    evm: { registryChainId: null },
    storage: {
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'none', encryption: 'none' },
    },
    identity: { default: 'passkey', enabled: ['passkey'] },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'none' },
    surfaces: {
      web: true,
      telegram: false,
      miniApp: false,
      agentHttp: false,
      mcp: false,
      ceCc: false,
    },
    results: {
      visibility: 'public_full_if_storage_public',
      exposure: {
        aggregateResultsEnabled: true,
        anonymizedGroupsEnabled: false,
        minGroupSize: 2,
      },
    },
    export: { scope: 'all_session' },
  },
  storageProfile: {
    backend: 'cloudflare',
    resources: {
      questions: 'active',
      surveys: 'active',
    },
    payloadAccessControl: {
      gate: 'none',
      encryption: 'none',
      mode: 'public_read',
    },
  },
});

const buildListedItem = (id: string, resource: 'questions' | 'surveys', createdAt: string) => ({
  storageRef: {
    backend: 'cloudflare',
    id,
    resource,
  },
  metadata: {
    createdAt,
    resource,
  },
});

describe('workerCanonicalMetadataHydrationPort', () => {
  it('discovers fresh questions through bounded reads pinned to the exact Worker tuple', async () => {
    const sessionConfig = buildWorkerSessionConfig();
    const firstItems = Array.from({ length: 6 }, (_, index) =>
      buildListedItem(`cf_question_${index}`, 'questions', `2026-07-23T00:00:0${index}.000Z`),
    );
    const secondItems = Array.from({ length: 6 }, (_, index) =>
      buildListedItem(`cf_question_${index + 6}`, 'questions', `2026-07-23T00:00:${index + 10}.000Z`),
    );
    const listSessionStorageRefsPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: firstItems,
        cursor: 'page-two',
        listComplete: false,
      })
      .mockResolvedValueOnce({
        items: secondItems,
        cursor: null,
        listComplete: true,
      });
    let activeReads = 0;
    let maxActiveReads = 0;
    const readSessionStorageBlob = jest.fn(async ({ storageRef }: any) => {
      activeReads += 1;
      maxActiveReads = Math.max(maxActiveReads, activeReads);
      await new Promise((resolve) => setTimeout(resolve, 0));
      activeReads -= 1;
      const numericId = Number(String(storageRef.id).split('_').pop());
      const payload =
        numericId === 10
          ? {
              id: `0xquestion${numericId}`,
              prompt: 'Wrong session payload',
              sessionId: `0x${'9'.repeat(32)}`,
              sessionSlug: 'worker-session',
            }
          : numericId === 11
            ? {
                id: `0xquestion${numericId}`,
                prompt: 'Wrong slug payload',
                sessionId: SESSION_ID,
                sessionSlug: 'other-session',
              }
            : {
                id: `0xquestion${numericId}`,
                prompt: `Question ${numericId}`,
                sessionId: SESSION_ID,
                sessionSlug: 'worker-session',
                type: 'freeform',
              };
      return { json: async () => payload } as Response;
    });

    const rows = await loadWorkerCanonicalQuestions(
      {
        account: 'passkey-account',
        providerLike: 'passkey-provider',
        sessionConfig,
        sessionSlug: 'worker-session',
      },
      {
        listSessionStorageRefsPage,
        readSessionStorageBlob,
      },
    );

    expect(listSessionStorageRefsPage).toHaveBeenNthCalledWith(1, {
      sessionSlug: 'worker-session',
      sessionConfig,
      context: {
        account: 'passkey-account',
        providerLike: 'passkey-provider',
      },
      workerUrl: WORKER_URL,
      resource: 'questions',
      cursor: null,
      limit: 100,
    });
    expect(listSessionStorageRefsPage).toHaveBeenNthCalledWith(2, {
      sessionSlug: 'worker-session',
      sessionConfig,
      context: {
        account: 'passkey-account',
        providerLike: 'passkey-provider',
      },
      workerUrl: WORKER_URL,
      resource: 'questions',
      cursor: 'page-two',
      limit: 100,
    });
    expect(readSessionStorageBlob).toHaveBeenCalledTimes(12);
    expect(
      readSessionStorageBlob.mock.calls.every(
        ([options]) =>
          options.sessionSlug === 'worker-session' &&
          options.sessionConfig === sessionConfig &&
          options.context.account === 'passkey-account' &&
          options.context.providerLike === 'passkey-provider' &&
          options.workerUrl === WORKER_URL,
      ),
    ).toBe(true);
    expect(maxActiveReads).toBe(8);
    expect(rows).toHaveLength(10);
    expect(rows.some((row) => row.id === '0xquestion10')).toBe(false);
    expect(rows.some((row) => row.id === '0xquestion11')).toBe(false);

    const cache = mergeWorkerCanonicalQuestionMetadata(
      null,
      rows,
      resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug: 'worker-session' }),
    ) as any;
    expect(cache.worker.questions['0xquestion0']).toEqual(
      expect.objectContaining({
        id: '0xquestion0',
        prompt: 'Question 0',
        sessionId: SESSION_ID,
        sessionSlug: 'worker-session',
        sessionSlugExplicit: true,
        source: 'worker-session-storage',
        storageRef: expect.objectContaining({
          backend: 'cloudflare',
          id: 'cf_question_0',
          resource: 'questions',
        }),
      }),
    );
  });

  it('accepts legacy payloads without a session ID while preserving the verified Worker identity', async () => {
    const sessionConfig = buildWorkerSessionConfig();
    const listSessionStorageRefsPage = jest.fn().mockResolvedValue({
      items: [
        buildListedItem('legacy-question', 'questions', '2026-07-23T00:00:00.000Z'),
        buildListedItem('malformed-session-question', 'questions', '2026-07-23T00:00:01.000Z'),
      ],
      cursor: null,
      listComplete: true,
    });
    const readSessionStorageBlob = jest.fn(
      async ({ storageRef }: any) =>
        ({
          json: async () =>
            storageRef.id === 'legacy-question'
              ? {
                  id: '0xlegacyquestion',
                  prompt: 'Legacy Worker question',
                  sessionSlug: 'worker-session',
                }
              : {
                  id: '0xmalformedsessionquestion',
                  prompt: 'Malformed session question',
                  sessionId: 'not-a-session-id',
                  sessionSlug: 'worker-session',
                },
        }) as Response,
    );

    const rows = await loadWorkerCanonicalQuestions(
      {
        sessionConfig,
        sessionSlug: 'worker-session',
      },
      {
        listSessionStorageRefsPage,
        readSessionStorageBlob,
      },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        id: '0xlegacyquestion',
        payload: expect.objectContaining({
          id: '0xlegacyquestion',
          prompt: 'Legacy Worker question',
          sessionId: SESSION_ID,
          sessionSlug: 'worker-session',
          sessionSlugExplicit: true,
          source: 'worker-session-storage',
        }),
      }),
    );
  });

  it('hydrates Worker/SBT hybrid survey metadata into the Worker cache scope without chain discovery', async () => {
    const sessionConfig: any = buildWorkerSessionConfig();
    sessionConfig.sessionModeProfile.evm.registryChainId = 11155420;
    sessionConfig.sessionModeProfile.storage.payloadAccessControl.encryption = 'worker_envelope';
    sessionConfig.sessionModeProfile.encryption.mode = 'worker_envelope';
    sessionConfig.sessionModeProfile.encryption.keyProvider = 'worker_secret';
    sessionConfig.sessionModeProfile.encryption.accessConditions = {
      match: 'any',
      conditions: [
        {
          kind: 'sbt_onchain',
          chainId: 11155420,
          contract: '0x1111111111111111111111111111111111111111',
          anyOrAll: 'any',
        },
      ],
    };
    sessionConfig.sessionModeProfile.results.visibility = 'participant_aggregate';
    sessionConfig.storageProfile.payloadAccessControl = {
      gate: 'role_gate',
      encryption: 'worker_envelope',
      mode: 'worker_sbt_gate',
    };
    const listSessionStorageRefsPage = jest.fn().mockResolvedValue({
      items: [buildListedItem('cf_survey_1', 'surveys', '2026-07-23T01:00:00.000Z')],
      cursor: null,
      listComplete: true,
    });
    const readSessionStorageBlob = jest.fn().mockResolvedValue({
      json: async () => ({
        surveyID: '0xsurvey',
        title: 'Fresh Worker survey',
        questionIDs: ['0xquestion0'],
        sessionId: SESSION_ID,
        sessionSlug: 'worker-session',
      }),
    });

    const rows = await loadWorkerCanonicalSurveys(
      {
        account: 'gated-account',
        providerLike: 'gated-provider',
        sessionConfig,
        sessionSlug: 'worker-session',
      },
      {
        listSessionStorageRefsPage,
        readSessionStorageBlob,
      },
    );
    const cache = mergeWorkerCanonicalSurveyMetadata(
      null,
      rows,
      resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug: 'worker-session' }),
    ) as any;

    expect(listSessionStorageRefsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'surveys',
        sessionConfig,
        sessionSlug: 'worker-session',
        context: {
          account: 'gated-account',
          providerLike: 'gated-provider',
        },
        workerUrl: WORKER_URL,
      }),
    );
    expect(readSessionStorageBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          account: 'gated-account',
          providerLike: 'gated-provider',
        },
        sessionConfig,
        sessionSlug: 'worker-session',
        workerUrl: WORKER_URL,
      }),
    );
    expect(cache.worker.surveys['0xsurvey']).toEqual(
      expect.objectContaining({
        id: '0xsurvey',
        surveyID: '0xsurvey',
        title: 'Fresh Worker survey',
        sessionId: SESSION_ID,
        sessionSlug: 'worker-session',
        storageRef: expect.objectContaining({
          backend: 'cloudflare',
          id: 'cf_survey_1',
          resource: 'surveys',
        }),
      }),
    );
  });

  it('fails closed before storage access for invalid or missing profiles', async () => {
    const listSessionStorageRefsPage = jest.fn();
    const readSessionStorageBlob = jest.fn();
    const invalidConfig: any = buildWorkerSessionConfig();
    invalidConfig.sessionModeProfile.authority.mode = 'invalid_authority';

    await expect(
      loadWorkerCanonicalQuestions(
        {
          sessionConfig: invalidConfig,
          sessionSlug: 'worker-session',
        },
        { listSessionStorageRefsPage, readSessionStorageBlob },
      ),
    ).rejects.toThrow('worker_storage_requires_valid_worker_canonical_session');
    await expect(
      loadWorkerCanonicalQuestions(
        {
          sessionConfig: null,
          sessionSlug: 'worker-session',
        },
        { listSessionStorageRefsPage, readSessionStorageBlob },
      ),
    ).rejects.toThrow('worker_authoring_session_config_missing');
    expect(listSessionStorageRefsPage).not.toHaveBeenCalled();
    expect(readSessionStorageBlob).not.toHaveBeenCalled();
  });

  it('rejects repeated pagination cursors instead of scanning without a bound', async () => {
    const sessionConfig = buildWorkerSessionConfig();
    const listSessionStorageRefsPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: [],
        cursor: 'repeat',
        listComplete: false,
      })
      .mockResolvedValueOnce({
        items: [],
        cursor: 'repeat',
        listComplete: false,
      });
    const readSessionStorageBlob = jest.fn();

    await expect(
      loadWorkerCanonicalSurveys(
        {
          sessionConfig,
          sessionSlug: 'worker-session',
        },
        {
          listSessionStorageRefsPage,
          readSessionStorageBlob,
        },
      ),
    ).rejects.toThrow('worker_metadata_storage_invalid_cursor');
    expect(listSessionStorageRefsPage).toHaveBeenCalledTimes(2);
    expect(readSessionStorageBlob).not.toHaveBeenCalled();
  });

  describe('question and survey ownership', () => {
    const ADMIN = '0x00000000000000000000000000000000000000aa';
    const AUTHOR = '0x00000000000000000000000000000000000000bb';
    const ATTACKER = '0x00000000000000000000000000000000000000cc';
    const PROMPT = 'Should the pilot continue?';
    const QUESTION_ID = String(generateQuestionId('binary', PROMPT, [], false, 99)).toLowerCase();
    const sessionConfig = { ...buildWorkerSessionConfig(), adminAddress: ADMIN };
    const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug: 'worker-session' });
    const question = (overrides: Record<string, unknown> = {}) => ({
      id: QUESTION_ID,
      type: 'binary',
      prompt: PROMPT,
      sessionId: SESSION_ID,
      sessionSlug: 'worker-session',
      ...overrides,
    });
    const listedItem = (
      id: string,
      createdAt: string,
      uploader = '',
      resource: 'questions' | 'surveys' = 'questions',
      uploadAuthority?: string,
    ) => ({
      storageRef: { backend: 'cloudflare', id, resource },
      metadata: {
        createdAt,
        resource,
        ...(uploader ? { uploader } : {}),
        ...(uploadAuthority ? { uploadAuthority } : {}),
      },
    });
    const loadFrom = async (
      items: Array<Record<string, unknown>>,
      payloads: Record<string, Record<string, unknown>>,
      resource: 'questions' | 'surveys' = 'questions',
    ) => {
      const readSessionStorageBlob = jest.fn(
        async ({ storageRef }: any) => ({ json: async () => payloads[storageRef.id] }) as Response,
      );
      const load = resource === 'questions' ? loadWorkerCanonicalQuestions : loadWorkerCanonicalSurveys;
      const rows = await load(
        { sessionConfig, sessionSlug: 'worker-session' },
        {
          listSessionStorageRefsPage: jest.fn().mockResolvedValue({ items, cursor: null, listComplete: true }),
          readSessionStorageBlob,
        },
      );
      return { rows, readSessionStorageBlob };
    };

    afterEach(() => {
      (peekCacheSync as jest.Mock).mockReset();
      (peekCacheSync as jest.Mock).mockReturnValue(null);
    });

    it('keeps the first upload of a question id when someone uploads it again later', async () => {
      const { rows } = await loadFrom(
        [
          listedItem('cf_attacker', '2026-10-02T00:00:00.000Z', ATTACKER),
          listedItem('cf_official', '2026-10-01T00:00:00.000Z', AUTHOR),
        ],
        {
          cf_official: question(),
          cf_attacker: question({ prompt: 'ATTACKER rewrite', options: ['No', 'Yes'] }),
        },
      );
      const cache = mergeWorkerCanonicalQuestionMetadata(null, rows, identity) as any;
      expect(cache.worker.questions[QUESTION_ID]).toEqual(expect.objectContaining({ prompt: PROMPT }));
      expect(cache.worker.questions[QUESTION_ID].options).toBeUndefined();
      expect(cache.worker.workerQuestionMetadataRefs[QUESTION_ID]).toEqual({
        admin: false,
        uploadAuthority: null,
        createdAtMs: Date.parse('2026-10-01T00:00:00.000Z'),
        storageRefId: 'cf_official',
        verified: true,
      });
    });

    it('lets a session admin upload replace the first version', async () => {
      const { rows } = await loadFrom(
        [
          listedItem('cf_official', '2026-10-01T00:00:00.000Z', AUTHOR),
          listedItem('cf_admin', '2026-10-03T00:00:00.000Z', ADMIN, 'questions', 'admin'),
          listedItem('cf_attacker', '2026-10-04T00:00:00.000Z', ATTACKER),
        ],
        {
          cf_official: question(),
          cf_admin: question({ tags: ['moderated'] }),
          cf_attacker: question({ prompt: 'ATTACKER rewrite' }),
        },
      );
      const cache = mergeWorkerCanonicalQuestionMetadata(null, rows, identity) as any;
      expect(cache.worker.questions[QUESTION_ID].tags).toEqual(['moderated']);
      expect(cache.worker.workerQuestionMetadataRefs[QUESTION_ID].storageRefId).toBe('cf_admin');
    });

    it('keeps the server-selected first ordinary upload regardless of content hash compatibility', async () => {
      const { rows } = await loadFrom(
        [listedItem('cf_front_run', '2026-10-01T00:00:00.000Z'), listedItem('cf_author', '2026-10-02T00:00:00.000Z')],
        { cf_front_run: question({ prompt: 'Spoofed text under a predicted id' }), cf_author: question() },
      );
      const cache = mergeWorkerCanonicalQuestionMetadata(null, rows, identity) as any;
      expect(cache.worker.questions[QUESTION_ID].prompt).toBe('Spoofed text under a predicted id');
      // A lone legacy question whose id used another hash input still shows.
      const legacy = await loadFrom([listedItem('cf_legacy_poll', '2026-10-01T00:00:00.000Z')], {
        cf_legacy_poll: question({ id: '0xlegacypoll', type: 'multichoice', options: ['A', 'B'] }),
      });
      const legacyCache = mergeWorkerCanonicalQuestionMetadata(null, legacy.rows, identity) as any;
      expect(legacyCache.worker.questions['0xlegacypoll'].prompt).toBe(PROMPT);
    });

    it('selects the same version across every plaintext, locked, and legacy merge order', async () => {
      const { rows } = await loadFrom(
        [
          listedItem('legacy', '2026-10-01T00:00:00.000Z'),
          listedItem('locked', '2026-10-02T00:00:00.000Z'),
          listedItem('matching', '2026-10-03T00:00:00.000Z'),
        ],
        {
          legacy: question({ prompt: 'Legacy hash inputs' }),
          locked: question({ prompt: '[encrypted]', promptEncrypted: { ciphertext: 'fixture' } }),
          matching: question(),
        },
      );
      for (const order of [
        [0, 1, 2],
        [0, 2, 1],
        [1, 0, 2],
        [1, 2, 0],
        [2, 0, 1],
        [2, 1, 0],
      ]) {
        let cache: unknown = null;
        for (const index of order) cache = mergeWorkerCanonicalQuestionMetadata(cache, [rows[index]], identity);
        expect(cache).toMatchObject({
          worker: {
            workerQuestionMetadataRefs: {
              [QUESTION_ID]: { storageRefId: 'legacy' },
            },
          },
        });
      }
    });

    it.each([false, true])(
      'uses code-unit ID ties for %s admin precedence without locale dependence',
      async (admin) => {
        const ids = ['fixture__', 'fixture_a', 'fixture_A', 'fixture_z'];
        const { rows } = await loadFrom(
          ids.map((id) => listedItem(id, '2026-10-01T00:00:00.000Z', '', 'questions', admin ? 'admin' : undefined)),
          Object.fromEntries(ids.map((id) => [id, question({ tags: [id] })])),
        );
        expect(rows.map((row) => 'storageRefId' in row && row.storageRefId)).toEqual([
          'fixture_A',
          'fixture__',
          'fixture_a',
          'fixture_z',
        ]);
        for (const orderedRows of [rows, [...rows].reverse()]) {
          expect(mergeWorkerCanonicalQuestionMetadata(null, orderedRows, identity)).toMatchObject({
            worker: {
              workerQuestionMetadataRefs: { [QUESTION_ID]: { storageRefId: admin ? 'fixture_z' : 'fixture_A' } },
            },
          });
        }
      },
    );

    it('never lets a locked rewrite beat an earlier plaintext question it cannot be checked against', async () => {
      // Legacy demo question ids were hashed from other inputs, so the original
      // fails the content check; a locked rewrite cannot be checked at all.
      const LEGACY_ID = '0xlegacypoll';
      const original = question({ id: LEGACY_ID, type: 'multichoice', options: ['A', 'B'] });
      const lockedRewrite = question({
        id: LEGACY_ID,
        prompt: '[encrypted]',
        promptEncrypted: { ciphertext: 'rewrite' },
        encryption: { mode: 'lit' },
      });
      const { rows } = await loadFrom(
        [
          listedItem('cf_locked', '2026-10-02T00:00:00.000Z', ATTACKER),
          listedItem('cf_original', '2026-10-01T00:00:00.000Z', AUTHOR),
        ],
        { cf_original: original, cf_locked: lockedRewrite },
      );
      const cache = mergeWorkerCanonicalQuestionMetadata(null, rows, identity) as any;
      expect(cache.worker.questions[LEGACY_ID].prompt).toBe(PROMPT);
      expect(cache.worker.workerQuestionMetadataRefs[LEGACY_ID]).toEqual(
        expect.objectContaining({ storageRefId: 'cf_original', verified: false }),
      );

      // A cache that kept the locked rewrite because its ref said "verified" is corrected.
      const stale = mergeWorkerCanonicalQuestionMetadata(null, [], identity) as any;
      stale.worker.questions[LEGACY_ID] = { ...lockedRewrite };
      stale.worker.workerQuestionMetadataRefs[LEGACY_ID] = {
        admin: false,
        createdAtMs: Date.parse('2026-10-02T00:00:00.000Z'),
        storageRefId: 'cf_locked',
        verified: true,
      };
      const originalOnly = rows.filter((row: any) => row.storageRefId === 'cf_original');
      const corrected = mergeWorkerCanonicalQuestionMetadata(stale, originalOnly, identity) as any;
      expect(corrected.worker.questions[LEGACY_ID].prompt).toBe(PROMPT);
      expect(corrected.worker.questions[LEGACY_ID].encryption).toBeUndefined();
    });

    it('corrects a cache that kept a later rewrite under the old newest-wins rule', async () => {
      const staleCache = mergeWorkerCanonicalQuestionMetadata(null, [], identity) as any;
      staleCache.worker.questions[QUESTION_ID] = { ...question({ prompt: 'ATTACKER rewrite' }), voiceCredits: 1 };
      staleCache.worker.workerQuestionMetadataRefs[QUESTION_ID] = {
        createdAtMs: Date.parse('2026-10-02T00:00:00.000Z'),
        storageRefId: 'cf_attacker',
      };
      (peekCacheSync as jest.Mock).mockReturnValue(staleCache);
      const { rows, readSessionStorageBlob } = await loadFrom(
        [listedItem('cf_attacker', '2026-10-02T00:00:00.000Z'), listedItem('cf_official', '2026-10-01T00:00:00.000Z')],
        { cf_official: question(), cf_attacker: question({ prompt: 'ATTACKER rewrite' }) },
      );
      expect(readSessionStorageBlob.mock.calls.map(([options]: any) => options.storageRef.id)).toEqual([
        'cf_attacker',
        'cf_official',
      ]);
      const cache = mergeWorkerCanonicalQuestionMetadata(staleCache, rows, identity) as any;
      expect(cache.worker.questions[QUESTION_ID]).toEqual(expect.objectContaining({ prompt: PROMPT }));
      expect(cache.worker.questions[QUESTION_ID].voiceCredits).toBeUndefined();
    });

    it('replaces a placeholder built from a response payload with the real question', async () => {
      const responseCache = mergeWorkerQuestionResponses(
        null,
        [
          {
            questionId: QUESTION_ID,
            responder: AUTHOR,
            response: { questionID: QUESTION_ID, prompt: 'Payload headline', type: 'freeform', answer: { value: 'x' } },
            storageRefId: 'response-ref',
            timestamp: 10,
          },
        ],
        'worker-session',
        identity,
      ) as any;
      expect(responseCache.worker.questions[QUESTION_ID].source).toBe('worker-response-payload');

      const { rows } = await loadFrom([listedItem('cf_official', '2026-10-01T00:00:00.000Z', AUTHOR)], {
        cf_official: question(),
      });
      const cache = mergeWorkerCanonicalQuestionMetadata(responseCache, rows, identity) as any;
      const merged = cache.worker.questions[QUESTION_ID];
      expect(merged).toEqual({ ...(rows[0] as any).payload, id: QUESTION_ID });
      expect(merged).toEqual(expect.objectContaining({ prompt: PROMPT, type: 'binary' }));
      expect(merged.question).toBeUndefined();
      expect(merged.text).toBeUndefined();
      expect(merged.source).not.toBe('worker-response-payload');
      expect(cache.worker.questionResponses[QUESTION_ID][AUTHOR]).toEqual(
        expect.objectContaining({ prompt: 'Payload headline' }),
      );
    });

    it('drops ids the Worker lists as hidden, including cached copies', async () => {
      const cached = mergeWorkerCanonicalQuestionMetadata(
        null,
        (await loadFrom([listedItem('cf_spam', '2026-10-01T00:00:00.000Z')], { cf_spam: question() })).rows,
        identity,
      ) as any;
      expect(cached.worker.questions[QUESTION_ID]).toBeDefined();
      const { rows, readSessionStorageBlob } = await loadFrom(
        [
          { hidden: true, metadata: { resource: 'questions', resourceId: QUESTION_ID, hidden: true } },
          listedItem('cf_unmarked_copy', '2026-10-05T00:00:00.000Z'),
        ],
        { cf_unmarked_copy: question() },
      );
      expect(rows).toEqual([{ hidden: true, id: QUESTION_ID }]);
      expect(readSessionStorageBlob).toHaveBeenCalledTimes(1);
      const cache = mergeWorkerCanonicalQuestionMetadata(cached, rows, identity) as any;
      expect(cache.worker.questions[QUESTION_ID]).toBeUndefined();
      expect(cache.worker.workerQuestionMetadataRefs[QUESTION_ID]).toBeUndefined();
    });

    it('skips survey rows whose title is not text', async () => {
      const survey = (title: unknown) => ({
        surveyID: '0xsurvey',
        title,
        sessionId: SESSION_ID,
        sessionSlug: 'worker-session',
      });
      const { rows } = await loadFrom(
        [
          listedItem('cf_object_title', '2026-10-01T00:00:00.000Z', '', 'surveys'),
          listedItem('cf_text_title', '2026-10-02T00:00:00.000Z', '', 'surveys'),
        ],
        { cf_object_title: survey({ text: 'crash' }), cf_text_title: survey('Readable survey') },
        'surveys',
      );
      expect(
        rows.map((row: WorkerCanonicalMetadataEntry) => ('storageRefId' in row ? row.storageRefId : row.id)),
      ).toEqual(['cf_text_title']);
      const cache = mergeWorkerCanonicalSurveyMetadata(null, rows, identity) as any;
      expect(cache.worker.surveys['0xsurvey'].title).toBe('Readable survey');
    });

    it('rereads only storage refs the cache does not already hold, through a rolling pool', async () => {
      const items = Array.from({ length: 20 }, (_, index) =>
        listedItem(`cf_q_${index}`, `2026-10-01T00:00:${String(index).padStart(2, '0')}.000Z`),
      );
      const cachedCache = mergeWorkerCanonicalQuestionMetadata(null, [], identity) as any;
      cachedCache.worker.questions['0xq0'] = question({ id: '0xq0' });
      cachedCache.worker.workerQuestionMetadataRefs['0xq0'] = {
        createdAtMs: 1,
        storageRefId: 'cf_q_0',
        uploadAuthority: null,
      };
      cachedCache.worker.workerQuestionMetadataRefs['0xorphan'] = { createdAtMs: 1, storageRefId: 'cf_q_1' };
      (peekCacheSync as jest.Mock).mockReturnValue(cachedCache);

      let active = 0;
      let maxActive = 0;
      let releaseSlowRead: () => void = () => {};
      const slowRead = new Promise<void>((resolve) => {
        releaseSlowRead = resolve;
      });
      const started: string[] = [];
      const readSessionStorageBlob = jest.fn(async ({ storageRef }: any) => {
        started.push(storageRef.id);
        active += 1;
        maxActive = Math.max(maxActive, active);
        if (storageRef.id === 'cf_q_2') await slowRead;
        else await new Promise((resolve) => setTimeout(resolve, 0));
        if (started.length === 18) releaseSlowRead();
        active -= 1;
        const index = Number(storageRef.id.split('_').pop());
        return { json: async () => question({ id: `0xq${index}`, prompt: `Question ${index}` }) } as Response;
      });

      const rows = await loadWorkerCanonicalQuestions(
        { sessionConfig, sessionSlug: 'worker-session' },
        {
          listSessionStorageRefsPage: jest.fn().mockResolvedValue({ items, cursor: null, listComplete: true }),
          readSessionStorageBlob,
        },
      );
      expect(peekCacheSync).toHaveBeenCalledWith('questionsCache', 'worker-session', { clone: false });
      // cf_q_0 is cached; cf_q_1's ref has no cached question, so it is read.
      expect(started).toHaveLength(19);
      expect(started).not.toContain('cf_q_0');
      // One slow read did not hold back the rest: later reads started first.
      expect(started.indexOf('cf_q_19')).toBeGreaterThan(-1);
      expect(maxActive).toBeLessThanOrEqual(8);
      expect(rows).toHaveLength(19);
    });

    it('drops a stored row with non-text fields instead of failing the whole load', async () => {
      // JSON can carry an object whose text conversion throws.
      const hostile = () => JSON.parse('{"toString":1}');
      const otherId = String(generateQuestionId('binary', 'Other question', [], false, 99)).toLowerCase();
      const { rows } = await loadFrom(
        [
          listedItem('cf_official', '2026-10-01T00:00:00.000Z', AUTHOR),
          listedItem('cf_bad_slug', '2026-10-01T00:00:01.000Z', ATTACKER),
          listedItem('cf_bad_session', '2026-10-01T00:00:02.000Z', ATTACKER),
          listedItem('cf_bad_id', '2026-10-01T00:00:03.000Z', ATTACKER),
          listedItem('cf_bad_prompt', '2026-10-01T00:00:04.000Z', ATTACKER),
          listedItem('cf_object_type', '2026-10-01T00:00:05.000Z', ATTACKER),
        ],
        {
          cf_official: question(),
          cf_bad_slug: question({ id: otherId, sessionSlug: hostile() }),
          cf_bad_session: question({ id: otherId, sessionId: hostile() }),
          cf_bad_id: question({ id: hostile() }),
          // A prompt or type that is not text crashes question cards, so the row is no question.
          cf_bad_prompt: question({ id: otherId, prompt: hostile() }),
          cf_object_type: question({ id: otherId, type: { kind: 'binary' } }),
        },
      );
      // A non-text session id counts as missing, as in legacy payloads, and the
      // row takes this session's own id; the other bad rows are dropped.
      expect(rows.map((row: any) => row.storageRefId)).toEqual(['cf_official', 'cf_bad_session']);
      expect((rows[1] as any).payload.sessionId).toBe(SESSION_ID);

      const surveys = await loadFrom(
        [
          listedItem('cf_survey', '2026-10-01T00:00:00.000Z', AUTHOR, 'surveys'),
          listedItem('cf_bad_survey', '2026-10-01T00:00:01.000Z', ATTACKER, 'surveys'),
        ],
        {
          cf_survey: { surveyID: '0xsurvey', title: 'Survey', sessionId: SESSION_ID, sessionSlug: 'worker-session' },
          cf_bad_survey: { surveyID: hostile(), title: 'Survey', sessionId: SESSION_ID, sessionSlug: 'worker-session' },
        },
        'surveys',
      );
      expect(surveys.rows.map((row: any) => row.storageRefId)).toEqual(['cf_survey']);
    });

    it.each(['questions', 'surveys'] as const)(
      'ignores current roles and legacy uploader flags for unstamped %s',
      async (resource) => {
        const payload = (label: string) =>
          resource === 'questions'
            ? question({ tags: [label] })
            : { surveyID: 's1', title: label, sessionId: SESSION_ID, sessionSlug: 'worker-session' };
        const items = [
          listedItem('cf_original', '2026-10-01T00:00:00.000Z', AUTHOR, resource),
          {
            ...listedItem('cf_flagged', '2026-10-02T00:00:00.000Z', ATTACKER, resource),
            metadata: {
              ...listedItem('cf_flagged', '2026-10-02T00:00:00.000Z', ATTACKER, resource).metadata,
              uploaderIsAdmin: true,
            },
          },
          listedItem('cf_current_admin', '2026-10-03T00:00:00.000Z', ADMIN, resource),
          listedItem('cf_invalid_stamp', '2026-10-04T00:00:00.000Z', ADMIN, resource, ' admin '),
        ];
        const payloads = {
          cf_original: payload('Original'),
          cf_flagged: payload('Flagged'),
          cf_current_admin: payload('Current admin'),
          cf_invalid_stamp: payload('Invalid stamp'),
        };
        const load = resource === 'questions' ? loadWorkerCanonicalQuestions : loadWorkerCanonicalSurveys;
        const merge =
          resource === 'questions' ? mergeWorkerCanonicalQuestionMetadata : mergeWorkerCanonicalSurveyMetadata;
        for (const adminAddress of ['', ADMIN, AUTHOR, ATTACKER]) {
          const rows = await load(
            { sessionConfig: { ...sessionConfig, adminAddress }, sessionSlug: 'worker-session' },
            {
              listSessionStorageRefsPage: jest.fn().mockResolvedValue({ items, cursor: null, listComplete: true }),
              readSessionStorageBlob: jest.fn(
                async ({ storageRef }: any) =>
                  ({ json: async () => payloads[storageRef.id as keyof typeof payloads] }) as Response,
              ),
            },
          );
          const cache = merge(null, rows, identity) as any;
          const refsField = resource === 'questions' ? 'workerQuestionMetadataRefs' : 'workerSurveyMetadataRefs';
          const id = resource === 'questions' ? QUESTION_ID : 's1';
          expect(cache.worker[refsField][id].storageRefId).toBe('cf_original');
          expect(cache.worker[refsField][id].admin).toBe(false);
        }
      },
    );

    it.each(['questions', 'surveys'] as const)(
      'refreshes old cached %s authority and ignores derived admin flags',
      async (resource) => {
        const merge =
          resource === 'questions' ? mergeWorkerCanonicalQuestionMetadata : mergeWorkerCanonicalSurveyMetadata;
        const refsField = resource === 'questions' ? 'workerQuestionMetadataRefs' : 'workerSurveyMetadataRefs';
        const id = resource === 'questions' ? QUESTION_ID : 's1';
        const payload = (label: string) =>
          resource === 'questions'
            ? question({ tags: [label] })
            : { surveyID: id, title: label, sessionId: SESSION_ID, sessionSlug: 'worker-session' };
        for (const uploadAuthority of [undefined, 'admin']) {
          const stale = merge(null, [], identity) as any;
          stale.worker[resource][id] = payload('Old correction');
          stale.worker[refsField][id] = {
            admin: true,
            createdAtMs: Date.parse('2026-10-02T00:00:00.000Z'),
            storageRefId: 'cf_cached',
            verified: true,
          };
          (peekCacheSync as jest.Mock).mockReturnValue(stale);
          const { rows, readSessionStorageBlob } = await loadFrom(
            [
              listedItem('cf_original', '2026-10-01T00:00:00.000Z', AUTHOR, resource),
              listedItem('cf_cached', '2026-10-02T00:00:00.000Z', ADMIN, resource, uploadAuthority),
            ],
            { cf_original: payload('Original'), cf_cached: payload('Old correction') },
            resource,
          );
          expect(readSessionStorageBlob.mock.calls.map(([options]: any) => options.storageRef.id)).toEqual([
            'cf_original',
            'cf_cached',
          ]);
          const cache = merge(stale, rows, identity) as any;
          expect(cache.worker[refsField][id]).toEqual(
            expect.objectContaining({
              storageRefId: uploadAuthority === 'admin' ? 'cf_cached' : 'cf_original',
              admin: uploadAuthority === 'admin',
              uploadAuthority: uploadAuthority ?? null,
            }),
          );
        }
      },
    );

    it.each(['questions', 'surveys'] as const)(
      'uses upload-time authority for %s despite contradictory current roles',
      async (resource) => {
        const stamped = (
          id: string,
          date: string,
          uploader: string,
          uploadAuthority: string,
          uploaderIsAdmin: boolean,
        ) => ({
          ...listedItem(id, date, uploader, resource),
          metadata: { ...listedItem(id, date, uploader, resource).metadata, uploadAuthority, uploaderIsAdmin },
        });
        const items = [
          stamped('cf_original', '2026-10-01T00:00:00.000Z', AUTHOR, 'author', false),
          stamped('cf_correction', '2026-10-02T00:00:00.000Z', ATTACKER, 'admin', false),
          stamped('cf_promoted_retry', '2026-10-03T00:00:00.000Z', ADMIN, 'author', true),
        ];
        const payload = (title: string) =>
          resource === 'questions'
            ? question({ tags: [title] })
            : { surveyID: 's1', title, sessionId: SESSION_ID, sessionSlug: 'worker-session' };
        const { rows } = await loadFrom(
          items,
          {
            cf_original: payload('Original'),
            cf_correction: payload('Correction'),
            cf_promoted_retry: payload('Retry'),
          },
          resource,
        );
        const merge =
          resource === 'questions' ? mergeWorkerCanonicalQuestionMetadata : mergeWorkerCanonicalSurveyMetadata;
        const cache = merge(null, rows, identity);
        const expected =
          resource === 'questions'
            ? { [QUESTION_ID]: expect.objectContaining({ tags: ['Correction'] }) }
            : { s1: expect.objectContaining({ title: 'Correction' }) };
        expect(cache.worker).toEqual(expect.objectContaining({ [resource]: expect.objectContaining(expected) }));
        expect(rows.map((row) => 'uploadAuthority' in row && row.uploadAuthority === 'admin')).toEqual([
          false,
          true,
          false,
        ]);
      },
    );

    describe('published question matcher', () => {
      const loadMatcher = (items: Array<Record<string, unknown>>, payloads: Record<string, Record<string, unknown>>) =>
        loadWorkerCanonicalQuestionMatcher(
          { sessionConfig, sessionSlug: 'worker-session' },
          {
            listSessionStorageRefsPage: jest.fn().mockResolvedValue({ items, cursor: null, listComplete: true }),
            readSessionStorageBlob: jest.fn(
              async ({ storageRef }: any) => ({ json: async () => payloads[storageRef.id] }) as Response,
            ),
          },
        );

      it('matches only when the question readers see has the same content', async () => {
        const matches = await loadMatcher([listedItem('cf_official', '2026-10-01T00:00:00.000Z', AUTHOR)], {
          cf_official: question(),
        });
        expect(matches(question({ tags: ['local tag'] }))).toBe(true);
        // A local edit that kept the old id, a locked copy, and an unknown id never match.
        expect(matches(question({ prompt: 'Edited prompt' }))).toBe(false);
        expect(matches(question({ prompt: '[encrypted]', promptEncrypted: { ciphertext: 'x' } }))).toBe(false);
        const otherId = String(generateQuestionId('binary', 'Another question', [], false, 99)).toLowerCase();
        expect(matches(question({ id: otherId, prompt: 'Another question' }))).toBe(false);
      });

      it('does not match an id another author filled with different content', async () => {
        const squatted = await loadMatcher([listedItem('cf_squat', '2026-10-01T00:00:00.000Z', ATTACKER)], {
          cf_squat: question({ prompt: 'Spoofed text under a predicted id' }),
        });
        expect(squatted(question())).toBe(false);

        const locked = await loadMatcher([listedItem('cf_locked', '2026-10-01T00:00:00.000Z', ATTACKER)], {
          cf_locked: question({ prompt: '[encrypted]', promptEncrypted: { ciphertext: 'x' } }),
        });
        expect(locked(question())).toBe(false);

        const hidden = await loadMatcher(
          [
            { hidden: true, metadata: { resource: 'questions', resourceId: QUESTION_ID, hidden: true } },
            listedItem('cf_official', '2026-10-01T00:00:00.000Z', AUTHOR),
          ],
          { cf_official: question() },
        );
        expect(hidden(question())).toBe(false);
      });

      it('ignores a placeholder question built from a response payload', async () => {
        // An attacker owns the id with a row readers drop (another session), then
        // answers it with the predicted prompt, so responses alone describe it.
        const responseCache = mergeWorkerQuestionResponses(
          null,
          [
            {
              questionId: QUESTION_ID,
              responder: ATTACKER,
              response: { questionID: QUESTION_ID, prompt: PROMPT, type: 'binary', answer: { value: 'yes' } },
              storageRefId: 'cf_response',
              timestamp: 1,
            },
          ],
          'worker-session',
          identity,
        ) as any;
        expect(responseCache.worker.questions[QUESTION_ID].source).toBe('worker-response-payload');
        (peekCacheSync as jest.Mock).mockReturnValue(responseCache);

        const matches = await loadMatcher([listedItem('cf_squat', '2026-10-01T00:00:00.000Z', ATTACKER)], {
          cf_squat: question({ sessionSlug: 'elsewhere' }),
        });
        expect(matches(question())).toBe(false);
      });

      it('needs the exact authoring inputs, not only the same id hash', async () => {
        const variants: Array<Record<string, unknown>> = [
          { prompt: `  ${PROMPT.toUpperCase()}  ` },
          { options: ['Yes, obviously', 'No'] },
          { singleSelect: true },
          { voiceCredits: 5 },
        ];
        for (const variant of variants) {
          const matches = await loadMatcher([listedItem('cf_variant', '2026-10-01T00:00:00.000Z', ATTACKER)], {
            cf_variant: question(variant),
          });
          expect(matches(question())).toBe(false);
        }

        // Legacy ids joined multichoice options with commas, so the id published
        // for comma options is also the id of their re-split list. New ids keep
        // them apart; both ids still verify, and the matcher needs exact inputs.
        const MULTI_PROMPT = 'Which budget?';
        const realOptions = ['$1,000', '$2,000'];
        const splitOptions = ['$1', '000', '$2', '000'];
        const legacyId = String(generateQuestionId('multichoice', MULTI_PROMPT, splitOptions, false, 99)).toLowerCase();
        const currentId = String(generateQuestionId('multichoice', MULTI_PROMPT, realOptions, false, 99)).toLowerCase();
        expect(currentId).not.toBe(legacyId);
        const multi = (id: string, options: string[]) =>
          question({ id, type: 'multichoice', prompt: MULTI_PROMPT, options });
        const resplit = await loadMatcher([listedItem('cf_multi', '2026-10-01T00:00:00.000Z', ATTACKER)], {
          cf_multi: multi(legacyId, splitOptions),
        });
        expect(resplit(multi(legacyId, realOptions))).toBe(false);
        for (const id of [legacyId, currentId]) {
          const same = await loadMatcher([listedItem('cf_multi', '2026-10-01T00:00:00.000Z', AUTHOR)], {
            cf_multi: multi(id, realOptions),
          });
          expect(same(multi(id, realOptions))).toBe(true);
        }
      });

      it('ignores surrounding spaces and voice credits written as text, but not case', async () => {
        const QUAD_PROMPT = 'Spend credits';
        const quadId = String(generateQuestionId('quadratic', QUAD_PROMPT, ['A', 'B'], false, 120)).toLowerCase();
        const quadratic = (overrides: Record<string, unknown> = {}) =>
          question({
            id: quadId,
            type: 'quadratic',
            prompt: QUAD_PROMPT,
            options: ['A', 'B'],
            voiceCredits: 120,
            ...overrides,
          });
        // The id hash trims the prompt and options, so these are the same question.
        const stored = await loadMatcher([listedItem('cf_quad', '2026-10-01T00:00:00.000Z', AUTHOR)], {
          cf_quad: quadratic({ prompt: ` ${QUAD_PROMPT} `, options: ['A ', ' B'], voiceCredits: '120' }),
        });
        expect(stored(quadratic())).toBe(true);
        // Case is kept: readers would see different text.
        expect(stored(quadratic({ prompt: QUAD_PROMPT.toUpperCase() }))).toBe(false);
        expect(stored(quadratic({ options: ['a', 'B'] }))).toBe(false);
      });

      it('uses the cached copy of a version it does not read again', async () => {
        const cached = mergeWorkerCanonicalQuestionMetadata(
          null,
          (await loadFrom([listedItem('cf_official', '2026-10-01T00:00:00.000Z', AUTHOR)], { cf_official: question() }))
            .rows,
          identity,
        );
        (peekCacheSync as jest.Mock).mockReturnValue(cached);

        const matches = await loadMatcher([listedItem('cf_official', '2026-10-01T00:00:00.000Z', AUTHOR)], {});
        expect(matches(question())).toBe(true);
      });
    });
  });

  it('replaces same-slug question and survey caches when the exact Worker authority changes', () => {
    const configA = buildWorkerSessionConfig();
    const configB = buildWorkerSessionConfig({
      sessionId: `0x${'7'.repeat(32)}`,
      workerUrl: 'https://replacement-metadata-worker.example.test',
    });
    const identityA = resolveWorkerCanonicalCacheIdentity({
      sessionConfig: configA,
      sessionSlug: 'worker-session',
    });
    const identityB = resolveWorkerCanonicalCacheIdentity({
      sessionConfig: configB,
      sessionSlug: 'worker-session',
    });
    const registryCache = {
      '11155420': {
        questions: { registryQuestion: { id: 'registryQuestion' } },
        surveys: { registrySurvey: { id: 'registrySurvey' } },
      },
    };
    const questionCacheA = mergeWorkerCanonicalQuestionMetadata(
      registryCache,
      [
        {
          id: 'question-a',
          createdAtMs: 1,
          payload: { id: 'question-a', prompt: 'Session A question' },
          storageRef: {
            backend: 'cloudflare',
            id: 'question-a-ref',
            resource: 'questions',
          },
          storageRefId: 'question-a-ref',
        },
      ],
      identityA,
    ) as any;
    const surveyCacheA = mergeWorkerCanonicalSurveyMetadata(
      registryCache,
      [
        {
          id: 'survey-a',
          createdAtMs: 1,
          payload: { id: 'survey-a', title: 'Session A survey' },
          storageRef: {
            backend: 'cloudflare',
            id: 'survey-a-ref',
            resource: 'surveys',
          },
          storageRefId: 'survey-a-ref',
        },
      ],
      identityA,
    ) as any;

    const questionCacheB = mergeWorkerCanonicalQuestionMetadata(questionCacheA, [], identityB) as any;
    const surveyCacheB = mergeWorkerCanonicalSurveyMetadata(surveyCacheA, [], identityB) as any;

    expect(questionCacheB.worker.questions).toEqual({});
    expect(questionCacheB.worker.workerCanonicalIdentity).toEqual(identityB);
    expect(questionCacheB['11155420']).toEqual(registryCache['11155420']);
    expect(surveyCacheB.worker.surveys).toEqual({});
    expect(surveyCacheB.worker.workerCanonicalIdentity).toEqual(identityB);
    expect(surveyCacheB['11155420']).toEqual(registryCache['11155420']);
  });
});
