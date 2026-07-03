import { cryptoUtils } from './cryptography.js';

const mockCreatePasskeyProvider = jest.fn();

jest.mock('../../wallet/passkeyWallet.js', () => ({
  createPasskeyEip1193Provider: (...args) => mockCreatePasskeyProvider(...args),
}));

const setWindowProvider = (key, value) => {
  Object.defineProperty(window, key, {
    configurable: true,
    writable: true,
    value,
  });
};

describe('cryptoUtils passkey EOA provider bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePasskeyProvider.mockReset();
    try {
      delete window.__passkeyEoaProvider;
      delete window.__ceCreatePasskeyEip1193Provider;
      delete window.ethereum;
      delete window.web3authProvider;
    } catch (_) {
      window.__passkeyEoaProvider = undefined;
      window.__ceCreatePasskeyEip1193Provider = undefined;
      window.ethereum = undefined;
      window.web3authProvider = undefined;
    }
  });

  it('uses the Vite-safe passkey provider factory when one is registered on window', () => {
    const provider = {
      isPasskeyEoa: true,
      request: jest.fn(),
    };
    window.__ceCreatePasskeyEip1193Provider = jest.fn(() => provider);

    const resolved = cryptoUtils._getProvider('passkey_eoa');

    expect(resolved).toBe(provider);
    expect(window.__ceCreatePasskeyEip1193Provider).toHaveBeenCalledTimes(1);
    expect(mockCreatePasskeyProvider).not.toHaveBeenCalled();
    expect(window.__passkeyEoaProvider).toBe(provider);
  });

  it('synthesizes the passkey provider on demand for passkey_eoa strings', () => {
    const provider = {
      isPasskeyEoa: true,
      request: jest.fn(),
    };
    mockCreatePasskeyProvider.mockReturnValue(provider);

    const resolved = cryptoUtils._getProvider('passkey_eoa');

    expect(resolved).toBe(provider);
    expect(mockCreatePasskeyProvider).toHaveBeenCalledTimes(1);
    expect(window.__passkeyEoaProvider).toBe(provider);
  });

  it('reuses the seeded passkey provider when one is already present on window', () => {
    const seededProvider = {
      isPasskeyEoa: true,
      request: jest.fn(),
    };
    window.__passkeyEoaProvider = seededProvider;

    const resolved = cryptoUtils._getProvider('passkey_eoa');

    expect(resolved).toBe(seededProvider);
    expect(mockCreatePasskeyProvider).not.toHaveBeenCalled();
  });

  it('prefers the Web3Auth provider for web3auth strings when present', () => {
    const ethereumProvider = { request: jest.fn() };
    const web3authProvider = { request: jest.fn() };
    setWindowProvider('ethereum', ethereumProvider);
    setWindowProvider('web3authProvider', web3authProvider);

    const resolved = cryptoUtils._getProvider('web3auth');

    expect(resolved).toBe(web3authProvider);
  });

  it('falls back from web3auth strings to window.ethereum when Web3Auth is absent', () => {
    const ethereumProvider = { request: jest.fn() };
    setWindowProvider('ethereum', ethereumProvider);

    const resolved = cryptoUtils._getProvider('web3auth');

    expect(resolved).toBe(ethereumProvider);
  });

  it('resolves arbitrary string providers through the shared ethereum fallback', () => {
    const ethereumProvider = { request: jest.fn() };
    setWindowProvider('ethereum', ethereumProvider);

    const resolved = cryptoUtils._getProvider('injected');

    expect(resolved).toBe(ethereumProvider);
  });
});
