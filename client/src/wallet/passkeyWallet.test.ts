import { ethers } from 'ethers';
import {
  MissingPasskeyWalletRecordError,
  PasskeyEoaWalletClient,
  isMissingPasskeyWalletRecordError,
} from './passkeyWallet.js';
import { createMemoryWalletStorage } from './keystore/storage.js';
import { assertSoftSessionAllowed, createSoftSessionPolicy } from './session/sessionPolicy.js';
import type { PasskeyCredentialClient, PasskeyWalletConfig } from './types.js';
import type { SoftSessionClient } from './session/sessionWorkerClient.js';

const PRIVATE_KEY = '0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5' as const;
const ADDRESS = new ethers.Wallet(PRIVATE_KEY).address as `0x${string}`;
const RAW_ID = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const PRF_OUTPUT = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1)).buffer;

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

const makeCredential = ({ prf = true, prfOutput = PRF_OUTPUT } = {}) => ({
  rawId: RAW_ID.buffer,
  getClientExtensionResults: () => (
    prf
      ? { prf: { enabled: true, results: { first: prfOutput.slice(0) } } }
      : {}
  ),
}) as unknown as PublicKeyCredential;

const makeCredentials = ({ prf = true } = {}): PasskeyCredentialClient => ({
  create: jest.fn(async () => makeCredential({ prf })),
  get: jest.fn(async () => makeCredential({ prf })),
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

describe('PasskeyEoaWalletClient', () => {
  beforeEach(() => {
    (globalThis as any).PublicKeyCredential = function PublicKeyCredential() {};
  });

  afterEach(() => {
    delete (globalThis as any).PublicKeyCredential;
    jest.useRealTimers();
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

    expect(stored).toEqual(expect.objectContaining({
      rpId: 'localhost',
      credentialId: expect.any(String),
      evmAddress: ADDRESS,
      encryptionVersion: 'passkey-prf-aes-gcm-v1',
    }));
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
      privateKeyFactory: () => { throw new Error('should not create a new private key'); },
    });

    await expect(returning.unlockWallet()).resolves.toBe(ADDRESS);
    await expect(returning.signMessage('hello')).resolves.toMatch(/^0x11/);
    await expect(returning.signTypedData({
      domain: { name: 'Context Engine' },
      types: { Message: [{ name: 'contents', type: 'string' }] },
      primaryType: 'Message',
      message: { contents: 'hello' },
    })).resolves.toMatch(/^0x22/);
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
      privateKeyFactory: () => { throw new Error('derived mode must not generate a random key'); },
    });

    const createdAddress = await first.createWallet();
    const storedMetadata = await storage.read();
    expect(storedMetadata).toEqual(expect.objectContaining({
      keyMode: 'passkey-derived',
      evmAddress: createdAddress,
      derivationVersion: 'passkey-prf-hkdf-secp256k1-v1',
      prfSalt: expect.any(String),
    }));
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
      privateKeyFactory: () => { throw new Error('derived mode must not generate a random key'); },
    });

    await expect(returning.unlockWallet()).resolves.toBe(createdAddress);
    expect(unlockCredentials.get).toHaveBeenCalledWith(expect.objectContaining({
      publicKey: expect.not.objectContaining({
        allowCredentials: expect.anything(),
      }),
    }));
    expect(sessionClient.calls[0].privateKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(sessionClient.calls[0].privateKey).not.toBe(PRIVATE_KEY);
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
    await client.unlockWallet().catch((error) => { thrown = error; });

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
});

describe('soft session policy', () => {
  it('expires sessions and rejects value-bearing transactions by default', () => {
    const policy = createSoftSessionPolicy({
      address: ADDRESS,
      ttlSeconds: 1,
      now: 1000,
    });

    expect(() => assertSoftSessionAllowed({
      policy,
      method: 'personal_sign',
      now: 1500,
    })).not.toThrow();
    expect(() => assertSoftSessionAllowed({
      policy,
      method: 'personal_sign',
      now: 2500,
    })).toThrow(/expired/i);
    expect(() => assertSoftSessionAllowed({
      policy,
      method: 'eth_sendTransaction',
      tx: { to: ADDRESS, value: '0x1' },
      now: 1500,
    })).toThrow(/value-bearing/i);
  });
});
