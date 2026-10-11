import { webcrypto } from 'crypto';
import { ethers } from 'ethers';
import { clearDecryptCaches, cryptoUtils } from './cryptography.js';

const SIG_A = new ethers.Wallet(`0x${'11'.repeat(32)}`);
const ACCOUNT = SIG_A.address;
const CHAIN_ID = 84532;
const SURVEY_ID = `0x${'34'.repeat(32)}`;
const OTHER_SURVEY_ID = `0x${'56'.repeat(32)}`;

const makeProvider = (wallet) => ({
  request: jest.fn(async ({ method, params }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [ACCOUNT];
    if (method === 'eth_chainId') return '0x14a34';
    if (method === 'eth_signTypedData_v4') {
      const { domain, types, message } = JSON.parse(params[1]);
      delete types.EIP712Domain;
      return wallet._signTypedData(domain, types, message);
    }
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
    ).rejects.toThrow(/envelope binding mismatch/);
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
    ).rejects.toThrow(/envelope binding mismatch/);
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
    ).rejects.toThrow(/envelope binding mismatch/);

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
    ).rejects.toThrow(/envelope binding mismatch/);
  });
});

it('checks the expected survey and question bindings on envelope values', async () => {
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  const provider = makeProvider(SIG_A);
  const envelope = await cryptoUtils.encryptEnvelopeValue(4, {
    providerKind: provider,
    account: ACCOUNT,
    chainId: CHAIN_ID,
    surveyId: SURVEY_ID,
    kind: 'rating',
    qId: 'importance:q1',
  });
  const decrypt = (binding) =>
    cryptoUtils.decryptEnvelopeValue(envelope, {
      providerLike: provider,
      account: ACCOUNT,
      chainId: CHAIN_ID,
      ...binding,
    });

  await expect(decrypt({ expectedQId: 'conviction:q1' })).rejects.toThrow(/envelope binding mismatch/);
  await expect(decrypt({ expectedQId: 'importance:q2' })).rejects.toThrow(/envelope binding mismatch/);
  await expect(decrypt({ expectedSurveyId: OTHER_SURVEY_ID })).rejects.toThrow(/envelope binding mismatch/);
  await expect(decrypt({ expectedQId: 'IMPORTANCE:Q1', expectedSurveyId: SURVEY_ID })).resolves.toBe(4);
});

it('drops cached plaintext, including decrypts still in flight, when caches are cleared', async () => {
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  const provider = makeProvider(SIG_A);
  const envelope = await cryptoUtils.encryptEnvelopeValue('cached secret', {
    providerKind: provider,
    account: ACCOUNT,
    chainId: CHAIN_ID,
    qId: 'cache-clear',
  });
  const decrypt = () => cryptoUtils.decryptEnvelopeValue(envelope, { providerLike: provider, account: ACCOUNT });
  const signCount = () =>
    provider.request.mock.calls.filter(([payload]) => payload?.method === 'eth_signTypedData_v4').length;
  const signsBeforeDecrypt = signCount();

  await expect(decrypt()).resolves.toBe('cached secret');
  await expect(decrypt()).resolves.toBe('cached secret');
  expect(signCount() - signsBeforeDecrypt).toBe(1);

  clearDecryptCaches();
  await expect(decrypt()).resolves.toBe('cached secret');
  expect(signCount() - signsBeforeDecrypt).toBe(2);

  clearDecryptCaches();
  const inFlight = decrypt();
  clearDecryptCaches();
  await expect(inFlight).resolves.toBe('cached secret');
  await expect(decrypt()).resolves.toBe('cached secret');
  expect(signCount() - signsBeforeDecrypt).toBe(4);
});

it('round-trips signed quadratic allocations through self-encrypted response envelopes', async () => {
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  const provider = makeProvider(SIG_A);
  const questionPool = [{ id: 'quadratic-q', type: 'quadratic', options: ['Parks', 'Transit'], voiceCredits: 25 }];
  const source = { answers: { 'quadratic-q': { encrypted: true, value: [3, -4] } }, additionalComments: {} };
  const encrypted = await cryptoUtils.encryptMultipleAnswers(source, {
    providerKind: provider,
    account: ACCOUNT,
    chainId: CHAIN_ID,
    surveyId: SURVEY_ID,
    questionPool,
  });
  expect(encrypted.answers['quadratic-q'].value).toBe('*');
  expect(JSON.parse(encrypted.answers['quadratic-q'].encryptedPortion).meta.kind).toBe('quadratic');
  const decrypted = await cryptoUtils.decryptMultipleAnswers(encrypted, questionPool, {
    provider,
    account: ACCOUNT,
    chainId: CHAIN_ID,
    surveyId: SURVEY_ID,
  });
  expect(decrypted.answers['quadratic-q'].value).toEqual([3, -4]);
});

it('rejects overspent quadratic values before requesting an encryption signature', async () => {
  const provider = makeProvider(SIG_A);
  await expect(
    cryptoUtils.encryptMultipleAnswers(
      { answers: { q1: { value: [4, -4], encrypted: true } } },
      {
        providerKind: provider,
        account: ACCOUNT,
        chainId: CHAIN_ID,
        surveyId: SURVEY_ID,
        questionPool: [{ id: 'q1', type: 'quadratic', options: ['Parks', 'Transit'], voiceCredits: 25 }],
      },
    ),
  ).rejects.toThrow(/exceeds/);
  expect(provider.request.mock.calls.some(([payload]) => payload.method === 'eth_signTypedData_v4')).toBe(false);
});
