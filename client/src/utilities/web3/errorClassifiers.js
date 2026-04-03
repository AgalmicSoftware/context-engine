/**
 * @module errorClassifiers
 * @description Pure transaction/RPC error classifiers and user-facing wrappers.
 */

import { notify } from '../ui/notify.js';
import { toStr } from '../shared/primitives.js';
import { isEmptyRevertDataValue } from './deterministicFactoryHelpers.js';
import { summarizeRpcError, truncateRpcString } from './rpcErrorSummarization.js';

const buildUnsupportedConfiguredDeterministicFactoryError = (factoryAddress = '', cause = null) => {
  const factorySuffix = factoryAddress ? ` (${factoryAddress})` : '';
  const wrappedError = new Error(
    `This session's SBT factory${factorySuffix} does not support predictable-address deployment yet. ` +
    'Turn off "Make address predictable before deploy", or switch to a newer SBT factory.'
  );
  wrappedError.code = 'UNSUPPORTED_CONFIGURED_DETERMINISTIC_FACTORY';
  if (cause) wrappedError.cause = cause;
  return wrappedError;
};

export const isUnsupportedConfiguredDeterministicFactoryError = (error) => {
  const queue = [error];
  const seen = new Set();
  let sawRevert = false;
  let sawEmptyData = false;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    if (typeof current !== 'object') {
      const raw = toStr(current).toLowerCase();
      if (
        raw.includes('call exception') ||
        raw.includes('execution reverted') ||
        raw.includes('missing revert data') ||
        raw.includes('cannot estimate gas')
      ) {
        sawRevert = true;
      }
      if (
        raw.includes('missing revert data') ||
        raw.includes('"data":"0x"') ||
        raw.includes('data="0x"')
      ) {
        sawEmptyData = true;
      }
      continue;
    }

    if (seen.has(current)) continue;
    seen.add(current);

    const code = toStr(current?.code || current?.error?.code).toUpperCase();
    const message = toStr(
      current?.message ||
      current?.reason ||
      current?.error?.message ||
      current?.error?.reason
    ).toLowerCase();
    const body = toStr(current?.body || current?.error?.body).toLowerCase();
    const requestBody = toStr(current?.requestBody || current?.error?.requestBody).toLowerCase();

    if (
      code === 'CALL_EXCEPTION' ||
      code === 'UNPREDICTABLE_GAS_LIMIT' ||
      message.includes('call exception') ||
      message.includes('execution reverted') ||
      message.includes('missing revert data') ||
      message.includes('cannot estimate gas')
    ) {
      sawRevert = true;
    }
    if (
      isEmptyRevertDataValue(current?.data) ||
      isEmptyRevertDataValue(current?.error?.data) ||
      body.includes('"data":"0x"') ||
      body.includes('"data":"0x0"') ||
      requestBody.includes('"data":"0x"') ||
      requestBody.includes('"data":"0x0"') ||
      message.includes('data="0x"') ||
      message.includes('missing revert data')
    ) {
      sawEmptyData = true;
    }

    if (current?.error) queue.push(current.error);
    if (current?.cause) queue.push(current.cause);
    if (current?.data && typeof current.data === 'object') queue.push(current.data);
    if (Array.isArray(current?.errors)) queue.push(...current.errors);
    if (Array.isArray(current?.results)) queue.push(...current.results);
  }

  return sawRevert && sawEmptyData;
};

export const maybeWrapUnsupportedConfiguredDeterministicFactoryError = (error, factoryAddress = '') => {
  if (!isUnsupportedConfiguredDeterministicFactoryError(error)) return error;
  return buildUnsupportedConfiguredDeterministicFactoryError(factoryAddress, error);
};

export const extractEstimateErrorMessage = (err) => (
  toStr(
    err?.reason ||
    err?.errorName ||
    err?.error?.message ||
    err?.error?.reason ||
    err?.data?.message ||
    err?.message ||
    err
  )
);

const NONEXISTENT_TOKEN_ERROR_PATTERNS = [
  'erc721nonexistenttoken',
  'nonexistent token',
  'owner query for nonexistent token',
];

export const isNonexistentTokenError = (err) => {
  if (!err) return false;
  const errorName = toStr(err?.errorName || err?.error?.errorName).toLowerCase();
  if (errorName && NONEXISTENT_TOKEN_ERROR_PATTERNS.some((pattern) => errorName.includes(pattern))) {
    return true;
  }
  const haystack = [
    toStr(err?.message),
    toStr(err?.reason),
    toStr(err?.error?.message),
    toStr(err?.error?.reason),
    toStr(err?.data?.message),
  ].join(' ').toLowerCase();
  if (!haystack) return false;
  return NONEXISTENT_TOKEN_ERROR_PATTERNS.some((pattern) => haystack.includes(pattern));
};

export const isExecutionRevertDuringEstimate = (err) => {
  if (!err) return false;
  const code = toStr(err?.code || err?.error?.code).toUpperCase();
  if (code === 'CALL_EXCEPTION') return true;
  const msg = extractEstimateErrorMessage(err).toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('execution reverted') ||
    msg.includes('reverted with reason string') ||
    msg.includes('always failing transaction') ||
    msg.includes('panic code') ||
    msg.includes('custom error')
  );
};

export const isWalletRejectionError = (err) => {
  const code = err?.code ?? err?.error?.code;
  if (code === 4001 || code === '4001' || code === 'ACTION_REJECTED') return true;
  const message = toStr(err?.message || err?.error?.message || err?.reason || err?.error?.reason).toLowerCase();
  return (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('user canceled') ||
    message.includes('user cancelled') ||
    message.includes('rejected the request')
  );
};

export const getUserFacingTransactionError = (err, maxLen = 180) => {
  const summary = summarizeRpcError(err);
  const rawMessage =
    summary?.message ||
    err?.reason ||
    err?.error?.message ||
    err?.data?.message ||
    err?.message ||
    err;
  return truncateRpcString(toStr(rawMessage).replace(/\s+/g, ' ').trim() || 'Unknown error.', maxLen);
};

export const notifyUserFacingTransactionError = (err, prefix = 'Transaction failed: ') => {
  if (isWalletRejectionError(err)) {
    notify.error('Wallet request rejected.');
    return;
  }
  notify.error(`${prefix}${getUserFacingTransactionError(err)}`);
};
