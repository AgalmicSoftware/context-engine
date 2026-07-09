import { webcrypto } from 'crypto';
import { cryptoUtils } from './cryptography.js';
import { buildSbtAccessControlConditions } from './litProtocol.js';

const ACCOUNT = '0x00000000000000000000000000000000000000aa';
const CHAIN_ID = 84532;
const SURVEY_ID = `0x${'12'.repeat(32)}`;
const SIG_A = `0x${'11'.repeat(65)}`;
const SIG_B = `0x${'22'.repeat(65)}`;
const GATE_A = '0x0000000000000000000000000000000000000101';
const GATE_B = '0x0000000000000000000000000000000000000102';

const makeProvider = (signatureHex) => ({
  request: jest.fn(async ({ method }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [ACCOUNT];
    if (method === 'eth_chainId') return '0x14a34';
    if (method === 'eth_signTypedData_v4') return signatureHex;
    throw new Error(`Unexpected wallet method: ${method}`);
  }),
});

const makeRejectingSignerProvider = () => ({
  request: jest.fn(async ({ method }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [ACCOUNT];
    if (method === 'eth_chainId') return '0x14a34';
    if (method === 'eth_signTypedData_v4') throw new Error('user rejected signing');
    throw new Error(`Unexpected wallet method: ${method}`);
  }),
});

const makeEnvelopeJson = async (overrides = {}) => {
  const envelopeJson = await cryptoUtils.encryptEnvelopeValue('secret-value', {
    providerKind: makeProvider(SIG_A),
    account: ACCOUNT,
    chainId: CHAIN_ID,
    surveyId: SURVEY_ID,
    qId: 'q-envelope-validation',
  });
  const envelope = JSON.parse(envelopeJson);
  return JSON.stringify({
    ...envelope,
    ...overrides,
  });
};

describe('cryptoUtils Lit multi-gate envelopes', () => {
  let infoSpy;
  let errorSpy;

  beforeAll(() => {
    if (typeof window !== 'undefined' && (!window.crypto || !window.crypto.subtle)) {
      Object.defineProperty(window, 'crypto', {
        value: webcrypto,
        configurable: true,
      });
    }
  });

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('treats numeric gate mode=1 as AND in Lit access control conditions', () => {
    const acc = buildSbtAccessControlConditions({
      sbtAddresses: [GATE_A, GATE_B],
      chainId: CHAIN_ID,
      litChain: 'baseSepolia',
      mode: 1,
    });
    expect(Array.isArray(acc)).toBe(true);
    expect(acc).toHaveLength(3);
    expect(acc[1]).toEqual({ operator: 'and' });
  });

  it('encrypts/decrypts question results across multiple Lit gate recipients', async () => {
    const providerEncrypt = makeProvider(SIG_A);
    const providerDecrypt = makeProvider(SIG_B);
    const questionPool = [{ id: 'q1', type: 'binary' }];
    const surveyState = {
      answers: {
        q1: { encrypted: true, value: 'Agree' },
      },
      additionalComments: {
        q1: { encrypted: true, value: 'because reasons' },
      },
      importance: { q1: 3 },
    };
    const recipientA = {
      accessControlConditions: buildSbtAccessControlConditions({
        sbtAddresses: [GATE_A],
        chainId: CHAIN_ID,
        litChain: 'baseSepolia',
        mode: 'any',
      }),
      chain: 'baseSepolia',
    };
    const recipientB = {
      accessControlConditions: buildSbtAccessControlConditions({
        sbtAddresses: [GATE_B],
        chainId: CHAIN_ID,
        litChain: 'baseSepolia',
        mode: 'any',
      }),
      chain: 'baseSepolia',
    };

    const cekByCiphertext = new Map();
    let saveCounter = 0;
    const saveKey = jest.fn(async (cekRaw) => {
      saveCounter += 1;
      const ciphertext = `cipher-${saveCounter}`;
      cekByCiphertext.set(ciphertext, new Uint8Array(cekRaw));
      return {
        ciphertext,
        dataToEncryptHash: `hash-${saveCounter}`,
      };
    });

    const encrypted = await cryptoUtils.encryptMultipleAnswers(surveyState, {
      providerKind: providerEncrypt,
      account: ACCOUNT,
      chainId: CHAIN_ID,
      surveyId: SURVEY_ID,
      questionPool,
      lit: {
        saveKey,
        recipients: [recipientA, recipientB],
      },
    });

    expect(encrypted.answers.q1.value).toBe('*');
    expect(encrypted.additionalComments.q1.value).toBe('*');
    expect(saveKey).toHaveBeenCalledTimes(4);

    const answerEnv = JSON.parse(encrypted.answers.q1.encryptedPortion);
    const commentEnv = JSON.parse(encrypted.additionalComments.q1.encryptedPortion);
    const answerLitRecipients = answerEnv.recipients.filter((entry) => entry.type === 'lit-sbt-v1');
    const commentLitRecipients = commentEnv.recipients.filter((entry) => entry.type === 'lit-sbt-v1');

    expect(answerLitRecipients).toHaveLength(2);
    expect(commentLitRecipients).toHaveLength(2);
    [...answerLitRecipients, ...commentLitRecipients].forEach((entry) => {
      expect(typeof entry?.lit?.ciphertext).toBe('string');
      expect(typeof entry?.lit?.dataToEncryptHash).toBe('string');
      expect(entry?.lit?.encryptedSymmetricKey).toBeUndefined();
      expect(entry?.lit?.chain).toBe('baseSepolia');
      expect(Array.isArray(entry?.lit?.accessControlConditions)).toBe(true);
    });

    const firstGateCiphertexts = new Set([
      answerLitRecipients[0].lit.ciphertext,
      commentLitRecipients[0].lit.ciphertext,
    ]);
    const getKey = jest.fn(async ({ ciphertext }) => {
      if (firstGateCiphertexts.has(ciphertext)) {
        throw new Error('first gate denied');
      }
      const key = cekByCiphertext.get(ciphertext);
      if (!key) throw new Error('missing CEK');
      return key;
    });

    const decrypted = await cryptoUtils.decryptMultipleAnswers(encrypted, questionPool, {
      provider: providerDecrypt,
      account: ACCOUNT,
      chainId: CHAIN_ID,
      surveyId: SURVEY_ID,
      lit: { getKey },
    });

    expect(decrypted.answers.q1.value).toBe('Agree');
    expect(decrypted.additionalComments.q1.value).toBe('because reasons');
    expect(getKey).toHaveBeenCalledTimes(4);
  });

  it('falls back to Lit recipients when self-recipient signing fails', async () => {
    const providerEncrypt = makeProvider(SIG_A);
    const providerDecrypt = makeRejectingSignerProvider();
    const questionPool = [{ id: 'q1', type: 'freeform' }];
    const surveyState = {
      answers: {
        q1: { encrypted: true, value: 'Lit fallback secret' },
      },
      additionalComments: {},
      importance: {},
    };
    const recipient = {
      accessControlConditions: buildSbtAccessControlConditions({
        sbtAddresses: [GATE_A],
        chainId: CHAIN_ID,
        litChain: 'baseSepolia',
        mode: 'any',
      }),
      chain: 'baseSepolia',
    };

    const cekByCiphertext = new Map();
    let saveCounter = 0;
    const saveKey = jest.fn(async (cekRaw) => {
      saveCounter += 1;
      const ciphertext = `fallback-cipher-${saveCounter}`;
      cekByCiphertext.set(ciphertext, new Uint8Array(cekRaw));
      return {
        ciphertext,
        dataToEncryptHash: `fallback-hash-${saveCounter}`,
      };
    });

    const encrypted = await cryptoUtils.encryptMultipleAnswers(surveyState, {
      providerKind: providerEncrypt,
      account: ACCOUNT,
      chainId: CHAIN_ID,
      surveyId: SURVEY_ID,
      questionPool,
      lit: {
        saveKey,
        recipients: [recipient],
      },
    });

    const answerEnv = JSON.parse(encrypted.answers.q1.encryptedPortion);
    const litEntry = answerEnv.recipients.find((entry) => entry.type === 'lit-sbt-v1');
    const getKey = jest.fn(async ({ ciphertext }) => {
      const key = cekByCiphertext.get(ciphertext);
      if (!key) throw new Error('missing CEK');
      return key;
    });

    const decrypted = await cryptoUtils.decryptMultipleAnswers(encrypted, questionPool, {
      provider: providerDecrypt,
      account: ACCOUNT,
      chainId: CHAIN_ID,
      surveyId: SURVEY_ID,
      lit: { getKey },
    });

    expect(litEntry?.lit?.ciphertext).toBeTruthy();
    expect(decrypted.answers.q1.value).toBe('Lit fallback secret');
    expect(getKey).toHaveBeenCalledTimes(1);
  });

  it('can prefer Lit recipients without first asking the self signer', async () => {
    const providerEncrypt = makeProvider(SIG_A);
    const providerDecrypt = makeProvider(SIG_B);
    const cekByCiphertext = new Map();
    const saveKey = jest.fn(async (cekRaw) => {
      const ciphertext = 'preferred-lit-cipher';
      cekByCiphertext.set(ciphertext, new Uint8Array(cekRaw));
      return {
        ciphertext,
        dataToEncryptHash: 'preferred-lit-hash',
      };
    });
    const envelopeJson = await cryptoUtils.encryptEnvelopeValue('Lit-first secret', {
      providerKind: providerEncrypt,
      account: ACCOUNT,
      chainId: CHAIN_ID,
      surveyId: SURVEY_ID,
      qId: 'q-lit-first',
      lit: {
        saveKey,
        recipients: [
          {
            accessControlConditions: buildSbtAccessControlConditions({
              sbtAddresses: [GATE_A],
              chainId: CHAIN_ID,
              litChain: 'baseSepolia',
              mode: 'any',
            }),
            chain: 'baseSepolia',
          },
        ],
      },
    });
    const getKey = jest.fn(async ({ ciphertext }) => {
      const key = cekByCiphertext.get(ciphertext);
      if (!key) throw new Error('missing CEK');
      return key;
    });

    const value = await cryptoUtils.decryptEnvelopeValue(envelopeJson, {
      providerLike: providerDecrypt,
      account: ACCOUNT,
      chainId: CHAIN_ID,
      litOpts: { getKey },
      preferLitRecipients: true,
    });

    expect(value).toBe('Lit-first secret');
    expect(getKey).toHaveBeenCalledTimes(1);
    expect(providerDecrypt.request.mock.calls.some(([req]) => req?.method === 'eth_signTypedData_v4')).toBe(false);
  });

  it('rejects envelopes with a non-12-byte IV', async () => {
    const envelopeJson = await makeEnvelopeJson({ iv: 'AQIDBAUGBwg=' });

    await expect(cryptoUtils.decryptEnvelopeValue(envelopeJson)).rejects.toThrow(
      'Envelope IV must be exactly 12 bytes (got 8).',
    );
  });

  it('rejects envelopes with empty ciphertext after decode', async () => {
    const envelopeJson = await makeEnvelopeJson({ ciphertext: '====' });

    await expect(cryptoUtils.decryptEnvelopeValue(envelopeJson)).rejects.toThrow(
      'Envelope ciphertext is empty after decode.',
    );
  });

  it('rejects recipients missing required fields', async () => {
    const baseEnvelope = JSON.parse(await makeEnvelopeJson());
    const litEnvelope = {
      ...baseEnvelope,
      recipients: [{ type: 'lit-sbt-v1', lit: {} }],
    };

    await expect(cryptoUtils.decryptEnvelopeValue(JSON.stringify(litEnvelope))).rejects.toThrow(
      'Lit recipient missing ciphertext or encryptedSymmetricKey.',
    );

    const selfEnvelope = {
      ...baseEnvelope,
      recipients: [{ type: 'self-eip712-v1', wrapped_cek: baseEnvelope.recipients[0].wrapped_cek }],
    };

    await expect(cryptoUtils.decryptEnvelopeValue(JSON.stringify(selfEnvelope))).rejects.toThrow(
      'Self-EIP712 recipient missing wrap_iv or wrapped_cek.',
    );
  });

  it('parses encryptedSymmetricKey-only Lit recipients while decrypting through self recipients', async () => {
    const providerDecrypt = makeProvider(SIG_A);
    const baseEnvelope = JSON.parse(await makeEnvelopeJson());
    const litEnvelope = {
      ...baseEnvelope,
      recipients: [
        ...baseEnvelope.recipients,
        {
          type: 'lit-sbt-v1',
          lit: {
            encryptedSymmetricKey: 'lit-symmetric-key',
            chain: 'baseSepolia',
          },
        },
      ],
    };
    const getKey = jest.fn();

    const value = await cryptoUtils.decryptEnvelopeValue(JSON.stringify(litEnvelope), {
      providerLike: providerDecrypt,
      account: ACCOUNT,
      chainId: CHAIN_ID,
      litOpts: { getKey },
    });

    expect(value).toBe('secret-value');
    expect(getKey).not.toHaveBeenCalled();
  });

  it('rejects malformed commitment hashes', async () => {
    const envelopeJson = await makeEnvelopeJson({
      commitments: {
        keccak256: '0x1234',
      },
    });

    await expect(cryptoUtils.decryptEnvelopeValue(envelopeJson)).rejects.toThrow(
      'Envelope keccak256 commitment has invalid format.',
    );
  });
});
