export interface SessionInfoRefreshArgs {
  slug: string;
  cfg: Record<string, unknown> | null | undefined;
  account: string;
  providerLike: unknown;
  getKey: ((...args: unknown[]) => unknown) | null | undefined;
  lastAttemptKey?: string;
  decryptEnvelopeValue: (encrypted: unknown, opts: Record<string, unknown>) => Promise<unknown>;
}

export interface SessionInfoRefreshResult {
  attemptKey: string;
  nextValue: string;
  shouldUpdate: boolean;
}

export interface SessionMetaFieldsRefreshArgs {
  slug: string;
  cfg: Record<string, unknown> | null | undefined;
  account: string;
  providerLike: unknown;
  getKey: ((...args: unknown[]) => unknown) | null | undefined;
  attempts?: Record<string, boolean>;
  decryptEnvelopeValue: (encrypted: unknown, opts: Record<string, unknown>) => Promise<unknown>;
}

export interface FieldDecryptError {
  error: unknown;
  fieldKey: string;
  stateKey: string;
}

export interface SessionMetaFieldsRefreshResult {
  attempts: Record<string, boolean>;
  patches: Record<string, Record<string, string>>;
  errors: FieldDecryptError[];
}

const buildDecryptedAttemptKey = ({
  slug,
  account,
  fieldKey = '',
  encrypted,
}: {
  slug: string;
  account: string;
  fieldKey?: string;
  encrypted: unknown;
}): string => {
  let encryptedKey = '';
  try {
    encryptedKey = typeof encrypted === 'string' ? encrypted : JSON.stringify(encrypted);
  } catch {
    encryptedKey = String(encrypted);
  }
  return `${slug}|${account}|${fieldKey}|${encryptedKey}`;
};

const normalizeDecryptedValue = (value: unknown): string => {
  const nextValue = value == null ? '' : String(value);
  return nextValue || '';
};

const getEncryptedFields = (cfg: Record<string, unknown> | null | undefined): Record<string, unknown> | null => {
  const encryptedFields = cfg?.encryptedFields;
  if (!encryptedFields || typeof encryptedFields !== 'object') {
    return null;
  }
  return encryptedFields as Record<string, unknown>;
};

const getChainId = (cfg: Record<string, unknown> | null | undefined): unknown => cfg?.networkChainId || null;

export const refreshSessionInfoForSlug = async (
  args: SessionInfoRefreshArgs,
): Promise<SessionInfoRefreshResult> => {
  const {
    slug,
    cfg,
    account,
    providerLike,
    getKey,
    lastAttemptKey = '',
    decryptEnvelopeValue,
  } = args;

  const encrypted = cfg?.sessionInfoEncrypted || cfg?.encryptedSessionInfo;
  if (!encrypted) {
    return { attemptKey: lastAttemptKey, nextValue: '', shouldUpdate: false };
  }
  if (!account || typeof getKey !== 'function' || typeof decryptEnvelopeValue !== 'function') {
    return { attemptKey: lastAttemptKey, nextValue: '', shouldUpdate: false };
  }

  const attemptKey = `${slug}|${account}|${encrypted}`;
  if (attemptKey === lastAttemptKey) {
    return { attemptKey, nextValue: '', shouldUpdate: false };
  }

  const value = await decryptEnvelopeValue(encrypted, {
    account,
    chainId: getChainId(cfg),
    providerLike,
    litOpts: { getKey },
  });
  const nextValue = normalizeDecryptedValue(value);
  return {
    attemptKey,
    nextValue,
    shouldUpdate: !!nextValue,
  };
};

export const refreshSessionMetaFieldsForSlug = async (
  args: SessionMetaFieldsRefreshArgs,
): Promise<SessionMetaFieldsRefreshResult> => {
  const {
    slug,
    cfg,
    account,
    providerLike,
    getKey,
    attempts = {},
    decryptEnvelopeValue,
  } = args;

  const encryptedFields = getEncryptedFields(cfg);
  const nextAttempts = attempts && typeof attempts === 'object' ? { ...attempts } : {};
  if (!encryptedFields) {
    return { attempts: nextAttempts, patches: {}, errors: [] };
  }
  if (!account || typeof getKey !== 'function' || typeof decryptEnvelopeValue !== 'function') {
    return { attempts: nextAttempts, patches: {}, errors: [] };
  }

  const patches: Record<string, Record<string, string>> = {};
  const errors: FieldDecryptError[] = [];

  const decryptField = async (
    fieldKey: string,
    stateKey: string,
    options: { requireOwnProperty?: boolean } = {},
  ): Promise<void> => {
    const { requireOwnProperty = false } = options;
    if (requireOwnProperty && !Object.prototype.hasOwnProperty.call(encryptedFields, fieldKey)) {
      return;
    }

    const encrypted = encryptedFields[fieldKey];
    if (!encrypted) {
      return;
    }

    const attemptKey = buildDecryptedAttemptKey({
      slug,
      account,
      fieldKey,
      encrypted,
    });
    if (nextAttempts[attemptKey]) {
      return;
    }
    nextAttempts[attemptKey] = true;

    try {
      const value = await decryptEnvelopeValue(encrypted, {
        account,
        chainId: getChainId(cfg),
        providerLike,
        litOpts: { getKey },
      });
      const nextValue = normalizeDecryptedValue(value);
      if (!nextValue) {
        return;
      }
      patches[stateKey] = {
        ...(patches[stateKey] || {}),
        [slug]: nextValue,
      };
    } catch (error) {
      errors.push({ error, fieldKey, stateKey });
    }
  };

  await Promise.all([
    decryptField('sessionName', 'sessionNameOverrides', { requireOwnProperty: true }),
    decryptField('sessionHeader', 'sessionHeaderOverrides'),
  ]);

  return {
    attempts: nextAttempts,
    patches,
    errors,
  };
};
