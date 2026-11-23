import { formatPasskeyCredentialUserName } from './passkey/createCredential.js';
import { ethers } from 'ethers';
import { PasskeyEoaWalletClient } from './passkeyWallet.js';
import { createMemoryWalletStorage } from './keystore/storage.js';
import {
  LOGIN_FILE_HOURS,
  LOGIN_FILE_PASSWORD_ITERATIONS,
  LoginFileExpiredError,
  LoginFilePasswordNeededError,
  LoginFilePasswordWrongError,
  LoginFileUnreadableError,
  createLoginFile,
  createProtectedLoginFile,
  isLoginFileProtected,
  loginFileName,
  openLoginFile,
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
    // The device's own time, as a passkey's name has it.
    const file = createLoginFile(new Date(2026, 10, 23, 22, 3));
    const parsed = JSON.parse(file.text);
    expect(parsed).toMatchObject({ type: 'context-engine-login-file', version: 1, address: file.address });
    expect(parsed.recoveryPhrase.split(' ')).toHaveLength(12);
    expect(file.name).toBe('ContextEngine-Login-November23-2026-1003PM.json');
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

describe('a login file\u2019s name', () => {
  it('follows the passkey\u2019s, with the device\u2019s date and time, and is safe as a file name everywhere', () => {
    const at = new Date(2026, 6, 2, 22, 3);
    expect(formatPasskeyCredentialUserName(at)).toBe('ContextEngine-July2-2026-1003PM');
    expect(loginFileName(at)).toBe('ContextEngine-Login-July2-2026-1003PM.json');
    // No colon, slash, space or other character a phone or computer refuses, at any time of day or year.
    for (const date of [new Date(2026, 0, 1, 0, 0), new Date(2026, 11, 31, 12, 59), new Date(2027, 1, 28, 23, 59)]) {
      expect(loginFileName(date)).toMatch(/^ContextEngine-Login-[A-Za-z]+\d{1,2}-\d{4}-\d{3,4}(AM|PM)\.json$/);
    }
    // It carries no part of the account.
    const file = createLoginFile(at);
    expect(file.name).not.toContain(file.address.slice(2, 8).toLowerCase());
  });

  it('is not what signs in: the file reads the same under any name', async () => {
    const file = createLoginFile();
    // Nothing of the name is in the text, and the text alone gives the account.
    expect(file.text).not.toContain(file.name);
    expect(readLoginFileKey(file.text).address).toBe(file.address);
    // A file saved under the earlier name pattern holds the same kind of text.
    const earlier = JSON.stringify({ type: 'context-engine-login-file', version: 1, recoveryPhrase: PHRASE });
    await expect(openLoginFile(earlier)).resolves.toMatchObject({ address: PHRASE_ADDRESS });
  });
});

describe('a login file with a password', () => {
  const PASSWORD = 'correct horse battery';
  const edit = (text: string, change: (file: any) => void): string => {
    const file = JSON.parse(text);
    change(file);
    return JSON.stringify(file);
  };
  // One file for the cases that only read it; making one stretches the password, which takes a moment.
  let file: Awaited<ReturnType<typeof createProtectedLoginFile>>;
  beforeAll(async () => {
    file = await createProtectedLoginFile(PASSWORD, new Date(2026, 10, 23, 9, 5));
  });

  it('holds no words in the clear, and records how it is protected', () => {
    const parsed = JSON.parse(file.text);
    expect(parsed).toMatchObject({
      type: 'context-engine-login-file',
      version: 2,
      address: file.address,
      encryptedRecoveryPhrase: { kdf: 'PBKDF2-SHA256', iterations: 600000, cipher: 'AES-GCM-256' },
    });
    expect(LOGIN_FILE_PASSWORD_ITERATIONS).toBe(600000);
    expect(parsed).not.toHaveProperty('recoveryPhrase');
    expect(file.text).not.toContain(PASSWORD);
    // A 16-byte salt and a 12-byte IV, fresh for each file.
    const bytes = (value: string) => Buffer.from(value, 'base64url').length;
    expect(bytes(parsed.encryptedRecoveryPhrase.salt)).toBe(16);
    expect(bytes(parsed.encryptedRecoveryPhrase.iv)).toBe(12);
    expect(parsed.warning).toMatch(/password cannot be recovered/);
    expect(isLoginFileProtected(file.text)).toBe(true);
    expect(file.name).toBe('ContextEngine-Login-November23-2026-905AM.json');
  });

  it('opens with its password to the account it names, every time', async () => {
    const opened = await openLoginFile(file.text, PASSWORD);
    expect(opened.address).toBe(file.address);
    expect(new ethers.Wallet(opened.privateKey).address).toBe(file.address);
    await expect(openLoginFile(file.text, PASSWORD)).resolves.toEqual(opened);
  });

  it('gives two files of one password different salts, IVs and accounts', async () => {
    const other = await createProtectedLoginFile(PASSWORD);
    const [a, b] = [JSON.parse(file.text).encryptedRecoveryPhrase, JSON.parse(other.text).encryptedRecoveryPhrase];
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(other.address).not.toBe(file.address);
  });

  it('refuses a wrong password, and says a password is needed when none is given', async () => {
    await expect(openLoginFile(file.text, 'correct horse batterx')).rejects.toThrow(LoginFilePasswordWrongError);
    await expect(openLoginFile(file.text, `${PASSWORD} `)).rejects.toThrow(LoginFilePasswordWrongError);
    await expect(openLoginFile(file.text)).rejects.toThrow(LoginFilePasswordNeededError);
    await expect(openLoginFile(file.text, '')).rejects.toThrow(LoginFilePasswordNeededError);
    // Read as a file without a password, it is not one.
    expect(() => readLoginFileKey(file.text)).toThrow(LoginFileUnreadableError);
  });

  it('refuses to make a file with an empty password', async () => {
    await expect(createProtectedLoginFile('')).rejects.toThrow('Enter a password for the login file.');
  });

  it('takes the same password however its letters were composed', async () => {
    const composed = await createProtectedLoginFile('caf\u00e9 salon');
    await expect(openLoginFile(composed.text, 'cafe\u0301 salon')).resolves.toMatchObject({
      address: composed.address,
    });
  });

  it.each([
    [
      'its ciphertext',
      (f: any) => (f.encryptedRecoveryPhrase.ciphertext = `A${f.encryptedRecoveryPhrase.ciphertext.slice(1)}`),
    ],
    ['its salt', (f: any) => (f.encryptedRecoveryPhrase.salt = Buffer.alloc(16, 7).toString('base64url'))],
    ['its IV', (f: any) => (f.encryptedRecoveryPhrase.iv = Buffer.alloc(12, 7).toString('base64url'))],
    ['its iteration count', (f: any) => (f.encryptedRecoveryPhrase.iterations = 600001)],
    [
      'a cut-off ciphertext',
      (f: any) => (f.encryptedRecoveryPhrase.ciphertext = f.encryptedRecoveryPhrase.ciphertext.slice(0, 20)),
    ],
  ])('does not open once %s is changed, even with the right password', async (_what, change) => {
    await expect(openLoginFile(edit(file.text, change), PASSWORD)).rejects.toThrow(LoginFilePasswordWrongError);
  });

  it('refuses a file that opens to another account than the one it names', async () => {
    const renamed = edit(file.text, (f) => (f.address = PHRASE_ADDRESS));
    await expect(openLoginFile(renamed, PASSWORD)).rejects.toThrow(LoginFileUnreadableError);
  });

  it.each([
    ['an unknown method', (f: any) => (f.encryptedRecoveryPhrase.kdf = 'scrypt')],
    ['an unknown cipher', (f: any) => (f.encryptedRecoveryPhrase.cipher = 'AES-CBC')],
    ['too few iterations to protect anything', (f: any) => (f.encryptedRecoveryPhrase.iterations = 1000)],
    ['so many iterations that a phone would stall', (f: any) => (f.encryptedRecoveryPhrase.iterations = 50_000_000)],
    ['a count that is not a whole number', (f: any) => (f.encryptedRecoveryPhrase.iterations = '600000')],
    ['a missing salt', (f: any) => delete f.encryptedRecoveryPhrase.salt],
    ['another type', (f: any) => (f.type = 'other')],
  ])('refuses %s as not a login file, before any password is tried', async (_what, change) => {
    const changed = edit(file.text, change);
    await expect(openLoginFile(changed, PASSWORD)).rejects.toThrow(LoginFileUnreadableError);
    expect(isLoginFileProtected(changed)).toBe(false);
  });

  it.each([
    [99_999, false],
    [100_000, true],
    [5_000_000, true],
    [5_000_001, false],
    [600_000.5, false],
    [-600_000, false],
    [Number.NaN, false],
  ])('takes an iteration count of %p as a protected file: %p', (iterations, taken) => {
    expect(isLoginFileProtected(edit(file.text, (f) => (f.encryptedRecoveryPhrase.iterations = iterations)))).toBe(
      taken,
    );
  });

  it.each([
    ['text that is not base64', (f: any) => (f.encryptedRecoveryPhrase.ciphertext = '!!! not base64 !!!')],
    ['an empty ciphertext', (f: any) => (f.encryptedRecoveryPhrase.ciphertext = '')],
    [
      'an IV of the wrong length',
      (f: any) => (f.encryptedRecoveryPhrase.iv = Buffer.alloc(5, 1).toString('base64url')),
    ],
    ['an empty salt', (f: any) => (f.encryptedRecoveryPhrase.salt = '')],
  ])('refuses %s as a wrong password or a damaged file, never with a raw error', async (_what, change) => {
    await expect(openLoginFile(edit(file.text, change), PASSWORD)).rejects.toThrow(LoginFilePasswordWrongError);
  });

  it('goes by the protected part where a file holds words in the clear as well', async () => {
    const both = edit(file.text, (f) => (f.recoveryPhrase = PHRASE));
    expect(isLoginFileProtected(both)).toBe(true);
    await expect(openLoginFile(both)).rejects.toThrow(LoginFilePasswordNeededError);
    await expect(openLoginFile(both, PASSWORD)).resolves.toMatchObject({ address: file.address });
  });

  it.each([null, 'x', 0])('reads a protected part of %p as none: the file is one without a password', async (part) => {
    const plain = JSON.stringify({
      type: 'context-engine-login-file',
      recoveryPhrase: PHRASE,
      encryptedRecoveryPhrase: part,
    });
    expect(isLoginFileProtected(plain)).toBe(false);
    await expect(openLoginFile(plain)).resolves.toMatchObject({ address: PHRASE_ADDRESS });
  });

  it('refuses an empty protected part as not a login file', async () => {
    const empty = JSON.stringify({
      type: 'context-engine-login-file',
      recoveryPhrase: PHRASE,
      encryptedRecoveryPhrase: {},
    });
    expect(isLoginFileProtected(empty)).toBe(false);
    await expect(openLoginFile(empty, PASSWORD)).rejects.toThrow(LoginFileUnreadableError);
  });

  it('opens files without a password, and the 12 words alone, as before', async () => {
    const plain = createLoginFile();
    expect(isLoginFileProtected(plain.text)).toBe(false);
    await expect(openLoginFile(plain.text)).resolves.toMatchObject({ address: plain.address });
    // A password given for a file that has none is simply not used.
    await expect(openLoginFile(plain.text, PASSWORD)).resolves.toMatchObject({ address: plain.address });
    await expect(openLoginFile(PHRASE)).resolves.toMatchObject({ address: PHRASE_ADDRESS });
    expect(isLoginFileProtected(PHRASE)).toBe(false);
    expect(isLoginFileProtected('not a file')).toBe(false);
    await expect(openLoginFile('not a file')).rejects.toThrow(LoginFileUnreadableError);
  });

  it('signs in with its password as the account it names, and keeps the password nowhere', async () => {
    const { client, storage } = makeClient();
    await expect(client.signInWithLoginFile(file.text)).rejects.toThrow(LoginFilePasswordNeededError);
    await expect(client.signInWithLoginFile(file.text, 'wrong')).rejects.toThrow(LoginFilePasswordWrongError);
    expect(await storage.read()).toBeNull();
    await expect(client.signInWithLoginFile(file.text, PASSWORD)).resolves.toBe(file.address);
    const signature = await client.signMessage('with a password', file.address);
    expect(ethers.utils.verifyMessage('with a password', signature)).toBe(file.address);
    // From here on it is a login file's account like any other: sealed for its hours, with no trace of the password.
    const record = await storage.read();
    expect(record).toMatchObject({ keyMode: 'login-file', evmAddress: file.address });
    expect(JSON.stringify(record)).not.toContain(PASSWORD);
    expect(JSON.stringify(record)).not.toContain(Buffer.from(PASSWORD).toString('base64url'));
    await client.lock();
  });

  it('leaves the signed-in account as it was when the password is wrong', async () => {
    const { client } = makeClient();
    await client.signInWithLoginFile(
      JSON.stringify({ type: 'context-engine-login-file', version: 1, recoveryPhrase: PHRASE }),
    );
    await expect(client.signInWithLoginFile(file.text, 'wrong')).rejects.toThrow(LoginFilePasswordWrongError);
    expect(client.isUnlocked()).toBe(true);
    expect(client.getAddress()).toBe(PHRASE_ADDRESS);
    await client.lock();
  });
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
    // The page still shows the account, and that window has no file to choose: the message says what works.
    await expect(client.signMessage('too late', PHRASE_ADDRESS)).rejects.toThrow(
      'Your login file is needed again. Reload the page, then log in with your file. Unsent answers are kept.',
    );
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

  it('comes back on an open page after its hours, by the same file only, with the account never switched', async () => {
    const { client, clock, storage } = makeClient();
    await client.signInWithLoginFile(fileText);
    clock.now += LOGIN_FILE_HOURS * HOUR + 1;
    await expect(client.signMessage('too late', PHRASE_ADDRESS)).rejects.toThrow(LoginFileExpiredError);
    // The page still shows the account, and asks for its file: another account's file is refused, and nothing
    // of it is kept.
    const other = createLoginFile();
    await expect(
      client.signInWithLoginFile(other.text, undefined, { expectedAddress: PHRASE_ADDRESS }),
    ).rejects.toThrow('That file is for another account.');
    expect(client.getAddress()).toBe(PHRASE_ADDRESS);
    expect(await storage.read()).toMatchObject({ evmAddress: PHRASE_ADDRESS });
    expect(await storage.read()).not.toHaveProperty('sealKey');
    await expect(client.signMessage('still due', PHRASE_ADDRESS)).rejects.toThrow(LoginFileExpiredError);

    // The same file, in whatever case the page holds the address: signed in again, with no reload.
    await expect(
      client.signInWithLoginFile(fileText, undefined, { expectedAddress: PHRASE_ADDRESS.toLowerCase() }),
    ).resolves.toBe(PHRASE_ADDRESS);
    const signature = await client.signMessage('back again', PHRASE_ADDRESS);
    expect(ethers.utils.verifyMessage('back again', signature)).toBe(PHRASE_ADDRESS);
    await client.lock();
  });

  it('refuses another account’s file while the page’s account is still unlocked, and leaves it unlocked', async () => {
    const { client } = makeClient();
    await client.signInWithLoginFile(fileText);
    const other = createLoginFile();
    await expect(
      client.signInWithLoginFile(other.text, undefined, { expectedAddress: PHRASE_ADDRESS }),
    ).rejects.toThrow('That file is for another account.');
    expect(client.isUnlocked()).toBe(true);
    expect(client.getAddress()).toBe(PHRASE_ADDRESS);
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
