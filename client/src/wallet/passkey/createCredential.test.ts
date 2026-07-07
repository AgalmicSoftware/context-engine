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
