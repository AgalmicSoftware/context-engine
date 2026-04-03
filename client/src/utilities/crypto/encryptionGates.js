/**
 * @file encryptionGates.js
 * @module encryptionGates
 * @description Encryption gate resolution — maps UI gate selections to Lit Protocol
 *              access control conditions for field-level encryption.
 *
 * Key exports: resolveEncryptionGate
 */
const isPlainObject = (value) => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const getGateMap = (cfg = {}) => {
  const gates = cfg?.encryption?.gates;
  if (!isPlainObject(gates)) return null;
  const gateIds = Object.keys(gates);
  if (!gateIds.length) return null;
  return gates;
};

const pickGateIdByUsage = (cfg, gateIds) => {
  if (!Array.isArray(gateIds) || !gateIds.length) return null;
  const fieldMap = cfg?.encryptedFieldGates;
  if (!isPlainObject(fieldMap)) return null;
  const counts = {};
  Object.values(fieldMap).forEach((value) => {
    if (!value) return;
    const ids = Array.isArray(value) ? value : [value];
    ids.forEach((gateId) => {
      if (!gateId || !gateIds.includes(gateId)) return;
      counts[gateId] = (counts[gateId] || 0) + 1;
    });
  });
  let bestId = null;
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

const pickExplicitGateId = (cfg, gateIds) => {
  const raw =
    cfg?.encryption?.defaultGateId ||
    cfg?.encryption?.primaryGateId ||
    cfg?.encryption?.gateId ||
    cfg?.encryption?.defaultGate ||
    null;
  if (!raw) return null;
  return gateIds.includes(raw) ? raw : null;
};

const resolveEncryptionGate = (cfg = {}) => {
  const gates = getGateMap(cfg);
  const legacyGate = cfg?.encryption?.gate;
  if (gates) {
    const gateIds = Object.keys(gates);
    const explicitId = pickExplicitGateId(cfg, gateIds);
    const usageId = pickGateIdByUsage(cfg, gateIds);
    if (explicitId || usageId) {
      const gateId = explicitId || usageId;
      return gates[gateId] || null;
    }
    if (isPlainObject(legacyGate)) return legacyGate;
    return gates[gateIds[0]] || null;
  }
  if (isPlainObject(legacyGate)) return legacyGate;
  return null;
};

export { resolveEncryptionGate };
