/**
 * @module rpcErrorSummarization
 * @description RPC error formatting and debug logging helpers shared by contractScripts.
 */

import { createLogger, shouldLog } from '../logging.js';
import { toStr } from '../shared/primitives.js';

type RpcRuntimeGlobals = Window & {
  CE_RPC_VERBOSE_ERRORS?: unknown;
};
type RpcErrorNode = {
  body?: unknown;
  cause?: unknown;
  code?: unknown;
  data?: unknown;
  error?: RpcErrorNode;
  errors?: unknown[];
  message?: unknown;
  method?: unknown;
  name?: unknown;
  provider?: {
    connection?: {
      url?: unknown;
    };
  };
  reason?: unknown;
  requestBody?: unknown;
  requestMethod?: unknown;
  results?: unknown[];
  stack?: unknown;
  status?: unknown;
  statusCode?: unknown;
  url?: unknown;
};
type RpcErrorSummary = Record<string, unknown>;
type StackLike = {
  split: (separator: string) => string[];
};

const asRpcErrorNode = (value: unknown): RpcErrorNode => (
  value && typeof value === 'object' ? value as RpcErrorNode : {}
);

const rpcLogger = createLogger('rpc', { prefix: '[RPC_DEBUG]' });
const RPC_ERROR_TREE_MAX_DEPTH = 5;
const RPC_ERROR_TREE_MAX_ARRAY = 8;
const RPC_ERROR_TREE_MAX_STRING = 1400;
const RPC_ERROR_TREE_MAX_STACK_LINES = 8;

const isVerboseRpcErrorsEnabled = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    return (window as RpcRuntimeGlobals).CE_RPC_VERBOSE_ERRORS === true;
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
  err: unknown,
  depth = RPC_ERROR_TREE_MAX_DEPTH,
  seen: Set<unknown> = new Set()
): unknown {
  if (err == null) return err;
  if (typeof err !== 'object') return truncateRpcString(err);
  if (seen.has(err)) return { circular: true };
  seen.add(err);
  const error = asRpcErrorNode(err);
  const nestedError = asRpcErrorNode(error.error);
  const providerConnection = asRpcErrorNode(error.provider?.connection);

  const url =
    error.url ||
    nestedError.url ||
    providerConnection.url;

  const summary: RpcErrorSummary = {
    name: error.name,
    code: error.code ?? nestedError.code,
    status: error.status ?? error.statusCode ?? nestedError.status ?? nestedError.statusCode,
    message: truncateRpcString(error.message || nestedError.message || error.reason || nestedError.reason),
    method: error.method || nestedError.method || error.requestMethod,
    requestMethod: error.requestMethod,
    url: url || undefined,
  };

  if (error.stack) {
    summary.stack = (error.stack as StackLike).split('\n').slice(0, RPC_ERROR_TREE_MAX_STACK_LINES).join('\n');
  }
  if (error.body) summary.body = truncateRpcString(error.body);
  if (error.requestBody) summary.requestBody = truncateRpcString(error.requestBody);

  if (depth <= 0) return summary;

  if (error.error) summary.error = summarizeRpcError(error.error, depth - 1, seen);
  if (error.cause) summary.cause = summarizeRpcError(error.cause, depth - 1, seen);
  if (Array.isArray(error.errors)) {
    summary.errors = error.errors.slice(0, RPC_ERROR_TREE_MAX_ARRAY)
      .map((e: unknown) => summarizeRpcError(e, depth - 1, seen));
  }
  if (Array.isArray(error.results)) {
    summary.results = error.results.slice(0, RPC_ERROR_TREE_MAX_ARRAY)
      .map((e: unknown) => summarizeRpcError(e, depth - 1, seen));
  }
  if (error.data && typeof error.data === 'object') {
    summary.data = summarizeRpcError(error.data, depth - 1, seen);
  }

  return summary;
}

export function logVerboseRpcError(label: unknown, err: unknown, meta: Record<string, unknown> = {}): void {
  if (!isVerboseRpcErrorsEnabled()) return;
  if (!shouldLog('rpc', 'log')) return;
  const payload = { ...meta, error: summarizeRpcError(err) };
  rpcLogger.log(label, payload);
}
