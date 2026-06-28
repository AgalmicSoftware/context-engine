import { cryptoUtils } from './cryptography.js';

const mockCreatePortoProvider = jest.fn();

jest.mock('../web3/portoFunctions.js', () => ({
  createPortoProviderMock: (...args) => mockCreatePortoProvider(...args),
}));

const setWindowProvider = (key, value) => {
  Object.defineProperty(window, key, {
    configurable: true,
    writable: true,
    value,
  });
};

describe('cryptoUtils Porto provider bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePortoProvider.mockReset();
    try {
      delete window.__portoMockProvider;
      delete window.__ceCreatePortoProviderMock;
      delete window.ethereum;
      delete window.web3authProvider;
    } catch (_) {
      window.__portoMockProvider = undefined;
      window.__ceCreatePortoProviderMock = undefined;
      window.ethereum = undefined;
      window.web3authProvider = undefined;
    }
  });

  it('uses the Vite-safe Porto provider factory when one is registered on window', () => {
    const provider = {
      isPorto: true,
      request: jest.fn(),
    };
    window.__ceCreatePortoProviderMock = jest.fn(() => provider);

    const resolved = cryptoUtils._getProvider('porto_passkey');

    expect(resolved).toBe(provider);
    expect(window.__ceCreatePortoProviderMock).toHaveBeenCalledTimes(1);
    expect(mockCreatePortoProvider).not.toHaveBeenCalled();
    expect(window.__portoMockProvider).toBe(provider);
  });

  it('synthesizes the Porto provider on demand for porto_passkey strings', () => {
    const provider = {
      isPorto: true,
      request: jest.fn(),
    };
    mockCreatePortoProvider.mockReturnValue(provider);

    const resolved = cryptoUtils._getProvider('porto_passkey');

    expect(resolved).toBe(provider);
    expect(mockCreatePortoProvider).toHaveBeenCalledTimes(1);
    expect(window.__portoMockProvider).toBe(provider);
  });

  it('reuses the seeded Porto provider when one is already present on window', () => {
    const seededProvider = {
      isPorto: true,
      request: jest.fn(),
    };
    window.__portoMockProvider = seededProvider;

    const resolved = cryptoUtils._getProvider('porto_passkey');

    expect(resolved).toBe(seededProvider);
    expect(mockCreatePortoProvider).not.toHaveBeenCalled();
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
