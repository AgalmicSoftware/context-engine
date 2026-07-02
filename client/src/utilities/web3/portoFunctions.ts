/**
 * @module portoFunctions
 * @description Porto passkey wallet integration — create, sign, derive, and SIWE-authenticate
 *              via the Porto (EIP-7702) passkey provider.
 *
 * Key exports: authenticatePorto, loginWithPorto, restoreSession, sendPortoTransaction, logoutPorto
 */
/**
 * SECURITY NOTE (Trail of Bits audit HIGH-01, 2026-03-10):
 * The Porto passkey wallet derives the EVM private key deterministically from
 * the WebAuthn credential rawId. This means the key is recoverable by any
 * same-origin script that can trigger a WebAuthn assertion. The passkey
 * ceremony provides physical-presence verification but NOT a hard cryptographic
 * boundary around the key material. For a true hardware-backed wallet, use a
 * future account-abstraction design.
 *
 * Mitigations applied:
 * - No plaintext localStorage fallback
 * - Session restore can hydrate stored wallet metadata silently, but a fresh
 *   WebAuthn assertion is still required before unwrapping key material
 * - Private key removed from serializable session object after viem client init
 *   (the signing account remains in memory; the raw private-key string does not)
 * - Legacy localStorage sessions migrated to IndexedDB then deleted
 */
/* client/src/utilities/web3/portoFunctions.ts */
/* global BigInt */

import { createWalletClient, fallback, http } from 'viem';
import { toAccount, privateKeyToAccount } from 'viem/accounts';
import contractScripts from './contractScripts.js'; // Import purely for read-provider fallback if needed
import { PORTO_SESSION_KEY_ENABLED } from '../../variables/appConfig.js';
import { chainHexId, getDefaultGasPriceGwei, getPortoRelayUrl as resolvePortoRelayUrl, resolvePortoChain } from '../../variables/chains.js';
import { createLogger } from '../logging.js';

const portoLog = createLogger('porto');

type AnyObj = Record<string, any>;

interface PortoSession {
  credentialId: string;
  address: string;
  privateKey: string | null;
}

interface PortoSessionRecord {
  version: number;
  credentialId: string;
  address: string;
  encryptedPrivateKey: string;
  encryptedPrivateKeyIv: string;
}

interface EncryptedPrivateKeyRecord {
  iv: string;
  data: string;
}

interface RestoreSessionOptions {
  requireSigner?: boolean;
}





// --- Configuration ---
// For this demo, use a relay URL from chains.js.
// In a production Porto setup, this might point to a specific Bundler or Relay URL.
let portoChain: any = resolvePortoChain();
let relayUrl: string = resolvePortoRelayUrl(portoChain);
let portoChainIdHex: string = chainHexId(portoChain);
let portoChainIdDec: string = String(portoChain?.id ?? 0);
const PORTO_STORAGE_KEY = 'porto_session_v1';
const PORTO_DB_NAME = 'porto_session_db';
const PORTO_DB_VERSION = 1;
const PORTO_DB_STORE = 'porto_sessions';
const PORTO_SESSION_RECORD_VERSION = 1;
const PORTO_SESSION_KEY_CONTEXT = 'porto_session_key_v1';

const syncPortoChainState = (chainOrId: any): void => {
  const resolved = resolvePortoChain(chainOrId);
  portoChain = resolved;
  relayUrl = resolvePortoRelayUrl(resolved);
  portoChainIdHex = chainHexId(resolved);
  portoChainIdDec = String(resolved?.id ?? 0);
};

export function setPortoChain(chainOrId: any): void {
  const prevId = portoChain?.id;
  const prevRelay = relayUrl;
  syncPortoChainState(chainOrId);
  if (
    currentSession &&
    hasCurrentPortoSessionSigner() &&
    (portoChain?.id !== prevId || relayUrl !== prevRelay)
  ) {
    _initViemClient();
  }
}

export function getPortoChain(): any {
  return portoChain;
}

// State to hold the authenticated session
let currentSession: PortoSession | null = null;
let currentSessionSignerAccount: any = null;
let viemWalletClient: any = null;
let portoAccountSwitchInProgress = false;
let portoSessionTransitionInProgress = false;
let portoSessionRevision = 0;
let suppressedPersistedPortoSessionAddress = '';
let sessionKeyEnabled = typeof PORTO_SESSION_KEY_ENABLED === 'boolean'
  ? PORTO_SESSION_KEY_ENABLED
  : true;

const PORTO_RPC_TIMEOUT_MS = 20_000;
const PORTO_RPC_RETRY_COUNT = 1;
const PORTO_FALLBACK_RETRY_COUNT = 1;
const PORTO_FALLBACK_SIMPLE_GAS = 21000n;
const PORTO_FALLBACK_CALLDATA_GAS = 350000n;
const PORTO_FALLBACK_MEDIUM_CALLDATA_GAS = 700000n;
const PORTO_FALLBACK_LARGE_CALLDATA_GAS = 1200000n;
const PORTO_FALLBACK_HUGE_CALLDATA_GAS = 1600000n;
const PORTO_FALLBACK_GAS_BY_SELECTOR: Record<string, bigint> = {
  // SURVEYS.addSurvey(bytes32,bytes32,bytes32[],bytes32[])
  '0xbaea8df2': 1400000n,
  // SURVEYS.addQuestions(bytes32[],bytes32[],bytes32[])
  '0x7ce3e774': 1200000n,
  // Historical/additional fallback signature used in earlier variants
  '0x0ea045bc': 1400000n,
};

const parseTxSelector = (data: unknown): string => {
  const raw = String(data || '').trim().toLowerCase();
  if (!raw.startsWith('0x') || raw.length < 10) return '';
  return raw.slice(0, 10);
};

const countHexDataBytes = (data: unknown): number => {
  const raw = String(data || '').trim().toLowerCase();
  if (!raw.startsWith('0x') || raw.length <= 2) return 0;
  return Math.floor((raw.length - 2) / 2);
};

const resolvePortoFallbackGas = (tx: AnyObj = {}): bigint => {
  const data = tx?.data;
  const selector = parseTxSelector(data);
  if (selector && Object.prototype.hasOwnProperty.call(PORTO_FALLBACK_GAS_BY_SELECTOR, selector)) {
    return PORTO_FALLBACK_GAS_BY_SELECTOR[selector];
  }
  const dataBytes = countHexDataBytes(data);
  if (dataBytes <= 0) return PORTO_FALLBACK_SIMPLE_GAS;
  if (dataBytes >= 4096) return PORTO_FALLBACK_HUGE_CALLDATA_GAS;
  if (dataBytes >= 1024) return PORTO_FALLBACK_LARGE_CALLDATA_GAS;
  if (dataBytes >= 256) return PORTO_FALLBACK_MEDIUM_CALLDATA_GAS;
  return PORTO_FALLBACK_CALLDATA_GAS;
};

const parseGweiToWei = (value: unknown): bigint | null => {
  const raw = String(value || '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const [wholeRaw, fracRaw = ''] = raw.split('.');
  const whole = BigInt(wholeRaw || '0');
  const frac = BigInt((`${fracRaw}000000000`).slice(0, 9));
  return (whole * 1000000000n) + frac;
};

const resolvePortoDefaultGasPriceWei = (chainOrId: any = portoChain): bigint | null => {
  try {
    const chainId = Number(
      typeof chainOrId === 'object'
        ? chainOrId?.id
        : chainOrId
    ) || Number(portoChain?.id || 0) || 0;
    return parseGweiToWei(getDefaultGasPriceGwei(chainId));
  } catch (_) {
    return parseGweiToWei('0.08');
  }
};

const uniqueRpcUrls = (urls: any[] = []): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  urls.forEach((entry) => {
    const value = String(entry || '').trim().replace(/\/+$/, '');
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  });
  return out;
};

const resolvePortoRelayUrls = (chain: any, primaryUrl: string): string[] => uniqueRpcUrls([
  primaryUrl,
  ...(chain?.rpcUrls?.public?.http || []),
  ...(chain?.rpcUrls?.default?.http || []),
]);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const normalizePortoAddress = (value: unknown): string => String(value || '').trim().toLowerCase();
const getErrorMessage = (error: unknown): string => (
  error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message || error)
    : String(error || '')
);
const toUnknownRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);
const hasCurrentPortoSessionMetadata = (): boolean => (
  !!currentSession &&
  typeof currentSession === 'object' &&
  String(currentSession.credentialId || '').trim() !== '' &&
  normalizePortoAddress(currentSession.address) !== ''
);
const hasCurrentPortoSessionSigner = (): boolean => (
  !!currentSessionSignerAccount ||
  !!viemWalletClient ||
  (typeof currentSession?.privateKey === 'string' && currentSession.privateKey.length > 0)
);

const clearCurrentPortoSigner = (): void => { currentSessionSignerAccount = null; viemWalletClient = null; };
const clearCurrentPortoSession = (): void => {
  currentSession = null;
  clearCurrentPortoSigner();
};
const bumpPortoSessionRevision = (): number => {
  portoSessionRevision += 1;
  return portoSessionRevision;
};
const isPortoSessionTransitionInProgress = (): boolean => (
  portoAccountSwitchInProgress || portoSessionTransitionInProgress
);
const beginPortoSessionTransition = (): number => {
  const revision = bumpPortoSessionRevision();
  portoSessionTransitionInProgress = true;
  clearCurrentPortoSigner();
  return revision;
};
const finishPortoSessionTransition = (revision: number): void => {
  if (portoSessionRevision === revision) {
    portoSessionTransitionInProgress = false;
  }
};
const restoreWasSuperseded = (revisionAtStart: number): boolean => (
  isPortoSessionTransitionInProgress() || revisionAtStart !== portoSessionRevision
);
const currentPortoAddressOrNull = (): string | null => (
  currentSession ? currentSession.address : null
);
const suppressPersistedPortoSessionAddress = (address: unknown): void => {
  suppressedPersistedPortoSessionAddress = normalizePortoAddress(address);
};
const clearSuppressedPersistedPortoSessionAddress = (): void => {
  suppressedPersistedPortoSessionAddress = '';
};
const isSuppressedPersistedPortoSessionAddress = (address: unknown): boolean => (
  !!suppressedPersistedPortoSessionAddress &&
  normalizePortoAddress(address) === suppressedPersistedPortoSessionAddress
);

const buildHydratedPortoSession = ({ credentialId, address }: Partial<PortoSession> = {}): PortoSession | null => {
  const normalizedCredentialId = String(credentialId || '').trim();
  const rawAddress = String(address || '').trim();
  if (!normalizedCredentialId || !normalizePortoAddress(rawAddress)) {
    return null;
  }
  return {
    credentialId: normalizedCredentialId,
    address: rawAddress,
    privateKey: null,
  };
};

const adoptHydratedPortoSession = (session: Partial<PortoSession> | null | undefined): string | null => {
  const nextSession = buildHydratedPortoSession(session || {});
  if (!nextSession) return null;
  const prevAddress = normalizePortoAddress(currentSession?.address);
  const nextAddress = normalizePortoAddress(nextSession.address);
  currentSession = nextSession;
  bumpPortoSessionRevision();
  if (prevAddress && prevAddress !== nextAddress) {
    clearCurrentPortoSigner();
  }
  return currentSession.address;
};

/**
 * 1. WebAuthn Helpers (Native Browser API)
 * ------------------------------------------------------------------
 */

function bufferToBase64URL(buffer: any): string {
  const bytes = new Uint8Array(buffer);
  let string = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    string += String.fromCharCode(bytes[i]);
  }
  return btoa(string).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64URLToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 1.5 Secure Session Storage (IndexedDB + AES-GCM)
 * ------------------------------------------------------------------
 */
function openPortoSessionDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = indexedDB.open(PORTO_DB_NAME, PORTO_DB_VERSION);
    request.onerror = () => reject(request.error || new Error('Failed to open Porto session DB'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PORTO_DB_STORE)) {
        db.createObjectStore(PORTO_DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readPortoSessionRecord(): Promise<PortoSessionRecord | null> {
  const db = await openPortoSessionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PORTO_DB_STORE, 'readonly');
    const store = tx.objectStore(PORTO_DB_STORE);
    const request = store.get(PORTO_STORAGE_KEY);
    const cleanup = () => db.close();
    request.onsuccess = () => resolve((request.result as PortoSessionRecord | null) || null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = cleanup;
    tx.onerror = () => {
      cleanup();
      reject(tx.error);
    };
    tx.onabort = () => {
      cleanup();
      reject(tx.error);
    };
  });
}

async function writePortoSessionRecord(record: PortoSessionRecord): Promise<void> {
  const db = await openPortoSessionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PORTO_DB_STORE, 'readwrite');
    tx.objectStore(PORTO_DB_STORE).put(record, PORTO_STORAGE_KEY);
    const cleanup = () => db.close();
    tx.oncomplete = () => {
      cleanup();
      resolve();
    };
    tx.onerror = () => {
      cleanup();
      reject(tx.error);
    };
    tx.onabort = () => {
      cleanup();
      reject(tx.error);
    };
  });
}

async function deletePortoSessionRecord(): Promise<void> {
  const db = await openPortoSessionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PORTO_DB_STORE, 'readwrite');
    tx.objectStore(PORTO_DB_STORE).delete(PORTO_STORAGE_KEY);
    const cleanup = () => db.close();
    tx.oncomplete = () => {
      cleanup();
      resolve();
    };
    tx.onerror = () => {
      cleanup();
      reject(tx.error);
    };
    tx.onabort = () => {
      cleanup();
      reject(tx.error);
    };
  });
}

async function clearPersistedPortoSessionBestEffort(): Promise<void> {
  try {
    localStorage.removeItem(PORTO_STORAGE_KEY);
  } catch (e) {
    portoLog.warn('portoFunctions: fallback', e);
  }
  try {
    await deletePortoSessionRecord();
  } catch (e) {
    portoLog.error("Failed to clear Porto session:", e);
  }
}

async function derivePortoSessionKey(credentialId: string): Promise<CryptoKey> {
  if (!window.crypto?.subtle) {
    throw new Error('WebCrypto subtle API not available');
  }
  const material = textEncoder.encode(`${PORTO_SESSION_KEY_CONTEXT}:${credentialId}`);
  const hash = await window.crypto.subtle.digest('SHA-256', material);
  return window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptPrivateKey(privateKey: string, credentialId: string): Promise<EncryptedPrivateKeyRecord> {
  const key = await derivePortoSessionKey(credentialId);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = textEncoder.encode(privateKey);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return {
    iv: bufferToBase64URL(iv),
    data: bufferToBase64URL(ciphertext)
  };
}

async function decryptPrivateKey(encryptedPrivateKey: string, encryptedPrivateKeyIv: string, credentialId: string): Promise<string> {
  const key = await derivePortoSessionKey(credentialId);
  const iv = new Uint8Array(base64URLToBuffer(encryptedPrivateKeyIv));
  const ciphertext = new Uint8Array(base64URLToBuffer(encryptedPrivateKey));
  const plaintext = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return textDecoder.decode(plaintext);
}

const buildValidatedPortoSession = ({ credentialId, address, privateKey }: Partial<PortoSession> = {}): PortoSession | null => {
  const normalizedCredentialId = String(credentialId || '').trim();
  const normalizedPrivateKey = String(privateKey || '').trim();
  const normalizedAddress = normalizePortoAddress(address);
  if (!normalizedCredentialId || !normalizedPrivateKey || !normalizedAddress) {
    return null;
  }
  try {
    const account = privateKeyToAccount(normalizedPrivateKey as any);
    if (normalizePortoAddress(account.address) !== normalizedAddress) {
      return null;
    }
    return {
      credentialId: normalizedCredentialId,
      address: account.address,
      privateKey: normalizedPrivateKey,
    };
  } catch (_) {
    return null;
  }
};

async function promptForPasskey(credentialId: string): Promise<void> {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{
        type: 'public-key',
        id: base64URLToBuffer(credentialId),
        transports: ['internal', 'hybrid']
      }],
      userVerification: 'required',
      timeout: 60000
    }
  } as any);
}

/**
 * 2. Create the Viem Account wrapper around WebAuthn
 * ------------------------------------------------------------------
 */
function createWebAuthnViemAccount(credentialId: string, publicKey: string, signerAccount: any, options: AnyObj = {}): any {
  const {
    requireUserVerification = true,
    requireUserVerificationForTypedData = true
  } = options;

  return toAccount({
    address: publicKey,

    async signMessage({ message }: AnyObj) {
      if (requireUserVerification) {
        await promptForPasskey(credentialId);
      }
      return signerAccount.signMessage({ message });
    },

    async signTypedData(typedData: any) {
      portoLog.log("Signing TypedData (Porto):", typedData);
      if (requireUserVerificationForTypedData) {
        await promptForPasskey(credentialId);
      }

      // Sign with the deterministic key that matches 'publicKey'
      // This ensures the RPC recovers the same address displayed to the user
      return signerAccount.signTypedData(typedData);
    },

    async signTransaction(transaction: any) {
      portoLog.log("Signing Transaction (Porto):", transaction);

      if (requireUserVerification) {
        await promptForPasskey(credentialId);
      }

      // Sign with the deterministic key that matches 'publicKey'
      // This ensures the RPC recovers the same address that we displayed to the user.
      return signerAccount.signTransaction(transaction);
    }
  } as any);
}

function _initViemClient(): void {
  if (!currentSession) return;
  if (!relayUrl) {
    portoLog.warn('[PORTO_RPC] Missing relay URL; skipping client init.');
    return;
  }
  const signerAccount = currentSessionSignerAccount || (
    typeof currentSession.privateKey === 'string' && currentSession.privateKey
      ? privateKeyToAccount(currentSession.privateKey as any)
      : null
  );
  if (!signerAccount) {
    portoLog.warn('[PORTO_RPC] Missing session signer; skipping client init.');
    return;
  }
  currentSessionSignerAccount = signerAccount;

  // Regression guard (HIGH-01): restore must re-run WebAuthn before persisted
  // key material is usable, and the raw private-key string must not outlive client init.
  const account = createWebAuthnViemAccount(
      currentSession.credentialId,
      currentSession.address,
      signerAccount,
      {
        requireUserVerification: !sessionKeyEnabled,
        requireUserVerificationForTypedData: !sessionKeyEnabled
      }
  );

  const relayCandidates = resolvePortoRelayUrls(portoChain, relayUrl);
  const relayTransports: any[] = relayCandidates.map((url) => (
    http(url, {
      timeout: PORTO_RPC_TIMEOUT_MS,
      retryCount: PORTO_RPC_RETRY_COUNT,
    })
  ));
  const transport: any = relayTransports.length > 1
    ? fallback(relayTransports, {
      rank: false,
      retryCount: PORTO_FALLBACK_RETRY_COUNT,
    })
    : relayTransports[0];

  viemWalletClient = createWalletClient({
    account,
    chain: portoChain,
    transport,
  });
  portoLog.log('[PORTO_RPC] Relay URLs:', relayCandidates);

  // Store a reference on window for cross-module access (cryptography.js)
  // This avoids circular import issues
  if (typeof window !== 'undefined') {
    (window as any).__portoMockProvider = createPortoProviderMock();
  }

  if (typeof currentSession.privateKey === 'string') {
    currentSession.privateKey = null;
  }
}

async function persistPortoSession(session: PortoSession | null | undefined): Promise<boolean> {
  if (!session) return false;
  let privateKey: string | null = typeof session.privateKey === 'string'
    ? session.privateKey
    : null;

  try {
    if (!privateKey) throw new Error('Missing Porto session private key.');
    const encrypted = await encryptPrivateKey(privateKey, session.credentialId);
    await writePortoSessionRecord({
      version: PORTO_SESSION_RECORD_VERSION,
      credentialId: session.credentialId,
      address: session.address,
      encryptedPrivateKey: encrypted.data,
      encryptedPrivateKeyIv: encrypted.iv
    });
    localStorage.removeItem(PORTO_STORAGE_KEY);
    return true;
  } catch (e) {
    portoLog.error("Failed to persist Porto session:", e);
    return false;
  } finally {
    privateKey = null;
  }
}

async function readPersistedPortoSessionAddress(): Promise<string> {
  try {
    const record = await readPortoSessionRecord();
    if (
      record &&
      record.credentialId &&
      record.address &&
      record.encryptedPrivateKey &&
      record.encryptedPrivateKeyIv
    ) {
      const recordAddress = normalizePortoAddress(record.address);
      if (recordAddress) return recordAddress;
    }
  } catch (_) {
    // Fall through to the legacy record; persistence failure handling still decides whether to adopt.
  }

  try {
    const stored = localStorage.getItem(PORTO_STORAGE_KEY);
    if (!stored) return '';
    const session = JSON.parse(stored);
    if (!session?.credentialId || !session?.privateKey || !session?.address) return '';
    return normalizePortoAddress(session?.address);
  } catch (_) {
    return '';
  }
}

async function activatePortoSession(nextSession: PortoSession, signerAccount: unknown): Promise<string> {
  const prevAddress = normalizePortoAddress(currentSession?.address);
  const nextAddress = normalizePortoAddress(nextSession.address);
  const transitionRevision = beginPortoSessionTransition();
  let accountChanged = false;

  try {
    const persistedAddress = await readPersistedPortoSessionAddress();
    accountChanged = !!(
      nextAddress &&
      (
        (prevAddress && prevAddress !== nextAddress) ||
        (persistedAddress && persistedAddress !== nextAddress)
      )
    );
    if (accountChanged) portoAccountSwitchInProgress = true;

    const persisted = await persistPortoSession(nextSession);
    if (accountChanged && !persisted) {
      suppressPersistedPortoSessionAddress(persistedAddress || prevAddress);
      clearCurrentPortoSession();
      await clearPersistedPortoSessionBestEffort();
      throw new Error('Failed to persist selected Porto passkey session.');
    }

    clearSuppressedPersistedPortoSessionAddress();
    currentSession = nextSession;
    currentSessionSignerAccount = signerAccount;
    _initViemClient();
    return currentSession.address;
  } finally {
    if (accountChanged) portoAccountSwitchInProgress = false;
    finishPortoSessionTransition(transitionRevision);
  }
}

const adoptRestoredPortoSession = (
  restoredSession: PortoSession,
  signerAccount: unknown
): string | null => {
  currentSession = restoredSession;
  currentSessionSignerAccount = signerAccount;
  bumpPortoSessionRevision();
  _initViemClient();
  return currentSession.address;
};

const getSupersededRestoreAddress = (): string | null => (
  isPortoSessionTransitionInProgress() ? null : currentPortoAddressOrNull()
);

const shouldAbortPortoRestore = (revisionAtStart: number): boolean => (
  restoreWasSuperseded(revisionAtStart)
);

const finishAbortedPortoRestore = (): string | null => (
  getSupersededRestoreAddress()
);

async function restoreEncryptedPortoSessionRecord(
  record: PortoSessionRecord,
  requireSigner: boolean,
  revisionAtStart: number
): Promise<string | null> {
  if (!requireSigner) {
    if (shouldAbortPortoRestore(revisionAtStart)) return finishAbortedPortoRestore();
    const hydratedAddress = adoptHydratedPortoSession({
      credentialId: record.credentialId,
      address: record.address,
    });
    if (hydratedAddress) return hydratedAddress;
  }

  try {
    try {
      await promptForPasskey(record.credentialId);
    } catch (e: unknown) {
      portoLog.warn('Porto session restore blocked — passkey assertion failed:', getErrorMessage(e) || e);
      return null;
    }

    if (shouldAbortPortoRestore(revisionAtStart)) return finishAbortedPortoRestore();
    let privateKey: string | null = await decryptPrivateKey(
      record.encryptedPrivateKey,
      record.encryptedPrivateKeyIv,
      record.credentialId
    );
    try {
      if (shouldAbortPortoRestore(revisionAtStart)) return finishAbortedPortoRestore();
      const restoredSession = buildValidatedPortoSession({
        credentialId: record.credentialId,
        address: record.address,
        privateKey
      });
      if (!restoredSession) {
        portoLog.warn('Discarding invalid Porto session record: stored address does not match private key.');
      } else {
        return adoptRestoredPortoSession(restoredSession, privateKeyToAccount(privateKey as any));
      }
    } finally {
      privateKey = null;
    }
  } catch (e) {
    portoLog.error("Failed to decrypt Porto session:", e);
  }
  return null;
}

async function restoreLegacyPortoSession(
  session: unknown,
  requireSigner: boolean,
  revisionAtStart: number
): Promise<string | null> {
  const sessionRecord = toUnknownRecord(session);
  const restoredSession = buildValidatedPortoSession(sessionRecord);
  if (restoredSession) {
    if (!requireSigner) {
      if (shouldAbortPortoRestore(revisionAtStart)) return finishAbortedPortoRestore();
      const hydratedAddress = adoptHydratedPortoSession({
        credentialId: restoredSession.credentialId,
        address: restoredSession.address,
      });
      if (hydratedAddress) return hydratedAddress;
    }

    try {
      await promptForPasskey(restoredSession.credentialId);
    } catch (e: unknown) {
      portoLog.warn('Porto session restore blocked — passkey assertion failed:', getErrorMessage(e) || e);
      return null;
    }

    if (shouldAbortPortoRestore(revisionAtStart)) return finishAbortedPortoRestore();
    const persisted = await persistPortoSession(restoredSession);
    if (shouldAbortPortoRestore(revisionAtStart)) return finishAbortedPortoRestore();
    if (persisted) {
      localStorage.removeItem(PORTO_STORAGE_KEY);
    }
    return adoptRestoredPortoSession(restoredSession, privateKeyToAccount(restoredSession.privateKey as any));
  }
  if (sessionRecord.address || sessionRecord.privateKey || sessionRecord.credentialId) {
    portoLog.warn('Discarding invalid legacy Porto session: stored address does not match private key.');
    localStorage.removeItem(PORTO_STORAGE_KEY);
  }
  return null;
}

function getPortoSessionInProgressError(): Error {
  return new Error('Porto account switch is in progress. Retry after the selected passkey account finishes connecting.');
}

const PORTO_KDF_SALT = new TextEncoder().encode('contextengine.xyz:porto:v1');
const PORTO_KDF_INFO = new TextEncoder().encode('ethereum-private-key');

async function derivePortoPrivateKey(rawIdBytes: ArrayBuffer | Uint8Array): Promise<string> {
  const ikm = rawIdBytes instanceof Uint8Array ? rawIdBytes : new Uint8Array(rawIdBytes);
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: PORTO_KDF_SALT, info: PORTO_KDF_INFO },
    baseKey,
    256
  );
  return `0x${Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * 3. Public API
 * ------------------------------------------------------------------
 */

export async function authenticatePorto(): Promise<string> {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn not supported in this browser.");
  }

  // Generate a unique username to avoid "Duplicate Credential" errors on the same authenticator
  // Format: ContextEngine-June25-2025-333PM
  const date = new Date();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })
      .replace(/[:\s]/g, ''); // Remove colons and spaces (e.g., "3:33 PM" -> "333PM")

  const uniqueName = `ContextEngine-${month}${day}-${year}-${time}`;

  // Generate random challenge
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const createOptions = {
    challenge: challenge,
    rp: { name: "Context Engine", id: window.location.hostname },
    user: {
      id: Uint8Array.from(uniqueName, c => c.charCodeAt(0)),
      name: uniqueName,
      displayName: uniqueName,
    },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: 'required',      // Force creation of a discoverable credential (Resident Key)
      requireResidentKey: true,     // Backward compatibility
      userVerification: 'required'
    },
    timeout: 60000,
    attestation: "none"
  };

  try {
    const credential: any = await navigator.credentials.create({ publicKey: createOptions as any });

    // Derive the private key and address deterministically from the rawId bytes
    // This ensures the address we show the user is the same one that signs the tx
    const rawIdBytes = new Uint8Array(credential.rawId);
    let privateKey: string | null = await derivePortoPrivateKey(rawIdBytes);
    try {
      const account = privateKeyToAccount(privateKey as any);

      const nextSession = {
        credentialId: bufferToBase64URL(credential.rawId),
        address: account.address, // Use the real address derived from the key
        privateKey: privateKey    // Store for signing
      };

      return activatePortoSession(nextSession, account);
    } finally {
      privateKey = null;
    }
  } catch (err) {
    portoLog.error("WebAuthn registration failed:", err);
    throw err;
  }
}

export async function loginWithPorto(): Promise<string> {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn not supported in this browser.");
  }

  // Generate random challenge for the assertion
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  // Request an assertion (Sign In).
  // We do not pass 'allowCredentials' to let the browser show a list of discoverable credentials (resident keys)
  // or allow the user to select their passkey.
  const getOptions = {
    challenge: challenge,
    rpId: window.location.hostname,
    userVerification: "required",
  };

  try {
    const credential: any = await navigator.credentials.get({ publicKey: getOptions as any });
    if (!credential) throw new Error("No credential received.");

    // Re-derive the private key and address from the rawId (just like in registration)
    const rawIdBytes = new Uint8Array(credential.rawId);
    let newPrivateKey: string | null = await derivePortoPrivateKey(rawIdBytes);
    try {
      const newAccount = privateKeyToAccount(newPrivateKey as any);

      const nextSession = {
        credentialId: bufferToBase64URL(credential.rawId),
        address: newAccount.address,
        privateKey: newPrivateKey
      };

      return activatePortoSession(nextSession, newAccount);
    } finally {
      newPrivateKey = null;
    }
  } catch (err) {
    portoLog.error("WebAuthn login failed:", err);
    throw err;
  }
}

export async function restoreSession(options: RestoreSessionOptions = {}): Promise<string | null> {
  if (isPortoSessionTransitionInProgress()) return null;
  const revisionAtStart = portoSessionRevision;
  const requireSigner = options?.requireSigner !== false;
  try {
    if (hasCurrentPortoSessionMetadata() && (!requireSigner || hasCurrentPortoSessionSigner())) {
      return currentSession!.address;
    }

    let record: PortoSessionRecord | null = null;
    try {
      record = await readPortoSessionRecord();
    } catch (e) {
      portoLog.warn("IndexedDB restore failed, checking legacy storage:", e);
    }

    if (
      record &&
      record.credentialId &&
      record.address &&
      record.encryptedPrivateKey &&
      record.encryptedPrivateKeyIv
    ) {
      if (isSuppressedPersistedPortoSessionAddress(record.address)) {
        await clearPersistedPortoSessionBestEffort();
        return null;
      }
      const restoredAddress = await restoreEncryptedPortoSessionRecord(
        record,
        requireSigner,
        revisionAtStart
      );
      if (restoredAddress) return restoredAddress;
      if (shouldAbortPortoRestore(revisionAtStart)) return finishAbortedPortoRestore();
    }

    const stored = localStorage.getItem(PORTO_STORAGE_KEY);
    if (stored) {
      const session = JSON.parse(stored) as unknown;
      const sessionRecord = toUnknownRecord(session);
      if (isSuppressedPersistedPortoSessionAddress(sessionRecord.address)) {
        await clearPersistedPortoSessionBestEffort();
        return null;
      }
      const restoredAddress = await restoreLegacyPortoSession(
        session,
        requireSigner,
        revisionAtStart
      );
      if (restoredAddress) return restoredAddress;
      if (shouldAbortPortoRestore(revisionAtStart)) return finishAbortedPortoRestore();
    }
  } catch (e) {
    portoLog.error("Failed to restore Porto session:", e);
  }
  return null;
}

export function logoutPorto(): void {
  portoAccountSwitchInProgress = false;
  portoSessionTransitionInProgress = false;
  clearSuppressedPersistedPortoSessionAddress();
  bumpPortoSessionRevision();
  void clearPersistedPortoSessionBestEffort();
  clearCurrentPortoSession();
}

export function getPortoAddress(): string | null {
  if (isPortoSessionTransitionInProgress()) return null;
  return currentPortoAddressOrNull();
}

export function setPortoSessionKeyEnabled(enabled: any): void {
  sessionKeyEnabled = Boolean(enabled);
  if (currentSession) {
    _initViemClient();
  }
}

export function getPortoSessionKeyEnabled(): boolean {
  return sessionKeyEnabled;
}

export function hasPortoSessionSigner(): boolean {
  return hasCurrentPortoSessionSigner();
}

export function isPortoAutoSignReady(): boolean {
  return !!(
    !isPortoSessionTransitionInProgress() &&
    sessionKeyEnabled &&
    hasCurrentPortoSessionMetadata() &&
    hasCurrentPortoSessionSigner()
  );
}

export async function sendPortoTransaction(txRequest: AnyObj): Promise<any> {
  if (isPortoSessionTransitionInProgress()) {
    throw getPortoSessionInProgressError();
  }
  if (!viemWalletClient) {
    await restoreSession({ requireSigner: true });
  }
  if (isPortoSessionTransitionInProgress()) {
    throw getPortoSessionInProgressError();
  }
  if (!viemWalletClient) throw new Error("Porto client not initialized");

  const collectErrorFragments = (value: any, depth = 0, out: string[] = []): string[] => {
    if (depth > 5 || value == null) return out;
    if (Array.isArray(value)) {
      value.forEach((item) => collectErrorFragments(item, depth + 1, out));
      return out;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
      out.push(String(value));
      return out;
    }
    if (typeof value !== 'object') return out;
    const obj = value;
    const keys = [
      'shortMessage',
      'details',
      'message',
      'code',
      'name',
      'reason',
      'metaMessages',
      'cause',
      'error',
      'data',
    ];
    keys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        collectErrorFragments(obj[key], depth + 1, out);
      }
    });
    return out;
  };
  const classifyRecoverableSendError = (error: unknown): {
    replacementUnderpriced: boolean;
    nonceTooLow: boolean;
    alreadyKnown: boolean;
    recoverable: boolean;
  } => {
    const blob = collectErrorFragments(error)
      .join(' ')
      .toLowerCase();
    const replacementUnderpriced = (
      blob.includes('replacement transaction underpriced')
      || blob.includes('replacement fee too low')
      || blob.includes('replacement_underpriced')
      || (blob.includes('replacement') && (blob.includes('underpriced') || blob.includes('fee too low')))
    );
    const nonceTooLow = (
      blob.includes('nonce too low')
      || blob.includes('nonce_too_low')
      || (blob.includes('nonce') && blob.includes('too low'))
    );
    const alreadyKnown = (
      blob.includes('already known')
      || blob.includes('already_known')
      || blob.includes('known transaction')
      || blob.includes('transaction already imported')
    );
    return {
      replacementUnderpriced,
      nonceTooLow,
      alreadyKnown,
      recoverable: replacementUnderpriced || nonceTooLow,
    };
  };
  const parseHexToBigInt = (value: any): bigint | null => {
    const raw = String(value || '').trim();
    if (!/^0x[0-9a-f]+$/i.test(raw)) return null;
    try {
      return BigInt(raw);
    } catch (_) {
      return null;
    }
  };
  const parseNonceToBigInt = (value: any): bigint | null => {
    if (value == null || value === '') return null;
    if (typeof value === 'bigint') {
      return value >= 0n ? value : null;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) return null;
      return BigInt(Math.trunc(value));
    }
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^0x[0-9a-f]+$/i.test(raw)) {
      try {
        return BigInt(raw);
      } catch (_) {
        return null;
      }
    }
    if (/^\d+$/.test(raw)) {
      try {
        return BigInt(raw);
      } catch (_) {
        return null;
      }
    }
    return null;
  };
  const parseFeeToBigInt = (value: any): bigint | null => {
    if (value == null || value === '') return null;
    if (typeof value === 'bigint') return value >= 0n ? value : null;
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) return null;
      return BigInt(Math.trunc(value));
    }
    if (typeof value === 'object') {
      if (typeof value.toBigInt === 'function') {
        try {
          const parsed = value.toBigInt();
          return typeof parsed === 'bigint' && parsed >= 0n ? parsed : null;
        } catch (_) {}
      }
      const hexLike = value._hex || value.hex;
      if (typeof hexLike === 'string') {
        const parsedHex = parseHexToBigInt(hexLike);
        if (parsedHex != null && parsedHex >= 0n) return parsedHex;
      }
      if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
        try {
          return parseFeeToBigInt(value.toString());
        } catch (_) {
          return null;
        }
      }
      return null;
    }
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^0x[0-9a-f]+$/i.test(raw)) {
      const parsedHex = parseHexToBigInt(raw);
      return parsedHex != null && parsedHex >= 0n ? parsedHex : null;
    }
    if (/^\d+$/.test(raw)) {
      try {
        return BigInt(raw);
      } catch (_) {
        return null;
      }
    }
    return null;
  };
  const bumpByPercent = (value: any, percent: any): bigint | null => {
    const base = (typeof value === 'bigint') ? value : null;
    if (!base || base <= 0n) return null;
    const pct = BigInt(Math.max(100, Number(percent) || 100));
    return (base * pct + 99n) / 100n;
  };
  const maxBigInt = (a: any, b: any): bigint | null => {
    const lhs = (typeof a === 'bigint' && a > 0n) ? a : null;
    const rhs = (typeof b === 'bigint' && b > 0n) ? b : null;
    if (lhs == null) return rhs;
    if (rhs == null) return lhs;
    return lhs > rhs ? lhs : rhs;
  };
  const readPendingNonce = async (): Promise<bigint | null> => {
    try {
      const nonceHex = await viemWalletClient.request({
        method: 'eth_getTransactionCount',
        params: [viemWalletClient.account.address, 'pending'],
      });
      return parseHexToBigInt(nonceHex);
    } catch (_) {
      return null;
    }
  };
  const readGasPrice = async (): Promise<bigint | null> => {
    try {
      const gasPriceHex = await viemWalletClient.request({
        method: 'eth_gasPrice',
        params: [],
      });
      return parseHexToBigInt(gasPriceHex);
    } catch (error: any) {
      const fallback = resolvePortoDefaultGasPriceWei(portoChain);
      portoLog.warn('[PORTO_RPC] eth_gasPrice failed; using chain default fallback', {
        chainId: portoChain?.id || null,
        fallback: fallback != null ? fallback.toString() : null,
        message: error?.shortMessage || error?.message || String(error),
      });
      return fallback;
    }
  };
  const sendAttempts = Math.max(1, Number.parseInt(String((globalThis as any)?.CE_PORTO_SEND_RETRY_ATTEMPTS || '4').trim(), 10) || 4);
  const retryBaseDelayMs = Math.max(100, Number.parseInt(String((globalThis as any)?.CE_PORTO_SEND_RETRY_BASE_DELAY_MS || '400').trim(), 10) || 400);
  const minRetryGasPriceWei = parseGweiToWei((globalThis as any)?.CE_PORTO_SEND_MIN_RETRY_GWEI || '0.08');

  try {
    const gasHex = txRequest.gas || txRequest.gasLimit || null;
    let gas = gasHex ? BigInt(gasHex) : undefined;
    const hasCalldata = !!(txRequest.data && String(txRequest.data) !== '0x');
    const shouldReestimate = hasCalldata && gas === BigInt(21000);
    if (gas && !shouldReestimate) {
      portoLog.log('[PORTO_RPC] Using provided gas:', gas.toString());
    }
    if (!gas || shouldReestimate) {
      try {
        const estimated = await viemWalletClient.estimateGas({
          account: viemWalletClient.account,
          to: txRequest.to,
          value: txRequest.value ? BigInt(txRequest.value) : BigInt(0),
          data: txRequest.data,
        });
        if (estimated) {
          gas = estimated;
          portoLog.log('[PORTO_RPC] Estimated gas:', estimated.toString());
        }
      } catch (err) {
        const fallback = resolvePortoFallbackGas(txRequest);
        portoLog.warn('[PORTO_RPC] Gas estimation failed; falling back', { fallback: fallback.toString(), err });
        if (!gas || shouldReestimate) gas = fallback;
      }
    }
    const callerGasPrice = parseFeeToBigInt(txRequest?.gasPrice);
    const callerMaxFeePerGas = parseFeeToBigInt(txRequest?.maxFeePerGas);
    const callerMaxPriorityFeePerGas = parseFeeToBigInt(txRequest?.maxPriorityFeePerGas);
    const useEip1559Fees = typeof callerMaxFeePerGas === 'bigint' && callerMaxFeePerGas > 0n;
    const networkGasPrice = useEip1559Fees ? null : await readGasPrice();
    let baselineGasPrice = useEip1559Fees ? null : maxBigInt(callerGasPrice, networkGasPrice);
    let baselineMaxFeePerGas = useEip1559Fees ? callerMaxFeePerGas : null;
    let baselineMaxPriorityFeePerGas = useEip1559Fees ? callerMaxPriorityFeePerGas : null;
    let replacementNonce = parseNonceToBigInt(txRequest?.nonce);
    let lastError: any = null;
    for (let attempt = 1; attempt <= sendAttempts; attempt += 1) {
      const txPayload: AnyObj = {
        to: txRequest.to,
        value: txRequest.value ? BigInt(txRequest.value) : BigInt(0),
        data: txRequest.data,
        gas,
        chain: portoChain,
        kzg: undefined,
        ...(replacementNonce != null ? { nonce: replacementNonce } : {}),
      };
      if (useEip1559Fees) {
        if (typeof baselineMaxFeePerGas === 'bigint' && baselineMaxFeePerGas > 0n) {
          txPayload.maxFeePerGas = baselineMaxFeePerGas;
        }
        if (typeof baselineMaxPriorityFeePerGas === 'bigint' && baselineMaxPriorityFeePerGas > 0n) {
          txPayload.maxPriorityFeePerGas = baselineMaxPriorityFeePerGas;
        }
      } else if (typeof baselineGasPrice === 'bigint' && baselineGasPrice > 0n) {
        txPayload.gasPrice = baselineGasPrice;
      }
      if (attempt > 1) {
        if (useEip1559Fees) {
          const priorAttemptedMaxFee = typeof txPayload.maxFeePerGas === 'bigint' && txPayload.maxFeePerGas > 0n
            ? txPayload.maxFeePerGas
            : baselineMaxFeePerGas;
          const priorAttemptedPriorityFee = typeof txPayload.maxPriorityFeePerGas === 'bigint' && txPayload.maxPriorityFeePerGas > 0n
            ? txPayload.maxPriorityFeePerGas
            : baselineMaxPriorityFeePerGas;
          const latestGasPrice = await readGasPrice();
          baselineMaxFeePerGas = maxBigInt(baselineMaxFeePerGas, latestGasPrice);
          const bumpedMaxFee = bumpByPercent(baselineMaxFeePerGas, 100 + (attempt * 25));
          const retryMaxFee = maxBigInt(
            maxBigInt(bumpedMaxFee, minRetryGasPriceWei),
            priorAttemptedMaxFee
          );
          if (retryMaxFee) {
            txPayload.maxFeePerGas = retryMaxFee;
          }
          if (typeof baselineMaxPriorityFeePerGas === 'bigint' && baselineMaxPriorityFeePerGas > 0n) {
            const bumpedPriorityFee = bumpByPercent(baselineMaxPriorityFeePerGas, 100 + (attempt * 25));
            const retryPriorityFee = maxBigInt(bumpedPriorityFee, priorAttemptedPriorityFee);
            if (retryPriorityFee) {
              txPayload.maxPriorityFeePerGas = retryPriorityFee;
            }
          }
        } else {
          const priorAttemptedGasPrice = typeof txPayload.gasPrice === 'bigint' && txPayload.gasPrice > 0n
            ? txPayload.gasPrice
            : baselineGasPrice;
          const latestGasPrice = await readGasPrice();
          baselineGasPrice = maxBigInt(baselineGasPrice, latestGasPrice);
          const bumpedGasPrice = bumpByPercent(baselineGasPrice, 100 + (attempt * 25));
          const retryGasPrice = maxBigInt(
            maxBigInt(bumpedGasPrice, minRetryGasPriceWei),
            priorAttemptedGasPrice
          );
          if (retryGasPrice) {
            txPayload.gasPrice = retryGasPrice;
          }
        }
        portoLog.warn('[PORTO_RPC] Retrying transaction with bumped fee', {
          attempt,
          nonce: replacementNonce != null ? replacementNonce.toString() : null,
          gasPrice: txPayload.gasPrice ? txPayload.gasPrice.toString() : null,
          maxFeePerGas: txPayload.maxFeePerGas ? txPayload.maxFeePerGas.toString() : null,
          maxPriorityFeePerGas: txPayload.maxPriorityFeePerGas ? txPayload.maxPriorityFeePerGas.toString() : null,
        });
      }
      try {
        // Convert Ethers v5 txRequest (hex strings) to Viem format (BigInts where needed)
        const hash = await viemWalletClient.sendTransaction(txPayload);
        return hash;
      } catch (error: any) {
        lastError = error;
        const recoverableSendError = classifyRecoverableSendError(error);
        portoLog.warn('[PORTO_RPC] sendTransaction attempt failed', {
          attempt,
          replacementUnderpriced: recoverableSendError.replacementUnderpriced,
          nonceTooLow: recoverableSendError.nonceTooLow,
          alreadyKnown: recoverableSendError.alreadyKnown,
          recoverable: recoverableSendError.recoverable,
          message: error?.shortMessage || error?.message || String(error),
        });
        if (recoverableSendError.recoverable) {
          const shouldRefreshNonce = recoverableSendError.nonceTooLow || replacementNonce == null;
          if (shouldRefreshNonce) {
            const pendingNonce = await readPendingNonce();
            if (pendingNonce != null) {
              replacementNonce = pendingNonce;
              portoLog.warn('[PORTO_RPC] Pinned retry nonce after recoverable send failure', {
                nonce: replacementNonce.toString(),
              });
            }
          }
        }
        if (!recoverableSendError.recoverable || attempt >= sendAttempts) {
          throw error;
        }
        if (useEip1559Fees) {
          if (typeof txPayload.maxFeePerGas === 'bigint' && txPayload.maxFeePerGas > 0n) {
            baselineMaxFeePerGas = txPayload.maxFeePerGas;
          }
          if (typeof txPayload.maxPriorityFeePerGas === 'bigint' && txPayload.maxPriorityFeePerGas > 0n) {
            baselineMaxPriorityFeePerGas = txPayload.maxPriorityFeePerGas;
          }
        } else if (typeof txPayload.gasPrice === 'bigint' && txPayload.gasPrice > 0n) {
          baselineGasPrice = txPayload.gasPrice;
        }
        // Short backoff so pending nonce/gas price can settle before replacement retry.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, retryBaseDelayMs * attempt));
      }
    }
    throw lastError || new Error('Porto transaction failed without error.');
  } catch (error) {
    portoLog.error("Porto Transaction Failed:", error);
    throw error;
  }
}

/**
 * 4. The Bridge: Mock Provider for Ethers v5
 * ------------------------------------------------------------------
 */
export const createPortoProviderMock = (): any => {
  return {
    isPorto: true,
    isMetaMask: false,

    // EIP-1193 request method
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts': {
          const addr = getPortoAddress();
          return addr ? [addr] : [];
        }

        case 'eth_chainId':
          return portoChainIdHex;

        case 'net_version':
          return portoChainIdDec;

        case 'eth_sendTransaction':
          // Intercept transaction, send via Viem sidecar
          return await sendPortoTransaction(params![0]);

        case 'eth_estimateGas': {
          const tx = params?.[0] || {};
          try {
            if (!viemWalletClient) throw new Error('Porto client not initialized');
            const gas = await viemWalletClient.estimateGas({
              account: viemWalletClient.account,
              to: tx.to,
              value: tx.value ? BigInt(tx.value) : BigInt(0),
              data: tx.data,
            });
            if (gas != null) {
              return `0x${gas.toString(16)}`;
            }
          } catch (err) {
            portoLog.warn('[PORTO_RPC] eth_estimateGas fallback:', err);
          }
          const fallbackGas = resolvePortoFallbackGas(tx);
          return `0x${fallbackGas.toString(16)}`;
        }

        case 'eth_signTypedData_v4': {
          // Required for EIP-712 signing in cryptography.js (key derivation)
          if (!viemWalletClient) {
            await restoreSession({ requireSigner: true });
          }
          if (!viemWalletClient) throw new Error("Porto client not initialized. Please authenticate first.");

          // params[0] is the address (from), params[1] is the typed data (JSON string or object)
          let typedData = typeof params?.[1] === 'string' ? JSON.parse(params[1]) : params?.[1];

          // Sanitization: Viem throws if 'EIP712Domain' is present in 'types'
          // We must remove it, as Viem infers it from the 'domain' property
          if (typedData.types && typedData.types.EIP712Domain) {
             const { EIP712Domain, ...restTypes } = typedData.types;
             typedData = { ...typedData, types: restTypes };
          }

          // Viem's signTypedData expects the typed data object directly
          return await viemWalletClient.signTypedData(typedData);
        }

        case 'personal_sign': {
          // Fallback signing method
          if (!viemWalletClient) {
            await restoreSession({ requireSigner: true });
          }
          if (!viemWalletClient) throw new Error("Porto client not initialized. Please authenticate first.");
          // params[0] is the hex-encoded message, params[1] is the address
          const rawMessage = params?.[0];
          const message =
            typeof rawMessage === 'string' && /^0x(?:[0-9a-fA-F]{2})*$/.test(rawMessage)
              ? { raw: rawMessage }
              : rawMessage;
          return await viemWalletClient.signMessage({ message });
        }

        // Handle standard read methods required for transaction confirmation
        case 'eth_getTransactionReceipt':
        case 'eth_getTransactionByHash':
        case 'eth_blockNumber':
        case 'eth_call':
        case 'eth_getBalance':
        case 'eth_gasPrice': {
          // Delegate read-only calls to the Viem client if initialized
          if (viemWalletClient) {
             try {
               return await viemWalletClient.request({ method, params });
             } catch (err: any) {
               const fallbackWei = resolvePortoDefaultGasPriceWei(portoChain);
               if (method === 'eth_gasPrice' && typeof fallbackWei === 'bigint' && fallbackWei > 0n) {
                 portoLog.warn('[PORTO_RPC] eth_gasPrice bridge fallback', {
                   chainId: portoChain?.id || null,
                   fallback: fallbackWei.toString(),
                   message: err?.shortMessage || err?.message || String(err),
                 });
                 return `0x${fallbackWei.toString(16)}`;
               }
               throw err;
             }
          }

          // Fallback to app's read provider if Viem not ready (e.g. read-only before auth)
          const readProvider = (contractScripts as any).getReadProviderForGroup('');
          // FallbackProvider in ethers v5 might not expose .send, so we check safely
          if(readProvider && typeof readProvider.send === 'function') {
             return await readProvider.send(method, params || []);
          }

          portoLog.warn(`PortoMock: Could not handle ${method} (no client/provider available)`);
          return null;
        }

        default:
          portoLog.warn(`PortoMock: Method ${method} not implemented, attempting passthrough...`);
          // Attempt passthrough to Viem client for any unhandled methods
          if (viemWalletClient) {
            try {
              return await viemWalletClient.request({ method, params });
            } catch (e) {
              portoLog.error(`PortoMock: Passthrough failed for ${method}:`, e);
            }
          }
          throw new Error(`PortoMock: Method ${method} not implemented`);
      }
    },

    // Stub event listeners to prevent Ethers errors
    on: (event: any, handler: any) => {},
    removeListener: (event: any, handler: any) => {},
    enable: async () => {
        const addr = getPortoAddress();
        return addr ? [addr] : [];
    }
  };
};

try {
  if (typeof window !== 'undefined') {
    (window as any).__ceCreatePortoProviderMock = createPortoProviderMock;
  }
} catch (e) { portoLog.warn('portoFunctions: fallback', e); }
