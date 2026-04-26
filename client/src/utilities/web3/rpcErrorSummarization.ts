/**
 * @module rpcErrorSummarization
 * @description RPC error formatting and debug logging helpers shared by contractScripts.
 */

import { createLogger, shouldLog } from '../logging.js';
import { toStr } from '../shared/primitives.js';

type AnyRecord = Record<string, any>;

const rpcLogger = createLogger('rpc', { prefix: '[RPC_DEBUG]' });
const RPC_ERROR_TREE_MAX_DEPTH = 5;
const RPC_ERROR_TREE_MAX_ARRAY = 8;
const RPC_ERROR_TREE_MAX_STRING = 1400;
const RPC_ERROR_TREE_MAX_STACK_LINES = 8;

const isVerboseRpcErrorsEnabled = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    return (window as Window & AnyRecord).CE_RPC_VERBOSE_ERRORS === true;
  } catch (_) {
    return false;
  }
};

export function truncateRpcString(value: unknown, maxLen = RPC_ERROR_TREE_MAX_STRING): string {
  const str = toStr(value);
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}…`;
}

export function summarizeRpcError(
  err: any,
  depth = RPC_ERROR_TREE_MAX_DEPTH,
  seen: Set<any> = new Set()
): unknown {
  if (err == null) return err;
  if (typeof err !== 'object') return truncateRpcString(err);
  if (seen.has(err)) return { circular: true };
  seen.add(err);

  const url =
    err?.url ||
    err?.error?.url ||
    err?.provider?.connection?.url;

  const summary: AnyRecord = {
    name: err?.name,
    code: err?.code ?? err?.error?.code,
    status: err?.status ?? err?.statusCode ?? err?.error?.status ?? err?.error?.statusCode,
    message: truncateRpcString(err?.message || err?.error?.message || err?.reason || err?.error?.reason),
    method: err?.method || err?.error?.method || err?.requestMethod,
    requestMethod: err?.requestMethod,
    url: url || undefined,
  };

  if (err?.stack) {
    summary.stack = err.stack.split('\n').slice(0, RPC_ERROR_TREE_MAX_STACK_LINES).join('\n');
  }
  if (err?.body) summary.body = truncateRpcString(err.body);
  if (err?.requestBody) summary.requestBody = truncateRpcString(err.requestBody);

  if (depth <= 0) return summary;

  if (err?.error) summary.error = summarizeRpcError(err.error, depth - 1, seen);
  if (err?.cause) summary.cause = summarizeRpcError(err.cause, depth - 1, seen);
  if (Array.isArray(err?.errors)) {
    summary.errors = err.errors.slice(0, RPC_ERROR_TREE_MAX_ARRAY)
      .map((e: unknown) => summarizeRpcError(e, depth - 1, seen));
  }
  if (Array.isArray(err?.results)) {
    summary.results = err.results.slice(0, RPC_ERROR_TREE_MAX_ARRAY)
      .map((e: unknown) => summarizeRpcError(e, depth - 1, seen));
  }
  if (err?.data && typeof err.data === 'object') {
    summary.data = summarizeRpcError(err.data, depth - 1, seen);
  }

  return summary;
}

export function logVerboseRpcError(label: unknown, err: unknown, meta: AnyRecord = {}): void {
  if (!isVerboseRpcErrorsEnabled()) return;
  if (!shouldLog('rpc', 'log')) return;
  const payload = { ...meta, error: summarizeRpcError(err) };
  rpcLogger.log(label, payload);
}
