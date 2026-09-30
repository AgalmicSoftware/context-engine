import { webcrypto } from 'crypto';
import { ethers } from 'ethers';
import { cryptoUtils } from './cryptography';
import { unwrapWorkerResponseFieldKey, wrapWorkerResponseFieldKey } from './workerResponseFieldKeys';

jest.mock('./workerResponseFieldKeys', () => ({
  wrapWorkerResponseFieldKey: jest.fn(),
  unwrapWorkerResponseFieldKey: jest.fn(),
}));
const owner = new ethers.Wallet(`0x${'61'.repeat(32)}`);
const admin = new ethers.Wallet(`0x${'62'.repeat(32)}`);
const signer = (wallet: ethers.Wallet, calls: string[] = []) => ({
  request: async ({ method, params }: { method: string; params: string[] }) => {
    calls.push(method);
    if (method === 'eth_chainId') return '0xaa37dc';
    if (method === 'eth_accounts') return [wallet.address];
    const { domain, types, message } = JSON.parse(params[1]);
    delete types.EIP712Domain;
    return wallet._signTypedData(domain, types, message);
  },
});
const config = {
  sessionId: 'example-id',
  responseFieldEncryption: { version: 1 },
  sessionModeProfile: {
    authority: { mode: 'worker_canonical' },
    storage: { backend: 'cloudflare' },
    encryption: { mode: 'worker_envelope' },
  },
  storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'role_gate', encryption: 'worker_envelope' } },
};
const workerContext = { sessionSlug: 'example', sessionConfig: config };
beforeAll(() => {
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
});
beforeEach(() => {
  jest.resetAllMocks();
});

it.each(['self_admin', 'session', 'optional'])(
  'encrypts and decrypts a %s field through its Worker recipient',
  async (variant) => {
    const audience = variant === 'optional' ? 'self_admin' : variant;
    const activeConfig =
      variant === 'optional'
        ? {
            ...config,
            responseFieldEncryption: { mode: 'optional', version: 1 },
            sessionModeProfile: { ...config.sessionModeProfile, encryption: { mode: 'none' } },
            storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
          }
        : config;
    const workerContext = { sessionSlug: 'example', sessionConfig: activeConfig };
    let wrappedKey: Uint8Array;
    jest.mocked(wrapWorkerResponseFieldKey).mockImplementation(async (key, choice, context) => {
      wrappedKey = new Uint8Array(key);
      return {
        type: 'worker-response-field-v1',
        policy: {
          audience: choice,
          context,
          sessionSlug: 'example',
          sessionId: config.sessionId,
          owner: owner.address.toLowerCase(),
        },
        wrapped: { fixture: 'ciphertext' },
      };
    });
    jest.mocked(unwrapWorkerResponseFieldKey).mockImplementation(async () => new Uint8Array(wrappedKey));
    const encrypted = await cryptoUtils.encryptMultipleAnswers(
      { answers: { q1: { value: 'private field', encrypted: true, encryptionAudience: audience } } },
      {
        ...workerContext,
        provider: signer(owner),
        account: owner.address,
        surveyId: `0x${'ab'.repeat(32)}`,
        questionPool: [{ id: 'q1', type: 'freeform' }],
      },
    );
    const envelope = encrypted.answers.q1.encryptedPortion as string;
    expect(JSON.parse(envelope).recipients.map((r: { type: string }) => r.type)).toEqual([
      'self-eip712-v1',
      'worker-response-field-v1',
    ]);
    expect(envelope).not.toContain('private field');
    expect(encrypted.answers.q1.value).toBe('*');
    const readOpts = { ...workerContext, providerLike: signer(admin), account: admin.address };
    await expect(cryptoUtils.decryptEnvelopeValue(envelope, readOpts)).resolves.toBe('private field');
    expect(unwrapWorkerResponseFieldKey).toHaveBeenCalledWith(
      expect.objectContaining({ policy: expect.objectContaining({ audience }) }),
      expect.any(String),
      expect.objectContaining(workerContext),
    );
    // No decrypt-cache bypass after the Worker revokes this principal's access.
    jest.mocked(unwrapWorkerResponseFieldKey).mockRejectedValue(new Error('Access denied'));
    await expect(cryptoUtils.decryptEnvelopeValue(envelope, readOpts)).rejects.toThrow('Access denied');
    // The author still has an independent self recipient.
    await expect(
      cryptoUtils.decryptEnvelopeValue(envelope, {
        ...workerContext,
        providerLike: signer(owner),
        account: owner.address,
      }),
    ).resolves.toBe('private field');
  },
);

it('fails the encryption operation if the requested Worker recipient cannot be created', async () => {
  jest.mocked(wrapWorkerResponseFieldKey).mockRejectedValue(new Error('Worker unavailable'));
  await expect(
    cryptoUtils.encryptMultipleAnswers(
      { answers: { q1: { value: 'private', encrypted: true, encryptionAudience: 'self_admin' } } },
      {
        ...workerContext,
        provider: signer(owner),
        account: owner.address,
        questionPool: [{ id: 'q1', type: 'freeform' }],
      },
    ),
  ).rejects.toThrow('Worker unavailable');
});

it('optional public mode preserves public fields and self-only excludes Worker and admins', async () => {
  const sessionConfig = {
    ...config,
    responseFieldEncryption: { mode: 'optional', version: 1 },
    sessionModeProfile: { ...config.sessionModeProfile, encryption: { mode: 'none' } },
    storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
  };
  const encrypted = await cryptoUtils.encryptMultipleAnswers(
    {
      answers: {
        q1: { value: 'visible answer', encrypted: false },
        q2: { value: 'my private answer', encrypted: true, encryptionAudience: 'self' },
      },
    },
    {
      sessionSlug: 'example',
      sessionConfig,
      provider: signer(owner),
      account: owner.address,
      questionPool: [
        { id: 'q1', type: 'freeform' },
        { id: 'q2', type: 'freeform' },
      ],
    },
  );
  // Encryption returns only changed fields; public values stay in the caller's payload.
  expect(encrypted.answers.q1).toBeUndefined();
  const envelope = encrypted.answers.q2.encryptedPortion as string;
  expect(JSON.parse(envelope).recipients.map((r: { type: string }) => r.type)).toEqual(['self-eip712-v1']);
  expect(wrapWorkerResponseFieldKey).not.toHaveBeenCalled();
  await expect(
    cryptoUtils.decryptEnvelopeValue(envelope, {
      sessionSlug: 'example',
      sessionConfig,
      providerLike: signer(admin),
      account: admin.address,
    }),
  ).rejects.toThrow();
  await expect(
    cryptoUtils.decryptEnvelopeValue(envelope, {
      sessionSlug: 'example',
      sessionConfig,
      providerLike: signer(owner),
      account: owner.address,
    }),
  ).resolves.toBe('my private answer');
});

it.each(['admin', 'owner'])('only the %s field reader uses their applicable key recipient', async (reader) => {
  let cek = new Uint8Array();
  jest.mocked(wrapWorkerResponseFieldKey).mockImplementation(async (key, audience, context) => {
    cek = new Uint8Array(key);
    return {
      type: 'worker-response-field-v1',
      policy: {
        audience,
        context,
        sessionSlug: 'example',
        sessionId: config.sessionId,
        owner: owner.address.toLowerCase(),
      },
      wrapped: { fixture: 'ciphertext' },
    };
  });
  jest.mocked(unwrapWorkerResponseFieldKey).mockImplementation(async () => new Uint8Array(cek));
  const encrypted = await cryptoUtils.encryptMultipleAnswers(
    { answers: { q1: { value: 'reader fixture', encrypted: true, encryptionAudience: 'self_admin' } } },
    {
      ...workerContext,
      provider: signer(owner),
      account: owner.address,
      questionPool: [{ id: 'q1', type: 'freeform' }],
    },
  );
  const calls: string[] = [];
  const wallet = reader === 'owner' ? owner : admin;
  await expect(
    cryptoUtils.decryptEnvelopeValue(encrypted.answers.q1.encryptedPortion as string, {
      ...workerContext,
      providerLike: signer(wallet, calls),
      account: wallet.address,
    }),
  ).resolves.toBe('reader fixture');
  expect(calls.filter((method) => method === 'eth_signTypedData_v4')).toHaveLength(reader === 'owner' ? 1 : 0);
  expect(unwrapWorkerResponseFieldKey).toHaveBeenCalledTimes(reader === 'owner' ? 0 : 1);
});
