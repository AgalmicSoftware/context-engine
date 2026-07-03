export type HexString = `0x${string}`;
export type WalletProviderName = 'passkey_eoa' | 'wagmi' | 'web3auth' | 'none';
export type PasskeyWalletKeyMode = 'passkey-derived' | 'encrypted-private-key';
export type PasskeyWalletEncryptionVersion = 'passkey-prf-aes-gcm-v1';
export type PasskeyWalletDerivationVersion = 'passkey-prf-hkdf-secp256k1-v1';

export interface EncryptedWalletRecord {
  id: string;
  userId?: string;
  rpId: string;
  credentialId: string;
  evmAddress: HexString;
  keyMode?: 'encrypted-private-key';
  encryptedPrivateKey: string;
  encryptionVersion: PasskeyWalletEncryptionVersion;
  salt: string;
  iv: string;
  createdAt: string;
  updatedAt: string;
}

export interface PasskeyDerivedWalletRecord {
  id: string;
  userId?: string;
  rpId: string;
  credentialId: string;
  evmAddress: HexString;
  keyMode: 'passkey-derived';
  derivationVersion: PasskeyWalletDerivationVersion;
  prfSalt: string;
  createdAt: string;
  updatedAt: string;
}

export type PasskeyWalletRecord = EncryptedWalletRecord | PasskeyDerivedWalletRecord;

export interface PasskeyWalletConfig {
  rpId: string;
  rpName: string;
  appOrigin: string;
  accountOrigin: string;
  walletMode: 'passkey-eoa';
  walletKeyMode: PasskeyWalletKeyMode;
  sessionMode: 'soft';
  unlockTtlSeconds: number;
  allowPreviewRpId: boolean;
  storageMode: 'indexeddb';
  derivationNamespace: string;
}

export interface PasskeyWalletCapabilities {
  passkeyWallet: true;
  eoa: true;
  softSessions: true;
  signMessage: true;
  signTypedData: true;
  sendTransaction: true;
  batching: false;
  sponsorship: false;
  paymaster: false;
  onchainPermissions: false;
  onchainPasskeyVerification: false;
}

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: unknown, handler: unknown): void;
  removeListener?(event: unknown, handler: unknown): void;
  enable?(): Promise<string[]>;
}

export interface SoftSessionPolicy {
  sessionId: string;
  address: HexString;
  createdAt: number;
  expiresAt: number;
  allowedMethods: Array<'personal_sign' | 'eth_signTypedData_v4' | 'eth_sendTransaction' | 'eth_signTransaction'>;
  allowedChainIds?: number[];
  allowedTargets?: HexString[];
  maxTransactionValueWei?: string;
}

export interface SignTypedDataPayload {
  domain?: Record<string, unknown>;
  types?: Record<string, Array<{ name: string; type: string }>>;
  primaryType?: string;
  message?: Record<string, unknown>;
}

export interface PasskeyCredentialClient {
  create(options?: CredentialCreationOptions): Promise<Credential | null>;
  get(options?: CredentialRequestOptions): Promise<Credential | null>;
}

export interface PasskeyWalletStorage {
  read(): Promise<PasskeyWalletRecord | null>;
  write(record: PasskeyWalletRecord): Promise<void>;
  clear(): Promise<void>;
}
