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
});
