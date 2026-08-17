/**
 * @file encryptedFields.ts
 * @module encryptedFields
 * @description Field-level encryption/decryption — resolves encrypted field values in session
 *              configuration using the active crypto envelope.
 *
 * Key exports: resolveEncryptedValue, resolveEncryptedFieldValue, encryptedFieldsUtils
 */
import store from '../../store.js';
import { cryptoUtils } from './cryptography.js';
import { toStr } from '../shared/primitives.js';

type UnknownRecord = Record<string, unknown>;

type EncryptedEnvelope = string | UnknownRecord;

type LitHooks = {
  getKey?: (options?: UnknownRecord) => Promise<Uint8Array | string>;
} | null;

type EncryptionContext = {
  account?: string;
  providerLike?: unknown;
  chainId?: number | string | null;
  lit?: LitHooks;
};

type EncryptedValueStatus = 'missing' | 'wallet-required' | 'lit-unavailable' | 'encrypted' | 'locked';

type EncryptedValueResolution = {
  value: unknown;
  status: EncryptedValueStatus;
  encryptedAvailable: boolean;
};

type GroupCfg =
  | {
      encryptedFields?: Record<string, EncryptedEnvelope | null | undefined>;
    }
  | null
  | undefined;

type EncryptedFieldsApi = {
  resolveEncryptedValue: (
    envelope: EncryptedEnvelope | null | undefined,
    context?: EncryptionContext,
  ) => Promise<EncryptedValueResolution>;
  resolveEncryptedFieldValue: (
    groupCfg: GroupCfg,
    fieldPath: string | string[],
    context?: EncryptionContext,
  ) => Promise<EncryptedValueResolution>;
};

type WalletContext = {
  account: string;
  providerLike: unknown;
  chainId: number | string | null;
};

const pathKey = (path: string | string[]): string => (Array.isArray(path) ? path.join('.') : toStr(path));

const hasOverrideValue = (obj: UnknownRecord | null | undefined, key: string): boolean =>
  !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined;
const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};

const getWalletContext = (override: EncryptionContext = {}): WalletContext => {
  try {
    const state = store?.getState?.();
    const profile = asRecord(state?.profile);
    const network = asRecord(profile.network);
    const chainId = hasOverrideValue(override, 'chainId')
      ? (override.chainId ?? null)
      : network.id || network.chainId || null;
    return {
      account: hasOverrideValue(override, 'account') ? toStr(override.account) : toStr(profile.account),
      providerLike: hasOverrideValue(override, 'providerLike') ? override.providerLike : profile.provider || 'wagmi',
      chainId: typeof chainId === 'string' || typeof chainId === 'number' ? chainId : null,
    };
  } catch {
    return {
      account: hasOverrideValue(override, 'account') ? toStr(override.account) : '',
      providerLike: hasOverrideValue(override, 'providerLike') ? override.providerLike : 'wagmi',
      chainId: hasOverrideValue(override, 'chainId') ? (override.chainId ?? null) : null,
    };
  }
};

const getLitHooks = (override: EncryptionContext = {}): LitHooks => {
  if (override.lit) return override.lit;
  if (typeof window === 'undefined') return null;
  const litWindow = window as typeof window & {
    __litHooks?: LitHooks;
    litHooks?: LitHooks;
  };
  return litWindow.__litHooks || litWindow.litHooks || null;
};

/**
 * Resolves and decrypts a single encrypted envelope with the active wallet and Lit hook context.
 *
 * @param envelope
 * @param context
 * @returns {Promise<EncryptedValueResolution>}
 */
export const resolveEncryptedValue = async (
  envelope: EncryptedEnvelope | null | undefined,
  context: EncryptionContext = {},
): Promise<EncryptedValueResolution> => {
  if (!envelope) {
    return { value: '', status: 'missing', encryptedAvailable: false };
  }
  const envelopeJson = typeof envelope === 'string' ? envelope : JSON.stringify(envelope);
  if (!envelopeJson || envelopeJson === 'null') {
    return { value: '', status: 'missing', encryptedAvailable: false };
  }

  const wallet = getWalletContext(context);
  const lit = getLitHooks(context);

  if (!wallet.account) {
    return { value: '', status: 'wallet-required', encryptedAvailable: true };
  }
  if (!lit || typeof lit.getKey !== 'function') {
    return { value: '', status: 'lit-unavailable', encryptedAvailable: true };
  }

  try {
    const value = await cryptoUtils.decryptEnvelopeValue(envelopeJson, {
      account: wallet.account,
      chainId: wallet.chainId,
      providerLike: wallet.providerLike,
      litOpts: lit || undefined,
    });
    const decoded = value == null ? '' : value;
    return {
      value: decoded,
      status: decoded ? 'encrypted' : 'locked',
      encryptedAvailable: true,
    };
  } catch {
    return { value: '', status: 'locked', encryptedAvailable: true };
  }
};

/**
 * Resolves and decrypts an encrypted field stored under `groupCfg.encryptedFields[fieldPath]`.
 *
 * @param groupCfg
 * @param fieldPath
 * @param context
 * @returns {Promise<EncryptedValueResolution>}
 */
export const resolveEncryptedFieldValue = async (
  groupCfg: GroupCfg,
  fieldPath: string | string[],
  context: EncryptionContext = {},
): Promise<EncryptedValueResolution> => {
  const key = pathKey(fieldPath);
  if (!key) return { value: '', status: 'missing', encryptedAvailable: false };

  const encryptedFields = groupCfg?.encryptedFields;
  const envelope = encryptedFields && typeof encryptedFields === 'object' ? encryptedFields[key] : null;

  if (!envelope) {
    return { value: '', status: 'missing', encryptedAvailable: false };
  }

  const envelopeJson = typeof envelope === 'string' ? envelope : JSON.stringify(envelope);
  if (!envelopeJson || envelopeJson === 'null') {
    return { value: '', status: 'missing', encryptedAvailable: false };
  }

  const wallet = getWalletContext(context);
  const lit = getLitHooks(context);

  if (!wallet.account) {
    return { value: '', status: 'wallet-required', encryptedAvailable: true };
  }
  if (!lit || typeof lit.getKey !== 'function') {
    return { value: '', status: 'lit-unavailable', encryptedAvailable: true };
  }

  try {
    const value = await cryptoUtils.decryptEnvelopeValue(envelopeJson, {
      account: wallet.account,
      chainId: wallet.chainId,
      providerLike: wallet.providerLike,
      litOpts: lit || undefined,
    });
    const decoded = value == null ? '' : value;
    return {
      value: decoded,
      status: decoded ? 'encrypted' : 'locked',
      encryptedAvailable: true,
    };
  } catch {
    return { value: '', status: 'locked', encryptedAvailable: true };
  }
};

export const encryptedFieldsUtils = {
  resolveEncryptedValue,
  resolveEncryptedFieldValue,
} satisfies EncryptedFieldsApi;
