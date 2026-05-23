export const SESSION_SECRETS_ENVELOPE_VERSION = 1;
export const SESSION_SECRETS_ENVELOPE_KIND = 'session-secrets';

const isRecord = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const normalizeTimestampMs = (value) => {
  const raw = Number(value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1e12 ? Math.trunc(raw) : Math.trunc(raw * 1000);
};

const cloneRecord = (value) => (
  isRecord(value) ? { ...value } : {}
);

export const isSessionSecretsEnvelope = (value) => (
  isRecord(value) &&
  Number(value.v || 0) === SESSION_SECRETS_ENVELOPE_VERSION &&
  value.kind === SESSION_SECRETS_ENVELOPE_KIND
);

export const unwrapSessionSecretsEnvelope = (value) => {
  if (!isRecord(value)) return null;
  if (isSessionSecretsEnvelope(value)) {
    return cloneRecord(value.secrets);
  }
  if (Number(value.version || 0) === SESSION_SECRETS_ENVELOPE_VERSION && isRecord(value.secrets)) {
    return cloneRecord(value.secrets);
  }
  return cloneRecord(value);
};

export const buildSessionSecretsEnvelope = (
  secrets,
  { now, previousEnvelope } = {}
) => {
  const nowMs = normalizeTimestampMs(typeof now === 'function' ? now() : Date.now()) || Date.now();
  const previousCreatedAt = isSessionSecretsEnvelope(previousEnvelope)
    ? normalizeTimestampMs(previousEnvelope.createdAt)
    : 0;
  return {
    v: SESSION_SECRETS_ENVELOPE_VERSION,
    kind: SESSION_SECRETS_ENVELOPE_KIND,
    createdAt: previousCreatedAt || nowMs,
    updatedAt: nowMs,
    secrets: cloneRecord(secrets),
  };
};
