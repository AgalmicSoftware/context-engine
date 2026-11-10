import { stableChipotleStringify as stableStringify } from './litChipotlePolicy.js';

type PolicyRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is PolicyRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const litPolicy = (value: unknown): string | null => {
  if (
    !isRecord(value) ||
    typeof value.chain !== 'string' ||
    !value.chain.trim() ||
    !Array.isArray(value.accessControlConditions) ||
    !value.accessControlConditions.length
  )
    return null;
  // Preserve condition array order and operators: rearranging a nested AND/OR
  // expression can change access. Only object key order is immaterial.
  return stableStringify({ chain: value.chain, accessControlConditions: value.accessControlConditions });
};

const policySet = (policies: unknown[]): string | null => {
  const canonical = policies.map(litPolicy);
  return canonical.some((policy) => policy === null) ? null : JSON.stringify([...new Set(canonical)].sort());
};

// The caller supplies options from the same builder used to encrypt this field.
// Ciphertext and per-encryption resource IDs do not describe its access policy.
export const responseEnvelopeMatchesAudience = (
  envelopeJson: unknown,
  audience: unknown,
  litOptions?: unknown,
): boolean => {
  const requested = String(audience || '')
    .trim()
    .toLowerCase();
  if (!['self', 'self_admin', 'session', 'gate'].includes(requested)) return false;
  try {
    const envelope = typeof envelopeJson === 'string' ? JSON.parse(envelopeJson) : envelopeJson;
    if (!isRecord(envelope) || !Array.isArray(envelope.recipients) || !envelope.recipients.every(isRecord))
      return false;
    const types = envelope.recipients.map((r) => r.type);
    const hasSelf = types.includes('self-eip712-v1');
    if (requested === 'self') return hasSelf && types.every((type) => type === 'self-eip712-v1');
    if (requested === 'gate') {
      if (
        !hasSelf ||
        !types.includes('lit-sbt-v1') ||
        !types.every((type) => ['self-eip712-v1', 'lit-sbt-v1'].includes(String(type))) ||
        !isRecord(litOptions)
      )
        return false;
      const configured = Array.isArray(litOptions.recipients) ? litOptions.recipients.filter(Boolean) : [];
      const specs = configured.length ? configured : [litOptions];
      const expected = policySet(specs.map((entry) => ({ ...litOptions, ...(isRecord(entry) ? entry : {}) })));
      const actual = policySet(envelope.recipients.filter((r) => r.type === 'lit-sbt-v1').map((r) => r.lit));
      return expected !== null && actual === expected;
    }
    const workers = envelope.recipients.filter((r) => r.type === 'worker-response-field-v1');
    return (
      hasSelf &&
      workers.length === 1 &&
      isRecord(workers[0].policy) &&
      workers[0].policy.audience === requested &&
      types.every((type) => ['self-eip712-v1', 'worker-response-field-v1'].includes(String(type)))
    );
  } catch {
    return false;
  }
};
