const DEFAULT_MAX_JSON_BYTES = 256 * 1024;

const byteLength = (value) => {
  const text = String(value || '');
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return text.length;
};

const errorMessage = (error) => (
  error && typeof error === 'object' && error.message
    ? error.message
    : String(error || 'Storage operation failed.')
);

const normalizeKeyList = (keys) => (
  Array.isArray(keys)
    ? keys.map((key) => String(key || '').trim()).filter(Boolean)
    : [String(keys || '').trim()].filter(Boolean)
);

export const boundedStringify = (payload, options = {}) => {
  const maxBytes = Number.isFinite(Number(options.maxBytes))
    ? Number(options.maxBytes)
    : DEFAULT_MAX_JSON_BYTES;

  try {
    const value = JSON.stringify(payload, options.replacer, options.space);
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

export const safeJsonRead = (storage, key, parser = null, options = {}) => {
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

export const safeJsonWrite = (storage, key, payload, options = {}) => {
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

export const removeKeys = (storage, keys) => {
  const normalizedKeys = normalizeKeyList(keys);
  if (!storage || typeof storage.removeItem !== 'function') {
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
      storage.removeItem(key);
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

export const createStorageNamespace = ({ prefix, version = 1 } = {}) => {
  const normalizedPrefix = String(prefix || '').trim().replace(/:+$/g, '');
  const normalizedVersion = String(version || 1).trim().replace(/^v/i, '');
  const base = `${normalizedPrefix}:v${normalizedVersion}`;

  return {
    base,
    key(name = '') {
      const suffix = String(name || '').trim().replace(/^:+/g, '');
      return suffix ? `${base}:${suffix}` : base;
    },
  };
};

const storageJson = {
  boundedStringify,
  createStorageNamespace,
  removeKeys,
  safeJsonRead,
  safeJsonWrite,
};

export default storageJson;
