/**
 * @module errorClassifiers
 * @description Pure transaction/RPC error classifiers and user-facing wrappers.
 */

import { notify } from '../ui/notify.js';
import { toStr } from '../shared/primitives.js';
import { isEmptyRevertDataValue } from './deterministicFactoryHelpers.js';
import { summarizeRpcError, truncateRpcString } from './rpcErrorSummarization.js';

type ErrorWithCode = Error & {
  code?: string;
  cause?: unknown;
};
type RpcErrorLike = {
  body?: unknown;
  cause?: unknown;
  code?: unknown;
  data?: unknown;
  error?: RpcErrorLike;
  errorName?: unknown;
  errors?: unknown[];
  message?: unknown;
  reason?: unknown;
  requestBody?: unknown;
  results?: unknown[];
};
type RpcSummary = {
  message?: unknown;
};

const asRpcErrorLike = (value: unknown): RpcErrorLike =>
  value && typeof value === 'object' ? (value as RpcErrorLike) : {};

const buildUnsupportedConfiguredDeterministicFactoryError = (
  factoryAddress = '',
  cause: unknown = null,
): ErrorWithCode => {
  const factorySuffix = factoryAddress ? ` (${factoryAddress})` : '';
  const wrappedError = new Error(
    `This session's SBT factory${factorySuffix} does not support predictable-address deployment yet. ` +
      'Turn off "Make address predictable before deploy", or switch to a newer SBT factory.',
  ) as ErrorWithCode;
  wrappedError.code = 'UNSUPPORTED_CONFIGURED_DETERMINISTIC_FACTORY';
  if (cause) wrappedError.cause = cause;
  return wrappedError;
};

export const isUnsupportedConfiguredDeterministicFactoryError = (error: unknown): boolean => {
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();
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
      if (raw.includes('missing revert data') || raw.includes('"data":"0x"') || raw.includes('data="0x"')) {
        sawEmptyData = true;
      }
      continue;
    }

    if (seen.has(current)) continue;
    seen.add(current);
    const currentError = asRpcErrorLike(current);
    const nestedError = asRpcErrorLike(currentError.error);

    const code = toStr(currentError.code || nestedError.code).toUpperCase();
    const message = toStr(
      currentError.message || currentError.reason || nestedError.message || nestedError.reason,
    ).toLowerCase();
    const body = toStr(currentError.body || nestedError.body).toLowerCase();
    const requestBody = toStr(currentError.requestBody || nestedError.requestBody).toLowerCase();

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
      isEmptyRevertDataValue(currentError.data) ||
      isEmptyRevertDataValue(nestedError.data) ||
      body.includes('"data":"0x"') ||
      body.includes('"data":"0x0"') ||
      requestBody.includes('"data":"0x"') ||
      requestBody.includes('"data":"0x0"') ||
      message.includes('data="0x"') ||
      message.includes('missing revert data')
    ) {
      sawEmptyData = true;
    }

    if (currentError.error) queue.push(currentError.error);
    if (currentError.cause) queue.push(currentError.cause);
    if (currentError.data && typeof currentError.data === 'object') queue.push(currentError.data);
    if (Array.isArray(currentError.errors)) queue.push(...currentError.errors);
    if (Array.isArray(currentError.results)) queue.push(...currentError.results);
  }

  return sawRevert && sawEmptyData;
};

export const maybeWrapUnsupportedConfiguredDeterministicFactoryError = (
  error: unknown,
  factoryAddress = '',
): unknown => {
  if (!isUnsupportedConfiguredDeterministicFactoryError(error)) return error;
  return buildUnsupportedConfiguredDeterministicFactoryError(factoryAddress, error);
};

export const extractEstimateErrorMessage = (err: unknown): string => {
  const error = asRpcErrorLike(err);
  const nestedError = asRpcErrorLike(error.error);
  const data = asRpcErrorLike(error.data);
  return toStr(
    error.reason ||
      error.errorName ||
      nestedError.message ||
      nestedError.reason ||
      data.message ||
      error.message ||
      err,
  );
};

const NONEXISTENT_TOKEN_ERROR_PATTERNS = [
  'erc721nonexistenttoken',
  'nonexistent token',
  'owner query for nonexistent token',
];

export const isNonexistentTokenError = (err: unknown): boolean => {
  if (!err) return false;
  const error = asRpcErrorLike(err);
  const nestedError = asRpcErrorLike(error.error);
  const data = asRpcErrorLike(error.data);
  const errorName = toStr(error.errorName || nestedError.errorName).toLowerCase();
  if (errorName && NONEXISTENT_TOKEN_ERROR_PATTERNS.some((pattern) => errorName.includes(pattern))) {
    return true;
  }
  const haystack = [
    toStr(error.message),
    toStr(error.reason),
    toStr(nestedError.message),
    toStr(nestedError.reason),
    toStr(data.message),
  ]
    .join(' ')
    .toLowerCase();
  if (!haystack) return false;
  return NONEXISTENT_TOKEN_ERROR_PATTERNS.some((pattern) => haystack.includes(pattern));
};

export const isExecutionRevertDuringEstimate = (err: unknown): boolean => {
  if (!err) return false;
  const error = asRpcErrorLike(err);
  const nestedError = asRpcErrorLike(error.error);
  const code = toStr(error.code || nestedError.code).toUpperCase();
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

export const isWalletRejectionError = (err: unknown): boolean => {
  const error = asRpcErrorLike(err);
  const nestedError = asRpcErrorLike(error.error);
  const code = error.code ?? nestedError.code;
  if (code === 4001 || code === '4001' || code === 'ACTION_REJECTED') return true;
  const message = toStr(error.message || nestedError.message || error.reason || nestedError.reason).toLowerCase();
  return (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('user canceled') ||
    message.includes('user cancelled') ||
    message.includes('rejected the request')
  );
};

export const getUserFacingTransactionError = (err: unknown, maxLen = 180): string => {
  const summary = summarizeRpcError(err) as RpcSummary | null;
  const error = asRpcErrorLike(err);
  const nestedError = asRpcErrorLike(error.error);
  const data = asRpcErrorLike(error.data);
  const rawMessage = summary?.message || error.reason || nestedError.message || data.message || error.message || err;
  return truncateRpcString(toStr(rawMessage).replace(/\s+/g, ' ').trim() || 'Unknown error.', maxLen);
};

export const notifyUserFacingTransactionError = (err: unknown, prefix = 'Transaction failed: '): void => {
  if (isWalletRejectionError(err)) {
    notify.error('Wallet request rejected.');
    return;
  }
  notify.error(`${prefix}${getUserFacingTransactionError(err)}`);
};
