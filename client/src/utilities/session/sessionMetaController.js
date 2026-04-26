const buildDecryptedAttemptKey = ({ slug, account, fieldKey = '', encrypted }) => {
  let encryptedKey = '';
  try {
    encryptedKey = typeof encrypted === 'string' ? encrypted : JSON.stringify(encrypted);
  } catch (_) {
    encryptedKey = String(encrypted);
  }
  return `${slug}|${account}|${fieldKey}|${encryptedKey}`;
};

const normalizeDecryptedValue = (value) => {
  const nextValue = value == null ? '' : String(value);
  return nextValue || '';
};

export const refreshSessionInfoForSlug = async ({
  slug,
  cfg,
  account,
  providerLike,
  getKey,
  lastAttemptKey = '',
  decryptEnvelopeValue,
}) => {
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
    chainId: cfg?.networkChainId || null,
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

export const refreshSessionMetaFieldsForSlug = async ({
  slug,
  cfg,
  account,
  providerLike,
  getKey,
  attempts = {},
  decryptEnvelopeValue,
}) => {
  const encryptedFields = cfg?.encryptedFields && typeof cfg.encryptedFields === 'object'
    ? cfg.encryptedFields
    : null;
  const nextAttempts = attempts && typeof attempts === 'object' ? { ...attempts } : {};
  if (!encryptedFields) {
    return { attempts: nextAttempts, patches: {}, errors: [] };
  }
  if (!account || typeof getKey !== 'function' || typeof decryptEnvelopeValue !== 'function') {
    return { attempts: nextAttempts, patches: {}, errors: [] };
  }

  const patches = {};
  const errors = [];
  const decryptField = async (fieldKey, stateKey, options = {}) => {
    const { requireOwnProperty = false } = options;
    if (requireOwnProperty && !Object.prototype.hasOwnProperty.call(encryptedFields, fieldKey)) {
      return;
    }

    const encrypted = encryptedFields[fieldKey];
    if (!encrypted) return;

    const attemptKey = buildDecryptedAttemptKey({
      slug,
      account,
      fieldKey,
      encrypted,
    });
    if (nextAttempts[attemptKey]) return;
    nextAttempts[attemptKey] = true;

    try {
      const value = await decryptEnvelopeValue(encrypted, {
        account,
        chainId: cfg?.networkChainId || null,
        providerLike,
        litOpts: { getKey },
      });
      const nextValue = normalizeDecryptedValue(value);
      if (!nextValue) return;
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
