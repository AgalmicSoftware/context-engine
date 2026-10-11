import { ethers } from 'ethers';

import { createContractScriptsSurveyWriteMethods } from './contractScripts.surveyWriteMethods';
import { hasNonZeroHashValue } from './deterministicFactoryHelpers';

const SURVEYS_ADDRESS = '0x1111111111111111111111111111111111111111';
const SURVEY_ID = ethers.utils.id('survey-precheck');
const QUESTION_ID = ethers.utils.id('question-precheck');
const PUBLISHED_HASH = `0x${'22'.repeat(32)}`;

const buildMethods = ({
  surveyHash = ethers.constants.HashZero,
  questionHash = ethers.constants.HashZero,
  readError = null as Error | null,
} = {}) => {
  const reads = {
    surveyHashes: jest.fn(async (_surveyId: string) => {
      if (readError) throw readError;
      return surveyHash;
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
});
