import { webcrypto } from 'crypto';
import { cryptoUtils } from './cryptography.js';

const ACCOUNT = '0x00000000000000000000000000000000000000aa';
const CHAIN_ID = 84532;
const SURVEY_ID = `0x${'34'.repeat(32)}`;
const OTHER_SURVEY_ID = `0x${'56'.repeat(32)}`;
const SIG_A = `0x${'11'.repeat(65)}`;

const makeProvider = (signatureHex) => ({
  request: jest.fn(async ({ method }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [ACCOUNT];
    if (method === 'eth_chainId') return '0x14a34';
    if (method === 'eth_signTypedData_v4') return signatureHex;
    throw new Error(`Unexpected wallet method: ${method}`);
  }),
});

describe('cryptoUtils decrypt envelope cache key scoping', () => {
  beforeAll(() => {
    if (typeof window !== 'undefined' && (!window.crypto || !window.crypto.subtle)) {
      Object.defineProperty(window, 'crypto', {
        value: webcrypto,
        configurable: true,
      });
    }
  });

  it('scopes cache keys by account and chainId', () => {
    const envelopeJsonStr = JSON.stringify({
      v: 1,
      iv: 'ZmFrZS1pdg==',
      ciphertext: 'ZmFrZS1jaXBoZXJ0ZXh0',
      aad: { context: `0x${'11'.repeat(32)}` },
      recipients: [],
    });

    const base = {
      jsonStr: envelopeJsonStr,
      providerLike: 'wagmi',
      litOpts: { getKey: () => {}, litNetwork: 'naga-dev' },
    };

    const keyAChain1 = cryptoUtils.__test.buildDecryptEnvelopeCacheKey({
      ...base,
      account: '0x00000000000000000000000000000000000000aa',
      chainId: 1,
    });
    const keyBChain1 = cryptoUtils.__test.buildDecryptEnvelopeCacheKey({
      ...base,
      account: '0x00000000000000000000000000000000000000bb',
      chainId: 1,
    });
    expect(keyAChain1).not.toBe(keyBChain1);

    const keyAChain2 = cryptoUtils.__test.buildDecryptEnvelopeCacheKey({
      ...base,
      account: '0x00000000000000000000000000000000000000aa',
      chainId: 2,
    });
    expect(keyAChain1).not.toBe(keyAChain2);
  });

  it('expires successful decrypt cache entries after the session-sized TTL', async () => {
    const providerEncrypt = makeProvider(SIG_A);
    const providerDecrypt = makeProvider(SIG_A);
    const questionPool = [{ id: 'q1', type: 'freeform' }];
    const surveyState = {
      answers: {
        q1: { encrypted: true, value: 'cached once' },
      },
      additionalComments: {},
      importance: {},
    };
    const nowSpy = jest.spyOn(Date, 'now');

    try {
      nowSpy.mockReturnValue(1_000);
      const encrypted = await cryptoUtils.encryptMultipleAnswers(surveyState, {
        providerKind: providerEncrypt,
        account: ACCOUNT,
        chainId: CHAIN_ID,
        surveyId: SURVEY_ID,
        questionPool,
      });

      await cryptoUtils.decryptMultipleAnswers(encrypted, questionPool, {
        provider: providerDecrypt,
        account: ACCOUNT,
        chainId: CHAIN_ID,
        surveyId: SURVEY_ID,
      });

      const signCallsAfterFirstDecrypt = providerDecrypt.request.mock.calls.filter(
        ([payload]) => payload?.method === 'eth_signTypedData_v4',
      ).length;
      expect(signCallsAfterFirstDecrypt).toBe(1);

      nowSpy.mockReturnValue(1_000 + 1000 * 60 * 10 + 1);
      await cryptoUtils.decryptMultipleAnswers(encrypted, questionPool, {
        provider: providerDecrypt,
        account: ACCOUNT,
        chainId: CHAIN_ID,
        surveyId: SURVEY_ID,
      });

      const signCallsAfterSecondDecrypt = providerDecrypt.request.mock.calls.filter(
        ([payload]) => payload?.method === 'eth_signTypedData_v4',
      ).length;
      expect(signCallsAfterSecondDecrypt).toBe(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('rejects decrypted envelopes transplanted to a different question id', async () => {
    const provider = makeProvider(SIG_A);
    const questionPool = [
      { id: 'q1', type: 'freeform' },
      { id: 'q2', type: 'freeform' },
    ];
    const surveyState = {
      answers: {
        q1: { encrypted: true, value: 'bound-to-q1' },
      },
      additionalComments: {},
      importance: {},
    };

    const encrypted = await cryptoUtils.encryptMultipleAnswers(surveyState, {
      providerKind: provider,
      account: ACCOUNT,
      chainId: CHAIN_ID,
      surveyId: SURVEY_ID,
      questionPool,
    });

    const transplanted = {
      answers: {
        q2: { ...encrypted.answers.q1 },
      },
      additionalComments: {},
      importance: {},
    };

    await expect(
      cryptoUtils.decryptMultipleAnswers(transplanted, questionPool, {
        provider,
        account: ACCOUNT,
        chainId: CHAIN_ID,
        surveyId: SURVEY_ID,
        throwOnError: true,
      }),
    ).rejects.toThrow('Encrypted payload is bound to a different survey field.');
  });

  it('rejects decrypted envelopes when the caller expects a different survey id', async () => {
    const provider = makeProvider(SIG_A);
    const questionPool = [{ id: 'q1', type: 'freeform' }];
    const surveyState = {
      answers: {
        q1: { encrypted: true, value: 'bound-to-survey' },
      },
      additionalComments: {},
      importance: {},
    };

    const encrypted = await cryptoUtils.encryptMultipleAnswers(surveyState, {
      providerKind: provider,
      account: ACCOUNT,
      chainId: CHAIN_ID,
      surveyId: SURVEY_ID,
      questionPool,
    });

    await expect(
      cryptoUtils.decryptSingleField(encrypted, 'q1', 'answer', {
        provider,
        account: ACCOUNT,
        chainId: CHAIN_ID,
        surveyId: OTHER_SURVEY_ID,
        throwOnError: true,
      }),
    ).rejects.toThrow('Encrypted payload is bound to a different survey field.');
  });

  it('rejects decrypted envelopes transplanted between answer and additional fields', async () => {
    const provider = makeProvider(SIG_A);
    const questionPool = [{ id: 'q1', type: 'freeform' }];
    const surveyState = {
      answers: {
        q1: { encrypted: true, value: 'bound answer' },
      },
      additionalComments: {
        q1: { encrypted: true, value: 'bound additional' },
      },
      importance: {},
    };

    const encrypted = await cryptoUtils.encryptMultipleAnswers(surveyState, {
      providerKind: provider,
      account: ACCOUNT,
      chainId: CHAIN_ID,
      surveyId: SURVEY_ID,
      questionPool,
    });

    await expect(
      cryptoUtils.decryptSingleField(
        {
          answers: {},
          additionalComments: {
            q1: { ...encrypted.answers.q1 },
          },
          importance: {},
        },
        'q1',
        'additional',
        {
          provider,
          account: ACCOUNT,
          chainId: CHAIN_ID,
          surveyId: SURVEY_ID,
          throwOnError: true,
        },
      ),
    ).rejects.toThrow('Encrypted payload is bound to a different survey field.');

    await expect(
      cryptoUtils.decryptSingleField(
        {
          answers: {
            q1: { ...encrypted.additionalComments.q1 },
          },
          additionalComments: {},
          importance: {},
        },
        'q1',
        'answer',
        {
          provider,
          account: ACCOUNT,
          chainId: CHAIN_ID,
          surveyId: SURVEY_ID,
          throwOnError: true,
        },
      ),
    ).rejects.toThrow('Encrypted payload is bound to a different survey field.');
  });
});
