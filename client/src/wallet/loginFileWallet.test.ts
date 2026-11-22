import { ethers } from 'ethers';
import { PasskeyEoaWalletClient } from './passkeyWallet.js';
import { createMemoryWalletStorage } from './keystore/storage.js';
import {
  LOGIN_FILE_HOURS,
  LoginFileExpiredError,
  LoginFileUnreadableError,
  createLoginFile,
  readLoginFileKey,
} from './keystore/loginFile.js';
import { createInMemorySoftSessionClient } from './session/sessionWorkerClient.js';
import type { PasskeyCredentialClient, PasskeyWalletConfig, PasskeyWalletStorage } from './types.js';

const config: PasskeyWalletConfig = {
  rpId: 'localhost',
  rpName: 'Context Engine',
  appOrigin: 'http://localhost:3000',
  accountOrigin: 'http://localhost:3000',
  walletMode: 'passkey-eoa',
  walletKeyMode: 'passkey-derived',
  sessionMode: 'soft',
  unlockTtlSeconds: 3600,
  allowPreviewRpId: false,
  storageMode: 'indexeddb',
  derivationNamespace: 'context-engine',
};

// The standard test phrase, whose first address is known to every wallet.
const PHRASE = 'test test test test test test test test test test test junk';
const PHRASE_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const HOUR = 60 * 60 * 1000;

// A passkey that must never be asked: the login file signs without one.
const noPasskey = (): PasskeyCredentialClient => ({
  create: jest.fn(async () => {
    throw new Error('no passkey prompt expected');
  }),
  get: jest.fn(async () => {
    throw new Error('no passkey prompt expected');
  }),
});

const PRF_OUTPUT = new Uint8Array(32).fill(7).buffer;
const passkey = (): PasskeyCredentialClient => {
  const credential = {
    rawId: new Uint8Array([9, 9]).buffer,
    getClientExtensionResults: () => ({ prf: { enabled: true, results: { first: PRF_OUTPUT.slice(0) } } }),
  } as unknown as PublicKeyCredential;
  return { create: jest.fn(async () => credential), get: jest.fn(async () => credential) };
};

const makeClient = ({
  storage = createMemoryWalletStorage(),
  credentials = noPasskey(),
  clock = { now: 1_800_000_000_000 },
  walletConfig = config,
}: {
  storage?: PasskeyWalletStorage;
  credentials?: PasskeyCredentialClient;
  clock?: { now: number };
  walletConfig?: PasskeyWalletConfig;
} = {}) => ({
  storage,
  credentials,
  clock,
  client: new PasskeyEoaWalletClient({
    config: walletConfig,
    storage,
    credentials,
    // Real sessions: they sign with the key they are given, and hold none after a lock.
    sessionClientFactory: createInMemorySoftSessionClient,
    now: () => clock.now,
  }),
});

describe('a login file', () => {
  it('holds a 12-word phrase and reads back to the account it names', () => {
    const file = createLoginFile(new Date('2026-11-22T12:00:00Z'));
    const parsed = JSON.parse(file.text);
    expect(parsed).toMatchObject({ type: 'context-engine-login-file', version: 1, address: file.address });
    expect(parsed.recoveryPhrase.split(' ')).toHaveLength(12);
    expect(file.name).toBe(`context-engine-login-${file.address.slice(2, 8).toLowerCase()}.json`);
    expect(readLoginFileKey(file.text).address).toBe(file.address);
    expect(createLoginFile().address).not.toBe(file.address);
  });

  it('reads the standard phrase to the standard address, as a file or as the words alone', () => {
    const asFile = JSON.stringify({ type: 'context-engine-login-file', version: 1, recoveryPhrase: PHRASE });
    expect(readLoginFileKey(asFile).address).toBe(PHRASE_ADDRESS);
    expect(readLoginFileKey(`  ${PHRASE.toUpperCase().replace(/ /g, '\n')} `).address).toBe(PHRASE_ADDRESS);
    const spaced = JSON.stringify({ type: 'context-engine-login-file', recoveryPhrase: `  ${PHRASE}\n` });
    expect(readLoginFileKey(spaced).address).toBe(PHRASE_ADDRESS);
  });

  it.each(['', 'hello', '{}', '{"type":"other","recoveryPhrase":"x"}', '{not json', PHRASE.replace('junk', 'test')])(
    'refuses %p',
    (text) => {
      expect(() => readLoginFileKey(text)).toThrow(LoginFileUnreadableError);
    },
  );
});

describe('signing in with a login file', () => {
  beforeEach(() => {
    (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential = function PublicKeyCredential() {};
  });
  afterEach(() => {
    delete (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential;
  });

  const fileText = JSON.stringify({ type: 'context-engine-login-file', version: 1, recoveryPhrase: PHRASE });

  it('signs messages, typed data and transactions as the file’s account, with no passkey', async () => {
    const hash = `0x${'ab'.repeat(32)}`;
    const sent: ethers.providers.TransactionRequest[] = [];
    const send = jest.spyOn(ethers.Wallet.prototype, 'sendTransaction').mockImplementation(async function (
      this: ethers.Wallet,
      tx,
    ) {
      sent.push({ ...(tx as ethers.providers.TransactionRequest), from: this.address });
      return { hash } as ethers.providers.TransactionResponse;
    });
    const { client, credentials } = makeClient();
    try {
      await expect(client.signInWithLoginFile(fileText)).resolves.toBe(PHRASE_ADDRESS);
      expect(client.isUnlocked()).toBe(true);
      expect(client.getAddress()).toBe(PHRASE_ADDRESS);

      const signature = await client.signMessage('hello', PHRASE_ADDRESS);
      expect(ethers.utils.verifyMessage('hello', signature)).toBe(PHRASE_ADDRESS);

      const typed = {
        domain: { name: 'Context Engine', version: '1', chainId: 11155420 },
        types: { Vote: [{ name: 'choice', type: 'string' }] },
        primaryType: 'Vote',
        message: { choice: 'Agree' },
      };
      const typedSignature = await client.signTypedData(typed, PHRASE_ADDRESS);
      expect(ethers.utils.verifyTypedData(typed.domain, typed.types, typed.message, typedSignature)).toBe(
        PHRASE_ADDRESS,
      );

      // Through the provider, as the app's contract calls go.
      const provider = client.createProvider();
      await expect(provider.request({ method: 'eth_accounts' })).resolves.toEqual([PHRASE_ADDRESS]);
      await expect(provider.request({ method: 'eth_requestAccounts' })).resolves.toEqual([PHRASE_ADDRESS]);
      const viaProvider = (await provider.request({
        method: 'personal_sign',
        params: ['hi', PHRASE_ADDRESS],
      })) as string;
      expect(ethers.utils.verifyMessage('hi', viaProvider)).toBe(PHRASE_ADDRESS);
      await expect(
        provider.request({
          method: 'eth_sendTransaction',
          params: [{ from: PHRASE_ADDRESS, to: PHRASE_ADDRESS, value: '0x0' }],
        }),
      ).resolves.toBe(hash);
      expect(sent).toHaveLength(1);
      expect(sent[0].from).toBe(PHRASE_ADDRESS);

      // Another account's request is refused, as with a passkey.
      await expect(client.signMessage('hello', `0x${'12'.repeat(20)}`)).rejects.toThrow(/different account/);
      expect(credentials.create).not.toHaveBeenCalled();
      expect(credentials.get).not.toHaveBeenCalled();
    } finally {
      await client.lock();
      send.mockRestore();
    }
  });

  it('keeps no readable key in storage', async () => {
    const { client, storage } = makeClient();
    await client.signInWithLoginFile(fileText);
    const record = await storage.read();
    const { privateKey } = readLoginFileKey(fileText);
    expect(record).toMatchObject({ keyMode: 'login-file', evmAddress: PHRASE_ADDRESS, credentialId: '' });
    // Neither the key nor the words, as text or as the base64 of their bytes.
    const stored = JSON.stringify(record);
    for (const secret of [privateKey, privateKey.slice(2), PHRASE, 'junk']) {
      expect(stored).not.toContain(secret);
      expect(stored).not.toContain(Buffer.from(secret).toString('base64url'));
      expect(stored).not.toContain(Buffer.from(secret).toString('base64'));
    }
    expect(stored).not.toContain(Buffer.from(privateKey.slice(2), 'hex').toString('base64url'));
    const sealKey = (record as { sealKey: CryptoKey }).sealKey;
    expect(sealKey.extractable).toBe(false);
    await client.lock();
  });

  it('signs again after a reload, and after its unlock hour, without the file or a passkey', async () => {
    const first = makeClient();
    await first.client.signInWithLoginFile(fileText);
    await first.client.lock();

    // A new page: the account shows without a prompt, and the first signature unlocks from the sealed key.
    const reloaded = makeClient({ storage: first.storage, clock: first.clock });
    await expect(reloaded.client.restoreSession({ requireSigner: false })).resolves.toBe(PHRASE_ADDRESS);
    expect(reloaded.client.isUnlocked()).toBe(false);
    const signature = await reloaded.client.signMessage('after reload', PHRASE_ADDRESS);
    expect(ethers.utils.verifyMessage('after reload', signature)).toBe(PHRASE_ADDRESS);

    // The unlock runs out after its hour; the next signature unlocks again.
    reloaded.clock.now += 2 * HOUR;
    expect(reloaded.client.isUnlocked()).toBe(false);
    const later = await reloaded.client.signMessage('two hours on', PHRASE_ADDRESS);
    expect(ethers.utils.verifyMessage('two hours on', later)).toBe(PHRASE_ADDRESS);
    expect(reloaded.credentials.get).not.toHaveBeenCalled();
    await reloaded.client.lock();
  });

  it('asks for the file again after its hours, and takes it', async () => {
    const { client, clock, storage } = makeClient();
    await client.signInWithLoginFile(fileText);
    clock.now += LOGIN_FILE_HOURS * HOUR - 60_000;
    await expect(client.signMessage('just in time', PHRASE_ADDRESS)).resolves.toMatch(/^0x/);
    // That unlock never runs past the time the file is due.
    clock.now += 60_000;
    expect(client.isUnlocked()).toBe(false);
    await expect(client.signMessage('too late', PHRASE_ADDRESS)).rejects.toThrow(LoginFileExpiredError);
    await expect(client.sendTransaction({ from: PHRASE_ADDRESS, to: PHRASE_ADDRESS })).rejects.toThrow(
      LoginFileExpiredError,
    );

    // The key is wiped from the browser, not just refused: what is left names the account and holds no key.
    const left = await storage.read();
    expect(left).toMatchObject({ keyMode: 'login-file', evmAddress: PHRASE_ADDRESS });
    expect(left).not.toHaveProperty('sealKey');
    expect(left).not.toHaveProperty('sealedKey');
    expect(left).not.toHaveProperty('iv');
    // Setting the clock back does not bring it back.
    clock.now -= LOGIN_FILE_HOURS * HOUR;
    await expect(client.signMessage('clock set back', PHRASE_ADDRESS)).rejects.toThrow(LoginFileExpiredError);
    clock.now += LOGIN_FILE_HOURS * HOUR;

    // A new page shows signed out.
    const reloaded = makeClient({ storage, clock });
    await expect(reloaded.client.restoreSession({ requireSigner: false })).resolves.toBeNull();

    await expect(client.signInWithLoginFile(fileText)).resolves.toBe(PHRASE_ADDRESS);
    await expect(client.signMessage('again', PHRASE_ADDRESS)).resolves.toMatch(/^0x/);
    await client.lock();
  });

  it('wipes the key on sign-out, and another tab on the account is told to bring the file', async () => {
    const { client, storage, clock } = makeClient();
    const otherTab = makeClient({ storage, clock });
    await client.signInWithLoginFile(fileText);
    await expect(otherTab.client.restoreSession({ requireSigner: false })).resolves.toBe(PHRASE_ADDRESS);
    await client.disconnect();
    const left = await storage.read();
    expect(left).toMatchObject({ keyMode: 'login-file', evmAddress: PHRASE_ADDRESS });
    expect(left).not.toHaveProperty('sealKey');
    expect(left).not.toHaveProperty('sealedKey');
    expect(client.getAddress()).toBeNull();
    const reloaded = makeClient({ storage, clock });
    await expect(reloaded.client.restoreSession({ requireSigner: false })).resolves.toBeNull();
    await expect(reloaded.client.restoreSession({ requireSigner: true })).resolves.toBeNull();
    // Not a passkey prompt: this account never had one.
    await expect(otherTab.client.signMessage('from the other tab', PHRASE_ADDRESS)).rejects.toThrow(
      LoginFileExpiredError,
    );
    expect(otherTab.credentials.get).not.toHaveBeenCalled();
  });

  it('wipes the key at a page load after its hours, with no signature asked', async () => {
    const { client, storage, clock } = makeClient();
    await client.signInWithLoginFile(fileText);
    await client.lock();
    clock.now += LOGIN_FILE_HOURS * HOUR + 1;
    const reloaded = makeClient({ storage, clock });
    await expect(reloaded.client.restoreSession({ requireSigner: false })).resolves.toBeNull();
    expect(await storage.read()).not.toHaveProperty('sealKey');
  });

  it('wipes the key by its own timer on a page left open', async () => {
    jest.useFakeTimers();
    try {
      const { client, storage, clock } = makeClient();
      await client.signInWithLoginFile(fileText);
      expect(await storage.read()).toHaveProperty('sealKey');
      clock.now += LOGIN_FILE_HOURS * HOUR + 1000;
      await jest.advanceTimersByTimeAsync(LOGIN_FILE_HOURS * HOUR + 2000);
      expect(client.isUnlocked()).toBe(false);
      expect(await storage.read()).not.toHaveProperty('sealKey');
    } finally {
      jest.useRealTimers();
    }
  });

  it('is not kept unlocked past its hours by use of the page', async () => {
    const { client, clock } = makeClient();
    await client.signInWithLoginFile(fileText);
    // Used every half hour: each use extends the unlock, never past the time the file is due.
    for (let used = 0; used < LOGIN_FILE_HOURS * 2 - 1; used += 1) {
      clock.now += HOUR / 2;
      client.noteActivity();
      expect(client.isUnlocked()).toBe(true);
    }
    clock.now += HOUR / 2;
    client.noteActivity();
    expect(client.isUnlocked()).toBe(false);
    await expect(client.signMessage('past the hours', PHRASE_ADDRESS)).rejects.toThrow(LoginFileExpiredError);
  });

  it('refuses a file that is not a login file, and leaves the signed-in account as it was', async () => {
    const { client, storage } = makeClient();
    await client.signInWithLoginFile(fileText);
    await expect(client.signInWithLoginFile('{"type":"other"}')).rejects.toThrow(LoginFileUnreadableError);
    expect(await storage.read()).toMatchObject({ keyMode: 'login-file', evmAddress: PHRASE_ADDRESS });
    // Still unlocked, and still signing as the same account.
    expect(client.isUnlocked()).toBe(true);
    const signature = await client.signMessage('still here', PHRASE_ADDRESS);
    expect(ethers.utils.verifyMessage('still here', signature)).toBe(PHRASE_ADDRESS);
    await client.lock();
  });

  it('leaves a passkey account unlocked when a wrong file is chosen', async () => {
    const credentials = passkey();
    const { client } = makeClient({ credentials });
    const address = await client.createWallet();
    await expect(client.signInWithLoginFile('not a login file')).rejects.toThrow(LoginFileUnreadableError);
    expect(client.isUnlocked()).toBe(true);
    await expect(client.signMessage('no new prompt', address)).resolves.toMatch(/^0x/);
    expect(credentials.get).not.toHaveBeenCalled();
    await client.lock();
  });

  it('gives way to a passkey: Login and Create open the passkey’s account and replace the file’s record', async () => {
    for (const viaPasskey of ['unlock', 'create'] as const) {
      const { client, storage, credentials } = makeClient({ credentials: passkey() });
      await client.signInWithLoginFile(fileText);
      const address =
        viaPasskey === 'unlock' ? await client.unlockWallet({ selectCredential: true }) : await client.createWallet();
      expect(address).not.toBe(PHRASE_ADDRESS);
      expect(await storage.read()).toMatchObject({ keyMode: 'passkey-derived', evmAddress: address });
      // The next signature is the passkey account's, by its passkey.
      const signature = await client.signMessage('as passkey', address);
      expect(ethers.utils.verifyMessage('as passkey', signature)).toBe(address);
      expect(credentials.get).toHaveBeenCalledTimes(viaPasskey === 'unlock' ? 1 : 0);
      await client.lock();
    }
  });

  it('replaces a passkey account’s saved record, and a passkey Login brings the passkey account back', async () => {
    const credentials = passkey();
    const { client, storage } = makeClient({ credentials });
    const passkeyAddress = await client.createWallet();
    await expect(client.signInWithLoginFile(fileText)).resolves.toBe(PHRASE_ADDRESS);
    expect(await storage.read()).toMatchObject({ keyMode: 'login-file' });
    await expect(client.unlockWallet({ selectCredential: true })).resolves.toBe(passkeyAddress);
    await client.lock();
  });

  it('never writes over an encrypted wallet, whose record holds its only key', async () => {
    const { client, storage } = makeClient({
      credentials: passkey(),
      walletConfig: { ...config, walletKeyMode: 'encrypted-private-key' },
    });
    await client.createWallet();
    const saved = await storage.read();
    await expect(client.signInWithLoginFile(fileText)).rejects.toThrow(/already exists in this browser/);
    expect(await storage.read()).toEqual(saved);
    await client.lock();

    // Nor one made under another site name, met by a client in the usual mode.
    const elsewhere = makeClient({ storage, walletConfig: { ...config, rpId: 'other.example' } });
    await expect(elsewhere.client.signInWithLoginFile(fileText)).rejects.toThrow(/already exists in this browser/);
    expect(await storage.read()).toEqual(saved);
  });
});
