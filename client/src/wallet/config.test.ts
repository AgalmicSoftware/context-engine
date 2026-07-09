import { isRpIdAllowedForOrigin, validatePasskeyWalletConfig } from './config.js';
import type { PasskeyWalletConfig } from './types.js';

const baseConfig = (overrides: Partial<PasskeyWalletConfig> = {}): PasskeyWalletConfig => ({
  rpId: 'example.com',
  rpName: 'Example',
  appOrigin: 'https://app.example.com',
  accountOrigin: 'https://account.example.com',
  walletMode: 'passkey-eoa',
  walletKeyMode: 'passkey-derived',
  sessionMode: 'soft',
  unlockTtlSeconds: 900,
  allowPreviewRpId: false,
  storageMode: 'indexeddb',
  derivationNamespace: 'Context Engine',
  ...overrides,
});

describe('passkey wallet config', () => {
  it('allows an RP ID that is a parent domain of app/account origins', () => {
    expect(isRpIdAllowedForOrigin('example.com', 'https://app.example.com')).toBe(true);
    expect(validatePasskeyWalletConfig(baseConfig()).rpId).toBe('example.com');
    expect(validatePasskeyWalletConfig(baseConfig()).derivationNamespace).toBe('context-engine');
  });

  it('allows localhost RP IDs for loopback development origins', () => {
    expect(isRpIdAllowedForOrigin('localhost', 'http://127.0.0.1:3000')).toBe(true);
    expect(
      validatePasskeyWalletConfig(
        baseConfig({
          rpId: 'localhost',
          appOrigin: 'http://127.0.0.1:3000',
          accountOrigin: 'http://localhost:3000',
        }),
      ).rpId,
    ).toBe('localhost');
  });

  it('rejects third-party wallet RP IDs and preview domains by default', () => {
    expect(() => validatePasskeyWalletConfig(baseConfig({ rpId: 'id.porto.sh' }))).toThrow(
      /third-party wallet domain/i,
    );
    expect(() =>
      validatePasskeyWalletConfig(
        baseConfig({
          rpId: 'preview.pages.dev',
          appOrigin: 'https://preview.pages.dev',
          accountOrigin: 'https://preview.pages.dev',
        }),
      ),
    ).toThrow(/preview domain/i);
  });

  it('rejects invalid wallet, key, and session modes instead of coercing them', () => {
    expect(() =>
      validatePasskeyWalletConfig(
        baseConfig({
          walletMode: 'porto' as unknown as PasskeyWalletConfig['walletMode'],
        }),
      ),
    ).toThrow(/unsupported passkey wallet mode/i);
    expect(() =>
      validatePasskeyWalletConfig(
        baseConfig({
          walletKeyMode: 'plaintext' as unknown as PasskeyWalletConfig['walletKeyMode'],
        }),
      ),
    ).toThrow(/unsupported passkey wallet key mode/i);
    expect(() =>
      validatePasskeyWalletConfig(
        baseConfig({
          sessionMode: 'relay' as unknown as PasskeyWalletConfig['sessionMode'],
        }),
      ),
    ).toThrow(/unsupported passkey wallet session mode/i);
  });
});
