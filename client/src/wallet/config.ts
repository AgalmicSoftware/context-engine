import { readPublicBoolEnv, readPublicEnv, readPublicIntEnv } from '../variables/publicEnv.js';
import type { PasskeyWalletCapabilities, PasskeyWalletConfig } from './types.js';

const DEFAULT_RP_NAME = 'Context Engine';
const DEFAULT_TTL_SECONDS = 900;
const DEFAULT_WALLET_KEY_MODE = 'passkey-derived';
const DEFAULT_DERIVATION_NAMESPACE = 'context-engine';
const PREVIEW_HOST_PATTERNS = [
  /\.vercel\.app$/i,
  /\.netlify\.app$/i,
  /\.pages\.dev$/i,
  /\.workers\.dev$/i,
  /\.fly\.dev$/i,
  /\.render\.com$/i,
  /\.github\.io$/i,
];

const readDualEnv = (nextKey: string, reactKey: string, fallback = ''): string => {
  const nextValue = readPublicEnv(nextKey, '');
  if (nextValue) return nextValue;
  return readPublicEnv(reactKey, fallback);
};

const readDualBoolEnv = (nextKey: string, reactKey: string, fallback = false): boolean => {
  const nextValue = readPublicEnv(nextKey, '');
  if (nextValue !== '') return readPublicBoolEnv(nextKey, fallback);
  return readPublicBoolEnv(reactKey, fallback);
};

const readDualIntEnv = (nextKey: string, reactKey: string, fallback = 0): number => {
  const nextValue = readPublicEnv(nextKey, '');
  if (nextValue !== '') return readPublicIntEnv(nextKey, fallback);
  return readPublicIntEnv(reactKey, fallback);
};

const getWindowOrigin = (): string => {
  try {
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  } catch (e) {
    void e;
  }
  return '';
};

const getWindowHostname = (): string => {
  try {
    if (typeof window !== 'undefined' && window.location?.hostname) return window.location.hostname;
  } catch (e) {
    void e;
  }
  return '';
};

const normalizeHostname = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/\.$/, '');

const normalizeDerivationNamespace = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const isLocalHost = (host: string): boolean =>
  host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';

const isPreviewHost = (host: string): boolean => PREVIEW_HOST_PATTERNS.some((pattern) => pattern.test(host));

const originHost = (origin: string): string => {
  try {
    return normalizeHostname(new URL(origin).hostname);
  } catch (_) {
    return '';
  }
};

export const isRpIdAllowedForOrigin = (rpId: string, origin: string): boolean => {
  const normalizedRpId = normalizeHostname(rpId);
  const host = originHost(origin);
  if (!normalizedRpId || !host) return false;
  if (isLocalHost(normalizedRpId) && isLocalHost(host)) return true;
  return host === normalizedRpId || host.endsWith(`.${normalizedRpId}`);
};

export const validatePasskeyWalletConfig = (config: PasskeyWalletConfig): PasskeyWalletConfig => {
  const rpId = normalizeHostname(config.rpId);
  const derivationNamespace = normalizeDerivationNamespace(config.derivationNamespace) || DEFAULT_DERIVATION_NAMESPACE;
  if (config.walletMode !== 'passkey-eoa') {
    throw new Error(`Unsupported passkey wallet mode "${String(config.walletMode || '')}". Expected "passkey-eoa".`);
  }
  if (config.walletKeyMode !== 'passkey-derived' && config.walletKeyMode !== 'encrypted-private-key') {
    throw new Error(
      `Unsupported passkey wallet key mode "${String(config.walletKeyMode || '')}". Expected "passkey-derived" or "encrypted-private-key".`,
    );
  }
  if (config.sessionMode !== 'soft') {
    throw new Error(`Unsupported passkey wallet session mode "${String(config.sessionMode || '')}". Expected "soft".`);
  }
  if (!rpId) {
    throw new Error('Passkey wallet RP ID is required. Set NEXT_PUBLIC_RP_ID or REACT_APP_NEXT_PUBLIC_RP_ID.');
  }
  if (rpId.includes('porto') || rpId.includes('jaw') || rpId.includes('coinbase')) {
    throw new Error('Passkey wallet RP ID must be controlled by this deployment, not a third-party wallet domain.');
  }
  if (isPreviewHost(rpId) && !config.allowPreviewRpId) {
    throw new Error('Passkey wallet RP ID points at a preview domain. Set an owned RP ID before production launch.');
  }
  if (config.appOrigin && !isRpIdAllowedForOrigin(rpId, config.appOrigin)) {
    throw new Error(`Passkey wallet RP ID "${rpId}" is not valid for app origin "${config.appOrigin}".`);
  }
  if (config.accountOrigin && !isRpIdAllowedForOrigin(rpId, config.accountOrigin)) {
    throw new Error(`Passkey wallet RP ID "${rpId}" is not valid for account origin "${config.accountOrigin}".`);
  }
  return { ...config, rpId, derivationNamespace };
};

export const getPasskeyWalletConfig = (): PasskeyWalletConfig => {
  const windowOrigin = getWindowOrigin();
  const windowHost = normalizeHostname(getWindowHostname());
  const configuredRpId = readDualEnv('NEXT_PUBLIC_RP_ID', 'REACT_APP_NEXT_PUBLIC_RP_ID', '');
  const rpId = configuredRpId || (isLocalHost(windowHost) ? 'localhost' : '');
  const appOrigin = readDualEnv('NEXT_PUBLIC_APP_ORIGIN', 'REACT_APP_NEXT_PUBLIC_APP_ORIGIN', windowOrigin);
  const accountOrigin = readDualEnv('NEXT_PUBLIC_ACCOUNT_ORIGIN', 'REACT_APP_NEXT_PUBLIC_ACCOUNT_ORIGIN', appOrigin);
  const ttlSeconds = readDualIntEnv(
    'NEXT_PUBLIC_WALLET_UNLOCK_TTL_SECONDS',
    'REACT_APP_NEXT_PUBLIC_WALLET_UNLOCK_TTL_SECONDS',
    DEFAULT_TTL_SECONDS,
  );
  const walletMode = readDualEnv('NEXT_PUBLIC_WALLET_MODE', 'REACT_APP_NEXT_PUBLIC_WALLET_MODE', 'passkey-eoa');
  const walletKeyMode = readDualEnv(
    'NEXT_PUBLIC_WALLET_KEY_MODE',
    'REACT_APP_NEXT_PUBLIC_WALLET_KEY_MODE',
    DEFAULT_WALLET_KEY_MODE,
  );
  const sessionMode = readDualEnv('NEXT_PUBLIC_SESSION_MODE', 'REACT_APP_NEXT_PUBLIC_SESSION_MODE', 'soft');

  return validatePasskeyWalletConfig({
    rpId,
    rpName: readDualEnv('NEXT_PUBLIC_RP_NAME', 'REACT_APP_NEXT_PUBLIC_RP_NAME', DEFAULT_RP_NAME),
    appOrigin,
    accountOrigin,
    walletMode: walletMode === 'passkey-eoa' ? 'passkey-eoa' : 'passkey-eoa',
    walletKeyMode: walletKeyMode === 'encrypted-private-key' ? 'encrypted-private-key' : 'passkey-derived',
    sessionMode: sessionMode === 'soft' ? 'soft' : 'soft',
    unlockTtlSeconds: Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL_SECONDS,
    allowPreviewRpId: readDualBoolEnv(
      'NEXT_PUBLIC_ALLOW_PREVIEW_RP_ID',
      'REACT_APP_NEXT_PUBLIC_ALLOW_PREVIEW_RP_ID',
      false,
    ),
    storageMode: 'indexeddb',
    derivationNamespace: readDualEnv(
      'NEXT_PUBLIC_WALLET_DERIVATION_NAMESPACE',
      'REACT_APP_NEXT_PUBLIC_WALLET_DERIVATION_NAMESPACE',
      DEFAULT_DERIVATION_NAMESPACE,
    ),
  });
};

export const PASSKEY_WALLET_PROVIDER = 'passkey_eoa' as const;

export const PASSKEY_WALLET_CAPABILITIES: PasskeyWalletCapabilities = {
  passkeyWallet: true,
  eoa: true,
  softSessions: true,
  signMessage: true,
  signTypedData: true,
  sendTransaction: true,
  batching: false,
  sponsorship: false,
  paymaster: false,
  onchainPermissions: false,
  onchainPasskeyVerification: false,
};
