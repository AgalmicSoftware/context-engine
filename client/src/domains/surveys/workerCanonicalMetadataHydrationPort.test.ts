import {
  loadWorkerCanonicalQuestions,
  loadWorkerCanonicalSurveys,
  mergeWorkerCanonicalQuestionMetadata,
  mergeWorkerCanonicalSurveyMetadata,
} from './workerCanonicalMetadataHydrationPort';
import { resolveWorkerCanonicalCacheIdentity } from '../../utilities/survey/workerCanonicalCacheIdentity';

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
