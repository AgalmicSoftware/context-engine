const DEFAULT_MAX_JSON_BYTES = 256 * 1024;

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

type JsonStringifyReplacer = Parameters<typeof JSON.stringify>[1];

type BoundedStringifyOptions = {
  maxBytes?: unknown;
  replacer?: JsonStringifyReplacer;
  space?: string | number;
};

type SafeJsonReadOptions = {
  clearInvalid?: boolean;
};

export type BoundedStringifyResult =
  | {
      ok: true;
      value: string;
      bytes: number;
      maxBytes: number;
    }
  | {
      ok: false;
      error: string;
      status: 'not-serializable' | 'too-large' | 'stringify-failed';
      bytes?: number;
      maxBytes?: number;
    };

export type SafeJsonReadResult<T = unknown> =
  | {
      ok: true;
      value: T;
      raw: string;
      status: 'ok';
    }
  | {
      ok: false;
      value: null;
      status: 'missing-storage' | 'read-failed' | 'missing' | 'parse-failed';
      error?: string;
      raw?: string | null;
    };

export type SafeJsonWriteResult =
  | {
      ok: true;
      bytes: number;
      key: string;
      status: 'ok';
    }
  | {
      ok: false;
      error: string;
      status: 'missing-storage' | 'not-serializable' | 'too-large' | 'stringify-failed' | 'write-failed';
      bytes?: number;
      maxBytes?: number;
    };

export type RemoveKeysResult = {
  ok: boolean;
  removed: number;
  failed: number;
  status: 'ok' | 'partial-failure' | 'missing-storage';
};

export type StorageNamespace = {
  base: string;
  key: (name?: string) => string;
};

const byteLength = (value: unknown): number => {
  const text = String(value || '');
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return text.length;
};

const errorMessage = (error: unknown): string =>
  error && typeof error === 'object' && 'message' in error && error.message
    ? String(error.message)
    : String(error || 'Storage operation failed.');

const normalizeKeyList = (keys: string | string[] | null | undefined): string[] =>
  Array.isArray(keys)
    ? keys.map((key) => String(key || '').trim()).filter(Boolean)
    : [String(keys || '').trim()].filter(Boolean);

export const boundedStringify = (payload: unknown, options: BoundedStringifyOptions = {}): BoundedStringifyResult => {
  const maxBytes = Number.isFinite(Number(options.maxBytes)) ? Number(options.maxBytes) : DEFAULT_MAX_JSON_BYTES;
  const replacer = options.replacer;

  try {
    const value =
      typeof replacer === 'function'
        ? JSON.stringify(payload, replacer, options.space)
        : JSON.stringify(payload, replacer ?? null, options.space);
    if (typeof value !== 'string') {
      return {
        ok: false,
        error: 'Payload cannot be serialized to JSON.',
        status: 'not-serializable',
      };
    }

    const bytes = byteLength(value);
    if (bytes > maxBytes) {
      return {
        ok: false,
        error: `Serialized payload exceeds ${maxBytes} bytes.`,
        status: 'too-large',
        bytes,
        maxBytes,
      };
    }

    return {
      ok: true,
      value,
      bytes,
      maxBytes,
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      status: 'stringify-failed',
    };
  }
};

export const safeJsonRead = <T = unknown>(
  storage: StorageLike | null | undefined,
  key: unknown,
  parser: ((value: unknown) => T) | null = null,
  options: SafeJsonReadOptions = {},
): SafeJsonReadResult<T> => {
  const normalizedKey = String(key || '').trim();
  if (!storage || !normalizedKey || typeof storage.getItem !== 'function') {
    return {
      ok: false,
      value: null,
      error: 'Storage and key are required.',
      status: 'missing-storage',
    };
  }

  let raw = null;
  try {
    raw = storage.getItem(normalizedKey);
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: errorMessage(error),
      status: 'read-failed',
    };
  }

  if (!raw) {
    return {
      ok: false,
      value: null,
      status: 'missing',
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const value = typeof parser === 'function' ? parser(parsed) : parsed;
    return {
      ok: true,
      value,
      raw,
      status: 'ok',
    };
  } catch (error) {
    if (options.clearInvalid && typeof storage.removeItem === 'function') {
      try {
        storage.removeItem(normalizedKey);
      } catch (_) {}
    }
    return {
      ok: false,
      value: null,
      raw,
      error: errorMessage(error),
      status: 'parse-failed',
    };
  }
};

export const safeJsonWrite = (
  storage: StorageLike | null | undefined,
  key: unknown,
  payload: unknown,
  options: BoundedStringifyOptions = {},
): SafeJsonWriteResult => {
  const normalizedKey = String(key || '').trim();
  if (!storage || !normalizedKey || typeof storage.setItem !== 'function') {
    return {
      ok: false,
      error: 'Storage and key are required.',
      status: 'missing-storage',
    };
  }

  const serialized = boundedStringify(payload, options);
  if (!serialized.ok) return serialized;

  try {
    storage.setItem(normalizedKey, serialized.value);
    return {
      ok: true,
      bytes: serialized.bytes,
      key: normalizedKey,
      status: 'ok',
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      status: 'write-failed',
    };
  }
};

export const removeKeys = (
  storage: StorageLike | null | undefined,
  keys: string | string[] | null | undefined,
): RemoveKeysResult => {
  const normalizedKeys = normalizeKeyList(keys);
  const removeItem = storage?.removeItem;
  if (!storage || typeof removeItem !== 'function') {
    return {
      ok: false,
      removed: 0,
      failed: normalizedKeys.length,
      status: 'missing-storage',
    };
  }

  let removed = 0;
  let failed = 0;
  normalizedKeys.forEach((key) => {
    try {
      removeItem.call(storage, key);
      removed += 1;
    } catch (_) {
      failed += 1;
    }
  });

  return {
    ok: failed === 0,
    removed,
    failed,
    status: failed === 0 ? 'ok' : 'partial-failure',
  };
};

export const createStorageNamespace = ({
  prefix,
  version = 1,
}: {
  prefix?: unknown;
  version?: unknown;
} = {}): StorageNamespace => {
  const normalizedPrefix = String(prefix || '')
    .trim()
    .replace(/:+$/g, '');
  const normalizedVersion = String(version || 1)
    .trim()
    .replace(/^v/i, '');
  const base = `${normalizedPrefix}:v${normalizedVersion}`;

  return {
    base,
    key(name = '') {
      const suffix = String(name || '')
        .trim()
        .replace(/^:+/g, '');
      return suffix ? `${base}:${suffix}` : base;
    },
  };
};
