import { createPasskeyCredential, formatPasskeyCredentialUserName } from './createCredential.js';
import type { PasskeyCredentialClient, PasskeyWalletConfig } from '../types.js';

const config: PasskeyWalletConfig = {
  rpId: 'contextengine.sh',
  rpName: 'Context Engine',
  appOrigin: 'https://contextengine.sh',
  accountOrigin: 'https://contextengine.sh',
  walletMode: 'passkey-eoa',
  walletKeyMode: 'passkey-derived',
  sessionMode: 'soft',
  unlockTtlSeconds: 60,
  allowPreviewRpId: false,
  storageMode: 'indexeddb',
  derivationNamespace: 'context-engine',
};

describe('formatPasskeyCredentialUserName', () => {
  it('uses the legacy human-readable passkey display format', () => {
    expect(formatPasskeyCredentialUserName(new Date(2026, 6, 2, 22, 3))).toBe('ContextEngine-July2-2026-1003PM');
  });
});

describe('createPasskeyCredential', () => {
  beforeEach(() => {
    (globalThis as any).PublicKeyCredential = function PublicKeyCredential() {};
  });

  afterEach(() => {
    delete (globalThis as any).PublicKeyCredential;
  });

  it('advertises both WebAuthn default algorithms for platform compatibility', async () => {
    const credential = {
      rawId: new Uint8Array([1, 2, 3]).buffer,
      getClientExtensionResults: () => ({ prf: { enabled: true } }),
    } as unknown as PublicKeyCredential;
    const credentials: PasskeyCredentialClient = {
      create: jest.fn(async () => credential),
      get: jest.fn(),
    };

    await createPasskeyCredential({
      config,
      salt: new Uint8Array(32),
      credentials,
    });

    expect(credentials.create).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: expect.objectContaining({
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
        }),
      }),
    );
  });
  const makeCredentials = (create: PasskeyCredentialClient['create']): PasskeyCredentialClient => ({
    create: jest.fn(create),
    get: jest.fn(),
  });
  const prfCredential = {
    rawId: new Uint8Array([1, 2, 3]).buffer,
    getClientExtensionResults: () => ({ prf: { enabled: true } }),
  } as unknown as PublicKeyCredential;
  const createdUser = (credentials: PasskeyCredentialClient, call: number) =>
    (credentials.create as jest.Mock).mock.calls[call][0].publicKey.user;

  it('gives every passkey its own random 32-byte user handle', async () => {
    const credentials = makeCredentials(async () => prfCredential);

    await createPasskeyCredential({ config, salt: new Uint8Array(32), credentials });
    await createPasskeyCredential({ config, salt: new Uint8Array(32), credentials });

    const [first, second] = [createdUser(credentials, 0), createdUser(credentials, 1)];
    expect(first.id).toHaveLength(32);
    expect(second.id).toHaveLength(32);
    expect(Buffer.from(first.id).equals(Buffer.from(second.id))).toBe(false);
    expect(first.name).toBe(second.name);
    expect((credentials.create as jest.Mock).mock.calls[0][0].publicKey).not.toHaveProperty('excludeCredentials');
  });

  it('excludes saved passkeys and explains when the device already holds one', async () => {
    const credentials = makeCredentials(async () => {
      throw Object.assign(new Error('credential excluded'), { name: 'InvalidStateError' });
    });

    await expect(
      createPasskeyCredential({ config, salt: new Uint8Array(32), credentials, excludeCredentialIds: ['AQID'] }),
    ).rejects.toThrow(/already holds the passkey.*Use Login/);
    const { excludeCredentials } = (credentials.create as jest.Mock).mock.calls[0][0].publicKey;
    expect(excludeCredentials).toEqual([{ id: expect.any(ArrayBuffer), type: 'public-key' }]);
    expect([...new Uint8Array(excludeCredentials[0].id)]).toEqual([1, 2, 3]);
  });
});
