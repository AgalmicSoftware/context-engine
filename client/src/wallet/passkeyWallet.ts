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

type ChainLike = Record<string, any>;

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

type PasskeyWalletClientDeps = {
  config?: PasskeyWalletConfig;
  storage?: PasskeyWalletStorage;
  credentials?: PasskeyCredentialClient;
  sessionClient?: SoftSessionClient;
  privateKeyFactory?: () => HexString;
  now?: () => number;
};

const walletLog = createLogger('wallet');
const MISSING_WALLET_CODE = 'CE_PASSKEY_WALLET_RECORD_MISSING';

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

const isPasskeyWalletLockedError = (error: unknown): boolean =>
  error instanceof Error
    ? error.message === PASSKEY_WALLET_LOCKED_MESSAGE
    : String((error as { message?: unknown })?.message || error || '') === PASSKEY_WALLET_LOCKED_MESSAGE;

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
  private readonly now: () => number;
  private sessionClient: SoftSessionClient;
  private activeRecord: PasskeyWalletRecord | null = null;
  private activeAddress: HexString | null = null;
  private unlockExpiresAt = 0;
  private activeChain: ChainLike = defaultChain();
  private lockTimer: ReturnType<typeof setTimeout> | null = null;
  private transitionInProgress = false;

  constructor(deps: PasskeyWalletClientDeps = {}) {
    this.config = deps.config || getPasskeyWalletConfig();
    this.storage = deps.storage || indexedDbWalletStorage;
    this.credentials = deps.credentials;
    this.sessionClient = deps.sessionClient || createWorkerSoftSessionClient();
    this.privateKeyFactory = deps.privateKeyFactory || createRandomEoaPrivateKey;
    this.now = deps.now || (() => Date.now());
  }

  setChain(chainOrId: unknown): ChainLike {
    this.activeChain = normalizeChain(chainOrId);
    return this.activeChain;
  }

  getChain(): ChainLike {
    return this.activeChain;
  }

  getCapabilities(): PasskeyWalletCapabilities {
    return PASSKEY_WALLET_CAPABILITIES;
  }

  isUnlocked(): boolean {
    return !!this.activeAddress && this.unlockExpiresAt > this.now();
  }

  hasSigner(): boolean {
    return this.isUnlocked();
  }

  getAddress(): HexString | null {
    return this.activeAddress;
  }

  async createWallet(): Promise<HexString> {
    this.transitionInProgress = true;
    let privateKey: HexString | null = null;
    try {
      if (this.config.walletKeyMode === 'passkey-derived') {
        const saltBytes = await getPasskeyDerivedPrfSalt(this.config);
        const credential = await createPasskeyCredential({
          config: this.config,
          salt: saltBytes,
          credentials: this.credentials,
        });
        const credentialId = bufferToBase64URL(credential.rawId);
        const prfOutput = await resolveCreatedCredentialPrfOutput({
          config: this.config,
          credential,
          credentialId,
          salt: saltBytes,
          credentials: this.credentials,
        });
        privateKey = await deriveEoaPrivateKeyFromPrf({ prfOutput, config: this.config });
        const address = getAddressForPrivateKey(privateKey);
        const record = createPasskeyDerivedWalletRecord({
          config: this.config,
          credentialId,
          address,
          prfSalt: saltBytes,
        });
        await this.writeDerivedMetadata(record);
        await this.activate(record, privateKey);
        return address;
      }

      const salt = randomBase64Url(32);
      const saltBytes = new Uint8Array(base64URLToBuffer(salt));
      const credential = await createPasskeyCredential({
        config: this.config,
        salt: saltBytes,
        credentials: this.credentials,
      });
      const credentialId = bufferToBase64URL(credential.rawId);
      const prfOutput = await resolveCreatedCredentialPrfOutput({
        config: this.config,
        credential,
        credentialId,
        salt: saltBytes,
        credentials: this.credentials,
      });
      const aesKey = await deriveAesGcmKeyFromPrf(prfOutput, salt);
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
      await this.storage.write(record);
      await this.activate(record, privateKey);
      return address;
    } finally {
      privateKey = null;
      this.transitionInProgress = false;
    }
  }

  async unlockWallet(): Promise<HexString> {
    this.transitionInProgress = true;
    let privateKey: HexString | null = null;
    try {
      if (this.config.walletKeyMode === 'passkey-derived') {
        const saltBytes = await getPasskeyDerivedPrfSalt(this.config);
        const { credential, prfOutput } = await authenticatePasskeyCredential({
          config: this.config,
          salt: saltBytes,
          credentials: this.credentials,
        });
        const credentialId = bufferToBase64URL(credential.rawId);
        privateKey = await deriveEoaPrivateKeyFromPrf({ prfOutput, config: this.config });
        const address = getAddressForPrivateKey(privateKey);
        const record = createPasskeyDerivedWalletRecord({
          config: this.config,
          credentialId,
          address,
          prfSalt: saltBytes,
        });
        await this.writeDerivedMetadata(record);
        await this.activate(record, privateKey);
        return address;
      }

      const record = await this.storage.read();
      if (!record) throw new MissingPasskeyWalletRecordError();
      if (record.rpId !== this.config.rpId) {
        throw new Error(`Stored wallet belongs to RP ID "${record.rpId}", not "${this.config.rpId}".`);
      }
      if (!isEncryptedWalletRecord(record)) {
        throw new Error('Stored wallet metadata is not an encrypted private-key wallet.');
      }
      const saltBytes = new Uint8Array(base64URLToBuffer(record.salt));
      const { prfOutput } = await authenticatePasskeyCredential({
        config: this.config,
        credentialId: record.credentialId,
        salt: saltBytes,
        credentials: this.credentials,
      });
      const aesKey = await deriveAesGcmKeyFromPrf(prfOutput, record.salt);
      privateKey = await decryptPrivateKey({ record, aesKey });
      const address = getAddressForPrivateKey(privateKey);
      if (address.toLowerCase() !== record.evmAddress.toLowerCase()) {
        throw new Error('Encrypted wallet record address does not match decrypted key.');
      }
      await this.activate(record, privateKey);
      return address;
    } finally {
      privateKey = null;
      this.transitionInProgress = false;
    }
  }

  async restoreSession(options: RestoreOptions = {}): Promise<HexString | null> {
    if (this.transitionInProgress) return null;
    if (this.isUnlocked() && this.activeAddress) return this.activeAddress;
    const record = await this.storage.read();
    if (!record) return null;
    if (record.rpId !== this.config.rpId) return null;
    if (this.config.walletKeyMode === 'passkey-derived' && !isPasskeyDerivedWalletRecord(record)) return null;
    if (this.config.walletKeyMode === 'encrypted-private-key' && !isEncryptedWalletRecord(record)) return null;
    if (options.requireSigner === false) {
      this.activeRecord = record;
      this.activeAddress = record.evmAddress;
      this.unlockExpiresAt = 0;
      return record.evmAddress;
    }
    return this.unlockWallet();
  }

  async signMessage(message: unknown): Promise<HexString> {
    return toHexString(
      await this.requestUnlocked(() => ({
        method: 'personal_sign',
        params: [message, this.activeAddress],
      })),
    );
  }

  async signTypedData(typedData: unknown): Promise<HexString> {
    return toHexString(
      await this.requestUnlocked(() => ({
        method: 'eth_signTypedData_v4',
        params: [this.activeAddress, normalizeTypedData(typedData)],
      })),
    );
  }

  async sendTransaction(tx: Record<string, unknown>): Promise<HexString> {
    return toHexString(
      await this.requestUnlocked(() => ({
        method: 'eth_sendTransaction',
        params: [{ ...tx, from: tx.from || this.activeAddress }],
      })),
    );
  }

  async signTransaction(tx: Record<string, unknown>): Promise<HexString> {
    return toHexString(
      await this.requestUnlocked(() => ({
        method: 'eth_signTransaction',
        params: [{ ...tx, from: tx.from || this.activeAddress }],
      })),
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
        return this.signMessage(params[0]);
      case 'eth_signTypedData_v4':
        return this.signTypedData(params[1] ?? params[0]);
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
        return this.readProvider().send(method, params);
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
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.lockTimer = null;
    this.unlockExpiresAt = 0;
    await this.sessionClient.lock();
    this.sessionClient = createWorkerSoftSessionClient();
  }

  async disconnect(): Promise<void> {
    await this.lock();
    this.activeRecord = null;
    this.activeAddress = null;
  }

  async deleteWallet(): Promise<void> {
    await this.disconnect();
    await this.storage.clear();
  }

  private async writeDerivedMetadata(record: PasskeyDerivedWalletRecord): Promise<void> {
    const existing = await this.storage.read();
    if (existing && !isPasskeyDerivedWalletRecord(existing)) return;
    await this.storage.write(record);
  }

  private async activate(record: PasskeyWalletRecord, privateKey: HexString): Promise<void> {
    const chainId = Number(this.activeChain?.id ?? this.activeChain?.chainId ?? 0) || 0;
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

    // Soft sessions are not a hard security boundary. They keep decrypted EOA
    // material out of serializable app state and isolate signing code, but any
    // malicious script executing in this origin can still ask the worker to sign.
    await this.sessionClient.init({ privateKey, rpcUrl, chainId, policy });
    this.activeRecord = record;
    this.activeAddress = record.evmAddress;
    this.unlockExpiresAt = expiresAt;
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.lockTimer = setTimeout(
      () => {
        void this.lock().catch((error) => walletLog.warn('Passkey wallet auto-lock failed:', error));
      },
      Math.max(0, expiresAt - this.now()),
    );
  }

  private async ensureUnlocked(): Promise<void> {
    if (this.isUnlocked()) return;
    if (this.activeAddress) {
      await this.lock();
    }
    await this.unlockWallet();
  }

  private async requestUnlocked(buildArgs: () => { method: string; params?: unknown[] }): Promise<unknown> {
    await this.ensureUnlocked();
    const args = buildArgs();
    try {
      return await this.sessionClient.request(args);
    } catch (error) {
      if (!isPasskeyWalletLockedError(error)) throw error;

      await this.lock();
      await this.unlockWallet();
      return this.sessionClient.request(buildArgs());
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
    const chainId = Number(this.activeChain?.id ?? this.activeChain?.chainId ?? 0) || undefined;
    return new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
  }
}

let singleton: PasskeyEoaWalletClient | null = null;

export const getPasskeyWalletClient = (): PasskeyEoaWalletClient => {
  if (!singleton) singleton = new PasskeyEoaWalletClient();
  return singleton;
};

export const resetPasskeyWalletClientForTests = (client: PasskeyEoaWalletClient | null = null): void => {
  singleton = client;
};

export const setPasskeyWalletChain = (chainOrId: unknown): ChainLike => getPasskeyWalletClient().setChain(chainOrId);
export const getPasskeyWalletChain = (): ChainLike => getPasskeyWalletClient().getChain();
export const createPasskeyWallet = (): Promise<HexString> => getPasskeyWalletClient().createWallet();
export const unlockPasskeyWallet = (): Promise<HexString> => getPasskeyWalletClient().unlockWallet();
export const restorePasskeyWalletSession = (options: RestoreOptions = {}): Promise<HexString | null> =>
  getPasskeyWalletClient().restoreSession(options);
export const lockPasskeyWallet = (): Promise<void> => getPasskeyWalletClient().lock();
export const logoutPasskeyWallet = (): Promise<void> => getPasskeyWalletClient().disconnect();
export const getPasskeyWalletAddress = (): HexString | null => getPasskeyWalletClient().getAddress();
export const hasPasskeyWalletSigner = (): boolean => getPasskeyWalletClient().hasSigner();
export const isPasskeyWalletAutoSignReady = (): boolean => getPasskeyWalletClient().isUnlocked();
export const sendPasskeyWalletTransaction = (tx: Record<string, unknown>): Promise<HexString> =>
  getPasskeyWalletClient().sendTransaction(tx);
export const createPasskeyEip1193Provider = (): Eip1193Provider => getPasskeyWalletClient().createProvider();
export const getPasskeyWalletCapabilities = (): PasskeyWalletCapabilities => PASSKEY_WALLET_CAPABILITIES;

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
