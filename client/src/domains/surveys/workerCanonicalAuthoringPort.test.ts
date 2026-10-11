import {
  publishWorkerCanonicalQuestions,
  publishWorkerCanonicalSurvey,
  resolveWorkerCanonicalAuthoringTarget,
} from './workerCanonicalAuthoringPort';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

const SESSION_ID = `0x${'1'.repeat(32)}`;
const WORKER_URL = 'https://session-worker.example.test';

const buildWorkerSessionConfig = (): any => ({
  slug: 'worker-session',
  sessionId: SESSION_ID,
  corsWorkerUrl: `${WORKER_URL}/`,
  networkChainId: 11155420,
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

const buildWorkerHybridSessionConfig = (kind: 'sbt' | 'lit'): any => {
  const config = buildWorkerSessionConfig();
  config.sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  config.sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  config.sessionModeProfile.evm.registryChainId = 11155420;
  if (kind === 'sbt') {
    config.sessionModeProfile.encryption.accessConditions = {
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
  } else {
    config.sessionModeProfile.encryption = { mode: 'lit' };
    config.sessionModeProfile.storage.payloadAccessControl.encryption = 'lit';
  }
  return config;
};

describe('workerCanonicalAuthoringPort', () => {
  it('pins pure Worker authoring to the exact configured origin, slug, and session identity', () => {
    const sessionConfig = buildWorkerSessionConfig();

    expect(
      resolveWorkerCanonicalAuthoringTarget({
        sessionConfig,
        sessionSlug: 'worker-session',
      }),
    ).toEqual({
      sessionConfig,
      sessionId: SESSION_ID,
      sessionSlug: 'worker-session',
      workerUrl: WORKER_URL,
    });
  });

  it('writes standalone questions only through canonical Worker storage without an RPC dependency', async () => {
    const sessionConfig = buildWorkerSessionConfig();
    const uploadData = jest.fn().mockResolvedValue({
      storageRef: {
        backend: 'cloudflare',
        id: 'cf_question_opaque_01',
        resource: 'questions',
      },
    });

    const result = await publishWorkerCanonicalQuestions(
      {
        account: '0x1111111111111111111111111111111111111111',
        providerLike: 'passkey_eoa',
        questions: [
          {
            id: '0xquestion',
            prompt: 'A Worker-native question',
            sessionId: 'stale-session-id',
            sessionSlug: 'stale-session',
            type: 'freeform',
          },
        ],
        sessionConfig,
        sessionSlug: 'worker-session',
      },
      { uploadData },
    );

    expect(uploadData).toHaveBeenCalledTimes(1);
    expect(uploadData).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '0xquestion',
        sessionId: SESSION_ID,
        sessionSlug: 'worker-session',
      }),
      'json',
      expect.objectContaining({
        context: {
          account: '0x1111111111111111111111111111111111111111',
          providerLike: 'passkey_eoa',
        },
        resource: 'questions',
        sessionConfig,
        sessionSlug: 'worker-session',
        workerUrl: WORKER_URL,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        workerCanonicalSubmission: true,
        sessionId: SESSION_ID,
        sessionSlug: 'worker-session',
        workerUrl: WORKER_URL,
        uploadedQuestions: [
          expect.objectContaining({
            questionId: '0xquestion',
            storageRef: expect.objectContaining({
              backend: 'cloudflare',
              id: 'cf_question_opaque_01',
              resource: 'questions',
            }),
          }),
        ],
      }),
    );
  });

  it('commits survey authoring to the same canonical Worker after every question is durable', async () => {
    const sessionConfig = buildWorkerSessionConfig();
    const uploadData = jest
      .fn()
      .mockResolvedValueOnce({
        storageRef: {
          backend: 'cloudflare',
          id: 'cf_question_opaque_02',
          resource: 'questions',
        },
      })
      .mockResolvedValueOnce({
        storageRef: {
          backend: 'cloudflare',
          id: 'cf_survey_opaque_01',
          resource: 'surveys',
        },
      });

    const result = await publishWorkerCanonicalSurvey(
      {
        account: '0x1111111111111111111111111111111111111111',
        providerLike: 'passkey_eoa',
        questions: [{ id: '0xquestion', prompt: 'Question', type: 'freeform' }],
        sessionConfig,
        sessionSlug: 'worker-session',
        survey: {
          surveyID: '0xsurvey',
          sessionId: 'stale-session-id',
          sessionSlug: 'stale-session',
          title: 'Worker survey',
        },
      },
      { uploadData },
    );

    expect(uploadData.mock.calls.map((call) => call[2].resource)).toEqual(['questions', 'surveys']);
    expect(uploadData.mock.calls.every((call) => call[2].workerUrl === WORKER_URL)).toBe(true);
    expect(uploadData.mock.calls.every((call) => call[2].sessionSlug === 'worker-session')).toBe(true);
    expect(uploadData.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        sessionId: SESSION_ID,
        sessionSlug: 'worker-session',
        surveyID: '0xsurvey',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        surveyStorageRef: expect.objectContaining({
          backend: 'cloudflare',
          id: 'cf_survey_opaque_01',
          resource: 'surveys',
        }),
        workerCanonicalSubmission: true,
      }),
    );
  });

  const workerRejection = (reason: string) =>
    Object.assign(new Error(`Worker refused the upload (${reason}).`), { status: 409, reason });

  it("treats another author's identical question as already published", async () => {
    const uploadData = jest
      .fn()
      .mockRejectedValueOnce(workerRejection('storage_resource_id_owned'))
      .mockResolvedValueOnce({ storageRef: { backend: 'cloudflare', id: 'cf_question_new', resource: 'questions' } })
      .mockResolvedValueOnce({ storageRef: { backend: 'cloudflare', id: 'cf_survey_new', resource: 'surveys' } });

    const result = await publishWorkerCanonicalSurvey(
      {
        account: '0x2222222222222222222222222222222222222222',
        questions: [
          { id: '0xshared', prompt: 'Shared question', type: 'freeform' },
          { id: '0xnew', prompt: 'New question', type: 'freeform' },
        ],
        sessionConfig: buildWorkerSessionConfig(),
        sessionSlug: 'worker-session',
        survey: { surveyID: '0xsurvey', title: 'Second author survey', questionIDs: ['0xshared', '0xnew'] },
      },
      { uploadData },
    );

    expect(uploadData).toHaveBeenCalledTimes(3);
    expect(result.uploadedQuestions).toEqual([
      { questionId: '0xshared', resource: 'questions', alreadyPublished: true },
      expect.objectContaining({ questionId: '0xnew', storageRef: expect.objectContaining({ id: 'cf_question_new' }) }),
    ]);
    expect(result.surveyStorageRef).toEqual(expect.objectContaining({ id: 'cf_survey_new' }));
  });

  it('explains when the session admin hid a question or survey', async () => {
    const questionUpload = jest.fn().mockRejectedValueOnce(workerRejection('storage_resource_id_hidden'));
    await expect(
      publishWorkerCanonicalQuestions(
        {
          questions: [{ id: '0xhidden', prompt: 'Hidden question', type: 'freeform' }],
          sessionConfig: buildWorkerSessionConfig(),
          sessionSlug: 'worker-session',
        },
        { uploadData: questionUpload },
      ),
    ).rejects.toThrow(
      'This question was hidden by the session admin and can\'t be published again: "Hidden question".',
    );

    const surveyUpload = jest
      .fn()
      .mockResolvedValueOnce({ storageRef: { backend: 'cloudflare', id: 'cf_question', resource: 'questions' } })
      .mockRejectedValueOnce(workerRejection('storage_resource_id_hidden'));
    await expect(
      publishWorkerCanonicalSurvey(
        {
          questions: [{ id: '0xquestion', prompt: 'Question', type: 'freeform' }],
          sessionConfig: buildWorkerSessionConfig(),
          sessionSlug: 'worker-session',
          survey: { surveyID: '0xhiddensurvey', title: 'Hidden survey' },
        },
        { uploadData: surveyUpload },
      ),
    ).rejects.toThrow("This survey was hidden by the session admin and can't be published again.");
  });

  it('keeps other upload failures, including a survey id owned by another author', async () => {
    const uploadData = jest
      .fn()
      .mockResolvedValueOnce({ storageRef: { backend: 'cloudflare', id: 'cf_question', resource: 'questions' } })
      .mockRejectedValueOnce(workerRejection('storage_resource_id_owned'));

    await expect(
      publishWorkerCanonicalSurvey(
        {
          questions: [{ id: '0xquestion', prompt: 'Question', type: 'freeform' }],
          sessionConfig: buildWorkerSessionConfig(),
          sessionSlug: 'worker-session',
          survey: { surveyID: '0xlegacy', title: 'Legacy id survey' },
        },
        { uploadData },
      ),
    ).rejects.toThrow('Worker refused the upload (storage_resource_id_owned).');
  });

  it.each(['sbt', 'lit'] as const)(
    'keeps a valid Worker/%s hybrid on the exact Worker-canonical authoring target',
    (kind) => {
      const sessionConfig = buildWorkerHybridSessionConfig(kind);

      expect(
        resolveWorkerCanonicalAuthoringTarget({
          sessionConfig,
          sessionSlug: 'worker-session',
        }),
      ).toEqual({
        sessionConfig,
        sessionId: SESSION_ID,
        sessionSlug: 'worker-session',
        workerUrl: WORKER_URL,
      });
    },
  );
});
