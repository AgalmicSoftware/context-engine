/**
 * @file encryptedFields.js
 * @module encryptedFields
 * @description Field-level encryption/decryption — resolves encrypted field values in session
 *              configuration using the active crypto envelope.
 *
 * Key exports: resolveEncryptedValue, resolveEncryptedFieldValue, encryptedFieldsUtils
 */
import store from '../../store.js';
import { cryptoUtils } from './cryptography.js';
import { toStr } from '../shared/primitives.js';

const pathKey = (path) => (
  Array.isArray(path) ? path.join('.') : toStr(path)
);

const hasOverrideValue = (obj, key) => (
  !!obj &&
  typeof obj === 'object' &&
  Object.prototype.hasOwnProperty.call(obj, key) &&
  obj[key] !== undefined
);

const getWalletContext = (override = {}) => {
  try {
    const state = store?.getState?.();
    const profile = state?.profile || {};
    const network = profile.network || {};
    const chainId = hasOverrideValue(override, 'chainId')
      ? override.chainId
      : (network.id || network.chainId || null);
    return {
      account: hasOverrideValue(override, 'account') ? toStr(override.account) : (profile.account || ''),
      providerLike: hasOverrideValue(override, 'providerLike') ? override.providerLike : (profile.provider || 'wagmi'),
      chainId,
    };
  } catch {
    return {
      account: hasOverrideValue(override, 'account') ? toStr(override.account) : '',
      providerLike: hasOverrideValue(override, 'providerLike') ? override.providerLike : 'wagmi',
      chainId: hasOverrideValue(override, 'chainId') ? override.chainId : null,
    };
  }
};

const getLitHooks = (override = {}) => {
  if (override.lit) return override.lit;
  if (typeof window === 'undefined') return null;
  return window.__litHooks || window.litHooks || null;
};

export const resolveEncryptedValue = async (envelope, context = {}) => {
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

export const resolveEncryptedFieldValue = async (groupCfg, fieldPath, context = {}) => {
  const key = pathKey(fieldPath);
  if (!key) return { value: '', status: 'missing', encryptedAvailable: false };

  const encryptedFields = groupCfg?.encryptedFields;
  const envelope = encryptedFields && typeof encryptedFields === 'object'
    ? encryptedFields[key]
    : null;

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
};
