const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const trim = (value) => toStr(value).trim();
const lower = (value) => trim(value).toLowerCase().replace(/-/g, '_');
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export const LEGACY_PAYLOAD_ACCESS_MODES = Object.freeze({
  PUBLIC_READ: 'public_read',
  WORKER_SBT_GATE: 'worker_sbt_gate',
  LIT_ENCRYPTED: 'lit_encrypted',
});

export const PAYLOAD_ACCESS_GATES = Object.freeze({
  NONE: 'none',
  SBT_GATE: 'sbt_gate',
  GROUP_GATE: 'group_gate',
  ROLE_GATE: 'role_gate',
});

export const PAYLOAD_ENCRYPTION_MODES = Object.freeze({
  NONE: 'none',
  WORKER_ENVELOPE: 'worker_envelope',
  LIT: 'lit',
});

const normalizeGate = (value, fallback = PAYLOAD_ACCESS_GATES.SBT_GATE) => {
  const normalized = lower(value);
  if (!normalized) return fallback;
  if (normalized === 'none' || normalized === 'public' || normalized === 'public_read') {
    return PAYLOAD_ACCESS_GATES.NONE;
  }
  if (
    normalized === 'sbt' ||
    normalized === 'sbt_gate' ||
    normalized === 'worker_sbt' ||
    normalized === 'worker_sbt_gate'
  ) {
    return PAYLOAD_ACCESS_GATES.SBT_GATE;
  }
  if (normalized === 'group' || normalized === 'group_gate' || normalized === 'worker_group') {
    return PAYLOAD_ACCESS_GATES.GROUP_GATE;
  }
  if (normalized === 'role' || normalized === 'role_gate' || normalized === 'worker_role') {
    return PAYLOAD_ACCESS_GATES.ROLE_GATE;
  }
  return fallback;
};

const normalizeEncryption = (value, fallback = PAYLOAD_ENCRYPTION_MODES.NONE) => {
  const raw = isObj(value) ? value.mode : value;
  const normalized = lower(raw);
  if (!normalized) return fallback;
  if (normalized === 'none' || normalized === 'plaintext' || normalized === 'plain') {
    return PAYLOAD_ENCRYPTION_MODES.NONE;
  }
  if (normalized === 'worker_envelope' || normalized === 'cloudflare_envelope') {
    return PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE;
  }
  if (normalized === 'lit' || normalized === 'lit_encrypted' || normalized === 'lit_arweave') {
    return PAYLOAD_ENCRYPTION_MODES.LIT;
  }
  return fallback;
};

export const normalizeLegacyPayloadAccessMode = (value, fallback = LEGACY_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE) => {
  const normalized = lower(value);
  if (
    normalized === LEGACY_PAYLOAD_ACCESS_MODES.PUBLIC_READ ||
    normalized === 'public'
  ) {
    return LEGACY_PAYLOAD_ACCESS_MODES.PUBLIC_READ;
  }
  if (
    normalized === LEGACY_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED ||
    normalized === 'lit' ||
    normalized === 'encrypted'
  ) {
    return LEGACY_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  }
  if (normalized === PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE || normalized === 'cloudflare_envelope') {
    return PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE;
  }
  if (
    normalized === LEGACY_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE ||
    normalized === 'worker_sbt' ||
    normalized === 'sbt_gate' ||
    normalized === 'sbt_gated'
  ) {
    return LEGACY_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE;
  }
  return fallback;
};

export const normalizePayloadAccessControl = (value, fallback = LEGACY_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE) => {
  const fallbackLegacy = normalizeLegacyPayloadAccessMode(fallback);
  if (isObj(value) && (Object.prototype.hasOwnProperty.call(value, 'gate') || Object.prototype.hasOwnProperty.call(value, 'encryption'))) {
    return {
      gate: normalizeGate(value.gate, fallbackLegacy === LEGACY_PAYLOAD_ACCESS_MODES.PUBLIC_READ
        ? PAYLOAD_ACCESS_GATES.NONE
        : PAYLOAD_ACCESS_GATES.SBT_GATE),
      encryption: normalizeEncryption(value.encryption, PAYLOAD_ENCRYPTION_MODES.NONE),
    };
  }

  const candidate = isObj(value)
    ? (
      value.mode ||
      value.payloadAccessMode ||
      value.accessControlMode ||
      (isObj(value.encryption) ? value.encryption.mode : value.encryption)
    )
    : value;
  const legacy = normalizeLegacyPayloadAccessMode(candidate, fallbackLegacy);
  if (legacy === LEGACY_PAYLOAD_ACCESS_MODES.PUBLIC_READ) {
    return { gate: PAYLOAD_ACCESS_GATES.NONE, encryption: PAYLOAD_ENCRYPTION_MODES.NONE };
  }
  if (legacy === LEGACY_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED) {
    return { gate: PAYLOAD_ACCESS_GATES.NONE, encryption: PAYLOAD_ENCRYPTION_MODES.LIT };
  }
  if (legacy === PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE) {
    return { gate: PAYLOAD_ACCESS_GATES.SBT_GATE, encryption: PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE };
  }
  return { gate: PAYLOAD_ACCESS_GATES.SBT_GATE, encryption: PAYLOAD_ENCRYPTION_MODES.NONE };
};

export const deriveLegacyPayloadAccessMode = (accessControl) => {
  const access = normalizePayloadAccessControl(accessControl);
  if (access.encryption === PAYLOAD_ENCRYPTION_MODES.LIT) {
    return LEGACY_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  }
  if (access.gate === PAYLOAD_ACCESS_GATES.NONE) {
    return LEGACY_PAYLOAD_ACCESS_MODES.PUBLIC_READ;
  }
  return LEGACY_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE;
};

export const payloadAccessUsesWorkerEnvelope = (accessControl) => (
  normalizePayloadAccessControl(accessControl).encryption === PAYLOAD_ENCRYPTION_MODES.WORKER_ENVELOPE
);
