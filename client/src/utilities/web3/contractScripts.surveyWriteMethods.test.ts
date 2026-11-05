import { ethers } from 'ethers';

import { createContractScriptsSurveyWriteMethods } from './contractScripts.surveyWriteMethods';
import { hasNonZeroHashValue } from './deterministicFactoryHelpers';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../session/sessionModeProfile';

const SURVEYS_ADDRESS = '0x1111111111111111111111111111111111111111';
const SURVEY_ID = ethers.utils.id('survey-precheck');
const QUESTION_ID = ethers.utils.id('question-precheck');
const PUBLISHED_HASH = `0x${'22'.repeat(32)}`;

const buildMethods = ({
  surveyHash = ethers.constants.HashZero,
  questionHash = ethers.constants.HashZero,
  readError = null as Error | null,
  hangReads = false,
} = {}) => {
  const reads = {
    surveyHashes: jest.fn((_surveyId: string): Promise<string> => {
      // An RPC that never answers.
      if (hangReads) return new Promise<string>(() => undefined);
      return readError ? Promise.reject(readError) : Promise.resolve(surveyHash);
    }),
    questionHashes: jest.fn(async (_questionId: string) => questionHash),
  };
  class MockContract {
    surveyHashes = reads.surveyHashes;
    questionHashes = reads.questionHashes;
  }
  class MockWeb3Provider {
    getSigner() {
      return { getAddress: async () => '0x00000000000000000000000000000000000000aa' };
    }
  }
  // Stop at the first upload: these tests only cover what happens before it.
  const uploadJsonPayloadForContractPointer = jest.fn(async () => {
    throw new Error('upload reached');
  });
  const contractsLog = { warn: jest.fn() };
  const methods = createContractScriptsSurveyWriteMethods({
    ARWEAVE_ACTIVE: true,
    STORAGE_RESOURCE_KEYS: { QUESTIONS: 'questions', SURVEYS: 'surveys' },
    SURVEYS: [],
    contractsLog,
    cryptoUtils: null,
    ethers: { ...ethers, Contract: MockContract, providers: { Web3Provider: MockWeb3Provider } },
    getSessionAddresses: () => ({ surveys: { address: SURVEYS_ADDRESS, chainId: 11155420 } }),
    getSurveysReadProviderForSession: () => ({}),
    hasNonZeroHashValue,
    isCloudflareStorageResource: () => false,
    memoizedResolveSession: () => ({ slug: 'registry-session', sessionName: 'Registry session' }),
    normalizeSessionNameFields: (value: unknown) => value,
    normalizeSessionSlug: (value: unknown) => value,
    resolveArweaveUploadOpts: async () => ({}),
    resolveStorageSessionSlug: () => 'registry-session',
    uploadJsonPayloadForContractPointer,
    utils: ethers.utils,
    validateNoLockedPlaintextInPayload: () => {},
  });
  const context = { ...methods, getProviderLocation: () => ({}) };
  const addSurvey = () =>
    methods.addSurveyWithQuestions.call(
      context,
      'wagmi',
      SURVEY_ID,
      { title: 'Survey' },
      [QUESTION_ID],
      [{ prompt: 'Question' }],
      'registry-session',
    );
  const addQuestions = () =>
    methods.addQuestions.call(
      context,
      'wagmi',
      [QUESTION_ID],
      [{ prompt: 'Question' }],
      [ethers.constants.HashZero],
      'registry-session',
    );
  return { addQuestions, addSurvey, contractsLog, reads, uploadJsonPayloadForContractPointer };
};

describe('survey write id pre-check', () => {
  it('stops before uploading when the survey id is already published on-chain', async () => {
    const { addSurvey, reads, uploadJsonPayloadForContractPointer } = buildMethods({ surveyHash: PUBLISHED_HASH });

    await expect(addSurvey()).rejects.toMatchObject({
      message: 'This survey is already published on-chain. Change its title or documents to publish a new survey.',
      resetSubmitProgress: true,
    });
    expect(reads.surveyHashes).toHaveBeenCalledWith(SURVEY_ID);
    expect(uploadJsonPayloadForContractPointer).not.toHaveBeenCalled();
  });

  it('stops before uploading when a question id is already published on-chain', async () => {
    const survey = buildMethods({ questionHash: PUBLISHED_HASH });
    await expect(survey.addSurvey()).rejects.toThrow(
      'Question 1 is already published on-chain. Edit its text or options, or remove it, then try again.',
    );

    const standalone = buildMethods({ questionHash: PUBLISHED_HASH });
    await expect(standalone.addQuestions()).rejects.toThrow('Question 1 is already published on-chain.');
    expect(standalone.reads.surveyHashes).not.toHaveBeenCalled();
    expect(standalone.reads.questionHashes).toHaveBeenCalledWith(QUESTION_ID);
    expect(survey.uploadJsonPayloadForContractPointer).not.toHaveBeenCalled();
    expect(standalone.uploadJsonPayloadForContractPointer).not.toHaveBeenCalled();
  });

  it('uploads as before when the ids are free or the read fails', async () => {
    const free = buildMethods();
    await expect(free.addSurvey()).rejects.toThrow('upload reached');
    expect(free.uploadJsonPayloadForContractPointer).toHaveBeenCalledTimes(1);

    const unreadable = buildMethods({ readError: new Error('rpc down') });
    await expect(unreadable.addSurvey()).rejects.toThrow('upload reached');
    expect(unreadable.contractsLog.warn).toHaveBeenCalled();
  });

  it('stops waiting for a hanging id read after 10 s and uploads as before', async () => {
    jest.useFakeTimers();
    try {
      const hanging = buildMethods({ hangReads: true });
      const outcome = hanging.addSurvey().then(
        () => 'resolved',
        (error: Error) => error.message,
      );

      await jest.advanceTimersByTimeAsync(9_999);
      expect(hanging.reads.surveyHashes).toHaveBeenCalledWith(SURVEY_ID);
      expect(hanging.uploadJsonPayloadForContractPointer).not.toHaveBeenCalled();
      expect(hanging.contractsLog.warn).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      await expect(outcome).resolves.toBe('upload reached');
      expect(hanging.contractsLog.warn).toHaveBeenCalledTimes(1);
      expect(hanging.uploadJsonPayloadForContractPointer).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Worker answer upload check', () => {
  const WORKER_SESSION = {
    slug: 'pilot',
    sessionId: '0x00112233445566778899aabbccddeeff',
    corsWorkerUrl: 'https://worker.example',
    sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    storageProfile: { backend: 'cloudflare' },
  };
  const buildSubmit = () => {
    class MockWeb3Provider {
      getSigner() {
        return { getAddress: async () => '0x00000000000000000000000000000000000000aa' };
      }
    }
    const uploadJsonPayloadForContractPointer = jest.fn(async () => {
      throw new Error('upload reached');
    });
    const methods = createContractScriptsSurveyWriteMethods({
      ARWEAVE_ACTIVE: false,
      STORAGE_RESOURCE_KEYS: { QUESTIONS: 'questions', SURVEYS: 'surveys', RESPONSES: 'responses' },
      SURVEYS: [],
      contractsLog: { warn: jest.fn() },
      cryptoUtils: null,
      ethers: { ...ethers, providers: { Web3Provider: MockWeb3Provider } },
      hasNonZeroHashValue,
      isCloudflareStorageResource: () => true,
      normalizeSessionSlug: (value: unknown) => value,
      resolveArweaveUploadOpts: async () => ({}),
      resolveSession: () => WORKER_SESSION,
      resolveStorageSessionSlug: () => 'pilot',
      uploadJsonPayloadForContractPointer,
      utils: ethers.utils,
      validateNoLockedPlaintextInPayload: () => {},
    });
    const context = { ...methods, getProviderLocation: () => ({}) };
    const submit = (response: Record<string, unknown>) =>
      methods.submitResponses.call(
        context,
        'wagmi',
        [QUESTION_ID],
        [response],
        ethers.constants.HashZero,
        null,
        WORKER_SESSION,
      );
    return { submit, uploadJsonPayloadForContractPointer };
  };
  const response = (text: string) => ({
    questionID: QUESTION_ID,
    prompt: 'Tell us more',
    answer: { value: text, encrypted: false, encryptedPortion: '' },
  });

  it('names an answer the Worker would refuse before anything uploads', async () => {
    const { submit, uploadJsonPayloadForContractPointer } = buildSubmit();
    await expect(submit(response('x'.repeat(97 * 1024)))).rejects.toThrow(
      /^Nothing was submitted: “Tell us more” is too long to save\. Shorten its answer or comment by about [\d,]+ characters and submit again\.$/,
    );
    expect(uploadJsonPayloadForContractPointer).not.toHaveBeenCalled();
  });

  it('uploads an answer that fits', async () => {
    const { submit, uploadJsonPayloadForContractPointer } = buildSubmit();
    await expect(submit(response('Yes'))).rejects.toThrow('upload reached');
    expect(uploadJsonPayloadForContractPointer).toHaveBeenCalledTimes(1);
  });
});

describe('on-chain survey copy re-check', () => {
  const REGISTRY_SESSION = {
    slug: 'registry-session',
    sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
  };
  const OTHER_QUESTION_ID = ethers.utils.id('question-other');
  const row = (questionID: string, value: string) => ({ questionID, answer: { value, encrypted: false } });
  const buildSubmit = ({
    pointers,
    stored,
    session = REGISTRY_SESSION,
    cloudflare = false,
  }: {
    pointers: string[];
    stored: unknown[];
    session?: Record<string, unknown>;
    cloudflare?: boolean;
  }) => {
    class MockContract {}
    class MockWeb3Provider {
      getSigner() {
        return { getAddress: async () => '0x00000000000000000000000000000000000000aa' };
      }
    }
    const uploadJsonPayloadForContractPointer = jest.fn(async ({ payload }: { payload: unknown }) => ({
      pointerBytes: ethers.utils.id(JSON.stringify(payload)),
      storageRef: { id: 'stored-ref' },
    }));
    const sendContractWriteViaProvider = jest.fn(async () => ({ receipt: { status: 1 } }));
    const methods = createContractScriptsSurveyWriteMethods({
      ARWEAVE_ACTIVE: !cloudflare,
      GAS_FALLBACKS: { submitResponses: () => 100000 },
      STORAGE_RESOURCE_KEYS: { QUESTIONS: 'questions', SURVEYS: 'surveys', RESPONSES: 'responses' },
      SURVEYS: [],
      clearReadCachesForGroup: jest.fn(),
      contractsLog: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
      cryptoUtils: null,
      ethers: { ...ethers, Contract: MockContract, providers: { Web3Provider: MockWeb3Provider } },
      getSessionAddresses: () => ({ surveys: { address: SURVEYS_ADDRESS, chainId: 11155420 } }),
      hasNonZeroHashValue,
      isCloudflareStorageResource: () => cloudflare,
      normalizeSessionSlug: (value: unknown) => value,
      notifyUserFacingTransactionError: jest.fn(),
      resolveArweaveUploadOpts: async () => ({}),
      resolveSession: () => session,
      resolveStorageSessionSlug: () => session.slug,
      resolveTxGasOverrides: async () => ({}),
      rpcLog: jest.fn(),
      sendContractWriteViaProvider,
      uploadJsonPayloadForContractPointer,
      utils: ethers.utils,
      validateNoLockedPlaintextInPayload: () => {},
    });
    const pointerReads = [...pointers];
    const getResponseHash = jest.fn(async () => pointerReads.shift() ?? pointers[pointers.length - 1]);
    const storedReads = [...stored];
    const getSurveyResponse = jest.fn(async () => storedReads.shift());
    const context = { ...methods, getProviderLocation: () => ({}), getResponseHash, getSurveyResponse };
    const submit = () =>
      methods.submitResponses.call(
        context,
        'wagmi',
        [QUESTION_ID],
        [row(QUESTION_ID, 'B2')],
        SURVEY_ID,
        { surveyID: SURVEY_ID, responses: [row(QUESTION_ID, 'B2')] },
        session,
      );
    const surveyUploads = () =>
      uploadJsonPayloadForContractPointer.mock.calls
        .map(([{ payload }]) => payload as { surveyID?: string; responses: unknown[] })
        .filter((payload) => payload.surveyID);
    return { getResponseHash, getSurveyResponse, sendContractWriteViaProvider, submit, surveyUploads };
  };
  const storedCopy = (a: string, b: string) => ({
    surveyID: SURVEY_ID,
    responses: [row(OTHER_QUESTION_ID, a), row(QUESTION_ID, b)],
  });
  const sentSurveyPointer = (send: jest.Mock) => (send.mock.calls[0][0] as { args: unknown[] }).args[3];

  it('sends the merged copy when nothing changed since it was read', async () => {
    const built = buildSubmit({ pointers: ['pointer-1', 'pointer-1'], stored: [storedCopy('A1', 'B1')] });
    await built.submit();

    expect(built.getSurveyResponse).toHaveBeenCalledTimes(1);
    expect(built.surveyUploads()).toHaveLength(1);
    expect(built.surveyUploads()[0].responses).toEqual([row(OTHER_QUESTION_ID, 'A1'), row(QUESTION_ID, 'B2')]);
    expect(built.sendContractWriteViaProvider).toHaveBeenCalledTimes(1);
  });

  it('merges again when another tab or device saved in between, keeping its edit', async () => {
    const built = buildSubmit({
      pointers: ['pointer-1', 'pointer-2', 'pointer-2', 'pointer-2'],
      stored: [storedCopy('A1', 'B1'), storedCopy('A2', 'B1')],
    });
    const receipt = (await built.submit()) as Record<string, unknown>;

    expect(built.surveyUploads()).toHaveLength(2);
    const rebuilt = built.surveyUploads()[1];
    expect(rebuilt.responses).toEqual([row(OTHER_QUESTION_ID, 'A2'), row(QUESTION_ID, 'B2')]);
    expect(sentSurveyPointer(built.sendContractWriteViaProvider)).toBe(ethers.utils.id(JSON.stringify(rebuilt)));
    expect(receipt.__ceSurveyResponse).toEqual(rebuilt);
  });

  it('stops with a retryable error rather than chase a copy that keeps changing', async () => {
    const built = buildSubmit({
      pointers: [
        'pointer-1',
        'pointer-2',
        'pointer-2',
        'pointer-3',
        'pointer-3',
        'pointer-4',
        'pointer-4',
        'pointer-5',
      ],
      stored: [storedCopy('A1', 'B1'), storedCopy('A2', 'B1'), storedCopy('A3', 'B1'), storedCopy('A4', 'B1')],
    });

    await expect(built.submit()).rejects.toMatchObject({ retryable: true });
    expect(built.sendContractWriteViaProvider).not.toHaveBeenCalled();
  });

  it('stops with a retryable error when the copy cannot be checked again', async () => {
    const built = buildSubmit({ pointers: ['pointer-1'], stored: [storedCopy('A1', 'B1')] });
    built.getResponseHash.mockResolvedValueOnce('pointer-1').mockRejectedValueOnce(new Error('fixture: read failed'));

    await expect(built.submit()).rejects.toMatchObject({ retryable: true });
    expect(built.sendContractWriteViaProvider).not.toHaveBeenCalled();
  });

  it('never checks on a Worker session, which keeps no merged copy', async () => {
    const built = buildSubmit({
      pointers: [],
      stored: [],
      cloudflare: true,
      session: {
        slug: 'pilot',
        sessionId: '0x00112233445566778899aabbccddeeff',
        corsWorkerUrl: 'https://worker.example',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        storageProfile: { backend: 'cloudflare' },
      },
    });
    const receipt = (await built.submit()) as Record<string, unknown>;

    expect(receipt.workerCanonicalSubmission).toBe(true);
    expect(built.getResponseHash).not.toHaveBeenCalled();
    expect(built.getSurveyResponse).not.toHaveBeenCalled();
  });
});
