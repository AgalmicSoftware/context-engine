import { toStr } from './stringCoercion.js';

const normalizeAddressLower = (value) => toStr(value).trim().toLowerCase();

export const normalizeSignedWorkerRequest = (body = {}) => ({
  address: toStr(body?.address).trim(),
  message: toStr(body?.message).replace(/\r\n/g, '\n'),
  signature: toStr(body?.signature),
  requestId: toStr(body?.requestId).trim(),
});

export const validateRecoveredAddressMatchesRequest = ({
  recovered,
  address,
} = {}) => {
  const normalizedRecovered = normalizeAddressLower(recovered);
  const normalizedAddress = normalizeAddressLower(address);
  if (!normalizedRecovered || !normalizedAddress || normalizedRecovered !== normalizedAddress) {
    return { ok: false, error: 'Signature does not match address.' };
  }
  return { ok: true, error: '' };
};

export const validateSiweAddressMatchesRequest = ({
  siwe,
  address,
} = {}) => {
  const normalizedAddress = normalizeAddressLower(address);
  const normalizedSiweAddress = normalizeAddressLower(siwe?.address);
  if (!normalizedSiweAddress) return { ok: true, error: '' };
  if (!normalizedAddress || normalizedSiweAddress !== normalizedAddress) {
    return { ok: false, error: 'SIWE address mismatch.' };
  }
  return { ok: true, error: '' };
};
