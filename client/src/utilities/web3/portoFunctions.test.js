const PORTO_STORAGE_KEY = 'porto_session_v1';
const RELAY_URL = 'http://127.0.0.1:8545';
const CHAIN_ID = 84532;
const BASE_ADDRESS = '0x0000000000000000000000000000000000000001';
const TARGET_ADDRESS = '0x0000000000000000000000000000000000000002';
const PRIVATE_KEY = `0x${'12'.repeat(32)}`;
const RAW_ID = Uint8Array.from([1, 2, 3, 4]).buffer;
const CREDENTIAL_ID = 'AQIDBA';

const makeSignerAccount = (address) => ({
  address,
  signMessage: jest.fn(async () => '0xmsg'),
  signTypedData: jest.fn(async () => '0xtyped'),
  signTransaction: jest.fn(async () => '0xtx'),
});

const seedLegacyPortoSession = () => {
  localStorage.setItem(
    PORTO_STORAGE_KEY,
    JSON.stringify({
      credentialId: CREDENTIAL_ID,
      address: BASE_ADDRESS,
      privateKey: PRIVATE_KEY,
    })
  );
};

const setCredentialsMock = ({ createImpl, getImpl } = {}) => {
  const credentials = {
    create: jest.fn(createImpl || (async () => ({ rawId: RAW_ID }))),
    get: jest.fn(getImpl || (async () => ({ id: 'assertion', rawId: RAW_ID }))),
  };
  Object.defineProperty(navigator, 'credentials', {
    value: credentials,
    configurable: true,
  });
  return credentials;
};

const loadPortoHarness = ({
  createWalletClientImpl,
  sendTransactionImpl,
  estimateGasImpl,
  privateKeyToAccountImpl,
} = {}) => {
  jest.resetModules();

  const requestMock = jest.fn(async ({ method }) => {
    if (method === 'eth_gasPrice') return '0x64';
    if (method === 'eth_getTransactionCount') return '0x2';
    return null;
  });
  const estimateGasMock = jest.fn(estimateGasImpl || (async () => 21000n));
  const sendTransactionMock = jest.fn(sendTransactionImpl || (async () => '0xhash'));

  const walletClient = {
    account: { address: BASE_ADDRESS },
    request: requestMock,
    estimateGas: estimateGasMock,
    sendTransaction: sendTransactionMock,
    signTypedData: jest.fn(async () => '0xsigned'),
    signMessage: jest.fn(async () => '0xsigned'),
  };
  const createWalletClientMock = jest.fn(createWalletClientImpl || (() => walletClient));
  const privateKeyToAccountMock = jest.fn(privateKeyToAccountImpl || (() => makeSignerAccount(BASE_ADDRESS)));

  jest.doMock('viem', () => ({
    createWalletClient: createWalletClientMock,
    fallback: jest.fn((transports) => transports[0]),
    http: jest.fn((url) => ({ transport: 'http', url })),
  }));
  jest.doMock('viem/accounts', () => ({
    toAccount: jest.fn((accountLike) => accountLike),
    privateKeyToAccount: privateKeyToAccountMock,
  }));
  jest.doMock('../../variables/chains.js', () => ({
    chainHexId: jest.fn(() => '0x14a34'),
    getDefaultGasPriceGwei: jest.fn(() => '0.08'),
    getPortoRelayUrl: jest.fn(() => RELAY_URL),
    resolvePortoChain: jest.fn(() => ({
      id: CHAIN_ID,
      rpcUrls: {
        public: { http: [RELAY_URL] },
        default: { http: [RELAY_URL] },
      },
    })),
  }));
  jest.doMock('../../variables/appConfig.js', () => ({
    PORTO_SESSION_KEY_ENABLED: true,
  }));
  jest.doMock('./contractScripts', () => ({
    __esModule: true,
    default: {
      getReadProviderForGroup: jest.fn(() => ({ send: jest.fn(async () => null) })),
    },
  }));

  const porto = require('./portoFunctions.js');
  return {
    porto,
    requestMock,
    estimateGasMock,
    sendTransactionMock,
    createWalletClientMock,
    privateKeyToAccountMock,
  };
};

const ensureWebCrypto = () => {
  if (typeof window !== 'undefined' && (!window.crypto || !window.crypto.subtle)) {
    const { webcrypto } = require('crypto');
    Object.defineProperty(window, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
  }
};

const createIndexedDbMock = (sessionRecord, options = {}) => ({
  open: jest.fn(() => {
    const request = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: null,
      error: null,
    };

    setTimeout(() => {
      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore: jest.fn(),
        close: jest.fn(),
        transaction: jest.fn(() => {
          const tx = {
            oncomplete: null,
            onerror: null,
            onabort: null,
            error: null,
            objectStore: jest.fn(() => ({
              get: jest.fn(() => {
                const getRequest = { onsuccess: null, onerror: null, result: sessionRecord, error: null };
                const completeGet = () => {
                  if (typeof getRequest.onsuccess === 'function') {
                    getRequest.onsuccess({ target: getRequest });
                  }
                  if (typeof tx.oncomplete === 'function') {
                    tx.oncomplete();
                  }
                };
                if (typeof options.waitForGet === 'function') {
                  options.waitForGet().then(completeGet, (error) => {
                    tx.error = error;
                    getRequest.error = error;
                    if (typeof getRequest.onerror === 'function') {
                      getRequest.onerror({ target: getRequest });
                    }
                    if (typeof tx.onerror === 'function') {
                      tx.onerror({ target: tx });
                    }
                  });
                  return getRequest;
                }
                setTimeout(completeGet, 0);
                return getRequest;
              }),
              put: jest.fn((record, key) => {
                if (typeof options.onPut === 'function') {
                  options.onPut(record, key);
                }
                const completePut = () => {
                  if (typeof tx.oncomplete === 'function') {
                    tx.oncomplete();
                  }
                };
                if (typeof options.waitForPut === 'function') {
                  options.waitForPut(record, key).then(completePut, (error) => {
                    tx.error = error;
                    if (typeof tx.onerror === 'function') {
                      tx.onerror({ target: tx });
                    }
                  });
                  return undefined;
                }
                setTimeout(completePut, 0);
                return undefined;
              }),
              delete: jest.fn(() => {
                setTimeout(() => {
                  if (typeof tx.oncomplete === 'function') {
                    tx.oncomplete();
                  }
                }, 0);
              }),
            })),
          };
          return tx;
        }),
      };

      request.result = db;
      if (typeof request.onsuccess === 'function') {
        request.onsuccess({ target: { result: db } });
      }
    }, 0);

    return request;
  }),
});

const createFailingIndexedDbMock = (error = new Error('IndexedDB unavailable')) => ({
  open: jest.fn(() => {
    const request = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: null,
      error: null,
    };

    setTimeout(() => {
      request.error = error;
      if (typeof request.onerror === 'function') {
        request.onerror({ target: request });
      }
    }, 0);

    return request;
  }),
});

const bufferToBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const encryptStoredPrivateKey = async (privateKey, credentialId) => {
  ensureWebCrypto();
  const material = new TextEncoder().encode(`porto_session_key_v1:${credentialId}`);
  const hash = await window.crypto.subtle.digest('SHA-256', material);
  const key = await window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(privateKey)
  );
  return {
    encryptedPrivateKey: bufferToBase64Url(ciphertext),
    encryptedPrivateKeyIv: bufferToBase64Url(iv),
  };
};

describe('sendPortoTransaction nonce retry behavior', () => {
  let consoleErrorSpy;
  let originalCredentialsDescriptor;

  beforeEach(() => {
    ensureWebCrypto();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    originalCredentialsDescriptor = Object.getOwnPropertyDescriptor(navigator, 'credentials');
    setCredentialsMock();
    localStorage.clear();
    delete globalThis.CE_PORTO_SEND_RETRY_ATTEMPTS;
    delete globalThis.CE_PORTO_SEND_RETRY_BASE_DELAY_MS;
    delete globalThis.CE_PORTO_SEND_MIN_RETRY_GWEI;
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
    if (originalCredentialsDescriptor) {
      Object.defineProperty(navigator, 'credentials', originalCredentialsDescriptor);
    } else {
      delete navigator.credentials;
    }
  });

  it('does not pre-pin nonce before the first send attempt', async () => {
    const { porto, requestMock, sendTransactionMock } = loadPortoHarness();
    seedLegacyPortoSession();
    await porto.restoreSession();

    const txHash = await porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: '0x',
    });

    expect(txHash).toBe('0xhash');
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    const firstPayload = sendTransactionMock.mock.calls[0][0];
    expect(Object.prototype.hasOwnProperty.call(firstPayload, 'nonce')).toBe(false);
    expect(
      requestMock.mock.calls.filter(([req]) => req?.method === 'eth_getTransactionCount')
    ).toHaveLength(0);
  });

  it('rebuilds a missing wallet client before sending with a restored signer', async () => {
    let createAttempts = 0;
    const { porto, createWalletClientMock, sendTransactionMock } = loadPortoHarness({
      createWalletClientImpl: () => {
        createAttempts += 1;
        if (createAttempts === 1) {
          throw new Error('relay init failed');
        }
        return {
          account: { address: BASE_ADDRESS },
          request: jest.fn(async ({ method }) => {
            if (method === 'eth_gasPrice') return '0x64';
            if (method === 'eth_getTransactionCount') return '0x2';
            return null;
          }),
          estimateGas: jest.fn(async () => 21000n),
          sendTransaction: sendTransactionMock,
          signTypedData: jest.fn(async () => '0xsigned'),
          signMessage: jest.fn(async () => '0xsigned'),
        };
      },
    });
    seedLegacyPortoSession();

    await expect(porto.restoreSession()).resolves.toBeNull();
    expect(porto.hasPortoSessionSigner()).toBe(true);
    expect(createWalletClientMock).toHaveBeenCalledTimes(1);

    await expect(porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: '0x',
    })).resolves.toBe('0xhash');
    expect(createWalletClientMock).toHaveBeenCalledTimes(2);
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
  });

  it('prompts before a provider send after legacy metadata-only restore', async () => {
    const credentials = setCredentialsMock({
      getImpl: async () => ({ id: 'assertion', rawId: RAW_ID }),
    });
    const { porto, createWalletClientMock, sendTransactionMock } = loadPortoHarness();
    seedLegacyPortoSession();

    await expect(porto.restoreSession({ requireSigner: false })).resolves.toBe(BASE_ADDRESS);

    const provider = porto.createPortoProviderMock();
    await expect(provider.request({
      method: 'eth_sendTransaction',
      params: [{
        to: TARGET_ADDRESS,
        value: '0x0',
        data: '0x',
      }],
    })).resolves.toBe('0xhash');

    expect(credentials.get).toHaveBeenCalledTimes(1);
    expect(createWalletClientMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
  });

  it('uses account signing fallbacks when wallet client sign helpers are absent', async () => {
    const signMessageMock = jest.fn(async () => '0xaccountmsg');
    const signTypedDataMock = jest.fn(async () => '0xaccounttyped');
    const signerAccount = {
      ...makeSignerAccount(BASE_ADDRESS),
      signMessage: signMessageMock,
      signTypedData: signTypedDataMock,
    };
    const { porto, sendTransactionMock } = loadPortoHarness({
      privateKeyToAccountImpl: () => signerAccount,
      createWalletClientImpl: ({ account }) => ({
        account,
        request: jest.fn(async ({ method }) => {
          if (method === 'eth_gasPrice') return '0x64';
          if (method === 'eth_getTransactionCount') return '0x2';
          return null;
        }),
        sendTransaction: sendTransactionMock,
      }),
    });
    seedLegacyPortoSession();

    await expect(porto.restoreSession()).resolves.toBe(BASE_ADDRESS);
    const provider = porto.createPortoProviderMock();

    await expect(provider.request({
      method: 'personal_sign',
      params: ['0x6869', BASE_ADDRESS],
    })).resolves.toBe('0xaccountmsg');
    await expect(provider.request({
      method: 'eth_signTypedData_v4',
      params: [BASE_ADDRESS, { domain: {}, types: {}, primaryType: 'Msg', message: {} }],
    })).resolves.toBe('0xaccounttyped');
    await expect(provider.request({
      method: 'eth_estimateGas',
      params: [{
        to: TARGET_ADDRESS,
        value: '0x0',
        data: '0x',
      }],
    })).resolves.toBe('0x5208');
    await expect(provider.request({
      method: 'eth_sendTransaction',
      params: [{
        to: TARGET_ADDRESS,
        value: '0x0',
        data: '0x',
      }],
    })).resolves.toBe('0xhash');

    expect(signMessageMock).toHaveBeenCalledTimes(1);
    expect(signTypedDataMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
  });

  it('pins nonce only after replacement-underpriced and retries with that nonce', async () => {
    let attempt = 0;
    const { porto, requestMock, sendTransactionMock } = loadPortoHarness({
      sendTransactionImpl: async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('replacement transaction underpriced');
        }
        return '0xretryhash';
      },
    });
    seedLegacyPortoSession();
    globalThis.CE_PORTO_SEND_RETRY_ATTEMPTS = '2';
    globalThis.CE_PORTO_SEND_RETRY_BASE_DELAY_MS = '1';
    await porto.restoreSession();

    const txHash = await porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: '0x',
    });

    expect(txHash).toBe('0xretryhash');
    expect(sendTransactionMock).toHaveBeenCalledTimes(2);

    const firstPayload = sendTransactionMock.mock.calls[0][0];
    const retryPayload = sendTransactionMock.mock.calls[1][0];
    expect(Object.prototype.hasOwnProperty.call(firstPayload, 'nonce')).toBe(false);
    expect(retryPayload.nonce).toBe(2n);
    expect(
      requestMock.mock.calls.filter(([req]) => req?.method === 'eth_getTransactionCount')
    ).toHaveLength(1);
  });

  it('retries nonce-too-low send errors with a refreshed nonce', async () => {
    let attempt = 0;
    const { porto, requestMock, sendTransactionMock } = loadPortoHarness({
      sendTransactionImpl: async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('nonce too low');
        }
        return '0xrecoverablehash';
      },
    });
    seedLegacyPortoSession();
    globalThis.CE_PORTO_SEND_RETRY_ATTEMPTS = '2';
    globalThis.CE_PORTO_SEND_RETRY_BASE_DELAY_MS = '1';
    await porto.restoreSession();

    const txHash = await porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: '0x',
    });

    expect(txHash).toBe('0xrecoverablehash');
    expect(sendTransactionMock).toHaveBeenCalledTimes(2);
    expect(Object.prototype.hasOwnProperty.call(sendTransactionMock.mock.calls[0][0], 'nonce')).toBe(false);
    expect(sendTransactionMock.mock.calls[1][0].nonce).toBe(2n);
    expect(
      requestMock.mock.calls.filter(([req]) => req?.method === 'eth_getTransactionCount')
    ).toHaveLength(1);
  });

  it('does not retry already-known sends with a fresh nonce', async () => {
    const { porto, requestMock, sendTransactionMock } = loadPortoHarness({
      sendTransactionImpl: async () => {
        throw new Error('already known');
      },
    });
    seedLegacyPortoSession();
    globalThis.CE_PORTO_SEND_RETRY_ATTEMPTS = '2';
    globalThis.CE_PORTO_SEND_RETRY_BASE_DELAY_MS = '1';
    await porto.restoreSession();

    await expect(porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: '0x',
    })).rejects.toThrow('already known');

    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    expect(Object.prototype.hasOwnProperty.call(sendTransactionMock.mock.calls[0][0], 'nonce')).toBe(false);
    expect(
      requestMock.mock.calls.filter(([req]) => req?.method === 'eth_getTransactionCount')
    ).toHaveLength(0);
  });

  it('does not lower the retry gas price when replacement gas price reads drop', async () => {
    let attempt = 0;
    let gasPriceReads = 0;
    const { porto, requestMock, sendTransactionMock } = loadPortoHarness({
      sendTransactionImpl: async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('replacement transaction underpriced');
        }
        return '0xretryhash';
      },
    });
    requestMock.mockImplementation(async ({ method }) => {
      if (method === 'eth_gasPrice') {
        gasPriceReads += 1;
        return gasPriceReads === 1 ? '0x64' : '0x32';
      }
      if (method === 'eth_getTransactionCount') return '0x2';
      return null;
    });
    seedLegacyPortoSession();
    globalThis.CE_PORTO_SEND_RETRY_ATTEMPTS = '2';
    globalThis.CE_PORTO_SEND_RETRY_BASE_DELAY_MS = '1';
    globalThis.CE_PORTO_SEND_MIN_RETRY_GWEI = '0';
    await porto.restoreSession();

    const txHash = await porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: '0x',
    });

    expect(txHash).toBe('0xretryhash');
    expect(sendTransactionMock).toHaveBeenCalledTimes(2);
    const firstPayload = sendTransactionMock.mock.calls[0][0];
    const retryPayload = sendTransactionMock.mock.calls[1][0];
    expect(firstPayload.gasPrice).toBe(100n);
    expect(retryPayload.gasPrice).toBe(150n);
    expect(retryPayload.gasPrice).toBeGreaterThan(firstPayload.gasPrice);
    expect(gasPriceReads).toBe(2);
  });

  it('preserves caller gasPrice when it is higher than eth_gasPrice', async () => {
    const { porto, requestMock, sendTransactionMock } = loadPortoHarness();
    seedLegacyPortoSession();
    await porto.restoreSession();

    const txHash = await porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: '0x',
      gasPrice: { _hex: '0x96', toString: () => '150' },
    });

    expect(txHash).toBe('0xhash');
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionMock.mock.calls[0][0].gasPrice).toBe(150n);
    expect(
      requestMock.mock.calls.filter(([req]) => req?.method === 'eth_gasPrice')
    ).toHaveLength(1);
  });

  it('sends caller EIP-1559 fee fields without legacy gasPrice', async () => {
    const { porto, requestMock, sendTransactionMock } = loadPortoHarness();
    seedLegacyPortoSession();
    await porto.restoreSession();

    const txHash = await porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: '0x',
      maxFeePerGas: '0x96',
      maxPriorityFeePerGas: { toBigInt: () => 10n },
      gasPrice: '0x64',
    });

    expect(txHash).toBe('0xhash');
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    const sentPayload = sendTransactionMock.mock.calls[0][0];
    expect(sentPayload.maxFeePerGas).toBe(150n);
    expect(sentPayload.maxPriorityFeePerGas).toBe(10n);
    expect(Object.prototype.hasOwnProperty.call(sentPayload, 'gasPrice')).toBe(false);
    expect(
      requestMock.mock.calls.filter(([req]) => req?.method === 'eth_gasPrice')
    ).toHaveLength(0);
  });

  it('uses selector-aware high fallback gas for addSurvey when estimateGas fails', async () => {
    const { porto, sendTransactionMock } = loadPortoHarness({
      estimateGasImpl: async () => {
        throw new Error('estimate failed');
      },
    });
    seedLegacyPortoSession();
    await porto.restoreSession();

    const txHash = await porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: `0xbaea8df2${'00'.repeat(640)}`,
    });

    expect(txHash).toBe('0xhash');
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    const sentPayload = sendTransactionMock.mock.calls[0][0];
    expect(sentPayload.gas).toBe(1400000n);
  });

  it('uses per-chain default gas price when eth_gasPrice fails before send', async () => {
    const { porto, requestMock, sendTransactionMock } = loadPortoHarness({
      sendTransactionImpl: async () => '0xhash',
    });
    requestMock.mockImplementation(async ({ method }) => {
      if (method === 'eth_gasPrice') {
        throw new Error('Could not getPrice. Received: error code: 502. Status: 502, Bad Gateway');
      }
      if (method === 'eth_getTransactionCount') return '0x2';
      return null;
    });
    seedLegacyPortoSession();
    await porto.restoreSession();

    const txHash = await porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: '0x',
    });

    expect(txHash).toBe('0xhash');
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionMock.mock.calls[0][0].gasPrice).toBe(80000000n);
  });

  it('returns selector-aware fallback from Porto eth_estimateGas bridge when estimate fails', async () => {
    const { porto } = loadPortoHarness({
      estimateGasImpl: async () => {
        throw new Error('estimate failed');
      },
    });
    seedLegacyPortoSession();
    await porto.restoreSession();

    const provider = porto.createPortoProviderMock();
    const fallbackGasHex = await provider.request({
      method: 'eth_estimateGas',
      params: [{
        to: TARGET_ADDRESS,
        value: '0x0',
        data: `0x7ce3e774${'00'.repeat(640)}`,
      }],
    });

    expect(fallbackGasHex).toBe('0x124f80');
  });

  it('returns per-chain default gas price from the Porto provider bridge when eth_gasPrice fails', async () => {
    const { porto, requestMock } = loadPortoHarness();
    requestMock.mockImplementation(async ({ method }) => {
      if (method === 'eth_gasPrice') {
        throw new Error('Could not getPrice. Received: error code: 502. Status: 502, Bad Gateway');
      }
      return null;
    });
    seedLegacyPortoSession();
    await porto.restoreSession();

    const provider = porto.createPortoProviderMock();
    const gasPriceHex = await provider.request({
      method: 'eth_gasPrice',
      params: [],
    });

    expect(gasPriceHex).toBe('0x4c4b400');
  });
});

describe('Porto provider signing bridge', () => {
  let consoleErrorSpy;
  let originalCredentialsDescriptor;

  beforeEach(() => {
    ensureWebCrypto();
    localStorage.clear();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    originalCredentialsDescriptor = Object.getOwnPropertyDescriptor(navigator, 'credentials');
    setCredentialsMock();
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
    if (originalCredentialsDescriptor) {
      Object.defineProperty(navigator, 'credentials', originalCredentialsDescriptor);
    } else {
      delete navigator.credentials;
    }
  });

  it('preserves raw hex bytes for personal_sign instead of reinterpreting them as UTF-8', async () => {
    const { porto, createWalletClientMock } = loadPortoHarness();
    seedLegacyPortoSession();
    await porto.restoreSession();

    const provider = porto.createPortoProviderMock();
    await provider.request({
      method: 'personal_sign',
      params: ['0x68656c6c6f', BASE_ADDRESS],
    });

    const walletClient = createWalletClientMock.mock.results[0]?.value;
    expect(walletClient.signMessage).toHaveBeenCalledWith({
      message: { raw: '0x68656c6c6f' },
    });
  });
});

describe('Porto key derivation migration', () => {
  const HKDF_PRIVATE_KEY = `0x${'ab'.repeat(32)}`;
  const HKDF_ADDRESS = '0x00000000000000000000000000000000000000aa';
  const LEGACY_ADDRESS = '0x00000000000000000000000000000000000000bb';

  let consoleErrorSpy;
  let consoleWarnSpy;
  let importKeySpy;
  let deriveBitsSpy;
  let originalIndexedDbDescriptor;
  let originalCredentialsDescriptor;
  let originalPublicKeyCredentialDescriptor;

  beforeEach(() => {
    ensureWebCrypto();
    localStorage.clear();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    originalIndexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    originalCredentialsDescriptor = Object.getOwnPropertyDescriptor(navigator, 'credentials');
    originalPublicKeyCredentialDescriptor = Object.getOwnPropertyDescriptor(window, 'PublicKeyCredential');
  });

  afterEach(() => {
    if (importKeySpy) importKeySpy.mockRestore();
    if (deriveBitsSpy) deriveBitsSpy.mockRestore();
    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
    if (consoleWarnSpy) consoleWarnSpy.mockRestore();

    if (originalIndexedDbDescriptor) {
      Object.defineProperty(globalThis, 'indexedDB', originalIndexedDbDescriptor);
    } else {
      delete globalThis.indexedDB;
    }

    if (originalCredentialsDescriptor) {
      Object.defineProperty(navigator, 'credentials', originalCredentialsDescriptor);
    } else {
      delete navigator.credentials;
    }

    if (originalPublicKeyCredentialDescriptor) {
      Object.defineProperty(window, 'PublicKeyCredential', originalPublicKeyCredentialDescriptor);
    } else {
      delete window.PublicKeyCredential;
    }
  });

  it('derives a 32-byte hex private key via HKDF during authenticatePorto', async () => {
    importKeySpy = jest.spyOn(window.crypto.subtle, 'importKey').mockResolvedValue({ type: 'secret' });
    deriveBitsSpy = jest.spyOn(window.crypto.subtle, 'deriveBits').mockResolvedValue(
      new Uint8Array(32).fill(0xab).buffer
    );

    Object.defineProperty(window, 'PublicKeyCredential', {
      value: function PublicKeyCredential() {},
      configurable: true,
    });
    const credentials = setCredentialsMock({
      createImpl: async () => ({ rawId: RAW_ID }),
    });

    const { porto, privateKeyToAccountMock } = loadPortoHarness({
      privateKeyToAccountImpl: (privateKey) => makeSignerAccount(
        privateKey === HKDF_PRIVATE_KEY ? HKDF_ADDRESS : BASE_ADDRESS
      ),
    });

    const address = await porto.authenticatePorto();

    expect(privateKeyToAccountMock.mock.calls[0][0]).toMatch(/^0x[0-9a-f]{64}$/);
    expect(privateKeyToAccountMock).toHaveBeenCalledWith(HKDF_PRIVATE_KEY);
    expect(credentials.create).toHaveBeenCalledWith(expect.objectContaining({
      publicKey: expect.objectContaining({
        authenticatorSelection: expect.objectContaining({
          userVerification: 'required',
        }),
      }),
    }));
    expect(address).toBe(HKDF_ADDRESS);
  });

  it('uses the HKDF-derived account even when stored state reflects a legacy address', async () => {
    importKeySpy = jest.spyOn(window.crypto.subtle, 'importKey').mockResolvedValue({ type: 'secret' });
    deriveBitsSpy = jest.spyOn(window.crypto.subtle, 'deriveBits').mockResolvedValue(
      new Uint8Array(32).fill(0xab).buffer
    );

    Object.defineProperty(window, 'PublicKeyCredential', {
      value: function PublicKeyCredential() {},
      configurable: true,
    });
    setCredentialsMock({
      getImpl: async () => ({ rawId: RAW_ID }),
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock({
        credentialId: 'stored-cred',
        address: LEGACY_ADDRESS,
      }),
      configurable: true,
    });

    const { porto, privateKeyToAccountMock } = loadPortoHarness({
      privateKeyToAccountImpl: (privateKey) => {
        if (privateKey === HKDF_PRIVATE_KEY) return makeSignerAccount(HKDF_ADDRESS);
        return makeSignerAccount(BASE_ADDRESS);
      },
    });

    const address = await porto.loginWithPorto();

    expect(privateKeyToAccountMock.mock.calls.map(([privateKey]) => privateKey)).toEqual([HKDF_PRIVATE_KEY]);
    expect(address).toBe(HKDF_ADDRESS);
  });

  it('clears stale legacy storage after persisting a selected passkey account switch', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: function PublicKeyCredential() {},
      configurable: true,
    });
    setCredentialsMock({
      getImpl: async () => ({ rawId: RAW_ID }),
    });

    let persistedRecord = null;
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock({
        credentialId: 'stored-cred',
        address: LEGACY_ADDRESS,
        encryptedPrivateKey: 'encrypted-old-key',
        encryptedPrivateKeyIv: 'encrypted-old-iv',
      }, {
        onPut: (record) => {
          persistedRecord = record;
        },
      }),
      configurable: true,
    });
    localStorage.setItem(
      PORTO_STORAGE_KEY,
      JSON.stringify({
        credentialId: 'legacy-cred',
        address: LEGACY_ADDRESS,
        privateKey: PRIVATE_KEY,
      })
    );

    const { porto } = loadPortoHarness({
      privateKeyToAccountImpl: () => makeSignerAccount(HKDF_ADDRESS),
    });

    await expect(porto.loginWithPorto()).resolves.toBe(HKDF_ADDRESS);
    expect(persistedRecord).toEqual(expect.objectContaining({
      address: HKDF_ADDRESS,
    }));
    expect(localStorage.getItem(PORTO_STORAGE_KEY)).toBeNull();

    Object.defineProperty(globalThis, 'indexedDB', {
      value: createFailingIndexedDbMock(),
      configurable: true,
    });
    const { porto: reloadedPorto, createWalletClientMock } = loadPortoHarness({
      privateKeyToAccountImpl: () => makeSignerAccount(LEGACY_ADDRESS),
    });

    await expect(reloadedPorto.restoreSession({ requireSigner: false })).resolves.toBeNull();
    expect(createWalletClientMock).not.toHaveBeenCalled();
  });

  it('blocks stale Porto sends while a different selected passkey account is being persisted', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: function PublicKeyCredential() {},
      configurable: true,
    });
    setCredentialsMock({
      getImpl: async () => ({ id: 'assertion', rawId: RAW_ID }),
    });

    const encrypted = await encryptStoredPrivateKey(PRIVATE_KEY, CREDENTIAL_ID);
    let releasePut;
    const putStarted = new Promise((resolve) => {
      Object.defineProperty(globalThis, 'indexedDB', {
        value: createIndexedDbMock({
          credentialId: CREDENTIAL_ID,
          address: BASE_ADDRESS,
          encryptedPrivateKey: encrypted.encryptedPrivateKey,
          encryptedPrivateKeyIv: encrypted.encryptedPrivateKeyIv,
        }, {
          waitForPut: () => {
            resolve();
            return new Promise((putResolve) => {
              releasePut = putResolve;
            });
          },
        }),
        configurable: true,
      });
    });

    let accountCallCount = 0;
    const { porto, createWalletClientMock, sendTransactionMock } = loadPortoHarness({
      privateKeyToAccountImpl: () => {
        accountCallCount += 1;
        return makeSignerAccount(accountCallCount >= 3 ? TARGET_ADDRESS : BASE_ADDRESS);
      },
    });

    const restoredAddress = await porto.restoreSession();
    expect(restoredAddress).toBe(BASE_ADDRESS);
    expect(await porto.createPortoProviderMock().request({ method: 'eth_accounts', params: [] })).toEqual([BASE_ADDRESS]);

    const loginPromise = porto.loginWithPorto();
    await putStarted;

    expect(await porto.createPortoProviderMock().request({ method: 'eth_accounts', params: [] })).toEqual([]);
    await expect(porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: '0x',
    })).rejects.toThrow('Porto account switch is in progress');
    expect(sendTransactionMock).not.toHaveBeenCalled();

    releasePut();
    await expect(loginPromise).resolves.toBe(TARGET_ADDRESS);
    expect(await porto.createPortoProviderMock().request({ method: 'eth_accounts', params: [] })).toEqual([TARGET_ADDRESS]);
    expect(createWalletClientMock).toHaveBeenCalledTimes(2);
    expect(createWalletClientMock.mock.calls[1][0].account.address).toBe(TARGET_ADDRESS);
  });

  it('does not let an in-flight metadata restore re-adopt the saved account after passkey login', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: function PublicKeyCredential() {},
      configurable: true,
    });
    setCredentialsMock({
      getImpl: async () => ({ id: 'assertion', rawId: RAW_ID }),
    });

    const encrypted = await encryptStoredPrivateKey(PRIVATE_KEY, CREDENTIAL_ID);
    let releaseGet = () => {};
    let getCallCount = 0;
    const getStarted = new Promise((resolve) => {
      Object.defineProperty(globalThis, 'indexedDB', {
        value: createIndexedDbMock({
          credentialId: CREDENTIAL_ID,
          address: BASE_ADDRESS,
          encryptedPrivateKey: encrypted.encryptedPrivateKey,
          encryptedPrivateKeyIv: encrypted.encryptedPrivateKeyIv,
        }, {
          waitForGet: () => {
            getCallCount += 1;
            if (getCallCount > 1) return Promise.resolve();
            resolve();
            return new Promise((getResolve) => {
              releaseGet = getResolve;
            });
          },
        }),
        configurable: true,
      });
    });

    const { porto, createWalletClientMock } = loadPortoHarness({
      privateKeyToAccountImpl: () => makeSignerAccount(TARGET_ADDRESS),
    });

    const restorePromise = porto.restoreSession({ requireSigner: false });
    await getStarted;

    await expect(porto.loginWithPorto()).resolves.toBe(TARGET_ADDRESS);
    releaseGet();

    await expect(restorePromise).resolves.toBe(TARGET_ADDRESS);
    expect(await porto.createPortoProviderMock().request({ method: 'eth_accounts', params: [] })).toEqual([TARGET_ADDRESS]);
    expect(createWalletClientMock).toHaveBeenCalledTimes(1);
    expect(createWalletClientMock.mock.calls[0][0].account.address).toBe(TARGET_ADDRESS);
  });

  it('fails closed when an unhydrated saved account differs and selected-session persistence fails', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: function PublicKeyCredential() {},
      configurable: true,
    });
    setCredentialsMock({
      getImpl: async () => ({ id: 'assertion', rawId: RAW_ID }),
    });

    const encrypted = await encryptStoredPrivateKey(PRIVATE_KEY, CREDENTIAL_ID);
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock({
        credentialId: CREDENTIAL_ID,
        address: BASE_ADDRESS,
        encryptedPrivateKey: encrypted.encryptedPrivateKey,
        encryptedPrivateKeyIv: encrypted.encryptedPrivateKeyIv,
      }, {
        waitForPut: () => Promise.reject(new Error('put failed')),
      }),
      configurable: true,
    });

    const { porto, createWalletClientMock } = loadPortoHarness({
      privateKeyToAccountImpl: () => makeSignerAccount(TARGET_ADDRESS),
    });

    await expect(porto.loginWithPorto()).rejects.toThrow('Failed to persist selected Porto passkey session.');
    expect(await porto.createPortoProviderMock().request({ method: 'eth_accounts', params: [] })).toEqual([]);
    expect(createWalletClientMock).not.toHaveBeenCalled();
  });

  it('fails closed when a hydrated saved account differs and selected-session persistence fails', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: function PublicKeyCredential() {},
      configurable: true,
    });
    setCredentialsMock({
      getImpl: async () => ({ id: 'assertion', rawId: RAW_ID }),
    });

    const encrypted = await encryptStoredPrivateKey(PRIVATE_KEY, CREDENTIAL_ID);
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock({
        credentialId: CREDENTIAL_ID,
        address: BASE_ADDRESS,
        encryptedPrivateKey: encrypted.encryptedPrivateKey,
        encryptedPrivateKeyIv: encrypted.encryptedPrivateKeyIv,
      }, {
        waitForPut: () => Promise.reject(new Error('put failed')),
      }),
      configurable: true,
    });

    let accountCallCount = 0;
    const { porto, createWalletClientMock, sendTransactionMock } = loadPortoHarness({
      privateKeyToAccountImpl: () => {
        accountCallCount += 1;
        return makeSignerAccount(accountCallCount >= 3 ? TARGET_ADDRESS : BASE_ADDRESS);
      },
    });

    await expect(porto.restoreSession()).resolves.toBe(BASE_ADDRESS);
    expect(await porto.createPortoProviderMock().request({ method: 'eth_accounts', params: [] })).toEqual([BASE_ADDRESS]);

    await expect(porto.loginWithPorto()).rejects.toThrow('Failed to persist selected Porto passkey session.');
    expect(await porto.createPortoProviderMock().request({ method: 'eth_accounts', params: [] })).toEqual([]);
    await expect(porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: '0x',
    })).rejects.toThrow('Porto client not initialized');
    expect(sendTransactionMock).not.toHaveBeenCalled();
    expect(createWalletClientMock).toHaveBeenCalledTimes(1);
  });

  it('propagates HKDF failures during login instead of silently falling back', async () => {
    const hkdfError = new Error('HKDF failed');
    importKeySpy = jest.spyOn(window.crypto.subtle, 'importKey').mockRejectedValue(hkdfError);

    Object.defineProperty(window, 'PublicKeyCredential', {
      value: function PublicKeyCredential() {},
      configurable: true,
    });
    setCredentialsMock({
      getImpl: async () => ({ rawId: RAW_ID }),
    });

    const { porto, privateKeyToAccountMock } = loadPortoHarness();

    await expect(porto.loginWithPorto()).rejects.toThrow('HKDF failed');
    expect(privateKeyToAccountMock).not.toHaveBeenCalled();
  });
});

describe('Porto session restore validation', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;
  let originalIndexedDbDescriptor;
  let originalCredentialsDescriptor;

  beforeEach(() => {
    ensureWebCrypto();
    localStorage.clear();
    delete globalThis.CE_PORTO_RESTORE_INDEXEDDB_TIMEOUT_MS;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    originalIndexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    originalCredentialsDescriptor = Object.getOwnPropertyDescriptor(navigator, 'credentials');
    setCredentialsMock();
  });

  afterEach(() => {
    if (consoleErrorSpy) consoleErrorSpy.mockRestore();
    if (consoleWarnSpy) consoleWarnSpy.mockRestore();
    if (originalIndexedDbDescriptor) {
      Object.defineProperty(globalThis, 'indexedDB', originalIndexedDbDescriptor);
    } else {
      delete globalThis.indexedDB;
    }
    if (originalCredentialsDescriptor) {
      Object.defineProperty(navigator, 'credentials', originalCredentialsDescriptor);
    } else {
      delete navigator.credentials;
    }
    delete globalThis.CE_PORTO_RESTORE_INDEXEDDB_TIMEOUT_MS;
  });

  it('restores encrypted indexedDB sessions only after a fresh passkey assertion', async () => {
    const credentialId = CREDENTIAL_ID;
    const encrypted = await encryptStoredPrivateKey(PRIVATE_KEY, credentialId);
    const credentials = setCredentialsMock({
      getImpl: async () => ({ id: 'assertion', rawId: RAW_ID }),
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock({
        credentialId,
        address: BASE_ADDRESS,
        encryptedPrivateKey: encrypted.encryptedPrivateKey,
        encryptedPrivateKeyIv: encrypted.encryptedPrivateKeyIv,
      }),
      configurable: true,
    });

    const decryptSpy = jest.spyOn(window.crypto.subtle, 'decrypt');
    const { porto, createWalletClientMock, privateKeyToAccountMock } = loadPortoHarness();

    const restored = await porto.restoreSession();

    expect(credentials.get).toHaveBeenCalledTimes(1);
    expect(decryptSpy).toHaveBeenCalledTimes(1);
    expect(privateKeyToAccountMock).toHaveBeenCalled();
    expect(restored).toBe(BASE_ADDRESS);
    expect(createWalletClientMock).toHaveBeenCalledTimes(1);
    expect(createWalletClientMock.mock.calls[0][0].account).toEqual(expect.objectContaining({
      address: BASE_ADDRESS,
      signMessage: expect.any(Function),
      signTypedData: expect.any(Function),
      signTransaction: expect.any(Function),
    }));
    expect(credentials.get).toHaveBeenCalledWith(expect.objectContaining({
      publicKey: expect.objectContaining({
        userVerification: 'required',
        timeout: 60000,
        allowCredentials: [
          expect.objectContaining({
            type: 'public-key',
            transports: ['internal', 'hybrid'],
          }),
        ],
      }),
    }));
    expect(
      bufferToBase64Url(credentials.get.mock.calls[0][0].publicKey.allowCredentials[0].id)
    ).toBe(credentialId);
    decryptSpy.mockRestore();
  });

  it('hydrates encrypted indexedDB session metadata without prompting when signer restore is not required', async () => {
    const credentialId = CREDENTIAL_ID;
    const encrypted = await encryptStoredPrivateKey(PRIVATE_KEY, credentialId);
    const credentials = setCredentialsMock({
      getImpl: async () => ({ id: 'assertion', rawId: RAW_ID }),
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock({
        credentialId,
        address: BASE_ADDRESS,
        encryptedPrivateKey: encrypted.encryptedPrivateKey,
        encryptedPrivateKeyIv: encrypted.encryptedPrivateKeyIv,
      }),
      configurable: true,
    });

    const decryptSpy = jest.spyOn(window.crypto.subtle, 'decrypt');
    const { porto, createWalletClientMock } = loadPortoHarness();

    const restored = await porto.restoreSession({ requireSigner: false });

    expect(restored).toBe(BASE_ADDRESS);
    expect(credentials.get).not.toHaveBeenCalled();
    expect(decryptSpy).not.toHaveBeenCalled();
    expect(createWalletClientMock).not.toHaveBeenCalled();
    expect(await porto.createPortoProviderMock().request({ method: 'eth_accounts', params: [] })).toEqual([BASE_ADDRESS]);
    expect(porto.hasPortoSessionSigner()).toBe(false);
    expect(porto.isPortoAutoSignReady()).toBe(false);
    decryptSpy.mockRestore();
  });

  it('prompts on the first send after a metadata-only restore', async () => {
    const credentialId = CREDENTIAL_ID;
    const encrypted = await encryptStoredPrivateKey(PRIVATE_KEY, credentialId);
    const credentials = setCredentialsMock({
      getImpl: async () => ({ id: 'assertion', rawId: RAW_ID }),
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock({
        credentialId,
        address: BASE_ADDRESS,
        encryptedPrivateKey: encrypted.encryptedPrivateKey,
        encryptedPrivateKeyIv: encrypted.encryptedPrivateKeyIv,
      }),
      configurable: true,
    });

    const { porto, createWalletClientMock, sendTransactionMock } = loadPortoHarness();

    const restored = await porto.restoreSession({ requireSigner: false });
    const txHash = await porto.sendPortoTransaction({
      to: TARGET_ADDRESS,
      value: '0x0',
      data: '0x',
    });

    expect(restored).toBe(BASE_ADDRESS);
    expect(txHash).toBe('0xhash');
    expect(credentials.get).toHaveBeenCalledTimes(1);
    expect(createWalletClientMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionMock).toHaveBeenCalledTimes(1);
    expect(porto.hasPortoSessionSigner()).toBe(true);
    expect(porto.isPortoAutoSignReady()).toBe(true);
  });

  it('returns null when the passkey assertion fails before decrypting the indexedDB session', async () => {
    const credentialId = CREDENTIAL_ID;
    const encrypted = await encryptStoredPrivateKey(PRIVATE_KEY, credentialId);
    setCredentialsMock({
      getImpl: async () => {
        throw new Error('User cancelled');
      },
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock({
        credentialId,
        address: BASE_ADDRESS,
        encryptedPrivateKey: encrypted.encryptedPrivateKey,
        encryptedPrivateKeyIv: encrypted.encryptedPrivateKeyIv,
      }),
      configurable: true,
    });

    const decryptSpy = jest.spyOn(window.crypto.subtle, 'decrypt');
    const { porto, createWalletClientMock } = loadPortoHarness();

    const restored = await porto.restoreSession();

    expect(restored).toBeNull();
    expect(decryptSpy).not.toHaveBeenCalled();
    expect(createWalletClientMock).not.toHaveBeenCalled();
    decryptSpy.mockRestore();
  });

  it('rejects encrypted stored sessions when the persisted address does not match the decrypted private key', async () => {
    const credentialId = CREDENTIAL_ID;
    const encrypted = await encryptStoredPrivateKey(PRIVATE_KEY, credentialId);
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock({
        credentialId,
        address: TARGET_ADDRESS,
        encryptedPrivateKey: encrypted.encryptedPrivateKey,
        encryptedPrivateKeyIv: encrypted.encryptedPrivateKeyIv,
      }),
      configurable: true,
    });

    const { porto, createWalletClientMock } = loadPortoHarness();

    const restored = await porto.restoreSession();

    expect(restored).toBeNull();
    expect(createWalletClientMock).not.toHaveBeenCalled();
  });

  it('requires a passkey assertion before migrating legacy localStorage sessions', async () => {
    const credentials = setCredentialsMock({
      getImpl: async () => ({ id: 'assertion', rawId: RAW_ID }),
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock(null),
      configurable: true,
    });
    localStorage.setItem(
      PORTO_STORAGE_KEY,
      JSON.stringify({
        credentialId: CREDENTIAL_ID,
        address: BASE_ADDRESS,
        privateKey: PRIVATE_KEY,
      })
    );

    const { porto, createWalletClientMock } = loadPortoHarness();

    const restored = await porto.restoreSession();

    expect(restored).toBe(BASE_ADDRESS);
    expect(credentials.get).toHaveBeenCalledTimes(1);
    expect(createWalletClientMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PORTO_STORAGE_KEY)).toBeNull();
  });

  it('hydrates legacy localStorage session metadata without prompting when signer restore is not required', async () => {
    const credentials = setCredentialsMock({
      getImpl: async () => ({ id: 'assertion', rawId: RAW_ID }),
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock(null),
      configurable: true,
    });
    localStorage.setItem(
      PORTO_STORAGE_KEY,
      JSON.stringify({
        credentialId: CREDENTIAL_ID,
        address: BASE_ADDRESS,
        privateKey: PRIVATE_KEY,
      })
    );

    const { porto, createWalletClientMock } = loadPortoHarness();

    const restored = await porto.restoreSession({ requireSigner: false });

    expect(restored).toBe(BASE_ADDRESS);
    expect(credentials.get).not.toHaveBeenCalled();
    expect(createWalletClientMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(PORTO_STORAGE_KEY)).toBeTruthy();
    expect(await porto.createPortoProviderMock().request({ method: 'eth_accounts', params: [] })).toEqual([BASE_ADDRESS]);
  });

  it('falls back to legacy localStorage when indexedDB restore stalls', async () => {
    globalThis.CE_PORTO_RESTORE_INDEXEDDB_TIMEOUT_MS = 5;
    const credentials = setCredentialsMock({
      getImpl: async () => ({ id: 'assertion', rawId: RAW_ID }),
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock(null, {
        waitForGet: () => new Promise(() => {}),
      }),
      configurable: true,
    });
    localStorage.setItem(
      PORTO_STORAGE_KEY,
      JSON.stringify({
        credentialId: CREDENTIAL_ID,
        address: BASE_ADDRESS,
        privateKey: PRIVATE_KEY,
      })
    );

    const { porto, createWalletClientMock } = loadPortoHarness();

    const restored = await porto.restoreSession({ requireSigner: false });

    expect(restored).toBe(BASE_ADDRESS);
    expect(credentials.get).not.toHaveBeenCalled();
    expect(createWalletClientMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(PORTO_STORAGE_KEY)).toBeTruthy();
  });

  it('rejects legacy localStorage sessions when the persisted address does not match the private key', async () => {
    localStorage.setItem(
      PORTO_STORAGE_KEY,
      JSON.stringify({
        credentialId: CREDENTIAL_ID,
        address: TARGET_ADDRESS,
        privateKey: PRIVATE_KEY,
      })
    );

    const { porto, createWalletClientMock } = loadPortoHarness();

    const restored = await porto.restoreSession();

    expect(restored).toBeNull();
    expect(createWalletClientMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(PORTO_STORAGE_KEY)).toBeNull();
  });
});
