/**
 * @file encryptionGates.ts
 * @module encryptionGates
 * @description Encryption gate resolution — maps UI gate selections to Lit Protocol
 *              access control conditions for field-level encryption.
 *
 * Key exports: resolveEncryptionGate
 */

type PlainObject = Record<string, unknown>;

type EncryptionGate = PlainObject;

type EncryptionConfig = {
  encryption?: {
    gates?: Record<string, EncryptionGate> | null;
    gate?: EncryptionGate | null;
    defaultGateId?: string | null;
    primaryGateId?: string | null;
    gateId?: string | null;
    defaultGate?: string | null;
  } | null;
  encryptedFieldGates?: Record<string, string | string[] | null | undefined> | null;
  [key: string]: unknown;
};

const isPlainObject = (value: unknown): value is PlainObject =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const getGateMap = (cfg: EncryptionConfig = {}): Record<string, EncryptionGate> | null => {
  const gates = cfg?.encryption?.gates;
  if (!isPlainObject(gates)) return null;
  const gateIds = Object.keys(gates);
  if (!gateIds.length) return null;
  return gates as Record<string, EncryptionGate>;
};

const pickGateIdByUsage = (cfg: EncryptionConfig, gateIds: string[]): string | null => {
  if (!Array.isArray(gateIds) || !gateIds.length) return null;
  const fieldMap = cfg?.encryptedFieldGates;
  if (!isPlainObject(fieldMap)) return null;
  const counts: Record<string, number> = {};
  Object.values(fieldMap).forEach((value) => {
    if (!value) return;
    const ids = Array.isArray(value) ? value : [value];
    ids.forEach((gateId) => {
      if (!gateId || !gateIds.includes(gateId)) return;
      counts[gateId] = (counts[gateId] || 0) + 1;
    });
  });
  let bestId: string | null = null;
  let bestCount = 0;
  gateIds.forEach((gateId) => {
    const count = counts[gateId] || 0;
    if (!bestId || count > bestCount) {
      bestId = gateId;
      bestCount = count;
    }
  });
  return bestCount > 0 ? bestId : null;
};

const pickExplicitGateId = (cfg: EncryptionConfig, gateIds: string[]): string | null => {
  const raw =
    cfg?.encryption?.defaultGateId ||
    cfg?.encryption?.primaryGateId ||
    cfg?.encryption?.gateId ||
    cfg?.encryption?.defaultGate ||
    null;
  if (typeof raw !== 'string' || !raw) return null;
  return gateIds.includes(raw) ? raw : null;
};

const resolveEncryptionGate = (cfg: EncryptionConfig = {}): EncryptionGate | null => {
  const gates = getGateMap(cfg);
  const legacyGate = cfg?.encryption?.gate;
  if (gates) {
    const gateIds = Object.keys(gates);
    const explicitId = pickExplicitGateId(cfg, gateIds);
    const usageId = pickGateIdByUsage(cfg, gateIds);
    if (explicitId || usageId) {
      const gateId = explicitId || usageId;
      if (!gateId) return null;
      return gates[gateId] || null;
    }
    if (isPlainObject(legacyGate)) return legacyGate;
    return gates[gateIds[0]] || null;
  }
  if (isPlainObject(legacyGate)) return legacyGate;
  return null;
};

export { resolveEncryptionGate };
