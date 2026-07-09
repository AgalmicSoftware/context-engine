import { ethers } from 'ethers';

import UserPage from './UserPage';
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

describe('UserPage response decrypt helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('keeps decrypt clicks inert without a connected account', async () => {
    const instance = makeInstance({
      account: '',
      provider: 'wagmi',
    });
    const encryptedResponse = {
      questionID: 'q1',
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: '{"v":2}',
      },
      additional: {
        value: '',
        encrypted: false,
      },
    };

    const didDecrypt = await instance.handleDecryptQuestionAnswer('q1', 'answer', encryptedResponse);

    expect(didDecrypt).toBe(false);
    expect(cryptoUtils.decryptSingleField).not.toHaveBeenCalled();
    expect(instance.setState).not.toHaveBeenCalled();
  });

  it('decrypts gated responses and patches detailed response state', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      provider: 'wagmi',
    });
    const encryptedResponse = {
      questionID: 'q1',
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: '{"v":2}',
      },
      additional: {
        value: '',
        encrypted: false,
      },
    };
    instance.state = {
      ...instance.state,
      detailedQuestionResponses: {
        q1: encryptedResponse,
      },
      detailedSurveyResponses: {
        s1: [
          {
            questionData: { id: 'q1', prompt: 'Question 1', type: 'freeform' },
            responseData: encryptedResponse,
            canDecryptOtherResponses: true,
          },
        ],
      },
    };
    cryptoUtils.decryptSingleField.mockResolvedValue({
      answers: {
        q1: { value: 'clear text answer' },
      },
      additionalComments: {},
      importance: {},
    });

    const didDecrypt = await instance.handleDecryptQuestionAnswer('q1', 'answer', encryptedResponse);

    expect(didDecrypt).toBe(true);
    expect(cryptoUtils.decryptSingleField).toHaveBeenCalled();
    expect(instance.state.detailedQuestionResponses.q1.answer.value).toBe('clear text answer');
    expect(instance.state.detailedQuestionResponses.q1.answer.encrypted).toBe(false);
    expect(instance.state.detailedQuestionResponses.q1.answer.encryptedPortion).toBeUndefined();
    expect(instance.state.detailedSurveyResponses.s1[0].responseData.answer.value).toBe('clear text answer');
  });

  it('passes survey binding context when decrypting survey-backed responses', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      provider: 'wagmi',
    });
    const surveyId = `0x${'12'.repeat(32)}`;
    const encryptedResponse = {
      questionID: 'q1',
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: '{"v":2}',
      },
      additional: {
        value: '',
        encrypted: false,
      },
    };
    instance.state = {
      ...instance.state,
      detailedQuestionResponses: {
        q1: encryptedResponse,
      },
      detailedSurveyResponses: {
        [surveyId]: [
          {
            questionData: {
              id: 'q1',
              prompt: 'Question 1',
              type: 'freeform',
              associatedSurveyId: surveyId,
            },
            responseData: encryptedResponse,
            canDecryptOtherResponses: true,
          },
        ],
      },
    };
    cryptoUtils.decryptSingleField.mockResolvedValue({
      answers: {
        q1: { value: 'clear text answer' },
      },
      additionalComments: {},
      importance: {},
    });

    await instance.handleDecryptQuestionAnswer('q1', 'answer', encryptedResponse);

    expect(cryptoUtils.decryptSingleField).toHaveBeenCalledWith(
      {
        answers: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: '{"v":2}',
          },
        },
        additionalComments: {
          q1: {
            value: '',
            encrypted: false,
          },
        },
        importance: {},
        conviction: {},
      },
      'q1',
      'answer',
      {
        account: '0x00000000000000000000000000000000000000bb',
        provider: 'wagmi',
        providerKind: 'wagmi',
        chainId: 84532,
        surveyId,
        acceptedSurveyIds: [surveyId, ethers.constants.HashZero],
        lit: null,
        throwOnError: true,
      },
    );
  });

  it('keeps encrypted response state unchanged when decrypt execution fails', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      provider: 'wagmi',
    });
    const encryptedResponse = {
      questionID: 'q1',
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: '{"v":2}',
      },
      additional: {
        value: '',
        encrypted: false,
      },
    };
    instance.state = {
      ...instance.state,
      detailedQuestionResponses: {
        q1: encryptedResponse,
      },
      detailedSurveyResponses: {
        s1: [
          {
            questionData: { id: 'q1', prompt: 'Question 1', type: 'freeform' },
            responseData: encryptedResponse,
            canDecryptOtherResponses: true,
          },
        ],
      },
    };
    cryptoUtils.decryptSingleField.mockRejectedValue(new Error('lit unavailable'));

    const didDecrypt = await instance.handleDecryptQuestionAnswer('q1', 'answer', encryptedResponse);

    expect(didDecrypt).toBe(false);
    expect(cryptoUtils.decryptSingleField).toHaveBeenCalled();
    expect(instance.setState).not.toHaveBeenCalled();
    expect(instance.state.detailedQuestionResponses.q1).toBe(encryptedResponse);
    expect(instance.state.detailedQuestionResponses.q1.answer.encrypted).toBe(true);
    expect(instance.state.detailedSurveyResponses.s1[0].responseData).toBe(encryptedResponse);
  });

  it('keeps duplicated payload strings isolated when decrypting one response', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000bb',
      provider: 'wagmi',
    });
    const duplicatedPayload = JSON.stringify({
      answer: {
        value: '*',
        encrypted: true,
        encryptedPortion: '{"v":2}',
      },
      additional: {
        value: '',
        encrypted: false,
      },
    });
    const firstResponse = instance.parseCachedResponsePayload(duplicatedPayload);
    const secondResponse = instance.parseCachedResponsePayload(duplicatedPayload);
    expect(firstResponse).not.toBe(secondResponse);
    instance.state = {
      ...instance.state,
      detailedQuestionResponses: {
        q1: firstResponse,
        q2: secondResponse,
      },
      detailedSurveyResponses: {
        s1: [
          {
            questionData: { id: 'q1', prompt: 'Question 1', type: 'freeform' },
            responseData: firstResponse,
            canDecryptOtherResponses: true,
          },
          {
            questionData: { id: 'q2', prompt: 'Question 2', type: 'freeform' },
            responseData: secondResponse,
            canDecryptOtherResponses: true,
          },
        ],
      },
    };
    cryptoUtils.decryptSingleField.mockResolvedValue({
      answers: {
        q1: { value: 'clear text answer' },
      },
      additionalComments: {},
      importance: {},
    });

    const didDecrypt = await instance.handleDecryptQuestionAnswer('q1', 'answer', firstResponse);

    expect(didDecrypt).toBe(true);
    expect(instance.state.detailedQuestionResponses.q1.answer.value).toBe('clear text answer');
    expect(instance.state.detailedQuestionResponses.q2.answer.value).toBe('*');
    expect(instance.state.detailedQuestionResponses.q2.answer.encrypted).toBe(true);
    expect(instance.state.detailedSurveyResponses.s1[1].responseData.answer.value).toBe('*');
  });

  it('clones __proto__ payload keys as data without mutating object prototype', () => {
    const instance = makeInstance();
    const payload = '{"__proto__":{"polluted":"yes"},"answer":{"value":"safe"}}';

    const parsed = instance.parseCachedResponsePayload(payload);

    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(true);
    expect(parsed.__proto__).toEqual({ polluted: 'yes' });
    expect(parsed.answer.value).toBe('safe');
    expect(parsed.polluted).toBeUndefined();
  });
});
