import { webcrypto } from 'crypto';
import { ethers } from 'ethers';
import { cryptoUtils } from './cryptography';

const wallet = new ethers.Wallet(`0x${'31'.repeat(32)}`);
const surveyId = `0x${'34'.repeat(32)}`;
const pool = [{ id: 'q1', type: 'freeform' }];
const provider = (chain: unknown = '0xaa37dc') => ({
  request: jest.fn(async ({ method, params }: { method: string; params: string[] }) => {
    if (method === 'eth_chainId') return chain;
    if (method === 'eth_accounts') return [wallet.address];
    if (method === 'eth_signTypedData_v4') {
      const { domain, types, message } = JSON.parse(params[1]);
      delete types.EIP712Domain;
      return wallet._signTypedData(domain, types, message);
    }
    throw new Error(`Unexpected request: ${method}`);
  }),
});

beforeAll(() => {
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
});

it('round-trips encrypted answers and comments without a registry chain, even after a wallet network change', async () => {
  const signer = provider();
  const opts = { provider: signer, account: wallet.address, chainId: null, surveyId, questionPool: pool };
  const encrypted = await cryptoUtils.encryptMultipleAnswers(
    {
      answers: { q1: { encrypted: true, value: 'Private answer' } },
      additionalComments: { q1: { encrypted: true, value: 'Private comment' } },
    },
    opts,
  );
  for (const field of [encrypted.answers.q1, encrypted.additionalComments.q1]) {
    const envelope = JSON.parse(field.encryptedPortion as string);
    expect(envelope.aad.chainId).toBe(11155420);
    expect(field.value).toBe('*');
    expect(field.encryptedPortion).not.toContain('Private');
  }
  const decrypted = await cryptoUtils.decryptMultipleAnswers(encrypted, pool, {
    ...opts,
    provider: provider('0x1'),
  });
  expect(decrypted.answers.q1.value).toBe('Private answer');
  expect(decrypted.additionalComments.q1.value).toBe('Private comment');
});

it.each(['garbage', '0xnothex', 0, -1, null])('fails closed for an invalid signer chain %s', async (chain) => {
  await expect(
    cryptoUtils.encryptMultipleAnswers(
      { answers: { q1: { encrypted: true, value: 'secret' } } },
      {
        provider: provider(chain),
        account: wallet.address,
        chainId: null,
        surveyId,
        questionPool: pool,
      },
    ),
  ).rejects.toThrow('Unable to determine chainId');
});

it('does not contact a wallet when there are no new encrypted values', async () => {
  const signer = provider();
  await cryptoUtils.encryptMultipleAnswers(
    { answers: { q1: { value: 'public', encrypted: false } } },
    {
      provider: signer,
      chainId: null,
    },
  );
  expect(signer.request).not.toHaveBeenCalled();
});

const workerConfig = {
  sessionId: 'example-id',
  responseFieldEncryption: { version: 1 },
  sessionModeProfile: {
    authority: { mode: 'worker_canonical' },
    storage: { backend: 'cloudflare' },
    encryption: { mode: 'worker_envelope' },
  },
  storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'worker_envelope' } },
};

it('Only me excludes both admin and Lit recipients even when Lit hooks are available', async () => {
  const saveKey = jest.fn();
  const encrypted = await cryptoUtils.encryptMultipleAnswers(
    { answers: { q1: { encrypted: true, encryptionAudience: 'self', value: 'submitter-only secret' } } },
    {
      provider: provider(),
      account: wallet.address,
      surveyId,
      questionPool: pool,
      sessionConfig: workerConfig,
      sessionSlug: 'example',
      lit: { saveKey },
    },
  );
  const envelope = encrypted.answers.q1.encryptedPortion as string;
  expect(JSON.parse(envelope).recipients.map((r: { type: string }) => r.type)).toEqual(['self-eip712-v1']);
  expect(saveKey).not.toHaveBeenCalled();
  const adminWallet = new ethers.Wallet(`0x${'32'.repeat(32)}`);
  const adminProvider = {
    request: async ({ method, params }: { method: string; params: string[] }) => {
      if (method === 'eth_signTypedData_v4') {
        const { domain, types, message } = JSON.parse(params[1]);
        delete types.EIP712Domain;
        return adminWallet._signTypedData(domain, types, message);
      }
      return method === 'eth_accounts' ? [adminWallet.address] : '0xaa37dc';
    },
  };
  await expect(
    cryptoUtils.decryptEnvelopeValue(envelope, {
      providerLike: adminProvider,
      account: adminWallet.address,
      sessionConfig: workerConfig,
      sessionSlug: 'example',
    }),
  ).rejects.toThrow();
  await expect(
    cryptoUtils.decryptEnvelopeValue(envelope, { providerLike: provider('0x1'), account: wallet.address, chainId: 1 }),
  ).resolves.toBe('submitter-only secret');
});

it('rejects new encryption before wallet signing when the session disables it', async () => {
  const signer = provider();
  await expect(
    cryptoUtils.encryptMultipleAnswers(
      { answers: { q1: { encrypted: true, encryptionAudience: 'self', value: 'secret' } } },
      {
        provider: signer,
        account: wallet.address,
        sessionConfig: {
          ...workerConfig,
          sessionModeProfile: { ...workerConfig.sessionModeProfile, encryption: { mode: 'none' } },
        },
      },
    ),
  ).rejects.toThrow('disabled');
  expect(signer.request).not.toHaveBeenCalled();
});

it('rejects Session members encryption on a public session', async () => {
  const signer = provider();
  await expect(
    cryptoUtils.encryptMultipleAnswers(
      { answers: { q1: { encrypted: true, encryptionAudience: 'session', value: 'secret' } } },
      { provider: signer, account: wallet.address, sessionConfig: workerConfig, sessionSlug: 'example' },
    ),
  ).rejects.toThrow('private session');
  expect(signer.request).not.toHaveBeenCalled();
});
