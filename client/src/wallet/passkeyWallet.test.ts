import { ethers } from 'ethers';
import {
  MissingPasskeyWalletRecordError,
  PasskeyEoaWalletClient,
  isMissingPasskeyWalletRecordError,
} from './passkeyWallet.js';
import { createMemoryWalletStorage } from './keystore/storage.js';
import { assertSoftSessionAllowed, createSoftSessionPolicy } from './session/sessionPolicy.js';
import type { PasskeyCredentialClient, PasskeyWalletConfig } from './types.js';
import { createInMemorySoftSessionClient, type SoftSessionClient } from './session/sessionWorkerClient.js';
import { bufferToBase64URL } from './passkey/encoding.js';

const PRIVATE_KEY = '0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5' as const;
const ADDRESS = new ethers.Wallet(PRIVATE_KEY).address as `0x${string}`;
const RAW_ID = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const ALT_RAW_ID = new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]);
const PRF_OUTPUT = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1)).buffer;
const ALT_PRF_OUTPUT = new Uint8Array(Array.from({ length: 32 }, (_, i) => 255 - i)).buffer;

const config: PasskeyWalletConfig = {
  rpId: 'localhost',
  rpName: 'Context Engine',
  appOrigin: 'http://localhost:3000',
  accountOrigin: 'http://localhost:3000',
  walletMode: 'passkey-eoa',
  walletKeyMode: 'encrypted-private-key',
  sessionMode: 'soft',
  unlockTtlSeconds: 60,
  allowPreviewRpId: false,
  storageMode: 'indexeddb',
  derivationNamespace: 'context-engine',
};

const derivedConfig: PasskeyWalletConfig = {
  ...config,
  walletKeyMode: 'passkey-derived',
};

const makeCredential = ({
  prf = true,
  prfOutput = PRF_OUTPUT,
  rawId = RAW_ID,
}: { prf?: boolean; prfOutput?: ArrayBuffer | null; rawId?: Uint8Array } = {}) =>
  ({
    rawId: rawId.buffer,
    getClientExtensionResults: () =>
      prf
        ? {
            prf: {
              enabled: true,
              ...(prfOutput ? { results: { first: prfOutput.slice(0) } } : {}),
            },
          }
        : {},
  }) as unknown as PublicKeyCredential;

const makeCredentials = ({
  prf = true,
  createPrfOutput = PRF_OUTPUT,
  getPrfOutput = PRF_OUTPUT,
  getRawId = RAW_ID,
}: {
  prf?: boolean;
  createPrfOutput?: ArrayBuffer | null;
  getPrfOutput?: ArrayBuffer | null;
  getRawId?: Uint8Array;
} = {}): PasskeyCredentialClient => ({
  create: jest.fn(async () => makeCredential({ prf, prfOutput: createPrfOutput })),
  get: jest.fn(async () => makeCredential({ prf, prfOutput: getPrfOutput, rawId: getRawId })),
});

const makeSessionClient = () => {
  const calls: Array<{ privateKey: string; rpcUrl: string; chainId: number }> = [];
  const client: SoftSessionClient & { calls: typeof calls; locked: boolean } = {
    calls,
    locked: false,
    async init(options) {
      calls.push({
        privateKey: options.privateKey,
        rpcUrl: options.rpcUrl,
        chainId: options.chainId,
      });
      this.locked = false;
      return ADDRESS;
    },
    async request({ method }) {
      if (method === 'personal_sign') return '0x' + '11'.repeat(65);
      if (method === 'eth_signTypedData_v4') return '0x' + '22'.repeat(65);
      if (method === 'eth_sendTransaction') return '0x' + '33'.repeat(32);
      if (method === 'eth_signTransaction') return '0x' + '44'.repeat(64);
      if (method === 'eth_accounts') return [ADDRESS];
      return null;
    },
    async lock() {
      this.locked = true;
    },
  };
  return client;
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

describe('PasskeyEoaWalletClient', () => {
  describe.each([config, derivedConfig])('persistent disconnect ($walletKeyMode)', (walletConfig) => {
    it('preserves wallet recovery but suppresses automatic restore until explicit login', async () => {
      const storage = createMemoryWalletStorage();
      const credentials = makeCredentials();
      const createClient = () =>
        new PasskeyEoaWalletClient({
          config: walletConfig,
          storage,
          credentials,
          sessionClient: makeSessionClient(),
          sessionClientFactory: makeSessionClient,
          privateKeyFactory: () => PRIVATE_KEY,
        });
      const first = createClient();
      const address = await first.createWallet();
      await first.disconnect();
      const returning = createClient();
      await expect(returning.restoreSession({ requireSigner: false })).resolves.toBeNull();
      expect(returning.getAddress()).toBeNull();
      expect(await storage.read()).toEqual(expect.objectContaining({ evmAddress: address }));
      await expect(returning.unlockWallet()).resolves.toBe(address);
      await returning.lock();
      await expect(createClient().restoreSession({ requireSigner: false })).resolves.toBe(address);
    });
  });

  beforeEach(() => {
    (globalThis as any).PublicKeyCredential = function PublicKeyCredential() {};
  });

  afterEach(() => {
    delete (globalThis as any).PublicKeyCredential;
    jest.useRealTimers();
  });

  describe.each([config, derivedConfig])('logout completion order ($walletKeyMode)', (walletConfig) => {
    const setup = () => {
      const storage = createMemoryWalletStorage();
      const credentials = makeCredentials();
      const session = makeSessionClient();
      const client = new PasskeyEoaWalletClient({
        config: walletConfig,
        storage,
        credentials,
        sessionClient: session,
        sessionClientFactory: () => session,
        privateKeyFactory: () => PRIVATE_KEY,
      });
      return { client, storage, credentials, session };
    };

    it.each(['disconnect', 'deleteWallet'] as const)('a late unlock cannot undo %s', async (end) => {
      const { client, storage, credentials, session } = setup();
      await client.createWallet();
      const reply = deferred<PublicKeyCredential>();
      const prompted = deferred<void>();
      (credentials.get as jest.Mock).mockImplementationOnce(() => {
        prompted.resolve();
        return reply.promise;
      });
      const outcome = client.unlockWallet().catch((error: unknown) => error);
      await prompted.promise;
      await client[end]();
      const savedAfterLogout = await storage.read();
      reply.resolve(makeCredential());
      expect(await outcome).toMatchObject({ code: 'CE_PASSKEY_WALLET_OPERATION_CANCELLED' });
      expect(client.isUnlocked()).toBe(false);
      expect(client.getAddress()).toBeNull();
      expect(session.locked).toBe(true);
      expect(await storage.read()).toEqual(savedAfterLogout);
      if (end === 'disconnect') expect(savedAfterLogout?.disconnected).toBe(true);
      else expect(savedAfterLogout).toBeNull();
    });

    it('a late create cannot activate or save after logout', async () => {
      const { client, storage, credentials, session } = setup();
      const reply = deferred<PublicKeyCredential>();
      const prompted = deferred<void>();
      (credentials.create as jest.Mock).mockImplementationOnce(() => {
        prompted.resolve();
        return reply.promise;
      });
      const outcome = client.createWallet().catch((error: unknown) => error);
      await prompted.promise;
      await client.disconnect();
      reply.resolve(makeCredential({ prfOutput: null }));
      expect(await outcome).toMatchObject({ code: 'CE_PASSKEY_WALLET_OPERATION_CANCELLED' });
      expect(credentials.get).not.toHaveBeenCalled();
      expect(session.calls).toHaveLength(0);
      expect(client.getAddress()).toBeNull();
      expect(await storage.read()).toBeNull();
    });

    it('logout waits for signer initialization to finish and leaves it locked', async () => {
      const { client, storage, session } = setup();
      const initialized = deferred<string>();
      const started = deferred<void>();
      jest.spyOn(session, 'init').mockImplementationOnce(async () => {
        started.resolve();
        await initialized.promise;
        session.locked = false;
        return ADDRESS;
      });
      const outcome = client.createWallet().catch((error: unknown) => error);
      await started.promise;
      const logout = client.disconnect();
      initialized.resolve(ADDRESS);
      await logout;
      expect(await outcome).toMatchObject({ code: 'CE_PASSKEY_WALLET_OPERATION_CANCELLED' });
      expect(session.locked).toBe(true);
      expect(client.getAddress()).toBeNull();
      expect((await storage.read())?.disconnected).toBe(true);
    });

    it.each(['success', 'locked'] as const)(
      'logout cancels a pending signature with a late %s reply',
      async (replyKind) => {
        const { client, credentials, session } = setup();
        const address = await client.createWallet();
        const reply = deferred<unknown>();
        const requested = deferred<void>();
        jest.spyOn(session, 'request').mockImplementationOnce(() => {
          requested.resolve();
          return reply.promise;
        });
        const outcome = client.signMessage('synthetic message', address).catch((error: unknown) => error);
        await requested.promise;
        await client.disconnect();
        if (replyKind === 'locked') reply.reject(new Error('Passkey wallet is locked.'));
        else reply.resolve('0x' + '11'.repeat(65));
        expect(await outcome).toMatchObject({ code: 'CE_PASSKEY_WALLET_OPERATION_CANCELLED' });
        expect(credentials.get).not.toHaveBeenCalled();
        expect(client.isUnlocked()).toBe(false);
      },
    );
  });

  it('logout remains final when an earlier metadata write completes late', async () => {
    const storage = createMemoryWalletStorage();
    const credentials = makeCredentials();
    const session = makeSessionClient();
    const client = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage,
      credentials,
      sessionClient: session,
      sessionClientFactory: () => session,
    });
    await client.createWallet();
    const release = deferred<void>();
    const started = deferred<void>();
    const write = storage.write.bind(storage);
    jest.spyOn(storage, 'write').mockImplementationOnce(async (record) => {
      started.resolve();
      await release.promise;
      await write(record);
    });
    const outcome = client.unlockWallet().catch((error: unknown) => error);
    await started.promise;
    const logout = client.disconnect();
    release.resolve();
    await logout;
    expect(await outcome).toMatchObject({ code: 'CE_PASSKEY_WALLET_OPERATION_CANCELLED' });
    expect((await storage.read())?.disconnected).toBe(true);
    expect(session.locked).toBe(true);
    expect(client.getAddress()).toBeNull();
  });

  it('a replacing create cancels an earlier unlock without changing the new wallet', async () => {
    const storage = createMemoryWalletStorage();
    const credentials = makeCredentials();
    const client = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage,
      credentials,
      sessionClient: makeSessionClient(),
      sessionClientFactory: makeSessionClient,
    });
    await client.createWallet();
    const reply = deferred<PublicKeyCredential>();
    const prompted = deferred<void>();
    (credentials.get as jest.Mock).mockImplementationOnce(() => {
      prompted.resolve();
      return reply.promise;
    });
    const outcome = client.unlockWallet().catch((error: unknown) => error);
    await prompted.promise;
    (credentials.create as jest.Mock).mockImplementationOnce(async () =>
      makeCredential({ rawId: ALT_RAW_ID, prfOutput: ALT_PRF_OUTPUT }),
    );
    const replacementAddress = await client.createWallet();
    const replacement = await storage.read();
    reply.resolve(makeCredential());
    expect(await outcome).toMatchObject({ code: 'CE_PASSKEY_WALLET_OPERATION_CANCELLED' });
    expect(await storage.read()).toEqual(replacement);
    expect(client.getAddress()).toBe(replacementAddress);
    expect(client.isUnlocked()).toBe(true);
    await client.lock();
  });

  it('TTL expiry still permits one fresh unlock for a signature', async () => {
    let now = Date.now();
    const credentials = makeCredentials();
    const session = makeSessionClient();
    const client = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage: createMemoryWalletStorage(),
      credentials,
      sessionClient: session,
      sessionClientFactory: () => session,
      now: () => now,
    });
    const address = await client.createWallet();
    now += 61000;
    await expect(client.signMessage('after expiry', address)).resolves.toMatch(/^0x11/);
    expect(credentials.get).toHaveBeenCalledTimes(1);
    expect(session.calls).toHaveLength(2);
    await client.lock();
  });

  it.each([
    ['encrypted private-key', config],
    ['passkey-derived', derivedConfig],
  ])('uses registration PRF output without a follow-up sign-in for %s creation', async (_label, walletConfig) => {
    const credentials = makeCredentials();
    const client = new PasskeyEoaWalletClient({
      config: walletConfig,
      storage: createMemoryWalletStorage(),
      credentials,
      sessionClient: makeSessionClient(),
      privateKeyFactory: () => PRIVATE_KEY,
    });

    await client.createWallet();

    expect(credentials.create).toHaveBeenCalledTimes(1);
    expect(credentials.get).not.toHaveBeenCalled();
  });

  it.each([
    ['encrypted private-key', config, true],
    ['passkey-derived', derivedConfig, false],
  ])('creates a second %s wallet with the saved passkey excluded: %s', async (_label, walletConfig, excluded) => {
    const storage = createMemoryWalletStorage();
    const credentials = makeCredentials();
    const createClient = () =>
      new PasskeyEoaWalletClient({
        config: walletConfig,
        storage,
        credentials,
        sessionClient: makeSessionClient(),
        privateKeyFactory: () => PRIVATE_KEY,
      });
    await createClient().createWallet();
    const saved = await storage.read();
    await createClient().createWallet();

    const [firstOptions, secondOptions] = (credentials.create as jest.Mock).mock.calls.map(
      ([options]) => (options as CredentialCreationOptions).publicKey,
    );
    expect(firstOptions).not.toHaveProperty('excludeCredentials');
    const secondExclusions = secondOptions?.excludeCredentials || [];
    expect(secondExclusions.map(({ id }) => bufferToBase64URL(id as ArrayBuffer))).toEqual(
      excluded ? [saved?.credentialId] : [],
    );
  });

  it('falls back to one assertion when registration reports PRF support without returning output', async () => {
    const credentials = makeCredentials({ createPrfOutput: null });
    const client = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage: createMemoryWalletStorage(),
      credentials,
      sessionClient: makeSessionClient(),
    });

    await client.createWallet();

    expect(credentials.create).toHaveBeenCalledTimes(1);
    expect(credentials.get).toHaveBeenCalledTimes(1);
  });

  it('creates an encrypted EOA record without persisting plaintext private keys', async () => {
    const storage = createMemoryWalletStorage();
    const sessionClient = makeSessionClient();
    const client = new PasskeyEoaWalletClient({
      config,
      storage,
      credentials: makeCredentials(),
      sessionClient,
      privateKeyFactory: () => PRIVATE_KEY,
    });

    await expect(client.createWallet()).resolves.toBe(ADDRESS);
    const stored = await storage.read();

    expect(stored).toEqual(
      expect.objectContaining({
        rpId: 'localhost',
        credentialId: expect.any(String),
        evmAddress: ADDRESS,
        encryptionVersion: 'passkey-prf-aes-gcm-v1',
      }),
    );
    expect(JSON.stringify(stored)).not.toContain(PRIVATE_KEY.slice(2));
    expect(sessionClient.calls[0].privateKey).toBe(PRIVATE_KEY);
  });

  it('unlocks a returning wallet and supports sign/send requests through the session client', async () => {
    const storage = createMemoryWalletStorage();
    const firstSession = makeSessionClient();
    const first = new PasskeyEoaWalletClient({
      config,
      storage,
      credentials: makeCredentials(),
      sessionClient: firstSession,
      privateKeyFactory: () => PRIVATE_KEY,
    });
    await first.createWallet();
    await first.disconnect();

    const sessionClient = makeSessionClient();
    const returning = new PasskeyEoaWalletClient({
      config,
      storage,
      credentials: makeCredentials(),
      sessionClient,
      privateKeyFactory: () => {
        throw new Error('should not create a new private key');
      },
    });

    await expect(returning.unlockWallet()).resolves.toBe(ADDRESS);
    await expect(returning.signMessage('hello')).resolves.toMatch(/^0x11/);
    await expect(
      returning.signTypedData({
        domain: { name: 'Context Engine' },
        types: { Message: [{ name: 'contents', type: 'string' }] },
        primaryType: 'Message',
        message: { contents: 'hello' },
      }),
    ).resolves.toMatch(/^0x22/);
    await expect(returning.sendTransaction({ to: ADDRESS, value: '0x0' })).resolves.toMatch(/^0x33/);
  });

  it('unlocks a passkey-derived EOA from the passkey after local wallet storage is cleared', async () => {
    const storage = createMemoryWalletStorage();
    const createCredentials = makeCredentials();
    const first = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage,
      credentials: createCredentials,
      sessionClient: makeSessionClient(),
      privateKeyFactory: () => {
        throw new Error('derived mode must not generate a random key');
      },
    });

    const createdAddress = await first.createWallet();
    const storedMetadata = await storage.read();
    expect(storedMetadata).toEqual(
      expect.objectContaining({
        keyMode: 'passkey-derived',
        evmAddress: createdAddress,
        derivationVersion: 'passkey-prf-hkdf-secp256k1-v1',
        prfSalt: expect.any(String),
      }),
    );
    expect(JSON.stringify(storedMetadata)).not.toContain('encryptedPrivateKey');
    await first.disconnect();
    await storage.clear();

    const unlockCredentials = makeCredentials();
    const sessionClient = makeSessionClient();
    const returning = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage,
      credentials: unlockCredentials,
      sessionClient,
      privateKeyFactory: () => {
        throw new Error('derived mode must not generate a random key');
      },
    });

    await expect(returning.unlockWallet()).resolves.toBe(createdAddress);
    expect(unlockCredentials.get).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: expect.not.objectContaining({
          allowCredentials: expect.anything(),
        }),
      }),
    );
    expect(sessionClient.calls[0].privateKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(sessionClient.calls[0].privateKey).not.toBe(PRIVATE_KEY);
  });

  it('targets the stored passkey credential when re-unlocking a derived wallet', async () => {
    const storage = createMemoryWalletStorage();
    const first = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage,
      credentials: makeCredentials(),
      sessionClient: makeSessionClient(),
    });
    const createdAddress = await first.createWallet();
    const stored = await storage.read();
    await first.disconnect();

    const returningCredentials = makeCredentials();
    const returning = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage,
      credentials: returningCredentials,
      sessionClient: makeSessionClient(),
    });

    await expect(returning.unlockWallet()).resolves.toBe(createdAddress);
    const request = (returningCredentials.get as jest.Mock).mock.calls[0][0] as CredentialRequestOptions;
    expect(request.publicKey?.allowCredentials).toHaveLength(1);
    expect(bufferToBase64URL(request.publicKey?.allowCredentials?.[0].id as ArrayBuffer)).toBe(stored?.credentialId);
  });

  it('invites the platform passkey chooser during explicit login and adopts the selected wallet', async () => {
    const storage = createMemoryWalletStorage();
    const first = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage,
      credentials: makeCredentials(),
      sessionClient: makeSessionClient(),
    });
    const firstAddress = await first.createWallet();
    await first.disconnect();

    const chooserCredentials = makeCredentials({
      getPrfOutput: ALT_PRF_OUTPUT,
      getRawId: ALT_RAW_ID,
    });
    const returning = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage,
      credentials: chooserCredentials,
      sessionClient: makeSessionClient(),
    });

    const selectedAddress = await returning.unlockWallet({ selectCredential: true });
    const request = (chooserCredentials.get as jest.Mock).mock.calls[0][0];

    expect(request.publicKey).not.toHaveProperty('allowCredentials');
    expect(selectedAddress).not.toBe(firstAddress);
    expect(await storage.read()).toEqual(
      expect.objectContaining({
        credentialId: bufferToBase64URL(ALT_RAW_ID.buffer),
        evmAddress: selectedAddress,
      }),
    );
  });

  it('does not persist or log PRF output or derived private keys', async () => {
    const storage = createMemoryWalletStorage();
    const sessionClient = makeSessionClient();
    const consoleSpies = (['log', 'info', 'debug', 'warn', 'error'] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => {}),
    );
    try {
      const client = new PasskeyEoaWalletClient({
        config: derivedConfig,
        storage,
        credentials: makeCredentials(),
        sessionClient,
        privateKeyFactory: () => {
          throw new Error('derived mode must not generate a random key');
        },
      });

      await client.createWallet();
      const storedJson = JSON.stringify(await storage.read());
      const derivedPrivateKey = sessionClient.calls[0].privateKey;
      const prfBase64Url = bufferToBase64URL(PRF_OUTPUT);
      const prfHex = Buffer.from(new Uint8Array(PRF_OUTPUT)).toString('hex');
      const logPayload = consoleSpies
        .flatMap((spy) => spy.mock.calls)
        .flatMap((args) =>
          args.map((arg) => {
            try {
              return JSON.stringify(arg);
            } catch (_) {
              return String(arg);
            }
          }),
        )
        .join('\n');

      for (const sensitive of [derivedPrivateKey, derivedPrivateKey.slice(2), prfBase64Url, prfHex]) {
        expect(storedJson).not.toContain(sensitive);
        expect(logPayload).not.toContain(sensitive);
      }
    } finally {
      consoleSpies.forEach((spy) => spy.mockRestore());
    }
  });

  it('re-unlocks and retries a signature once when the soft-session worker has locked', async () => {
    const storage = createMemoryWalletStorage();
    const credentials = makeCredentials();
    const sessionClient = makeSessionClient();
    const requestSpy = jest.spyOn(sessionClient, 'request');
    requestSpy.mockImplementation(async ({ method }) => {
      if (method === 'personal_sign' && requestSpy.mock.calls.length === 1) {
        throw new Error('Passkey wallet is locked.');
      }
      if (method === 'personal_sign') return '0x' + '11'.repeat(65);
      return null;
    });
    const client = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage,
      credentials,
      sessionClient,
      sessionClientFactory: () => sessionClient,
      privateKeyFactory: () => {
        throw new Error('derived mode must not generate a random key');
      },
    });

    const address = await client.createWallet();
    expect(client.isUnlocked()).toBe(true);

    await expect(client.signMessage('hello', address)).resolves.toMatch(/^0x11/);

    expect(credentials.get).toHaveBeenCalledTimes(1);
    expect(sessionClient.calls).toHaveLength(2);
    expect(requestSpy).toHaveBeenCalledTimes(2);
    expect(sessionClient.locked).toBe(false);
    expect(client.isUnlocked()).toBe(true);
  });

  it('routes passkey provider balance reads through the cached read provider', async () => {
    const readProvider = {
      getBalance: jest.fn().mockResolvedValue(ethers.BigNumber.from(5)),
    };
    const readProviderFactory = jest.fn(() => readProvider);
    const client = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage: createMemoryWalletStorage(),
      credentials: makeCredentials(),
      sessionClient: makeSessionClient(),
      readProviderFactory,
      privateKeyFactory: () => {
        throw new Error('derived mode must not generate a random key');
      },
    });

    await expect(
      client.request({
        method: 'eth_getBalance',
        params: [ADDRESS, 'latest'],
      }),
    ).resolves.toBe('0x5');

    expect(readProviderFactory).toHaveBeenCalledWith(11155420);
    expect(readProvider.getBalance).toHaveBeenCalledWith(ADDRESS, 'latest');
  });

  it('falls back through cached read provider configs for unsupported raw read methods', async () => {
    const firstProvider = {
      send: jest.fn().mockRejectedValue(Object.assign(new Error('Too Many Requests'), { status: 429 })),
    };
    const secondProvider = {
      send: jest.fn().mockResolvedValue('0x1234'),
    };
    const client = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage: createMemoryWalletStorage(),
      credentials: makeCredentials(),
      sessionClient: makeSessionClient(),
      readProviderFactory: jest.fn(() => ({
        providerConfigs: [
          { priority: 2, provider: secondProvider },
          { priority: 1, provider: firstProvider },
        ],
      })),
      privateKeyFactory: () => {
        throw new Error('derived mode must not generate a random key');
      },
    });

    await expect(
      client.request({
        method: 'eth_feeHistory',
        params: ['0x1', 'latest', []],
      }),
    ).resolves.toBe('0x1234');

    expect(firstProvider.send).toHaveBeenCalledWith('eth_feeHistory', ['0x1', 'latest', []]);
    expect(secondProvider.send).toHaveBeenCalledWith('eth_feeHistory', ['0x1', 'latest', []]);
  });

  it('fails closed before WebAuthn when no encrypted wallet record is stored', async () => {
    const credentials = makeCredentials();
    const client = new PasskeyEoaWalletClient({
      config,
      storage: createMemoryWalletStorage(),
      credentials,
      sessionClient: makeSessionClient(),
      privateKeyFactory: () => PRIVATE_KEY,
    });

    let thrown: unknown = null;
    await client.unlockWallet().catch((error) => {
      thrown = error;
    });

    expect(thrown).toBeInstanceOf(MissingPasskeyWalletRecordError);
    expect(isMissingPasskeyWalletRecordError(thrown)).toBe(true);
    expect(credentials.get).not.toHaveBeenCalled();
  });

  it('fails safely when WebAuthn PRF is unsupported', async () => {
    const client = new PasskeyEoaWalletClient({
      config,
      storage: createMemoryWalletStorage(),
      credentials: makeCredentials({ prf: false }),
      sessionClient: makeSessionClient(),
      privateKeyFactory: () => PRIVATE_KEY,
    });

    await expect(client.createWallet()).rejects.toThrow(/PRF/i);
  });

  it('locks the signer if restoring an explicit connection cannot be persisted', async () => {
    const storage = createMemoryWalletStorage();
    const sessionClient = makeSessionClient();
    const client = new PasskeyEoaWalletClient({
      config,
      storage,
      credentials: makeCredentials(),
      sessionClient,
      sessionClientFactory: () => sessionClient,
      privateKeyFactory: () => PRIVATE_KEY,
    });
    await client.createWallet();
    await client.disconnect();
    jest.spyOn(storage, 'write').mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(client.unlockWallet()).rejects.toThrow('Storage unavailable');
    expect(sessionClient.calls).toHaveLength(2);
    expect(sessionClient.locked).toBe(true);
    expect(client.isUnlocked()).toBe(false);
    expect((await storage.read())?.disconnected).toBe(true);
  });

  it('locks the in-memory signer without deleting the encrypted wallet record', async () => {
    const storage = createMemoryWalletStorage();
    const sessionClient = makeSessionClient();
    const client = new PasskeyEoaWalletClient({
      config,
      storage,
      credentials: makeCredentials(),
      sessionClient,
      privateKeyFactory: () => PRIVATE_KEY,
    });

    await client.createWallet();
    await client.disconnect();

    expect(sessionClient.locked).toBe(true);
    expect(client.getAddress()).toBeNull();
    expect(await storage.read()).toEqual(expect.objectContaining({ evmAddress: ADDRESS }));
  });

  it('keeps the account discoverable without reporting signer readiness after lock or signerless restore', async () => {
    const storage = createMemoryWalletStorage();
    const credentials = makeCredentials();
    const client = new PasskeyEoaWalletClient({
      config,
      storage,
      credentials,
      sessionClient: makeSessionClient(),
      sessionClientFactory: () => makeSessionClient(),
      privateKeyFactory: () => PRIVATE_KEY,
    });

    await client.createWallet();
    expect(client.isUnlocked()).toBe(true);
    expect(client.hasSigner()).toBe(true);

    await client.lock();
    expect(client.getAddress()).toBe(ADDRESS);
    expect(client.isUnlocked()).toBe(false);
    expect(client.hasSigner()).toBe(false);
    expect(await storage.read()).toEqual(expect.objectContaining({ evmAddress: ADDRESS }));

    const returning = new PasskeyEoaWalletClient({
      config,
      storage,
      credentials,
      sessionClient: makeSessionClient(),
      sessionClientFactory: () => makeSessionClient(),
      privateKeyFactory: () => PRIVATE_KEY,
    });
    await expect(returning.restoreSession({ requireSigner: false })).resolves.toBe(ADDRESS);
    expect(returning.getAddress()).toBe(ADDRESS);
    expect(returning.isUnlocked()).toBe(false);
    expect(returning.hasSigner()).toBe(false);
    expect(credentials.get).not.toHaveBeenCalled();

    await expect(returning.signMessage('unlock me')).resolves.toMatch(/^0x11/);
    expect(credentials.get).toHaveBeenCalledTimes(1);
    expect(returning.isUnlocked()).toBe(true);
  });
});

describe('PasskeyEoaWalletClient account binding', () => {
  const OTHER_ACCOUNT = '0x00000000000000000000000000000000000000Bb';
  const TYPED_DATA = {
    domain: { name: 'Context Engine' },
    types: { Message: [{ name: 'contents', type: 'string' }] },
    primaryType: 'Message',
    message: { contents: 'hello' },
  };

  beforeEach(() => {
    (globalThis as any).PublicKeyCredential = function PublicKeyCredential() {};
  });

  afterEach(() => {
    delete (globalThis as any).PublicKeyCredential;
  });

  it('rejects EIP-1193 signing for an account other than the unlocked wallet', async () => {
    const sessionClient = makeSessionClient();
    const requestSpy = jest.spyOn(sessionClient, 'request');
    const client = new PasskeyEoaWalletClient({
      config,
      storage: createMemoryWalletStorage(),
      credentials: makeCredentials(),
      sessionClient,
      privateKeyFactory: () => PRIVATE_KEY,
    });
    const address = await client.createWallet();
    const provider = client.createProvider();

    for (const request of [
      { method: 'personal_sign', params: ['0x68656c6c6f', OTHER_ACCOUNT] },
      { method: 'eth_signTypedData_v4', params: [OTHER_ACCOUNT, JSON.stringify(TYPED_DATA)] },
      { method: 'eth_sendTransaction', params: [{ from: OTHER_ACCOUNT, to: address, value: '0x0' }] },
      { method: 'eth_signTransaction', params: [{ from: OTHER_ACCOUNT, to: address, value: '0x0' }] },
    ]) {
      await expect(provider.request(request)).rejects.toMatchObject({ code: 4100 });
    }
    expect(requestSpy).not.toHaveBeenCalled();

    await expect(
      provider.request({ method: 'personal_sign', params: ['0x68656c6c6f', address.toLowerCase()] }),
    ).resolves.toMatch(/^0x11/);
    await expect(
      provider.request({ method: 'eth_signTypedData_v4', params: [address, JSON.stringify(TYPED_DATA)] }),
    ).resolves.toMatch(/^0x22/);
    await client.lock();
  });

  it.each([
    ['encrypted private-key', config],
    ['passkey-derived', derivedConfig],
  ])('keeps the %s account when another tab saves a different wallet', async (_label, walletConfig) => {
    const storage = createMemoryWalletStorage();
    let now = Date.now();
    const firstCredentials = makeCredentials();
    const first = new PasskeyEoaWalletClient({
      config: walletConfig,
      storage,
      credentials: firstCredentials,
      sessionClient: makeSessionClient(),
      sessionClientFactory: makeSessionClient,
      privateKeyFactory: () => PRIVATE_KEY,
      now: () => now,
    });
    const firstAddress = await first.createWallet();
    const second = new PasskeyEoaWalletClient({
      config: walletConfig,
      storage,
      credentials: makeCredentials({ createPrfOutput: ALT_PRF_OUTPUT, getPrfOutput: ALT_PRF_OUTPUT }),
      sessionClient: makeSessionClient(),
      privateKeyFactory: () => `0x${'42'.repeat(32)}` as `0x${string}`,
    });
    const secondAddress = await second.createWallet();
    await second.lock();
    expect(secondAddress).not.toBe(firstAddress);

    now += walletConfig.unlockTtlSeconds * 1000 + 1;
    await expect(first.signTypedData(TYPED_DATA)).rejects.toMatchObject({ code: 4100 });
    await expect(
      first.createProvider().request({ method: 'eth_signTypedData_v4', params: [firstAddress, TYPED_DATA] }),
    ).rejects.toMatchObject({ code: 4100 });

    expect(firstCredentials.get).not.toHaveBeenCalled();
    expect(first.getAddress()).toBe(firstAddress);
    expect((await storage.read())?.evmAddress).toBe(secondAddress);
    await first.lock();
  });

  it('locks the signer when the app switches chains and re-unlocks on the new chain', async () => {
    const credentials = makeCredentials();
    const firstSession = makeSessionClient();
    const nextSession = makeSessionClient();
    const client = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage: createMemoryWalletStorage(),
      credentials,
      sessionClient: firstSession,
      sessionClientFactory: () => nextSession,
    });
    const address = await client.createWallet();
    expect(firstSession.calls[0].chainId).toBe(11155420);

    client.setChain(11155420);
    expect(client.isUnlocked()).toBe(true);
    expect(firstSession.locked).toBe(false);

    client.setChain(84532);
    expect(client.isUnlocked()).toBe(false);
    expect(firstSession.locked).toBe(true);
    await expect(client.request({ method: 'eth_chainId' })).resolves.toBe('0x14a34');

    await expect(client.signMessage('hello', address)).resolves.toMatch(/^0x11/);
    expect(credentials.get).toHaveBeenCalledTimes(1);
    expect(nextSession.calls.map((call) => call.chainId)).toEqual([84532]);
    expect(client.isUnlocked()).toBe(true);
    await client.lock();
  });

  it('unlocks only the requested account when the app has no active wallet yet', async () => {
    const storage = createMemoryWalletStorage();
    const creator = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage,
      credentials: makeCredentials(),
      sessionClient: makeSessionClient(),
    });
    const address = await creator.createWallet();
    await creator.lock();
    const credentials = makeCredentials();
    const returning = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage,
      credentials,
      sessionClient: makeSessionClient(),
    });

    await expect(returning.signMessage('hello', OTHER_ACCOUNT)).rejects.toMatchObject({ code: 4100 });
    expect(credentials.get).not.toHaveBeenCalled();
    await expect(returning.signMessage('hello', address)).resolves.toMatch(/^0x11/);
    expect(returning.getAddress()).toBe(address);
    await returning.lock();
  });
});

// Like the worker session client: requests stay in flight until released, and
// lock() rejects whatever is still in flight. A transaction is broadcast as
// soon as the session receives it.
type FakeSession = {
  chainId: number;
  locked: boolean;
  pendingCount: () => number;
  release: () => void;
};

const makeFakeSessions = (broadcasts: number[]) => {
  const sessions: FakeSession[] = [];
  const create = (): SoftSessionClient => {
    const pending: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
    const session: FakeSession = {
      chainId: 0,
      locked: false,
      pendingCount: () => pending.length,
      release: () => pending.splice(0).forEach(({ resolve }) => resolve()),
    };
    sessions.push(session);
    return {
      async init(options) {
        session.chainId = options.chainId;
        return ADDRESS;
      },
      request({ method }) {
        const chainId = session.chainId;
        if (method === 'eth_sendTransaction') broadcasts.push(chainId);
        return new Promise((resolve, reject) =>
          pending.push({ resolve: () => resolve(`${method}-on-${chainId}`), reject }),
        );
      },
      async lock() {
        session.locked = true;
        pending.splice(0).forEach(({ reject }) => reject(new Error('Passkey wallet is locked.')));
      },
    };
  };
  return { sessions, create };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const flushUntil = async (condition: () => boolean) => {
  for (let attempt = 0; attempt < 50 && !condition(); attempt += 1) await flush();
};

describe('PasskeyEoaWalletClient requests in flight', () => {
  beforeEach(() => {
    (globalThis as any).PublicKeyCredential = function PublicKeyCredential() {};
  });

  afterEach(() => {
    delete (globalThis as any).PublicKeyCredential;
  });

  const setup = async () => {
    const broadcasts: number[] = [];
    const { sessions, create } = makeFakeSessions(broadcasts);
    const credentials = makeCredentials();
    const client = new PasskeyEoaWalletClient({
      config: derivedConfig,
      storage: createMemoryWalletStorage(),
      credentials,
      sessionClient: create(),
      sessionClientFactory: create,
    });
    const address = await client.createWallet();
    return { address, broadcasts, client, credentials, sessions };
  };

  it('lets a transaction in flight finish on its own chain when the app switches chains', async () => {
    const { address, broadcasts, client, credentials, sessions } = await setup();
    const tx = client.sendTransaction({ from: address, to: address, value: '0x0' });
    await flush();

    client.setChain(84532);
    expect(sessions[0].locked).toBe(false);
    sessions[0].release();

    await expect(tx).resolves.toBe('eth_sendTransaction-on-11155420');
    await flush();
    expect(sessions[0].locked).toBe(true);
    expect(broadcasts).toEqual([11155420]);
    expect(credentials.get).not.toHaveBeenCalled();

    const signature = client.signMessage('hello', address);
    await flushUntil(() => sessions.some((session) => session.pendingCount() > 0));
    sessions.forEach((session) => session.release());
    await expect(signature).resolves.toBe('personal_sign-on-84532');
    expect(credentials.get).toHaveBeenCalledTimes(1);
    await client.lock();
  });

  it('never resends a transaction that a lock cut off', async () => {
    const { address, broadcasts, client, credentials } = await setup();
    const tx = client.sendTransaction({ from: address, to: address, value: '0x0' });
    await flush();

    await client.lock(); // e.g. the unlock TTL ends while the transaction is in flight

    await expect(tx).rejects.toThrow(/may already have been sent/);
    expect(broadcasts).toEqual([11155420]);
    expect(credentials.get).not.toHaveBeenCalled();
  });

  it('says a transaction may have been sent when a lock cuts it off after a chain switch', async () => {
    const { address, broadcasts, client } = await setup();
    const tx = client.sendTransaction({ from: address, to: address, value: '0x0' });
    await flush();

    client.setChain(84532);
    await client.lock(); // e.g. sign-out while the transaction finishes on 11155420

    await expect(tx).rejects.toThrow(/may already have been sent/);
    expect(broadcasts).toEqual([11155420]);
  });

  it('reports a network change when a lock interrupts a retry sent before the switch', async () => {
    const { address, client, sessions } = await setup();
    const signature = client.signMessage('hello', address);
    await flush();

    await client.lock();
    await flushUntil(() => sessions.slice(1).some((session) => session.pendingCount() > 0));
    client.setChain(84532);
    await client.lock();

    await expect(signature).rejects.toMatchObject({ code: 4901 });
  });
});

describe('soft session policy', () => {
  it('expires sessions and rejects value-bearing transactions by default', () => {
    const policy = createSoftSessionPolicy({
      address: ADDRESS,
      ttlSeconds: 1,
      now: 1000,
    });

    expect(() =>
      assertSoftSessionAllowed({
        policy,
        method: 'personal_sign',
        now: 1500,
      }),
    ).not.toThrow();
    expect(() =>
      assertSoftSessionAllowed({
        policy,
        method: 'personal_sign',
        now: 2500,
      }),
    ).toThrow(/expired/i);
    expect(() =>
      assertSoftSessionAllowed({
        policy,
        method: 'eth_sendTransaction',
        tx: { to: ADDRESS, value: '0x1' },
        now: 1500,
      }),
    ).toThrow(/value-bearing/i);
  });

  it('requires explicit policy permission for raw transaction signing', async () => {
    const sessionClient = createInMemorySoftSessionClient();
    const policy = createSoftSessionPolicy({
      address: ADDRESS,
      ttlSeconds: 60,
      allowedChainIds: [11155420],
    });
    await sessionClient.init({
      privateKey: PRIVATE_KEY,
      rpcUrl: 'http://127.0.0.1:1',
      chainId: 11155420,
      policy,
    });

    await expect(
      sessionClient.request({
        method: 'eth_signTransaction',
        params: [
          {
            from: ADDRESS,
            to: ADDRESS,
            chainId: 11155420,
            value: '0x0',
            nonce: 0,
            gasLimit: 21000,
          },
        ],
      }),
    ).rejects.toThrow(/does not allow eth_signTransaction/i);
  });

  it('does not forward unsupported session methods to the raw RPC provider', async () => {
    const sessionClient = createInMemorySoftSessionClient();
    const policy = createSoftSessionPolicy({
      address: ADDRESS,
      ttlSeconds: 60,
      allowedChainIds: [11155420],
    });
    await sessionClient.init({
      privateKey: PRIVATE_KEY,
      rpcUrl: 'http://127.0.0.1:1',
      chainId: 11155420,
      policy,
    });

    await expect(
      sessionClient.request({
        method: 'eth_feeHistory',
        params: ['0x1', 'latest', []],
      }),
    ).rejects.toThrow(/Unsupported passkey session method: eth_feeHistory/i);
  });

  it('applies sender, chain, target, and value policy to raw transaction signing', () => {
    const policy = createSoftSessionPolicy({
      address: ADDRESS,
      ttlSeconds: 60,
      now: 1000,
      allowedMethods: ['personal_sign', 'eth_signTypedData_v4', 'eth_sendTransaction', 'eth_signTransaction'],
      allowedChainIds: [11155420],
      allowedTargets: [ADDRESS],
      maxTransactionValueWei: '0',
    });
    const allowedTx = {
      from: ADDRESS,
      to: ADDRESS,
      chainId: 11155420,
      value: '0x0',
    };

    expect(() =>
      assertSoftSessionAllowed({
        policy,
        method: 'eth_signTransaction',
        tx: allowedTx,
        chainId: 11155420,
        now: 1500,
      }),
    ).not.toThrow();
    expect(() =>
      assertSoftSessionAllowed({
        policy,
        method: 'eth_signTransaction',
        tx: { ...allowedTx, from: '0x0000000000000000000000000000000000000001' },
        chainId: 11155420,
        now: 1500,
      }),
    ).toThrow(/sender/i);
    expect(() =>
      assertSoftSessionAllowed({
        policy,
        method: 'eth_signTransaction',
        tx: { ...allowedTx, chainId: 84532 },
        chainId: 11155420,
        now: 1500,
      }),
    ).toThrow(/active chain/i);
    expect(() =>
      assertSoftSessionAllowed({
        policy,
        method: 'eth_signTransaction',
        tx: { ...allowedTx, to: '0x0000000000000000000000000000000000000002' },
        chainId: 11155420,
        now: 1500,
      }),
    ).toThrow(/target/i);
    expect(() =>
      assertSoftSessionAllowed({
        policy,
        method: 'eth_signTransaction',
        tx: { ...allowedTx, value: '0x1' },
        chainId: 11155420,
        now: 1500,
      }),
    ).toThrow(/value-bearing/i);
  });
});
