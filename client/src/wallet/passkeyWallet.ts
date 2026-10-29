import { ethers } from 'ethers';
import type { BigNumberish } from 'ethers';
import type {
  Eip1193Provider,
  EncryptedWalletRecord,
  HexString,
  PasskeyCredentialClient,
  PasskeyDerivedWalletRecord,
  PasskeyWalletCapabilities,
  PasskeyWalletConfig,
  PasskeyWalletRecord,
  PasskeyWalletStorage,
  SignTypedDataPayload,
} from './types.js';
import { PASSKEY_WALLET_CAPABILITIES, getPasskeyWalletConfig } from './config.js';
import { chainHexId, chainHttpRpc, chainHttpRpcNoPath, getChainById, getDefaultChainId } from '../variables/chains.js';
import { getReadProviderForChain } from '../utilities/web3/rpcProviders.js';
import { createPasskeyCredential } from './passkey/createCredential.js';
import { authenticatePasskeyCredential } from './passkey/authenticateCredential.js';
import { bufferToBase64URL, base64URLToBuffer, randomBase64Url } from './passkey/encoding.js';
import { deriveAesGcmKeyFromPrf, getOptionalCredentialPrfOutput } from './passkey/prf.js';
import { createRandomEoaPrivateKey, getAddressForPrivateKey } from './keystore/createWallet.js';
import { decryptPrivateKey } from './keystore/decryptPrivateKey.js';
import {
  createPasskeyDerivedWalletRecord,
  deriveEoaPrivateKeyFromPrf,
  getPasskeyDerivedPrfSalt,
} from './keystore/derivePrivateKey.js';
import { encryptPrivateKey } from './keystore/encryptPrivateKey.js';
import { indexedDbWalletStorage } from './keystore/storage.js';
import { createSoftSessionPolicy } from './session/sessionPolicy.js';
import { createWorkerSoftSessionClient, type SoftSessionClient } from './session/sessionWorkerClient.js';
import { createLogger } from '../utilities/logging.js';

type ChainLike = Record<string, unknown>;

type ReadOnlyRpcChildProvider = {
  send?: (method: string, params: unknown[]) => Promise<unknown>;
};

type ReadOnlyRpcProviderConfig = {
  priority?: number | string | null;
  provider?: ReadOnlyRpcChildProvider | null;
};

type ReadOnlyRpcFeeData = {
  maxPriorityFeePerGas?: BigNumberish | null;
};

type ReadOnlyRpcProvider = {
  getBlockNumber: () => Promise<number>;
  getGasPrice: () => Promise<BigNumberish>;
  getFeeData: () => Promise<ReadOnlyRpcFeeData | null | undefined>;
  getBalance: (address: unknown, blockTag?: unknown) => Promise<BigNumberish>;
  getTransactionCount: (address: unknown, blockTag?: unknown) => Promise<number>;
  getCode: (address: unknown, blockTag?: unknown) => Promise<string>;
  getStorageAt: (address: unknown, position: unknown, blockTag?: unknown) => Promise<string>;
  call: (transaction: unknown, blockTag?: unknown) => Promise<string>;
  estimateGas: (transaction: unknown) => Promise<BigNumberish>;
  getLogs: (filter: unknown) => Promise<unknown>;
  getTransaction: (hash: unknown) => Promise<unknown>;
  getTransactionReceipt: (hash: unknown) => Promise<unknown>;
  getBlockWithTransactions: (blockHashOrBlockTag: unknown) => Promise<unknown>;
  getBlock: (blockHashOrBlockTag: unknown) => Promise<unknown>;
  send?: (method: string, params: unknown[]) => Promise<unknown>;
  providerConfigs?: ReadOnlyRpcProviderConfig[];
};

type RestoreOptions = {
  requireSigner?: boolean;
};

type UnlockOptions = {
  selectCredential?: boolean;
  // Background re-unlocks must restore this account or fail; they never
  // adopt a different wallet saved by another tab.
  expectedAddress?: string | null;
};

type PasskeyWalletClientDeps = {
  config?: PasskeyWalletConfig;
  storage?: PasskeyWalletStorage;
  credentials?: PasskeyCredentialClient;
  sessionClient?: SoftSessionClient;
  sessionClientFactory?: () => SoftSessionClient;
  readProviderFactory?: (chainId: number) => unknown;
  privateKeyFactory?: () => HexString;
  now?: () => number;
};

const walletLog = createLogger('wallet');
const MISSING_WALLET_CODE = 'CE_PASSKEY_WALLET_RECORD_MISSING';
const PASSKEY_WALLET_LOCKED_MESSAGE = 'Passkey wallet is locked.';

export class MissingPasskeyWalletRecordError extends Error {
  code = MISSING_WALLET_CODE;

  constructor() {
    super('No encrypted passkey wallet is saved in this browser. Use Create to make a passkey wallet first.');
    this.name = 'MissingPasskeyWalletRecordError';
  }
}

export const isMissingPasskeyWalletRecordError = (error: unknown): boolean =>
  error instanceof MissingPasskeyWalletRecordError ||
  (!!error && typeof error === 'object' && (error as { code?: unknown }).code === MISSING_WALLET_CODE);

const CANCELLED_WALLET_OPERATION_CODE = 'CE_PASSKEY_WALLET_OPERATION_CANCELLED';

export class PasskeyWalletOperationCancelledError extends Error {
  code = CANCELLED_WALLET_OPERATION_CODE;

  constructor() {
    super('The passkey wallet operation was cancelled.');
    this.name = 'PasskeyWalletOperationCancelledError';
  }
}

export const isPasskeyWalletOperationCancelledError = (error: unknown): boolean =>
  error instanceof PasskeyWalletOperationCancelledError ||
  (!!error && typeof error === 'object' && (error as { code?: unknown }).code === CANCELLED_WALLET_OPERATION_CODE);

const isPasskeyWalletLockedError = (error: unknown): boolean =>
  error instanceof Error
    ? error.message === PASSKEY_WALLET_LOCKED_MESSAGE
    : String((error as { message?: unknown })?.message || error || '') === PASSKEY_WALLET_LOCKED_MESSAGE;

// EIP-1193 4100: the requested account has not been authorized.
const unauthorizedAccountError = (message: string): Error & { code: number } =>
  Object.assign(new Error(message), { code: 4100 });

const normalizeAccount = (value: unknown): string => {
  try {
    return ethers.utils.getAddress(String(value || '')).toLowerCase();
  } catch (_) {
    return '';
  }
};

// EIP-1193 4901: the provider is no longer on the chain the request was for.
const networkChangedError = (): Error & { code: number } =>
  Object.assign(new Error('The network changed while signing; try again.'), { code: 4901 });

// A lock can cut off a transaction after the session broadcast it.
const TRANSACTION_METHODS = new Set(['eth_sendTransaction', 'eth_sendRawTransaction']);
const transactionInterruptedError = (): Error =>
  new Error(
    'The passkey wallet locked before the transaction finished. It may already have been sent; check before trying again.',
  );

const assertExpectedAccount = (expectedAddress: unknown, address: unknown): void => {
  if (!expectedAddress || normalizeAccount(address) === normalizeAccount(expectedAddress)) return;
  throw unauthorizedAccountError('The passkey wallet in this browser changed to another account. Log in again.');
};

const defaultChain = (): ChainLike =>
  getChainById(getDefaultChainId()) ||
  getChainById(11155420) ||
  getChainById(84532) || {
    id: 11155420,
    name: 'OP Sepolia',
    rpcUrls: { public: { http: [] }, default: { http: [] } },
  };

const normalizeChain = (chainOrId?: unknown): ChainLike => {
  if (!chainOrId) return defaultChain();
  if (typeof chainOrId === 'number') return getChainById(chainOrId) || defaultChain();
  if (typeof chainOrId === 'object') {
    const id = Number((chainOrId as ChainLike).id ?? (chainOrId as ChainLike).chainId ?? 0);
    return (id && getChainById(id)) || (chainOrId as ChainLike);
  }
  return defaultChain();
};

const resolveRpcUrl = (chain: ChainLike): string => chainHttpRpcNoPath(chain) || chainHttpRpc(chain) || '';

const chainIdOf = (chain: ChainLike): number => Number(chain?.id ?? chain?.chainId ?? 0) || 0;

const normalizeTypedData = (payload: unknown): SignTypedDataPayload => {
  const typedData = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const record = (typedData && typeof typedData === 'object' ? typedData : {}) as SignTypedDataPayload;
  const { EIP712Domain: _domainType, ...types } = record.types || {};
  return {
    ...record,
    types,
  };
};

const toHexString = (value: unknown): HexString => String(value || '') as HexString;

const isEncryptedWalletRecord = (record: PasskeyWalletRecord): record is EncryptedWalletRecord =>
  record.keyMode !== 'passkey-derived' && 'encryptedPrivateKey' in record;

const isPasskeyDerivedWalletRecord = (record: PasskeyWalletRecord): record is PasskeyDerivedWalletRecord =>
  record.keyMode === 'passkey-derived';

const resolveCreatedCredentialPrfOutput = async ({
  config,
  credential,
  credentialId,
  credentials,
  salt,
}: {
  config: PasskeyWalletConfig;
  credential: PublicKeyCredential;
  credentialId: string;
  credentials?: PasskeyCredentialClient;
  salt: Uint8Array;
}): Promise<ArrayBuffer> => {
  const registrationOutput = getOptionalCredentialPrfOutput(credential);
  if (registrationOutput) return registrationOutput;
  const assertion = await authenticatePasskeyCredential({
    config,
    credentialId,
    salt,
    credentials,
  });
  return assertion.prfOutput;
};

export class PasskeyEoaWalletClient {
  private readonly config: PasskeyWalletConfig;
  private readonly storage: PasskeyWalletStorage;
  private readonly credentials?: PasskeyCredentialClient;
  private readonly privateKeyFactory: () => HexString;
  private readonly sessionClientFactory: () => SoftSessionClient;
  private readonly readProviderFactory: (chainId: number) => unknown;
  private readonly now: () => number;
  private sessionClient: SoftSessionClient;
  private activeRecord: PasskeyWalletRecord | null = null;
  private activeAddress: HexString | null = null;
  private unlockExpiresAt = 0;
  private activeChain: ChainLike = defaultChain();
  private lockTimer: ReturnType<typeof setTimeout> | null = null;
  private transitionInProgress = false;
  private sessionChainId = 0;
  // Bumped on every chain change; a request that sees it move never retries.
  private chainEpoch = 0;
  private operationGeneration = 0;
  private mutationTail: Promise<void> = Promise.resolve();
  // Sessions a chain change replaced; each locks once its requests settle.
  private readonly retiringSessions = new Set<SoftSessionClient>();
  private readonly inFlightBySession = new Map<SoftSessionClient, number>();

  constructor(deps: PasskeyWalletClientDeps = {}) {
    this.config = deps.config || getPasskeyWalletConfig();
    this.storage = deps.storage || indexedDbWalletStorage;
    this.credentials = deps.credentials;
    this.sessionClientFactory = deps.sessionClientFactory || createWorkerSoftSessionClient;
    this.sessionClient = deps.sessionClient || this.sessionClientFactory();
    this.readProviderFactory = deps.readProviderFactory || getReadProviderForChain;
    this.privateKeyFactory = deps.privateKeyFactory || createRandomEoaPrivateKey;
    this.now = deps.now || (() => Date.now());
  }

  setChain(chainOrId: unknown): ChainLike {
    const wasUnlocked = this.isUnlocked();
    const previousChainId = chainIdOf(this.activeChain);
    this.activeChain = normalizeChain(chainOrId);
    if (chainIdOf(this.activeChain) !== previousChainId) this.chainEpoch += 1;
    // The signer stays bound to the chain it unlocked on, so the next request
    // re-unlocks on the new chain. Requests already sent finish on their own
    // chain: a lock could cut off a transaction the session already broadcast.
    if (wasUnlocked && !this.isUnlocked() && !this.transitionInProgress) this.retireSession();
    return this.activeChain;
  }

  getChain(): ChainLike {
    return this.activeChain;
  }

  getCapabilities(): PasskeyWalletCapabilities {
    return PASSKEY_WALLET_CAPABILITIES;
  }

  isUnlocked(): boolean {
    return (
      !!this.activeAddress && this.unlockExpiresAt > this.now() && this.sessionChainId === chainIdOf(this.activeChain)
    );
  }

  hasSigner(): boolean {
    return this.isUnlocked();
  }

  getAddress(): HexString | null {
    return this.activeAddress;
  }

  async createWallet(): Promise<HexString> {
    const generation = ++this.operationGeneration;
    this.transitionInProgress = true;
    let privateKey: HexString | null = null;
    try {
      if (this.activeAddress) {
        await this.mutateWallet(() => this.lock(), generation);
        this.assertCurrentOperation(generation);
      }
      if (this.config.walletKeyMode === 'passkey-derived') {
        const saltBytes = await getPasskeyDerivedPrfSalt(this.config);
        this.assertCurrentOperation(generation);
        const credential = await createPasskeyCredential({
          config: this.config,
          salt: saltBytes,
          credentials: this.credentials,
        });
        this.assertCurrentOperation(generation);
        const credentialId = bufferToBase64URL(credential.rawId);
        const prfOutput = await resolveCreatedCredentialPrfOutput({
          config: this.config,
          credential,
          credentialId,
          salt: saltBytes,
          credentials: this.credentials,
        });
        this.assertCurrentOperation(generation);
        privateKey = await deriveEoaPrivateKeyFromPrf({ prfOutput, config: this.config });
        this.assertCurrentOperation(generation);
        const address = getAddressForPrivateKey(privateKey);
        const record = createPasskeyDerivedWalletRecord({
          config: this.config,
          credentialId,
          address,
          prfSalt: saltBytes,
        });
        await this.writeDerivedMetadata(record, generation);
        this.assertCurrentOperation(generation);
        await this.activate(record, privateKey, generation);
        this.assertCurrentOperation(generation);
        return address;
      }

      const salt = randomBase64Url(32);
      const saltBytes = new Uint8Array(base64URLToBuffer(salt));
      // This mode keeps the only copy of a wallet's key in the saved record,
      // so never mint a replacement passkey on the device that holds it.
      const savedRecord = await this.storage.read();
      this.assertCurrentOperation(generation);
      const credential = await createPasskeyCredential({
        config: this.config,
        salt: saltBytes,
        credentials: this.credentials,
        excludeCredentialIds: savedRecord?.rpId === this.config.rpId ? [savedRecord.credentialId] : [],
      });
      this.assertCurrentOperation(generation);
      const credentialId = bufferToBase64URL(credential.rawId);
      const prfOutput = await resolveCreatedCredentialPrfOutput({
        config: this.config,
        credential,
        credentialId,
        salt: saltBytes,
        credentials: this.credentials,
      });
      this.assertCurrentOperation(generation);
      const aesKey = await deriveAesGcmKeyFromPrf(prfOutput, salt);
      this.assertCurrentOperation(generation);
      privateKey = this.privateKeyFactory();
      const address = getAddressForPrivateKey(privateKey);
      const record = await encryptPrivateKey({
        privateKey,
        aesKey,
        salt,
        credentialId,
        address,
        config: this.config,
      });
      this.assertCurrentOperation(generation);
      await this.mutateWallet(async () => {
        await this.storage.write(record);
        this.assertCurrentOperation(generation);
      }, generation);
      this.assertCurrentOperation(generation);
      await this.activate(record, privateKey, generation);
      this.assertCurrentOperation(generation);
      return address;
    } catch (error) {
      this.assertCurrentOperation(generation);
      throw error;
    } finally {
      privateKey = null;
      if (this.operationGeneration === generation) this.transitionInProgress = false;
    }
  }

  async unlockWallet(options: UnlockOptions = {}): Promise<HexString> {
    const generation = this.operationGeneration;
    this.transitionInProgress = true;
    let privateKey: HexString | null = null;
    try {
      if (this.config.walletKeyMode === 'passkey-derived') {
        const storedRecord = await this.storage.read();
        this.assertCurrentOperation(generation);
        if (storedRecord && storedRecord.rpId !== this.config.rpId) {
          throw new Error(`Stored wallet belongs to RP ID "${storedRecord.rpId}", not "${this.config.rpId}".`);
        }
        if (storedRecord && !isPasskeyDerivedWalletRecord(storedRecord)) {
          throw new Error('Stored wallet metadata is not a passkey-derived wallet.');
        }
        if (storedRecord) assertExpectedAccount(options.expectedAddress, storedRecord.evmAddress);
        const saltBytes = await getPasskeyDerivedPrfSalt(this.config);
        this.assertCurrentOperation(generation);
        const selectCredential = options.selectCredential === true;
        const { credential, prfOutput } = await authenticatePasskeyCredential({
          config: this.config,
          credentialId: selectCredential ? undefined : storedRecord?.credentialId,
          salt: saltBytes,
          credentials: this.credentials,
        });
        this.assertCurrentOperation(generation);
        const credentialId = bufferToBase64URL(credential.rawId);
        // Regression guard: a returning wallet must target its saved credential;
        // omitting allowCredentials reopens the account chooser during mint/sign.
        if (!selectCredential && storedRecord && credentialId !== storedRecord.credentialId) {
          throw new Error('Passkey assertion does not match the stored wallet credential.');
        }
        privateKey = await deriveEoaPrivateKeyFromPrf({ prfOutput, config: this.config });
        this.assertCurrentOperation(generation);
        const address = getAddressForPrivateKey(privateKey);
        if (!selectCredential && storedRecord && address.toLowerCase() !== storedRecord.evmAddress.toLowerCase()) {
          throw new Error('Passkey-derived wallet address does not match stored metadata.');
        }
        assertExpectedAccount(options.expectedAddress, address);
        const record = createPasskeyDerivedWalletRecord({
          config: this.config,
          credentialId,
          address,
          prfSalt: saltBytes,
        });
        await this.writeDerivedMetadata(record, generation);
        this.assertCurrentOperation(generation);
        await this.activate(record, privateKey, generation);
        this.assertCurrentOperation(generation);
        return address;
      }

      const record = await this.storage.read();
      this.assertCurrentOperation(generation);
      if (!record) throw new MissingPasskeyWalletRecordError();
      if (record.rpId !== this.config.rpId) {
        throw new Error(`Stored wallet belongs to RP ID "${record.rpId}", not "${this.config.rpId}".`);
      }
      if (!isEncryptedWalletRecord(record)) {
        throw new Error('Stored wallet metadata is not an encrypted private-key wallet.');
      }
      assertExpectedAccount(options.expectedAddress, record.evmAddress);
      const saltBytes = new Uint8Array(base64URLToBuffer(record.salt));
      const { prfOutput } = await authenticatePasskeyCredential({
        config: this.config,
        credentialId: record.credentialId,
        salt: saltBytes,
        credentials: this.credentials,
      });
      this.assertCurrentOperation(generation);
      const aesKey = await deriveAesGcmKeyFromPrf(prfOutput, record.salt);
      this.assertCurrentOperation(generation);
      privateKey = await decryptPrivateKey({ record, aesKey });
      this.assertCurrentOperation(generation);
      const address = getAddressForPrivateKey(privateKey);
      if (address.toLowerCase() !== record.evmAddress.toLowerCase()) {
        throw new Error('Encrypted wallet record address does not match decrypted key.');
      }
      await this.activate(record, privateKey, generation);
      this.assertCurrentOperation(generation);
      return address;
    } catch (error) {
      this.assertCurrentOperation(generation);
      throw error;
    } finally {
      privateKey = null;
      if (this.operationGeneration === generation) this.transitionInProgress = false;
    }
  }

  async restoreSession(options: RestoreOptions = {}): Promise<HexString | null> {
    const generation = this.operationGeneration;
    if (this.transitionInProgress) return null;
    if (this.isUnlocked() && this.activeAddress) return this.activeAddress;
    const record = await this.storage.read();
    this.assertCurrentOperation(generation);
    if (!record || (record.disconnected === true && options.requireSigner !== true)) return null;
    if (record.rpId !== this.config.rpId) return null;
    if (this.config.walletKeyMode === 'passkey-derived' && !isPasskeyDerivedWalletRecord(record)) return null;
    if (this.config.walletKeyMode === 'encrypted-private-key' && !isEncryptedWalletRecord(record)) return null;
    if (options.requireSigner === false) {
      this.activeRecord = record;
      this.activeAddress = record.evmAddress;
      this.unlockExpiresAt = 0;
      return record.evmAddress;
    }
    return this.unlockWallet({ expectedAddress: this.activeAddress });
  }

  // `account` is the address the caller asked to sign with; a different
  // address is rejected instead of signing as the unlocked wallet.
  async signMessage(message: unknown, account?: unknown): Promise<HexString> {
    return toHexString(
      await this.requestUnlocked(
        () => ({
          method: 'personal_sign',
          params: [message, this.activeAddress],
        }),
        account,
      ),
    );
  }

  async signTypedData(typedData: unknown, account?: unknown): Promise<HexString> {
    return toHexString(
      await this.requestUnlocked(
        () => ({
          method: 'eth_signTypedData_v4',
          params: [this.activeAddress, normalizeTypedData(typedData)],
        }),
        account,
      ),
    );
  }

  async sendTransaction(tx: Record<string, unknown>): Promise<HexString> {
    return toHexString(
      await this.requestUnlocked(
        () => ({
          method: 'eth_sendTransaction',
          params: [{ ...tx, from: tx.from || this.activeAddress }],
        }),
        tx.from,
      ),
    );
  }

  async signTransaction(tx: Record<string, unknown>): Promise<HexString> {
    return toHexString(
      await this.requestUnlocked(
        () => ({
          method: 'eth_signTransaction',
          params: [{ ...tx, from: tx.from || this.activeAddress }],
        }),
        tx.from,
      ),
    );
  }

  async request({ method, params = [] }: { method: string; params?: unknown[] }): Promise<unknown> {
    switch (method) {
      case 'eth_requestAccounts': {
        const address = await this.restoreSession({ requireSigner: true });
        return address ? [address] : [];
      }
      case 'eth_accounts': {
        const address = this.activeAddress || (await this.restoreSession({ requireSigner: false }));
        return address ? [address] : [];
      }
      case 'eth_chainId':
        return chainHexId(this.activeChain);
      case 'net_version':
        return String(Number(this.activeChain?.id || this.activeChain?.chainId || 0));
      case 'personal_sign':
        return this.signMessage(params[0], params[1]);
      case 'eth_signTypedData_v4':
        return params[1] == null ? this.signTypedData(params[0]) : this.signTypedData(params[1], params[0]);
      case 'eth_sendTransaction':
        return this.sendTransaction((params[0] || {}) as Record<string, unknown>);
      case 'eth_signTransaction':
        return this.signTransaction((params[0] || {}) as Record<string, unknown>);
      case 'wallet_getCapabilities':
        return this.getCapabilities();
      case 'wallet_grantPermissions':
        return {
          permissions: ['personal_sign', 'eth_signTypedData_v4', 'eth_sendTransaction'],
          session: 'soft',
        };
      default:
        return this.requestReadOnlyRpc(method, params);
    }
  }

  createProvider(): Eip1193Provider & { isPasskeyEoa: true; isMetaMask: false } {
    return {
      isPasskeyEoa: true,
      isMetaMask: false,
      request: (args) => this.request(args),
      on: (_event: unknown, _handler: unknown) => {},
      removeListener: (_event: unknown, _handler: unknown) => {},
      enable: async () => this.request({ method: 'eth_requestAccounts' }) as Promise<string[]>,
    };
  }

  async lock(): Promise<void> {
    const retiring = [...this.retiringSessions];
    this.retiringSessions.clear();
    await Promise.all([this.lockCurrentSession(), ...retiring.map((session) => session.lock())]);
  }

  async disconnect(): Promise<void> {
    await this.endWallet(false);
  }

  async deleteWallet(): Promise<void> {
    await this.endWallet(true);
  }

  private async endWallet(deleteRecord: boolean): Promise<void> {
    this.operationGeneration += 1;
    this.transitionInProgress = false;
    this.activeRecord = null;
    this.activeAddress = null;
    await this.mutateWallet(async () => {
      await this.lock();
      if (deleteRecord) {
        await this.storage.clear();
      } else {
        const record = await this.storage.read();
        if (record) await this.storage.write({ ...record, disconnected: true });
      }
    });
  }

  private assertCurrentOperation(generation: number): void {
    if (this.operationGeneration !== generation) throw new PasskeyWalletOperationCancelledError();
  }

  // Logout queues behind writes/init already in progress. After it resolves,
  // an older operation cannot finish a write or leave its signer initialized.
  private mutateWallet<T>(operation: () => Promise<T>, generation?: number): Promise<T> {
    const result = this.mutationTail.then(() => {
      if (generation !== undefined) this.assertCurrentOperation(generation);
      return operation();
    });
    this.mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async writeDerivedMetadata(record: PasskeyDerivedWalletRecord, generation: number): Promise<void> {
    await this.mutateWallet(async () => {
      const existing = await this.storage.read();
      this.assertCurrentOperation(generation);
      if (existing && !isPasskeyDerivedWalletRecord(existing)) return;
      await this.storage.write(record);
      this.assertCurrentOperation(generation);
    }, generation);
  }

  private async activate(record: PasskeyWalletRecord, privateKey: HexString, generation: number): Promise<void> {
    await this.mutateWallet(async () => {
      const chainId = chainIdOf(this.activeChain);
      const rpcUrl = resolveRpcUrl(this.activeChain);
      if (!rpcUrl) throw new Error('No RPC URL is configured for the passkey wallet chain.');
      const expiresAt = this.now() + this.config.unlockTtlSeconds * 1000;
      const policy = createSoftSessionPolicy({
        address: record.evmAddress,
        ttlSeconds: this.config.unlockTtlSeconds,
        now: this.now(),
        allowedChainIds: chainId ? [chainId] : undefined,
        maxTransactionValueWei: '0',
      });

      // Soft sessions isolate key material, but scripts in this origin can
      // still request signatures; they are not a hard security boundary.
      const session = this.sessionClient;
      try {
        await session.init({ privateKey, rpcUrl, chainId, policy });
        this.assertCurrentOperation(generation);
        if (record.disconnected) {
          record = { ...record, disconnected: false };
          await this.storage.write(record);
          this.assertCurrentOperation(generation);
        }
      } catch (error) {
        await session.lock();
        throw error;
      }
      this.activeRecord = record;
      this.activeAddress = record.evmAddress;
      this.unlockExpiresAt = expiresAt;
      this.sessionChainId = chainId;
      if (this.lockTimer) clearTimeout(this.lockTimer);
      this.lockTimer = setTimeout(
        () => {
          void this.lock().catch((error) => walletLog.warn('Passkey wallet auto-lock failed:', error));
        },
        Math.max(0, expiresAt - this.now()),
      );
    }, generation);
    this.assertCurrentOperation(generation);
  }

  private assertRequestedAccount(requestedAccount: unknown): void {
    if (requestedAccount == null || requestedAccount === '' || !this.activeAddress) return;
    if (normalizeAccount(requestedAccount) === normalizeAccount(this.activeAddress)) return;
    throw unauthorizedAccountError('The passkey wallet is unlocked for a different account than the request.');
  }

  private async lockCurrentSession(): Promise<void> {
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.lockTimer = null;
    this.unlockExpiresAt = 0;
    await this.sessionClient.lock();
    this.sessionClient = this.sessionClientFactory();
  }

  private retireSession(): void {
    const session = this.sessionClient;
    this.sessionClient = this.sessionClientFactory();
    if (this.inFlightBySession.has(session)) this.retiringSessions.add(session);
    else void session.lock().catch((error) => walletLog.warn('Passkey wallet chain-change lock failed:', error));
  }

  private async sendToSession(args: { method: string; params?: unknown[] }): Promise<unknown> {
    const session = this.sessionClient;
    this.inFlightBySession.set(session, (this.inFlightBySession.get(session) || 0) + 1);
    try {
      return await session.request(args);
    } finally {
      const remaining = (this.inFlightBySession.get(session) || 1) - 1;
      if (remaining > 0) {
        this.inFlightBySession.set(session, remaining);
      } else {
        this.inFlightBySession.delete(session);
        if (this.retiringSessions.delete(session)) {
          void session.lock().catch((error) => walletLog.warn('Passkey wallet chain-change lock failed:', error));
        }
      }
    }
  }

  // Re-unlocking keeps the account the app already uses; a request naming an
  // account unlocks only that account.
  private async relockAndUnlock(requestedAccount: unknown, generation: number): Promise<void> {
    this.assertCurrentOperation(generation);
    const expectedAddress = this.activeAddress || (requestedAccount ? String(requestedAccount) : null);
    if (this.activeAddress) {
      await this.mutateWallet(() => this.lockCurrentSession(), generation);
      this.assertCurrentOperation(generation);
    }
    await this.unlockWallet({ expectedAddress });
    this.assertCurrentOperation(generation);
  }

  private async requestUnlocked(
    buildArgs: () => { method: string; params?: unknown[] },
    requestedAccount?: unknown,
  ): Promise<unknown> {
    // Expiry permits one signature retry; logout cancels it. A transaction is
    // never replayed, and a request stays on the chain it started on.
    const generation = this.operationGeneration;
    const chainEpoch = this.chainEpoch;
    const { method } = buildArgs();
    const assertSameChain = (): void => {
      this.assertCurrentOperation(generation);
      if (this.chainEpoch !== chainEpoch) throw networkChangedError();
    };
    const send = async (): Promise<unknown> => {
      try {
        const result = await this.sendToSession(buildArgs());
        this.assertCurrentOperation(generation);
        return result;
      } catch (error) {
        this.assertCurrentOperation(generation);
        if (!isPasskeyWalletLockedError(error)) throw error;
        if (TRANSACTION_METHODS.has(method)) throw transactionInterruptedError();
        assertSameChain();
        throw error;
      }
    };
    this.assertRequestedAccount(requestedAccount);
    if (!this.isUnlocked()) await this.relockAndUnlock(requestedAccount, generation);
    assertSameChain();
    this.assertRequestedAccount(requestedAccount);
    try {
      const result = await send();
      this.assertCurrentOperation(generation);
      return result;
    } catch (error) {
      this.assertCurrentOperation(generation);
      if (!isPasskeyWalletLockedError(error)) throw error;
      await this.relockAndUnlock(requestedAccount, generation);
      assertSameChain();
      const result = await send();
      this.assertCurrentOperation(generation);
      return result;
    }
  }

  private async requestReadOnlyRpc(method: string, params: unknown[] = []): Promise<unknown> {
    const provider = this.readProvider() as ReadOnlyRpcProvider;
    switch (method) {
      case 'eth_blockNumber':
        return ethers.utils.hexValue(await provider.getBlockNumber());
      case 'eth_gasPrice':
        return ethers.utils.hexValue(await provider.getGasPrice());
      case 'eth_maxPriorityFeePerGas': {
        const feeData = await provider.getFeeData();
        return feeData?.maxPriorityFeePerGas ? ethers.utils.hexValue(feeData.maxPriorityFeePerGas) : null;
      }
      case 'eth_getBalance':
        return ethers.utils.hexValue(await provider.getBalance(params[0], params[1] ?? 'latest'));
      case 'eth_getTransactionCount':
        return ethers.utils.hexValue(await provider.getTransactionCount(params[0], params[1] ?? 'latest'));
      case 'eth_getCode':
        return provider.getCode(params[0], params[1] ?? 'latest');
      case 'eth_getStorageAt':
        return provider.getStorageAt(params[0], params[1], params[2] ?? 'latest');
      case 'eth_call':
        return provider.call(params[0] || {}, params[1] ?? 'latest');
      case 'eth_estimateGas':
        return ethers.utils.hexValue(await provider.estimateGas(params[0] || {}));
      case 'eth_getLogs':
        return provider.getLogs(params[0] || {});
      case 'eth_getTransactionByHash':
        return provider.getTransaction(params[0]);
      case 'eth_getTransactionReceipt':
        return provider.getTransactionReceipt(params[0]);
      case 'eth_getBlockByNumber':
      case 'eth_getBlockByHash':
        return params[1] ? provider.getBlockWithTransactions(params[0]) : provider.getBlock(params[0]);
      default:
        return this.requestRawReadProviderRpc(provider, method, params);
    }
  }

  private async requestRawReadProviderRpc(
    provider: ReadOnlyRpcProvider,
    method: string,
    params: unknown[],
  ): Promise<unknown> {
    if (typeof provider.send === 'function') return provider.send(method, params);

    const configs = Array.isArray(provider.providerConfigs)
      ? [...provider.providerConfigs].sort((left, right) => Number(left?.priority || 0) - Number(right?.priority || 0))
      : [];
    let lastError: unknown = null;
    for (const config of configs) {
      const childProvider = config?.provider;
      if (typeof childProvider?.send !== 'function') continue;
      try {
        return await childProvider.send(method, params);
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    throw new Error(`Read provider does not support ${method}.`);
  }

  private readProvider(): unknown {
    const chainId = Number(this.activeChain?.id ?? this.activeChain?.chainId ?? 0) || undefined;
    if (chainId) return this.readProviderFactory(chainId);
    const rpcUrl = resolveRpcUrl(this.activeChain);
    if (!rpcUrl) throw new Error('No RPC URL is configured for the passkey wallet chain.');
    return new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
  }
}

let singleton: PasskeyEoaWalletClient | null = null;

export const getPasskeyWalletClient = (): PasskeyEoaWalletClient => {
  if (!singleton) singleton = new PasskeyEoaWalletClient();
  return singleton;
};

export const setPasskeyWalletChain = (chainOrId: unknown): ChainLike => getPasskeyWalletClient().setChain(chainOrId);
export const getPasskeyWalletChain = (): ChainLike => getPasskeyWalletClient().getChain();
export const createPasskeyWallet = (): Promise<HexString> => getPasskeyWalletClient().createWallet();
export const unlockPasskeyWallet = (options: UnlockOptions = {}): Promise<HexString> =>
  getPasskeyWalletClient().unlockWallet(options);
export const restorePasskeyWalletSession = (options: RestoreOptions = {}): Promise<HexString | null> =>
  getPasskeyWalletClient().restoreSession(options);
export const logoutPasskeyWallet = (): Promise<void> => getPasskeyWalletClient().disconnect();
export const isPasskeyWalletAutoSignReady = (): boolean => getPasskeyWalletClient().isUnlocked();
export const createPasskeyEip1193Provider = (): Eip1193Provider => getPasskeyWalletClient().createProvider();

try {
  if (typeof window !== 'undefined') {
    Object.assign(window, {
      __ceCreatePasskeyEip1193Provider: createPasskeyEip1193Provider,
      __passkeyEoaProvider: createPasskeyEip1193Provider(),
    });
  }
} catch (e) {
  walletLog.warn('passkeyWallet global provider registration failed:', e);
}
